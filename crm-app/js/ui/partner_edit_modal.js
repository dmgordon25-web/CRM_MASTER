import { ensureSingletonModal, closeSingletonModal, registerModalCleanup } from './modal_singleton.js';
import { createFormFooter } from './form_footer.js';
import { registerModalActions } from '../contacts/modal.js';
import { toastError, toastSuccess, toastWarn } from './toast_helpers.js';

const MODAL_KEY = 'partner-edit';
const MODAL_SELECTOR = '[data-ui="partner-edit-modal"], #partner-modal';
const CONTACT_MODAL_SELECTOR = '[data-ui="contact-modal"], #contact-modal';
const INVALID_PARTNER_ID_TOKENS = new Set(['undefined', 'null']);
const FOCUSABLE_SELECTOR = 'a[href], area[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';
const scheduleMicrotask = typeof queueMicrotask === 'function'
  ? queueMicrotask
  : (fn) => Promise.resolve().then(fn);
const STRAY_DIALOG_ALLOW = '[data-ui="merge-modal"],[data-ui="merge-confirm"],[data-ui="toast"]';

function __closeStrayDialogsOnce(label = '[STRAY_DIALOG_CLOSED]'){
  if(typeof document === 'undefined') return;
  const closeStrays = () => {
    if(typeof document === 'undefined') return;
    document.querySelectorAll('dialog[open]').forEach(dialog => {
      let allowed = false;
      try {
        allowed = typeof dialog.matches === 'function' && dialog.matches(STRAY_DIALOG_ALLOW);
      } catch (_) {
        allowed = false;
      }
      if(allowed) return;
      try { dialog.close?.(); }
      catch (_) {}
      try { dialog.removeAttribute?.('open'); }
      catch (_) {}
      try { dialog.classList?.add('is-hidden'); }
      catch (_) {}
      try { console && console.warn && console.warn(label, dialog.id || dialog.className || dialog.nodeName); }
      catch (_) {}
    });
  };
  closeStrays();
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => setTimeout(fn, 16);
  raf(() => { closeStrays(); });
}

const escapeHtml = (val)=> String(val||'').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const fmtCurrency = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const STAGE_LABELS = {
  application:'Application',
  processing:'Processing',
  underwriting:'Underwriting',
  approved:'Approved',
  'cleared-to-close':'Clear to Close',
  funded:'Funded',
  'post-close':'Post-Close',
  nurture:'Nurture',
  lost:'Lost',
  denied:'Denied'
};

const STATES = [
  {value:'', label:'Select state'},
  {value:'AL', label:'Alabama'},{value:'AK', label:'Alaska'},{value:'AZ', label:'Arizona'},{value:'AR', label:'Arkansas'},
  {value:'CA', label:'California'},{value:'CO', label:'Colorado'},{value:'CT', label:'Connecticut'},{value:'DE', label:'Delaware'},
  {value:'DC', label:'District of Columbia'},{value:'FL', label:'Florida'},{value:'GA', label:'Georgia'},{value:'HI', label:'Hawaii'},
  {value:'ID', label:'Idaho'},{value:'IL', label:'Illinois'},{value:'IN', label:'Indiana'},{value:'IA', label:'Iowa'},
  {value:'KS', label:'Kansas'},{value:'KY', label:'Kentucky'},{value:'LA', label:'Louisiana'},{value:'ME', label:'Maine'},
  {value:'MD', label:'Maryland'},{value:'MA', label:'Massachusetts'},{value:'MI', label:'Michigan'},{value:'MN', label:'Minnesota'},
  {value:'MS', label:'Mississippi'},{value:'MO', label:'Missouri'},{value:'MT', label:'Montana'},{value:'NE', label:'Nebraska'},
  {value:'NV', label:'Nevada'},{value:'NH', label:'New Hampshire'},{value:'NJ', label:'New Jersey'},{value:'NM', label:'New Mexico'},
  {value:'NY', label:'New York'},{value:'NC', label:'North Carolina'},{value:'ND', label:'North Dakota'},{value:'OH', label:'Ohio'},
  {value:'OK', label:'Oklahoma'},{value:'OR', label:'Oregon'},{value:'PA', label:'Pennsylvania'},{value:'RI', label:'Rhode Island'},
  {value:'SC', label:'South Carolina'},{value:'SD', label:'South Dakota'},{value:'TN', label:'Tennessee'},{value:'TX', label:'Texas'},
  {value:'UT', label:'Utah'},{value:'VT', label:'Vermont'},{value:'VA', label:'Virginia'},{value:'WA', label:'Washington'},
  {value:'WV', label:'West Virginia'},{value:'WI', label:'Wisconsin'},{value:'WY', label:'Wyoming'}
];

