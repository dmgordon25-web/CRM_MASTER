function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderErrorCard(target, widgetId, err) {
  if (!target) return;
  const name = widgetId || 'widget';
  const errorStack = err?.stack || err?.message || err || 'Unknown error';
  const container = typeof target.closest === 'function'
    ? target.closest('[data-widget-id]') || target
    : target;
  const detailsId = `labs-widget-error-${name}`;
  const errorEl = document.createElement('div');
  errorEl.className = 'labs-widget-error-card';
  errorEl.innerHTML = `
    <div class="labs-widget-error__title">Widget failed: ${escapeHtml(name)}</div>
    <div class="labs-widget-error__actions">
      <button type="button" class="labs-btn-primary" data-action="reload-widget">Reload</button>
      <button type="button" class="labs-btn-ghost" data-action="toggle-details" aria-controls="${detailsId}">Details</button>
    </div>
    <pre id="${detailsId}" class="labs-widget-error__details" style="display:none">${escapeHtml(errorStack)}</pre>
  `;
  const reloadBtn = errorEl.querySelector('[data-action="reload-widget"]');
  if (reloadBtn) {
    reloadBtn.addEventListener('click', () => {
      try { window.location.reload(); } catch (_) {}
    });
  }
  const toggleBtn = errorEl.querySelector('[data-action="toggle-details"]');
  const details = errorEl.querySelector(`#${detailsId}`);
  if (toggleBtn && details) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = details.style.display === 'none';
      details.style.display = isHidden ? 'block' : 'none';
      toggleBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    });
  }

  container.replaceChildren(errorEl);
}

export function safeRenderWidget(widgetId, renderFn, mountEl, context = {}) {
  if (typeof renderFn !== 'function' || !mountEl) return null;
  try {
    return renderFn(mountEl, context);
  } catch (err) {
    const stack = err?.stack || err;
    console.error(`[labs] widget render failed ${widgetId || ''}`.trim(), stack);
    renderErrorCard(mountEl, widgetId, err);
    return null;
  }
}

function findWidgetContainer(el, widgetId) {
  if (!el) return null;
  const selector = widgetId ? `[data-widget-id="${widgetId}"]` : '[data-widget-id]';
  if (typeof el.closest === 'function') {
    const match = el.closest(selector);
    if (match) return match;
  }
  if (el.dataset?.widgetId) return el;
  return null;
}

export function safeBindClick(widgetId, el, handler) {
  if (!el || typeof el.addEventListener !== 'function' || typeof handler !== 'function') return null;
  const wrapped = (event) => {
    try {
      handler(event);
    } catch (err) {
      const stack = err?.stack || err;
      console.error(`[labs] widget click failed ${widgetId || ''}`.trim(), stack);
      const container = findWidgetContainer(el, widgetId) || el;
      renderErrorCard(container, widgetId, err);
    }
  };
  el.addEventListener('click', wrapped);
  return wrapped;
}
