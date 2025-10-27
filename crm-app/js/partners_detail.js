import { canonicalStage as canonicalStageExport } from './pipeline/constants.js';
const NONE=typeof window!=='undefined'&&window?.NONE_PARTNER_ID?String(window.NONE_PARTNER_ID):'00000000-0000-none-partner-000000000000';
const LABELS={'long-shot':'Long Shot',application:'Application',preapproved:'Pre-Approved',processing:'Processing',underwriting:'Underwriting',approved:'Approved','cleared-to-close':'Clear to Close',funded:'Funded','post-close':'Post-Close',nurture:'Nurture',lost:'Lost',denied:'Denied'};
const FILTERS=[{key:'open',label:'Open'},{key:'closing',label:'Closing Soon'},{key:'funded',label:'Funded'}];
const COLS=[{key:'name',label:'Contact',sortable:true},{key:'stage',label:'Status'},{key:'amount',label:'Amount',sortable:true},{key:'updated',label:'Updated',sortable:true}];
const DAY_MS=86_400_000,fmtMoney=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}),fmtNumber=new Intl.NumberFormat('en-US',{maximumFractionDigits:0}),fmtDate=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'});
const CLOSED=new Set(['funded','post-close','lost','denied']),CLOSING=new Set(['approved','cleared-to-close']);
const panels=new WeakMap(),active=new Set();
const esc=(value)=>String(value??'').replace(/[&<>]/g,(ch)=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]||ch));
const canon=(value)=>{const useGlobal=typeof window!=='undefined'&&typeof window.canonicalizeStage==='function';const raw=useGlobal?window.canonicalizeStage(value):canonicalStageExport(value);return String((raw??value)||'').trim().toLowerCase().replace(/_/g,'-');};
const num=(value)=>{const n=Number(value);return Number.isFinite(n)?n:0;};
const ts=(value)=>{if(value==null||value==='')return null;if(typeof value==='number'&&Number.isFinite(value))return value;if(value instanceof Date){const t=value.getTime();return Number.isFinite(t)?t:null;}const parsed=Date.parse(value);return Number.isNaN(parsed)?null:parsed;};
const nameOf=(contact)=>{const parts=[contact.first??contact.firstName,contact.last??contact.lastName].map((part)=>String(part||'').trim()).filter(Boolean);if(parts.length)return parts.join(' ');const fallback=String(contact.name??contact.fullName??contact.email??contact.company??'').trim();return fallback||'Untitled Contact';};
const scope=()=>typeof window!=='undefined'?window:globalThis;
const ensureDb=async()=>{try{const g=scope(),open=g?.openDB;if(typeof open==='function')await open();}catch(err){console&&console.warn&&console.warn('partners_detail: openDB failed',err);}};
const fetchContacts=async(partnerId)=>{if(!partnerId||partnerId===NONE)return[];await ensureDb();const getter=scope()?.dbGetAll;if(typeof getter!=='function')return[];try{const list=await getter('contacts');return Array.isArray(list)?list:[];}catch(err){console&&console.warn&&console.warn('partners_detail: dbGetAll failed',err);return[];}};
const startTs=(contact)=>{let created=ts(contact.createdAt);if(created)return created;const map=contact.stageEnteredAt;if(map&&typeof map==='object'){for(const key of['application','preapproved','processing','underwriting','approved']){const value=ts(map[key]);if(value)return value;}for(const value of Object.values(map)){const parsed=ts(value);if(parsed)return parsed;}}return ts(map);};
const mapRow=(contact)=>{const stageKey=canon(contact.stage)||'application';const amount=num(contact.loanAmount??contact.amount??0);const updatedTs=ts(contact.updatedAt)??ts(contact.stageUpdatedAt)??ts(contact.modifiedAt)??ts(contact.createdAt)??Date.now();const fundedTs=ts(contact.fundedDate??contact.fundedAt??contact.closedAt);const createdTs=startTs(contact);const duration=fundedTs&&createdTs?Math.max(0,fundedTs-createdTs):null;return{id:String(contact.id||''),name:nameOf(contact),stageKey,stageLabel:LABELS[stageKey]||LABELS[contact.stage]||(contact.stage?String(contact.stage):'Application'),amount,updatedTs:updatedTs||0,updatedLabel:updatedTs?fmtDate.format(new Date(updatedTs)):'—',fundedTs,createdTs,duration,isFunded:stageKey==='funded',isClosing:CLOSING.has(stageKey),isOpen:!CLOSED.has(stageKey)&&stageKey!=='nurture',contact};};
const loadRows=async(partnerId)=>{const list=await fetchContacts(partnerId);return list.filter((contact)=>{if(!contact)return false;const buyer=contact.buyerPartnerId==null?'':String(contact.buyerPartnerId);const listing=contact.listingPartnerId==null?'':String(contact.listingPartnerId);return buyer===partnerId||listing===partnerId;}).map(mapRow);};
const countRows=(rows)=>{const counts={all:rows.length,open:0,closing:0,funded:0};rows.forEach((row)=>{if(row.isOpen)counts.open+=1;if(row.isClosing)counts.closing+=1;if(row.isFunded)counts.funded+=1;});return counts;};
const sorters={name:(a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:'base'}),amount:(a,b)=>(a.amount||0)-(b.amount||0),updated:(a,b)=>(a.updatedTs||0)-(b.updatedTs||0)};
const applyFilter=(rows,filter)=>filter==='open'?rows.filter((row)=>row.isOpen):filter==='closing'?rows.filter((row)=>row.isClosing):filter==='funded'?rows.filter((row)=>row.isFunded):rows.slice();
const applySort=(rows,key,dir)=>{const cmp=sorters[key]||sorters.updated,factor=dir==='asc'?1:-1;return rows.slice().sort((a,b)=>{const base=cmp(a,b);return base===0?sorters.name(a,b)*factor:base*factor;});};
const renderKpis=(state)=>{const funded=state.rows.filter((row)=>row.isFunded),open=state.rows.filter((row)=>row.isOpen);const fundedVolume=funded.reduce((sum,row)=>sum+row.amount,0);const closedDeals=funded.length,activeDeals=open.length;const totalDays=funded.reduce((sum,row)=>row.duration?sum+row.duration/DAY_MS:sum,0);const avgDays=closedDeals?Math.round(totalDays/closedDeals):null;const cards=[{label:'Funded Volume',value:fundedVolume?fmtMoney.format(fundedVolume):fmtMoney.format(0)},{label:'Active Deals',value:fmtNumber.format(activeDeals)},{label:'Closed Deals',value:fmtNumber.format(closedDeals)},{label:'Avg Time to Fund',value:avgDays!=null?`${fmtNumber.format(avgDays)} days`:'—'}];state.kpis.innerHTML=cards.map((card)=>`<div class="card" data-qa="partner-kpi"><span class="muted">${esc(card.label)}</span><span class="kval">${esc(card.value)}</span></div>`).join('');};
const renderFilters=(state,visible)=>{FILTERS.forEach((filter)=>{const button=state.filterButtons.get(filter.key);if(!button)return;const badge=button.querySelector('.chip-count');const count=state.counts[filter.key]||0;if(badge)badge.textContent=fmtNumber.format(count);button.classList.toggle('active',state.filter===filter.key);button.disabled=count===0&&state.filter!==filter.key;});if(state.filterLabel){const total=state.counts.all||0;if(state.filter==='all'){state.filterLabel.textContent=total?`Showing ${fmtNumber.format(total)} referred ${total===1?'contact':'contacts'}`:'No referred contacts yet.';}else{const label=FILTERS.find((item)=>item.key===state.filter)?.label||'Filtered';state.filterLabel.textContent=`${fmtNumber.format(visible)} ${label.toLowerCase()} (${fmtNumber.format(total)} total)`;}}};
const updateSummary=(state)=>{const total=state.counts.all||0,pipeline=state.rows.filter((row)=>row.isOpen).reduce((sum,row)=>sum+row.amount,0);if(state.summary)state.summary.textContent=total?`${fmtNumber.format(total)} referred ${total===1?'contact':'contacts'} · ${fmtMoney.format(pipeline)} pipeline`:'No linked customers yet.';if(state.summaryMetric){if(total){state.summaryMetric.textContent=fmtNumber.format(total);state.summaryMetric.dataset.count=String(total);}else{state.summaryMetric.textContent='—';delete state.summaryMetric.dataset.count;}}};
const bindRow=(row)=>{if(row.__partnerDetailBound)return;row.__partnerDetailBound=true;const id=row.getAttribute('data-contact-id');const openContact=()=>{if(!id)return;try{const g=scope();if(g&&typeof g.renderContactModal==='function')g.renderContactModal(id);else document.dispatchEvent(new CustomEvent('contact:open',{detail:{id}}));}catch(err){console&&console.warn&&console.warn('partners_detail: open contact failed',err);}};row.addEventListener('click',openContact);row.addEventListener('keydown',(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openContact();}});};
const renderTable=(state)=>{const filtered=applyFilter(state.rows,state.filter),sorted=applySort(filtered,state.sortKey,state.sortDir);const markup=sorted.length?sorted.map((row)=>`<tr tabindex="0" data-contact-id="${esc(row.id)}" data-qa="partner-ref-row"><td>${esc(row.name)}</td><td>${esc(row.stageLabel)}</td><td class="amount">${esc(row.amount?fmtMoney.format(row.amount):'—')}</td><td class="updated">${esc(row.updatedLabel)}</td></tr>`).join(''):`<tr class="empty"><td colspan="${COLS.length}">No contacts match this filter.</td></tr>`;state.tbody.innerHTML=markup;state.tbody.querySelectorAll('tr[data-contact-id]').forEach(bindRow);renderFilters(state,sorted.length);updateSummary(state);console.log('REFERRAL_SUMMARY',{kpis:state.root.querySelectorAll('[data-qa="partner-kpi"]').length,rows:state.tbody.querySelectorAll('[data-qa="partner-ref-row"]').length,filters:state.root.querySelectorAll('[data-qa="preset-filter"]').length});};
const updateSortHeaders=(state)=>{state.headers.forEach((node,key)=>{const activeSort=state.sortKey===key;node.classList.toggle('is-sorted',activeSort);if(activeSort)node.setAttribute('data-sort',state.sortDir);else node.removeAttribute('data-sort');});};
const setSort=(state,key)=>{if(!key)return;if(state.sortKey===key)state.sortDir=state.sortDir==='desc'?'asc':'desc';else{state.sortKey=key;state.sortDir=key==='name'?'asc':'desc';}updateSortHeaders(state);renderTable(state);};
const setFilter=(state,key)=>{state.filter=state.filter===key?'all':key;renderTable(state);};
const createPanel=(dialog,wrap)=>{const previous=panels.get(dialog);const prevObserver=previous?.observer||null;if(previous)active.delete(previous);wrap.innerHTML='';const root=document.createElement('div');root.className='partner-referral-detail';root.dataset.role='partner-referral-root';const kpis=document.createElement('div');kpis.className='partner-referral-kpis';root.appendChild(kpis);const filterShell=document.createElement('div');filterShell.className='partner-referral-filters';const chips=document.createElement('div');chips.className='partner-referral-chips';filterShell.appendChild(chips);const filterLabel=document.createElement('span');filterLabel.className='muted';filterLabel.dataset.role='filter-label';filterShell.appendChild(filterLabel);root.appendChild(filterShell);const tableWrap=document.createElement('div');tableWrap.className='partner-referral-table';const table=document.createElement('table');const thead=document.createElement('thead');const headRow=document.createElement('tr');const headers=new Map();const state={dialog,wrap,root,kpis,tbody:document.createElement('tbody'),headers,filterButtons:new Map(),filterLabel,summary:dialog?.querySelector?.('#partner-linked-summary')||null,summaryMetric:dialog?.querySelector?.('#p-summary-linked')||null,rows:[],counts:{all:0,open:0,closing:0,funded:0},filter:'all',sortKey:'updated',sortDir:'desc',partnerId:'',observer:prevObserver};COLS.forEach((col)=>{const th=document.createElement('th');th.textContent=col.label;th.dataset.key=col.key;if(col.sortable){th.tabIndex=0;th.addEventListener('click',()=>setSort(state,col.key));th.addEventListener('keydown',(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSort(state,col.key);}});}headers.set(col.key,th);headRow.appendChild(th);});thead.appendChild(headRow);table.appendChild(thead);table.appendChild(state.tbody);tableWrap.appendChild(table);root.appendChild(tableWrap);FILTERS.forEach((filter)=>{const button=document.createElement('button');button.type='button';button.className='filter-chip';button.dataset.filter=filter.key;button.dataset.qa='preset-filter';button.innerHTML=`${esc(filter.label)} <span class="chip-count">0</span>`;button.addEventListener('click',()=>setFilter(state,filter.key));state.filterButtons.set(filter.key,button);chips.appendChild(button);});wrap.appendChild(root);wrap.dataset.partnerReferralReady='1';panels.set(dialog,state);active.add(state);updateSortHeaders(state);return state;};
const ensurePanel=(detail,force=false)=>{const dialog=detail?.dialog||null;if(!dialog)return null;const wrap=dialog.querySelector('#partner-linked');if(!wrap)return null;let state=panels.get(dialog);const needsRecreate=force||!state||state.wrap!==wrap||!state.root?.isConnected||!wrap.contains(state.root)||wrap.dataset.partnerReferralReady!=='1';if(needsRecreate)state=createPanel(dialog,wrap);return state;};
const refresh=async(state,partnerId,forceFetch=false)=>{if(!state)return;let nextState=state;if(!nextState.root?.isConnected||!nextState.wrap?.isConnected||!nextState.wrap.contains(nextState.root)){nextState=ensurePanel({dialog:nextState.dialog},true);forceFetch=true;}if(!nextState)return;const key=String(partnerId||'');if(forceFetch||nextState.partnerId!==key){nextState.partnerId=key;nextState.rows=key?await loadRows(key):[];}nextState.counts=countRows(nextState.rows);renderKpis(nextState);renderTable(nextState);};
const observeLegacy=(detail)=>{const dialog=detail?.dialog||null;if(!dialog)return;let wrap=dialog.querySelector('#partner-linked');if(!wrap)return;const state=ensurePanel(detail);if(!state)return;if(state.observer&&typeof state.observer.disconnect==='function')state.observer.disconnect();const observer=new MutationObserver(()=>{const latest=dialog.querySelector('#partner-linked');if(latest&&latest!==wrap){wrap=latest;observer.disconnect();observer.observe(wrap,{childList:true});}if(!wrap)return;const current=panels.get(dialog);if(current&&wrap.contains(current.root)&&current.root.isConnected)return;const refreshed=ensurePanel(detail,true);if(!refreshed)return;refreshed.observer=observer;refresh(refreshed,detail?.record?.id,true);});observer.observe(wrap,{childList:true});state.observer=observer;};
if(typeof document!=='undefined'){document.addEventListener('partner:modal:ready',(event)=>{const detail=event?.detail||{};if(!detail?.record?.id){const state=ensurePanel(detail);if(state)refresh(state,'',true);return;}observeLegacy(detail);});document.addEventListener('app:data:changed',()=>{active.forEach((state)=>{if(!state?.dialog?.isConnected)return;refresh(state,state.partnerId,true);});},{passive:true});}
import { stageLabelFromKey, stageKeyFromLabel } from './pipeline/stages.js';
import { canonicalStage } from './pipeline/constants.js';
import { openContactModal } from './contacts.js';

