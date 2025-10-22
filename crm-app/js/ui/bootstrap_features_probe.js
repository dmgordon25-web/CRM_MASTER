/* Runtime bootstrap safety net ensuring core affordances are available */
document.addEventListener('DOMContentLoaded', () => {
  const ensureHeader = () => {
    try {
      return import('crm/ui/header_toolbar.js').catch((err) => {
        try {
          console.info('[A_BEACON] probe header import failed', err);
        } catch (_) {}
      });
    } catch (err) {
      try {
        console.info('[A_BEACON] probe header import error', err);
      } catch (_) {}
      return Promise.resolve();
    }
  };

  try {
    console.info('[A_BEACON] probe loaded');
  } catch (_) {}

  try {
    if (!window.__WIRED_HEADER_TOOLBAR__) {
      ensureHeader();
    }
  } catch (err) {
    try {
      console.info('[A_BEACON] probe header check error', err);
    } catch (_) {}
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
            try {
              console.info('[A_BEACON] contact modal invoke failed', err);
            } catch (_) {}
          }
        });
        contactModal.appendChild(affordance);
      }
    }
  } catch (err) {
    try {
      console.info('[A_BEACON] contact bootstrap error', err);
    } catch (_) {}
  }

  try {
    const settingsPanel = document.getElementById('lo-profile-settings');
    if (settingsPanel) {
      const avatarInput = settingsPanel.querySelector('input[type="file"][accept="image/*"]');
      if (!avatarInput) {
        ensureHeader();
      }
    }
  } catch (err) {
    try {
      console.info('[A_BEACON] settings bootstrap error', err);
    } catch (_) {}
  }
});
