const STYLE_ID = 'modal-inline-actions-style';

function ensureStyles(){
  if(typeof document === 'undefined') return;
  if(document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .record-modal .modal-header.has-inline-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .record-modal .modal-header.has-inline-actions .modal-actions-wrap{flex-basis:100%;display:flex;flex-direction:column;gap:8px}
    .record-modal .modal-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .record-modal .modal-actions button{border-radius:999px;padding:6px 12px;font-size:12px;font-weight:600;background:var(--surface-muted,#eef2ff);color:#1e293b;border:none;cursor:pointer}
    .record-modal .modal-actions button:focus-visible{outline:2px solid var(--primary,#2563eb);outline-offset:2px}
    .record-modal .modal-actions button[data-active="1"]{background:var(--primary,#2563eb);color:var(--primary-text,#f8fafc)}
    .record-modal .modal-action-panel{display:flex;flex-direction:column;gap:6px;background:var(--surface-raised,#f8fafc);border:1px solid rgba(15,23,42,0.12);border-radius:10px;padding:10px 12px}
    .record-modal .modal-action-panel[hidden]{display:none}
    .record-modal .modal-action-panel textarea{width:100%;min-height:72px;border:1px solid rgba(15,23,42,0.16);border-radius:8px;padding:8px;font:inherit;resize:vertical}
    .record-modal .modal-action-panel input[type="datetime-local"],
    .record-modal .modal-action-panel input[type="date"],
    .record-modal .modal-action-panel input[type="time"]{border:1px solid rgba(15,23,42,0.16);border-radius:8px;padding:6px 8px;font:inherit}
    .record-modal .modal-action-panel .panel-actions{display:flex;gap:8px;justify-content:flex-end}
    .record-modal .modal-action-hint{color:#b91c1c;font-size:12px}
  `;
  document.head.appendChild(style);
}

function toast(kind, message){
  const text = String(message == null ? '' : message).trim();
  if(!text) return;
  const toastApi = typeof window !== 'undefined' ? window.Toast : null;
  if(toastApi){
    const handler = typeof toastApi[kind] === 'function' ? toastApi[kind].bind(toastApi)
      : (typeof toastApi.show === 'function' ? toastApi.show.bind(toastApi) : null);
    if(handler){
      try{ handler(text); return; }
      catch(_){}
    }
  }
  if(typeof window !== 'undefined' && typeof window.toast === 'function'){
    try{ window.toast(text); return; }
    catch(_){}
  }
  try{ console && console.log && console.log(text); }
  catch(_){}
}

function makeId(prefix){
  if(typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function'){
    return window.crypto.randomUUID();
  }
  if(typeof window !== 'undefined' && typeof window.uuid === 'function'){
    try{ return window.uuid(); }
    catch(_){}
  }
  const base = typeof prefix === 'string' ? prefix : 'id';
  return `${base}-${Date.now()}-${Math.floor(Math.random()*1000)}`;
}

function formatStamp(date){
  if(!(date instanceof Date)) return '';
  const pad = (n)=> String(n).padStart(2,'0');
  const yr = date.getFullYear();
  const mo = pad(date.getMonth()+1);
  const dy = pad(date.getDate());
  const hr = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yr}-${mo}-${dy} ${hr}:${min}`;
}

function findHandler(candidates){
  for(const getter of candidates){
    try{
      const fn = getter();
      if(typeof fn === 'function') return fn;
    }catch(_){ /* ignore */ }
  }
  return null;
}

function resolveEmailHandler(){
  return findHandler([
    ()=> window?.CRM?.channels?.email?.compose,
    ()=> window?.CRM?.actions?.email?.compose,
    ()=> window?.CRM?.email?.compose,
    ()=> window?.composeEmail,
    ()=> window?.openCompose,
    ()=> window?.openEmailComposer,
    ()=> window?.emailComposer?.open
  ]);
}

function resolveSmsHandler(){
  return findHandler([
    ()=> window?.CRM?.channels?.sms?.compose,
    ()=> window?.CRM?.actions?.sms?.compose,
    ()=> window?.CRM?.sms?.compose,
    ()=> window?.composeSms,
    ()=> window?.openSms,
    ()=> window?.openTextComposer
  ]);
}

function triggerChannel(handler, payload){
  if(typeof handler !== 'function') return false;
  try{
    if(handler === window?.openCompose && payload?.id){
      handler(payload.id);
    }else if(handler.length >= 1){
      handler(payload);
    }else{
      handler();
    }
    return true;
  }catch(err){
    try{ console && console.warn && console.warn('modal action handler failed', err); }
    catch(_){}
    return false;
  }
}

function prependNote(existing, note){
  const trimmed = String(existing || '').trim();
  return trimmed ? `${note}\n\n${trimmed}` : note;
}

async function persistNote(config, dialog, noteText, context){
  const id = config.getId(dialog, context) || '';
  if(!id){
    updateNoteField(config, dialog, prependNote(getCurrentNoteValue(config, dialog), noteText));
    return { status:'staged' };
  }
  let record = null;
  try{
    await window.openDB();
    record = await window.dbGet(config.store, id);
  }catch(err){
    try{ console && console.warn && console.warn('modal note load failed', err); }
    catch(_){}
  }
  const combined = prependNote(record?.notes, noteText);
  if(record){
    const updated = Object.assign({}, record, { notes: combined, updatedAt: Date.now() });
    try{ await window.dbPut(config.store, updated); }
    catch(err){ try{ console && console.warn && console.warn('modal note save failed', err); }
      catch(_){}
    }
  }
  updateNoteField(config, dialog, prependNote(getCurrentNoteValue(config, dialog), noteText));
  return { status: record ? 'saved' : 'staged' };
}

function getCurrentNoteValue(config, dialog){
  const field = config.getNoteField(dialog);
  return field ? field.value : '';
}

function updateNoteField(config, dialog, value){
  const field = config.getNoteField(dialog);
  if(field){
    field.value = value;
    try{ field.dispatchEvent(new Event('input', { bubbles:true })); }
    catch(_){}
  }
}

async function persistReminder(config, dialog, isoValue, context){
  const id = config.getId(dialog, context) || '';
  if(!isoValue){
    return { status:'invalid' };
  }
  try{
    await window.openDB();
  }catch(err){
    try{ console && console.warn && console.warn('modal reminder openDB failed', err); }
    catch(_){}
    return { status:'error' };
  }
  const record = {
    id: makeId('reminder'),
    entity: config.entity,
    contactId: config.entity === 'contact' ? id : null,
    partnerId: config.entity === 'partner' ? id : null,
    label: context.reminderLabel || 'Reminder',
    due: isoValue,
    done: false,
    updatedAt: Date.now(),
    createdAt: Date.now(),
    type: 'reminder'
  };
  try{
    await window.dbPut('tasks', record);
  }catch(err){
    try{ console && console.warn && console.warn('modal reminder save failed', err); }
    catch(_){}
    return { status:'error' };
  }
  return { status:'saved', record };
}

function hidePanel(panel){
  if(!panel) return;
  panel.hidden = true;
}

function showPanel(panel){
  if(!panel) return;
  panel.hidden = false;
}

function buildContext(config, dialog, detail){
  const name = config.getName(dialog, detail) || '';
  const email = config.getEmail(dialog, detail) || '';
  const phone = config.getPhone(dialog, detail) || '';
  const id = config.getId(dialog, detail) || '';
  return {
    id,
    name,
    email,
    phone,
    reminderLabel: config.getReminderLabel(dialog, { id, name, email, phone })
  };
}

function ensureWrap(dialog, config){
  const header = config.getHeader(dialog);
  if(!header) return null;
  header.classList.add('has-inline-actions');
  let wrap = header.querySelector('.modal-actions-wrap');
  if(!wrap){
    wrap = document.createElement('div');
    wrap.className = 'modal-actions-wrap';
    header.appendChild(wrap);
  }
  return wrap;
}

function createActionButton(label, qa){
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-ghost';
  btn.textContent = label;
  btn.setAttribute('data-qa', qa);
  return btn;
}

function ensurePanels(entry, wrap){
  if(!entry.notePanel){
    const panel = document.createElement('div');
    panel.className = 'modal-action-panel note-panel';
    panel.hidden = true;
    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Add a quick note';
    textarea.setAttribute('data-role', 'note-input');
    panel.appendChild(textarea);
    const hint = document.createElement('div');
    hint.className = 'modal-action-hint';
    hint.hidden = true;
    hint.setAttribute('data-role', 'note-hint');
    panel.appendChild(hint);
    const actions = document.createElement('div');
    actions.className = 'panel-actions';
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'btn brand compact';
    save.textContent = 'Save';
    save.setAttribute('data-role', 'note-save');
    actions.appendChild(save);
    panel.appendChild(actions);
    wrap.appendChild(panel);
    entry.notePanel = { panel, textarea, hint, save };
  }
  if(!entry.reminderPanel){
    const panel = document.createElement('div');
    panel.className = 'modal-action-panel reminder-panel';
    panel.hidden = true;
    const picker = document.createElement('input');
    picker.type = 'datetime-local';
    picker.setAttribute('data-role', 'reminder-input');
    panel.appendChild(picker);
    const hint = document.createElement('div');
    hint.className = 'modal-action-hint';
    hint.hidden = true;
    hint.setAttribute('data-role', 'reminder-hint');
    panel.appendChild(hint);
    const actions = document.createElement('div');
    actions.className = 'panel-actions';
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'btn brand compact';
    save.textContent = 'Set Reminder';
    save.setAttribute('data-role', 'reminder-save');
    actions.appendChild(save);
    panel.appendChild(actions);
    wrap.appendChild(panel);
    entry.reminderPanel = { panel, picker, hint, save };
  }
}

function hideHints(panel){
  if(!panel) return;
  if(panel.hint){ panel.hint.hidden = true; }
}

function showHint(panel, message){
  if(!panel || !panel.hint) return;
  panel.hint.textContent = message;
  panel.hint.hidden = false;
}

function collapsePanels(entry){
  if(entry.notePanel){ hidePanel(entry.notePanel.panel); hideHints(entry.notePanel); }
  if(entry.reminderPanel){ hidePanel(entry.reminderPanel.panel); hideHints(entry.reminderPanel); }
  if(entry.noteButton){ entry.noteButton.dataset.active = '0'; entry.noteButton.setAttribute('aria-expanded','false'); }
  if(entry.reminderButton){ entry.reminderButton.dataset.active = '0'; entry.reminderButton.setAttribute('aria-expanded','false'); }
}

function wireDialog(dialog, config, detail){
  ensureStyles();
  const wrap = ensureWrap(dialog, config);
  if(!wrap) return;
  const entry = dialog.__modalActions || { config };
  dialog.__modalActions = entry;
  if(!entry.actionsBar){
    const bar = document.createElement('div');
    bar.className = 'modal-actions';
    bar.setAttribute('data-qa', 'modal-actions');
    const emailBtn = createActionButton('Email', 'modal-action-email');
    emailBtn.setAttribute('aria-expanded', 'false');
    const smsBtn = createActionButton('SMS', 'modal-action-sms');
    const reminderBtn = createActionButton('Reminder', 'modal-action-reminder');
    reminderBtn.setAttribute('aria-expanded', 'false');
    const noteBtn = createActionButton('Note', 'modal-action-note');
    noteBtn.setAttribute('aria-expanded', 'false');
    bar.append(emailBtn, smsBtn, reminderBtn, noteBtn);
    wrap.appendChild(bar);
    entry.actionsBar = bar;
    entry.emailButton = emailBtn;
    entry.smsButton = smsBtn;
    entry.reminderButton = reminderBtn;
    entry.noteButton = noteBtn;
  }
  ensurePanels(entry, wrap);
  const contextFor = ()=> buildContext(config, dialog, detail);

  if(entry.emailButton && !entry.emailButton.__wired){
    entry.emailButton.__wired = true;
    entry.emailButton.addEventListener('click', ()=>{
      const context = contextFor();
      const handler = resolveEmailHandler();
      if(handler && triggerChannel(handler, context)) return;
      toast('info', 'Email channel not configured');
    });
  }

  if(entry.smsButton && !entry.smsButton.__wired){
    entry.smsButton.__wired = true;
    entry.smsButton.addEventListener('click', ()=>{
      const context = contextFor();
      const handler = resolveSmsHandler();
      if(handler && triggerChannel(handler, context)) return;
      toast('info', 'SMS channel not configured');
    });
  }

  if(entry.noteButton && entry.notePanel && !entry.noteButton.__wired){
    const { panel, textarea, save } = entry.notePanel;
    entry.noteButton.__wired = true;
    entry.noteButton.addEventListener('click', ()=>{
      const active = panel.hidden ? '0' : entry.noteButton.dataset.active === '1' ? '1' : '0';
      collapsePanels(entry);
      if(active === '1'){ return; }
      panel.hidden = false;
      hideHints(entry.notePanel);
      entry.noteButton.dataset.active = '1';
      entry.noteButton.setAttribute('aria-expanded', 'true');
      if(typeof textarea.focus === 'function') textarea.focus();
    });
    if(save && !save.__wired){
      save.__wired = true;
      save.addEventListener('click', async ()=>{
        const value = textarea.value.trim();
        if(!value){
          showHint(entry.notePanel, 'Add a note before saving');
          return;
        }
        hideHints(entry.notePanel);
        save.disabled = true;
        const stamp = formatStamp(new Date());
        const line = stamp ? `${stamp} — ${value}` : value;
        try{
          const context = contextFor();
          const result = await persistNote(config, dialog, line, context);
          if(result.status === 'error'){
            toast('show', 'Unable to save note');
          }else{
            textarea.value = '';
            collapsePanels(entry);
            toast('success', 'Note saved');
            document.dispatchEvent(new CustomEvent('modal:note:saved', { detail: { entity: config.entity, id: context.id } }));
          }
        }finally{
          save.disabled = false;
        }
      });
    }
  }

  if(entry.reminderButton && entry.reminderPanel && !entry.reminderButton.__wired){
    const { panel, picker, save } = entry.reminderPanel;
    entry.reminderButton.__wired = true;
    entry.reminderButton.addEventListener('click', ()=>{
      const wasActive = entry.reminderButton.dataset.active === '1';
      collapsePanels(entry);
      if(wasActive){ return; }
      panel.hidden = false;
      entry.reminderButton.dataset.active = '1';
      entry.reminderButton.setAttribute('aria-expanded', 'true');
      hideHints(entry.reminderPanel);
      if(picker && !picker.value){
        const now = new Date();
        now.setMinutes(now.getMinutes() + 60);
        try{
          picker.value = now.toISOString().slice(0,16);
        }catch(_){ /* ignore */ }
      }
      if(typeof picker.focus === 'function') picker.focus();
    });
    if(save && !save.__wired){
      save.__wired = true;
      save.addEventListener('click', async ()=>{
        const value = picker ? picker.value : '';
        if(!value){
          showHint(entry.reminderPanel, 'Choose a reminder date');
          return;
        }
        hideHints(entry.reminderPanel);
        save.disabled = true;
        const context = contextFor();
        const result = await persistReminder(config, dialog, value, context);
        save.disabled = false;
        if(result.status !== 'saved'){
          if(result.status === 'invalid') showHint(entry.reminderPanel, 'Choose a reminder date');
          else toast('show', 'Unable to set reminder');
          return;
        }
        collapsePanels(entry);
        toast('success', 'Reminder set');
        document.dispatchEvent(new CustomEvent('modal:reminder:set', { detail: { entity: config.entity, id: context.id } }));
      });
    }
  }
}

export function registerModalActions(config){
  if(typeof document === 'undefined') return;
  const settings = Object.assign({
    entity: 'contact',
    eventName: '',
    store: 'contacts',
    getDialog: detail => detail?.dialog || null,
    getHeader: dialog => dialog?.querySelector?.('.modal-header'),
    getBody: detail => detail?.body || null,
    getId: (dialog)=> dialog?.querySelector?.('[data-id]')?.getAttribute('data-id') || '',
    getNoteField: dialog => dialog?.querySelector?.('textarea[data-notes]'),
    getName: dialog => dialog?.querySelector?.('[data-name]')?.getAttribute('data-name') || '',
    getEmail: dialog => dialog?.querySelector?.('[type="email"]')?.value || '',
    getPhone: dialog => dialog?.querySelector?.('[type="tel"]')?.value || '',
    getReminderLabel: (_dialog, ctx) => ctx && ctx.name ? `Reminder for ${ctx.name}` : 'Reminder'
  }, config || {});
  if(!settings.eventName) return;
  if(!document.__MODAL_ACTION_REGISTRATIONS__) document.__MODAL_ACTION_REGISTRATIONS__ = new Set();
  if(document.__MODAL_ACTION_REGISTRATIONS__.has(settings.eventName)) return;
  document.__MODAL_ACTION_REGISTRATIONS__.add(settings.eventName);
  document.addEventListener(settings.eventName, (evt)=>{
    const dialog = settings.getDialog(evt.detail) || evt.detail?.dialog || null;
    if(!dialog) return;
    try{ wireDialog(dialog, settings, evt.detail || {}); }
    catch(err){ try{ console && console.warn && console.warn('modal actions failed', err); }
      catch(_){}
    }
  }, { passive:true });
}

registerModalActions({
  entity: 'contact',
  eventName: 'contact:modal:ready',
  store: 'contacts',
  getDialog: detail => detail?.dialog || null,
  getHeader: dialog => dialog?.querySelector?.('.modal-header'),
  getId: (dialog)=> dialog?.querySelector?.('#c-id')?.value?.trim() || '',
  getNoteField: dialog => dialog?.querySelector?.('#c-notes'),
  getName: (dialog)=>{
    const first = dialog?.querySelector?.('#c-first')?.value?.trim() || '';
    const last = dialog?.querySelector?.('#c-last')?.value?.trim() || '';
    return `${first} ${last}`.trim() || dialog?.querySelector?.('#c-summary-name')?.textContent?.trim() || 'Contact';
  },
  getEmail: dialog => dialog?.querySelector?.('#c-email')?.value?.trim() || '',
  getPhone: dialog => dialog?.querySelector?.('#c-phone')?.value?.trim() || '',
  getReminderLabel: (_dialog, ctx)=> ctx && ctx.name ? `Reminder for ${ctx.name}` : 'Reminder'
});