const NONE_PARTNER_ID = '00000000-0000-none-partner-000000000000';
const STAGE_ORDER = Object.freeze({ lost: -1, denied: -1, 'long-shot': 0, longshot: 0, application: 1, preapproved: 2, 'pre-approved': 2, processing: 3, underwriting: 4, approved: 5, 'cleared-to-close': 6, 'clear-to-close': 6, ctc: 6, funded: 7, won: 7 });
const fmt = {
  text: (value) => String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
  number: (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return '0';
    try { return n.toLocaleString(); }
    catch (_err) { return String(n); }
  },
  money: (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n === 0) return '$0';
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n); }
    catch (_err) { return `$${Math.round(n)}`; }
  },
  date: (value) => {
    const ts = toTimestamp(value);
    if (ts == null) return '—';
    try { return new Date(ts).toISOString().slice(0, 10); }
    catch (_err) { return '—'; }
  }
};
const state = { partnerId: '', rows: [], filter: '', stage: 'all', sortKey: 'updated', sortDir: 'desc', dom: null, loading: false };

const toTimestamp = (value) => {
  if (value instanceof Date) { const t = value.getTime(); return Number.isNaN(t) ? null : t; }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) { const parsed = Date.parse(value); return Number.isNaN(parsed) ? null : parsed; }
  return null;
};

