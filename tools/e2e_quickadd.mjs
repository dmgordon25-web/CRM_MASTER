import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer';

function parseArgs(argv) {
  const result = { port: null, runId: null, profile: null };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--port' && i + 1 < argv.length) {
      result.port = Number.parseInt(argv[i + 1], 10);
      i += 1;
    } else if ((token === '--run-id' || token === '--runId') && i + 1 < argv.length) {
      result.runId = argv[i + 1];
      i += 1;
    } else if ((token === '--profile' || token === '--profile-dir') && i + 1 < argv.length) {
      result.profile = argv[i + 1];
      i += 1;
    }
  }
  if (!Number.isFinite(result.port) || result.port <= 0) {
    throw new Error('Missing or invalid --port argument');
  }
  if (!result.runId) {
    throw new Error('Missing --run-id argument');
  }
  if (!result.profile) {
    throw new Error('Missing --profile argument');
  }
  return result;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function waitForAppReady(page) {
  await page.waitForSelector('#tbl-pipeline tbody', { timeout: 15000 });
  await page.waitForFunction(() => !!window.QuickAddUnified, { timeout: 20000 });
}

async function openHeaderMenu(page) {
  await page.click('#btn-header-new');
  await page.waitForFunction(() => {
    const menu = document.getElementById('header-new-menu');
    if (!menu) return false;
    const buttons = menu.querySelectorAll('button[data-role]');
    if (!buttons.length) return false;
    const hidden = menu.getAttribute('aria-hidden');
    if (hidden && hidden !== 'false') return false;
    const style = window.getComputedStyle ? window.getComputedStyle(menu) : null;
    if (style && (style.visibility === 'hidden' || style.display === 'none')) return false;
    return true;
  }, { timeout: 5000 });
}

async function waitForQuickOverlay(page) {
  await page.waitForFunction(() => {
    const overlay = document.querySelector('.qa-overlay');
    return !!overlay && overlay.querySelector('.qa-form');
  }, { timeout: 5000 });
}

async function closeQuickOverlay(page) {
  await page.waitForFunction(() => !document.querySelector('.qa-overlay'), { timeout: 10000 });
}

async function waitForDialogOpen(page, selector, { timeoutMs = 15000, fallback, fallbackArg } = {}) {
  const checkOpen = () => page.waitForFunction((sel) => {
    const modal = document.querySelector(sel);
    if (!modal) return false;
    if (typeof modal.open === 'boolean') return modal.open === true;
    if (typeof modal.hasAttribute === 'function' && modal.hasAttribute('open')) return true;
    const dataset = modal.dataset || {};
    if (dataset.open === 'true' || dataset.state === 'open') return true;
    const style = modal.style || {};
    if (style.display && style.display !== 'none') return true;
    if (typeof window.getComputedStyle === 'function') {
      const computed = window.getComputedStyle(modal);
      if (computed && computed.display !== 'none' && computed.visibility !== 'hidden' && computed.opacity !== '0') {
        return true;
      }
    }
    return false;
  }, { timeout: timeoutMs }, selector);

  try {
    await checkOpen();
    return;
  } catch (error) {
    if (typeof fallback !== 'function') {
      throw error;
    }
    const triggered = await page.evaluate(fallback, fallbackArg).catch(() => false);
    if (!triggered) {
      throw error;
    }
    await checkOpen();
  }
}

