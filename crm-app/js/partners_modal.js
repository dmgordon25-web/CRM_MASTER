import { createFormFooter } from './ui/form_footer.js';
import './contacts/form.js';
import { registerModalActions } from './contacts/modal.js';

window.CRM = window.CRM || {};

function callToast(kind, message){
  const text = String(message ?? '').trim();
  if(!text) return;
  const api = window.Toast || null;
  if(api && typeof api[kind] === 'function'){
    try { api[kind](text); return; }
    catch (_err) {}
  }
  if(api && typeof api.show === 'function'){
    try { api.show(text); return; }
    catch (_err) {}
  }
  if(typeof window.toast === 'function'){
    try { window.toast(text); }
    catch (_err) {}
  }
}

const toastSuccess = (message) => callToast('success', message);
const toastWarn = (message) => callToast('warn', message);

let partnerModalRoot = null;

function hidePartnerModal(root){
  if(!root) return;
  root.dataset.open = '0';
  root.setAttribute('aria-hidden', 'true');
  root.style.display = 'none';
  root.classList.add('hidden');
  if(root.dataset){
    root.dataset.partnerId = '';
  }
  const handler = root.__partnerKeyHandler;
  if(handler){
    document.removeEventListener('keydown', handler);
    root.__partnerKeyHandler = null;
  }
}

function showPartnerModal(root){
  if(!root) return;
  root.style.display = 'flex';
  root.classList.remove('hidden');
  root.dataset.open = '1';
  root.setAttribute('aria-hidden', 'false');
  const handler = (evt) => {
    if(evt.key === 'Escape'){
      evt.preventDefault();
      hidePartnerModal(root);
    }
  };
  document.addEventListener('keydown', handler);
  root.__partnerKeyHandler = handler;
}

function ensurePartnerModalRoot(){
  if(typeof document === 'undefined') return null;
  if(partnerModalRoot && document.body && document.body.contains(partnerModalRoot)){
    return partnerModalRoot;
  }
  const legacy = document.getElementById('partner-modal');
  if(legacy){
    if(legacy.tagName && legacy.tagName.toUpperCase() === 'DIALOG'){
      const wrapper = document.createElement('div');
      wrapper.id = 'partner-modal';
      const legacyClass = legacy.className ? legacy.className.trim() : '';
      wrapper.className = legacyClass ? legacyClass : '';
      if(!wrapper.classList.contains('modal')) wrapper.classList.add('modal');
      wrapper.classList.add('partner-edit-modal');
      wrapper.dataset.qa = 'partner-edit-modal';
      wrapper.setAttribute('role', 'dialog');
      wrapper.setAttribute('aria-modal', 'true');
      wrapper.setAttribute('aria-hidden', 'true');
      wrapper.style.display = 'none';
      wrapper.innerHTML = legacy.innerHTML;
      legacy.replaceWith(wrapper);
      partnerModalRoot = wrapper;
    }else{
      legacy.dataset.qa = 'partner-edit-modal';
      legacy.setAttribute('role', 'dialog');
      legacy.setAttribute('aria-modal', 'true');
      legacy.setAttribute('aria-hidden', legacy.getAttribute('aria-hidden') || 'true');
      if(!legacy.classList.contains('modal')) legacy.classList.add('modal');
      legacy.classList.add('partner-edit-modal');
      legacy.style.display = legacy.style.display || 'none';
      partnerModalRoot = legacy;
    }
  }else{
    const wrapper = document.createElement('div');
    wrapper.id = 'partner-modal';
    wrapper.className = 'modal partner-edit-modal';
    wrapper.dataset.qa = 'partner-edit-modal';
    wrapper.setAttribute('role', 'dialog');
    wrapper.setAttribute('aria-modal', 'true');
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.style.display = 'none';
    wrapper.innerHTML = '<div class="dlg" tabindex="-1"></div>';
    (document.body || document.documentElement || document.createElement('div')).appendChild(wrapper);
    partnerModalRoot = wrapper;
  }
  const shell = partnerModalRoot?.querySelector?.('.dlg');
  if(shell && typeof shell.setAttribute === 'function'){
    shell.setAttribute('tabindex', shell.getAttribute('tabindex') || '-1');
  }
  if(partnerModalRoot && !partnerModalRoot.dataset.qa){
    partnerModalRoot.dataset.qa = 'partner-edit-modal';
  }
  if(partnerModalRoot && !partnerModalRoot.__overlayWired){
    partnerModalRoot.__overlayWired = true;
    partnerModalRoot.addEventListener('mousedown', evt => {
      if(evt.target === partnerModalRoot){
        hidePartnerModal(partnerModalRoot);
      }
    });
  }
  return partnerModalRoot;
}

