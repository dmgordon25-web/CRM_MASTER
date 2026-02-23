import { normalizeStatus } from './pipeline/constants.js';

const SEED_PREFIX = 'seed_fw_';

function getId(type, index) {
    return `${SEED_PREFIX}${type}_${index}`;
}

function getDateNearTodayInCurrentMonth(dayOffset) {
    const d = new Date();
    const maxDays = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const nextDay = Math.min(maxDays, Math.max(1, d.getDate() + dayOffset));
    d.setDate(nextDay);
    return d.toISOString().split('T')[0];
}

async function upsert(store, key, row) {
    if (!window.db) return;
    try {
        const existing = await window.db.get(store, key).catch(() => null);
        const rec = existing ? { ...existing, ...row, id: key } : { ...row, id: key };
        if (!rec.updatedAt) rec.updatedAt = new Date().toISOString();
        await window.db.put(store, rec);
    } catch (err) {
        console.error(`[Seed] Failed to upsert ${store}/${key}`, err);
    }
}

const PROFILE_PRESETS = Object.freeze({
    'demo-week': {
        contacts: 12,
        tasks: 20,
        events: 24,
        deals: 3,
        eventSpreadDays: 6,
        description: 'Calendar-heavy demo with full funnel + docs scenarios'
    },
    'production-ish': {
        contacts: 7,
        tasks: 8,
        events: 10,
        deals: 2,
        eventSpreadDays: 12,
        description: 'Lighter realistic dataset with key workflows represented'
    }
});

const CONTACT_BLUEPRINTS = Object.freeze([
    { first: 'Aaron', last: 'Anderson', stage: 'lead', status: 'nurture', loanType: 'Conventional', amount: 350000, note: 'New online lead' },
    { first: 'Beth', last: 'Baker', stage: 'application', status: 'inprogress', loanType: 'FHA', amount: 280000, note: 'Application in progress' },
    { first: 'Carl', last: 'Clark', stage: 'processing', status: 'active', loanType: 'VA', amount: 420000, note: 'Processing docs' },
    { first: 'Diana', last: 'Davis', stage: 'underwriting', status: 'active', loanType: 'Conventional', amount: 310000, note: 'Conditions in underwriting' },
    { first: 'Evan', last: 'Edwards', stage: 'cleared-to-close', status: 'active', loanType: 'Jumbo', amount: 750000, note: 'CTC timeline locked' },
    { first: 'Fiona', last: 'Foster', stage: 'funded', status: 'client', loanType: 'Conventional', amount: 300000, note: 'Recently funded' },
    { first: 'George', last: 'Green', stage: 'approved', status: 'active', loanType: 'FHA', amount: 250000, note: 'Approved, awaiting closing date' },
    { first: 'Hannah', last: 'Hill', stage: 'lead', status: 'nurture', loanType: 'USDA', amount: 200000, note: 'Nurture cadence contact' },
    { first: 'Ivan', last: 'Ingram', stage: 'application', status: 'paused', loanType: 'Conventional', amount: 400000, note: 'Application paused for updates' },
    { first: 'Julia', last: 'Jones', stage: 'processing', status: 'active', loanType: 'VA', amount: 450000, note: 'Referral partner contact' },
    { first: 'Kevin', last: 'King', stage: 'underwriting', status: 'active', loanType: 'Conventional', amount: 330000, note: 'Awaiting appraisal docs' },
    { first: 'Laura', last: 'Lee', stage: 'funded', status: 'client', loanType: 'Jumbo', amount: 800000, note: 'Past client check-in' }
]);

const EVENT_TYPES = Object.freeze(['meeting', 'call', 'email', 'sms', 'postal', 'followup', 'nurture', 'deadline', 'other', 'partner']);

async function seedPartners() {
    const partners = [
        { name: 'Apex Realty', type: 'Real Estate', tier: 'Preferred', email: 'team@apex.test' },
        { name: 'Beta Title', type: 'Title', tier: 'Core', email: 'closing@beta.test' },
        { name: 'Gamma Insurance', type: 'Insurance', tier: 'Strategic', email: 'policy@gamma.test' },
        { name: 'Delta Inspections', type: 'Inspection', tier: 'Developing', email: 'inspect@delta.test' },
        { name: 'Epsilon Wholesalers', type: 'Wholesale', tier: 'Inactive', email: 'deals@epsilon.test' },
        { name: 'Zeta Legal', type: 'Legal', tier: 'Keep in Touch', email: 'counsel@zeta.test' },
        { name: 'Eta Financial', type: 'Financial Planner', tier: 'Preferred', email: 'planning@eta.test' },
        { name: 'Theta Builders', type: 'Builder', tier: 'Core', email: 'sales@theta.test' }
    ];

    for (let i = 0; i < partners.length; i++) {
        const p = partners[i];
        await upsert('partners', getId('partner', i + 1), {
            name: p.name,
            company: p.name,
            email: p.email,
            phone: `555-000-${1000 + i}`,
            tier: p.tier,
            notes: `Seeded partner of type ${p.type}`,
            updatedAt: new Date().toISOString()
        });
    }
}

