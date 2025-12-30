
import { normalizeStatus } from './pipeline/constants.js';

const SEED_PREFIX = 'seed_fw_'; // fw = full workflow

// Deterministic helpers
function getId(type, index) {
    return `${SEED_PREFIX}${type}_${index}`;
}

function getDate(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
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
    console.log('[Seed] Starting Full Workflow Seed...');

    if (!window.db) {
        console.error('[Seed] DB not available');
        return;
    }

    // 1. Partners (8+)
    // Diverse roles: Real Estate, Title, Insurance, Inspection
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
            company: p.name, // Use name as company for simplicity
            email: p.email,
            phone: `555-000-${1000 + i}`,
            tier: p.tier,
            notes: `Seeded partner of type ${p.type}`,
            updatedAt: new Date().toISOString()
        });
    }

    // 2. Contacts (12+)
    // Spread across stages, types
    const contactsData = [
        { first: 'Aaron', last: 'Anderson', stage: 'lead', status: 'nurture', loanType: 'Conventional', amount: 350000, note: 'New lead' },
        { first: 'Beth', last: 'Baker', stage: 'application', status: 'inprogress', loanType: 'FHA', amount: 280000, note: 'App started' },
        { first: 'Carl', last: 'Clark', stage: 'processing', status: 'active', loanType: 'VA', amount: 420000, note: 'Docs in' },
        { first: 'Diana', last: 'Davis', stage: 'underwriting', status: 'active', loanType: 'Conventional', amount: 310000, note: 'In UW warning' },
        { first: 'Evan', last: 'Edwards', stage: 'approved', status: 'active', loanType: 'Jumbo', amount: 750000, note: 'Approved with conditions' },
        { first: 'Fiona', last: 'Foster', stage: 'cleared-to-close', status: 'active', loanType: 'Conventional', amount: 300000, note: 'CTC ready' }, // CTC
        { first: 'George', last: 'Green', stage: 'funded', status: 'client', loanType: 'FHA', amount: 250000, note: 'Past Client' }, // Past Client
        { first: 'Hannah', last: 'Hill', stage: 'nurture', status: 'nurture', loanType: 'USDA', amount: 200000, note: 'Long term nurture' }, // Follow-up heavy
        { first: 'Ivan', last: 'Ingram', stage: 'application', status: 'paused', loanType: 'Conventional', amount: 400000, note: 'Paused app' },
        { first: 'Julia', last: 'Jones', stage: 'lead', status: 'nurture', loanType: 'VA', amount: 450000, note: 'Referral' },
        { first: 'Kevin', last: 'King', stage: 'processing', status: 'active', loanType: 'Conventional', amount: 330000, note: 'Processing fast' },
        { first: 'Laura', last: 'Lee', stage: 'funded', status: 'client', loanType: 'Jumbo', amount: 800000, note: 'Recent closure' }
    ];

    // Specifics: birthdays, anniversaries, tasks
    // Contact 0: Birthday today
    // Contact 1: Anniversary today
    const todayDate = new Date().toISOString().split('T')[0];

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

        if (i === 0) contact.birthday = todayDate; // Upcoming celebration (today)
        if (i === 1) contact.anniversary = todayDate; // Upcoming celebration (today)

        await upsert('contacts', id, contact);
    }

    // 3. Tasks (20+)
    // Linked to contacts/partners
    // Mix of overdue, due today, next 7/14 days
    const taskDueOffsets = [-2, -1, 0, 0, 1, 2, 3, 5, 7, 10, 14, 15, 20, 0, 1, 2, 3, 4, 5, 6];

    for (let i = 0; i < 20; i++) {
        const id = getId('task', i + 1);
        const isContact = i % 2 === 0;
        const linkId = isContact ? getId('contact', (i % 12) + 1) : getId('partner', (i % 8) + 1);
        const due = getDate(taskDueOffsets[i]);
        const title = `Seed Task ${i + 1} (${isContact ? 'Contact' : 'Partner'})`;

        await upsert('tasks', id, {
            title: title,
            due: due,
            status: 'open',
            priority: i % 3 === 0 ? 'high' : 'normal',
            associatedId: linkId, // Generic association field, or specific fields
            contactId: isContact ? linkId : undefined,
            partnerId: !isContact ? linkId : undefined,
            description: 'Auto-generated seed task',
            updatedAt: new Date().toISOString()
        });
    }

    // 4. Calendar Events (15+)
    // 5+ in current week
    // Visually distinct types
    const eventTypes = ['meeting', 'call', 'followup', 'deadline', 'nurture'];
    const eventOffsets = [0, 0, 1, 1, 2, 3, 4, 5, 7, 10, 12, 14, 15, 20, 25]; // Many in first week

    for (let i = 0; i < 15; i++) {
        const id = getId('event', i + 1);
        const typeKey = eventTypes[i % eventTypes.length]; // cyclical
        let type = typeKey;
        let titlePrefix = 'Seed Event';

        // Map specific keys to display values or logic if needed
        if (typeKey === 'nurture') {
            titlePrefix = 'Nurture Check-in';
            // type is already 'nurture' which matches our new category
        } else if (typeKey === 'deadline') {
            titlePrefix = 'Contract Deadline';
        }

        const date = getDate(eventOffsets[i]);
        const isContact = i % 2 !== 0; // Alternate
        const linkId = isContact ? getId('contact', (i % 12) + 1) : getId('partner', (i % 8) + 1);

        await upsert('events', id, {
            title: `${titlePrefix} ${i + 1}`,
            type: type,
            start: `${date}T10:00:00`,
            end: `${date}T11:00:00`,
            allDay: i % 5 === 0, // Some all day
            associatedId: linkId,
            description: 'Auto-generated calendar event',
            updatedAt: new Date().toISOString()
        });
    }

    // 5. Document Center (6-10 docs for 3 contacts)
    const docContacts = [getId('contact', 2), getId('contact', 3), getId('contact', 4)]; // Use contacts active in pipe
    const docStatuses = ['Requested', 'Received', 'In Review', 'Approved', 'Waived'];
    const docNames = ['W2', 'Paystub', 'Bank Statement', 'Tax Return', 'ID'];

    let docCount = 0;
    for (const cid of docContacts) {
        for (let j = 0; j < 3; j++) { // 3 docs per contact => 9 docs total
            const id = getId('doc', docCount + 1);
            await upsert('documents', id, {
                contactId: cid,
                name: docNames[j % docNames.length],
                status: docStatuses[(j + docCount) % docStatuses.length],
                updatedAt: new Date().toISOString()
            });
            docCount++;
        }
    }

    console.log('[Seed] Full Workflow Seed Complete.');

    // Force UI Refresh
    if (typeof window.dispatchAppDataChanged === 'function') {
        window.dispatchAppDataChanged({ source: 'seed-full', mode: 'full-repaint' });
    }
}
