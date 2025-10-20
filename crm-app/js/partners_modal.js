import './contacts/form.js';

window.CRM = window.CRM || {};

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