function normalizeStage(stage){
  const canonFn = typeof window.canonicalizeStage === 'function'
    ? window.canonicalizeStage
    : (val)=> String(val||'').toLowerCase().trim();
  const raw = canonFn(stage);
  if(STAGE_LABELS[raw]) return raw;
  if(raw==='nurture' || raw==='post-close') return 'post-close';
  if(raw==='lost' || raw==='denied') return 'lost';
  return 'application';
}

function formatAmount(value){
  const num = Number(value||0);
  return num>0 ? fmtCurrency.format(num) : 'TBD';
}

function contactInitials(contact){
  const first = String(contact?.first||'').trim();
  const last = String(contact?.last||'').trim();
  if(first || last){
    return (first[0]||'').toUpperCase() + (last[0]||first[1]||'').toUpperCase();
  }
  const alt = String(contact?.name||contact?.email||contact?.company||'?').trim();
  return (alt[0]||'?').toUpperCase();
}

function contactDisplayName(contact){
  if(!contact) return 'Unnamed Contact';
  const parts = [String(contact.first||'').trim(), String(contact.last||'').trim()].filter(Boolean);
  return parts.length ? parts.join(' ') : (contact.name || contact.company || 'Unnamed Contact');
}

function avatarCharToken(ch){
  if(!ch) return '';
  const upper = ch.toLocaleUpperCase();
  const lower = ch.toLocaleLowerCase();
  if(upper !== lower) return upper;
  return /[0-9]/.test(ch) ? ch : '';
}

function computeAvatarInitials(name){
  const parts = Array.from(String(name||'').trim().split(/\s+/).filter(Boolean));
  if(!parts.length) return '';
  const tokens = parts.map(part => {
    const chars = Array.from(part);
    for(const ch of chars){
      const token = avatarCharToken(ch);
      if(token) return token;
    }
    return '';
  }).filter(Boolean);
  if(!tokens.length) return '';
  let first = tokens[0] || '';
  let second = '';
  if(tokens.length>1){
    second = tokens[tokens.length-1] || '';
  }else{
    const chars = Array.from(parts[0]).slice(1);
    for(const ch of chars){
      const token = avatarCharToken(ch);
      if(token){
        second = token;
        break;
      }
    }
  }
  const combined = (first + second).slice(0,2);
  return combined || first || '';
}

function partnerAvatarSource(record){
  if(!record) return '';
  const name = String(record.name||'').trim();
  if(name) return name;
  const company = String(record.company||'').trim();
  if(company) return company;
  const email = String(record.email||'').trim();
  if(email) return email;
  return '';
}

function applyAvatar(el, primary, fallback){
  if(!el) return;
  const initials = computeAvatarInitials(primary);
  if(initials){
    el.dataset.initials = initials;
    el.classList.remove('is-empty');
    return;
  }
  const alt = computeAvatarInitials(fallback);
  if(alt){
    el.dataset.initials = alt;
    el.classList.remove('is-empty');
    return;
  }
  el.dataset.initials = '?';
  el.classList.add('is-empty');
}

function fillStateSelect(root, current){
  const select = root?.querySelector?.('#p-state');
  if(!select) return;
  const previous = select.value;
  const desired = current || previous || '';
  select.innerHTML = STATES.map(({value,label})=>`<option value="${value}">${label}</option>`).join('');
  select.value = desired || '';
}

function updateSummary(root){
  if(!root) return;
  const nameInput = root.querySelector('#p-name');
  const companyInput = root.querySelector('#p-company');
  const tierSelect = root.querySelector('#p-tier');
  const typeSelect = root.querySelector('#p-type');
  const focusSelect = root.querySelector('#p-focus');
  const cadenceSelect = root.querySelector('#p-cadence');
  const emailInput = root.querySelector('#p-email');
  const summaryName = root.querySelector('#p-summary-name');
  const summaryTier = root.querySelector('#p-summary-tier');
  const summaryType = root.querySelector('#p-summary-type');
  const summaryFocus = root.querySelector('#p-summary-focus');
  const summaryCadence = root.querySelector('#p-summary-cadence');
  const note = root.querySelector('#p-summary-note');
  const nameRaw = nameInput?.value?.trim() || '';
  const companyRaw = companyInput?.value?.trim() || '';
  const emailRaw = emailInput?.value?.trim() || '';
  const name = nameRaw || 'New Partner';
  const company = companyRaw;
  const tier = tierSelect?.value || 'Developing';
  const type = typeSelect?.value || 'Realtor Partner';
  const focus = focusSelect?.value || 'Purchase';
  const cadence = cadenceSelect?.value || 'Monthly';
  if(summaryName){
    const summaryText = summaryName.querySelector('[data-role="summary-name-text"]');
    const avatarEl = summaryName.querySelector('[data-role="summary-avatar"]');
    const label = company ? `${name} · ${company}` : name;
    if(summaryText){ summaryText.textContent = label; }
    else { summaryName.textContent = label; }
    applyAvatar(avatarEl, nameRaw, partnerAvatarSource({ name: nameRaw, company: companyRaw, email: emailRaw }));
  }
  if(summaryTier) summaryTier.textContent = `Tier — ${tier}`;
  if(summaryType) summaryType.textContent = type;
  if(summaryFocus) summaryFocus.textContent = focus;
  if(summaryCadence) summaryCadence.textContent = cadence;
  if(note){
    if(tier==='Top'){
      note.textContent = 'Protect this champion: coordinate joint client reviews and highlight wins quarterly.';
    }else if(tier==='Core'){
      note.textContent = 'Stay relevant with monthly value drops, co-marketing, and proactive status updates.';
    }else{
      note.textContent = 'Build trust with intentional follow-up and invite them into your client experience.';
    }
  }
}

