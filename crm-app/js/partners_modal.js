import './contacts/form.js';
import { openPartnerEditModal } from './ui/modals/partner_edit/index.js';

window.CRM = window.CRM || {};

export function openPartnerQuickCreate(cb){
  window.CRM = window.CRM || {};
  const token = `partner-quick-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let dialog = null;
  let cleaned = false;

  const focusNameField = (root)=>{
    if(!root) return;
    const form = root.querySelector('#partner-form');
    const nameInput = form?.querySelector('#p-name');
    if(nameInput && typeof nameInput.focus === 'function'){
      if(typeof requestAnimationFrame === 'function'){
        requestAnimationFrame(()=>{
          try{ nameInput.focus(); }
          catch(_err){ try{ nameInput.focus(); }catch(__err){} }
        });
      }else{
        try{ nameInput.focus(); }
        catch(_err){}
      }
    }
  };

  const cleanup = ()=>{
    if(cleaned) return;
    cleaned = true;
    document.removeEventListener('app:data:changed', handleAppDataChanged, true);
    if(dialog){
      try{ dialog.removeEventListener('close', cleanupHandler); }
      catch(_err){}
    }
    dialog = null;
  };

  const cleanupHandler = ()=>{
    cleanup();
  };

  const handleAppDataChanged = async (event)=>{
    if(!event || !event.detail) return;
    const detail = event.detail;
    if(detail.scope !== 'partners' || detail.action !== 'create') return;
    const partnerId = detail.partnerId ? String(detail.partnerId) : '';
    if(!partnerId) return;
    if(dialog && dialog.dataset && dialog.dataset.quickCreateToken !== token) return;
    cleanup();
    if(typeof cb !== 'function') return;
    try{
      if(typeof openDB === 'function' && typeof dbGet === 'function'){
        await openDB();
        const record = await dbGet('partners', partnerId);
        if(record){
          cb({ id: record.id, name: record.name, email: record.email });
          return;
        }
      }
    }catch(err){
      try{ console && console.warn && console.warn('partner quick create callback fetch failed', err); }
      catch(_err){}
    }
    try{ cb({ id: partnerId }); }
    catch(_err){}
  };

  document.addEventListener('app:data:changed', handleAppDataChanged, true);

  const result = Promise.resolve(openPartnerEditModal('', { sourceHint: 'partner:quick-create' }));
  result.then(root => {
    dialog = root || null;
    if(!dialog){
      cleanup();
      return null;
    }
    if(dialog.dataset){
      dialog.dataset.quickCreateToken = token;
    }
    try{ dialog.addEventListener('close', cleanupHandler, { once: true }); }
    catch(_err){ dialog.addEventListener('close', cleanupHandler); }
    focusNameField(dialog);
    return dialog;
  }).catch(err => {
    cleanup();
    throw err;
  });

  return result;
}

window.CRM.openPartnerQuickCreate = openPartnerQuickCreate;
