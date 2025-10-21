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