async function renderLinkedCustomers(root, partnerId){
  const wrap = root?.querySelector?.('#partner-linked');
  const summary = root?.querySelector?.('#partner-linked-summary');
  const summaryMetric = root?.querySelector?.('#p-summary-linked');
  if(!wrap){
    if(summaryMetric) summaryMetric.textContent = '—';
    return;
  }
  if(!partnerId){
    wrap.innerHTML = '<div class="linked-empty muted">Save activity with this partner to see connected borrowers and deals.</div>';
    if(summary) summary.textContent = 'No linked customers yet.';
    if(summaryMetric) summaryMetric.textContent = '—';
    return;
  }
  try{
    await openDB();
    const contacts = await dbGetAll('contacts');
    const linked = (contacts||[]).filter(c => c && (String(c.buyerPartnerId||'')===String(partnerId) || String(c.listingPartnerId||'')===String(partnerId)));
    linked.sort((a,b)=> (b.updatedAt||0) - (a.updatedAt||0));
    wrap.innerHTML = '';
    if(!linked.length){
      wrap.innerHTML = '<div class="linked-empty muted">No linked customers yet.</div>';
    }else{
      linked.forEach(contact => {
        const name = contactDisplayName(contact);
        const amount = formatAmount(contact.loanAmount);
        const loan = contact.loanType || contact.loanProgram || 'Loan';
        const stageKey = normalizeStage(contact.stage);
        const stageLabel = STAGE_LABELS[stageKey] || 'Application';
        const nextRaw = contact.nextFollowUp || contact.nextTouch || '';
        const next = nextRaw ? String(nextRaw).slice(0,10) : '';
        const missingCount = String(contact.missingDocs||'').split(',').map(s=>s.trim()).filter(Boolean).length;
        const card = document.createElement('div');
        card.className = 'linked-card';
        card.innerHTML = `
          <div class="linked-header">
            <div class="linked-avatar">${escapeHtml(contactInitials(contact))}</div>
            <div class="linked-ident">
              <div class="linked-name">${escapeHtml(name)}</div>
              <div class="linked-sub">${escapeHtml(loan)} • ${escapeHtml(amount)}</div>
            </div>
            <span class="linked-stage" data-stage="${escapeHtml(stageKey)}">${escapeHtml(stageLabel)}</span>
          </div>
          <div class="linked-meta">
            <span>${contact.leadSource ? escapeHtml(contact.leadSource) : 'Lead source —'}</span>
            <span>${next ? 'Next: '+escapeHtml(next) : 'Next touch TBD'}</span>
            ${missingCount ? `<span class="linked-missing">Docs: ${missingCount}</span>` : ''}
          </div>`;
        card.addEventListener('click', ()=>{
          if(window.renderContactModal) window.renderContactModal(contact.id);
        });
        wrap.appendChild(card);
      });
    }
    if(summary) summary.textContent = linked.length ? `${linked.length} linked customer${linked.length===1?'':'s'} in flight.` : 'No linked customers yet.';
    if(summaryMetric){
      summaryMetric.textContent = linked.length ? `${linked.length}` : '—';
      summaryMetric.dataset.count = summaryMetric.textContent;
    }
  }catch (err) {
    console && console.warn && console.warn('renderLinkedCustomers', err);
  }
}

async function loadPartnerRecord(partnerId){
  await openDB();
  return partnerId ? (await dbGet('partners', partnerId)) : null;
}

function basePartner(partnerId){
  const id = partnerId || (typeof window.uuid === 'function' ? window.uuid() : `partner-${Date.now()}`);
  return {
    id,
    name:'',
    company:'',
    email:'',
    phone:'',
    tier:'Developing',
    notes:'',
    partnerType:'Realtor Partner',
    focus:'Purchase',
    priority:'Emerging',
    preferredContact:'Phone',
    cadence:'Monthly',
    address:'',
    city:'',
    state:'',
    zip:'',
    referralVolume:'1-2 / month',
    lastTouch:'',
    nextTouch:'',
    relationshipOwner:'',
    collaborationFocus:'Co-Marketing'
  };
}