const deriveRole = (contact, partnerId) => {
  const id = String(partnerId || '');
  const buyer = contact && contact.buyerPartnerId != null ? String(contact.buyerPartnerId) : '';
  const listing = contact && contact.listingPartnerId != null ? String(contact.listingPartnerId) : '';
  if (id && buyer === id && listing === id) return 'Buyer & Listing';
  if (id && buyer === id) return 'Buyer';
  if (id && listing === id) return 'Listing';
  if (contact && contact.partnerRole) return String(contact.partnerRole);
  return 'Referral';
};

const deriveName = (contact) => {
  if (!contact) return '—';
  const first = contact.first || contact.givenName || '';
  const last = contact.last || contact.surname || '';
  const combined = `${first} ${last}`.trim();
  if (combined) return combined;
  if (contact.name) return String(contact.name);
  if (contact.title) return String(contact.title);
  return contact.email || contact.phone || '—';
};

const rowFrom = (contact, partnerId) => {
  const id = contact && contact.id != null ? String(contact.id) : '';
  if (!id) return null;
  const stageKey = stageKeyFromLabel(contact && (contact.stage || contact.status || ''));
  const stageLabel = stageLabelFromKey(stageKey);
  const canonical = canonicalStage(stageKey) || canonicalStage(contact && contact.stage) || '';
  const amount = Number(contact && (contact.loanAmount ?? contact.amount) ?? 0) || 0;
  const lastActivity = toTimestamp(contact && (contact.updatedAt ?? contact.lastContact ?? contact.fundedDate ?? contact.createdAt));
  const role = deriveRole(contact, partnerId);
  const name = deriveName(contact);
  const search = [name, stageLabel, role, contact && contact.loanType, contact && contact.referredBy].filter(Boolean).join(' ').toLowerCase();
  const key = String(stageKey).toLowerCase();
  const canonicalKey = String(canonical).toLowerCase();
  return {
    id,
    name,
    nameSort: name.toLowerCase(),
    stageKey,
    stageLabel,
    canonical,
    stageOrder: STAGE_ORDER[key] ?? STAGE_ORDER[canonicalKey] ?? 0,
    amount,
    role,
    roleSort: role.toLowerCase(),
    lastActivity: lastActivity == null ? -Infinity : lastActivity,
    lastActivityLabel: fmt.date(lastActivity),
    search
  };
};

