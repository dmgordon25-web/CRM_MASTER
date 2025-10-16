/* Diagnostics overlay UI — renders fatal boot diagnostics with actionable context */
(function(){
  if (typeof window === 'undefined') return;
  const global = window;
  const doc = typeof document !== 'undefined' ? document : null;
  const state = global.__BOOT_EARLY_TRAP_STATE__ = global.__BOOT_EARLY_TRAP_STATE__ || {};

  let overlayRoot = null;
  let headingEl = null;
  let summaryEl = null;
  let metaEl = null;
  let detailEl = null;
  let actionsRow = null;
  let domReadyHooked = false;

  function ensureDom(callback){
    if (!doc) return;
    if (doc.body) {
      try { callback(); }
      catch (err) { console.warn('[diagnostics-overlay] render failed', err); }
      return;
    }
    if (domReadyHooked) return;
    domReadyHooked = true;
    doc.addEventListener('DOMContentLoaded', () => {
      try { callback(); }
      catch (err) { console.warn('[diagnostics-overlay] render failed', err); }
    }, { once: true });
  }

  function createActionLink(text, href){
    if (!doc) return null;
    const link = doc.createElement('a');
    link.textContent = text;
    link.href = href;
    link.rel = 'noopener';
    link.style.color = '#a7f3d0';
    link.style.fontWeight = '600';
    link.style.textDecoration = 'underline';
    return link;
  }

  function ensureOverlay(){
    if (overlayRoot) return overlayRoot;
    if (!doc || !doc.body) return null;

    const root = doc.createElement('div');
    root.id = 'diagnostics-overlay';
    root.setAttribute('role', 'alert');
    root.setAttribute('aria-live', 'assertive');
    root.style.position = 'fixed';
    root.style.inset = '0';
    root.style.zIndex = '2147483646';
    root.style.background = 'rgba(15, 23, 42, 0.96)';
    root.style.color = '#f8fafc';
    root.style.display = 'flex';
    root.style.alignItems = 'center';
    root.style.justifyContent = 'center';
    root.style.padding = '32px';

    const panel = doc.createElement('div');
    panel.style.background = 'rgba(15, 23, 42, 0.88)';
    panel.style.border = '1px solid rgba(148, 163, 184, 0.35)';
    panel.style.borderRadius = '18px';
    panel.style.boxShadow = '0 32px 80px rgba(15,23,42,0.65)';
    panel.style.width = 'min(760px, 100%)';
    panel.style.maxHeight = '80vh';
    panel.style.overflow = 'auto';
    panel.style.padding = '32px';
    panel.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

    const heading = doc.createElement('h2');
    heading.textContent = 'Boot diagnostics';
    heading.style.margin = '0 0 12px 0';

    const summary = doc.createElement('p');
    summary.style.margin = '0';
    summary.style.fontSize = '16px';
    summary.style.lineHeight = '1.5';

    const meta = doc.createElement('p');
    meta.style.margin = '12px 0 18px 0';
    meta.style.fontSize = '13px';
    meta.style.color = '#bae6fd';
    meta.style.fontFamily = "'JetBrains Mono', 'Fira Code', monospace";
    meta.style.wordBreak = 'break-word';

    const detail = doc.createElement('pre');
    detail.style.margin = '0';
    detail.style.padding = '16px';
    detail.style.borderRadius = '12px';
    detail.style.background = 'rgba(15, 23, 42, 0.72)';
    detail.style.border = '1px solid rgba(148, 163, 184, 0.25)';
    detail.style.maxHeight = '40vh';
    detail.style.overflow = 'auto';
    detail.style.fontSize = '12px';
    detail.style.lineHeight = '1.6';
    detail.style.whiteSpace = 'pre-wrap';
    detail.style.wordBreak = 'break-word';

    const actions = doc.createElement('div');
    actions.style.display = 'flex';
    actions.style.flexWrap = 'wrap';
    actions.style.gap = '16px';
    actions.style.marginTop = '20px';
    actions.style.alignItems = 'center';

    const reloadBtn = doc.createElement('button');
    reloadBtn.type = 'button';
    reloadBtn.textContent = 'Reload app';
    reloadBtn.style.padding = '10px 16px';
    reloadBtn.style.borderRadius = '999px';
    reloadBtn.style.border = 'none';
    reloadBtn.style.cursor = 'pointer';
    reloadBtn.style.background = '#38bdf8';
    reloadBtn.style.color = '#0f172a';
    reloadBtn.style.fontWeight = '600';
    reloadBtn.addEventListener('click', () => {
      try { global.location.reload(); }
      catch (_) {}
    });

    actions.appendChild(reloadBtn);
    const safeLink = createActionLink('Safe mode', '?safe=1');
    if (safeLink) {
      actions.appendChild(safeLink);
    }

    const supportLink = createActionLink('Open diagnostics log', '/__log');
    if (supportLink) {
      supportLink.target = '_blank';
      actions.appendChild(supportLink);
    }

    panel.appendChild(heading);
    panel.appendChild(summary);
    panel.appendChild(meta);
    panel.appendChild(detail);
    panel.appendChild(actions);
    root.appendChild(panel);

    doc.body.appendChild(root);

    overlayRoot = root;
    headingEl = heading;
    summaryEl = summary;
    metaEl = meta;
    detailEl = detail;
    actionsRow = actions;
    return overlayRoot;
  }

  function describe(payload){
    if (!payload || typeof payload !== 'object') {
      return {
        title: 'Boot halted',
        summary: String(payload || 'A fatal error stopped THE CRM Tool before it could start.'),
        detail: '',
        hint: ''
      };
    }
    const name = payload.name ? String(payload.name) : '';
    const message = payload.message ? String(payload.message) : 'Boot halted';
    const detail = payload.detail ? String(payload.detail) : '';
    const kind = payload.kind ? String(payload.kind) : '';
    const at = typeof payload.at === 'number' ? payload.at : null;
    let hint = '';
    if (kind) {
      hint += `event: ${kind}`;
    }
    if (at) {
      try {
        const stamp = new Date(at);
        const formatted = stamp.toISOString();
        hint = hint ? `${hint} • ${formatted}` : formatted;
      } catch (_) {}
    }
    if (!hint && payload.clock != null) {
      hint = `t+${payload.clock}ms`;
    }
    return {
      title: name || 'Boot diagnostics',
      summary: name ? `${name}: ${message}` : message,
      detail: detail && detail !== message ? detail : detail || message,
      hint
    };
  }

  function render(payload){
    ensureDom(() => {
      const overlay = ensureOverlay();
      if (!overlay || !summaryEl || !detailEl) return;
      const description = describe(payload);
      if (headingEl && description.title) {
        headingEl.textContent = description.title;
      }
      summaryEl.textContent = description.summary || 'Boot halted before startup.';
      detailEl.textContent = description.detail || description.summary || '';
      if (metaEl) {
        metaEl.textContent = description.hint || '';
        metaEl.style.display = description.hint ? '' : 'none';
      }
      overlay.style.display = 'flex';
      if (actionsRow) {
        actionsRow.style.display = 'flex';
      }
    });
  }

  function show(payload){
    try {
      render(payload);
      state.lastRenderedOverlay = payload;
      state.pendingOverlay = null;
    } catch (err) {
      console.warn('[diagnostics-overlay] show failed', err);
    }
  }

  global.showDiagnosticsOverlay = show;

  if (state.pendingOverlay) {
    show(state.pendingOverlay);
  } else if (state.lastFatal) {
    show(state.lastFatal);
  }
})();