function resetPartnerForm(form){
  if(!form) return;
  form.reset();
  form.querySelectorAll('input,select,textarea').forEach(ctrl => {
    if(ctrl.tagName === 'SELECT'){
      ctrl.selectedIndex = 0;
    }else{
      ctrl.value = '';
    }
  });
}

function populatePartnerForm(root, record){
  if(!root || !record) return;
  const map = {
    '#p-name': record.name||'',
    '#p-company': record.company||'',
    '#p-email': record.email||'',
    '#p-phone': record.phone||'',
    '#p-type': record.partnerType||'Realtor Partner',
    '#p-tier': record.tier||'Developing',
    '#p-focus': record.focus||'Purchase',
    '#p-priority': record.priority||'Emerging',
    '#p-pref': record.preferredContact||'Phone',
    '#p-cadence': record.cadence||'Monthly',
    '#p-address': record.address||'',
    '#p-city': record.city||'',
    '#p-zip': record.zip||'',
    '#p-volume': record.referralVolume||'1-2 / month',
    '#p-lasttouch': (record.lastTouch||'').slice(0,10),
    '#p-nexttouch': (record.nextTouch||'').slice(0,10),
    '#p-owner': record.relationshipOwner||'',
    '#p-collab': record.collaborationFocus||'Co-Marketing',
    '#p-notes': record.notes||''
  };
  Object.entries(map).forEach(([selector, value]) => {
    const node = root.querySelector(selector);
    if(!node) return;
    if(node.tagName === 'SELECT'){
      node.value = value;
    }else{
      node.value = value;
    }
  });
  fillStateSelect(root, (record.state||'').toUpperCase());
}

function bindSummaryListeners(root){
  if(!root) return;
  root.querySelectorAll('input,select,textarea').forEach(ctrl => {
    if(!ctrl.__summaryBound){
      ctrl.__summaryBound = true;
      ctrl.addEventListener('input', () => updateSummary(root));
      ctrl.addEventListener('change', () => updateSummary(root));
    }
  });
}

function wireTabNavigation(root){
  if(!root) return;
  const tabNav = root.querySelector('#partner-tabs');
  if(tabNav && !tabNav.__wired){
    tabNav.__wired = true;
    tabNav.addEventListener('click', evt => {
      const btn = evt.target && evt.target.closest('button[data-panel]');
      if(!btn) return;
      evt.preventDefault();
      const key = btn.getAttribute('data-panel') || 'overview';
      root.querySelectorAll('.partner-panel').forEach(panel => {
        panel.classList.toggle('active', panel.getAttribute('data-panel') === key);
      });
      tabNav.querySelectorAll('button[data-panel]').forEach(tab => {
        tab.classList.toggle('active', tab.getAttribute('data-panel') === key);
      });
    });
  }
  const firstPanel = root.querySelector('.partner-panel');
  if(firstPanel){
    root.querySelectorAll('.partner-panel').forEach(panel => {
      panel.classList.toggle('active', panel === firstPanel || panel.getAttribute('data-panel') === 'overview');
    });
  }
  if(tabNav){
    tabNav.querySelectorAll('button[data-panel]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-panel') === 'overview');
    });
  }
}

function dispatchPartnerReady(root, form, record){
  const detail = { dialog: root, form, record };
  try{
    document.dispatchEvent(new CustomEvent('partner:modal:ready', { detail }));
  }catch(_err){}
}

