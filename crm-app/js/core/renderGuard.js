(function (global) {
  if (!global) return;

  const bridgeKey = '__appDataChangedWindowBridge__';
  const legacyBridgeKey = '__AD_BRIDGE__';
  if (!global[bridgeKey] && global[legacyBridgeKey]) {
    global[bridgeKey] = global[legacyBridgeKey];
    return;
  }
  if (!global[bridgeKey] && typeof global.addEventListener === 'function') {
    const reemit = function (event) {
      const doc = global.document || null;
      if (!event || !doc || event.target === doc) return;
      if (typeof global.dispatchAppDataChanged === 'function') {
        global.dispatchAppDataChanged(event.detail);
      } else if (doc && typeof doc.dispatchEvent === 'function') {
        doc.dispatchEvent(new CustomEvent('app:data:changed', { detail: event && event.detail }));
      }
    };
    global.addEventListener('app:data:changed', reemit, true);
    global[bridgeKey] = {
      handler: reemit,
      remove() {
        try { global.removeEventListener('app:data:changed', reemit, true); }
        catch (_err) { }
      }
    };
    if (!global[legacyBridgeKey]) global[legacyBridgeKey] = true;
  } else if (global[bridgeKey] && !global[legacyBridgeKey]) {
    global[legacyBridgeKey] = true;
  }

  const isDebug = Boolean(global.__ENV__ && global.__ENV__.DEBUG === true);
  const subscribers = new Set();
  const afterRender = new Set();
  let scheduled = false;
  let depth = 0;

  function enter() {
    depth += 1;
    global.__RENDERING__ = depth > 0;
  }

  function exit() {
    if (depth > 0) depth -= 1;
    global.__RENDERING__ = depth > 0;
  }

  function isRendering() {
    return depth > 0;
  }

  function safeCall(fn) {
    if (typeof fn !== 'function') return null;
    try {
      const result = fn();
      if (result && typeof result.then === 'function') {
        return result.catch(err => {
          if (isDebug && typeof console !== 'undefined' && console.warn) {
            console.warn('[renderGuard] subscriber rejected', err);
          }
        });
      }
      return null;
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[soft] [renderGuard] subscriber failed', err);
      }
      return null;
    }
  }

  function runAfterRender() {
    afterRender.forEach(fn => {
      try { fn(); }
      catch (err) {
        if (isDebug && typeof console !== 'undefined' && console.warn) {
          console.warn('[renderGuard] after-render hook failed', err);
        }
      }
    });
  }

  function flush() {
    scheduled = false;
    enter();
    const pending = [];
    subscribers.forEach(fn => {
      const maybe = safeCall(fn);
      if (maybe) pending.push(maybe);
    });
    const finalize = () => {
      runAfterRender();
      exit();
    };
    if (pending.length) {
      // Enforce 500ms hard timeout on all render subscribers
      const timedPending = pending.map(p => {
        const timeout = new Promise(resolve => setTimeout(() => resolve('timeout'), 500));
        return Promise.race([p, timeout]);
      });
      Promise.allSettled(timedPending).finally(finalize);
    } else {
      finalize();
    }
  }

  function requestRender() {
    if (scheduled) return;
    scheduled = true;
    const raf = typeof global.requestAnimationFrame === 'function'
      ? global.requestAnimationFrame.bind(global)
      : (cb) => setTimeout(cb, 16);
    raf(() => {
      flush();
    });
  }

  function subscribeRender(fn) {
    if (typeof fn === 'function') subscribers.add(fn);
  }

  function unsubscribeRender(fn) {
    if (typeof fn === 'function') subscribers.delete(fn);
  }

  function registerHook(fn) {
    if (typeof fn === 'function') afterRender.add(fn);
  }

  function unregisterHook(fn) {
    afterRender.delete(fn);
  }

  function reset() {
    subscribers.clear();
    afterRender.clear();
    scheduled = false;
    depth = 0;
    global.__RENDERING__ = false;
  }

  const api = {
    subscribeRender,
    unsubscribeRender,
    requestRender,
    registerHook,
    unregisterHook,
    enter,
    exit,
    isRendering,
    __reset: reset,
    __getSubscriberCount() { return subscribers.size; },
    __getHookCount() { return afterRender.size; }
  };

  const existing = global.RenderGuard && typeof global.RenderGuard === 'object'
    ? global.RenderGuard
    : {};
  const merged = Object.assign({}, existing, api);
  Object.defineProperty(global, 'RenderGuard', {
    value: merged,
    configurable: true,
    enumerable: false,
    writable: true
  });

  if (typeof global.registerRenderHook !== 'function') {
    global.registerRenderHook = registerHook;
  }

  function normalizeDataChangedDetail(detail) {
    if (detail && typeof detail === 'object') return detail;
    if (typeof detail === 'string') return { scope: '', reason: detail };
    return { scope: '' };
  }

  if (typeof global.dispatchAppDataChanged !== 'function') {
    // STABILITY FIX: Coalesce rapid updates to prevent render storms
    let updateQueue = [];
    let updateTimer = null;
    const DEBOUNCE_MS = 50;

    global.dispatchAppDataChanged = function (detail) {
      const payload = normalizeDataChangedDetail(detail);

      // If we are currently locked in a render loop, do NOT synchronously dispatch.
      // Instead, queue it up.
      if (isRendering()) {
        updateQueue.push(payload);
        scheduleDispatch();
        return;
      }

      // If we are not rendering, still debounce slightly to catch bursts
      updateQueue.push(payload);
      scheduleDispatch();
    };

    function scheduleDispatch() {
      if (updateTimer) return;
      updateTimer = setTimeout(flushDispatch, DEBOUNCE_MS);
    }

    function flushDispatch() {
      updateTimer = null;
      if (!updateQueue.length) return;

      // Collapse metrics
      const count = updateQueue.length;
      const last = updateQueue[updateQueue.length - 1];

      // CRITICAL FIX: Scan for destructive events that must not be swallowed by subsequent updates
      const destructiveEvent = updateQueue.find(d =>
        d.source === 'soft-delete' ||
        d.source === 'actionbar:delete' ||
        d.action === 'soft-delete'
      );

      const baseDetail = destructiveEvent ? destructiveEvent : last;
      const bucketLastSource = last.source || ''; // Metrics still track the literal last one

      updateQueue = [];

      const meter = global.__METER__ = global.__METER__ || {};
      const bucket = meter.dataChanged = meter.dataChanged || { count: 0, lastSource: '' };
      bucket.count += count;
      bucket.lastSource = bucketLastSource;

      // Dispatch ONE coalesced event (using prioritized details)
      const eventDetail = Object.assign({}, baseDetail, {
        batchSize: count,
        reason: baseDetail.reason || (count > 1 ? 'coalesced-update' : undefined)
      });
      if (!eventDetail.scope) eventDetail.scope = '';

      const doc = global.document;
      if (doc && typeof doc.dispatchEvent === 'function') {
        doc.dispatchEvent(new CustomEvent('app:data:changed', { detail: eventDetail }));
        return;
      }
      if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
        global.dispatchEvent(new global.CustomEvent('app:data:changed', { detail: eventDetail }));
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = merged;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
