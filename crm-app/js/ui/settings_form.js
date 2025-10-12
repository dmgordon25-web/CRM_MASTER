import { validateSettings } from '../data/settings.js';

const FIELD_QUERIES = {
  timezone: ['[data-field="timezone"]', '#settings-timezone', 'input[name="timezone"]', 'select[name="timezone"]'],
  'workHours.start': ['[data-field="workHours.start"]', '#work-hours-start', 'input[name="workHours.start"]'],
  'workHours.end': ['[data-field="workHours.end"]', '#work-hours-end', 'input[name="workHours.end"]'],
  'email.from': ['[data-field="email.from"]', '#email-from', 'input[name="email.from"]'],
  'notifications.enabled': ['[data-field="notifications.enabled"]', '#notifications-enabled', 'input[name="notifications.enabled"]']
};

function getField(form, path){
  if(!form) return null;
  const queries = FIELD_QUERIES[path] || [];
  for(const query of queries){
    if(!query) continue;
    const el = form.querySelector(query);
    if(el) return el;
  }
  return null;
}

function ensureFieldAttributes(form){
  form.setAttribute('data-qa', 'settings-form');
  Object.keys(FIELD_QUERIES).forEach(path => {
    const field = getField(form, path);
    if(field && field.getAttribute('name') !== path){
      field.setAttribute('name', path);
    }
  });
}

function clearFieldErrors(form){
  form.querySelectorAll('.field-error').forEach(node => node.remove());
  form.querySelectorAll('[data-settings-error="true"]').forEach(field => {
    field.removeAttribute('data-settings-error');
    field.removeAttribute('aria-invalid');
  });
}

function renderErrors(form, errors){
  if(!errors || !errors.length) return;
  const rendered = new Set();
  let firstField = null;
  errors.forEach(error => {
    const path = error?.path;
    if(!path || rendered.has(path)) return;
    const field = getField(form, path);
    if(!field) return;
    rendered.add(path);
    field.setAttribute('data-settings-error', 'true');
    field.setAttribute('aria-invalid', 'true');
    const errorEl = document.createElement('div');
    errorEl.className = 'field-error';
    errorEl.dataset.qa = 'settings-error';
    errorEl.textContent = error?.reason || 'Invalid value';
    field.insertAdjacentElement('afterend', errorEl);
    if(!firstField) firstField = field;
  });
  if(firstField && typeof firstField.focus === 'function'){
    firstField.focus();
  }
}

function readTextValue(field){
  if(!field) return '';
  const raw = field.value ?? '';
  const text = typeof raw === 'string' ? raw : String(raw);
  return text.trim();
}

function readBooleanValue(field){
  if(!field) return null;
  if(field instanceof HTMLInputElement && field.type === 'checkbox'){
    return field.checked;
  }
  const value = readTextValue(field);
  if(!value) return value;
  const normalized = value.toLowerCase();
  if(normalized === 'true') return true;
  if(normalized === 'false') return false;
  return value;
}

function gatherValues(form){
  const timezoneField = getField(form, 'timezone');
  const workStartField = getField(form, 'workHours.start');
  const workEndField = getField(form, 'workHours.end');
  const emailField = getField(form, 'email.from');
  const notificationsField = getField(form, 'notifications.enabled');
  return {
    timezone: readTextValue(timezoneField),
    workHours: {
      start: readTextValue(workStartField),
      end: readTextValue(workEndField)
    },
    email: {
      from: readTextValue(emailField)
    },
    notifications: {
      enabled: readBooleanValue(notificationsField)
    }
  };
}

