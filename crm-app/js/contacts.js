import { createFormFooter } from './ui/form_footer.js';
import { setReferredBy } from './contacts/form.js';
import {
  renderStageChip,
  canonicalStage,
  STAGES as CANONICAL_STAGE_META,
  toneForStage,
  toneForStatus,
  toneClassName,
  TONE_CLASSNAMES
} from './pipeline/constants.js';
import { toastError, toastInfo, toastSuccess, toastWarn } from './ui/toast_helpers.js';
import { TOUCH_OPTIONS, createTouchLogEntry, formatTouchDate, touchSuccessMessage } from './util/touch_log.js';
import { ensureFavoriteState, renderFavoriteToggle } from './util/favorites.js';

// contacts.js — modal guards + renderer (2025-09-17)
(function(){
  if(!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
  if(window.__INIT_FLAGS__.contacts_modal_guards) return;
  window.__INIT_FLAGS__.contacts_modal_guards = true;

  const $ = (s,r=document)=>r.querySelector(s);
  const escape = (val)=> String(val||'').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const notify = (msg, kind = 'info')=>{
    const text = String(msg ?? '').trim();
    if(!text) return;
    try{
      if(kind === 'warn') {
        toastWarn(text);
      } else if(kind === 'error') {
        toastError(text);
      } else {
        toastInfo(text);
      }
    }catch (_) {
      try { console && console.info && console.info('[contacts]', text); }
      catch(__err){}
    }
  };

  const removeToneClasses = (node)=>{
    if(!node || !node.classList) return;
    TONE_CLASSNAMES.forEach((cls)=> node.classList.remove(cls));
  };

  const buildStageFallback = (label, source)=>{
    const stageLabel = label || 'Stage';
    const toneKey = toneForStage(source || stageLabel);
    const toneClass = toneClassName(toneKey);
    const classSuffix = toneClass ? ` ${toneClass}` : '';
    const toneAttr = toneKey ? ` data-tone="${toneKey}"` : '';
    return `<span class="stage-chip stage-generic${classSuffix}" data-role="stage-chip" data-qa="stage-chip-generic"${toneAttr}>${escape(stageLabel)}</span>`;
  };

  const STAGES = [
    {value:'application', label:'Application'},
    {value:'preapproved', label:'Pre-Approved'},
    {value:'processing', label:'Processing'},
    {value:'underwriting', label:'Underwriting'},
    {value:'approved', label:'Approved'},
    {value:'cleared-to-close', label:'Cleared to Close'},
    {value:'funded', label:'Funded'},
    {value:'post-close', label:'Post-Close'},
    {value:'nurture', label:'Nurture'},
    {value:'lost', label:'Lost'},
    {value:'denied', label:'Denied'}
  ];
  const STAGE_FLOW = ['application','processing','underwriting','approved','cleared-to-close','funded','post-close'];
  const STAGE_AUTOMATIONS = {
    application: 'Creates welcome tasks, kicks off the doc checklist, and schedules a first follow-up reminder.',
    preapproved: 'Confirms credit docs, arms borrowers with next steps, and keeps partners in the loop.',
    processing: 'Alerts processing teammates, syncs missing documents, and tightens the follow-up cadence.',
    underwriting: 'Logs underwriting review, sets condition tracking tasks, and updates partner status digests.',
    approved: 'Preps clear-to-close outreach, nudges partners with status updates, and confirms closing logistics.',
    'cleared-to-close': 'Queues closing packet reminders, notifies settlement partners, and schedules celebration touch points.',
    funded: 'Triggers post-closing nurture, partner thank-yous, and review requests for the borrower.',
    'post-close': 'Launches annual reviews, referrals, and gifting automations for happy clients.',
    nurture: 'Keeps long-term prospects warm with periodic value touches and partner updates.',
    lost: 'Documents outcome, schedules re-engagement, and captures learnings for the team.',
    denied: 'Captures denial reasons, assigns compliance follow-ups, and plans credit repair touchpoints.'
  };
  const STATUSES = [
    {value:'inprogress', label:'In Progress'},
    {value:'active', label:'Active'},
    {value:'client', label:'Client'},
    {value:'paused', label:'Paused'},
    {value:'lost', label:'Lost'},
    {value:'nurture', label:'Nurture'}
  ];
  const CONTACT_TYPES = [
    'Borrower','Co-Borrower','Past Client','Referral Partner','Agent / Partner','Builder','Financial Advisor','Other'
  ];
  const PRIORITIES = ['Hot','Warm','Nurture','Dormant'];
  const LEAD_SOURCES = ['Sphere of Influence','Realtor Partner','Online Lead','Past Client','Builder','Financial Advisor','Marketing Campaign','Walk-In','Other'];
  const COMM_PREFS = ['Phone','Text','Email','Video Call','In Person'];
  const TIMELINES = ['Ready Now','30 Days','60 Days','90+ Days','TBD'];
  const LOAN_PURPOSES = ['Purchase','Cash-Out Refinance','Rate/Term Refinance','Construction','Investment','HELOC','Reverse Mortgage'];
  const LOAN_PROGRAMS = ['Conventional','FHA','VA','USDA','Jumbo','Non-QM','HELOC','Bridge','Other'];
  const PROPERTY_TYPES = ['Single-Family','Condo','Townhome','2-4 Unit','Multi-Family (5+)','Manufactured','New Construction','Land'];
  const OCCUPANCY = ['Primary Residence','Second Home','Investment'];
  const CREDIT_BANDS = ['760+','720-759','680-719','640-679','600-639','<600','Unknown'];
  const EMPLOYMENT = ['W-2','1099','Self-Employed','Retired','Student','Other'];
  const DOC_STAGES = [
    {value:'application-started', label:'Application Started'},
    {value:'needs-docs', label:'Needs Docs'},
    {value:'submitted-to-uw', label:'Submitted to UW'},
    {value:'conditional-approval', label:'Conditional Approval'},
    {value:'clear-to-close', label:'Clear to Close'},
    {value:'post-closing', label:'Post-Closing'}
  ];
  const PIPELINE_MILESTONES = [
    'Intro Call','Application Sent','Application Submitted','UW in Progress','Conditions Out','Clear to Close','Docs Out','Funded / Post-Close'
  ];

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
  function contactAvatarSource(contact){
    if(!contact) return '';
    const first = String(contact.first||'').trim();
    const last = String(contact.last||'').trim();
    if(first || last) return `${first} ${last}`.trim();
    if(contact.name) return String(contact.name||'').trim();
    if(contact.email) return String(contact.email||'').trim();
    if(contact.company) return String(contact.company||'').trim();
    return '';
  }
  function renderAvatarSpan(name, role){
    const initials = computeAvatarInitials(name);
    const classes = ['initials-avatar'];
    if(!initials) classes.push('is-empty');
    const roleAttr = role ? ` data-role="${escape(role)}"` : '';
    const value = initials || '?';
    return `<span class="${classes.join(' ')}"${roleAttr} aria-hidden="true" data-initials="${escape(value)}"></span>`;
  }
  function applyAvatar(el, name, fallback){
    if(!el) return;
    const initials = computeAvatarInitials(name);
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
  const STATES = [
    {value:'', label:'Select state'},
    {value:'AL', label:'Alabama'},
    {value:'AK', label:'Alaska'},
    {value:'AZ', label:'Arizona'},
    {value:'AR', label:'Arkansas'},
    {value:'CA', label:'California'},
    {value:'CO', label:'Colorado'},
    {value:'CT', label:'Connecticut'},
    {value:'DE', label:'Delaware'},
    {value:'DC', label:'District of Columbia'},
    {value:'FL', label:'Florida'},
    {value:'GA', label:'Georgia'},
    {value:'HI', label:'Hawaii'},
    {value:'ID', label:'Idaho'},
    {value:'IL', label:'Illinois'},
    {value:'IN', label:'Indiana'},
    {value:'IA', label:'Iowa'},
    {value:'KS', label:'Kansas'},
    {value:'KY', label:'Kentucky'},
    {value:'LA', label:'Louisiana'},
    {value:'ME', label:'Maine'},
    {value:'MD', label:'Maryland'},
    {value:'MA', label:'Massachusetts'},
    {value:'MI', label:'Michigan'},
    {value:'MN', label:'Minnesota'},
    {value:'MS', label:'Mississippi'},
    {value:'MO', label:'Missouri'},
    {value:'MT', label:'Montana'},
    {value:'NE', label:'Nebraska'},
    {value:'NV', label:'Nevada'},
    {value:'NH', label:'New Hampshire'},
    {value:'NJ', label:'New Jersey'},
    {value:'NM', label:'New Mexico'},
    {value:'NY', label:'New York'},
    {value:'NC', label:'North Carolina'},
    {value:'ND', label:'North Dakota'},
    {value:'OH', label:'Ohio'},
    {value:'OK', label:'Oklahoma'},
    {value:'OR', label:'Oregon'},
    {value:'PA', label:'Pennsylvania'},
    {value:'RI', label:'Rhode Island'},
    {value:'SC', label:'South Carolina'},
    {value:'SD', label:'South Dakota'},
    {value:'TN', label:'Tennessee'},
    {value:'TX', label:'Texas'},
    {value:'UT', label:'Utah'},
    {value:'VT', label:'Vermont'},
    {value:'VA', label:'Virginia'},
    {value:'WA', label:'Washington'},
    {value:'WV', label:'West Virginia'},
    {value:'WI', label:'Wisconsin'},
    {value:'WY', label:'Wyoming'}
  ];

  const optionList = (items, current)=>{
    const seen = new Set();
    const opts = items.map(item=>{
      const value = typeof item==='string'?item:item.value;
      const label = typeof item==='string'?item:(item.label||item.value||'');
      seen.add(String(value));
      const selected = String(current||'')===String(value)?' selected':'';
      return `<option value="${escape(value)}"${selected}>${escape(label)}</option>`;
    });
    if(current && !seen.has(String(current))){
      opts.unshift(`<option value="${escape(current)}" selected>${escape(current)}</option>`);
    }
    return opts.join('');
  };
  const findLabel = (list, value)=>{
    const item = list.find(it=> String(typeof it==='string'?it:it.value)===String(value||''));
    if(!item) return '';
    return typeof item==='string'?item:(item.label||item.value||'');
  };


  function ensureModal(){
    let dlg = document.getElementById('contact-modal');
    if(!dlg){
      dlg = document.createElement('dialog');
      dlg.id = 'contact-modal';
      dlg.classList.add('record-modal');
      dlg.innerHTML = '<div class="dlg"><form class="modal-form-shell" method="dialog"><div class="modal-header"><h3 class="grow modal-title">Add / Edit Contact</h3><button type="button" class="btn ghost" data-close>Close</button></div><div class="dialog-scroll"><div class="modal-body" id="contact-modal-body"></div></div><div class="modal-footer" data-form-footer="contact"><button class="btn" data-close type="button">Cancel</button><button class="btn brand" id="btn-save-contact" type="button" value="default">Save Contact</button></div></form></div>';
      document.body.appendChild(dlg);
    }
    if(!dlg.__wired){
      dlg.__wired = true;
      const markClosed = ()=>{
        try{ dlg.removeAttribute('open'); }catch (_){ }
        try{ dlg.style.display='none'; }catch (_){ }
      };
      dlg.addEventListener('click', (e)=>{
        if(e.target.matches('[data-close]')){
          e.preventDefault();
          try{ dlg.close(); }
          catch (_){ markClosed(); }
          markClosed();
        }
      });
      dlg.addEventListener('cancel', (e)=>{ e.preventDefault(); markClosed(); });
      dlg.addEventListener('close', markClosed);
    }
    return dlg;
  }

  window.renderContactModal = async function(contactId){
    const dlg = ensureModal();
    if(dlg.hasAttribute('open')){ try{ dlg.close(); }catch (_) {} }
    dlg.style.display='block';
    let opened = false;
    if(typeof dlg.showModal === 'function'){
      try{ dlg.showModal(); opened = true; }
      catch (_err){}
    }
    if(!opened){
      try{ dlg.setAttribute('open',''); }
      catch (_){ }
    }
    try{ dlg.setAttribute('open',''); }
    catch (_){ }

    const ensureModalAddButton = ()=>{
      const bodyHost = dlg.querySelector('.modal-body');
      if(!bodyHost) return;
      let btn = bodyHost.querySelector('button[data-role="contact-modal-add-contact"]');
      if(!btn){
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn brand';
        btn.dataset.role = 'contact-modal-add-contact';
        btn.setAttribute('aria-label', 'Add Contact');
        btn.setAttribute('title', 'Add Contact');
        btn.style.marginBottom = '12px';
        bodyHost.insertBefore(btn, bodyHost.firstChild || null);
      }
      if(btn){
        const ensureContent = ()=>{
          const icon = btn.querySelector('.btn-icon');
          const label = btn.querySelector('.btn-label');
          if(icon && label){
            label.textContent = 'Add Contact';
            return;
          }
          btn.innerHTML = '';
          const iconEl = document.createElement('span');
          iconEl.className = 'btn-icon';
          iconEl.setAttribute('aria-hidden', 'true');
          iconEl.textContent = '+';
          const labelEl = document.createElement('span');
          labelEl.className = 'btn-label';
          labelEl.textContent = 'Add Contact';
          btn.append(iconEl, labelEl);
        };
        ensureContent();
      }
      if(!btn.__wired){
        btn.__wired = true;
        btn.addEventListener('click', (event)=>{
          event.preventDefault();
          try{ dlg.close(); }
          catch (_err){}
          try{ dlg.removeAttribute('open'); }
          catch (_err){}
          try{ dlg.style.display = 'none'; }
          catch (_err){}
          Promise.resolve().then(()=>{
            try{
              window.renderContactModal?.(null);
            }catch (err){
              if(console && typeof console.warn === 'function'){
                console.warn('contact modal add contact reopen failed', err);
              }
            }
          });
        });
      }
    };

    ensureModalAddButton();

    const closeDialog = ()=>{
      try{ dlg.close(); }
      catch (_){ }
      try{ dlg.removeAttribute('open'); }
      catch (_){ }
      try{ dlg.style.display='none'; }
      catch (_){ }
    };

    await openDB();
    const [contacts, partners] = await Promise.all([dbGetAll('contacts'), dbGetAll('partners')]);
    const c = contacts.find(x=> String(x.id)===String(contactId)) || {
      id: (window.uuid?uuid():String(Date.now())),
      first:'', last:'', email:'', phone:'', address:'', city:'', state:'', zip:'',
      stage:'application', stageEnteredAt:new Date().toISOString(), status:'inprogress', loanAmount:'', rate:'', fundedDate:'',
      buyerPartnerId:null, listingPartnerId:null, lastContact:'', referredBy:'', notes:'',
      contactType:'Borrower', priority:'Warm', leadSource:'', communicationPreference:'Phone',
      closingTimeline:'Ready Now', loanPurpose:'Purchase', loanProgram:'Conventional', loanType:'Conventional',
      propertyType:'Single-Family', occupancy:'Primary Residence', creditRange:'Unknown', employmentType:'W-2',
      docStage:'application-started', pipelineMilestone:'Intro Call', preApprovalExpires:'', nextFollowUp:'',
      secondaryEmail:'', secondaryPhone:'', missingDocs:''
    };
    const opts = partners.map(p=>{
      const id = escape(String(p.id));
      const name = escape(p.name||'—');
      const company = p.company ? ` — ${escape(p.company)}` : '';
      return `<option value="${id}">${name}${company}</option>`;
    }).join('');
    const body = dlg.querySelector('#contact-modal-body');
    const stageLabel = findLabel(STAGES, c.stage) || 'Application';
    const stageCanonicalKey = canonicalStage(c.stage) || canonicalStage(stageLabel);
    const stageFallbackChip = buildStageFallback(stageLabel, c.stage);
    const stageChip = renderStageChip(c.stage) || renderStageChip(stageLabel) || stageFallbackChip;
    const stageCanonicalAttr = stageCanonicalKey ? ` data-stage-canonical="${escape(stageCanonicalKey)}"` : '';
    const statusLabel = findLabel(STATUSES, c.status) || 'In Progress';
    const statusToneKey = toneForStatus(c.status);
    const statusToneClass = toneClassName(statusToneKey);
    const statusToneAttr = statusToneKey ? ` data-tone="${statusToneKey}"` : '';
    const statusPillHtml = `<span class="status-pill${statusToneClass ? ` ${statusToneClass}` : ''}" data-status="${escape(c.status||'inprogress')}"${statusToneAttr}>${escape(statusLabel)}</span>`;
    const fmtCurrency = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
    const loanMetric = Number(c.loanAmount||0)>0 ? fmtCurrency.format(Number(c.loanAmount||0)) : 'TBD';
    const nextTouch = (c.nextFollowUp||'').slice(0,10) || (c.closingTimeline||'TBD');
    const stageSliderMarks = STAGE_FLOW.map((stage, idx)=> `<span class="stage-slider-mark" data-index="${idx}" data-stage="${escape(stage)}">${idx+1}</span>`).join('');
    const stageSliderLabels = STAGE_FLOW.map(stage=> `<span>${escape(findLabel(STAGES, stage) || stage)}</span>`).join('');
    const firstName = String(c.first||'').trim();
    const lastName = String(c.last||'').trim();
    const summaryLabel = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : 'New Contact';
    const summaryAvatarMarkup = renderAvatarSpan(contactAvatarSource(c), 'summary-avatar');
    const favoriteState = ensureFavoriteState();
    const isFavoriteContact = favoriteState.contacts.has(String(c.id || ''));
    const favoriteToggleHtml = renderFavoriteToggle('contact', c.id, isFavoriteContact);
    const summaryClasses = ['summary-name'];
    if(isFavoriteContact) summaryClasses.push('is-favorite');
    const summaryFavoriteAttr = isFavoriteContact ? ' data-favorite="1"' : '';
    const summaryIdAttr = escape(c.id || '');
    body.innerHTML = `
      <input type="hidden" id="c-id" value="${escape(c.id||'')}">
      <input type="hidden" id="c-lastname" value="${escape(c.last||'')}">
      <div class="modal-form-layout">
        <aside class="modal-summary">
          <div class="${summaryClasses.join(' ')}" data-role="favorite-host" data-favorite-type="contact" data-record-id="${summaryIdAttr}"${summaryFavoriteAttr}>
            ${summaryAvatarMarkup}
            <span class="summary-name-text" data-role="summary-name-text">${escape(summaryLabel)}</span>
            <span class="summary-actions" data-role="favorite-actions">${favoriteToggleHtml}</span>
          </div>
          <div class="summary-meta">
            <span data-role="stage-chip-wrapper" data-stage="${escape(c.stage||'application')}"${stageCanonicalAttr}>${stageChip}</span>
            ${statusPillHtml}
          </div>
          <div class="summary-metrics">
            <div class="summary-metric">
              <span class="metric-label">Loan Program</span>
              <span class="metric-value" id="c-summary-program">${escape(c.loanType||c.loanProgram||'Select')}</span>
            </div>
            <div class="summary-metric">
              <span class="metric-label">Loan Amount</span>
              <span class="metric-value" id="c-summary-amount">${escape(loanMetric)}</span>
            </div>
            <div class="summary-metric">
              <span class="metric-label">Next Touch</span>
              <span class="metric-value" id="c-summary-touch">${escape(nextTouch)}</span>
            </div>
            <div class="summary-metric">
              <span class="metric-label">Lead Source</span>
              <span class="metric-value" id="c-summary-source">${escape(c.leadSource||'Set Source')}</span>
            </div>
          </div>
          <div class="modal-note" id="c-summary-note">
            Keep momentum with timely follow-up, clear milestones, and aligned partner updates.
          </div>
        </aside>
        <div class="modal-main">
          <nav class="modal-tabs" id="contact-tabs">
            <button class="btn active" data-panel="profile" type="button">Profile</button>
            <button class="btn" data-panel="loan" type="button">Loan &amp; Property</button>
            <button class="btn" data-panel="relationships" type="button">Relationships</button>
            <button class="btn" data-panel="docs" type="button">Docs &amp; Automations</button>
          </nav>
          <div class="modal-panels">
            <section class="modal-section modal-panel active" data-panel="profile">
              <h4>Borrower Profile</h4>
              <div class="field-grid cols-2">
                <label data-required="true">First Name<input aria-required="true" id="c-first" value="${escape(c.first||'')}"></label>
                <label data-required="true">Last Name<input aria-required="true" id="c-last" value="${escape(c.last||'')}"></label>
                <label>Contact Role<select id="c-type">${optionList(CONTACT_TYPES, c.contactType||'Borrower')}</select></label>
                <label>Priority<select id="c-priority">${optionList(PRIORITIES, c.priority||'Warm')}</select></label>
                <label>Lead Source<select id="c-source"><option value="">Select source</option>${optionList(LEAD_SOURCES, c.leadSource||'')}</select></label>
                <label>Communication Preference<select id="c-pref">${optionList(COMM_PREFS, c.communicationPreference||'Phone')}</select></label>
                <label data-required="true">Primary Email<input aria-required="true" id="c-email" type="email" value="${escape(c.email||'')}"></label>
                <label data-required="true">Mobile / Direct Line<input aria-required="true" id="c-phone" type="tel" value="${escape(c.phone||'')}"></label>
                <label data-advanced="contact">Secondary Email<input id="c-email2" type="email" value="${escape(c.secondaryEmail||'')}"></label>
                <label data-advanced="contact">Secondary Phone<input id="c-phone2" type="tel" value="${escape(c.secondaryPhone||'')}"></label>
              </div>
            </section>
            <section class="modal-section modal-panel" data-panel="loan">
              <h4>Pipeline Stage</h4>
              <div class="stage-slider" id="contact-stage-slider">
                <div class="stage-slider-track">
                  <div class="stage-slider-progress" id="contact-stage-progress"></div>
                  <div class="stage-slider-marks">${stageSliderMarks}</div>
                </div>
                <div class="stage-slider-labels">${stageSliderLabels}</div>
                <input type="range" min="0" max="${STAGE_FLOW.length-1}" step="1" value="0" id="contact-stage-range" aria-label="Pipeline stage slider">
                <div class="stage-slider-help" id="contact-stage-help">
                  <strong id="contact-stage-help-title">Automations</strong>
                  <p id="contact-stage-helptext">Stage changes keep automations, partner notifications, and task lists in sync.</p>
                </div>
              </div>
              <div style="margin-top:18px">
                <h4>Property &amp; Loan Snapshot</h4>
                <div class="field-grid cols-3">
                  <label data-required="true">Stage<select aria-required="true" id="c-stage">${optionList(STAGES, c.stage||'application')}</select></label>
                  <label data-required="true">Status<select aria-required="true" id="c-status">${optionList(STATUSES, c.status||'inprogress')}</select></label>
                  <label data-advanced="loan">Closing Timeline<select id="c-timeline">${optionList(TIMELINES, c.closingTimeline||'')}</select></label>
                  <label data-advanced="loan">Loan Purpose<select id="c-purpose">${optionList(LOAN_PURPOSES, c.loanPurpose||'Purchase')}</select></label>
                  <label data-advanced="loan">Loan Program<select id="c-loanType">${optionList(LOAN_PROGRAMS, c.loanType||c.loanProgram||'Conventional')}</select></label>
                  <label data-advanced="loan">Property Type<select id="c-property">${optionList(PROPERTY_TYPES, c.propertyType||'Single-Family')}</select></label>
                  <label data-advanced="loan">Occupancy<select id="c-occupancy">${optionList(OCCUPANCY, c.occupancy||'Primary Residence')}</select></label>
                  <label data-advanced="loan">Employment Type<select id="c-employment">${optionList(EMPLOYMENT, c.employmentType||'W-2')}</select></label>
                  <label data-advanced="loan">Credit Range<select id="c-credit">${optionList(CREDIT_BANDS, c.creditRange||'Unknown')}</select></label>
                </div>
                <div class="field-grid cols-3" style="margin-top:12px">
                  <label data-advanced="loan">Loan Amount<input id="c-amount" type="number" value="${escape(c.loanAmount||'')}"></label>
                  <label data-advanced="loan">Rate<input id="c-rate" type="number" step="0.001" value="${escape(c.rate||'')}"></label>
                  <label data-advanced="loan">Funded / Expected Closing<input id="c-funded" type="date" value="${escape((c.fundedDate||'').slice(0,10))}"></label>
                  <label data-advanced="loan">Pre-Approval Expires<input id="c-preexp" type="date" value="${escape((c.preApprovalExpires||'').slice(0,10))}"></label>
                  <label data-advanced="loan">Documentation Stage<select id="c-docstage">${optionList(DOC_STAGES, c.docStage||'application-started')}</select></label>
                  <label data-advanced="loan">Pipeline Milestone<select id="c-milestone">${optionList(PIPELINE_MILESTONES, c.pipelineMilestone||'Intro Call')}</select></label>
                </div>
              </div>
              <div style="margin-top:18px">
                <h4>Property Address</h4>
                <div class="field-grid cols-2">
                  <label>Street Address<input id="c-address" value="${escape(c.address||'')}"></label>
                  <label>City<input id="c-city" value="${escape(c.city||'')}"></label>
                  <label>State<select id="c-state">${optionList(STATES, (c.state||'').toUpperCase())}</select></label>
                  <label>ZIP<input id="c-zip" value="${escape(c.zip||'')}"></label>
                </div>
              </div>
            </section>
            <section class="modal-section modal-panel" data-panel="relationships">
              <h4>Relationships &amp; Follow-Up</h4>
              <div class="field-grid cols-2">
                  <label data-advanced="relationships">Buyer Partner<select id="c-buyer"><option value="">Select partner</option>${opts}</select></label>
                  <label data-advanced="relationships">Listing Partner<select id="c-listing"><option value="">Select partner</option>${opts}</select></label>
                  <label data-advanced="relationships">Referred By<select id="c-ref"><option value="">Select source</option>${optionList(LEAD_SOURCES, c.referredBy||c.leadSource||'')}</select></label>
                  <label data-advanced="relationships">Last Contact<input id="c-lastcontact" type="date" value="${escape((c.lastContact||'').slice(0,10))}"></label>
                  <label data-advanced="relationships">Next Follow-Up<input id="c-nexttouch" type="date" value="${escape((c.nextFollowUp||'').slice(0,10))}"></label>
              </div>
              <label class="section-subhead" style="margin-top:14px">Conversation Notes</label>
              <textarea id="c-notes">${escape(c.notes||'')}</textarea>
            </section>
            <section class="modal-section modal-panel" data-panel="docs">
              <h4>Documentation &amp; Automations</h4>
              <div class="doc-automation-grid">
                <div class="doc-automation-summary">
                  <div class="muted" id="c-doc-summary">Select a loan program to generate the checklist.</div>
                  <div class="doc-missing" id="c-doc-missing"></div>
                  <ul class="doc-chip-list" id="c-doc-list"></ul>
                </div>
                <div class="doc-automation-actions">
                  <button class="btn" type="button" id="c-sync-docs">Sync Required Docs</button>
                  <button class="btn brand" type="button" id="c-email-docs">Email Document Request</button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>`;
    const buyerSel = $('#c-buyer', body);
    const listingSel = $('#c-listing', body);
    if(buyerSel) buyerSel.value = c.buyerPartnerId ? String(c.buyerPartnerId) : '';
    if(listingSel) listingSel.value = c.listingPartnerId ? String(c.listingPartnerId) : '';

    const summaryNote = $('#c-summary-note', body);
    if(summaryNote && c.pipelineMilestone && /funded/i.test(String(c.pipelineMilestone))){
      summaryNote.textContent = 'Celebrate this win, deliver post-close touches, and prompt for partner reviews.';
    }

    const mirrorLast = $('#c-lastname', body);
    const lastInput = $('#c-last', body);
    if(mirrorLast && lastInput){
      lastInput.addEventListener('input', ()=> mirrorLast.value = lastInput.value);
    }

    const tabNav = $('#contact-tabs', body);
    if(tabNav){
      tabNav.addEventListener('click', (evt)=>{
        const btn = evt.target.closest('button[data-panel]');
        if(!btn) return;
        evt.preventDefault();
        const target = btn.getAttribute('data-panel');
        tabNav.querySelectorAll('button[data-panel]').forEach(b=> b.classList.toggle('active', b===btn));
        body.querySelectorAll('.modal-panel').forEach(panel=>{
          panel.classList.toggle('active', panel.getAttribute('data-panel')===target);
        });
      });
    }

    const stageSelect = $('#c-stage', body);
    const stageRange = $('#contact-stage-range', body);
    const stageProgress = $('#contact-stage-progress', body);
    const stageMarks = Array.from(body.querySelectorAll('.stage-slider-mark'));
    const stageHelpTitle = $('#contact-stage-help-title', body);
    const stageHelpText = $('#contact-stage-helptext', body);
    const stageIndexFor = (value)=>{
      const norm = String(value||'').toLowerCase();
      const direct = STAGE_FLOW.indexOf(norm);
      if(direct>=0) return direct;
      if(norm==='preapproved') return 1;
      if(norm==='ctc' || norm==='clear-to-close' || norm==='cleared to close'){
        const idx = STAGE_FLOW.indexOf('cleared-to-close');
        return idx>=0 ? idx : 0;
      }
      if(norm==='post-close' || norm==='nurture' || norm==='lost' || norm==='denied') return STAGE_FLOW.length-1;
      return 0;
    };
    const syncStageSlider = (stageVal)=>{
      if(!stageRange || !stageProgress) return;
      const idx = stageIndexFor(stageVal);
      const maxIndex = Math.max(STAGE_FLOW.length-1, 1);
      const pct = Math.min(100, Math.max(0, (idx/maxIndex)*100));
      stageRange.value = String(idx);
      stageProgress.style.width = `${pct}%`;
      stageMarks.forEach((mark,i)=> mark.classList.toggle('active', i<=idx));
      stageRange.setAttribute('aria-valuetext', findLabel(STAGES, STAGE_FLOW[idx]||STAGE_FLOW[0])||'');
      const stageKey = STAGE_FLOW[idx] || String(stageVal||'').toLowerCase();
      const stageLabel = findLabel(STAGES, stageKey) || findLabel(STAGES, stageVal) || 'Pipeline Stage';
      const helpMsg = STAGE_AUTOMATIONS[stageKey] || 'Stage updates keep doc checklists, partner notifications, and task cadences aligned.';
      if(stageHelpTitle) stageHelpTitle.textContent = `${stageLabel} automations`;
      if(stageHelpText) stageHelpText.textContent = helpMsg;
    };
    if(stageRange){
      const onStageDrag = ()=>{
        const idx = Math.max(0, Math.min(STAGE_FLOW.length-1, Number(stageRange.value||0)));
        const nextStage = STAGE_FLOW[idx] || STAGE_FLOW[0];
        if(stageSelect){
          stageSelect.value = nextStage;
          stageSelect.dispatchEvent(new Event('change',{bubbles:true}));
        }
      };
      stageRange.addEventListener('input', onStageDrag);
      stageRange.addEventListener('change', onStageDrag);
    }
    if(stageSelect){
      stageSelect.addEventListener('change', ()=> syncStageSlider(stageSelect.value));
    }

    const updateSummary = ()=>{
      const amountVal = Number($('#c-amount',body)?.value||0);
      const program = $('#c-loanType',body)?.value||'';
      const source = $('#c-source',body)?.value || '';
      const next = $('#c-nexttouch',body)?.value || $('#c-timeline',body)?.value || 'TBD';
      const amountEl = $('#c-summary-amount',body);
      const programEl = $('#c-summary-program',body);
      const sourceEl = $('#c-summary-source',body);
      const touchEl = $('#c-summary-touch',body);
      const summaryName = body.querySelector('.summary-name');
      const summaryNote = $('#c-summary-note',body);
      const stageWrap = body.querySelector('[data-role="stage-chip-wrapper"]');
      const statusEl = body.querySelector('.status-pill');
      const stageVal = $('#c-stage',body)?.value || 'application';
      const statusVal = $('#c-status',body)?.value || 'inprogress';
      const firstVal = $('#c-first',body)?.value?.trim()||'';
      const lastVal = $('#c-last',body)?.value?.trim()||'';
      if(amountEl){ amountEl.textContent = amountVal>0 ? fmtCurrency.format(amountVal) : 'TBD'; }
      if(programEl){ programEl.textContent = program || 'Select'; }
      if(sourceEl){ sourceEl.textContent = source || 'Set Source'; }
      if(touchEl){ touchEl.textContent = next || 'TBD'; }
      if(summaryName){
        const summaryText = summaryName.querySelector('[data-role="summary-name-text"]');
        const avatarEl = summaryName.querySelector('[data-role="summary-avatar"]');
        const idInput = $('#c-id', body);
        const recordIdVal = idInput ? String(idInput.value || '') : '';
        summaryName.dataset.favoriteType = 'contact';
        summaryName.dataset.recordId = recordIdVal;
        summaryName.setAttribute('data-role', 'favorite-host');
        summaryName.setAttribute('data-favorite-type', 'contact');
        summaryName.setAttribute('data-record-id', recordIdVal);
        const label = (firstVal||lastVal) ? `${firstVal} ${lastVal}`.trim() : 'New Contact';
        if(summaryText){ summaryText.textContent = label; }
        else { summaryName.textContent = label; }
        const avatarName = (firstVal||lastVal) ? label : '';
        applyAvatar(avatarEl, avatarName, contactAvatarSource(c));
      }
      if(stageWrap){
        const canonicalKey = canonicalStage(stageVal) || canonicalStage(findLabel(STAGES, stageVal));
        if(canonicalKey){ stageWrap.dataset.stageCanonical = canonicalKey; } else { delete stageWrap.dataset.stageCanonical; }
        stageWrap.dataset.stage = stageVal;
        const label = findLabel(STAGES, stageVal) || stageVal || 'Application';
        const canonicalLabel = canonicalKey ? (CANONICAL_STAGE_META[canonicalKey]?.label || label) : label;
        const chip = renderStageChip(stageVal) || renderStageChip(label) || buildStageFallback(canonicalLabel || label, stageVal);
        stageWrap.innerHTML = chip;
      }
      if(statusEl){
        statusEl.dataset.status = statusVal;
        const toneKey = toneForStatus(statusVal);
        const toneClass = toneClassName(toneKey);
        removeToneClasses(statusEl);
        if(toneClass){ statusEl.classList.add(toneClass); }
        if(toneKey){ statusEl.setAttribute('data-tone', toneKey); }
        else { statusEl.removeAttribute('data-tone'); }
        statusEl.textContent = findLabel(STATUSES, statusVal) || 'In Progress';
      }
      if(summaryNote){
        if(stageVal==='post-close'){ summaryNote.textContent = 'Keep clients engaged with annual reviews, gifting, and partner introductions.'; }
        else if(stageVal==='funded'){ summaryNote.textContent = 'Celebrate this win, deliver post-close touches, and prompt for partner reviews.'; }
        else if(stageVal==='nurture'){ summaryNote.textContent = 'Set light-touch cadences, send value content, and track partner intel.'; }
        else if(stageVal==='lost' || stageVal==='denied'){ summaryNote.textContent = 'Capture the outcome, log lessons learned, and schedule a re-engagement plan.'; }
        else if(stageVal==='underwriting' || stageVal==='processing'){ summaryNote.textContent = 'Tighten doc flow, confirm conditions, and communicate expectations to all parties.'; }
        else if(stageVal==='approved' || stageVal==='cleared-to-close'){ summaryNote.textContent = 'Coordinate closing logistics, lock in insurance, and prep gifting / testimonials.'; }
        else { summaryNote.textContent = 'Keep momentum with timely follow-up, clear milestones, and aligned partner updates.'; }
      }
    };
    body.querySelectorAll('input,select').forEach(el=>{
      if(el.id==='contact-stage-range') return;
      el.addEventListener('change', updateSummary);
      el.addEventListener('input', updateSummary);
    });
    syncStageSlider(c.stage||'application');
    updateSummary();

    const ensureReferredByButton = ()=>{
      const select = body.querySelector('#c-ref');
      if(!select) return;
      const host = select.closest('label') || select.parentElement || body;
      if(!host) return;
      const affordance = host.querySelector('[data-qa="referred-by-quick-add"], [data-role="referred-by-quick-add"], .referred-by-quick-add');
      if(affordance && affordance.tagName !== 'BUTTON'){
        affordance.remove();
      }
      const button = host.querySelector('button[data-qa="referred-by-quick-add"], button[data-role="referred-by-quick-add"], button.referred-by-quick-add');
      if(!button) return;
      button.dataset.qa = 'referred-by-quick-add';
      button.dataset.role = 'referred-by-quick-add';
      button.classList.add('btn', 'ghost', 'compact', 'btn-add-contact');
      button.type = 'button';
      button.setAttribute('aria-label', 'Add Contact');
      button.title = 'Add Contact';
      let icon = button.querySelector('.btn-icon');
      if(!icon){
        icon = document.createElement('span');
        icon.className = 'btn-icon';
        icon.setAttribute('aria-hidden', 'true');
        button.insertBefore(icon, button.firstChild || null);
      }
      icon.textContent = '+';
      const spanLabel = button.querySelector('span:last-child');
      if(spanLabel){
        spanLabel.textContent = 'Add Contact';
      }
    };

    ensureReferredByButton();

    const docListEl = $('#c-doc-list', body);
    const docSummaryEl = $('#c-doc-summary', body);
    const docMissingEl = $('#c-doc-missing', body);
    const docEmailBtn = $('#c-email-docs', body);
    const docSyncBtn = $('#c-sync-docs', body);

    const getLoanLabel = ()=>{
      const loanSel = $('#c-loanType', body);
      const opt = loanSel && loanSel.selectedOptions && loanSel.selectedOptions[0];
      return (opt && opt.textContent && opt.textContent.trim()) || (loanSel && loanSel.value) || 'loan';
    };

    async function renderDocChecklist(){
      if(!docListEl) return;
      const contactId = $('#c-id', body)?.value;
      const loanSel = $('#c-loanType', body);
      const loanType = loanSel ? loanSel.value : '';
      const loanLabel = getLoanLabel();
      let required = [];
      try{
        required = typeof window.requiredDocsFor === 'function' ? await window.requiredDocsFor(loanType) : [];
      }catch (err) { console.warn('requiredDocsFor', err); }
      let persisted = null;
      let docs = [];
      let missing = '';
      if(contactId){
        try{
          await openDB();
          persisted = await dbGet('contacts', contactId);
          if(persisted){
            const allDocs = await dbGetAll('documents');
            docs = (allDocs||[]).filter(d=> String(d.contactId)===String(contactId));
            missing = persisted.missingDocs || '';
          }
        }catch (err) { console.warn('doc checklist load', err); }
      }

      if(!required.length){
        docListEl.innerHTML = '<li class="doc-chip muted">No automation rules configured.</li>';
        if(docSummaryEl){
          docSummaryEl.textContent = loanType ? `No required docs configured for ${loanLabel}.` : 'Select a loan program to view required docs.';
        }
        if(docMissingEl){ docMissingEl.textContent = ''; docMissingEl.classList.remove('warn'); }
        if(docEmailBtn){ docEmailBtn.disabled = true; docEmailBtn.dataset.docs = '[]'; }
        return;
      }

      const chips = [];
      let receivedCount = 0;
      required.forEach(name=>{
        const key = String(name||'').toLowerCase();
        const existing = docs.find(d=> String(d.name||'').toLowerCase()===key);
        const statusRaw = existing ? (existing.status || 'Requested') : (persisted ? 'Requested' : 'Pending');
        const status = String(statusRaw).toLowerCase();
        if(/^received|waived$/.test(status)) receivedCount++;
        chips.push(`<li class="doc-chip" data-status="${escape(status)}"><span class="doc-chip-name">${escape(name)}</span><span class="doc-chip-status">${escape(statusRaw)}</span></li>`);
      });
      docListEl.innerHTML = chips.join('');
      if(docSummaryEl){
        if(persisted){
          const outstanding = Math.max(required.length - receivedCount, 0);
          docSummaryEl.textContent = `${required.length} required • ${receivedCount} received • ${outstanding} outstanding`;
        } else {
          docSummaryEl.textContent = `${required.length} documents will be requested once this contact is saved.`;
        }
      }
      if(docMissingEl){
        if(persisted && missing){
          docMissingEl.textContent = `Still Needed: ${missing}`;
          docMissingEl.classList.add('warn');
        } else if(persisted){
          docMissingEl.textContent = 'All required documents accounted for.';
          docMissingEl.classList.remove('warn');
        } else {
          docMissingEl.textContent = '';
          docMissingEl.classList.remove('warn');
        }
      }
      if(docEmailBtn){
        docEmailBtn.disabled = false;
        docEmailBtn.dataset.docs = JSON.stringify(required);
        docEmailBtn.dataset.loan = loanLabel;
      }
    }

    async function syncDocs(opts){
      const options = Object.assign({silent:false}, opts||{});
      const contactId = $('#c-id', body)?.value;
      const loanSel = $('#c-loanType', body);
      const loanType = loanSel ? loanSel.value : '';
      if(!contactId){
        if(!options.silent) notify('Save this contact to generate the document checklist.');
        await renderDocChecklist();
        return;
      }
      try{
        await openDB();
        const record = await dbGet('contacts', contactId);
        if(record){
          record.loanType = loanType;
          record.loanProgram = loanType || record.loanProgram;
          record.updatedAt = Date.now();
          await dbPut('contacts', record);
          if(typeof ensureRequiredDocs === 'function') await ensureRequiredDocs(record);
          if(typeof computeMissingDocsForAll === 'function') await computeMissingDocsForAll();
          if(!options.silent) toastSuccess('Required document checklist synced.');
        } else if(!options.silent){
          notify('Save this contact to generate the document checklist.');
        }
      }catch (err) { console.warn('sync docs', err); }
      await renderDocChecklist();
    }

    if(docSyncBtn){
      docSyncBtn.addEventListener('click', ()=>{ syncDocs({silent:false}); });
    }
    const loanSelect = $('#c-loanType', body);
    if(loanSelect){
      loanSelect.addEventListener('change', ()=>{ syncDocs({silent:true}); });
    }
    if(docEmailBtn){
      docEmailBtn.addEventListener('click', ()=>{
        try{
          const docs = JSON.parse(docEmailBtn.dataset.docs||'[]');
          if(!docs.length){ notify('No required documents to email yet.'); return; }
          const email = $('#c-email', body)?.value?.trim();
          if(!email){ notify('Add a primary email before sending a request.', 'warn'); return; }
          const first = $('#c-first', body)?.value?.trim();
          const greeting = first ? `Hi ${first},` : 'Hi there,';
          const loanLabel = docEmailBtn.dataset.loan || getLoanLabel();
          const bullets = docs.map(name=>`• ${name}`).join('\n');
          const bodyText = `${greeting}\n\nTo keep your ${loanLabel} moving, please send the following documents:\n\n${bullets}\n\nYou can upload them to the secure portal or email them back to me.\n\nThank you!`;
          const subject = `Document Request for your ${loanLabel}`;
          const href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
          try{ window.open(href, '_self'); }catch (_) { window.location.href = href; }
        }catch (err) { console.warn('email docs', err); notify('Unable to build document request email.', 'error'); }
      });
    }

    await renderDocChecklist();

    const formShell = dlg.querySelector('form.modal-form-shell');
    let footerHandle = dlg.__contactFooter;
    if(formShell){
      const footerHost = formShell.querySelector('.modal-footer');
      if(footerHost){
        if(!footerHandle){
          footerHandle = createFormFooter({
            host: footerHost,
            form: formShell,
            saveLabel: 'Save Contact',
            cancelLabel: 'Cancel',
            saveId: 'btn-save-contact',
            saveValue: 'default',
            onCancel: event => {
              if(event) event.preventDefault();
              closeDialog();
            }
          });
          footerHandle.cancelButton.setAttribute('data-close', '');
          dlg.__contactFooter = footerHandle;
        }
        footerHandle.saveButton.textContent = 'Save Contact';
        footerHandle.saveButton.value = 'default';
        footerHandle.cancelButton.textContent = 'Cancel';
      }
    }

    const saveBtn = dlg.querySelector('#btn-save-contact');
    const setBusy = (active)=>{
      if(active){
        try{ dlg.setAttribute('data-loading', '1'); }
        catch(_err){}
        if(saveBtn){
          saveBtn.dataset.loading = '1';
          saveBtn.setAttribute('aria-busy', 'true');
          saveBtn.disabled = true;
        }
      }else{
        try{ dlg.removeAttribute('data-loading'); }
        catch(_err){}
        if(saveBtn){
          delete saveBtn.dataset.loading;
          saveBtn.removeAttribute('aria-busy');
          saveBtn.disabled = false;
        }
      }
    };
    const handleSave = async (options)=>{
      const opts = options && typeof options === 'object' ? options : {};
      const existed = Array.isArray(contacts) && contacts.some(x => String(x && x.id) === String(c.id));
      const prevStage = c.stage;
      setBusy(true);
      try{
        const u = Object.assign({}, c, {
          first: $('#c-first',body).value.trim(), last: $('#c-last',body).value.trim(),
          email: $('#c-email',body).value.trim(), phone: $('#c-phone',body).value.trim(),
          address: $('#c-address',body).value.trim(), city: $('#c-city',body).value.trim(),
          state: ($('#c-state',body).value||'').toUpperCase(), zip: $('#c-zip',body).value.trim(),
          stage: $('#c-stage',body).value, status: $('#c-status',body).value,
          loanAmount: Number($('#c-amount',body).value||0), rate: Number($('#c-rate',body).value||0),
          fundedDate: $('#c-funded',body).value || '', buyerPartnerId: $('#c-buyer',body).value||null,
          listingPartnerId: $('#c-listing',body).value||null, lastContact: $('#c-lastcontact',body).value||'',
          referredBy: $('#c-ref',body).value||'', notes: $('#c-notes',body).value||'', updatedAt: Date.now(),
          contactType: $('#c-type',body).value,
          priority: $('#c-priority',body).value,
          leadSource: $('#c-source',body).value,
          communicationPreference: $('#c-pref',body).value,
          closingTimeline: $('#c-timeline',body).value,
          loanPurpose: $('#c-purpose',body).value,
          loanProgram: $('#c-loanType',body).value,
          loanType: $('#c-loanType',body).value,
          propertyType: $('#c-property',body).value,
          occupancy: $('#c-occupancy',body).value,
          employmentType: $('#c-employment',body).value,
          creditRange: $('#c-credit',body).value,
          docStage: $('#c-docstage',body).value,
          pipelineMilestone: $('#c-milestone',body).value,
          preApprovalExpires: $('#c-preexp',body).value||'',
          nextFollowUp: $('#c-nexttouch',body).value||'',
          secondaryEmail: $('#c-email2',body).value.trim(),
          secondaryPhone: $('#c-phone2',body).value.trim()
        });
        if(typeof window.updateContactStage === 'function'){
          window.updateContactStage(u, u.stage, prevStage);
        }else{
          const canonFn = typeof window.canonicalizeStage === 'function' ? window.canonicalizeStage : (val)=> String(val||'').toLowerCase();
          const prevCanon = canonFn(prevStage);
          const nextCanon = canonFn(u.stage);
          u.stage = nextCanon;
          if(!u.stageEnteredAt || prevCanon !== nextCanon){
            u.stageEnteredAt = new Date().toISOString();
          }
        }
        if(!u.stageEnteredAt){
          u.stageEnteredAt = c.stageEnteredAt || new Date().toISOString();
        }
        await openDB();
        await dbPut('contacts', u);
        if(Array.isArray(contacts)){
          const idx = contacts.findIndex(item => item && String(item.id) === String(u.id));
          if(idx >= 0){
            contacts[idx] = Object.assign({}, contacts[idx], u);
          }else{
            contacts.push(Object.assign({}, u));
          }
        }
        Object.assign(c, u);
        try{
          if(typeof ensureRequiredDocs === 'function') await ensureRequiredDocs(u);
          if(typeof computeMissingDocsForAll === 'function') await computeMissingDocsForAll();
        }catch (err) { console.warn('post-save doc sync', err); }
        const detail = {
          scope:'contacts',
          contactId:String(u.id||''),
          action: existed ? 'update' : 'create',
          source:'contact:modal'
        };
        if(typeof window.dispatchAppDataChanged === 'function'){
          window.dispatchAppDataChanged(detail);
        }else if(console && typeof console.warn === 'function'){
          console.warn('[soft] dispatchAppDataChanged missing; unable to broadcast contact change.', detail);
        }
        const successMessage = opts.successMessage || (existed ? 'Contact updated' : 'Contact created');
        if(successMessage){
          toastSuccess(successMessage);
        }
        if(!opts.keepOpen){
          closeDialog();
        }
        return u;
      }catch (err){
        if(console && typeof console.warn === 'function'){
          console.warn('[contacts] save failed', err);
        }
        toastError('Contact save failed');
        return null;
      }finally{
        setBusy(false);
      }
    };
    const installFollowUpScheduler = ()=>{
      const footer = dlg.querySelector('[data-component="form-footer"]') || dlg.querySelector('.modal-footer');
      if(!footer) return;
      const start = footer.querySelector('.form-footer__start') || footer.querySelector('.modal-footer__start') || footer;
      if(!start) return;

      if(dlg.__contactFollowUpAbort && typeof dlg.__contactFollowUpAbort.abort === 'function' && !dlg.__contactFollowUpAbort.signal?.aborted){
        dlg.__contactFollowUpAbort.abort();
      }

      const controller = new AbortController();
      const { signal } = controller;
      dlg.__contactFollowUpAbort = controller;

      const host = document.createElement('div');
      host.dataset.role = 'contact-followup-host';
      host.className = 'followup-scheduler';
      host.style.display = 'flex';
      host.style.flexDirection = 'column';
      host.style.gap = '6px';
      host.style.maxWidth = '240px';

      const actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = 'btn ghost';
      actionBtn.textContent = 'Schedule Follow-up';
      actionBtn.setAttribute('aria-haspopup', 'true');
      actionBtn.setAttribute('aria-expanded', 'false');

      const prompt = document.createElement('div');
      prompt.dataset.role = 'contact-followup-prompt';
      prompt.hidden = true;
      prompt.style.display = 'none';
      prompt.style.flexDirection = 'column';
      prompt.style.gap = '6px';
      prompt.style.padding = '8px';
      prompt.style.border = '1px solid var(--border-subtle, #d0d7de)';
      prompt.style.borderRadius = '6px';
      prompt.style.background = 'var(--surface-subtle, #f6f8fa)';

      const dateLabel = document.createElement('label');
      dateLabel.textContent = 'Follow-up date';
      dateLabel.style.display = 'flex';
      dateLabel.style.flexDirection = 'column';
      dateLabel.style.gap = '4px';

      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      dateInput.required = true;
      dateInput.dataset.role = 'followup-date';

      dateLabel.appendChild(dateInput);

      const noteLabel = document.createElement('label');
      noteLabel.textContent = 'Note (optional)';
      noteLabel.style.display = 'flex';
      noteLabel.style.flexDirection = 'column';
      noteLabel.style.gap = '4px';

      const noteInput = document.createElement('input');
      noteInput.type = 'text';
      noteInput.placeholder = 'Reminder note';
      noteInput.dataset.role = 'followup-note';

      noteLabel.appendChild(noteInput);

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '6px';

      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'btn brand';
      confirmBtn.textContent = 'Create';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn ghost';
      cancelBtn.textContent = 'Cancel';

      actions.append(confirmBtn, cancelBtn);

      prompt.append(dateLabel, noteLabel, actions);

      const status = document.createElement('div');
      status.dataset.role = 'followup-status';
      status.setAttribute('aria-live', 'polite');
      status.style.fontSize = '12px';
      status.style.minHeight = '16px';

      const setStatus = (message, tone)=>{
        status.textContent = message || '';
        status.dataset.state = tone || '';
        if(tone === 'error'){
          status.style.color = 'var(--danger-text, #b42318)';
        }else if(tone === 'success'){
          status.style.color = 'var(--success-text, #067647)';
        }else{
          status.style.color = 'inherit';
        }
      };

      const closePrompt = ()=>{
        prompt.hidden = true;
        prompt.style.display = 'none';
        actionBtn.setAttribute('aria-expanded', 'false');
      };
      const openPrompt = ()=>{
        prompt.hidden = false;
        prompt.style.display = 'flex';
        actionBtn.setAttribute('aria-expanded', 'true');
        if(!dateInput.value){
          try{
            const today = new Date();
            const iso = today.toISOString().slice(0,10);
            dateInput.value = iso;
          }catch(_err){}
        }
        try{ dateInput.focus({ preventScroll: true }); }
        catch(_err){ dateInput.focus?.(); }
      };

      let submitting = false;
      const handleSubmit = ()=>{
        if(submitting) return;
        const linkedId = String($('#c-id', body)?.value || c.id || '').trim();
        if(!linkedId){
          setStatus('Save the contact before scheduling a follow-up.', 'error');
          return;
        }
        const due = String(dateInput.value || '').trim();
        if(!due){
          setStatus('Choose a follow-up date.', 'error');
          try{ dateInput.focus({ preventScroll: true }); }
          catch(_err){ dateInput.focus?.(); }
          return;
        }
        submitting = true;
        confirmBtn.disabled = true;
        cancelBtn.disabled = true;
        actionBtn.disabled = true;
        setStatus('Scheduling follow-up…');
        const note = String(noteInput.value || '').trim();
        Promise.resolve().then(async () => {
          const payload = { linkedType: 'contact', linkedId, due, note };
          if(!note){ delete payload.note; }
          const createViaApp = window.App?.tasks?.createMinimal;
          if(typeof createViaApp === 'function'){
            await createViaApp(payload);
          }else{
            const mod = await import(new URL('../tasks/api.js', import.meta.url));
            const fn = mod.createMinimalTask || mod.createTask;
            if(typeof fn !== 'function'){
              throw new Error('Task API unavailable');
            }
            await fn(payload);
          }
        }).then(() => {
          setTimeout(() => {
            try{
              window.dispatchEvent(new CustomEvent('tasks:changed'));
            }catch(_err){}
          }, 0);
          setStatus('Follow-up scheduled.', 'success');
          noteInput.value = '';
          submitting = false;
          confirmBtn.disabled = false;
          cancelBtn.disabled = false;
          actionBtn.disabled = false;
          closePrompt();
        }).catch(err => {
          console.warn?.('[followup]', err);
          submitting = false;
          confirmBtn.disabled = false;
          cancelBtn.disabled = false;
          actionBtn.disabled = false;
          setStatus('Unable to schedule follow-up. Try again.', 'error');
        });
      };

      actionBtn.addEventListener('click', (event)=>{
        event.preventDefault();
        setStatus('');
        if(prompt.hidden){ openPrompt(); }
        else { closePrompt(); }
      }, { signal });

      confirmBtn.addEventListener('click', (event)=>{
        event.preventDefault();
        handleSubmit();
      }, { signal });

      cancelBtn.addEventListener('click', (event)=>{
        event.preventDefault();
        closePrompt();
      }, { signal });

      prompt.addEventListener('keydown', (event)=>{
        if(event.key === 'Escape'){
          event.preventDefault();
          closePrompt();
          actionBtn.focus?.({ preventScroll: true });
        }
      }, { signal });

      signal.addEventListener('abort', ()=>{
        if(host.parentElement){ host.remove(); }
        if(dlg.__contactFollowUpAbort === controller){
          dlg.__contactFollowUpAbort = null;
        }
      });

      try{ dlg.addEventListener('close', ()=> controller.abort(), { once: true }); }
      catch(_err){ dlg.addEventListener('close', ()=> controller.abort(), { once: true }); }

      host.append(actionBtn, prompt, status);
      if(start.firstChild){
        start.insertBefore(host, start.firstChild);
      }else{
        start.appendChild(host);
      }
    };

    const installTouchLogging = ()=>{
      const footer = dlg.querySelector('[data-component="form-footer"]');
      if(!footer) return;
      const start = footer.querySelector('.form-footer__start');
      if(!start) return;

      let controls = dlg.__contactTouchControls || null;
      if(!controls){
        const logButton = document.createElement('button');
        logButton.type = 'button';
        logButton.className = 'btn';
        logButton.dataset.role = 'log-touch';
        logButton.textContent = 'Log a Touch';
        logButton.setAttribute('aria-haspopup', 'true');
        logButton.setAttribute('aria-expanded', 'false');

        const menu = document.createElement('div');
        menu.dataset.role = 'touch-menu';
        menu.setAttribute('role', 'menu');
        menu.hidden = true;
        menu.style.display = 'none';
        menu.style.marginLeft = '8px';
        menu.style.gap = '4px';
        menu.style.flexWrap = 'wrap';

        start.appendChild(logButton);
        start.appendChild(menu);
        controls = { button: logButton, menu };
        dlg.__contactTouchControls = controls;
      }else{
        controls.button.textContent = 'Log a Touch';
      }

      const { button: logButton, menu } = controls;
      if(!logButton || !menu) return;

      TOUCH_OPTIONS.forEach(option => {
        let optBtn = menu.querySelector(`button[data-touch-key="${option.key}"]`);
        if(!optBtn){
          optBtn = document.createElement('button');
          optBtn.type = 'button';
          optBtn.className = 'btn ghost';
          optBtn.dataset.touchKey = option.key;
          optBtn.textContent = option.label;
          optBtn.setAttribute('role', 'menuitem');
          menu.appendChild(optBtn);
        }else{
          optBtn.textContent = option.label;
        }
      });
      Array.from(menu.querySelectorAll('button[data-touch-key]')).forEach(btn => {
        if(!TOUCH_OPTIONS.some(option => option.key === btn.dataset.touchKey)){
          btn.remove();
        }
      });

      const hideMenu = ()=>{
        if(menu.hidden) return;
        menu.hidden = true;
        menu.style.display = 'none';
        logButton.setAttribute('aria-expanded', 'false');
      };
      const showMenu = ()=>{
        if(!menu.hidden) return;
        menu.hidden = false;
        menu.style.display = 'flex';
        logButton.setAttribute('aria-expanded', 'true');
        const first = menu.querySelector('button[data-touch-key]');
        if(first && typeof first.focus === 'function'){
          first.focus({ preventScroll: true });
        }
      };

      let logging = false;
      const logTouch = async (key)=>{
        if(logging) return null;
        logging = true;
        try{
          const notesField = $('#c-notes', body);
          const lastInput = $('#c-lastcontact', body);
          if(!notesField || !lastInput){
            return null;
          }
          const entry = createTouchLogEntry(key);
          const existing = notesField.value || '';
          const remainderRaw = existing.replace(/^\s+/, '');
          const remainder = remainderRaw ? `\n${remainderRaw}` : '';
          const nextValue = `${entry}${remainder}`;
          notesField.value = nextValue;
          notesField.dispatchEvent(new Event('input', { bubbles: true }));
          if(typeof notesField.focus === 'function'){
            notesField.focus({ preventScroll: true });
          }
          if(typeof notesField.setSelectionRange === 'function'){
            const caretIndex = entry.length;
            try{ notesField.setSelectionRange(caretIndex, caretIndex); }
            catch(_err){}
          }
          const today = formatTouchDate(new Date());
          if(today){
            lastInput.value = today;
            lastInput.dispatchEvent(new Event('input', { bubbles: true }));
            lastInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
          const result = await handleSave({ keepOpen: true, successMessage: touchSuccessMessage(key) });
          return result;
        }catch (err){
          try{ console && console.warn && console.warn('[contacts] touch log failed', err); }
          catch(_err){}
          return null;
        }finally{
          logging = false;
        }
      };

      if(!logButton.__touchToggle){
        logButton.__touchToggle = true;
        logButton.addEventListener('click', (event)=>{
          event.preventDefault();
          if(menu.hidden){ showMenu(); }
          else { hideMenu(); }
        });
        logButton.addEventListener('keydown', (event)=>{
          if(event.key === 'Escape' && !menu.hidden){
            event.preventDefault();
            hideMenu();
            logButton.blur?.();
            return;
          }
          if((event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') && menu.hidden){
            event.preventDefault();
            showMenu();
          }
        });
      }

      if(!menu.__touchHandlers){
        menu.__touchHandlers = true;
        menu.addEventListener('click', (event)=>{
          const target = event.target && event.target.closest('button[data-touch-key]');
          if(!target) return;
          event.preventDefault();
          hideMenu();
          logTouch(target.dataset.touchKey);
        });
        menu.addEventListener('keydown', (event)=>{
          if(event.key === 'Escape'){
            event.preventDefault();
            hideMenu();
            if(typeof logButton.focus === 'function'){
              logButton.focus({ preventScroll: true });
            }
          }
        });
      }

      if(!dlg.__touchMenuOutsideHandler){
        const outsideHandler = (event)=>{
          if(menu.hidden) return;
          if(event && (event.target === logButton || logButton.contains(event.target))) return;
          if(event && menu.contains(event.target)) return;
          hideMenu();
        };
        dlg.addEventListener('click', outsideHandler);
        dlg.__touchMenuOutsideHandler = outsideHandler;
      }

      if(!menu.__touchCloseHook){
        const closeHandler = ()=> hideMenu();
        try{ dlg.addEventListener('close', closeHandler); }
        catch(_err){ dlg.addEventListener('close', closeHandler); }
        menu.__touchCloseHook = closeHandler;
      }
    };

    installFollowUpScheduler();
    installTouchLogging();

    if(saveBtn){
      if(typeof window.saveForm === 'function'){
        window.saveForm(saveBtn, handleSave, { successMessage: null });
      }else{
        saveBtn.onclick = async (e)=>{ e.preventDefault(); await handleSave(); };
      }
    }
    document.dispatchEvent(new CustomEvent('contact:modal:ready',{detail:{dialog:dlg, body}}));
    try{ dlg.showModal(); }catch (_) { dlg.setAttribute('open',''); }
  };

  if(typeof window !== 'undefined' && typeof window.renderContactModal === 'function'){
    try{
      Object.defineProperty(window.renderContactModal, '__crmReady', { value:true, configurable:true });
    }catch (_err){
      try{ window.renderContactModal.__crmReady = true; }
      catch (__err){}
    }
    const ready = Promise.resolve(true);
    try{
      Object.defineProperty(window, '__CONTACT_MODAL_READY__', { value: ready, configurable:true });
    }catch (_err){
      window.__CONTACT_MODAL_READY__ = ready;
    }
  }

})();

export function openContactModal(contactId, options){
  const fn = (typeof window !== 'undefined' && typeof window.renderContactModal === 'function')
    ? window.renderContactModal
    : null;
  if(!fn){
    try{
      console && console.warn && console.warn('renderContactModal unavailable', { contactId });
    }catch(_err){}
    return null;
  }
  try{
    const result = fn(contactId, options);
    if(result && typeof result.catch === 'function'){
      result.catch(err => {
        try{ console && console.warn && console.warn('openContactModal failed', err); }
        catch(__err){}
      });
    }
    return result;
  }catch (err){
    try{ console && console.warn && console.warn('openContactModal failed', err); }
    catch(_err){}
  }
  return null;
}

let modalReadyPromise = null;
export function ensureContactModalReady(){
  if(typeof window === 'undefined') return Promise.resolve(false);
  if(typeof window.renderContactModal === 'function' && window.renderContactModal.__crmReady === true){
    return Promise.resolve(true);
  }
  const ready = window.__CONTACT_MODAL_READY__;
  if(ready && typeof ready.then === 'function'){
    return ready.then(() => {
      return typeof window.renderContactModal === 'function' && window.renderContactModal.__crmReady === true;
    }).catch(err => {
      if(console && typeof console.warn === 'function'){
        console.warn('contact modal ready wait failed', err);
      }
      return false;
    });
  }
  if(!modalReadyPromise){
    modalReadyPromise = Promise.resolve(
      typeof window.renderContactModal === 'function' && window.renderContactModal.__crmReady === true
    ).then(value => {
      modalReadyPromise = null;
      return value;
    }).catch(err => {
      modalReadyPromise = null;
      if(console && typeof console.warn === 'function'){
        console.warn('contact modal ensure failed', err);
      }
      return false;
    });
  }
  return modalReadyPromise;
}

if(typeof window !== 'undefined' && typeof window.openContactModal !== 'function'){
  window.openContactModal = function(contactId, options){
    return openContactModal(contactId, options);
  };
}
