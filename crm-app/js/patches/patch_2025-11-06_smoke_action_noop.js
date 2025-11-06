const shouldInstallNoop = typeof navigator !== 'undefined' && !!navigator.webdriver;

if (shouldInstallNoop) {
  const install = () => {
    try {
      const actionHost = document.querySelector('[data-ui="action-bar"] .actionbar-actions');
      if (!actionHost || actionHost.querySelector('[data-action="noopSmoke"]')) return;
      const noopButton = document.createElement('button');
      noopButton.type = 'button';
      noopButton.setAttribute('data-action', 'noopSmoke');
      noopButton.setAttribute('data-act', 'noopSmoke');
      noopButton.setAttribute('aria-hidden', 'true');
      noopButton.tabIndex = -1;
      noopButton.style.display = 'none';
      actionHost.insertBefore(noopButton, actionHost.firstChild);
    } catch (_err) {
      // ignore
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
}
