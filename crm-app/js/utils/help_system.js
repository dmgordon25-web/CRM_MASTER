
export class HelpSystem {
    constructor() {
        this.registry = new Map();
        this.activePopover = null;
        this._boundDismiss = this._handleDismiss.bind(this);
        this._hideTimer = null;
    }

    register(id, { title, content }) {
        this.registry.set(id, { title, content });
    }

    attach(element, helpId) {
        if (!element) return;

        // title-based tooltip fallback (Phase 8 requirement)
        const data = this.registry.get(helpId);
        if (data && data.content) {
            element.setAttribute('title', data.content);
        }

        element.addEventListener('mouseenter', (e) => this._show(e, helpId));
        element.addEventListener('mouseleave', () => this._scheduleHide());
        element.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._show(e, helpId, true);
        });
        element.addEventListener('focus', (e) => this._show(e, helpId));
        element.addEventListener('blur', () => this._scheduleHide());
    }

    init() {
        document.querySelectorAll('[data-help-id]').forEach(el => {
            this.attach(el, el.dataset.helpId);
        });
    }

    _show(event, helpId, persist = false) {
        const data = this.registry.get(helpId);
        if (!data) return;

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

        popover.innerHTML = `
      <h4>${this._escape(data.title)}</h4>
      <div>${data.content}</div>
    `;

        document.body.appendChild(popover);
        this.activePopover = popover;

        this._position(event.target, popover);

        requestAnimationFrame(() => {
            popover.dataset.visible = 'true';
        });

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
        }, 300);
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
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}

export const helpSystem = new HelpSystem();
