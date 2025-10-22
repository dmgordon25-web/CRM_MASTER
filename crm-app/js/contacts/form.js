window.CRM = window.CRM || {};

const QA_BUTTON = 'referred-by-quick-add';
let activeState = null;

function findExistingHidden(select){
  if(!select) return null;
  const roots = [select.closest('label'), select.parentElement, select.form];
  for(const root of roots){
    if(root && typeof root.querySelector === 'function'){
      const hit = root.querySelector('input[name="referredBy"]');
      if(hit) return hit;
    }
  }
  return null;
}

function ensureHidden(select){
  if(!select) return null;
  const existing = findExistingHidden(select);
  if(existing) return existing;
  const hidden = document.createElement('input');
  hidden.type = 'hidden';
  hidden.name = 'referredBy';
  hidden.value = select.value || '';
  select.insertAdjacentElement('afterend', hidden);
  return hidden;
}

function findChip(label){
  if(!label) return null;
  return label.querySelector('[data-qa="referred-by-chip"], .referred-by-chip, .chip[data-field="referredBy"]');
}

function syncState(state){
  if(!state || !state.select) return;
  const value = state.select.value || '';
  if(state.hidden) state.hidden.value = value;
  if(state.chip){
    state.chip.textContent = value;
    state.chip.hidden = !value;
  }
}

export function setReferredBy(partner){
  if(!partner || !activeState || !activeState.select) return;
  const { select, hidden, chip } = activeState;
  const name = (partner.name || '').trim();
  const email = (partner.email || '').trim();
  const partnerId = partner.id != null ? String(partner.id) : '';
  const displayName = name || email || 'New Partner';
  let option = Array.from(select.options || []).find(opt => partnerId && opt.dataset && opt.dataset.partnerId === partnerId);
  if(!option){
    option = Array.from(select.options || []).find(opt => opt.value === displayName);
  }
  if(!option){
    option = document.createElement('option');
    option.value = displayName;
    option.textContent = displayName;
    if(partnerId) option.dataset.partnerId = partnerId;
    select.appendChild(option);
  }else{
    option.value = displayName;
    option.textContent = displayName;
    if(partnerId) option.dataset.partnerId = partnerId;
  }
  select.value = option.value;
  if(partnerId){
    select.dataset.partnerId = partnerId;
    if(hidden) hidden.dataset.partnerId = partnerId;
  }
  if(hidden) hidden.value = option.value;
  if(chip){
    chip.textContent = option.value;
    chip.hidden = !option.value;
  }
  syncState(activeState);
  document.dispatchEvent(new CustomEvent('contact:referredBy:set', { detail: partner }));
  select.dispatchEvent(new Event('change', { bubbles:true }));
}

function ensureButton(state){
  if(!state || !state.select) return;
  const { select, label } = state;
  const container = label || select.parentElement || state.body || select.parentNode;
  let button = container?.querySelector?.(`[data-qa="${QA_BUTTON}"]`);
  if(!button){
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn ghost compact';
    button.setAttribute('data-qa', QA_BUTTON);

    const icon = document.createElement('span');
    icon.className = 'btn-icon';
    icon.textContent = '+';
    icon.setAttribute('aria-hidden', 'true');

    const labelText = document.createElement('span');
    labelText.textContent = 'Add Contact';

    button.append(icon, labelText);
    button.setAttribute('title', 'Add Contact');
    button.setAttribute('aria-label', 'Add Contact');

    select.insertAdjacentElement('afterend', button);
  }
  if(!button.__wired){
    button.__wired = true;
    button.addEventListener('click', (evt)=>{
      evt.preventDefault();
      const openQuick = (window.CRM && typeof window.CRM.openPartnerQuickCreate === 'function')
        ? window.CRM.openPartnerQuickCreate
        : (typeof window.openPartnerQuickCreate === 'function' ? window.openPartnerQuickCreate : null);
      if(typeof openQuick !== 'function'){
        if(window.Toast?.show) window.Toast.show('Partner quick create unavailable');
        return;
      }
      openQuick((p)=> setReferredBy(p));
    });
  }
  state.button = button;
}

function enhance(body){
  if(!body) return null;
  const select = body.querySelector('#c-ref');
  if(!select) return null;
  select.name = select.name || 'referredBy';
  const label = select.closest('label') || select.parentElement || body;
  const hidden = ensureHidden(select);
  const chip = findChip(label);
  const state = { body, select, label, hidden, chip };
  const sync = ()=> syncState(state);
  sync();
  if(!select.__referredBySync){
    select.__referredBySync = sync;
    select.addEventListener('change', sync);
    select.addEventListener('input', sync);
  }
  ensureButton(state);
  return state;
}

(function init(){
  if(!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
  if(window.__INIT_FLAGS__.contact_form_quick_partner) return;
  window.__INIT_FLAGS__.contact_form_quick_partner = true;

  document.addEventListener('contact:modal:ready', (evt)=>{
    const body = evt?.detail?.body;
    activeState = enhance(body);
    syncState(activeState);
  }, { passive:true });
})();
