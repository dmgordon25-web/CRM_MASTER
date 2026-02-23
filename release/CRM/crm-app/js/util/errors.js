const hasConsoleError = () => typeof console !== 'undefined' && console && typeof console.error === 'function';

function logError(context, err) {
  const label = context ? `[${context}]` : '[error]';
  try {
    if (hasConsoleError()) {
      console.error(label, err);
    }
  } catch (consoleErr) {
    try { console.error('Logging failure', consoleErr); } catch (_) { }
  }
}

function notifyError(message, err) {
  const fallback = 'Something went wrong. Try again or restart in Safe Mode if it keeps happening.';
  logError(message || 'error', err);
  try {
    if (typeof toast === 'function') {
      toast(message || fallback, { variant: 'error' });
    }
  } catch (toastErr) {
    logError('toast error', toastErr);
  }
}

export { logError, notifyError };
export default logError;
