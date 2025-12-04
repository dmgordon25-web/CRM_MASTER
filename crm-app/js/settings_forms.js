import { STR, text } from './ui/strings.js';
import { normalizeSimpleModeSettings, SIMPLE_MODE_DEFAULTS } from './editors/contact_fields.js';
import {
  DASHBOARD_WIDGETS,
  normalizeDashboardConfig,
  readDashboardConfig,
  writeDashboardConfig,
  isTodayWidget
} from './dashboard/config.js';
import { getUiMode, onUiModeChanged, setUiMode } from './ui/ui_mode.js';
import { getHomeViewPreference, normalizeHomeView, setHomeViewPreference } from './ui/home_view.js';
import { getRenderer } from './app_services.js';
const __STR_FALLBACK__ = (window.STR && typeof window.STR === 'object') ? window.STR : {};
function __textFallback__(k){ try { return (STR && STR[k]) || (__STR_FALLBACK__[k]) || k; } catch (_) { return k; } }

(function(){
  if(window.__INIT_FLAGS__ && window.__INIT_FLAGS__.settings_forms) return;
  window.__INIT_FLAGS__ = window.__INIT_FLAGS__ || {};
  window.__INIT_FLAGS__.settings_forms = true;

  function toastSafe(message){
    try{
      if(typeof window.toast === 'function') window.toast(message);
      else console.log(message);
    }catch (_err) { console.log(message); }
  }

  function ensureSettings(){
    if(window.Settings && typeof window.Settings.get === 'function') return true;
    console.warn('Settings API unavailable');
    return false;
  }

  (function injectSettingsTidy(){
    if(typeof document === 'undefined') return;
    const SETTINGS_STYLE_ID = 'settings-inline-style';
    const SETTINGS_STYLE_ORIGIN = 'crm:settings:inline';
    const SETTINGS_STYLE_TEXT = '#dashboard-widget-list{ width:100%; overflow:auto; }\n#dashboard-widget-list table{ width:100%; border-collapse:collapse; }';

    function ensureSettingsStyle(){
      const head = document.head || document.querySelector('head') || document.documentElement;
      if(!head || typeof head.appendChild !== 'function') return null;
      const selector = `style[data-origin="${SETTINGS_STYLE_ORIGIN}"]`;
      let style = typeof document.querySelector === 'function' ? document.querySelector(selector) : null;
      if(!style && typeof document.getElementById === 'function'){
        style = document.getElementById(SETTINGS_STYLE_ID);
      }
      if(!style){
        style = document.createElement('style');
        style.id = SETTINGS_STYLE_ID;
        style.setAttribute('data-origin', SETTINGS_STYLE_ORIGIN);
        head.appendChild(style);
      }else if(style.getAttribute && style.getAttribute('data-origin') !== SETTINGS_STYLE_ORIGIN){
        try{ style.setAttribute('data-origin', SETTINGS_STYLE_ORIGIN); }
        catch(_err){}
      }
      if(style.textContent !== SETTINGS_STYLE_TEXT){
        style.textContent = SETTINGS_STYLE_TEXT;
      }
      return style;
    }

    function apply(){
      ensureSettingsStyle();
      const focusCard = document.querySelector('.settings-panel[data-panel="dashboard"] .card:nth-of-type(2)');
      if(focusCard) focusCard.style.display = 'none';
    }
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', apply, { once: true });
    }else{
      apply();
    }
    window.RenderGuard?.registerHook?.(apply);
  })();

  const profileState = { name:'', email:'', phone:'', signature:'', photoDataUrl:'' };
  const PHOTO_MAX_BYTES = 6 * 1024 * 1024;
  const signatureState = { rows: [], defaultId: null };
  const PROFILE_KEY = 'profile:v1';
  const SIGNATURE_KEY = 'signature:v1';
  const simpleModeState = Object.assign({}, SIMPLE_MODE_DEFAULTS);
  const DASHBOARD_WIDGET_ENTRIES = DASHBOARD_WIDGETS.map(widget => ({
    key: widget.id,
    label: widget.label,
    description: widget.today ? 'Shows time-sensitive insights for today.' : 'Appears in the all view by default.'
  }));
  const DASHBOARD_GRAPH_ENTRIES = [
    {key:'goalProgress', label:'Production Goals'},
    {key:'numbersPortfolio', label:'Partner Portfolio'},
    {key:'numbersMomentum', label:'Pipeline Momentum'},
    {key:'pipelineCalendar', label:'Pipeline Calendar'}
  ];
  const DASHBOARD_WIDGET_CARD_ENTRIES = [
    {key:'priorityActions', label:'Priority Actions'},
    {key:'milestones', label:'Milestones Ahead'},
    {key:'docPulse', label:'Document Pulse'},
    {key:'relationshipOpportunities', label:'Relationship Opportunities'},
    {key:'clientCareRadar', label:'Client Care Radar'},
    {key:'closingWatch', label:'Closing Watchlist'}
  ];
  const DASHBOARD_KPI_ENTRIES = [
    {key:'kpiNewLeads7d', label:'New Leads (7d)'},
    {key:'kpiActivePipeline', label:'Active Pipeline'},
    {key:'kpiFundedYTD', label:'Funded YTD'},
    {key:'kpiFundedVolumeYTD', label:'Funded Volume YTD'},
    {key:'kpiAvgCycleLeadToFunded', label:'Avg Days Lead → Funded'},
    {key:'kpiTasksToday', label:'Tasks Due Today'},
    {key:'kpiTasksOverdue', label:'Tasks Overdue'},
    {key:'kpiReferralsYTD', label:'Referrals YTD'}
  ];

  function buildDashboardDefaults(entries){
    const defaults = {};
    entries.forEach(entry => { defaults[entry.key] = true; });
    return defaults;
  }

  const dashboardDefaults = {
    widgets: buildDashboardDefaults(DASHBOARD_WIDGET_ENTRIES),
    graphs: buildDashboardDefaults(DASHBOARD_GRAPH_ENTRIES),
    widgetCards: buildDashboardDefaults(DASHBOARD_WIDGET_CARD_ENTRIES),
    kpis: buildDashboardDefaults(DASHBOARD_KPI_ENTRIES)
  };
  const dashboardState = {
    mode: 'today',
    widgets: Object.assign({}, dashboardDefaults.widgets),
    graphs: Object.assign({}, dashboardDefaults.graphs),
    widgetCards: Object.assign({}, dashboardDefaults.widgetCards),
    kpis: Object.assign({}, dashboardDefaults.kpis)
  };
  let hydrating = false;

  const SIMPLE_MODE_TOGGLES = {
    showProfileExtras: 'toggle-simple-profile',
    showLoanDetails: 'toggle-simple-loan',
    showRelationshipDetails: 'toggle-simple-relationships',
    showAddress: 'toggle-simple-address',
    showEngagement: 'toggle-simple-engagement'
  };

  function generateRowId(){
    try{ if(window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID(); }
    catch (_err) {}
    return 'sig-' + Math.random().toString(36).slice(2, 12);
  }

  function applyTokens(text){
    const source = String(text || '');
    return source
      .replace(/\{loName\}/g, profileState.name)
      .replace(/\{loEmail\}/g, profileState.email)
      .replace(/\{loPhone\}/g, profileState.phone);
  }

  function ensureSignaturePreview(card){
    let preview = card.querySelector('[data-role="signature-preview"]');
    if(!preview){
      preview = document.createElement('pre');
      preview.setAttribute('data-role', 'signature-preview');
      preview.className = 'muted';
      preview.style.marginTop = '8px';
      preview.style.padding = '12px';
      preview.style.background = 'rgba(17,18,26,0.08)';
      preview.style.borderRadius = '8px';
      preview.style.whiteSpace = 'pre-wrap';
      preview.style.fontFamily = 'inherit';
      card.appendChild(preview);
    }
    return preview;
  }

  function renderComposePreview(text){
    const preview = document.getElementById('compose-preview');
    if(!preview) return;
    let value = text || '';
    if(!value){
      value = applyTokens(profileState.signature || '');
    }
    preview.value = value || '';
  }

  function renderSignaturePreview(card){
    const preview = ensureSignaturePreview(card);
    if(!signatureState.rows.length){
      preview.textContent = (text?.('settings.signatures.empty') ?? __textFallback__('settings.signatures.empty'));
      preview.classList.add('muted');
      renderComposePreview('');
      return;
    }
    const target = signatureState.rows.find(row => row.id === signatureState.defaultId) || signatureState.rows[0];
    const processedBody = applyTokens(target.body || '');
    preview.textContent = processedBody || (text?.('settings.signatures.preview-empty') ?? __textFallback__('settings.signatures.preview-empty'));
    if(processedBody){
      preview.classList.remove('muted');
    }else{
      preview.classList.add('muted');
    }
    renderComposePreview(processedBody);
  }

  function syncDashboardState(preferences){
    const source = preferences && typeof preferences === 'object' ? preferences : {};
    dashboardState.mode = source.mode === 'all' ? 'all' : 'today';
    const widgets = Object.assign({}, dashboardDefaults.widgets);
    if(source.widgets && typeof source.widgets === 'object'){
      Object.keys(widgets).forEach(key => {
        if(typeof source.widgets[key] === 'boolean') widgets[key] = source.widgets[key];
      });
      if(typeof source.widgets.numbersGlance === 'boolean'){
        const legacyValue = source.widgets.numbersGlance;
        ['numbersPortfolio','numbersReferrals','numbersMomentum'].forEach(key => {
          if(typeof source.widgets[key] !== 'boolean') widgets[key] = legacyValue;
        });
      }
    }
    dashboardState.widgets = widgets;
    const graphs = Object.assign({}, dashboardDefaults.graphs);
    if(source.graphs && typeof source.graphs === 'object'){
      Object.keys(graphs).forEach(key => {
        if(typeof source.graphs[key] === 'boolean') graphs[key] = source.graphs[key];
      });
      if(typeof source.graphs.numbersGlance === 'boolean'){
        const legacyValue = source.graphs.numbersGlance;
        ['numbersPortfolio','numbersMomentum'].forEach(key => {
          if(typeof source.graphs[key] !== 'boolean') graphs[key] = legacyValue;
        });
      }
    }
    dashboardState.graphs = graphs;
    const widgetCards = Object.assign({}, dashboardDefaults.widgetCards);
    if(source.widgetCards && typeof source.widgetCards === 'object'){
      Object.keys(widgetCards).forEach(key => {
        if(typeof source.widgetCards[key] === 'boolean') widgetCards[key] = source.widgetCards[key];
      });
    }
    dashboardState.widgetCards = widgetCards;
    const kpis = Object.assign({}, dashboardDefaults.kpis);
    if(source.kpis && typeof source.kpis === 'object'){
      Object.keys(kpis).forEach(key => {
        if(typeof source.kpis[key] === 'boolean') kpis[key] = source.kpis[key];
      });
    }
    dashboardState.kpis = kpis;
  }

  function renderDashboardSettings(){
    const list = document.getElementById('dashboard-widget-list');
    if(!list) return;
    const config = normalizeDashboardConfig(readDashboardConfig());
    const rows = config.widgets.map(entry => {
      const meta = DASHBOARD_WIDGETS.find(w => w.id === entry.id) || { label: entry.id };
      const checked = entry.visible !== false ? 'checked' : '';
      const order = Number(entry.order) || 1;
      const todayBadge = isTodayWidget(entry.id) ? '<span class="pill" style="background:#f1f5f9;color:#0f172a;">Today</span>' : '';
      return `
        <tr data-widget-row="${entry.id}">
          <td style="width:64px;text-align:center;">
            <input type="checkbox" data-dashboard-widget="${entry.id}" ${checked} aria-label="Toggle ${meta.label}">
          </td>
          <td style="font-weight:600;display:flex;align-items:center;gap:8px;">
            <span>${meta.label}</span>
            ${todayBadge}
          </td>
          <td style="width:120px;">
            <input type="number" min="1" data-dashboard-order="${entry.id}" value="${order}" style="width:80px;">
          </td>
        </tr>`;
    }).join('');

    list.innerHTML = `
      <table class="dashboard-settings-table">
        <thead>
          <tr>
            <th style="width:64px;text-align:center;">Show</th>
            <th>Widget</th>
            <th style="width:120px;">Order</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="dashboard-settings-flags">
        <label class="row" style="align-items:center;gap:10px;">
          <input type="checkbox" data-dashboard-flag="defaultToAll" ${config.defaultToAll ? 'checked' : ''}> Default to All view
        </label>
        <label class="row" style="align-items:center;gap:10px;">
          <input type="checkbox" data-dashboard-flag="includeTodayInAll" ${config.includeTodayInAll ? 'checked' : ''}> Include Today widgets in All view
        </label>
      </div>`;

    const persist = () => {
      const rows = Array.from(list.querySelectorAll('tbody tr[data-widget-row]'));
      const updated = rows.map((row, index) => {
        const id = row.getAttribute('data-widget-row') || '';
        const visibleInput = row.querySelector('input[data-dashboard-widget]');
        const orderInput = row.querySelector('input[data-dashboard-order]');
        const order = Number(orderInput?.value) || index + 1;
        return { id, visible: !!visibleInput?.checked, order };
      });
      const flags = Array.from(list.querySelectorAll('input[data-dashboard-flag]')).reduce((acc, input) => {
        if(!(input instanceof HTMLInputElement)) return acc;
        acc[input.dataset.dashboardFlag] = input.checked;
        return acc;
      }, {});
      writeDashboardConfig({ widgets: updated, defaultToAll: !!flags.defaultToAll, includeTodayInAll: !!flags.includeTodayInAll });
      try {
        document.dispatchEvent(new CustomEvent('app:data:changed', { detail: { scope: 'settings' } }));
      } catch (_err) {}
    };

    if(!list.__wired){
      list.__wired = true;
      list.addEventListener('change', evt => {
        if(hydrating) return;
        const target = evt.target;
        if(!(target instanceof HTMLInputElement)) return;
        if(target.dataset.dashboardWidget || target.dataset.dashboardFlag){
          persist();
        }
      });
      list.addEventListener('input', evt => {
        const target = evt.target;
        if(!(target instanceof HTMLInputElement)) return;
        if(target.dataset.dashboardOrder){
          if(hydrating) return;
          persist();
        }
      });
    }
  }

  function hydrateDashboardSettings(preferences){
    syncDashboardState(preferences);
    renderDashboardSettings();
  }

  function renderSignatureRows(card){
    const tbody = card.querySelector('#sig-table tbody');
    if(!tbody) return;
    if(!signatureState.rows.length){
      tbody.innerHTML = `<tr><td class="muted" colspan="4">${text?.('settings.signatures.table-empty') ?? __textFallback__('settings.signatures.table-empty')}</td></tr>`;
      renderSignaturePreview(card);
      return;
    }
    const rowsHtml = signatureState.rows.map(row => {
      const isDefault = signatureState.defaultId === row.id;
      const disabled = row.isNew ? ' disabled' : '';
      const checked = isDefault ? ' checked' : '';
      const rowId = row.id ? String(row.id).replace(/["&<>]/g, ch => ({'"':'&quot;','&':'&amp;','<':'&lt;','>':'&gt;'}[ch] || ch)) : '';
      const title = row.title ? row.title.replace(/["&<>]/g, ch => ({'"':'&quot;','&':'&amp;','<':'&lt;','>':'&gt;'}[ch] || ch)) : '';
      const body = row.body ? row.body.replace(/[&<>]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch] || ch)) : '';
      return `
        <tr data-id="${rowId}">
          <td><input type="radio" name="sig-default" value="${rowId}"${checked}${disabled}></td>
          <td><input type="text" placeholder="${text?.('settings.signatures.placeholder-name') ?? __textFallback__('settings.signatures.placeholder-name')}" value="${title}"></td>
          <td><textarea rows="3" placeholder="${text?.('settings.signatures.placeholder-body') ?? __textFallback__('settings.signatures.placeholder-body')}">${body}</textarea></td>
          <td class="sig-actions">
            <div class="row" style="gap:6px;flex-wrap:wrap">
              <button class="btn" type="button" data-action="save">${text?.('general.save') ?? __textFallback__('general.save')}</button>
              <button class="btn danger" type="button" data-action="delete">${text?.('general.delete') ?? __textFallback__('general.delete')}</button>
            </div>
          </td>
        </tr>`;
    }).join('');
    tbody.innerHTML = rowsHtml;
    renderSignaturePreview(card);
  }

  function renderProfileBadge(){
    const chip = document.getElementById('lo-profile-chip');
    if(!chip) return;
    const nameEl = chip.querySelector('[data-role="lo-name"]');
    const contactEl = chip.querySelector('[data-role="lo-contact"]');
    const name = String(profileState.name || '').trim();
    const email = String(profileState.email || '').trim();
    const phone = String(profileState.phone || '').trim();
    const photoDataUrl = typeof profileState.photoDataUrl === 'string' ? profileState.photoDataUrl : '';
    if(nameEl){
      if(photoDataUrl){
        if(!nameEl.__photoOriginal){
          nameEl.__photoOriginal = {
            display: nameEl.style.display || '',
            alignItems: nameEl.style.alignItems || '',
            gap: nameEl.style.gap || ''
          };
        }
        nameEl.style.display = 'flex';
        nameEl.style.alignItems = 'center';
        nameEl.style.gap = '8px';
      }else if(nameEl.__photoFlexApplied){
        const original = nameEl.__photoOriginal || {};
        nameEl.style.display = original.display || '';
        nameEl.style.alignItems = original.alignItems || '';
        nameEl.style.gap = original.gap || '';
        nameEl.__photoOriginal = null;
      }
      nameEl.textContent = name || (text?.('settings.profile.prompt') ?? __textFallback__('settings.profile.prompt'));
      if(photoDataUrl){
        let img = nameEl.querySelector('[data-role="lo-photo"]');
        if(!img){
          img = document.createElement('img');
          img.dataset.role = 'lo-photo';
          img.alt = '';
          img.style.cssText = 'width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;';
          nameEl.insertBefore(img, nameEl.firstChild);
        }
        img.src = photoDataUrl;
        nameEl.__photoFlexApplied = true;
      }else{
        const img = nameEl.querySelector('[data-role="lo-photo"]');
        if(img) img.remove();
        nameEl.__photoFlexApplied = false;
      }
    }
    if(contactEl){
      const parts = [];
      if(email) parts.push(email);
      if(phone) parts.push(phone);
      contactEl.textContent = parts.length ? parts.join(' • ') : '—';
    }
  }

  function renderProfilePhotoControls(){
    const preview = document.getElementById('lo-photo-preview');
    const emptyState = document.getElementById('lo-photo-empty');
    const clearBtn = document.getElementById('btn-lo-photo-clear');
    const hasPhoto = !!profileState.photoDataUrl;
    if(preview){
      if(hasPhoto){
        preview.src = profileState.photoDataUrl;
        preview.style.display = '';
      }else{
        preview.removeAttribute('src');
        preview.style.display = 'none';
      }
    }
    if(emptyState){
      emptyState.style.display = hasPhoto ? 'none' : '';
    }
    if(clearBtn){
      clearBtn.disabled = !hasPhoto;
    }
  }

  function applyProfilePhoto(dataUrl){
    profileState.photoDataUrl = typeof dataUrl === 'string' ? dataUrl : '';
    renderProfilePhotoControls();
    renderProfileBadge();
  }

  function getUiModeToggle(){
    const el = document.getElementById('toggle-advanced-mode');
    return el instanceof HTMLInputElement ? el : null;
  }

  function syncUiModeToggle(mode){
    const toggle = getUiModeToggle();
    if(!toggle) return;
    const current = mode || getUiMode();
    const isAdvanced = current !== 'simple';
    toggle.checked = isAdvanced;
    toggle.setAttribute('aria-pressed', isAdvanced ? 'true' : 'false');
  }

  function wireUiModeToggle(){
    const toggle = getUiModeToggle();
    if(!toggle || toggle.__wiredUiMode) return;
    toggle.__wiredUiMode = true;
    toggle.addEventListener('change', () => {
      const nextMode = toggle.checked ? 'advanced' : 'simple';
      setUiMode(nextMode);
    });
    onUiModeChanged(syncUiModeToggle);
    syncUiModeToggle();
  }

  function getHomeViewInputs(){
    return Array.from(document.querySelectorAll('input[name="home-view"]'))
      .filter(el => el instanceof HTMLInputElement);
  }

  function syncHomeViewControls(preference){
    const normalized = normalizeHomeView(preference);
    const currentMode = getUiMode();
    const inputs = getHomeViewInputs();
    inputs.forEach((input) => {
      input.checked = input.value === normalized;
      input.disabled = currentMode === 'simple';
    });
    const note = document.getElementById('home-view-note');
    if(note){
      note.style.opacity = currentMode === 'simple' ? '1' : '';
    }
  }

  function wireHomeViewControls(initialPreference){
    const inputs = getHomeViewInputs();
    if(!inputs.length) return;
    inputs.forEach((input) => {
      if(input.__wiredHomeView) return;
      input.__wiredHomeView = true;
      input.addEventListener('change', () => {
        if(!input.checked) return;
        const preference = normalizeHomeView(input.value);
        setHomeViewPreference(preference);
        syncHomeViewControls(preference);
      });
    });
    onUiModeChanged(() => syncHomeViewControls(getHomeViewPreference()));
    const preference = typeof initialPreference === 'string' ? initialPreference : getHomeViewPreference();
    syncHomeViewControls(preference);
  }

  function getSimpleModeToggleElements(){
    const map = {};
    Object.entries(SIMPLE_MODE_TOGGLES).forEach(([key, id]) => {
      const el = document.getElementById(id);
      if(el instanceof HTMLInputElement) map[key] = el;
    });
    return map;
  }

  function syncSimpleModeControls(preferences){
    const toggles = getSimpleModeToggleElements();
    if(!Object.keys(toggles).length) return;
    const prefs = normalizeSimpleModeSettings(preferences || simpleModeState);
    Object.assign(simpleModeState, prefs);
    Object.entries(toggles).forEach(([key, el]) => {
      el.checked = prefs[key] === true;
    });
  }

  function persistSimpleModeControls(){
    const toggles = getSimpleModeToggleElements();
    if(!Object.keys(toggles).length || !ensureSettings()) return;
    const payload = {};
    Object.entries(toggles).forEach(([key, el]) => {
      payload[key] = !!el.checked;
    });
    Object.assign(simpleModeState, payload);
    const saveResult = window.Settings.save({ simpleMode: payload }, { silent: true });
    Promise.resolve(saveResult).catch(err => {
      console.warn('[settings] simple mode save failed', err);
    });
  }

  function wireSimpleModeControls(){
    const toggles = getSimpleModeToggleElements();
    Object.values(toggles).forEach((el) => {
      if(el.__wiredSimpleMode) return;
      el.__wiredSimpleMode = true;
      el.addEventListener('change', persistSimpleModeControls);
    });
    syncSimpleModeControls(simpleModeState);
  }

  function normalizeSignatureRows(){
    return signatureState.rows
      .map(row => ({
        id: row.id,
        title: String(row.title || '').trim(),
        body: String(row.body || '').trim(),
        updatedAt: row.updatedAt || Date.now()
      }))
      .filter(row => row.title && row.body);
  }

  function syncSignatureState(signature){
    const items = Array.isArray(signature && signature.items) ? signature.items : [];
    signatureState.rows = items.map(item => ({
      id: String(item.id),
      title: String(item.title || ''),
      body: String(item.body || ''),
      updatedAt: item.updatedAt || Date.now(),
      isNew: false
    }));
    const stored = readSignatureLocal();
    if(stored){
      const match = signatureState.rows.find(row => row.body === stored);
      if(match){
        signatureState.defaultId = match.id;
      }else{
        const rowId = generateRowId();
        signatureState.rows.unshift({
          id: rowId,
          title: 'Default',
          body: stored,
          updatedAt: Date.now(),
          isNew: false
        });
        signatureState.defaultId = rowId;
      }
    }else{
      signatureState.defaultId = signature && signature.defaultId && signatureState.rows.some(row => row.id === signature.defaultId)
        ? signature.defaultId
        : (signatureState.rows[0] ? signatureState.rows[0].id : null);
    }
  }

  async function saveSignatures(card){
    if(!ensureSettings()) return;
    const items = normalizeSignatureRows();
    if(items.length === 0){
      signatureState.rows = [];
      signatureState.defaultId = null;
    }else if(!signatureState.defaultId || !items.some(row => row.id === signatureState.defaultId)){
      signatureState.defaultId = items[0].id;
    }
    const payload = { signature: { items, defaultId: signatureState.defaultId } };
    const result = await window.Settings.save(payload);
    syncSignatureState(result.signature);
    const defaultRow = signatureState.rows.find(row => row.id === signatureState.defaultId) || signatureState.rows[0];
    const defaultBody = defaultRow ? defaultRow.body : '';
    writeSignatureLocal(defaultBody);
    profileState.signature = defaultBody || profileState.signature;
    const signatureInput = document.getElementById('lo-signature');
    if(signatureInput && !signatureInput.matches(':focus')){
      signatureInput.value = profileState.signature;
    }
    renderSignatureRows(card);
    toastSafe('Signature saved');
  }

  function handleSignatureClick(card, evt){
    const target = evt.target;
    if(!target) return;
    if(target.id === 'btn-sig-add'){
      evt.preventDefault();
      const row = { id: generateRowId(), title: '', body: '', updatedAt: Date.now(), isNew: true };
      signatureState.rows.push(row);
      renderSignatureRows(card);
      const focusField = card.querySelector(`tr[data-id="${row.id}"] input[type="text"]`);
      if(focusField) focusField.focus();
      return;
    }
    const action = target.getAttribute('data-action');
    if(!action) return;
    const tr = target.closest('tr[data-id]');
    if(!tr) return;
    const rowId = tr.getAttribute('data-id');
    const row = signatureState.rows.find(item => item.id === rowId);
    if(!row) return;
    if(action === 'save'){
      evt.preventDefault();
      const titleField = tr.querySelector('input[type="text"]');
      const bodyField = tr.querySelector('textarea');
      row.title = titleField ? titleField.value : '';
      row.body = bodyField ? bodyField.value : '';
      row.updatedAt = Date.now();
      row.isNew = false;
      saveSignatures(card).catch(err => console.warn('[soft]', text?.('toast.signature.save-failed') ?? __textFallback__('toast.signature.save-failed'), err));
      return;
    }
    if(action === 'delete'){
      evt.preventDefault();
      signatureState.rows = signatureState.rows.filter(item => item.id !== rowId);
      if(signatureState.defaultId === rowId){
        signatureState.defaultId = signatureState.rows[0] ? signatureState.rows[0].id : null;
      }
      saveSignatures(card).catch(err => console.warn('[soft]', text?.('toast.signature.delete-failed') ?? __textFallback__('toast.signature.delete-failed'), err));
      return;
    }
  }

  function handleSignatureChange(card, evt){
    const target = evt.target;
    if(!(target instanceof HTMLInputElement)) return;
    if(target.name !== 'sig-default') return;
    const rowId = target.value;
    if(!rowId) return;
    signatureState.defaultId = rowId;
    saveSignatures(card).catch(err => console.warn('[soft]', text?.('toast.signature.default-failed') ?? __textFallback__('toast.signature.default-failed'), err));
  }

  function handleSignatureInput(card, evt){
    const target = evt.target;
    if(!target) return;
    if(!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return;
    const tr = target.closest('tr[data-id]');
    if(!tr) return;
    const rowId = tr.getAttribute('data-id');
    const row = signatureState.rows.find(item => item.id === rowId);
    if(!row) return;
    if(target instanceof HTMLInputElement){
      row.title = target.value;
    }else{
      row.body = target.value;
    }
    renderSignaturePreview(card);
  }

  async function hydrateSignatures(snapshot){
    const card = document.getElementById('signatures-editor');
    if(!card || !ensureSettings()) return;
    if(snapshot && typeof snapshot === 'object' && snapshot.signature !== undefined){
      syncSignatureState(snapshot.signature);
    }else{
      const data = await window.Settings.get();
      syncSignatureState(data.signature);
    }
    renderSignatureRows(card);
    if(!card.__wired){
      card.__wired = true;
      card.addEventListener('click', evt => handleSignatureClick(card, evt));
      card.addEventListener('change', evt => handleSignatureChange(card, evt));
      card.addEventListener('input', evt => handleSignatureInput(card, evt));
    }
  }

  function hydrateGoals(goals){
    const fundedInput = document.getElementById('goal-funded');
    const volumeInput = document.getElementById('goal-volume');
    if(fundedInput) fundedInput.value = goals && goals.monthlyFundedGoal ? goals.monthlyFundedGoal : '';
    if(volumeInput) volumeInput.value = goals && goals.monthlyVolumeGoal ? goals.monthlyVolumeGoal : '';
    const saveBtn = document.getElementById('btn-goals-save');
    if(saveBtn && !saveBtn.__wired){
      saveBtn.__wired = true;
      saveBtn.addEventListener('click', async evt => {
        evt.preventDefault();
        if(!ensureSettings()) return;
        const funded = Math.max(0, Number(fundedInput && fundedInput.value ? fundedInput.value : 0) || 0);
        const volume = Math.max(0, Number(volumeInput && volumeInput.value ? volumeInput.value : 0) || 0);
        await window.Settings.save({ goals: { monthlyFundedGoal: funded, monthlyVolumeGoal: volume, updatedAt: new Date().toISOString() } });
        toastSafe(text?.('settings.toast.goals-saved') ?? __textFallback__('settings.toast.goals-saved'));
      });
    }
  }

  function hydrateProfile(profile){
    const nameInput = document.getElementById('lo-name');
    const emailInput = document.getElementById('lo-email');
    const phoneInput = document.getElementById('lo-phone');
    const signatureInput = document.getElementById('lo-signature');
    const photoInput = document.getElementById('lo-photo');
    const clearPhotoBtn = document.getElementById('btn-lo-photo-clear');
    const localProfile = readProfileLocal();
    const mergedProfile = Object.assign({}, profile || {}, localProfile || {});
    profileState.name = mergedProfile && mergedProfile.name ? mergedProfile.name : '';
    profileState.email = mergedProfile && mergedProfile.email ? mergedProfile.email : '';
    profileState.phone = mergedProfile && mergedProfile.phone ? mergedProfile.phone : '';
    profileState.photoDataUrl = typeof mergedProfile.photoDataUrl === 'string' ? mergedProfile.photoDataUrl : '';
    const storedSignature = readSignatureLocal();
    profileState.signature = storedSignature || (mergedProfile && mergedProfile.signature ? mergedProfile.signature : '');
    if(nameInput) nameInput.value = profileState.name;
    if(emailInput) emailInput.value = profileState.email;
    if(phoneInput) phoneInput.value = profileState.phone;
    if(signatureInput) signatureInput.value = profileState.signature;
    renderProfilePhotoControls();
    const saveBtn = document.getElementById('btn-lo-save');
    if(saveBtn && !saveBtn.__wired){
      saveBtn.__wired = true;
      saveBtn.addEventListener('click', async evt => {
        evt.preventDefault();
        if(!ensureSettings()) return;
        profileState.name = nameInput ? nameInput.value : '';
        profileState.email = emailInput ? emailInput.value : '';
        profileState.phone = phoneInput ? phoneInput.value : '';
        profileState.signature = signatureInput ? signatureInput.value : '';
        renderProfileBadge();
        const card = document.getElementById('signatures-editor');
        if(card) renderSignaturePreview(card);
        const payload = Object.assign({}, profileState);
        writeProfileLocal(payload);
        writeSignatureLocal(profileState.signature || '');
        await window.Settings.save({ loProfile: payload });
        const renderAll = getRenderer();
        if(typeof renderAll === 'function'){
          try{ renderAll('profiles:saved'); }
          catch (err) { console.warn('renderAll profiles:saved failed', err); }
        }
        toastSafe(text?.('settings.toast.profile-saved') ?? __textFallback__('settings.toast.profile-saved'));
      });
    }
    if(photoInput && !photoInput.__wired){
      photoInput.__wired = true;
      photoInput.addEventListener('change', evt => {
        const input = evt.target instanceof HTMLInputElement ? evt.target : photoInput;
        if(!input || !(input instanceof HTMLInputElement)) return;
        const file = input.files && input.files[0];
        if(!file){
          input.value = '';
          return;
        }
        if(file.size > PHOTO_MAX_BYTES){
          toastSafe('Please choose an image under 6 MB.');
          input.value = '';
          return;
        }
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          const result = reader.result;
          if(typeof result === 'string'){
            applyProfilePhoto(result);
          }else{
            toastSafe('Unable to read image.');
          }
          input.value = '';
        });
        reader.addEventListener('error', () => {
          toastSafe('Unable to read image.');
          input.value = '';
        });
        try{
          reader.readAsDataURL(file);
        }catch (_err){
          toastSafe('Unable to read image.');
          input.value = '';
        }
      });
    }
    if(clearPhotoBtn && !clearPhotoBtn.__wired){
      clearPhotoBtn.__wired = true;
      clearPhotoBtn.addEventListener('click', evt => {
        evt.preventDefault();
        evt.stopPropagation();
        if(!profileState.photoDataUrl) return;
        applyProfilePhoto('');
        if(photoInput){
          try{ photoInput.value = ''; }
          catch (_err) {}
        }
      });
    }
    const card = document.getElementById('signatures-editor');
    if(card) renderSignaturePreview(card);
    renderProfileBadge();
  }

  async function hydrateAll(){
    if(hydrating) return;
    hydrating = true;
    try{
      if(!ensureSettings()) return;
      const data = await window.Settings.get();
      hydrateDashboardSettings(data.dashboard || {});
      hydrateGoals(data.goals || {});
      hydrateProfile(data.loProfile || {});
      syncSignatureState(data.signature || {});
      wireUiModeToggle();
      syncUiModeToggle(data.uiMode || getUiMode());
      const homeView = setHomeViewPreference(normalizeHomeView(data.ui && data.ui.homeView), { persist: false });
      wireHomeViewControls(homeView);
      wireSimpleModeControls();
      syncSimpleModeControls(data.simpleMode || simpleModeState);
      await hydrateSignatures(data);
    }catch (err) {
      console.warn('[soft]', text?.('toast.settings.hydrate-failed') ?? __textFallback__('toast.settings.hydrate-failed'), err);
    }finally{
      hydrating = false;
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', hydrateAll, { once: true });
  }else{
    hydrateAll();
  }

  document.addEventListener('app:data:changed', evt => {
    const scope = evt && evt.detail && evt.detail.scope;
    if(scope && scope !== 'settings') return;
    hydrateAll();
  });
})();
  function readProfileLocal(){
    try{
      const raw = localStorage.getItem(PROFILE_KEY);
      if(!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    }catch (_err) { return null; }
  }

  function writeProfileLocal(data){
    try{
      if(data && typeof data === 'object'){
        localStorage.setItem(PROFILE_KEY, JSON.stringify(data));
      }else{
        localStorage.removeItem(PROFILE_KEY);
      }
    }catch (_err) { /* noop */ }
  }

  function readSignatureLocal(){
    try{
      const raw = localStorage.getItem(SIGNATURE_KEY);
      return typeof raw === 'string' ? raw : '';
    }catch (_err) { return ''; }
  }

  function writeSignatureLocal(value){
    try{
      if(value){
        localStorage.setItem(SIGNATURE_KEY, String(value));
      }else{
        localStorage.removeItem(SIGNATURE_KEY);
      }
    }catch (_err) { /* noop */ }
  }

