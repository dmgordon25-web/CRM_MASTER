(function(){
  if(typeof window === 'undefined') return;
  if(window.Toast && typeof window.Toast.show === 'function') return;

  const DEFAULT_DURATION = 2600;
  const COALESCE_WINDOW = 500;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const VARIANT_ALIASES = new Map([
    ['success', 'success'],
    ['ok', 'success'],
    ['info', 'info'],
    ['warn', 'warn'],
    ['warning', 'warn'],
    ['error', 'error'],
    ['danger', 'error'],
    ['loading', 'loading'],
    ['default', 'default']
  ]);

  const VARIANTS = Object.freeze({
    default: { icon: 'info' },
    success: { icon: 'check' },
    info: { icon: 'info' },
    warn: { icon: 'warn' },
    error: { icon: 'error' },
    loading: { icon: 'spinner' }
  });

  const ICON_PATHS = Object.freeze({
    check: 'M9 12.75L11.25 15L15 9.75M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z',
    info: 'M11.25 11.25L11.2915 11.2293C11.8646 10.9427 12.5099 11.4603 12.3545 12.082L11.6455 14.918C11.4901 15.5397 12.1354 16.0573 12.7085 15.7707L12.75 15.75M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12ZM12 8.25H12.0075V8.2575H12V8.25Z',
    warn: 'M11.9998 9.00006V12.7501M2.69653 16.1257C1.83114 17.6257 2.91371 19.5001 4.64544 19.5001H19.3541C21.0858 19.5001 22.1684 17.6257 21.303 16.1257L13.9487 3.37819C13.0828 1.87736 10.9167 1.87736 10.0509 3.37819L2.69653 16.1257ZM11.9998 15.7501H12.0073V15.7576H11.9998V15.7501Z',
    error: 'M9.75 9.75L14.25 14.25M14.25 9.75L9.75 14.25M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z'
  });

  const ICON_CACHE = new Map();

  function normalizeOptions(options){
    if(!options) return {};
    if(typeof options === 'string') return { variant: options };
    if(typeof options === 'object') return Object.assign({}, options);
    return {};
  }

  function resolveVariant(options, fallback){
    const opts = normalizeOptions(options);
    const raw = opts.variant || opts.tone || opts.status || opts.kind;
    const key = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if(key && VARIANT_ALIASES.has(key)) return VARIANT_ALIASES.get(key);
    if(opts.loading === true) return 'loading';
    return fallback;
  }

  function createIconSvg(key, path){
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.dataset.iconKey = key;
    const segment = document.createElementNS(SVG_NS, 'path');
    segment.setAttribute('d', path);
    segment.setAttribute('fill', 'none');
    segment.setAttribute('stroke', 'currentColor');
    segment.setAttribute('stroke-width', '1.5');
    segment.setAttribute('stroke-linecap', 'round');
    segment.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(segment);
    return svg;
  }

  function getToastIcon(key){
    if(key === 'spinner'){
      const spinner = document.createElement('span');
      spinner.className = 'ui-spinner';
      spinner.setAttribute('aria-hidden', 'true');
      return spinner;
    }
    const pathKey = ICON_PATHS[key] ? key : 'info';
    if(!ICON_CACHE.has(pathKey)){
      ICON_CACHE.set(pathKey, createIconSvg(pathKey, ICON_PATHS[pathKey]));
    }
    const base = ICON_CACHE.get(pathKey);
    return base ? base.cloneNode(true) : null;
  }

  function createHost(){
    const doc = window.document;
    if(!doc || !doc.createElement) return null;
    const host = doc.createElement('div');
    host.className = 'toast-host';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    host.dataset.toastHost = 'true';
    host.hidden = true;
    const body = doc.body;
    if(body && typeof body.appendChild === 'function'){
      body.appendChild(host);
    }
    return host;
  }

  function ToastController(){
    this.host = null;
    this.hideTimer = null;
    this.lastMessage = '';
    this.lastVariant = 'default';
    this.lastShownAt = 0;
    this.currentAction = null;
  }

  ToastController.prototype.ensureHost = function ensureHost(){
    const doc = window.document;
    if(!doc) return null;
    if(this.host && doc.body && typeof doc.body.contains === 'function' && doc.body.contains(this.host)){
      return this.host;
    }
    this.host = createHost();
    return this.host;
  };

  ToastController.prototype.show = function show(message, options){
    const opts = normalizeOptions(options);
    const variant = resolveVariant(opts, 'default');
    const config = VARIANTS[variant] || VARIANTS.default;
    const text = String(message == null ? '' : message).trim() || (variant === 'error' ? 'Something went wrong' : 'Saved');
    const action = opts && opts.action;
    const hasAction = action && typeof action === 'object' && typeof action.onClick === 'function';
    const now = Date.now();
    if(!hasAction && variant !== 'loading' && text === this.lastMessage && variant === this.lastVariant && now - this.lastShownAt <= COALESCE_WINDOW){
      return;
    }
    this.lastMessage = text;
    this.lastVariant = variant;
    this.lastShownAt = now;

    const host = this.ensureHost();
    if(!host) return;

    while(host.firstChild) host.firstChild.remove();
    host.hidden = false;
    host.dataset.variant = variant;
    host.setAttribute('data-variant', variant);
    host.dataset.visible = 'true';
    host.setAttribute('data-visible', 'true');
    if(hasAction){
      host.dataset.hasAction = 'true';
      host.setAttribute('data-has-action', 'true');
    }else{
      delete host.dataset.hasAction;
      if(typeof host.removeAttribute === 'function') host.removeAttribute('data-has-action');
      else host.setAttribute('data-has-action', 'false');
    }
    host.setAttribute('aria-live', variant === 'error' || variant === 'warn' ? 'assertive' : 'polite');
    host.setAttribute('aria-busy', variant === 'loading' ? 'true' : 'false');

    const iconWrap = document.createElement('span');
    iconWrap.className = 'toast-icon';
    const iconNode = getToastIcon(config.icon);
    if(iconNode) iconWrap.appendChild(iconNode);
    host.appendChild(iconWrap);

    const label = document.createElement('span');
    label.className = 'toast-message';
    label.textContent = text;
    host.appendChild(label);

    this.currentAction = null;
    if(hasAction){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = String(action.label || 'Undo');
      btn.addEventListener('click', evt => {
        evt.preventDefault();
        evt.stopPropagation();
        this.hide();
        try{ action.onClick(); }
        catch (err) { console && console.warn && console.warn('toast action', err); }
      }, { once: true });
      host.appendChild(btn);
      this.currentAction = action.onClick;
    }

    if(this.hideTimer){
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    const rawDuration = Number(opts.duration);
    const duration = variant === 'loading'
      ? (Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 0)
      : (Number.isFinite(rawDuration) && rawDuration >= 0 ? rawDuration : DEFAULT_DURATION);
    if(duration > 0){
      const controller = this;
      this.hideTimer = setTimeout(function(){ controller.hide(); }, duration);
    }

    try {
      window.__LAST_TOAST__ = String(message || '');
      window.dispatchEvent(new CustomEvent('ui:toast', { detail: { msg: window.__LAST_TOAST__ } }));
    } catch {}
  };

  ToastController.prototype.hide = function hide(){
    if(this.hideTimer){
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    const host = this.host;
    if(!host) return;
    host.removeAttribute('data-has-action');
    delete host.dataset.hasAction;
    host.removeAttribute('data-visible');
    delete host.dataset.visible;
    host.removeAttribute('data-variant');
    delete host.dataset.variant;
    host.setAttribute('aria-busy', 'false');
    const finalize = () => {
      host.hidden = true;
      host.innerHTML = '';
    };
    if(typeof host.addEventListener === 'function'){
      const onTransitionEnd = () => {
        host.removeEventListener('transitionend', onTransitionEnd);
        finalize();
      };
      host.addEventListener('transitionend', onTransitionEnd, { once: true });
      setTimeout(() => {
        host.removeEventListener('transitionend', onTransitionEnd);
        finalize();
      }, 200);
    }else{
      finalize();
    }
  };

  const controller = new ToastController();

  function withVariant(options, variant){
    const opts = normalizeOptions(options);
    opts.variant = variant;
    return opts;
  }

  const api = {
    show: controller.show.bind(controller),
    hide: controller.hide.bind(controller),
    success(message, options){
      controller.show(message, withVariant(options, 'success'));
    },
    info(message, options){
      controller.show(message, withVariant(options, 'info'));
    },
    warn(message, options){
      controller.show(message, withVariant(options, 'warn'));
    },
    error(message, options){
      controller.show(message, withVariant(options, 'error'));
    },
    loading(message, options){
      const opts = withVariant(options, 'loading');
      if(!Object.prototype.hasOwnProperty.call(opts, 'duration')) opts.duration = 0;
      controller.show(message, opts);
      return () => controller.hide();
    }
  };

  window.Toast = api;
  window.toast = function(message, options){
    if(message && typeof message === 'object' && !Array.isArray(message)){
      const payload = Object.assign({}, message);
      const text = 'message' in payload ? payload.message : '';
      delete payload.message;
      api.show(text, payload);
      return;
    }
    api.show(message, normalizeOptions(options));
  };
})();
