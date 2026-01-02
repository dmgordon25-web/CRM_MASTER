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

if (typeof document !== 'undefined') {
  const ready = () => helpSystem.init();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready, { once: true });
  } else {
    ready();
  }
}
