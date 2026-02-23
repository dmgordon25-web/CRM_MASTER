const DEFAULT_MESSAGE = 'Loading…';

function resolveDocument(doc){
  if(doc && typeof doc.createElement === 'function') return doc;
  if(typeof document !== 'undefined' && document) return document;
  return null;
}

function normalizeSize(size){
  const token = typeof size === 'string' ? size.trim().toLowerCase() : '';
  if(token === 'sm' || token === 'small') return 'sm';
  if(token === 'lg' || token === 'large') return 'lg';
  return 'md';
}

export function createInlineLoader(options = {}){
  const doc = resolveDocument(options.document);
  if(!doc) return null;
  const { message = DEFAULT_MESSAGE, inline = true, announce = true } = options;
  const size = normalizeSize(options.size);
  const host = doc.createElement(inline === false ? 'div' : 'span');
  const classes = ['ui-inline-loader'];
  if(inline === false) classes.push('ui-inline-loader--block');
  if(size !== 'md') classes.push(`ui-inline-loader--${size}`);
  host.className = classes.join(' ');
  if(announce){
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
  }
  const spinnerWrap = doc.createElement('span');
  spinnerWrap.className = 'ui-inline-loader__spinner';
  const spinner = doc.createElement('span');
  spinner.className = 'ui-spinner';
  spinner.setAttribute('aria-hidden', 'true');
  spinnerWrap.appendChild(spinner);
  const label = doc.createElement('span');
  label.className = 'ui-inline-loader__label';
  label.textContent = message == null ? DEFAULT_MESSAGE : String(message);
  host.appendChild(spinnerWrap);
  host.appendChild(label);
  if(announce === false){
    host.setAttribute('aria-hidden', 'true');
    host.removeAttribute('role');
    host.removeAttribute('aria-live');
  }
  const setMessage = (value) => {
    const next = value == null ? DEFAULT_MESSAGE : String(value);
    label.textContent = next;
  };
  Object.defineProperty(host, '__setMessage', {
    value: setMessage,
    configurable: false,
    enumerable: false,
    writable: false,
  });
  Object.defineProperty(host, '__getLabel', {
    value: () => label,
    configurable: false,
    enumerable: false,
    writable: false,
  });
  return host;
}

export default createInlineLoader;
