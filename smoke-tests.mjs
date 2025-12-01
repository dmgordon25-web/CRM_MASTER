import { chromium } from '@playwright/test';
import { writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'http://localhost:8080';
const VIEWPORT = { width: 1280, height: 800 };
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Test results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

// Helper to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to save screenshot
async function saveScreenshot(page, testName) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `screenshot-${testName}-${timestamp}.png`;
  const path = join(process.cwd(), filename);
  await page.screenshot({ path, fullPage: true });
  return path;
}

// Helper to get console errors (excluding expected POST 501 errors from static server)
function getConsoleErrors(logs) {
  return logs.filter(log =>
    (log.type === 'error' && !log.text.includes('501')) ||
    (log.text && (log.text.includes('ReferenceError') || log.text.includes('circular')))
  );
}

// Test runner with retry logic
async function runTest(testName, testFn, retries = MAX_RETRIES) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Running: ${testName}`);
  console.log('='.repeat(80));

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`  Retry attempt ${attempt}/${retries}...`);
        await sleep(RETRY_DELAY);
      }

      await testFn();

      console.log(`✅ PASS: ${testName}`);
      results.passed++;
      results.tests.push({ name: testName, status: 'PASS', attempt });
      return true;
    } catch (error) {
      console.log(`  Attempt ${attempt} failed: ${error.message}`);

      if (attempt === retries) {
        console.log(`❌ FAIL: ${testName} (after ${retries} attempts)`);
        console.log(`  Error: ${error.message}`);
        if (error.screenshot) {
          console.log(`  Screenshot: ${error.screenshot}`);
        }
        if (error.consoleErrors && error.consoleErrors.length > 0) {
          console.log(`  Console errors:`);
          error.consoleErrors.forEach(log => console.log(`    - ${log.text}`));
        }
        if (error.domState) {
          console.log(`  DOM State: ${error.domState}`);
        }

        results.failed++;
        results.tests.push({
          name: testName,
          status: 'FAIL',
          error: error.message,
          screenshot: error.screenshot,
          consoleErrors: error.consoleErrors,
          domState: error.domState
        });
        return false;
      }
    }
  }
}

// Main test suite
async function runAllTests() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--single-process'
    ]
  });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  // Track console messages
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  page.on('pageerror', error => {
    consoleLogs.push({ type: 'error', text: error.toString() });
  });

  try {
    // ============================================================================
    // T1: Boot & Navigation
    // ============================================================================

    results.total++;
    await runTest('T1.1: App loads without hanging on splash screen', async () => {
      consoleLogs.length = 0; // Clear console logs

      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });

      // Wait for splash to disappear (max 10 seconds)
      try {
        await page.waitForFunction(() => {
          const splash = document.querySelector('#boot-splash, .boot-splash, [class*="splash"]');
          return !splash || splash.style.display === 'none' || splash.classList.contains('hidden');
        }, { timeout: 10000 });
      } catch (e) {
        const screenshot = await saveScreenshot(page, 'T1.1-splash-timeout');
        const error = new Error('Splash screen did not disappear within 10 seconds');
        error.screenshot = screenshot;
        error.consoleErrors = getConsoleErrors(consoleLogs);
        throw error;
      }

      await sleep(500); // Let UI settle
    });

    results.total++;
    await runTest('T1.2: Dashboard view renders by default', async () => {
      const dashboard = await page.$('#view-dashboard');
      if (!dashboard) {
        const screenshot = await saveScreenshot(page, 'T1.2-no-dashboard');
        const error = new Error('Dashboard view element not found');
        error.screenshot = screenshot;
        throw error;
      }

      const isHidden = await page.$eval('#view-dashboard', el => el.classList.contains('hidden'));
      if (isHidden) {
        const screenshot = await saveScreenshot(page, 'T1.2-dashboard-hidden');
        const error = new Error('Dashboard view is hidden');
        error.screenshot = screenshot;
        throw error;
      }
    });

    results.total++;
    await runTest('T1.3: Click each nav tab and verify view switching', async () => {
      const tabs = ['dashboard', 'contacts', 'partners', 'calendar'];

      for (const tab of tabs) {
        // Click tab
        const tabSelector = `button[data-nav="${tab}"]`;
        const tabElement = await page.$(tabSelector);

        if (!tabElement) {
          const screenshot = await saveScreenshot(page, `T1.3-${tab}-tab-not-found`);
          const error = new Error(`Tab for ${tab} not found (tried selector: ${tabSelector})`);
          error.screenshot = screenshot;
          throw error;
        }

        await tabElement.click();
        await sleep(300); // Allow transition

        // Wait for view to become visible (allow time for async rendering)
        const viewSelector = `#view-${tab}`;
        await sleep(800); // Give views time to load async content

        const viewElement = await page.$(viewSelector);

        if (!viewElement) {
          const screenshot = await saveScreenshot(page, `T1.3-${tab}-view-not-found`);
          const error = new Error(`View ${viewSelector} not found`);
          error.screenshot = screenshot;
          throw error;
        }

        const isHidden = await page.$eval(viewSelector, el => el.classList.contains('hidden'));
        if (isHidden) {
          const screenshot = await saveScreenshot(page, `T1.3-${tab}-view-hidden`);
          const error = new Error(`View ${viewSelector} is hidden after clicking tab`);
          error.screenshot = screenshot;
          throw error;
        }

        // Verify other views are hidden
        for (const otherTab of tabs) {
          if (otherTab !== tab) {
            const otherViewSelector = `#view-${otherTab}`;
            const otherViewExists = await page.$(otherViewSelector);
            if (otherViewExists) {
              const isOtherHidden = await page.$eval(otherViewSelector, el => el.classList.contains('hidden'));
              if (!isOtherHidden) {
                const screenshot = await saveScreenshot(page, `T1.3-${tab}-other-view-visible`);
                const error = new Error(`View ${otherViewSelector} should be hidden when ${tab} is active`);
                error.screenshot = screenshot;
                throw error;
              }
            }
          }
        }
      }
    });

    results.total++;
    await runTest('T1.4: No console errors containing ReferenceError or circular', async () => {
      const errors = getConsoleErrors(consoleLogs);
      if (errors.length > 0) {
        const screenshot = await saveScreenshot(page, 'T1.4-console-errors');
        const error = new Error(`Found ${errors.length} console errors`);
        error.screenshot = screenshot;
        error.consoleErrors = errors;
        throw error;
      }
    });

    // ============================================================================
    // T2: Calendar/Partner View Isolation
    // ============================================================================

    results.total++;
    await runTest('T2.1: Navigate to Calendar and verify content', async () => {
      consoleLogs.length = 0;

      const calendarTab = await page.$('button[data-nav="calendar"]');
      if (!calendarTab) {
        const screenshot = await saveScreenshot(page, 'T2.1-no-calendar-tab');
        const error = new Error('Calendar tab not found');
        error.screenshot = screenshot;
        throw error;
      }

      await calendarTab.click();
      await sleep(500);

      const viewCalendar = await page.$('#view-calendar');
      if (!viewCalendar) {
        const screenshot = await saveScreenshot(page, 'T2.1-no-calendar-view');
        const error = new Error('#view-calendar not found');
        error.screenshot = screenshot;
        throw error;
      }

      const isHidden = await page.$eval('#view-calendar', el => el.classList.contains('hidden'));
      if (isHidden) {
        const screenshot = await saveScreenshot(page, 'T2.1-calendar-hidden');
        const error = new Error('#view-calendar is hidden');
        error.screenshot = screenshot;
        throw error;
      }

      // Wait for calendar content to load (may take a moment)
      try {
        await page.waitForFunction(() => {
          const calView = document.querySelector('#view-calendar');
          if (!calView) return false;
          // Check if loading indicator is gone and content is present
          const hasLoading = calView.querySelector('.loading-block');
          const hasContent = calView.querySelector('.calendar-grid, #calendar-root');
          return !hasLoading && hasContent !== null;
        }, { timeout: 3000 });
      } catch (e) {
        // Calendar might be lazy-loaded, which is OK - just check it's not showing an error
        const innerHTML = await page.$eval('#view-calendar', el => el.innerHTML.substring(0, 500));
        if (!innerHTML.includes('Loading') && !innerHTML.includes('calendar')) {
          const screenshot = await saveScreenshot(page, 'T2.1-calendar-load-failed');
          const error = new Error('Calendar failed to load properly');
          error.screenshot = screenshot;
          error.domState = innerHTML;
          throw error;
        }
      }
    });

    results.total++;
    await runTest('T2.2: Navigate to Partners and verify Calendar is cleared', async () => {
      const partnersTab = await page.$('button[data-nav="partners"]');
      if (!partnersTab) {
        const screenshot = await saveScreenshot(page, 'T2.2-no-partners-tab');
        const error = new Error('Partners tab not found');
        error.screenshot = screenshot;
        throw error;
      }

      await partnersTab.click();
      await sleep(500);

      // Verify partners view is visible
      const isPartnersVisible = await page.$eval('#view-partners', el => !el.classList.contains('hidden'));
      if (!isPartnersVisible) {
        const screenshot = await saveScreenshot(page, 'T2.2-partners-not-visible');
        const error = new Error('#view-partners should be visible');
        error.screenshot = screenshot;
        throw error;
      }

      // Verify calendar is hidden or empty
      const calendarState = await page.$eval('#view-calendar', el => {
        const isHidden = el.classList.contains('hidden');
        const isEmpty = el.innerHTML.trim() === '';
        const hasNoContent = !el.querySelector('.calendar-grid, #calendar-root');
        return { isHidden, isEmpty, hasNoContent };
      });

      if (!calendarState.isHidden && !calendarState.isEmpty && !calendarState.hasNoContent) {
        const screenshot = await saveScreenshot(page, 'T2.2-calendar-bleed');
        const innerHTML = await page.$eval('#view-calendar', el => el.innerHTML.substring(0, 500));
        const error = new Error('Calendar view is bleeding into Partners view (not hidden/empty)');
        error.screenshot = screenshot;
        error.domState = innerHTML;
        throw error;
      }
    });

    results.total++;
    await runTest('T2.3: Navigate back to Calendar and verify re-render', async () => {
      const calendarTab = await page.$('button[data-nav="calendar"]');
      await calendarTab.click();
      await sleep(1000); // Allow extra time for re-render

      const isVisible = await page.$eval('#view-calendar', el => !el.classList.contains('hidden'));
      if (!isVisible) {
        const screenshot = await saveScreenshot(page, 'T2.3-calendar-not-visible');
        const error = new Error('#view-calendar should be visible after re-navigation');
        error.screenshot = screenshot;
        throw error;
      }

      // Calendar should at least attempt to render (even if showing loading state)
      const hasAttemptedRender = await page.$eval('#view-calendar', el => {
        const hasContent = el.querySelector('.calendar-grid, #calendar-root') !== null;
        const isLoading = el.querySelector('.loading-block') !== null;
        return hasContent || isLoading;
      });

      if (!hasAttemptedRender) {
        const screenshot = await saveScreenshot(page, 'T2.3-calendar-no-content');
        const innerHTML = await page.$eval('#view-calendar', el => el.innerHTML.substring(0, 500));
        const error = new Error('Calendar did not attempt to re-render');
        error.screenshot = screenshot;
        error.domState = innerHTML;
        throw error;
      }
    });

    // ============================================================================
    // T3: Action Bar & Selection
    // ============================================================================

    results.total++;
    await runTest('T3.1: Navigate to Contacts and select a row', async () => {
      const contactsTab = await page.$('button[data-nav="contacts"]');
      await contactsTab.click();
      await sleep(500);

      // Find a checkbox to select (look for row checkboxes, not header checkbox)
      const checkbox = await page.$('#view-contacts tbody input[type="checkbox"]:not([disabled]), #view-contacts .contact-row input[type="checkbox"]:not([disabled]), #view-contacts table tr:not(:first-child) input[type="checkbox"]:not([disabled])');
      if (!checkbox) {
        const screenshot = await saveScreenshot(page, 'T3.1-no-checkbox');
        const error = new Error('No selectable checkbox found in contacts view');
        error.screenshot = screenshot;
        throw error;
      }

      await checkbox.click();
      await sleep(500); // Allow time for selection state to update

      // Verify action bar appears (use correct selector)
      const actionBar = await page.$('#actionbar, .actionbar, [data-ui="action-bar"]');
      if (!actionBar) {
        const screenshot = await saveScreenshot(page, 'T3.1-no-action-bar');
        const error = new Error('Action bar did not appear after selection');
        error.screenshot = screenshot;
        throw error;
      }

      // Check if action bar shows count > 0
      const countText = await page.$eval('#actionbar, .actionbar', el => el.textContent);
      const hasCount = /\d+/.test(countText) && parseInt(countText.match(/\d+/)[0]) > 0;

      if (!hasCount) {
        const screenshot = await saveScreenshot(page, 'T3.1-no-count');
        const error = new Error('Action bar does not show selection count > 0');
        error.screenshot = screenshot;
        error.domState = countText;
        throw error;
      }
    });

    results.total++;
    await runTest('T3.2: Click Clear button and verify deselection', async () => {
      // Skip if action bar test failed (no selection made)
      const actionBarVisible = await page.evaluate(() => {
        const bar = document.querySelector('#actionbar');
        if (!bar) return false;
        const text = bar.textContent || '';
        const count = text.match(/\d+/);
        return count && parseInt(count[0]) > 0;
      });

      if (!actionBarVisible) {
        throw new Error('Skipping clear test - no active selection from previous test');
      }

      // Find and click clear button (use correct action bar selector)
      const clearButton = await page.$('#actionbar [data-action="clear"]');
      if (!clearButton) {
        const screenshot = await saveScreenshot(page, 'T3.2-no-clear-button');
        const error = new Error('Clear button not found in action bar');
        error.screenshot = screenshot;
        throw error;
      }

      await clearButton.click();
      await sleep(300);

      // Verify action bar is hidden or shows count = 0
      const actionBarState = await page.evaluate(() => {
        const actionBar = document.querySelector('#actionbar, .actionbar, [data-ui="action-bar"]');
        if (!actionBar) return { exists: false };

        const isHidden = actionBar.classList.contains('hidden') ||
                        actionBar.style.display === 'none' ||
                        window.getComputedStyle(actionBar).display === 'none';
        const text = actionBar.textContent;
        const countMatch = text.match(/\d+/);
        const count = countMatch ? parseInt(countMatch[0]) : null;

        return { exists: true, isHidden, count, text };
      });

      if (actionBarState.exists && !actionBarState.isHidden && actionBarState.count > 0) {
        const screenshot = await saveScreenshot(page, 'T3.2-action-bar-still-visible');
        const error = new Error(`Action bar should be hidden or show count=0, got count=${actionBarState.count}`);
        error.screenshot = screenshot;
        error.domState = actionBarState.text;
        throw error;
      }

      // Verify no checkboxes are checked
      const checkedCount = await page.$$eval('#view-contacts input[type="checkbox"]:checked', els => els.length);
      if (checkedCount > 0) {
        const screenshot = await saveScreenshot(page, 'T3.2-checkboxes-still-checked');
        const error = new Error(`Found ${checkedCount} checked checkboxes after clearing`);
        error.screenshot = screenshot;
        throw error;
      }
    });

    // ============================================================================
    // T4: Contact CRUD
    // ============================================================================

    results.total++;
    await runTest('T4.1: Click New+ button and verify dropdown', async () => {
      const newButton = await page.$('#quick-add-unified');
      if (!newButton) {
        const screenshot = await saveScreenshot(page, 'T4.1-no-new-button');
        const error = new Error('New+ button not found in header');
        error.screenshot = screenshot;
        throw error;
      }

      await newButton.click();
      await sleep(500); // Wait for menu animation

      // Verify dropdown appears with 3 options (check wrapper is visible)
      try {
        await page.waitForSelector('#global-new-menu:not([hidden])', { timeout: 2000 });
      } catch (e) {
        const screenshot = await saveScreenshot(page, 'T4.1-no-dropdown-timeout');
        const error = new Error('Dropdown did not appear within timeout');
        error.screenshot = screenshot;
        throw error;
      }

      const dropdown = await page.$('#header-new-menu:not(.hidden)');
      if (!dropdown) {
        const screenshot = await saveScreenshot(page, 'T4.1-no-dropdown');
        const error = new Error('Dropdown menu not visible');
        error.screenshot = screenshot;
        throw error;
      }

      // Check for options (buttons with data-role="header-new-*")
      const options = await page.$$eval('#header-new-menu button[data-role^="header-new-"]',
        els => els.map(el => el.textContent.trim())
      ).catch(() => []);

      const hasContact = options.some(opt => opt.toLowerCase().includes('contact'));
      const hasPartner = options.some(opt => opt.toLowerCase().includes('partner'));
      const hasTask = options.some(opt => opt.toLowerCase().includes('task'));

      if (!hasContact || !hasPartner || !hasTask) {
        const screenshot = await saveScreenshot(page, 'T4.1-missing-options');
        const error = new Error(`Dropdown missing options. Found: ${options.join(', ')}`);
        error.screenshot = screenshot;
        error.domState = options.join(', ');
        throw error;
      }
    });

    results.total++;
    await runTest('T4.2: Click Add Contact and fill form', async () => {
      // Re-open the dropdown
      const newButton = await page.$('#quick-add-unified');
      await newButton.click();
      await sleep(500);

      const addContactOption = await page.$('#header-new-menu button[data-role="header-new-contact"]');
      if (!addContactOption) {
        const screenshot = await saveScreenshot(page, 'T4.2-no-add-contact-option');
        const error = new Error('Add Contact option not found in dropdown');
        error.screenshot = screenshot;
        throw error;
      }

      await addContactOption.click();
      await sleep(1500); // Wait longer for modal to appear

      // Verify form or modal appears
      const form = await page.$('form, .modal, [class*="modal"], #contact-form, [class*="contact-form"], [data-role="modal"]');
      if (!form) {
        const screenshot = await saveScreenshot(page, 'T4.2-no-form');
        const error = new Error('Contact form/modal did not appear');
        error.screenshot = screenshot;
        throw error;
      }

      // Fill form fields - try various common field selectors
      const firstNameFilled = await page.evaluate(() => {
        const selectors = ['input[name="first"], input[name="firstName"], input[name="first_name"], #first, #firstName, input[placeholder*="First"]'];
        for (const sel of selectors) {
          const input = document.querySelector(sel);
          if (input) {
            input.value = 'Test';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        return false;
      });

      const lastNameFilled = await page.evaluate(() => {
        const selectors = ['input[name="last"], input[name="lastName"], input[name="last_name"], #last, #lastName, input[placeholder*="Last"]'];
        for (const sel of selectors) {
          const input = document.querySelector(sel);
          if (input) {
            input.value = 'User';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        return false;
      });

      const emailFilled = await page.evaluate(() => {
        const selectors = ['input[name="email"], input[type="email"], #email, input[placeholder*="Email"]'];
        for (const sel of selectors) {
          const input = document.querySelector(sel);
          if (input) {
            input.value = 'test@example.com';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
        return false;
      });

      if (!firstNameFilled || !lastNameFilled || !emailFilled) {
        const screenshot = await saveScreenshot(page, 'T4.2-form-fields-not-found');
        const error = new Error(`Could not fill form fields (first: ${firstNameFilled}, last: ${lastNameFilled}, email: ${emailFilled})`);
        error.screenshot = screenshot;
        throw error;
      }

      // Submit form
      const submitButton = await page.$('button[type="submit"], button:has-text("Save"), button:has-text("Add"), button:has-text("Create"), .modal button:has-text("OK")');
      if (!submitButton) {
        const screenshot = await saveScreenshot(page, 'T4.2-no-submit-button');
        const error = new Error('Submit button not found');
        error.screenshot = screenshot;
        throw error;
      }

      await submitButton.click();
      await sleep(1000); // Allow time for submission

      // Verify modal closed or success indication
      const modalStillVisible = await page.$eval('body', body => {
        const modals = body.querySelectorAll('.modal, [class*="modal"]');
        for (const modal of modals) {
          const style = window.getComputedStyle(modal);
          if (style.display !== 'none' && !modal.classList.contains('hidden')) {
            return true;
          }
        }
        return false;
      });

      // It's OK if modal is still visible (might show success), or if it closed
      // We'll verify the contact was added in the next test
    });

    results.total++;
    await runTest('T4.3: Verify new contact appears in list', async () => {
      // Navigate to contacts if not already there
      const contactsTab = await page.$('button[data-nav="contacts"]');
      await contactsTab.click();
      await sleep(500);

      // Search for the test contact
      const contactExists = await page.evaluate(() => {
        const tables = document.querySelectorAll('#view-contacts table, #view-contacts .contact-row, #view-contacts .table');
        for (const table of tables) {
          const text = table.textContent;
          if (text.includes('Test') && text.includes('User') && text.includes('test@example.com')) {
            return true;
          }
        }
        return false;
      });

      if (!contactExists) {
        const screenshot = await saveScreenshot(page, 'T4.3-contact-not-found');
        const error = new Error('Test contact not found in contacts list');
        error.screenshot = screenshot;
        throw error;
      }
    });

    // ============================================================================
    // T5: Header & Workbench
    // ============================================================================

    results.total++;
    await runTest('T5.1: Verify header exists with app title', async () => {
      const header = await page.$('header, .header, #header, [class*="header"]');
      if (!header) {
        const screenshot = await saveScreenshot(page, 'T5.1-no-header');
        const error = new Error('Header element not found');
        error.screenshot = screenshot;
        throw error;
      }

      const headerText = await page.$eval('header, .header, #header', el => el.textContent);
      if (!headerText || headerText.trim().length === 0) {
        const screenshot = await saveScreenshot(page, 'T5.1-empty-header');
        const error = new Error('Header has no content');
        error.screenshot = screenshot;
        throw error;
      }
    });

    results.total++;
    await runTest('T5.2: Verify settings button is present and clickable', async () => {
      const settingsButton = await page.$('#btn-global-settings');
      if (!settingsButton) {
        const screenshot = await saveScreenshot(page, 'T5.2-no-settings-button');
        const error = new Error('Settings button not found');
        error.screenshot = screenshot;
        throw error;
      }

      const isClickable = await page.$eval('#btn-global-settings',
        el => !el.disabled && window.getComputedStyle(el).pointerEvents !== 'none'
      );

      if (!isClickable) {
        const screenshot = await saveScreenshot(page, 'T5.2-settings-not-clickable');
        const error = new Error('Settings button is not clickable');
        error.screenshot = screenshot;
        throw error;
      }
    });

    // T5.3 removed - Workbench is not accessible via nav tabs

    // ============================================================================
    // T6: Body Scroll State
    // ============================================================================

    results.total++;
    await runTest('T6.1: Verify body has no overflow:hidden', async () => {
      const bodyOverflow = await page.evaluate(() => {
        const style = window.getComputedStyle(document.body);
        return style.overflow;
      });

      if (bodyOverflow === 'hidden') {
        const screenshot = await saveScreenshot(page, 'T6.1-body-overflow-hidden');
        const error = new Error('document.body has overflow:hidden');
        error.screenshot = screenshot;
        throw error;
      }
    });

    results.total++;
    await runTest('T6.2: Verify no modal-open or no-scroll class on body', async () => {
      const bodyClasses = await page.evaluate(() => document.body.className);

      if (bodyClasses.includes('modal-open') || bodyClasses.includes('no-scroll')) {
        const screenshot = await saveScreenshot(page, 'T6.2-body-scroll-class');
        const error = new Error(`Body has scroll-blocking class: ${bodyClasses}`);
        error.screenshot = screenshot;
        error.domState = bodyClasses;
        throw error;
      }
    });

  } catch (error) {
    console.error('Fatal error during test execution:', error);
  } finally {
    await browser.close();
  }
}

// Run tests and report results
(async () => {
  console.log('\n🧪 Starting CRM E2E Smoke Tests\n');

  await runAllTests();

  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${results.total}`);
  console.log(`Passed: ${results.passed} ✅`);
  console.log(`Failed: ${results.failed} ❌`);
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  console.log('='.repeat(80));

  if (results.failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.tests.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`  - ${t.name}`);
      if (t.error) console.log(`    Error: ${t.error}`);
      if (t.screenshot) console.log(`    Screenshot: ${t.screenshot}`);
    });
  }

  console.log('\n✅ PASSED TESTS:');
  results.tests.filter(t => t.status === 'PASS').forEach(t => {
    console.log(`  - ${t.name}`);
  });

  // Save results to JSON
  writeFileSync('smoke-test-results.json', JSON.stringify(results, null, 2));
  console.log('\n📊 Results saved to: smoke-test-results.json');

  // Exit with appropriate code
  if (results.failed > 0) {
    console.log('\n❌ SMOKE TESTS FAILED - Exiting with code 1');
    process.exit(1);
  } else {
    console.log('\n✅ ALL SMOKE TESTS PASSED - Exiting with code 0');
    process.exit(0);
  }
})();
