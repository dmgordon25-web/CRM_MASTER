const FALLBACK_SAFE = (value) => String(value == null ? '' : value).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch] || ch));

function ensureSafe(fn){
  if(typeof fn === 'function') return fn;
  return FALLBACK_SAFE;
}

function ensureColorResolver(fn){
  if(typeof fn === 'function') return fn;
  return () => null;
}

export function renderPortfolioMixWidget(options = {}){
  const host = options.host || null;
  const countEl = options.countEl || null;
  if(!host) return;
  if(host.dataset && host.dataset.dashHidden === 'true') return;
  const partners = Array.isArray(options.partners) ? options.partners : [];
  const safe = ensureSafe(options.safe);
  const colorForTier = ensureColorResolver(options.colorForTier);

  const totals = partners.reduce((memo, partner) => {
    if(!partner) return memo;
    const tier = partner.tier || 'Developing';
    memo[tier] = (memo[tier] || 0) + 1;
    return memo;
  }, {});
  const entries = Object.entries(totals).sort((a, b) => (b[1] || 0) - (a[1] || 0));
  const totalCount = entries.reduce((sum, [, count]) => sum + (count || 0), 0);

  if(!entries.length){
    host.innerHTML = '<div class="mini-bar-chart portfolio-chart"><div class="mini-bar-row empty">No partners added yet. Click "+ Add Partner" to get started!</div></div>';
  }else{
    const rows = entries.map(([tier, count]) => {
      const pct = totalCount ? Math.round((count / totalCount) * 100) : 0;
      const color = colorForTier(tier) || '#4f46e5';
      const width = Math.max(pct, 3);
      return `<div class="mini-bar-row"><div class="mini-bar-label"><span class="mini-bar-dot" style="background:${color}"></span>${safe(tier)}</div><div class="mini-bar-track"><div class="mini-bar-fill" style="width:${width}%"></div></div><div class="mini-bar-value">${count} • ${pct}%</div></div>`;
    }).join('');
    host.innerHTML = `<div class="mini-bar-chart portfolio-chart">${rows}</div>`;
  }

  if(countEl){
    countEl.textContent = totalCount || 0;
  }
}
