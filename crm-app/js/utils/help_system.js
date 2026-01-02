import { HELP_CONTENT } from '../ui/help_registry.js';

export class HelpSystem {
  constructor() {
    this.registry = new Map();
    this.activePopover = null;
    this._boundDismiss = this._handleDismiss.bind(this);
    this._hideTimer = null;
    this._loadRegistry();
  }

  _loadRegistry() {
    if (!HELP_CONTENT || typeof HELP_CONTENT !== 'object') return;
    Object.entries(HELP_CONTENT).forEach(([id, payload]) => {
      this.register(id, payload || {});
    });
  }

  register(id, { title, content, short, detailsHtml, detailsText }) {
    if (!id) return;
    const entry = {
      title: title || id,
      short: short || content || '',
      detailsHtml: detailsHtml || '',
      detailsText: detailsText || ''
    };
    this.registry.set(id, entry);
  }

  attach(element, helpId) {
    if (!element || element.dataset.helpAttached === '1') return;
    const resolvedId = helpId || element.dataset.help || element.dataset.helpId;
    if (!resolvedId) return;

    const data = this.registry.get(resolvedId);
    if (data && data.short) {
      element.setAttribute('title', data.short);
    }

    const handler = (event, persist = false) => this._show(event, resolvedId, persist);
    element.addEventListener('mouseenter', (e) => handler(e, false));
    element.addEventListener('mouseleave', () => this._scheduleHide());
    element.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handler(e, true);
    });
    element.addEventListener('focus', (e) => handler(e, false));
    element.addEventListener('blur', () => this._scheduleHide());

    element.dataset.helpAttached = '1';
  }

  init(root = document) {
    if (typeof root === 'undefined' || !root.querySelectorAll) return;
    const nodes = root.querySelectorAll('[data-help], [data-help-id]');
    nodes.forEach(el => {
      const id = el.dataset.help || el.dataset.helpId;
      this.attach(el, id);
    });
  }

  refresh(root = document) {
    this.init(root);
  }

  _show(event, helpId, persist = false) {
    const data = this.registry.get(helpId);
    if (!data) return;
    const target = event?.target;
    if (!target || !target.getBoundingClientRect) return;

    this._cancelHide();

    if (this.activePopover && this.activePopover.dataset.helpId === helpId) {
      if (persist) {
        this.activePopover.dataset.persist = '1';
        document.addEventListener('click', this._boundDismiss);
      }
      return;
    }

    this._removePopover();

    const popover = document.createElement('div');
    popover.className = 'help-popover';
    popover.dataset.helpId = helpId;
    if (persist) popover.dataset.persist = '1';

    const shortText = this._escape(data.short || '');
    const detailsHtml = data.detailsHtml || '';
    const detailsText = data.detailsText ? `<p>${this._escape(data.detailsText)}</p>` : '';
    const detailBlock = detailsHtml || detailsText;

    popover.innerHTML = `
      <h4>${this._escape(data.title || helpId)}</h4>
      ${shortText ? `<p class="help-popover-short">${shortText}</p>` : ''}
      ${detailBlock ? `<details class="help-details" open><summary>More…</summary><div class="help-details-body">${detailBlock}</div></details>` : ''}
    `;

    document.body.appendChild(popover);
    this.activePopover = popover;

    this._position(target, popover);

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => { popover.dataset.visible = 'true'; });
    } else {
      popover.dataset.visible = 'true';
    }

    if (persist) {
      document.addEventListener('click', this._boundDismiss);
    }
  }

  _position(target, popover) {
    const rect = target.getBoundingClientRect();
    const popRect = popover.getBoundingClientRect();
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let top = rect.bottom + 8;
    let left = rect.left + (rect.width / 2) - (popRect.width / 2);

    if (top + popRect.height > winH - 10) {
      top = rect.top - popRect.height - 8;
    }

    if (left < 10) left = 10;
    if (left + popRect.width > winW - 10) left = winW - popRect.width - 10;

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
  }

  _scheduleHide() {
    this._hideTimer = setTimeout(() => {
      if (this.activePopover && this.activePopover.dataset.persist !== '1') {
        this._removePopover();
      }
    }, 200);
  }

  _cancelHide() {
    if (this._hideTimer) clearTimeout(this._hideTimer);
  }

  _removePopover() {
    if (this.activePopover) {
      this.activePopover.remove();
      this.activePopover = null;
      document.removeEventListener('click', this._boundDismiss);
    }
  }

  _handleDismiss(e) {
    if (this.activePopover && !this.activePopover.contains(e.target)) {
      this._removePopover();
    }
  }

  _escape(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

export const helpSystem = new HelpSystem();

// Dashboard Content
helpSystem.register('priority-actions', {
    title: 'Priority Actions',
    content: 'Urgent tasks and contacts needing attention. Click any row to take action immediately.'
});
helpSystem.register('today-work', {
    title: "Today's Work",
    content: 'Your scheduled tasks and follow-ups for today. Keep this list clear to stay on top of your game.'
});
helpSystem.register('milestones', {
    title: 'Milestones Ahead',
    content: 'Upcoming key dates for your active deals. Ensure you are prepared for closing and contingencies.'
});
helpSystem.register('referral-leaders', {
    title: 'Referral Leaders',
    content: 'Top partners sending you business. Recognize and reward your best referral sources.'
});
helpSystem.register('pipeline-momentum', {
    title: 'Pipeline Momentum',
    content: 'Visual snapshot of your active deal flow. Identify bottlenecks and track volume.'
});
helpSystem.register('doc-pulse', {
    title: 'Document Pulse',
    content: 'Track outstanding document requests. Ensure clients are providing necessary files on time.'
});
helpSystem.register('pipeline-snapshot', {
    title: 'Pipeline Snapshot',
    content: 'Counts by pipeline stage. Totals should match the classic dashboard pipeline summary.'
});
helpSystem.register('todo-widget', {
    title: 'To-Do',
    content: 'Lightweight personal checklist stored locally. Ideal for quick reminders that are not full tasks.'
});
helpSystem.register('celebrations', {
    title: 'Birthdays & Anniversaries',
    content: 'Upcoming birthdays and work anniversaries within the next week. Click a name to open the contact.'
});
helpSystem.register('favorites-widget', {
    title: 'Favorites',
    content: 'Pinned contacts and partners. Star a record to keep it at the top of your workspace.'
});
helpSystem.register('favorites', {
    title: 'Favorites',
    content: 'Pinned contacts and partners. Star a record to keep it at the top of your workspace.'
});

// View Content
helpSystem.register('contacts-view', {
    title: 'Contacts',
    content: 'Central hub for all borrowers and leads. Use filters to segment your list, or click any row to edit details.'
});
helpSystem.register('partners-view', {
    title: 'Partners',
    content: 'Manage your referral partners. Track tiers, volume, and notes to strengthen your relationships.'
});
helpSystem.register('pipeline-view', {
    title: 'Pipeline Board',
    content: 'Kanban view of active loans. Drag cards to move them between stages (Application → Processing → Underwriting).'
});
helpSystem.register('calendar-view', {
    title: 'Calendar',
    content: 'Monthly and weekly view of tasks, appointments, and loan milestones.'
});
helpSystem.register('reports-view', {
    title: 'Reports & Analytics',
    content: 'Deep dive into your business metrics. Analyze conversion rates, source performance, and production volume.'
});
helpSystem.register('labs-view', {
    title: 'Labs',
    content: 'Experimental features and new views. Test upcoming functionality before it goes mainstream.'
});
helpSystem.register('notifications-view', {
    title: 'Notifications',
    content: 'Stay updated on system alerts, task reminders, and record updates.'
});
if (typeof document !== 'undefined') {
  const ready = () => helpSystem.init();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready, { once: true });
  } else {
    ready();
  }
}