const collectRows = (partnerId, contacts) => {
  if (!partnerId || !Array.isArray(contacts)) return [];
  const target = String(partnerId);
  return contacts
    .filter((contact) => {
      if (!contact) return false;
      const buyer = contact.buyerPartnerId != null ? String(contact.buyerPartnerId) : '';
      const listing = contact.listingPartnerId != null ? String(contact.listingPartnerId) : '';
      if (!buyer && !listing) return false;
      if (buyer === NONE_PARTNER_ID || listing === NONE_PARTNER_ID) return false;
      return buyer === target || listing === target;
    })
    .map((contact) => rowFrom(contact, target))
    .filter(Boolean);
};

const ensureDom = (root) => {
  if (!root || typeof root.querySelector !== 'function') return null;
  const panel = root.querySelector('.partner-panel[data-panel="linked"]');
  if (!panel) return null;
  let section = panel.querySelector('#partner-referral-section');
  if (!section) {
    const kpiBlocks = [['total', 'Referred Deals'], ['active', 'Active Pipeline'], ['funded', 'Funded Volume'], ['win-rate', 'Win Rate']]
      .map(([key, label]) => `<div class="summary-metric" data-kpi="${key}"><span class="metric-label">${label}</span><span class="metric-value">—</span></div>`)
      .join('');
    section = document.createElement('section');
    section.id = 'partner-referral-section';
    section.className = 'partner-referral-section';
    section.innerHTML = `
      <h5 class="section-subhead">Referral Performance</h5>
      <div class="summary-metrics partner-referral-kpis">${kpiBlocks}</div>
      <div class="referral-controls" data-role="partner-referral-controls">
        <input type="search" data-role="partner-referral-filter" placeholder="Filter referrals" aria-label="Filter referrals">
        <select data-role="partner-referral-stage" aria-label="Filter by referral status">
          <option value="all">All statuses</option>
          <option value="active">Active pipeline</option>
          <option value="won">Won / Funded</option>
          <option value="lost">Lost</option>
        </select>
      </div>
      <div class="referral-table-wrap">
        <table class="table partner-referral-table">
          <thead>
            <tr>
              <th><button class="sort-btn" data-sort-key="name" type="button">Borrower <span aria-hidden="true" class="sort-icon">↕</span></button></th>
              <th><button class="sort-btn" data-sort-key="stage" type="button">Stage <span aria-hidden="true" class="sort-icon">↕</span></button></th>
              <th><button class="sort-btn" data-sort-key="amount" type="button">Loan Amount <span aria-hidden="true" class="sort-icon">↕</span></button></th>
              <th><button class="sort-btn" data-sort-key="role" type="button">Role <span aria-hidden="true" class="sort-icon">↕</span></button></th>
              <th><button class="sort-btn" data-sort-key="updated" type="button">Last Activity <span aria-hidden="true" class="sort-icon">↕</span></button></th>
            </tr>
          </thead>
          <tbody data-role="partner-referral-rows"></tbody>
        </table>
        <div class="muted empty" data-role="partner-referral-empty" hidden>No referrals recorded for this partner yet.</div>
      </div>`;
    const anchor = panel.querySelector('#partner-linked-summary');
    if (anchor && anchor.parentNode === panel) panel.insertBefore(section, anchor);
    else panel.appendChild(section);
  }
  const dom = {
    section,
    kpis: {
      total: section.querySelector('[data-kpi="total"] .metric-value'),
      active: section.querySelector('[data-kpi="active"] .metric-value'),
      funded: section.querySelector('[data-kpi="funded"] .metric-value'),
      winRate: section.querySelector('[data-kpi="win-rate"] .metric-value')
    },
    filter: section.querySelector('[data-role="partner-referral-filter"]'),
    stage: section.querySelector('[data-role="partner-referral-stage"]'),
    table: section.querySelector('[data-role="partner-referral-rows"]'),
    empty: section.querySelector('[data-role="partner-referral-empty"]'),
    sortButtons: Array.from(section.querySelectorAll('button[data-sort-key]'))
  };
  if (!section.__partnerReferralWired) {
    if (dom.filter) dom.filter.addEventListener('input', onFilter);
    if (dom.stage) dom.stage.addEventListener('change', onStageChange);
    if (dom.table) dom.table.addEventListener('click', onRowClick);
    dom.sortButtons.forEach((btn) => btn.addEventListener('click', onSortClick));
    section.__partnerReferralWired = true;
  }
  return dom;
};

