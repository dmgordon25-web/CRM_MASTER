/* Runtime bootstrap safety net ensuring core affordances are available */
document.addEventListener('DOMContentLoaded', () => {
  try {
    try {
      console.info('[A_BEACON] probe loaded');
    } catch (_) {}

    try {
      const overlay = window.overlay;
      const body = document.body;
      if (overlay && typeof overlay.show === 'function' && body && !body.__splashOnce) {
        body.__splashOnce = 1;
        try {
          overlay.show('Loading…');
        } catch (err) {
          console.info('[A_BEACON] splash show failed', err);
        }
        try {
          requestAnimationFrame(() => {
            try {
              overlay.hide && overlay.hide();
            } catch (err) {
              console.info('[A_BEACON] splash hide failed', err);
            }
          });
        } catch (err) {
          console.info('[A_BEACON] splash rAF failed', err);
        }
      }
    } catch (err) {
      console.info('[A_BEACON] splash bootstrap error', err);
    }

    try {
      if (!window.__WIRED_HEADER_TOOLBAR__) {
        import('./header_toolbar.js').catch((err) => {
          console.info('[A_BEACON] header import failed', err);
        });
      }
    } catch (err) {
      console.info('[A_BEACON] header bootstrap error', err);
    }

    try {
      const contactModal = document.getElementById('contact-modal');
      if (contactModal) {
        const existing = contactModal.querySelector('button[aria-label="Add Contact"], button[title="Add Contact"]');
        if (!existing) {
          const affordance = document.createElement('button');
          affordance.type = 'button';
          affordance.textContent = '+';
          affordance.setAttribute('aria-label', 'Add Contact');
          affordance.title = 'Add Contact';
          affordance.addEventListener('click', () => {
            try {
              window.renderContactModal?.(null);
            } catch (err) {
              console.info('[A_BEACON] contact modal invoke failed', err);
            }
          });
          contactModal.appendChild(affordance);
        }
      }
    } catch (err) {
      console.info('[A_BEACON] contact bootstrap error', err);
    }
  } catch (err) {
    console.info('[A_BEACON] probe bootstrap error', err);
  }
});
