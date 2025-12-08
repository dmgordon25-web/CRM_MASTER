// Labs Entry Point - CRM Labs Dashboard
// Loads the visually stunning version of the actual CRM tool

let dashboardModulePromise = null;

function loadDashboard() {
  if (!dashboardModulePromise) {
    dashboardModulePromise = import('./dashboard.js');
  }
  return dashboardModulePromise;
}

export async function initLabs(root) {
  if (!root) {
    console.error('[labs] No root element provided');
    return;
  }

  try {
    const module = await loadDashboard();
    const initDashboard = module.initLabsCRMDashboard || module.default;

    if (typeof initDashboard !== 'function') {
      throw new Error('Labs dashboard missing initLabsCRMDashboard export');
    }

    await initDashboard(root);
    console.info('[labs] CRM Labs dashboard rendered');
  } catch (err) {
    console.error('[labs] Failed to initialize:', err);

    // Fallback error display
    root.innerHTML = `
      <div class="labs-error">
        <h2>⚠️ Labs Dashboard Error</h2>
        <p>Failed to load CRM Labs dashboard.</p>
        <pre>${err.message}</pre>
        <button class="labs-btn-primary" onclick="location.reload()">Reload</button>
      </div>
    `;
  }
}

export async function unmountLabs() {
  try {
    const module = await loadDashboard();
    if (module && typeof module.unmountLabsDashboard === 'function') {
      module.unmountLabsDashboard();
    }
  } catch (err) {
    console.warn('[labs] unmount failed', err);
  }
}

export default initLabs;