const setLoading = (flag) => {
  state.loading = flag;
  if (!state.dom) return;
  if (flag) {
    if (state.dom.table) state.dom.table.innerHTML = '';
    if (state.dom.empty) {
      state.dom.empty.textContent = 'Loading referrals…';
      state.dom.empty.hidden = false;
    }
  } else if (state.dom.empty && state.dom.empty.textContent === 'Loading referrals…') {
    state.dom.empty.textContent = 'No referrals recorded for this partner yet.';
  }
};

const metrics = (rows) => {
  const funded = rows.filter((row) => row.canonical === 'won');
  const lost = rows.filter((row) => row.canonical === 'lost');
  const active = rows.filter((row) => row.canonical !== 'won' && row.canonical !== 'lost');
  const fundedVolume = funded.reduce((sum, row) => sum + (row.amount || 0), 0);
  const denominator = funded.length + lost.length;
  return { total: rows.length, active: active.length, funded: fundedVolume, winRate: denominator ? Math.round((funded.length / denominator) * 100) : null };
};

const updateKpis = () => {
  if (!state.dom) return;
  const { total, active, funded, winRate } = metrics(state.rows);
  if (state.dom.kpis.total) state.dom.kpis.total.textContent = fmt.number(total);
  if (state.dom.kpis.active) state.dom.kpis.active.textContent = fmt.number(active);
  if (state.dom.kpis.funded) state.dom.kpis.funded.textContent = fmt.money(funded);
  if (state.dom.kpis.winRate) state.dom.kpis.winRate.textContent = winRate == null ? '—' : `${winRate}%`;
};

