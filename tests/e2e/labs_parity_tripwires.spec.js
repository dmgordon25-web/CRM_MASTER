const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const FIXED_TODAY = { year: 2025, month: 8, day: 28, hour: 12 };

function loadSeedData() {
    const seedPath = path.join(__dirname, '..', '..', 'crm-app', 'seed_data_inline.js');
    const raw = fs.readFileSync(seedPath, 'utf8');
    const match = raw.match(/window.__SEED_DATA__=(.*);/s);
    if (!match) {
        throw new Error('seed_data_inline.js did not contain __SEED_DATA__');
    }
    return JSON.parse(match[1]);
}

const seedData = loadSeedData();

const DAY_MS = 86400000;

function normalizeStageKey(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '-');
}

function normalizeDate(value) {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (value === undefined || value === null) return null;
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
        const dateFromNumber = new Date(asNumber);
        return Number.isNaN(dateFromNumber.getTime()) ? null : dateFromNumber;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(value) {
    const date = normalizeDate(value ?? Date.now());
    if (!date) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function taskDueStart(task) {
    if (!task) return null;
    const dueCandidate = task.due ?? task.dueDate;
    const dueTs = Number(task.dueTs);
    const dueDate = Number.isFinite(dueTs) ? new Date(dueTs) : normalizeDate(dueCandidate);
    if (!dueDate) return null;
    return new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
}

function normalizeStatus(task) {
    const raw = task && (task.status || task.state || task.raw?.status);
    return raw ? String(raw).trim().toLowerCase() : '';
}

function isCountableTask(task) {
    if (!task || task.deleted) return false;
    if (task.completed || task.done === true) return false;
    const status = normalizeStatus(task);
    if (status === 'done' || status === 'completed' || status === 'archived') return false;
    if (status === 'cancelled' || status === 'canceled') return false;
    return true;
}

function countTodayTasks(tasks, todayDate) {
    const todayStart = startOfDay(todayDate);
    if (!todayStart) return 0;
    const todayTs = todayStart.getTime();
    return (Array.isArray(tasks) ? tasks : []).filter(isCountableTask).filter((task) => {
        const dueStart = taskDueStart(task);
        if (!dueStart) return false;
        const diff = Math.floor((dueStart.getTime() - todayTs) / DAY_MS);
        return diff === 0;
    }).length;
}

function computeExpectedTripwires() {
    const activeContacts = seedData.contacts.filter((contact) => {
        const stage = normalizeStageKey(contact.stage);
        return stage && !['lost', 'funded', 'post-close', 'past-client', 'returning'].includes(stage);
    });

    const pipelineStageKeys = new Set([
        'long-shot',
        'application',
        'preapproved',
        'processing',
        'underwriting',
        'approved',
        'cleared-to-close',
        'funded'
    ]);
    const pipelineTotal = seedData.contacts.filter((contact) => {
        const stage = normalizeStageKey(contact.stage);
        return stage && pipelineStageKeys.has(stage) && stage !== 'funded';
    }).length;

    const todayDate = new Date(FIXED_TODAY.year, FIXED_TODAY.month, FIXED_TODAY.day, FIXED_TODAY.hour, 0, 0);
    const todayCount = countTodayTasks(seedData.tasks, todayDate);

    return {
        activeCount: activeContacts.length,
        pipelineTotal,
        todayCount
    };
}

test.describe('Labs Parity Tripwires', () => {
    let expected;

    test.beforeAll(() => {
        expected = computeExpectedTripwires();
    });

    test.beforeEach(async ({ page }) => {
        await page.addInitScript(({ year, month, day, hour }) => {
            const fixed = new Date(year, month, day, hour, 0, 0, 0);
            const fixedTime = fixed.getTime();
            const OriginalDate = Date;

            class MockDate extends OriginalDate {
                constructor(...args) {
                    if (args.length === 0) {
                        return new OriginalDate(fixedTime);
                    }
                    return new OriginalDate(...args);
                }
                static now() {
                    return fixedTime;
                }
            }

            MockDate.UTC = OriginalDate.UTC;
            MockDate.parse = OriginalDate.parse;
            MockDate.prototype = OriginalDate.prototype;
            window.Date = MockDate;
        }, FIXED_TODAY);

        await page.goto('/index.html?e2e=1');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForFunction(() => {
            return Boolean((window.db && (window.db.bulkPut || window.db.put))
                || window.dbBulkPut
                || window.dbPut);
        });
        await page.evaluate(async (seed) => {
            const clearStore = async (store) => {
                if (typeof window.dbClear === 'function') {
                    try { await window.dbClear(store); return; } catch (_) { }
                }
                if (window.db && typeof window.db.clear === 'function') {
                    try { await window.db.clear(store); return; } catch (_) { }
                }
            };
            const putMany = async (store, records) => {
                if (window.db && typeof window.db.bulkPut === 'function') {
                    return window.db.bulkPut(store, records);
                }
                if (typeof window.dbBulkPut === 'function') {
                    return window.dbBulkPut(store, records);
                }
                if (window.db && typeof window.db.put === 'function') {
                    for (const rec of records) {
                        // eslint-disable-next-line no-await-in-loop
                        await window.db.put(store, rec);
                    }
                }
                if (typeof window.dbPut === 'function') {
                    for (const rec of records) {
                        // eslint-disable-next-line no-await-in-loop
                        await window.dbPut(store, rec);
                    }
                }
                return null;
            };

            const seedContacts = Array.isArray(seed.contacts) ? seed.contacts.map((contact) => {
                const first = contact.first || contact.firstName || '';
                const last = contact.last || contact.lastName || '';
                const displayName = contact.displayName
                    || contact.fullName
                    || contact.borrowerName
                    || contact.name
                    || [first, last].filter(Boolean).join(' ').trim();
                return {
                    ...contact,
                    name: displayName || contact.name,
                    displayName: displayName || contact.displayName
                };
            }) : [];

            await clearStore('contacts');
            await clearStore('tasks');
            await putMany('contacts', seedContacts);
            await putMany('tasks', Array.isArray(seed.tasks) ? seed.tasks : []);

            if (typeof window.dispatchAppDataChanged === 'function') {
                window.dispatchAppDataChanged('e2e:seed');
            }
            if (window.app && typeof window.app.refresh === 'function') {
                window.app.refresh();
            }
        }, seedData);

        await page.goto('/#/labs');
        await page.waitForSelector('.labs-crm-dashboard', { state: 'visible', timeout: 10000 });
    });

    test('Tripwire counts stay aligned with seed data', async ({ page }) => {
        await page.waitForSelector('.labs-widget[data-widget-id="labsKpiSummary"]', { state: 'visible' });
        const kpiWidget = page.locator('.labs-widget[data-widget-id="labsKpiSummary"]');
        const activeChip = kpiWidget.locator('.labs-kpi-meta .labs-chip', { hasText: 'Active:' });
        await expect(activeChip).toHaveText(`Active: ${expected.activeCount}`);

        await page.waitForSelector('.labs-widget[data-widget-id="labsPipelineSnapshot"]', { state: 'visible' });
        const pipelineWidget = page.locator('.labs-widget[data-widget-id="labsPipelineSnapshot"]');
        const pipelineCount = pipelineWidget.locator('.labs-widget-chrome__count');
        await expect(pipelineCount).toHaveText(String(expected.pipelineTotal));

        await page.waitForSelector('.labs-widget[data-widget-id="labsTasks"]', { state: 'visible' });
        const tasksWidget = page.locator('.labs-widget[data-widget-id="labsTasks"]');
        const todayPill = tasksWidget.locator('.labs-task-summary .labs-pill', { hasText: 'Today' });
        await expect(todayPill).toHaveText(`Today ${expected.todayCount}`);
    });
});
