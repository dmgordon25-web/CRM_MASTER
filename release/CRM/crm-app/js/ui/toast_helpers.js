const FALLBACK_MESSAGES = {
  success: 'Saved',
  info: 'Heads up',
  warn: 'Something went wrong',
  error: 'Something went wrong',
  default: 'Saved'
};

function coerceMessage(message, fallback){
  const text = String(message == null ? '' : message).trim();
  if(text) return text;
  const base = fallback || FALLBACK_MESSAGES.default;
  return typeof base === 'string' ? base : '';
}

function getToastApis(){
  if(typeof window === 'undefined') return { toast: null, legacy: null };
  const toast = window.Toast || null;
  const legacy = typeof window.toast === 'function' ? window.toast : null;
  return { toast, legacy };
}

export function showToast(kind, message, options){
  const finalMessage = coerceMessage(message, FALLBACK_MESSAGES[kind] || FALLBACK_MESSAGES.default);
  if(!finalMessage) return false;
  const { toast, legacy } = getToastApis();
  if(toast && typeof toast[kind] === 'function'){
    try { toast[kind](finalMessage, options); return true; }
    catch (_) {}
  }
  if(toast && typeof toast.show === 'function'){
    try { toast.show(finalMessage, options); return true; }
    catch (_) {}
  }
  if(legacy){
    try { legacy(finalMessage, options); return true; }
    catch (_) {}
  }
  return false;
}

export const toastSuccess = (message, options) => showToast('success', message, options);
export const toastInfo = (message, options) => showToast('info', message, options);
export const toastWarn = (message, options) => showToast('warn', message, options);
export const toastError = (message, options) => showToast('error', message, options);

export function toastSoftError(label, err, message, options){
  try {
    if(typeof console !== 'undefined' && console && typeof console.warn === 'function'){
      if(label && err !== undefined){
        console.warn(label, err);
      }else if(label){
        console.warn(label);
      }else if(err !== undefined){
        console.warn(err);
      }
    }
  } catch (_) {}
  return toastWarn(message, options);
}