const filteredRows = () => state.rows.filter((row) => {
  if (state.filter && !row.search.includes(state.filter)) return false;
  if (state.stage === 'active') return row.canonical !== 'won' && row.canonical !== 'lost';
  if (state.stage === 'won') return row.canonical === 'won';
  if (state.stage === 'lost') return row.canonical === 'lost';
  return true;
});

const sortedRows = (rows) => {
  const dir = state.sortDir === 'asc' ? 1 : -1;
  return rows.slice().sort((a, b) => {
    let av;
    let bv;
    switch (state.sortKey) {
      case 'name': av = a.nameSort; bv = b.nameSort; break;
      case 'stage': av = a.stageOrder; bv = b.stageOrder; if (av === bv) { av = a.nameSort; bv = b.nameSort; } break;
      case 'amount': av = a.amount || 0; bv = b.amount || 0; break;
      case 'role': av = a.roleSort; bv = b.roleSort; break;
      default: av = a.lastActivity; bv = b.lastActivity; break;
    }
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
};

const updateSortIndicators = () => {
  if (!state.dom) return;
  state.dom.sortButtons.forEach((btn) => {
    const key = btn.dataset.sortKey || '';
    const icon = btn.querySelector('.sort-icon');
    if (key === state.sortKey) {
      btn.dataset.sortActive = '1';
      btn.dataset.sortDir = state.sortDir;
      if (icon) icon.textContent = state.sortDir === 'asc' ? '↑' : '↓';
    } else {
      delete btn.dataset.sortActive;
      delete btn.dataset.sortDir;
      if (icon) icon.textContent = '↕';
    }
  });
};

const updateTable = () => {
  if (!state.dom) return;
  const rows = sortedRows(filteredRows());
  updateKpis();
  updateSortIndicators();
  if (!state.dom.table) return;
  if (!rows.length) {
    state.dom.table.innerHTML = '';
    if (state.dom.empty) {
      state.dom.empty.textContent = state.loading ? 'Loading referrals…' : 'No referrals recorded for this partner yet.';
      state.dom.empty.hidden = false;
    }
    return;
  }
  state.dom.table.innerHTML = rows.map((row) => {
    const loan = row.amount ? fmt.money(row.amount) : '—';
    return `<tr data-contact-id="${fmt.text(row.id)}" data-stage="${fmt.text(row.stageKey)}"><td><span class="link">${fmt.text(row.name)}</span></td><td>${fmt.text(row.stageLabel)}</td><td>${fmt.text(loan)}</td><td>${fmt.text(row.role)}</td><td>${fmt.text(row.lastActivityLabel)}</td></tr>`;
  }).join('');
  if (state.dom.empty) state.dom.empty.hidden = true;
};

const loadRows = async (partnerId) => {
  if (!partnerId) {
    state.rows = [];
    updateTable();
    return;
  }
  setLoading(true);
  try {
    if (typeof openDB === 'function') await openDB();
    const contacts = typeof dbGetAll === 'function' ? await dbGetAll('contacts') : [];
    state.rows = collectRows(partnerId, contacts);
  } catch (err) {
    state.rows = [];
    try { if (console && typeof console.warn === 'function') console.warn('[partners:detail] load failed', err); }
    catch (_err) {}
  } finally {
    setLoading(false);
    updateTable();
  }
};

const onFilter = (event) => {
  state.filter = String(event && event.target && event.target.value ? event.target.value : '').trim().toLowerCase();
  updateTable();
};

const onStageChange = (event) => {
  state.stage = String(event && event.target && event.target.value ? event.target.value : 'all');
  updateTable();
};

const onSortClick = (event) => {
  const btn = event && event.currentTarget ? event.currentTarget : (event && event.target && event.target.closest('button[data-sort-key]'));
  if (!btn) return;
  event.preventDefault();
  const key = btn.dataset.sortKey || 'updated';
  if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
  else { state.sortKey = key; state.sortDir = key === 'name' ? 'asc' : 'desc'; }
  updateTable();
};

const onRowClick = (event) => {
  const row = event && event.target ? event.target.closest('tr[data-contact-id]') : null;
  if (!row) return;
  event.preventDefault();
  const id = row.getAttribute('data-contact-id');
  if (!id || typeof openContactModal !== 'function') return;
  try { openContactModal(id, { sourceHint: 'partners:detail-referrals', trigger: row }); }
  catch (err) { try { if (console && typeof console.warn === 'function') console.warn('[partners:detail] openContactModal failed', err); }
    catch (_err) {} }
};

const resetState = () => {
  state.rows = [];
  state.filter = '';
  state.stage = 'all';
  state.sortKey = 'updated';
  state.sortDir = 'desc';
  if (state.dom) {
    if (state.dom.filter) state.dom.filter.value = '';
    if (state.dom.stage) state.dom.stage.value = 'all';
    if (state.dom.table) state.dom.table.innerHTML = '';
    if (state.dom.empty) { state.dom.empty.textContent = 'No referrals recorded for this partner yet.'; state.dom.empty.hidden = true; }
  }
};

const handleReady = (event) => {
  const detail = event && event.detail ? event.detail : {};
  const dialog = detail.dialog || null;
  const record = detail.record || null;
  const partnerId = record && record.id != null ? String(record.id) : '';
  if (!dialog || !partnerId) return;
  state.dom = ensureDom(dialog);
  if (!state.dom) return;
  state.partnerId = partnerId;
  state.filter = '';
  state.stage = 'all';
  state.sortKey = 'updated';
  state.sortDir = 'desc';
  if (state.dom.filter) state.dom.filter.value = '';
  if (state.dom.stage) state.dom.stage.value = 'all';
  if (!dialog.__partnerReferralCleanup) {
    const cleanup = () => { dialog.__partnerReferralCleanup = null; state.partnerId = ''; resetState(); };
    try { dialog.addEventListener('close', cleanup, { once: true }); }
    catch (_err) { dialog.addEventListener('close', cleanup); }
    dialog.__partnerReferralCleanup = cleanup;
  }
  loadRows(partnerId);
};

const handleDataChanged = (event) => {
  if (!state.partnerId) return;
  const detail = event && event.detail ? event.detail : {};
  const scope = detail.scope ? String(detail.scope).toLowerCase() : '';
  if (!scope || scope === 'contacts' || scope === 'partners' || scope === 'pipeline') loadRows(state.partnerId);
};

(function install(){
  if (typeof document === 'undefined') return;
  if (!document.__PARTNER_DETAIL_READY__) {
    document.addEventListener('partner:modal:ready', handleReady);
    document.addEventListener('app:data:changed', handleDataChanged);
    document.__PARTNER_DETAIL_READY__ = true;
  }
})();

export async function init(){
  if (state.partnerId) await loadRows(state.partnerId);
}

export default { init };
