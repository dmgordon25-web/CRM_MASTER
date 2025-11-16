// Labs Entry Point - Mission Control Dashboard
// Loads the experimental labs dashboard with creative widgets

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
    const initDashboard = module.initLabsDashboard || module.default;

    if (typeof initDashboard !== 'function') {
      throw new Error('Labs dashboard missing initLabsDashboard export');
    }

    await initDashboard(root);
    console.info('[labs] Mission Control dashboard rendered');
  } catch (err) {
    console.error('[labs] Failed to initialize:', err);

    // Fallback error display
    root.innerHTML = `
      <div class="labs-error">
        <h2>⚠️ Labs Dashboard Error</h2>
        <p>Failed to load Mission Control dashboard.</p>
        <pre>${err.message}</pre>
      </div>
    `;
  }
}

export default initLabs;
