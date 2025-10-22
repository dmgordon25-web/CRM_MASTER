import { openPartnerEditModal } from './modals/partner_edit/index.js';

const STATE_KEY = '__WIRED_GLOBAL_NEW_BUTTON__';
const MENU_ID = 'header-new-menu';
const BUTTON_ID = 'btn-header-new';

function showToast(message) {
  const text = String(message ?? '').trim();
  if (!text) return;
  const toastApi = window.Toast;
  if (toastApi && typeof toastApi.show === 'function') {
    toastApi.show(text);
    return;
  }
  if (typeof window.toast === 'function') {
    window.toast(text);
  }
}

function callSafely(fn, ...args) {
  if (typeof fn !== 'function') return null;
  try {
    return fn(...args);
  } catch (err) {
    console && console.warn && console.warn('header new button action failed', err);
    showToast('Something went wrong');
    return null;
  }
}

function createMenuItem(label, onSelect) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn ghost';
  btn.textContent = label;
  btn.dataset.role = `header-new-${label.toLowerCase()}`;
  btn.addEventListener('click', (event) => {
    event.preventDefault();
    onSelect();
  });
  return btn;
}

function setupGlobalNewButton() {
  if (window[STATE_KEY]) return;

  const header = document.querySelector('.header-bar');
  if (!header) return;

  window[STATE_KEY] = true;

  const legacyButtons = header.querySelectorAll('#btn-add-contact');
  legacyButtons.forEach((btn) => {
    if (btn && btn.parentNode) {
      btn.parentNode.removeChild(btn);
    }
  });

  const host = document.createElement('div');
  host.className = 'dropdown header-new-wrap';
  host.style.position = 'relative';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'btn brand';
  toggle.id = BUTTON_ID;
  toggle.textContent = '+ New';
  toggle.setAttribute('aria-haspopup', 'true');
  toggle.setAttribute('aria-expanded', 'false');
  host.appendChild(toggle);

  const menu = document.createElement('div');
  menu.className = 'card hidden';
  menu.id = MENU_ID;
  menu.style.position = 'absolute';
  menu.style.top = '42px';
  menu.style.right = '0';
  menu.style.minWidth = '160px';
  menu.style.padding = '8px';
  menu.style.display = 'flex';
  menu.style.flexDirection = 'column';
  menu.style.gap = '4px';
  menu.hidden = true;
  host.appendChild(menu);

  function closeMenu() {
    if (menu.hidden) return;
    menu.hidden = true;
    menu.classList.add('hidden');
    toggle.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onDocumentClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
  }

  function openMenu() {
    if (!menu.hidden) return;
    menu.hidden = false;
    menu.classList.remove('hidden');
    toggle.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', onDocumentClick, true);
    document.addEventListener('keydown', onKeyDown, true);
  }

  function onDocumentClick(event) {
    if (!host.contains(event.target)) {
      closeMenu();
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      closeMenu();
      toggle.focus();
    }
  }

  toggle.addEventListener('click', (event) => {
    event.preventDefault();
    if (menu.hidden) openMenu();
    else closeMenu();
  });

  const actions = {
    contact() {
      closeMenu();
      if (typeof window.renderContactModal === 'function') {
        callSafely(window.renderContactModal, null);
        return;
      }
      if (typeof window.openNewContact === 'function') {
        callSafely(window.openNewContact);
        return;
      }
      showToast('Contact modal unavailable');
    },
    partner() {
      closeMenu();
      if (typeof openPartnerEditModal === 'function') {
        Promise.resolve(callSafely(openPartnerEditModal, '', { allowAutoOpen: true }));
        return;
      }
      if (typeof window.openPartnerEditModal === 'function') {
        Promise.resolve(callSafely(window.openPartnerEditModal, '', { allowAutoOpen: true }));
        return;
      }
      showToast('Partner modal unavailable');
    },
    task() {
      closeMenu();
      const fn = window.openTaskQuickAdd;
      if (typeof fn === 'function') {
        callSafely(fn);
        return;
      }
      showToast('Tasks coming soon');
    }
  };

  menu.appendChild(createMenuItem('Contact', actions.contact));
  menu.appendChild(createMenuItem('Partner', actions.partner));
  menu.appendChild(createMenuItem('Task', actions.task));

  const notifWrap = header.querySelector('#notif-wrap');
  if (notifWrap && notifWrap.parentNode === header) {
    header.insertBefore(host, notifWrap);
  } else {
    header.appendChild(host);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupGlobalNewButton, { once: true });
  } else {
    setupGlobalNewButton();
  }
}