async function seedContacts(config) {
    const now = Date.now();
    for (let i = 0; i < config.contacts; i++) {
        const c = CONTACT_BLUEPRINTS[i % CONTACT_BLUEPRINTS.length];
        const id = getId('contact', i + 1);
        const buyerId = getId('partner', (i % 8) + 1);
        const listingId = getId('partner', ((i + 1) % 8) + 1);

        const contact = {
            firstName: c.first,
            lastName: c.last,
            email: `${c.first.toLowerCase()}@demo.test`,
            phone: `555-100-${1000 + i}`,
            stage: c.stage,
            status: normalizeStatus(c.status) || 'active',
            loanType: c.loanType,
            loanAmount: c.amount,
            buyerPartnerId: buyerId,
            listingPartnerId: listingId,
            notes: c.note,
            createdAt: now,
            updatedAt: now
        };

        if (i === 0) contact.birthday = getDateNearTodayInCurrentMonth(1);
        if (i === 1) contact.anniversary = getDateNearTodayInCurrentMonth(3);
        if (i === 2) {
            contact.missingDocs = 'Most recent pay stubs; Asset statements';
            contact.docChecklist = [
                { key: 'gov-id', label: 'Government-issued ID', checked: true, updatedAt: now },
                { key: 'pay-stubs', label: 'Recent pay stubs', checked: false, updatedAt: now },
                { key: 'bank-statements', label: 'Bank statements', checked: false, updatedAt: now }
            ];
        }
        if (i === 3) {
            contact.missingDocs = 'Tax returns';
            contact.docChecklist = [
                { key: 'gov-id', label: 'Government-issued ID', checked: true, updatedAt: now },
                { key: 'tax-returns', label: 'Tax returns (2 years)', checked: false, updatedAt: now }
            ];
        }

        await upsert('contacts', id, contact);
    }
}

async function seedTasks(config) {
    const taskDefs = [
        { type: 'call', title: 'Call Client' },
        { type: 'email', title: 'Send Email' },
        { type: 'nurture', title: 'Nurture Touch' },
        { type: 'followup', title: 'Follow Up' },
        { type: 'task', title: 'General Task' },
        { type: 'deadline', title: 'Doc Deadline' },
        { type: 'meeting', title: 'Review Meeting' }
    ];

    for (let i = 0; i < config.tasks; i++) {
        const def = taskDefs[i % taskDefs.length];
        const isContact = i % 2 === 0;
        const linkId = isContact ? getId('contact', (i % config.contacts) + 1) : getId('partner', (i % 8) + 1);
        const due = getDateNearTodayInCurrentMonth((i % config.eventSpreadDays) - 2);

        await upsert('tasks', getId('task', i + 1), {
            title: `${def.title} ${i + 1}${isContact ? '' : ' (Partner)'}`,
            due,
            status: 'open',
            priority: i % 3 === 0 ? 'high' : 'normal',
            associatedId: linkId,
            contactId: isContact ? linkId : undefined,
            partnerId: !isContact ? linkId : undefined,
            type: def.type,
            description: 'Auto-generated seed task',
            updatedAt: new Date().toISOString()
        });
    }
}

async function seedEvents(config) {
    for (let i = 0; i < config.events; i++) {
        const typeKey = EVENT_TYPES[i % EVENT_TYPES.length];
        const isContact = i % 2 !== 0;
        const linkId = isContact ? getId('contact', (i % config.contacts) + 1) : getId('partner', (i % 8) + 1);
        const dayOffset = (i % config.eventSpreadDays) - 3;
        const date = getDateNearTodayInCurrentMonth(dayOffset);

        await upsert('events', getId('event', i + 1), {
            title: `${typeKey === 'partner' ? 'Partner Touch' : typeKey.charAt(0).toUpperCase() + typeKey.slice(1)} Event ${i + 1}`,
            type: typeKey,
            category: typeKey,
            start: `${date}T10:00:00`,
            end: `${date}T10:45:00`,
            allDay: i % 7 === 0,
            associatedId: linkId,
            contactId: isContact ? linkId : undefined,
            partnerId: !isContact ? linkId : undefined,
            description: 'Auto-generated calendar event',
            updatedAt: new Date().toISOString()
        });
    }
}

async function seedDeals(config) {
    for (let i = 0; i < config.deals; i++) {
        const date = getDateNearTodayInCurrentMonth(i + 4);
        await upsert('deals', getId('deal', i + 1), {
            contactId: getId('contact', i + 3),
            status: i % 2 === 0 ? 'funded' : 'cleared-to-close',
            closingDate: date,
            date,
            amount: 450000 + (i * 50000),
            updatedAt: new Date().toISOString()
        });
    }
}

async function seedDocuments() {
    const docContacts = [getId('contact', 2), getId('contact', 3)];
    let docCount = 0;
    for (const cid of docContacts) {
        for (let j = 0; j < 2; j++) {
            await upsert('documents', getId('doc', docCount + 1), {
                contactId: cid,
                name: `Doc ${j + 1}`,
                status: j === 0 ? 'Requested' : 'Missing',
                updatedAt: new Date().toISOString()
            });
            docCount++;
        }
    }
}

export async function runSeedProfile(profile = 'demo-week') {
    const resolvedProfile = PROFILE_PRESETS[profile] ? profile : 'demo-week';
    const config = PROFILE_PRESETS[resolvedProfile];

    console.log(`[Seed] Starting seed profile: ${resolvedProfile}`);

    if (!window.db) {
        console.error('[Seed] DB not available');
        return;
    }

    await seedPartners();
    await seedContacts(config);
    await seedTasks(config);
    await seedEvents(config);
    await seedDeals(config);
    await seedDocuments();

    console.log(`[Seed] Seed profile complete: ${resolvedProfile} (${config.description})`);

    if (typeof window.dispatchAppDataChanged === 'function') {
        window.dispatchAppDataChanged({ source: 'seed-full', mode: 'full-repaint', profile: resolvedProfile });
    }
}

export async function runFullWorkflowSeed() {
    await runSeedProfile('demo-week');
}
