const FALLBACK_SAFE = (value) => String(value == null ? '' : value).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch] || ch));
const FALLBACK_NORMALIZE = (value) => String(value == null ? '' : value).trim().toLowerCase();

function ensureSafe(fn){ return typeof fn === 'function' ? fn : FALLBACK_SAFE; }
function ensureNormalize(fn){ return typeof fn === 'function' ? fn : FALLBACK_NORMALIZE; }
function ensureColor(fn){ return typeof fn === 'function' ? fn : () => null; }

export function renderPipelineMomentumWidget(options = {}){
  const host = options.host || null;
  const countEl = options.countEl || null;
  if(!host) return;
  if(host.dataset && host.dataset.dashHidden === 'true') return;
  const contacts = Array.isArray(options.contacts) ? options.contacts : [];
  const safe = ensureSafe(options.safe);
  const normalizeStatus = ensureNormalize(options.normalizeStatus);
  const colorForStage = ensureColor(options.colorForStage);
  const stageLabels = options.stageLabels && typeof options.stageLabels === 'object' ? options.stageLabels : {};

  const stageCounts = contacts.reduce((memo, contact) => {
    if(!contact) return memo;
    const key = normalizeStatus(contact.stage);
    if(!key) return memo;
    memo[key] = (memo[key] || 0) + 1;
    return memo;
  }, {});

  const orderedStages = ['application','processing','underwriting','approved','cleared-to-close','funded','post-close','nurture','lost','denied','long shot'];
  const stageTotal = Object.values(stageCounts).reduce((sum, val) => sum + (val || 0), 0);
  if(!stageTotal){
    host.innerHTML = '<div class="mini-bar-chart momentum-chart"><div class="mini-bar-row empty">Pipeline looks quiet. Add contacts or update stages to watch momentum build.</div></div>';
    if(countEl) countEl.textContent = 0;
    return;
  }

  const orderedSet = new Set(orderedStages);
  const activeOrdered = orderedStages.filter(key => stageCounts[key]);
  const additionalStages = Object.keys(stageCounts).filter(key => key && !orderedSet.has(key));
  const finalOrder = activeOrdered.concat(additionalStages);

  const rows = finalOrder.map(key => {
    const count = stageCounts[key] || 0;
    const pct = stageTotal ? Math.round((count / stageTotal) * 100) : 0;
    const label = stageLabels[key] || (key ? key.replace(/-/g, ' ') : 'Stage');
    const color = colorForStage(key) || '#6366f1';
    const width = count ? Math.max(pct, 3) : 0;
    return `<div class="mini-bar-row"><div class="mini-bar-label"><span class="mini-bar-dot" style="background:${color}"></span>${safe(label)}</div><div class="mini-bar-track"><div class="mini-bar-fill" style="width:${width}%"></div></div><div class="mini-bar-value">${count} • ${pct}%</div></div>`;
  }).join('');

  host.innerHTML = `<div class="mini-bar-chart momentum-chart">${rows}</div>`;
  if(countEl){
    countEl.textContent = stageTotal || 0;
  }
}