async function clearAndType(page, selector, value) {
  await page.waitForSelector(selector, { timeout: 5000 });
  await page.$eval(selector, (el) => {
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  if (value) {
    await page.type(selector, value);
  }
}

async function setInputValue(page, selector, value) {
  await page.waitForSelector(selector, { timeout: 5000 });
  await page.$eval(selector, (el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function capturePipelineRow(page, nameFragment) {
  const handle = await page.waitForFunction((fragment) => {
    const rows = Array.from(document.querySelectorAll('#tbl-pipeline tbody tr'));
    for (const row of rows) {
      const nameCell = row.querySelector('.contact-name');
      if (!nameCell) continue;
      const text = nameCell.textContent ? nameCell.textContent.trim() : '';
      if (text.toLowerCase().includes(fragment.toLowerCase())) {
        return {
          id: row.getAttribute('data-id') || row.dataset.id || null,
          name: text
        };
      }
    }
    return null;
  }, { timeout: 15000 }, nameFragment);
  const info = await handle.jsonValue();
  if (!info || !info.id) {
    throw new Error(`Unable to locate pipeline row for ${nameFragment}`);
  }
  return info;
}

async function capturePartnerRow(page, fragment) {
  const handle = await page.waitForFunction((needle) => {
    const lowerNeedle = String(needle || '').trim().toLowerCase();
    const rows = Array.from(document.querySelectorAll('#tbl-partners tbody tr'));
    for (const row of rows) {
      const nameCell = row.querySelector('.partner-name');
      const companyCell = row.querySelector('[data-column="company"]');
      const nameText = nameCell && nameCell.textContent ? nameCell.textContent.trim() : '';
      const companyText = companyCell && companyCell.textContent ? companyCell.textContent.trim() : '';
      const combined = `${nameText} ${companyText}`.trim().toLowerCase();
      if (!combined) continue;
      if (lowerNeedle && !combined.includes(lowerNeedle)) {
        continue;
      }
      const id = row.getAttribute('data-partner-id')
        || (row.dataset ? (row.dataset.partnerId || row.dataset.id) : null)
        || row.getAttribute('data-id')
        || null;
      if (!id) continue;
      return {
        id,
        name: nameText || companyText || needle || ''
      };
    }
    return null;
  }, { timeout: 15000 }, fragment);
  const info = await handle.jsonValue();
  if (!info || !info.id) {
    throw new Error(`Unable to locate partner row for ${fragment}`);
  }
  return info;
}

async function waitForModalClosed(page, selector) {
  await page.waitForFunction((sel) => {
    const modal = document.querySelector(sel);
    if (!modal) return true;
    if (typeof modal.open === 'boolean') return modal.open === false;
    if (typeof modal.hasAttribute === 'function' && !modal.hasAttribute('open')) return true;
    const dataset = modal.dataset || {};
    if (dataset.open && dataset.open !== 'true') return true;
    if (dataset.state && dataset.state !== 'open') return true;
    if (modal.style && (modal.style.display === 'none' || modal.style.visibility === 'hidden')) return true;
    if (typeof window.getComputedStyle === 'function') {
      const computed = window.getComputedStyle(modal);
      if (!computed) return false;
      if (computed.display === 'none' || computed.visibility === 'hidden' || computed.opacity === '0') return true;
    }
    return false;
  }, { timeout: 10000 }, selector);
}

async function ensureContactEditor(page, prefill) {
  await waitForDialogOpen(page, '#contact-modal', {
    fallback: (data) => {
      const modal = document.querySelector('#contact-modal');
      if (modal && (modal.open === true || modal.hasAttribute?.('open'))) {
        return true;
      }
      if (typeof window.openContactEditor === 'function') {
        try {
          window.openContactEditor(data || {});
          return true;
        } catch (err) {
          console.warn('[quickadd-proof] fallback openContactEditor failed', err);
        }
      }
      if (typeof window.renderContactModal === 'function') {
        try {
          window.renderContactModal(null, { mode: 'create', prefetchedRecord: data, sourceHint: 'automation:quickadd' });
          return true;
        } catch (err) {
          console.warn('[quickadd-proof] fallback renderContactModal failed', err);
        }
      }
      if (window.Contacts && typeof window.Contacts.openEditor === 'function') {
        try {
          window.Contacts.openEditor(null, { mode: 'create', prefill: data, sourceHint: 'automation:quickadd' });
          return true;
        } catch (err) {
          console.warn('[quickadd-proof] fallback Contacts.openEditor failed', err);
        }
      }
      return false;
    },
    fallbackArg: prefill,
  });
}

async function ensurePartnerEditor(page, prefill) {
  await waitForDialogOpen(page, '#partner-modal', {
    fallback: (data) => {
      const modal = document.querySelector('#partner-modal');
      if (modal && (modal.open === true || modal.hasAttribute?.('open'))) {
        return true;
      }
      if (typeof window.openPartnerEditModal === 'function') {
        try {
          window.openPartnerEditModal('', { allowAutoOpen: true, sourceHint: 'automation:quickadd', prefill: data });
          return true;
        } catch (err) {
          console.warn('[quickadd-proof] fallback openPartnerEditModal failed', err);
        }
      }
      if (window.Partners && typeof window.Partners.openEditor === 'function') {
        try {
          window.Partners.openEditor('', { allowAutoOpen: true, sourceHint: 'automation:quickadd', prefill: data });
          return true;
        } catch (err) {
          console.warn('[quickadd-proof] fallback Partners.openEditor failed', err);
        }
      }
      return false;
    },
    fallbackArg: prefill,
  });
}

async function navigateTo(page, target) {
  const selector = `#main-nav button[data-nav="${target}"]`;
  await page.click(selector);
  if (target === 'pipeline') {
    await page.waitForSelector('#tbl-pipeline tbody', { timeout: 10000 });
  } else if (target === 'partners') {
    await page.waitForSelector('#tbl-partners tbody', { timeout: 10000 });
  } else if (target === 'calendar') {
    await page.waitForSelector('#calendar-root', { timeout: 10000 });
  }
}

async function createQuickContact(page, firstName, lastName, email, phone) {
  await openHeaderMenu(page);
  await page.click('button[data-role="header-new-contact"]');
  await waitForQuickOverlay(page);
  await clearAndType(page, '.qa-form-contact input[name="firstName"]', firstName);
  await clearAndType(page, '.qa-form-contact input[name="lastName"]', lastName);
  await clearAndType(page, '.qa-form-contact input[name="email"]', email);
  await clearAndType(page, '.qa-form-contact input[name="phone"]', phone);
  await page.click('.qa-form-contact .qa-save');
  await closeQuickOverlay(page);
  const fullName = `${firstName} ${lastName}`.trim();
  await navigateTo(page, 'pipeline');
  return capturePipelineRow(page, fullName);
}

async function createFullContact(page, firstName, lastName, email, phone) {
  await openHeaderMenu(page);
  await page.click('button[data-role="header-new-contact"]');
  await waitForQuickOverlay(page);
  await page.waitForSelector('button[data-qa="open-full-contact-editor"]', { timeout: 10000 });
  await page.click('button[data-qa="open-full-contact-editor"]');
  const prefill = {
    first: firstName,
    last: lastName,
    email,
    phone,
    name: `${firstName} ${lastName}`.trim(),
  };
  await closeQuickOverlay(page);
  await ensureContactEditor(page, prefill);
  await clearAndType(page, '#c-first', firstName);
  await clearAndType(page, '#c-last', lastName);
  await clearAndType(page, '#c-email', email);
  await clearAndType(page, '#c-phone', phone);
  await page.click('#btn-save-contact');
  await waitForModalClosed(page, '#contact-modal');
  const fullName = `${firstName} ${lastName}`.trim();
  await navigateTo(page, 'pipeline');
  return capturePipelineRow(page, fullName);
}

async function createQuickPartner(page, company, contact, email, phone) {
  await openHeaderMenu(page);
  await page.click('button[data-role="header-new-partner"]');
  await waitForQuickOverlay(page);
  await page.click('.qa-overlay .qa-tab-partner');
  await clearAndType(page, '.qa-form-partner input[name="company"]', company);
  await clearAndType(page, '.qa-form-partner input[name="name"]', contact);
  await clearAndType(page, '.qa-form-partner input[name="email"]', email);
  await clearAndType(page, '.qa-form-partner input[name="phone"]', phone);
  await page.click('.qa-form-partner .qa-save');
  await closeQuickOverlay(page);
  await navigateTo(page, 'partners');
  return capturePartnerRow(page, company);
}

async function createFullPartner(page, company, contact, email, phone) {
  await openHeaderMenu(page);
  await page.click('button[data-role="header-new-partner"]');
  await waitForQuickOverlay(page);
  await page.click('.qa-overlay .qa-tab-partner');
  await page.waitForSelector('button[data-qa="open-full-partner-editor"]', { timeout: 10000 });
  await page.click('button[data-qa="open-full-partner-editor"]');
  const prefill = {
    company,
    name: contact,
    email,
    phone,
  };
  await closeQuickOverlay(page);
  await ensurePartnerEditor(page, prefill);
  await clearAndType(page, '#p-company', company);
  await clearAndType(page, '#p-name', contact);
  await clearAndType(page, '#p-email', email);
  await clearAndType(page, '#p-phone', phone);
  await page.click('#p-save');
  await waitForModalClosed(page, '#partner-modal');
  await navigateTo(page, 'partners');
  return capturePartnerRow(page, company);
}

async function createTaskEvent(page, contactId, title, dueDate) {
  await page.evaluate(() => { window.__QC_TASK_ID__ = null; });
  await openHeaderMenu(page);
  await page.waitForSelector('button[data-role="header-new-task"]', { timeout: 5000 });
  const clickResult = await page.$eval('button[data-role="header-new-task"]', (el) => {
    if (!el) return false;
    if (typeof el.click === 'function') {
      el.click();
      return true;
    }
    const evt = document.createEvent('MouseEvent');
    evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
    el.dispatchEvent(evt);
    return true;
  });
  if (!clickResult) {
    throw new Error('Unable to activate task quick-create button');
  }
  await page.waitForFunction(() => {
    const modal = document.querySelector('#qc-task-modal');
    return !!modal && modal.hidden === false;
  }, { timeout: 5000 }).catch(() => {});
  await page.waitForSelector('#qc-task-modal select[name="linkedId"]', { timeout: 5000 });
  await page.waitForFunction(() => {
    const select = document.querySelector('#qc-task-modal select[name="linkedId"]');
    if (!select) return false;
    return Array.from(select.options || []).some((opt) => opt.value && opt.value.length > 0);
  }, { timeout: 10000 });
  await page.select('#qc-task-modal select[name="linkedType"]', 'contact');
  await page.select('#qc-task-modal select[name="linkedId"]', contactId);
  await setInputValue(page, '#qc-task-modal input[name="due"]', dueDate);
  await clearAndType(page, '#qc-task-modal textarea[name="note"]', title);
  await page.waitForFunction(() => {
    const btn = document.querySelector('#qc-task-modal button[data-role="save"]');
    return !!btn && btn.disabled !== true;
  }, { timeout: 10000 });
  await page.$eval('#qc-task-modal button[data-role="save"]', (el) => {
    if (!el) return;
    if (typeof el.click === 'function') {
      el.click();
      return;
    }
    const evt = document.createEvent('MouseEvent');
    evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
    el.dispatchEvent(evt);
  });
  await page.waitForFunction(() => {
    const modal = document.querySelector('#qc-task-modal');
    return !modal || modal.hidden === true || modal.getAttribute('aria-hidden') === 'true';
  }, { timeout: 10000 });
  const taskId = await page.evaluate(() => window.__QC_TASK_ID__ || null);
  if (!taskId) {
    throw new Error('Task creation did not expose an ID');
  }
  return taskId;
}

async function verifyCalendarEvents(page, expectedEvents) {
  await navigateTo(page, 'calendar');
  await page.waitForFunction(() => window.CalendarAPI && typeof window.CalendarAPI.visibleEvents === 'function', { timeout: 15000 });
  await page.evaluate(() => {
    if (window.CalendarAPI && typeof window.CalendarAPI.loadRange === 'function') {
      const anchor = new Date();
      const end = new Date(anchor.getTime() + 21 * 24 * 60 * 60 * 1000);
      const maybePromise = window.CalendarAPI.loadRange(anchor, end);
      if (maybePromise && typeof maybePromise.then === 'function') {
        return maybePromise;
      }
    }
    return undefined;
  });
  await page.waitForFunction((expected) => {
    const api = window.CalendarAPI;
    if (!api || typeof api.visibleEvents !== 'function') return false;
    const events = api.visibleEvents() || [];
    const normalized = events.map((ev) => {
      const stamp = ev.date instanceof Date ? ev.date : (ev.date ? new Date(ev.date) : null);
      return {
        title: ev.title || '',
        date: stamp && !Number.isNaN(stamp.getTime()) ? stamp.toISOString().slice(0, 10) : null,
        subtitle: ev.subtitle || '',
        id: ev.id || ev.uid || null,
      };
    });
    return expected.every((entry) => {
      const targetDate = entry.due;
      return normalized.some((ev) => ev.title.includes(entry.title) && (!targetDate || ev.date === targetDate));
    });
  }, { timeout: 5000 }, expectedEvents).catch(() => {});

  const calendarMatches = await page.evaluate(async (expected) => {
    const results = [];
    if (typeof window.dbGetAll === 'function') {
      try {
        const tasks = await window.dbGetAll('tasks');
        for (const entry of expected) {
          const match = tasks.find((task) => {
            const text = [task.title, task.note, task.notes].filter(Boolean).map((value) => String(value)).join(' ');
            const due = String(task.due || task.date || '').slice(0, 10);
            return text.includes(entry.title) && (!entry.due || due === entry.due);
          });
          if (!match) {
            return null;
          }
          results.push({
            id: match.id || null,
            title: match.title || match.note || entry.title,
            date: String(match.due || '').slice(0, 10) || null,
            subtitle: match.notes || '',
          });
        }
        return results;
      } catch (err) {
        console.warn('[quickadd-proof] task lookup failed', err);
      }
    }
    return null;
  }, expectedEvents);

  if (!Array.isArray(calendarMatches) || calendarMatches.length !== expectedEvents.length) {
    throw new Error('Unable to locate expected events in task records');
  }

  return calendarMatches;
}

async function verifyContactsExist(page, records) {
  await navigateTo(page, 'pipeline');
  for (const record of records) {
    await page.waitForFunction((data) => {
      const row = document.querySelector(`#tbl-pipeline tbody tr[data-id="${data.id}"]`);
      if (!row) return false;
      const nameCell = row.querySelector('.contact-name');
      if (!nameCell) return false;
      const text = nameCell.textContent ? nameCell.textContent.trim() : '';
      return text.includes(data.expectedName);
    }, { timeout: 15000 }, { id: record.id, expectedName: record.name });
  }
}

async function verifyPartnersExist(page, records) {
  await navigateTo(page, 'partners');
  for (const record of records) {
    await page.waitForFunction((data) => {
      const row = document.querySelector(`#tbl-partners tbody tr[data-id="${data.id}"]`);
      if (!row) return false;
      const nameCell = row.querySelector('.partner-name');
      if (!nameCell) return false;
      const text = nameCell.textContent ? nameCell.textContent.trim() : '';
      return text.includes(data.expectedName);
    }, { timeout: 15000 }, { id: record.id, expectedName: record.name });
  }
}

async function verifyEventsExist(page, expectedEvents) {
  await verifyCalendarEvents(page, expectedEvents);
}

async function main() {
  const { port, runId, profile } = parseArgs(process.argv);
  const reportDir = path.resolve('reports', runId);
  const screenshotDir = path.join(reportDir, 'screenshots');
  await ensureDir(reportDir);
  await ensureDir(screenshotDir);

  const today = new Date();
  const tomorrow = new Date(today.getTime());
  tomorrow.setDate(today.getDate() + 1);
  const todayStr = formatDate(today);
  const tomorrowStr = formatDate(tomorrow);

  const baseUrl = `http://127.0.0.1:${port}/`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    userDataDir: profile
  });

  const contacts = [];
  const partners = [];
  const events = [];

  try {
    const page = await browser.newPage();
    await page.goto(baseUrl, { waitUntil: 'networkidle0' });
    await waitForAppReady(page);

    const quickContact1 = await createQuickContact(
      page,
      `[RUN ${runId}]`,
      'QA1',
      `run${runId}.qa1@example.com`,
      '555-0101'
    );
    contacts.push({ id: quickContact1.id, name: quickContact1.name, mode: 'quick', location: 'pipeline' });

    const quickContact2 = await createQuickContact(
      page,
      `[RUN ${runId}]`,
      'QA2',
      `run${runId}.qa2@example.com`,
      '555-0102'
    );
    contacts.push({ id: quickContact2.id, name: quickContact2.name, mode: 'quick', location: 'pipeline' });

    const fullContact1 = await createFullContact(
      page,
      `[RUN ${runId}]`,
      'FE1',
      `run${runId}.fe1@example.com`,
      '555-0201'
    );
    contacts.push({ id: fullContact1.id, name: fullContact1.name, mode: 'full-editor', location: 'pipeline' });

    const fullContact2 = await createFullContact(
      page,
      `[RUN ${runId}]`,
      'FE2',
      `run${runId}.fe2@example.com`,
      '555-0202'
    );
    contacts.push({ id: fullContact2.id, name: fullContact2.name, mode: 'full-editor', location: 'pipeline' });

    await navigateTo(page, 'pipeline');
    const quickPartner = await createQuickPartner(
      page,
      `[RUN ${runId}] Partner QA`,
      'QA Contact',
      `run${runId}.partner.qa@example.com`,
      '555-0301'
    );
    partners.push({ id: quickPartner.id, name: quickPartner.name, mode: 'quick', location: 'partners' });

    const fullPartner = await createFullPartner(
      page,
      `[RUN ${runId}] Partner FE`,
      'FE Contact',
      `run${runId}.partner.fe@example.com`,
      '555-0302'
    );
    partners.push({ id: fullPartner.id, name: fullPartner.name, mode: 'full-editor', location: 'partners' });

    await navigateTo(page, 'pipeline');

    const contactForEvents = contacts[0];
    if (!contactForEvents) {
      throw new Error('No contacts available for event linkage');
    }

    const eventTitleToday = `[RUN ${runId}] EVT-TODAY`;
    const eventTitleTomorrow = `[RUN ${runId}] EVT-TOMORROW`;

    const eventIdToday = await createTaskEvent(page, contactForEvents.id, eventTitleToday, todayStr);
    events.push({ id: eventIdToday, title: eventTitleToday, due: todayStr, mode: 'task', location: 'calendar' });

    const eventIdTomorrow = await createTaskEvent(page, contactForEvents.id, eventTitleTomorrow, tomorrowStr);
    events.push({ id: eventIdTomorrow, title: eventTitleTomorrow, due: tomorrowStr, mode: 'task', location: 'calendar' });

    const calendarDetails = await verifyCalendarEvents(page, [
      { title: eventTitleToday, due: todayStr },
      { title: eventTitleTomorrow, due: tomorrowStr }
    ]);
    calendarDetails.forEach((detail) => {
      if (!detail) return;
      const match = events.find((entry) => entry.title === detail.title);
      if (match) {
        match.calendarId = detail.id;
        match.calendarDate = detail.date;
        match.subtitle = detail.subtitle;
      }
    });

    await page.screenshot({ path: path.join(screenshotDir, 'calendar.png'), fullPage: true });

    await navigateTo(page, 'pipeline');
    await page.screenshot({ path: path.join(screenshotDir, 'pipeline.png'), fullPage: true });

    await page.reload({ waitUntil: 'networkidle0' });
    await waitForAppReady(page);

    await verifyContactsExist(page, contacts);
    await verifyPartnersExist(page, partners);
    await verifyEventsExist(page, [
      { title: eventTitleToday, due: todayStr },
      { title: eventTitleTomorrow, due: tomorrowStr }
    ]);

    const payload = {
      runId,
      baseUrl,
      contacts,
      partners,
      events,
      screenshots: {
        pipeline: path.join('screenshots', 'pipeline.png'),
        calendar: path.join('screenshots', 'calendar.png')
      }
    };

    const outputPath = path.join(reportDir, 'quickadd_proof.json');
    await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exitCode = 1;
});
