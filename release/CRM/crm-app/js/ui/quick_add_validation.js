const FORCE_INSERT_AFTER = 'afterend';

function isTruthy(value){
  return value !== false && value !== null && value !== undefined && value !== '';
}

function ensureState(form){
  let state = form.__quickAddValidationState;
  if(state) return state;
  state = {
    touched: new Set(),
    nodes: new Map(),
    fields: new Set(),
    showAll: false,
    listeners: []
  };
  form.__quickAddValidationState = state;
  return state;
}

function clearNodes(state){
  if(!state) return;
  for(const node of state.nodes.values()){
    if(node && node.parentElement){
      node.parentElement.removeChild(node);
    }
  }
  state.nodes.clear();
  for(const field of state.fields){
    if(field){
      field.classList.remove('field-error');
      field.removeAttribute('aria-invalid');
    }
  }
  state.fields = new Set();
}

function findField(form, name){
  if(!form || !name) return null;
  try {
    return form.querySelector(`[name="${name}"]`);
  } catch (_err) {
    return null;
  }
}

function applyErrors(form, config, errors, state, force){
  const showAll = force || state.showAll;
  state.showAll = showAll;
  const touched = state.touched;
  const nodes = state.nodes;
  const activeFields = new Set();
  let firstInvalid = null;

  const keys = Object.keys(config || {});
  for(const key of keys){
    const entry = config[key] || {};
    const selectors = Array.isArray(entry.fields) ? entry.fields : [];
    const raw = errors && Object.prototype.hasOwnProperty.call(errors, key)
      ? errors[key]
      : null;
    const hasError = isTruthy(raw);
    const shouldReveal = hasError && (showAll || selectors.some((name) => touched.has(name)));
    const message = shouldReveal
      ? (typeof entry.message === 'function' ? entry.message(raw, key) : entry.message)
      : '';

    let primaryField = null;
    selectors.forEach((name, index) => {
      const field = findField(form, name);
      if(!field) return;
      if(index === 0) primaryField = field;
      if(message){
        activeFields.add(field);
      }
    });

    let node = nodes.get(key);
    if(message && primaryField){
      if(!node || !node.isConnected){
        node = document.createElement('div');
        node.className = 'field-error';
        nodes.set(key, node);
        primaryField.insertAdjacentElement(FORCE_INSERT_AFTER, node);
      }
      node.textContent = String(message);
      if(!firstInvalid){
        firstInvalid = primaryField;
      }
    }else if(node){
      node.remove();
      nodes.delete(key);
    }
  }

  for(const [key, node] of nodes.entries()){
    if(!config[key]){
      if(node && node.parentElement){
        node.parentElement.removeChild(node);
      }
      nodes.delete(key);
    }
  }

  for(const field of state.fields){
    if(!activeFields.has(field)){
      field.classList.remove('field-error');
      field.removeAttribute('aria-invalid');
    }
  }
  for(const field of activeFields){
    field.classList.add('field-error');
    field.setAttribute('aria-invalid', 'true');
  }
  state.fields = activeFields;

  return { firstInvalid };
}

export function bindQuickAddValidation(form, config, options = {}){
  if(!form || typeof form.addEventListener !== 'function'){
    return null;
  }
  const state = ensureState(form);
  const buildModel = typeof options.buildModel === 'function'
    ? options.buildModel
    : (() => ({}));
  const validate = typeof options.validate === 'function'
    ? options.validate
    : (() => ({ ok: true, errors: {} }));
  const onResult = typeof options.onResult === 'function'
    ? options.onResult
    : null;

  function run(force = false){
    const model = buildModel(form) || {};
    const validation = validate(model) || {};
    const resultErrors = validation.errors && typeof validation.errors === 'object'
      ? { ...validation.errors }
      : {};
    const hasErrors = Object.keys(resultErrors).some((key) => isTruthy(resultErrors[key]));
    const mergedOk = validation.ok === false ? false : !hasErrors;
    const { firstInvalid } = applyErrors(form, config, resultErrors, state, force);
    const outcome = {
      ok: mergedOk,
      model,
      errors: resultErrors,
      firstInvalid
    };
    if(onResult){
      try {
        onResult(outcome, { force });
      } catch (_err) {}
    }
    return outcome;
  }

  function reset(){
    state.touched.clear();
    state.showAll = false;
    clearNodes(state);
    run(false);
  }

  const handleInput = (event) => {
    const target = event?.target;
    if(!target || typeof target.getAttribute !== 'function'){
      run(false);
      return;
    }
    const name = target.getAttribute('name');
    if(name){
      state.touched.add(name);
    }
    run(false);
  };

  form.addEventListener('input', handleInput);
  form.addEventListener('change', handleInput);
  state.listeners.push(['input', handleInput]);
  state.listeners.push(['change', handleInput]);

  run(false);

  return {
    run,
    reset,
    markTouched(name){
      if(name){
        state.touched.add(name);
      }
    },
    destroy(){
      if(state.listeners){
        for(const [type, listener] of state.listeners){
          try {
            form.removeEventListener(type, listener);
          } catch (_err) {}
        }
        state.listeners.length = 0;
      }
      clearNodes(state);
    }
  };
}