async function renderPartnerEditor(root, partnerId){
  if(!root){
    toastWarn('Partner not found');
    return null;
  }
  const loaded = await loadPartnerRecord(partnerId);
  if(partnerId && !loaded){
    toastWarn('Partner not found');
    return null;
  }
  const base = basePartner(partnerId);
  const record = Object.assign(base, loaded || {});
  root.dataset.partnerId = String(record.id || '');
  root.__currentPartnerBase = Object.assign({}, record);
  root.__partnerWasSaved = Boolean(loaded && loaded.id);

  const title = root.querySelector('#partner-title');
  if(title) title.textContent = loaded ? 'Edit Partner' : 'Add Partner';

  const partnerForm = root.querySelector('#partner-form');
  resetPartnerForm(partnerForm);
  populatePartnerForm(root, record);
  dispatchPartnerReady(root, partnerForm, record);
  await renderLinkedCustomers(root, record.id);

  const closeDialog = () => closePartnerEditModal();

  let footerHandle = root.__partnerFooter;
  if(partnerForm){
    const footerHost = partnerForm.querySelector('.modal-footer');
    if(footerHost){
      if(!footerHandle){
        footerHandle = createFormFooter({
          host: footerHost,
          form: partnerForm,
          saveLabel: 'Save Partner',
          cancelLabel: 'Cancel',
          saveId: 'p-save',
          onCancel: event => {
            if(event) event.preventDefault();
            closeDialog();
          }
        });
        footerHandle.cancelButton.setAttribute('data-close', '');
        root.__partnerFooter = footerHandle;
      }
      footerHandle.saveButton.textContent = 'Save Partner';
      footerHandle.cancelButton.textContent = 'Cancel';
    }
  }

  const btnSave = root.querySelector('#p-save') || footerHandle?.saveButton || null;
  if(btnSave && !btnSave.__wired){
    const setBusy = (active)=>{
      if(active){
        try{ root.setAttribute('data-loading', '1'); }
        catch(_err){}
        btnSave.dataset.loading = '1';
        btnSave.setAttribute('aria-busy', 'true');
        btnSave.disabled = true;
      }else{
        try{ root.removeAttribute('data-loading'); }
        catch(_err){}
        delete btnSave.dataset.loading;
        btnSave.removeAttribute('aria-busy');
        btnSave.disabled = false;
      }
    };
    btnSave.__wired = true;
    btnSave.addEventListener('click', async (evt)=>{
      if(evt) evt.preventDefault();
      if(btnSave.dataset.loading === '1') return;
      setBusy(true);
      try{
        const baseRecord = Object.assign({}, root.__currentPartnerBase || {});
        if(!baseRecord.id){
          baseRecord.id = root.dataset.partnerId || String(Date.now());
        }
        const rec = Object.assign({}, baseRecord, {
          id: baseRecord.id,
          name: root.querySelector('#p-name')?.value?.trim() || '',
          company: root.querySelector('#p-company')?.value?.trim() || '',
          email: root.querySelector('#p-email')?.value?.trim() || '',
          phone: root.querySelector('#p-phone')?.value?.trim() || '',
          partnerType: root.querySelector('#p-type')?.value || 'Realtor Partner',
          tier: root.querySelector('#p-tier')?.value || 'Developing',
          focus: root.querySelector('#p-focus')?.value || 'Purchase',
          priority: root.querySelector('#p-priority')?.value || 'Emerging',
          preferredContact: root.querySelector('#p-pref')?.value || 'Phone',
          cadence: root.querySelector('#p-cadence')?.value || 'Monthly',
          address: root.querySelector('#p-address')?.value?.trim() || '',
          city: root.querySelector('#p-city')?.value?.trim() || '',
          state: (root.querySelector('#p-state')?.value || '').toUpperCase(),
          zip: root.querySelector('#p-zip')?.value?.trim() || '',
          referralVolume: root.querySelector('#p-volume')?.value || '1-2 / month',
          lastTouch: root.querySelector('#p-lasttouch')?.value || '',
          nextTouch: root.querySelector('#p-nexttouch')?.value || '',
          relationshipOwner: root.querySelector('#p-owner')?.value?.trim() || '',
          collaborationFocus: root.querySelector('#p-collab')?.value || 'Co-Marketing',
          notes: root.querySelector('#p-notes')?.value || '',
          updatedAt: Date.now()
        });
        await dbPut('partners', rec);
        const wasSaved = !!root.__partnerWasSaved;
        root.__currentPartnerBase = Object.assign({}, rec);
        root.dataset.partnerId = String(rec.id || '');
        const detail = {
          scope:'partners',
          partnerId:String(rec.id||''),
          action: wasSaved ? 'update' : 'create',
          source:'partner:modal',
          sourceHint: root.__partnerSourceHint || root.dataset?.sourceHint || ''
        };
        if(typeof window.dispatchAppDataChanged === 'function'){
          window.dispatchAppDataChanged(detail);
        }else{
          document.dispatchEvent(new CustomEvent('app:data:changed', { detail }));
        }
        toastSuccess(wasSaved ? 'Partner updated' : 'Partner created');
        root.__partnerWasSaved = true;
        closeDialog();
      }catch (err){
        if(console && typeof console.warn === 'function'){
          console.warn('[partner-modal] save failed', err);
        }
        toastError('Partner save failed');
      }finally{
        setBusy(false);
      }
    });
  }

  if(partnerForm && !partnerForm.__wired){
    partnerForm.__wired = true;
    partnerForm.addEventListener('submit', evt => {
      evt.preventDefault();
      (btnSave || partnerForm.querySelector('#p-save'))?.click();
    });
  }

  bindSummaryListeners(root);
  wireTabNavigation(root);
  updateSummary(root);

  const closeBtn = root.querySelector('[data-close-partner]');
  if(closeBtn && !closeBtn.__wired){
    closeBtn.__wired = true;
    closeBtn.addEventListener('click', evt => {
      if(evt) evt.preventDefault();
      closeDialog();
    });
  }

  return record;
}

let pendingOpen = null;
let lastInvoker = null;

function asArray(value){
  if(value == null) return [];
  if(Array.isArray(value)) return value;
  if(typeof value[Symbol.iterator] === 'function'){
    return Array.from(value);
  }
  return [value];
}

function isElement(node){
  return !!(node && node.nodeType === 1);
}

