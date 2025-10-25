const FALLBACK_SAFE = (value) => String(value == null ? '' : value).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch] || ch));
const FALLBACK_ATTR = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
const FALLBACK_MONEY = (value) => {
  const numeric = Number(value) || 0;
  try{
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(numeric);
  }catch (_err){
    return `$${numeric.toFixed(0)}`;
  }
};
const FALLBACK_INITIALS = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return '—';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] || '' : '';
  const value = (first + last).toUpperCase();
  return value || first.toUpperCase() || '—';
};
const FALLBACK_NORMALIZE = (value) => String(value == null ? '' : value).trim().toLowerCase();

function ensureSafe(fn){ return typeof fn === 'function' ? fn : FALLBACK_SAFE; }
function ensureAttr(fn){ return typeof fn === 'function' ? fn : FALLBACK_ATTR; }
function ensureMoney(fn){ return typeof fn === 'function' ? fn : FALLBACK_MONEY; }
function ensureInitials(fn){ return typeof fn === 'function' ? fn : FALLBACK_INITIALS; }
function ensureNormalize(fn){ return typeof fn === 'function' ? fn : FALLBACK_NORMALIZE; }

export function renderReferralLeadersWidget(options = {}){
  const host = options.host || null;
  if(!host) return;
  const contacts = Array.isArray(options.contacts) ? options.contacts : [];
  const partners = Array.isArray(options.partners) ? options.partners : [];
  const safe = ensureSafe(options.safe);
  const attr = ensureAttr(options.attr);
  const money = ensureMoney(options.money);
  const initials = ensureInitials(options.initials);
  const normalizeStatus = ensureNormalize(options.normalizeStatus);
  const stageLabels = options.stageLabels && typeof options.stageLabels === 'object' ? options.stageLabels : {};

  const partnerMap = new Map();
  partners.forEach(partner => {
    if(!partner) return;
    const id = partner.id == null ? null : String(partner.id);
    if(!id) return;
    partnerMap.set(id, partner);
  });

  const NONE_PARTNER_ID = '00000000-0000-none-partner-000000000000';
  const referralStats = new Map();
  contacts.forEach(contact => {
    if(!contact) return;
    const buyerId = contact.buyerPartnerId == null ? '' : String(contact.buyerPartnerId);
    const listingId = contact.listingPartnerId == null ? '' : String(contact.listingPartnerId);
    const partnerId = buyerId || listingId;
    if(!partnerId || partnerId === NONE_PARTNER_ID) return;
    const entry = referralStats.get(partnerId) || { count: 0, volume: 0, contacts: [] };
    entry.count += 1;
    entry.volume += Number(contact.loanAmount || 0) || 0;
    entry.contacts.push(contact);
    referralStats.set(partnerId, entry);
  });

  const top3 = Array.from(referralStats.entries())
    .sort((a, b) => (b[1]?.count || 0) - (a[1]?.count || 0))
    .slice(0, 3);

  if(!top3.length){
    host.innerHTML = '<li class="empty">Recruit or tag partners to surface leaders.</li>';
    return;
  }

  const totalRef = Array.from(referralStats.values()).reduce((sum, entry) => sum + (entry.count || 0), 0) || 0;

  const items = top3.map(([partnerId, stat]) => {
    const partner = partnerMap.get(partnerId) || {};
    const share = totalRef ? Math.round(((stat.count || 0) / totalRef) * 100) : 0;
    const tier = partner.tier ? `<span class="insight-tag light">${safe(partner.tier)}</span>` : '';
    const details = [partner.company, partner.phone, partner.email].filter(Boolean).map(value => safe(value)).join(' • ');
    const stageCounts = (stat.contacts || []).reduce((memo, contact) => {
      const key = normalizeStatus(contact && contact.stage);
      if(!key) return memo;
      memo[key] = (memo[key] || 0) + 1;
      return memo;
    }, {});
    const stageEntry = Object.entries(stageCounts).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0];
    const focusLabel = stageEntry ? (stageLabels[stageEntry[0]] || stageEntry[0]) : '';
    const focusLine = stageEntry ? `<div class="insight-sub">Focus: ${safe(focusLabel)} (${stageEntry[1]})</div>` : '';
    const volumeLine = stat.volume ? `<div class="insight-sub">Loan Volume: ${safe(money(stat.volume))}</div>` : '';
    const detailLine = details ? `<div class="insight-sub">${details}</div>` : '';
    const partnerAttr = attr(partnerId);
    const widgetAttrs = [`data-widget="top-partners"`];
    if(partnerAttr) widgetAttrs.push(`data-partner-id="${partnerAttr}"`);
    return `<li role="button" ${widgetAttrs.join(' ')}>
      <div class="list-main">
        <span class="insight-avatar">${safe(initials(partner.name || ''))}</span>
        <div>
          <div class="insight-title">${safe(partner.name || '—')}</div>
          <div class="insight-sub">${stat.count || 0} referrals • ${share}% share</div>
          ${focusLine}
          ${volumeLine}
          ${detailLine}
        </div>
      </div>
      <div class="insight-meta">${tier}</div>
    </li>`;
  }).join('');

  host.innerHTML = items;
}
