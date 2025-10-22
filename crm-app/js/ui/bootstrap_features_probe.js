/*
 * Runtime bootstrap safety net ensuring core affordances are available
 */
document.addEventListener('DOMContentLoaded', () => {
  try {
    if (window.overlay && typeof window.overlay.show === 'function' && !document.body.__splashShown) {
      document.body.__splashShown = 1;
      try {
        window.overlay.show('Loading…');
      } catch (err) {
        console.info('[bootstrap_features_probe] overlay.show failed', err);
      }
      requestAnimationFrame(() => {
        try {
          window.overlay.hide && window.overlay.hide();
        } catch (err) {
          console.info('[bootstrap_features_probe] overlay.hide failed', err);
        }
      });
    }
  } catch (err) {
    console.info('[bootstrap_features_probe] splash bootstrap error', err);
  }

  try {
    const headerToolbar = document.querySelector('[data-ui="header-toolbar"], .header');
    const newButton = headerToolbar && headerToolbar.querySelector('.btn-new');
    if (headerToolbar && !newButton) {
      (async () => {
        try {
          const mod = await import('./header_toolbar.js');
          const init = mod && (mod.initHeaderToolbar || mod.default || mod.initializeHeaderToolbar);
          if (typeof init === 'function') {
            init();
            return;
          }
        } catch (err) {
          console.info('[bootstrap_features_probe] header toolbar dynamic import failed', err);
        }
        try {
          if (!headerToolbar.querySelector('.btn-new')) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-new';
            btn.textContent = '+ New';
            btn.addEventListener('click', () => {
              try {
                window.openQuickAddCompat && window.openQuickAddCompat();
              } catch (err) {
                console.info('[bootstrap_features_probe] openQuickAddCompat failed', err);
              }
            }, { once: false });
            headerToolbar.appendChild(btn);
          }
        } catch (err) {
          console.info('[bootstrap_features_probe] header toolbar fallback failed', err);
        }
      })();
    }
  } catch (err) {
    console.info('[bootstrap_features_probe] header toolbar guard failed', err);
  }

  try {
    const settingsRoot = document.querySelector('[data-ui="settings-panel"], .settings-panel');
    const hasAvatarInput = settingsRoot && settingsRoot.querySelector('input[type="file"][accept="image/*"]');
    if (settingsRoot && !hasAvatarInput) {
      (async () => {
        try {
          await import('./header_toolbar.js');
        } catch (err) {
          console.info('[bootstrap_features_probe] avatar input dynamic import failed', err);
        }
      })();
    }
  } catch (err) {
    console.info('[bootstrap_features_probe] avatar bootstrap error', err);
  }

  try {
    const contactModal = document.querySelector('[data-ui="contact-modal"], .contact-modal');
    if (contactModal) {
      const hasAddContactButton = contactModal.querySelector('button[aria-label="Add Contact"], button[title="Add Contact"]');
      if (!hasAddContactButton) {
        const affordance = document.createElement('button');
        affordance.type = 'button';
        affordance.textContent = '+';
        affordance.setAttribute('aria-label', 'Add Contact');
        affordance.title = 'Add Contact';
        affordance.addEventListener('click', () => {
          try {
            window.renderContactModal && window.renderContactModal(null);
          } catch (err) {
            console.info('[bootstrap_features_probe] renderContactModal failed', err);
          }
        }, { once: false });
        contactModal.appendChild(affordance);
      }
    }
  } catch (err) {
    console.info('[bootstrap_features_probe] contact modal bootstrap error', err);
  }
});
