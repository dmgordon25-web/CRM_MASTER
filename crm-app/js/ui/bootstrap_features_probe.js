const STORAGE_KEY = 'user:avatar:dataurl';
const MAX_FILE_BYTES = 6 * 1024 * 1024;
const MAX_DATA_URL_CHARS = 4 * 1024 * 1024;

function safeWarn(message, detail) {
  try {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      if (detail !== undefined) {
        console.warn(message, detail);
      } else {
        console.warn(message);
      }
    }
  } catch (_) {}
}

function scheduleClear(target) {
  if (!target) return;
  try {
    setTimeout(() => {
      try {
        target.value = '';
      } catch (_) {}
    }, 0);
  } catch (_) {
    try {
      target.value = '';
    } catch (err) {
      safeWarn('[soft] avatar input reset failed', err && (err.message || err));
    }
  }
}

function ensureSingleAvatarInput(panel, doc) {
  const existingList = Array.from(panel.querySelectorAll('input[type="file"][accept="image/*"]'));
  let primary = existingList[0] || null;
  if (existingList.length > 1) {
    existingList.slice(1).forEach((node) => {
      try { node.remove(); }
      catch (_) {}
    });
  }
  if (!primary) {
    const preexisting = doc.getElementById('lo-photo');
    if (preexisting instanceof HTMLInputElement) {
      primary = preexisting;
    }
  }
  if (!primary) {
    primary = doc.createElement('input');
    primary.id = 'lo-photo';
  }
  primary.type = 'file';
  primary.setAttribute('accept', 'image/*');
  if (!panel.contains(primary)) {
    const host = panel.querySelector('label:last-of-type') || panel;
    host.appendChild(primary);
  }
  primary.removeAttribute('hidden');
  primary.style.display = '';
  const label = primary.closest('label');
  if (label instanceof HTMLElement) {
    label.removeAttribute('hidden');
    label.style.display = '';
  }
  return primary;
}

export function wireAvatarBridge() {
  const win = typeof window !== 'undefined' ? window : null;
  const doc = typeof document !== 'undefined' ? document : null;
  if (!win || !doc) return null;

  const panel = doc.getElementById('lo-profile-settings');
  if (!panel) return null;

  const input = ensureSingleAvatarInput(panel, doc);
  if (!input) return null;

  if (input.__avatarBridgeWired) {
    return input;
  }

  const readAndStoreFile = (file, target) => {
    const validFile = file && (typeof File === 'undefined' || file instanceof File);
    if (!validFile) {
      scheduleClear(target);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      safeWarn('[soft] avatar file too large');
      scheduleClear(target);
      return;
    }
    if (typeof FileReader === 'undefined') {
      safeWarn('[soft] FileReader unavailable for avatar');
      scheduleClear(target);
      return;
    }
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        scheduleClear(target);
        return;
      }
      if (result.length > MAX_DATA_URL_CHARS) {
        safeWarn('[soft] avatar data URL too large to persist');
        scheduleClear(target);
        return;
      }
      let stored = false;
      try {
        if (win.localStorage) {
          win.localStorage.setItem(STORAGE_KEY, result);
          stored = true;
        }
      } catch (err) {
        safeWarn('[soft] avatar localStorage write failed', err && (err.message || err));
      }
      try {
        win.dispatchEvent(new CustomEvent('avatar:updated', { detail: { dataUrl: result, stored } }));
      } catch (err) {
        safeWarn('[soft] avatar update dispatch failed', err && (err.message || err));
      }
      try {
        if (typeof console !== 'undefined' && typeof console.info === 'function') {
          console.info('[VIS] avatar stored & event fired');
        }
      } catch (_) {}
      scheduleClear(target);
    });
    reader.addEventListener('error', () => {
      safeWarn('[soft] avatar read failed');
      scheduleClear(target);
    });
    try {
      reader.readAsDataURL(file);
    } catch (err) {
      safeWarn('[soft] avatar readAsDataURL failed', err && (err.message || err));
      scheduleClear(target);
    }
  };

  const handleChange = (event) => {
    const target = event && event.target instanceof HTMLInputElement ? event.target : input;
    const file = target && target.files ? target.files[0] : null;
    readAndStoreFile(file, target);
  };

  input.addEventListener('change', handleChange);
  input.__avatarBridgeWired = true;

  const clearBtn = doc.getElementById('btn-lo-photo-clear');
  if (clearBtn && !clearBtn.__avatarBridgeWired) {
    clearBtn.addEventListener('click', () => {
      let stored = false;
      try {
        if (win.localStorage) {
          win.localStorage.setItem(STORAGE_KEY, '');
          stored = true;
        }
      } catch (err) {
        safeWarn('[soft] avatar clear failed', err && (err.message || err));
      }
      try {
        win.dispatchEvent(new CustomEvent('avatar:updated', { detail: { dataUrl: '', stored } }));
      } catch (err) {
        safeWarn('[soft] avatar clear dispatch failed', err && (err.message || err));
      }
      try {
        if (typeof console !== 'undefined' && typeof console.info === 'function') {
          console.info('[VIS] avatar stored & event fired');
        }
      } catch (_) {}
    });
    clearBtn.__avatarBridgeWired = true;
  }

  return input;
}