function isVisible(node){
  if(!node) return false;
  const style = node instanceof HTMLElement ? window.getComputedStyle(node) : null;
  if(style && (style.visibility === 'hidden' || style.display === 'none')) return false;
  if(node.hasAttribute('aria-hidden') && node.getAttribute('aria-hidden') === 'true') return false;
  if(typeof node.offsetParent === 'object' && node.offsetParent === null && style && style.position !== 'fixed'){
    return false;
  }
  return true;
}

function findPartnerModal(){
  if(typeof document === 'undefined') return null;
  const modal = document.querySelector(MODAL_SELECTOR);
  return modal || null;
}

function cleanupNodeHandles(node){
  if(!node) return;
  if(node.__partnerEscHandler){
    document.removeEventListener('keydown', node.__partnerEscHandler);
    node.__partnerEscHandler = null;
  }
  if(typeof node.__partnerFocusTrapCleanup === 'function'){
    try{ node.__partnerFocusTrapCleanup(); }
    catch(_err){}
    node.__partnerFocusTrapCleanup = null;
  }
}

function hideContactModals(){
  const nodes = asArray(document.querySelectorAll(CONTACT_MODAL_SELECTOR));
  nodes.forEach(node => {
    if(!node) return;
    cleanupNodeHandles(node);
    if(typeof node.close === 'function'){
      try{ node.close(); }
      catch(_err){}
    }
    node.classList?.add('hidden');
    node.style.display = 'none';
    node.setAttribute?.('aria-hidden', 'true');
    if(node.hasAttribute?.('open')){
      node.removeAttribute('open');
    }
  });
}

function ensureModalAttributes(root){
  if(!root) return;
  root.setAttribute('data-modal-key', MODAL_KEY);
  root.setAttribute('data-ui', 'partner-edit-modal');
  if(root.dataset){
    root.dataset.modalKey = MODAL_KEY;
    root.dataset.ui = 'partner-edit-modal';
    root.dataset.open = '1';
    root.dataset.opening = root.dataset.opening || '1';
  }
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-hidden', 'false');
  root.classList.remove('hidden');
  root.style.display = 'flex';
  root.style.alignItems = root.style.alignItems || 'center';
  root.style.justifyContent = root.style.justifyContent || 'center';
  const currentZ = Number.parseInt(root.style.zIndex || '', 10);
  if(Number.isNaN(currentZ) || currentZ < 1400){
    root.style.zIndex = '1400';
  }
  if(!root.id) root.id = 'partner-modal';
  const shell = root.querySelector('.dlg');
  if(shell){
    if(!shell.hasAttribute('tabindex')) shell.setAttribute('tabindex', '-1');
    shell.setAttribute('role', 'document');
  }
}

function installEscHandler(root){
  if(!root) return;
  if(root.__partnerEscHandler){
    document.removeEventListener('keydown', root.__partnerEscHandler);
    root.__partnerEscHandler = null;
  }
  const handler = (event)=>{
    if(event.key !== 'Escape') return;
    event.preventDefault();
    closePartnerEditModal();
  };
  document.addEventListener('keydown', handler);
  root.__partnerEscHandler = handler;
}