export function openPartnerQuickCreate(cb){
  window.CRM = window.CRM || {};
  const existing = document.querySelector('dialog[data-qa="partner-quick-create"]');
  if(existing){
    try{ existing.close(); }
    catch (_) {}
    existing.remove();
  }

  const dialog = document.createElement('dialog');
  dialog.className = 'modal partner-quick-create-modal';
  dialog.setAttribute('data-qa', 'partner-quick-create');
  dialog.innerHTML = `
    <form method="dialog" class="modal-shell" data-quick-partner>
      <header class="modal-header">
        <h2>Quick Partner</h2>
      </header>
      <div class="modal-body">
        <label>Name<input name="partner-name" type="text" autocomplete="name" required></label>
        <label>Email<input name="partner-email" type="email" autocomplete="email"></label>
        <p class="field-error" data-role="error" hidden>Name is required</p>
      </div>
      <footer class="modal-footer">
        <button type="button" class="btn" data-action="cancel">Cancel</button>
        <button type="submit" class="btn brand" data-action="submit">Save</button>
      </footer>
    </form>`;

  const form = dialog.querySelector('form');
  const nameInput = form?.querySelector('input[name="partner-name"]');
  const emailInput = form?.querySelector('input[name="partner-email"]');
  const errorEl = form?.querySelector('[data-role="error"]');
  const cancelBtn = form?.querySelector('[data-action="cancel"]');
  const submitBtn = form?.querySelector('[data-action="submit"]');

  if(!form || !nameInput || !cancelBtn || !submitBtn){
    console.warn('partner quick create modal failed to initialize');
    return;
  }

  const host = document.body || document.documentElement || document.createElement('div');

  const clearError = ()=>{
    if(errorEl){
      errorEl.hidden = true;
    }
    nameInput.removeAttribute('aria-invalid');
    nameInput.classList.remove('input-error');
  };

  const showError = (msg)=>{
    if(errorEl){
      errorEl.textContent = msg;
      errorEl.hidden = false;
    }
    nameInput.setAttribute('aria-invalid', 'true');
    nameInput.classList.add('input-error');
    if(typeof nameInput.focus === 'function') nameInput.focus();
  };

  const closeModal = ()=>{
    try{ dialog.close(); }
    catch (_) { dialog.removeAttribute('open'); }
    dialog.remove();
  };

  dialog.addEventListener('close', ()=>{
    if(dialog.parentNode){
      dialog.parentNode.removeChild(dialog);
    }
  });

  dialog.addEventListener('cancel', (evt)=>{
    evt.preventDefault();
    closeModal();
  });

  cancelBtn.addEventListener('click', (evt)=>{
    evt.preventDefault();
    closeModal();
  });

  nameInput.addEventListener('input', ()=>{
    if(nameInput.value.trim()) clearError();
  });

  form.addEventListener('submit', async (evt)=>{
    evt.preventDefault();
    clearError();
    if(form.dataset.submitting === '1') return;
    const name = nameInput.value.trim();
    if(!name){
      const message = 'Name is required';
      showError(message);
      if(window.Toast?.show) window.Toast.show(message);
      return;
    }
    form.dataset.submitting = '1';
    submitBtn.disabled = true;
    cancelBtn.disabled = true;
    const email = emailInput?.value?.trim() || '';
    try{
      await openDB();
      const now = Date.now();
      const id = typeof window.uuid === 'function' ? window.uuid() : `partner-${now}`;
      const record = {
        id,
        name,
        email,
        company:'',
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
        collaborationFocus:'Co-Marketing',
        createdAt: now,
        updatedAt: now
      };
      await dbPut('partners', record);
      const detail = {
        scope:'partners',
        partnerId:String(record.id || ''),
        action:'create',
        source:'partner:quick-create'
      };
      if(typeof window.dispatchAppDataChanged === 'function'){
        window.dispatchAppDataChanged(detail);
      }else{
        document.dispatchEvent(new CustomEvent('app:data:changed', { detail }));
      }
      closeModal();
      const payload = { id: record.id, name: record.name, email: record.email };
      if(typeof cb === 'function'){
        try{ cb(payload); }
        catch (err) { console.warn('partner quick create callback failed', err); }
      }
      if(window.Toast?.show) window.Toast.show('Partner created');
    }catch (err){
      console.warn('partner quick create failed', err);
      if(window.Toast?.show) window.Toast.show('Unable to create partner');
    }finally{
      form.dataset.submitting = '0';
      submitBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  });

  host.appendChild(dialog);
  try{ dialog.showModal(); }
  catch (_) { dialog.setAttribute('open',''); dialog.style.display = 'block'; }
  clearError();
  if(typeof requestAnimationFrame === 'function'){
    requestAnimationFrame(()=>{
      if(typeof nameInput.focus === 'function') nameInput.focus();
    });
  }else if(typeof nameInput.focus === 'function'){
    nameInput.focus();
  }
}

window.CRM.openPartnerQuickCreate = openPartnerQuickCreate;

// partners_modal.js — enriched partner modal layout & persistence
(function(){
  if(!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
  if(window.__INIT_FLAGS__.partners_modal) return;
  window.__INIT_FLAGS__.partners_modal = true;

  ensurePartnerModalRoot();

  async function loadPartner(id){
    await openDB();
    return id ? (await dbGet('partners', id)) : null;
  }
  function el(id){ return document.getElementById(id); }
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

  function normalizeStage(stage){
    const canonFn = typeof window.canonicalizeStage === 'function' ? window.canonicalizeStage : (val)=> String(val||'').toLowerCase().trim();
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
    const first = String(contact.first||'').trim();
    const last = String(contact.last||'').trim();
    if(first || last){
      return (first[0]||'').toUpperCase() + (last[0]||first[1]||'').toUpperCase();
    }
    const alt = String(contact.name||contact.email||contact.company||'?').trim();
    return (alt[0]||'?').toUpperCase();
  }

  function contactDisplayName(contact){
    const parts = [String(contact.first||'').trim(), String(contact.last||'').trim()].filter(Boolean);
    return parts.length ? parts.join(' ') : (contact.name || contact.company || 'Unnamed Contact');
  }

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

  function fillStateSelect(select, current){
    if(!select) return;
    select.innerHTML = STATES.map(({value,label})=>`<option value="${value}">${label}</option>`).join('');
    select.value = current || '';
  }

  function updateSummary(){
    const dlg = el('partner-modal');
    if(!dlg) return;
    const name = el('p-name')?.value?.trim() || 'New Partner';
    const company = el('p-company')?.value?.trim();
    const tier = el('p-tier')?.value || 'Developing';
    const type = el('p-type')?.value || 'Realtor Partner';
    const focus = el('p-focus')?.value || 'Purchase';
    const cadence = el('p-cadence')?.value || 'Monthly';
    const summaryName = el('p-summary-name');
    const summaryTier = el('p-summary-tier');
    const summaryType = el('p-summary-type');
    const summaryFocus = el('p-summary-focus');
    const summaryCad = el('p-summary-cadence');
    const note = el('p-summary-note');
    if(summaryName) summaryName.textContent = company ? `${name} · ${company}` : name;
    if(summaryTier) summaryTier.textContent = `Tier — ${tier}`;
    if(summaryType) summaryType.textContent = type;
    if(summaryFocus) summaryFocus.textContent = focus;
    if(summaryCad) summaryCad.textContent = cadence;
    if(note){
      if(tier==='Top'){ note.textContent = 'Protect this champion: coordinate joint client reviews and highlight wins quarterly.'; }
      else if(tier==='Core'){ note.textContent = 'Stay relevant with monthly value drops, co-marketing, and proactive status updates.'; }
      else { note.textContent = 'Build trust with intentional follow-up and invite them into your client experience.'; }
    }
  }

  async function renderLinkedCustomers(partnerId){
    const wrap = el('partner-linked');
    const summary = el('partner-linked-summary');
    const summaryMetric = el('p-summary-linked');
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
      console.warn('renderLinkedCustomers', err);
    }
  }

  async function renderPartnerModal(id){
    const dlg = ensurePartnerModalRoot();
    if(!dlg){
      toastWarn('Partner not found');
      return;
    }
    await openDB();
    const loaded = await loadPartner(id);
    if(id && !loaded){
      toastWarn('Partner not found');
      return;
    }
    const base = {
      id: (id || String(Date.now())),
      name:'', company:'', email:'', phone:'', tier:'Developing', notes:'',
      partnerType:'Realtor Partner', focus:'Purchase', priority:'Emerging',
      preferredContact:'Phone', cadence:'Monthly', address:'', city:'', state:'', zip:'',
      referralVolume:'1-2 / month', lastTouch:'', nextTouch:'', relationshipOwner:'',
      collaborationFocus:'Co-Marketing'
    };
    const p = Object.assign(base, loaded||{});
    el('partner-title').textContent = (loaded && id) ? 'Edit Partner' : 'Add Partner';
    dlg.dataset.partnerId = String(p.id || '');
    dlg.__currentPartnerBase = Object.assign({}, p);
    dlg.__partnerWasSaved = Boolean(loaded && loaded.id);

    const partnerForm = dlg.querySelector('#partner-form');
    if(partnerForm){
      partnerForm.reset();
      partnerForm.querySelectorAll('input,select,textarea').forEach(ctrl => {
        if(ctrl.tagName==='SELECT'){ ctrl.selectedIndex = 0; }
        else ctrl.value = '';
      });
    }

    const map = {
      'p-name': p.name||'',
      'p-company': p.company||'',
      'p-email': p.email||'',
      'p-phone': p.phone||'',
      'p-type': p.partnerType||'Realtor Partner',
      'p-tier': p.tier||'Developing',
      'p-focus': p.focus||'Purchase',
      'p-priority': p.priority||'Emerging',
      'p-pref': p.preferredContact||'Phone',
      'p-cadence': p.cadence||'Monthly',
      'p-address': p.address||'',
      'p-city': p.city||'',
      'p-zip': p.zip||'',
      'p-volume': p.referralVolume||'1-2 / month',
      'p-lasttouch': (p.lastTouch||'').slice(0,10),
      'p-nexttouch': (p.nextTouch||'').slice(0,10),
      'p-owner': p.relationshipOwner||'',
      'p-collab': p.collaborationFocus||'Co-Marketing',
      'p-notes': p.notes||''
    };
    Object.entries(map).forEach(([key,val])=>{
      const node = el(key);
      if(!node) return;
      if(node.tagName==='SELECT') node.value = val;
      else node.value = val;
    });
    fillStateSelect(el('p-state'), (p.state||'').toUpperCase());

    document.dispatchEvent(new CustomEvent('partner:modal:ready', {
      detail: {
        dialog: dlg,
        form: partnerForm,
        record: p
      }
    }));

    await renderLinkedCustomers(p.id);

    const closeDialog = ()=>{
      hidePartnerModal(dlg);
      dlg.dataset.partnerId = '';
    };

    let footerHandle = dlg.__partnerFooter;
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
          dlg.__partnerFooter = footerHandle;
        }
        footerHandle.saveButton.textContent = 'Save Partner';
        footerHandle.cancelButton.textContent = 'Cancel';
      }
    }

    const btnSave = el('p-save');
    if(btnSave && !btnSave.__wired){
      btnSave.__wired = true;
      btnSave.addEventListener('click', async (e)=>{
        e.preventDefault();
        const baseRecord = Object.assign({}, dlg.__currentPartnerBase || {});
        if(!baseRecord.id){
          baseRecord.id = dlg.dataset.partnerId || String(Date.now());
        }
        const rec = Object.assign({}, baseRecord, {
          id: baseRecord.id,
          name: el('p-name').value.trim(),
          company: el('p-company').value.trim(),
          email: el('p-email').value.trim(),
          phone: el('p-phone').value.trim(),
          partnerType: el('p-type').value,
          tier: el('p-tier').value,
          focus: el('p-focus').value,
          priority: el('p-priority').value,
          preferredContact: el('p-pref').value,
          cadence: el('p-cadence').value,
          address: el('p-address').value.trim(),
          city: el('p-city').value.trim(),
          state: (el('p-state')?.value||'').toUpperCase(),
          zip: el('p-zip').value.trim(),
          referralVolume: el('p-volume').value,
          lastTouch: el('p-lasttouch').value,
          nextTouch: el('p-nexttouch').value,
          relationshipOwner: el('p-owner').value.trim(),
          collaborationFocus: el('p-collab').value,
          notes: el('p-notes').value,
          updatedAt: Date.now()
        });
        dlg.__currentPartnerBase = Object.assign({}, rec);
        dlg.dataset.partnerId = String(rec.id || '');
        await dbPut('partners', rec);
        const action = dlg.__partnerWasSaved ? 'update' : 'create';
        const detail = {
          scope:'partners',
          partnerId:String(rec.id||''),
          action,
          source:'partner:modal'
        };
        if(typeof window.dispatchAppDataChanged === 'function'){
          window.dispatchAppDataChanged(detail);
        }else{
          document.dispatchEvent(new CustomEvent('app:data:changed',{detail}));
        }
        if(action === 'update'){
          toastSuccess('Partner updated');
        }else{
          toastSuccess('Partner created');
        }
        dlg.__partnerWasSaved = true;
        closeDialog();
      });
    }

    if(partnerForm && !partnerForm.__wired){
      partnerForm.__wired = true;
      partnerForm.addEventListener('submit', (e)=>{
        e.preventDefault();
        btnSave?.click();
      });
    }

    dlg.querySelectorAll('input,select,textarea').forEach(ctrl=>{
      if(!ctrl.__summaryBound){
        ctrl.__summaryBound = true;
        ctrl.addEventListener('input', updateSummary);
        ctrl.addEventListener('change', updateSummary);
      }
    });
    const tabNav = dlg.querySelector('#partner-tabs');
    const showPanel = (target)=>{
      const key = target || 'overview';
      dlg.querySelectorAll('.partner-panel').forEach(panel=>{
        panel.classList.toggle('active', panel.getAttribute('data-panel')===key);
      });
      if(tabNav){
        tabNav.querySelectorAll('button[data-panel]').forEach(btn=>{
          btn.classList.toggle('active', btn.getAttribute('data-panel')===key);
        });
      }
    };
    if(tabNav && !tabNav.__wired){
      tabNav.__wired = true;
      tabNav.addEventListener('click', (evt)=>{
        const btn = evt.target.closest('button[data-panel]');
        if(!btn) return;
        evt.preventDefault();
        showPanel(btn.getAttribute('data-panel'));
      });
    }
    showPanel('overview');
    updateSummary();

    const closeBtn = dlg.querySelector('[data-close-partner]');
    if(closeBtn && !closeBtn.__wired){
      closeBtn.__wired = true;
      closeBtn.addEventListener('click', (evt)=>{
        evt.preventDefault();
        closeDialog();
      });
    }

    showPartnerModal(dlg);
    const shell = dlg.querySelector('.dlg');
    if(shell && typeof shell.focus==='function'){
      shell.focus({preventScroll:true});
    }
  }

  window.renderPartnerModal = renderPartnerModal;

  // Helper for select lists elsewhere
  window.__listPartnersForSelect = async function(){
    await openDB();
    const ps = await dbGetAll('partners');
    return (ps||[]).map(p=>({id:String(p.id), name:p.name||p.company||'(unnamed)'}));
  };

  if(!document.__partnerLinkedWatcher){
    document.__partnerLinkedWatcher = true;
    document.addEventListener('app:data:changed', (evt)=>{
      const dlg = el('partner-modal');
      if(!dlg || dlg.dataset.open !== '1') return;
      const partnerId = dlg.dataset.partnerId;
      if(!partnerId) return;
      renderLinkedCustomers(partnerId);
    }, {passive:true});
  }

  const pending = window.__PARTNER_MODAL_QUEUE__;
  if(Array.isArray(pending) && pending.length){
    delete window.__PARTNER_MODAL_QUEUE__;
    pending.forEach(id => {
      try{ renderPartnerModal(id); }
      catch (err) { console.warn('partner modal pending open failed', err); }
    });
  }
})();

export async function openPartnerEdit(id){
  const partnerId = id == null ? '' : String(id).trim();
  if(!partnerId){
    toastWarn('Partner not found');
    return;
  }
  const root = ensurePartnerModalRoot();
  if(!root){
    toastWarn('Partner not found');
    return;
  }
  if(root.dataset.open === '1' && root.dataset.partnerId === partnerId){
    return;
  }
  if(typeof window.renderPartnerModal !== 'function'){
    toastWarn('Partner not found');
    return;
  }
  await window.renderPartnerModal(partnerId);
}

window.openPartnerEdit = window.openPartnerEdit || openPartnerEdit;

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