async function hydrateForm(form){
  if(!form || !window.Settings || typeof window.Settings.get !== 'function'){
    return;
  }
  try{
    const data = await window.Settings.get();
    const timezoneField = getField(form, 'timezone');
    if(timezoneField){
      const timezoneValue = typeof data?.timezone === 'string' ? data.timezone : '';
      timezoneField.value = timezoneValue;
    }
    const workHours = data && typeof data.workHours === 'object' ? data.workHours : {};
    const workStartField = getField(form, 'workHours.start');
    if(workStartField){
      const startValue = workHours && workHours.start != null ? workHours.start : '';
      workStartField.value = startValue === null ? '' : String(startValue ?? '');
    }
    const workEndField = getField(form, 'workHours.end');
    if(workEndField){
      const endValue = workHours && workHours.end != null ? workHours.end : '';
      workEndField.value = endValue === null ? '' : String(endValue ?? '');
    }
    const emailField = getField(form, 'email.from');
    if(emailField){
      const fromValue = data && typeof data.email === 'object' && typeof data.email.from === 'string'
        ? data.email.from
        : '';
      emailField.value = fromValue;
    }
    const notificationsField = getField(form, 'notifications.enabled');
    if(notificationsField){
      const enabledValue = data && typeof data.notifications === 'object'
        ? data.notifications.enabled
        : undefined;
      if(notificationsField instanceof HTMLInputElement && notificationsField.type === 'checkbox'){
        notificationsField.checked = enabledValue === true;
      }else if(enabledValue != null){
        notificationsField.value = String(enabledValue);
      }else{
        notificationsField.value = '';
      }
    }
  }catch (err){
    if(typeof console !== 'undefined' && console && console.warn){
      console.warn('[settings-form] hydrate failed', err);
    }
  }
}

function showValidationToast(errors){
  if(!errors || !errors.length) return;
  if(window.Toast && typeof window.Toast.show === 'function'){
    try{
      const first = errors[0];
      const path = first && first.path ? first.path : 'invalid field';
      window.Toast.show('Settings validation: ' + path);
    }catch (err){
      if(typeof console !== 'undefined' && console && console.warn){
        console.warn('[settings-form] toast failed', err);
      }
    }
  }
}

function handleSubmit(evt){
  evt.preventDefault();
  const form = evt.currentTarget instanceof HTMLFormElement ? evt.currentTarget : evt.target?.form;
  if(!form) return;
  clearFieldErrors(form);
  const values = gatherValues(form);
  const validation = validateSettings(values);
  if(!validation.ok){
    renderErrors(form, validation.errors);
    showValidationToast(validation.errors);
    return;
  }
  if(!window.Settings || typeof window.Settings.save !== 'function'){
    if(typeof console !== 'undefined' && console && console.warn){
      console.warn('[settings-form] Settings API unavailable for save');
    }
    return;
  }
  const saveResult = window.Settings.save(values);
  Promise.resolve(saveResult).catch(err => {
    if(typeof console !== 'undefined' && console && console.warn){
      console.warn('[settings-form] save failed', err);
    }
  });
}

let wired = false;

export function initSettingsForm(){
  if(typeof document === 'undefined') return null;
  const form = document.querySelector('[data-qa="settings-form"]')
    || document.querySelector('form[data-settings="general"]')
    || document.querySelector('#settings-form');
  if(!form || form.__settingsFormWired) return form || null;
  form.__settingsFormWired = true;
  form.noValidate = true;
  ensureFieldAttributes(form);
  form.addEventListener('submit', handleSubmit);
  hydrateForm(form);
  if(!form.__settingsFormAppChanged){
    const listener = evt => {
      const scope = evt?.detail?.scope;
      if(scope && scope !== 'settings') return;
      hydrateForm(form);
    };
    document.addEventListener('app:data:changed', listener);
    form.__settingsFormAppChanged = listener;
  }
  wired = true;
  return form;
}

function autoInit(){
  if(typeof document === 'undefined') return;
  const run = () => { initSettingsForm(); };
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', run, { once: true });
  }else{
    run();
  }
}

if(typeof window !== 'undefined'){
  window.CRM = window.CRM || {};
  window.CRM.initSettingsForm = initSettingsForm;
  window.CRM.hydrateSettingsForm = hydrateSettingsForm;
}

autoInit();

export function hydrateSettingsForm(){
  if(!wired) return;
  if(typeof document === 'undefined') return;
  const form = document.querySelector('[data-qa="settings-form"]')
    || document.querySelector('form[data-settings="general"]')
    || document.querySelector('#settings-form');
  if(form) hydrateForm(form);
}