function focusFirstElement(root){
  const shell = root?.querySelector?.('.dlg') || root;
  if(!shell) return;
  const focusables = asArray(shell.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter(el => el instanceof HTMLElement && !el.hasAttribute('disabled') && isVisible(el));
  if(!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  const trap = (event)=>{
    if(event.key !== 'Tab') return;
    if(focusables.length === 1){
      event.preventDefault();
      first.focus({ preventScroll: true });
      return;
    }
    if(event.shiftKey){
      if(document.activeElement === first || !shell.contains(document.activeElement)){
        event.preventDefault();
        last.focus({ preventScroll: true });
      }
      return;
    }
    if(document.activeElement === last){
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };

  if(root.__partnerFocusTrapCleanup){
    try{ root.__partnerFocusTrapCleanup(); }
    catch(_err){}
  }
  const listenerTarget = shell;
  listenerTarget.addEventListener('keydown', trap);
  root.__partnerFocusTrapCleanup = ()=> listenerTarget.removeEventListener('keydown', trap);

  if(typeof requestAnimationFrame === 'function'){
    requestAnimationFrame(()=>{
      try{ first.focus({ preventScroll: true }); }
      catch(_err){}
    });
  }else{
    try{ first.focus(); }
    catch(_err){}
  }
}

function wireCloseButtons(root){
  if(!root) return;
  const buttons = asArray(root.querySelectorAll('[data-ui="close"], [data-close-partner], [data-close]'));
  buttons.forEach(btn => {
    if(!btn) return;
    if(!btn.getAttribute('data-ui')){
      btn.setAttribute('data-ui', 'close');
      if(btn.dataset) btn.dataset.ui = btn.dataset.ui || 'close';
    }
    if(btn.__partnerCloseHandler) return;
    btn.__partnerCloseHandler = true;
    btn.addEventListener('click', (event)=>{
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      closePartnerEditModal();
    }, { capture: true });
  });
}

function ensurePartnerShell(){
  const existing = findPartnerModal();
  if(existing) return existing;
  const template = typeof document !== 'undefined' ? document.getElementById('partner-modal') : null;
  if(template) return template;
  if(typeof document === 'undefined') return null;
  const host = document.querySelector('[data-ui="modal-root"]')
    || document.body
    || document.documentElement
    || null;
  if(!host) return null;
  const wrapper = document.createElement('div');
  wrapper.id = 'partner-modal';
  wrapper.className = 'modal partner-edit-modal';
  wrapper.innerHTML = '<div class="dlg" tabindex="-1"></div>';
  wrapper.setAttribute('data-ui', 'partner-edit-modal');
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.style.display = 'none';
  if(wrapper.dataset){
    wrapper.dataset.ui = 'partner-edit-modal';
    wrapper.dataset.qa = 'partner-edit-modal';
  }
  host.appendChild(wrapper);
  return wrapper;
}

function resolveInvoker(source){
  if(!source) return null;
  if(source instanceof HTMLElement) return source;
  if(typeof source === 'object'){
    if(source.trigger instanceof HTMLElement) return source.trigger;
    if(source.currentTarget instanceof HTMLElement) return source.currentTarget;
    if(source.target instanceof HTMLElement) return source.target;
  }
  return null;
}

export function closePartnerEditModal(){
  const root = document.querySelector(`[data-modal-key="${MODAL_KEY}"]`) || findPartnerModal();
  if(!root) return;
  const wasOpen = root.dataset?.open === '1'
    || root.getAttribute('aria-hidden') === 'false'
    || root.hasAttribute('open');
  cleanupNodeHandles(root);
  if(root.dataset){
    root.dataset.opening = '0';
  }
  const beforeRemove = (node)=>{
    if(node.dataset){
      node.dataset.open = '0';
      node.dataset.opening = '0';
      node.dataset.partnerId = '';
      node.dataset.sourceHint = '';
    }
    node.setAttribute('aria-hidden', 'true');
    node.classList.add('hidden');
    node.style.display = 'none';
    if(node.hasAttribute('open')) node.removeAttribute('open');
    if(typeof node.removeAttribute === 'function'){
      try{ node.removeAttribute('data-source-hint'); }
      catch(_err){}
    }
    if(wasOpen){
      try{ node.dispatchEvent(new Event('close', { bubbles: false, cancelable: false })); }
      catch(_err){}
    }
  };
  closeSingletonModal(root, { beforeRemove, remove: false });
  const invoker = root.__partnerInvoker || lastInvoker;
  if(invoker && typeof invoker.focus === 'function'){
    try{ invoker.focus({ preventScroll: true }); }
    catch(_err){
      try{ invoker.focus(); }
      catch(__err){}
    }
  }
  root.__partnerInvoker = null;
  lastInvoker = null;
  root.__partnerSourceHint = '';
  if(typeof window !== 'undefined'){
    try{ window.__PARTNER_MODAL_SOURCE_HINT__ = ''; }
    catch(_err){ window.__PARTNER_MODAL_SOURCE_HINT__ = ''; }
  }
}

export async function openPartnerEditModal(id, options){
  const rawPartnerId = id == null ? '' : String(id).trim();
  const normalizedToken = rawPartnerId ? rawPartnerId.toLowerCase() : '';
  const partnerId = rawPartnerId && !INVALID_PARTNER_ID_TOKENS.has(normalizedToken)
    ? rawPartnerId
    : '';
  const requestedId = partnerId || '';

  const sourceHint = options && typeof options.sourceHint === 'string'
    ? options.sourceHint.trim()
    : '';

  const allowAutoOpen = options && options.allowAutoOpen === true;

  if(!partnerId && !allowAutoOpen){
    try {
      console && console.warn && console.warn('[soft] openPartnerEditModal blocked: missing id & allowAutoOpen', {
        sourceHint: sourceHint || '(none)',
        requestedId: rawPartnerId || ''
      });
    } catch (_) {}
    return null;
  }

  if(typeof window !== 'undefined'){
    try{ window.__PARTNER_MODAL_SOURCE_HINT__ = sourceHint; }
    catch(_err){ window.__PARTNER_MODAL_SOURCE_HINT__ = sourceHint; }
  }

  const invoker = resolveInvoker(options);
  if(invoker) lastInvoker = invoker;

  const existing = document.querySelector(`[data-modal-key="${MODAL_KEY}"]`);
  if(existing && existing.dataset?.open === '1' && existing.dataset.partnerId === partnerId){
    if(invoker){
      existing.__partnerInvoker = invoker;
    }
    focusFirstElement(existing);
    return existing;
  }

  if(pendingOpen){
    if((pendingOpen.id || '') === requestedId){
      return pendingOpen.promise.then(node => {
        const resolved = node && node.dataset?.partnerId === requestedId
          ? node
          : findPartnerModal();
        const modal = resolved || node;
        if(modal && invoker){
          modal.__partnerInvoker = invoker;
        }
        return modal;
      });
    }
    return pendingOpen.promise.then(() => openPartnerEditModal(id, options));
  }

  const sequence = (async () => {
    let base = ensureSingletonModal(MODAL_KEY, () => ensurePartnerShell());
    base = base instanceof Promise ? await base : base;
    if(!base) return null;

    if(base.dataset?.opening === '1'){
      return base;
    }

    if(base.dataset){
      base.dataset.opening = '1';
      base.dataset.partnerId = requestedId;
      base.dataset.sourceHint = sourceHint || '';
    }
    base.__partnerInvoker = invoker || base.__partnerInvoker || null;

    hideContactModals();

    const rendered = await renderPartnerEditor(base, partnerId);
    if(!rendered){
      base.dataset.opening = '0';
      return null;
    }

    let root = findPartnerModal();
    if(root !== base && root){
      let ensured = ensureSingletonModal(MODAL_KEY, () => root);
      root = ensured instanceof Promise ? await ensured : ensured;
    }else{
      root = base;
    }
    if(!root) return null;

    const resolvedId = String(rendered.id || partnerId || '');
    if(root.dataset){
      root.dataset.opening = '1';
      root.dataset.partnerId = resolvedId;
      root.dataset.sourceHint = sourceHint || '';
    }
    if(typeof root.setAttribute === 'function'){
      try{
        if(sourceHint){ root.setAttribute('data-source-hint', sourceHint); }
        else{ root.removeAttribute('data-source-hint'); }
      }catch(_err){}
    }
    root.__partnerInvoker = invoker || root.__partnerInvoker || null;
    root.__partnerSourceHint = sourceHint || '';

    cleanupNodeHandles(root);
    registerModalCleanup(root, cleanupNodeHandles);
    ensureModalAttributes(root);
    wireCloseButtons(root);
    installEscHandler(root);
    focusFirstElement(root);
    __closeStrayDialogsOnce();
    const clearOpening = () => {
      if(root.dataset) root.dataset.opening = '0';
    };
    root.addEventListener('shown', clearOpening, { once: true });

    scheduleMicrotask(() => {
      try{ root.dispatchEvent(new Event('shown', { bubbles: false, cancelable: false })); }
      catch(_err){}
    });

    return root;
  })();

  const tracked = sequence.finally(() => {
    pendingOpen = null;
    if(typeof window !== 'undefined'){
      const existing = document.querySelector(`[data-modal-key="${MODAL_KEY}"]`);
      if(!existing || existing.dataset?.open !== '1'){
        try{ window.__PARTNER_MODAL_SOURCE_HINT__ = ''; }
        catch(_err){ window.__PARTNER_MODAL_SOURCE_HINT__ = ''; }
      }
    }
  });
  pendingOpen = { id: requestedId, promise: tracked };
  return tracked;
}

registerModalActions({
  entity: 'partner',
  eventName: 'partner:modal:ready',
  store: 'partners',
  getDialog: detail => detail?.dialog || null,
  getHeader: dialog => dialog?.querySelector?.('.modal-header'),
  getId: dialog => dialog?.dataset?.partnerId || '',
  getNoteField: dialog => dialog?.querySelector?.('#p-notes'),
  getName: dialog => {
    const name = dialog?.querySelector?.('#p-name')?.value?.trim() || '';
    const company = dialog?.querySelector?.('#p-company')?.value?.trim() || '';
    if(name && company) return `${name} · ${company}`;
    return name || company || 'Partner';
  },
  getEmail: dialog => dialog?.querySelector?.('#p-email')?.value?.trim() || '',
  getPhone: dialog => dialog?.querySelector?.('#p-phone')?.value?.trim() || '',
  getReminderLabel: (_dialog, ctx) => {
    if(ctx && ctx.name){
      return `Reminder for ${ctx.name}`;
    }
    return 'Partner reminder';
  }
});

if(typeof document !== 'undefined' && !document.__partnerLinkedWatcher){
  document.__partnerLinkedWatcher = true;
  document.addEventListener('app:data:changed', () => {
    const root = findPartnerModal();
    if(!root || root.dataset?.open !== '1') return;
    const partnerId = root.dataset?.partnerId;
    if(!partnerId) return;
    renderLinkedCustomers(root, partnerId);
  }, { passive: true });
}

if(typeof window !== 'undefined'){
  window.__listPartnersForSelect = async function(){
    await openDB();
    const partners = await dbGetAll('partners');
    return (partners||[]).map(p => ({ id: String(p.id), name: p.name || p.company || '(unnamed)' }));
  };
  if(!window.openPartnerEdit){
    window.openPartnerEdit = function(partnerId, options){
      return openPartnerEditModal(partnerId, options);
    };
  }
}

export default {
  openPartnerEditModal,
  closePartnerEditModal
};
