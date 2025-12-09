
import { chromium } from '@playwright/test';
import { writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'http://localhost:8080';
const VIEWPORT = { width: 1280, height: 800 };

async function runStabilityTests() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();

    const results = { passed: [], failed: [] };

    try {
        console.log('Starting Stability Tests...');

        // --- TEST 1: Dashboard Click Stability ---
        console.log('Test 1: Dashboard Click Stability (Milestones/Celebrations)...');
        await page.goto(BASE_URL);
        await page.waitForSelector('#view-dashboard', { state: 'visible' });

        // Inject mock data if needed or ensure data exists? 
        // We assume data exists from DEMO_MODE/mock seeds.

        // Check for Milestones or Celebrations card
        const milestoneCard = await page.$('#milestones-card, #dashboard-celebrations');
        if (milestoneCard) {
            const link = await milestoneCard.$('[data-contact-id]');
            if (link) {
                console.log('  Found contact link in milestone card. Clicking...');

                // Setup a timeout promise to detect freeze
                const clickPromise = link.click();
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout - App likely frozen')), 5000));

                await Promise.race([clickPromise, timeoutPromise]);
                console.log('  Click successful (no immediate freeze/timeout).');

                // Wait a bit to ensure no async freeze
                await page.waitForTimeout(1000);
                results.passed.push('Dashboard Click Stability');
            } else {
                console.log('  No specific contact links found to test. Skipping specific click.');
                results.passed.push('Dashboard Click Stability (Skipped - No Data)');
            }
        } else {
            console.log('  Milestone/Celebration card not found.');
            results.passed.push('Dashboard Click Stability (Skipped - Card Not Found)');
        }

        // --- TEST 2: Pipeline Reorder Stability ---
        console.log('Test 2: Pipeline Selection Reorder Stability...');
        await page.click('button[data-nav="pipeline"]'); // Assuming pipeline tab exists/works
        // Wait for table
        try {
            await page.waitForSelector('#tbl-pipeline tbody tr', { timeout: 5000 });

            // Capture initial order of IDs
            const initialIds = await page.$$eval('#tbl-pipeline tbody tr', rows => rows.map(r => r.getAttribute('data-id')));
            console.log(`  Initial rows: ${initialIds.length}`);

            if (initialIds.length > 0) {
                // Select first row
                await page.click('#tbl-pipeline tbody tr:first-child input[data-ui="row-check"]');
                await page.waitForTimeout(500);

                // Capture new order
                const newIds = await page.$$eval('#tbl-pipeline tbody tr', rows => rows.map(r => r.getAttribute('data-id')));

                // Compare
                const isIdentical = JSON.stringify(initialIds) === JSON.stringify(newIds);
                if (isIdentical) {
                    console.log('  Order preserved after selection.');
                    results.passed.push('Pipeline Reorder Stability');
                } else {
                    console.error('  Order CHANGED after selection!');
                    console.error('  Initial:', initialIds);
                    console.error('  New:', newIds);
                    results.failed.push('Pipeline Reorder Stability');
                }
            } else {
                console.log('  No pipeline rows to test.');
                results.passed.push('Pipeline Reorder Stability (Skipped - No Data)');
            }
        } catch (e) {
            // Pipeline might not be enabled or empty
            console.log('  Pipeline table verify failed/timed out: ' + e.message);
            // Determine if this is a fail or skip
            results.failed.push('Pipeline Reorder Stability (Error: ' + e.message + ')');
        }

        // --- TEST 3: Labs Isolation ---
        console.log('Test 3: Labs Isolation in Legacy Dashboard...');
        await page.goto(BASE_URL); // Reload to legacy dashboard
        await page.waitForSelector('#view-dashboard');

        // Check if any Labs specific classes are present on body or dashboard that shouldn't be
        const leakedClasses = await page.evaluate(() => {
            const root = document.getElementById('view-dashboard');
            return {
                isEditable: root.classList.contains('labs-grid-editable'),
                hasDragPlaceholder: document.querySelector('.dash-drag-placeholder') !== null
            };
        });

        if (!leakedClasses.isEditable && !leakedClasses.hasDragPlaceholder) {
            console.log('  No Labs leakage detected.');
            results.passed.push('Labs Isolation');
        } else {
            console.error('  Labs Leakage Detected:', leakedClasses);
            results.failed.push('Labs Isolation');
        }

    } catch (err) {
        console.error('Test Suite Error:', err);
        results.failed.push('Test Suite Error: ' + err.message);
    } finally {
        await browser.close();
        console.log('\nResults:', results);
        if (results.failed.length > 0) process.exit(1);
    }
}

runStabilityTests();
