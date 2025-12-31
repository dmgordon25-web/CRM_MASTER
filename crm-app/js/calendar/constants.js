
export const EVENT_CATEGORIES = Object.freeze([
    { key: 'call', label: 'Call', icon: '📞', type: 'task', accent: '--accent-task', tokens: ['call', 'phone'] },
    { key: 'email', label: 'Email', icon: '✉️', type: 'task', accent: '--accent-task', tokens: ['email', 'mail'] },
    { key: 'sms', label: 'SMS', icon: '💬', type: 'task', accent: '--accent-task', tokens: ['sms', 'text', 'message'] },
    { key: 'meeting', label: 'Meeting', icon: '👥', type: 'contact', accent: '--accent-contact', tokens: ['meeting', 'appointment', 'birthday', 'anniversary', 'review'] },
    { key: 'partner', label: 'Partner', icon: '🤝', type: 'partner', accent: '--accent-partner', tokens: ['partner', 'referral', 'lender', 'broker'] },
    { key: 'postal', label: 'Postal', icon: '📮', type: 'task', accent: '--accent-task', tokens: ['postal', 'mail', 'letter'] },
    { key: 'followup', label: 'Follow-up', icon: '🔔', type: 'task', accent: '--accent-task', tokens: ['follow-up', 'followup', 'follow', 'touch', 'reminder'] },
    { key: 'nurture', label: 'Nurture', icon: '📌', type: 'task', accent: '--accent-nurture', tokens: ['nurture', 'check-in', 'touch'] },
    { key: 'task', label: 'Task', icon: '✅', type: 'task', accent: '--accent-task', tokens: ['task', 'todo', 'to-do', 'check'] },
    { key: 'deadline', label: 'Milestone', icon: '⭐', type: 'milestone', accent: '--accent-milestone', tokens: ['milestone', 'deal', 'closing', 'deadline', 'funded', 'closing-watch'] },
    { key: 'other', label: 'Other', icon: '📌', type: 'other', accent: '--accent-other', tokens: [] },
]);

export const DEFAULT_EVENT_CATEGORY = EVENT_CATEGORIES.find(c => c.key === 'other') || EVENT_CATEGORIES[EVENT_CATEGORIES.length - 1];