export {};
(function(){
  if(typeof window === 'undefined' || typeof document === 'undefined') return;

  const PROFILE_KEY = 'profile:v1';
  const PHOTO_MAX_BYTES = 256 * 1024;

  function readProfileLocal(){
    try{
      const raw = localStorage.getItem(PROFILE_KEY);
      if(!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    }catch (_err){
      return null;
    }
  }

  function writeProfileLocal(profile){
    try{
      if(profile && typeof profile === 'object'){
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      }else{
        localStorage.removeItem(PROFILE_KEY);
      }
    }catch (_err){}
  }

  function mergeProfile(patch){
    const current = readProfileLocal() || {};
    const merged = Object.assign({}, current, patch || {});
    writeProfileLocal(merged);
    if(window.Settings && typeof window.Settings.save === 'function'){
      try{
        const result = window.Settings.save({ loProfile: merged });
        if(result && typeof result.then === 'function'){
          result.catch(()=>{});
        }
      }catch (_err){}
    }
    return merged;
  }

  function renderHeader(profile){
    const chip = document.getElementById('lo-profile-chip');
    if(!chip) return;
    const nameEl = chip.querySelector('[data-role="lo-name"]');
    const contactEl = chip.querySelector('[data-role="lo-contact"]');
    const name = typeof profile?.name === 'string' ? profile.name.trim() : '';
    const email = typeof profile?.email === 'string' ? profile.email.trim() : '';
    const phone = typeof profile?.phone === 'string' ? profile.phone.trim() : '';
    const photo = typeof profile?.photoDataUrl === 'string' ? profile.photoDataUrl : '';
    if(nameEl){
      if(photo){
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
      }else if(nameEl.__photoOriginal){
        const original = nameEl.__photoOriginal;
        nameEl.style.display = original.display;
        nameEl.style.alignItems = original.alignItems;
        nameEl.style.gap = original.gap;
      }
      nameEl.textContent = name || 'Set your profile';
      if(photo){
        let img = nameEl.querySelector('[data-role="lo-photo"]');
        if(!img){
          img = document.createElement('img');
          img.dataset.role = 'lo-photo';
          img.alt = '';
          img.style.cssText = 'width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;';
          nameEl.insertBefore(img, nameEl.firstChild);
        }
        img.src = photo;
      }else{
        const img = nameEl.querySelector('[data-role="lo-photo"]');
        if(img) img.remove();
      }
    }
    if(contactEl){
      const parts = [];
      if(email) parts.push(email);
      if(phone) parts.push(phone);
      contactEl.textContent = parts.length ? parts.join(' • ') : '—';
    }
  }

  function renderPhotoPreview(photo){
    const preview = document.getElementById('lo-photo-preview');
    const emptyState = document.getElementById('lo-photo-empty');
    if(preview){
      if(photo){
        preview.src = photo;
        preview.style.display = 'block';
      }else{
        preview.removeAttribute('src');
        preview.style.display = 'none';
      }
    }
    if(emptyState){
      emptyState.style.display = photo ? 'none' : '';
    }
  }

  function applyProfile(profile){
    renderHeader(profile || {});
    const photo = profile && typeof profile.photoDataUrl === 'string' ? profile.photoDataUrl : '';
    renderPhotoPreview(photo);
  }

  function handleFileInput(input){
    const file = input && input.files ? input.files[0] : null;
    if(!file){
      if(input) input.value = '';
      return;
    }
    if(file.size > PHOTO_MAX_BYTES){
      if(window.Toast && typeof window.Toast.show === 'function'){
        window.Toast.show('Please choose an image under 256 KB.');
      }
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.addEventListener('load', ()=>{
      const result = reader.result;
      if(typeof result === 'string'){
        const profile = mergeProfile({ photoDataUrl: result });
        applyProfile(profile);
      }else if(window.Toast && typeof window.Toast.show === 'function'){
        window.Toast.show('Unable to read image.');
      }
      input.value = '';
    });
    reader.addEventListener('error', ()=>{
      if(window.Toast && typeof window.Toast.show === 'function'){
        window.Toast.show('Unable to read image.');
      }
      input.value = '';
    });
    try{
      reader.readAsDataURL(file);
    }catch (_err){
      if(window.Toast && typeof window.Toast.show === 'function'){
        window.Toast.show('Unable to read image.');
      }
      input.value = '';
    }
  }

  function handleClear(){
    const profile = mergeProfile({ photoDataUrl: '' });
    applyProfile(profile);
  }

  function ensureControls(){
    const panel = document.getElementById('lo-profile-settings');
    if(!panel) return;
    let input = document.getElementById('lo-photo');
    if(!input){
      const label = panel.querySelector('label:last-of-type') || panel;
      input = document.createElement('input');
      input.id = 'lo-photo';
      label.appendChild(input);
    }
    input.type = 'file';
    input.accept = 'image/*';
    if(!input.__headerToolbar){
      input.__headerToolbar = true;
      input.addEventListener('change', evt => {
        const target = evt && evt.target instanceof HTMLInputElement ? evt.target : input;
        handleFileInput(target);
      });
    }
    const clearBtn = document.getElementById('btn-lo-photo-clear');
    if(clearBtn && !clearBtn.__headerToolbar){
      clearBtn.__headerToolbar = true;
      clearBtn.addEventListener('click', evt => {
        evt.preventDefault();
        evt.stopPropagation();
        handleClear();
      });
    }
  }

  function hydrate(){
    const localProfile = readProfileLocal();
    if(localProfile){
      applyProfile(localProfile);
      return;
    }
    if(window.Settings && typeof window.Settings.get === 'function'){
      Promise.resolve(window.Settings.get())
        .then(data => {
          const profile = data && typeof data.loProfile === 'object' ? data.loProfile : {};
          if(profile && typeof profile === 'object'){
            writeProfileLocal(profile);
            applyProfile(profile);
          }
        })
        .catch(()=>{});
    }
  }

  const init = ()=>{
    ensureControls();
    hydrate();
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once:true });
  }else{
    init();
  }

  window.addEventListener('storage', evt => {
    if(evt && evt.key === PROFILE_KEY){
      hydrate();
    }
  });

  document.addEventListener('app:data:changed', evt => {
    const scope = evt && evt.detail && evt.detail.scope;
    if(scope && scope !== 'settings') return;
    hydrate();
  });
})();
