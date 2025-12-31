
import { normalizeStatus } from './pipeline/constants.js';

const SEED_PREFIX = 'seed_fw_'; // fw = full workflow

// Deterministic helpers
function getId(type, index) {
    return `${SEED_PREFIX}${type}_${index}`;
}

// Helper to get a date relative to the START of the current month
// This ensures events are always visible in the default month view
function getDateInCurrentMonth(dayOffset) {
    const d = new Date();
    d.setDate(1); // Start of month
    // Add offset days (e.g., 5th, 10th, 15th...)
    // Wrap around if extending beyond month end (simple approach)
    const maxDays = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const targetDay = Math.max(1, Math.min(dayOffset, maxDays));
    d.setDate(targetDay);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

function getTimestamp(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString();
}

async function upsert(store, key, row) {
    if (!window.db) return;
    try {
        const existing = await window.db.get(store, key).catch(() => null);
        const rec = existing ? { ...existing, ...row, id: key } : { ...row, id: key };
        // Ensure timestamp
        if (!rec.updatedAt) rec.updatedAt = new Date().toISOString();
        await window.db.put(store, rec);
    } catch (err) {
        console.error(`[Seed] Failed to upsert ${store}/${key}`, err);
    }
}

export async function runFullWorkflowSeed() {
    console.log('[Seed] Starting Full Workflow Seed (Packet B Parity)...');

    if (!window.db) {
        console.error('[Seed] DB not available');
        return;
    }

    const todayDate = new Date().toISOString().split('T')[0];

    // 1. Partners (8+)
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
        const id = getId('partner', i + 1);
        await upsert('partners', id, {
            name: p.name,
            company: p.name,
            email: p.email,
            phone: `555-000-${1000 + i}`,
            tier: p.tier,
            notes: `Seeded partner of type ${p.type}`,
            updatedAt: new Date().toISOString()
        });
    }

    // 2. Contacts (12+) with Birthday/Anniversary coverage
    const contactsData = [
        { first: 'Aaron', last: 'Anderson', stage: 'lead', status: 'nurture', loanType: 'Conventional', amount: 350000, note: 'New lead' },
        { first: 'Beth', last: 'Baker', stage: 'application', status: 'inprogress', loanType: 'FHA', amount: 280000, note: 'App started' },
        { first: 'Carl', last: 'Clark', stage: 'processing', status: 'active', loanType: 'VA', amount: 420000, note: 'Docs in' },
        { first: 'Diana', last: 'Davis', stage: 'underwriting', status: 'active', loanType: 'Conventional', amount: 310000, note: 'In UW warning' },
        { first: 'Evan', last: 'Edwards', stage: 'approved', status: 'active', loanType: 'Jumbo', amount: 750000, note: 'Approved with conditions' },
        { first: 'Fiona', last: 'Foster', stage: 'cleared-to-close', status: 'active', loanType: 'Conventional', amount: 300000, note: 'CTC ready' },
        { first: 'George', last: 'Green', stage: 'funded', status: 'client', loanType: 'FHA', amount: 250000, note: 'Past Client' },
        { first: 'Hannah', last: 'Hill', stage: 'nurture', status: 'nurture', loanType: 'USDA', amount: 200000, note: 'Long term nurture' },
        { first: 'Ivan', last: 'Ingram', stage: 'application', status: 'paused', loanType: 'Conventional', amount: 400000, note: 'Paused app' },
        { first: 'Julia', last: 'Jones', stage: 'lead', status: 'nurture', loanType: 'VA', amount: 450000, note: 'Referral' },
        { first: 'Kevin', last: 'King', stage: 'processing', status: 'active', loanType: 'Conventional', amount: 330000, note: 'Processing fast' },
        { first: 'Laura', last: 'Lee', stage: 'funded', status: 'client', loanType: 'Jumbo', amount: 800000, note: 'Recent closure' }
    ];

    for (let i = 0; i < contactsData.length; i++) {
        const c = contactsData[i];
        const id = getId('contact', i + 1);

        // Assign partners cyclically
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
            updatedAt: new Date().toISOString()
        };

        // Ensure Birthday and Anniversary fall in current month for visibility
        if (i === 0) contact.birthday = getDateInCurrentMonth(5); // 5th of current month
        if (i === 1) contact.anniversary = getDateInCurrentMonth(10); // 10th of current month

        await upsert('contacts', id, contact);
    }

    // 3. Tasks - Ensuring Task vs Nurture distinction
    // Nurture tasks should use 'nurture' type or have nurture hints
    const taskDefs = [
        { type: 'call', title: 'Call Client', offset: 2 },
        { type: 'email', title: 'Send Email', offset: 3 },
        { type: 'nurture', title: 'Nurture Touch', offset: 4 }, // Distinct Nurture
        { type: 'task', title: 'General Task', offset: 6 },     // Generic Task
        { type: 'deadline', title: 'Doc Deadline', offset: 7 },
        { type: 'meeting', title: 'Review Meeting', offset: 8 }
    ];

    for (let i = 0; i < 20; i++) {
        const def = taskDefs[i % taskDefs.length];
        const id = getId('task', i + 1);
        const isContact = i % 2 === 0;
        const linkId = isContact ? getId('contact', (i % 12) + 1) : getId('partner', (i % 8) + 1);
        const due = getDateInCurrentMonth(def.offset + i); // Spread out in current month

        await upsert('tasks', id, {
            title: `${def.title} ${i + 1} ${isContact ? '' : '(Partner)'}`,
            due: due,
            status: 'open',
            priority: i % 3 === 0 ? 'high' : 'normal',
            associatedId: linkId,
            contactId: isContact ? linkId : undefined,
            partnerId: !isContact ? linkId : undefined,
            type: def.type, // Critical for icon mapping
            description: 'Auto-generated seed task',
            updatedAt: new Date().toISOString()
        });
    }

    // 4. Calendar Events (15+)
    // Directly inject into 'events' store for Partner events and manual items
    const eventTypes = ['meeting', 'call', 'partner', 'nurture'];

    for (let i = 0; i < 15; i++) {
        const id = getId('event', i + 1);
        const typeKey = eventTypes[i % eventTypes.length];
        let type = typeKey;
        let titlePrefix = 'Seed Event';
        let category = typeKey;

        // Force Partner Event
        if (typeKey === 'partner') {
            titlePrefix = 'Partner Call';
        } else if (typeKey === 'nurture') {
            titlePrefix = 'Nurture Check-in';
        }

        const date = getDateInCurrentMonth((i * 2) + 1); // Every other day
        const isContact = i % 2 !== 0;
        const linkId = isContact ? getId('contact', (i % 12) + 1) : getId('partner', (i % 8) + 1);

        await upsert('events', id, {
            title: `${titlePrefix} ${i + 1}`,
            type: type, // 'partner', 'nurture', 'meeting'
            category: category,
            start: `${date}T10:00:00`,
            end: `${date}T11:00:00`,
            allDay: i % 5 === 0,
            associatedId: linkId,
            contactId: isContact ? linkId : undefined,
            partnerId: !isContact ? linkId : undefined,
            description: 'Auto-generated calendar event',
            updatedAt: new Date().toISOString()
        });
    }

    // 5. Milestones (Deals)
    // Create 'deals' that calendar_impl.js reads as milestones
    const dealContacts = [getId('contact', 4), getId('contact', 5), getId('contact', 6)];
    for (let i = 0; i < dealContacts.length; i++) {
        const id = getId('deal', i + 1);
        const date = getDateInCurrentMonth(20 + i); // End of month
        await upsert('deals', id, {
            contactId: dealContacts[i],
            status: 'funded', // or 'cleared-to-close'
            closingDate: date,
            date: date, // some code paths use date
            amount: 500000,
            updatedAt: new Date().toISOString()
        });
    }

    // 6. Documents (Cleanup/No-op for calendar but good for completeness)
    const docContacts = [getId('contact', 2), getId('contact', 3)];
    let docCount = 0;
    for (const cid of docContacts) {
        for (let j = 0; j < 2; j++) {
            const id = getId('doc', docCount + 1);
            await upsert('documents', id, {
                contactId: cid,
                name: `Doc ${j}`,
                status: 'Requested',
                updatedAt: new Date().toISOString()
            });
            docCount++;
        }
    }

    console.log('[Seed] Full Workflow Seed Complete (Packet B).');

    // Force UI Refresh
    if (typeof window.dispatchAppDataChanged === 'function') {
        window.dispatchAppDataChanged({ source: 'seed-full', mode: 'full-repaint' });
    }
}
