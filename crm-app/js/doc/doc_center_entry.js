(function(){
  if (window.__DOC_CENTER_ENTRY__) return;
  window.__DOC_CENTER_ENTRY__ = true;

  const HOST_SELECTOR = '[data-doc-center], #doc-center, #settings-docs, .doc-center, [data-panel="doc-center"]';

  function findHost(){
    if (typeof document === 'undefined') return null;
    return document.querySelector(HOST_SELECTOR);
  }

  function requestEnhancer(){
    if (window.__DOC_CENTER_ENHANCER_PROMISE__) return window.__DOC_CENTER_ENHANCER_PROMISE__;
    const promise = import('./doc_center_enhancer.js').catch(() => {});
    window.__DOC_CENTER_ENHANCER_PROMISE__ = promise;
    return promise;
  }

  async function openDocumentCenter(opts){
    const options = opts && typeof opts === 'object' ? opts : {};
    const contextType = options.contextType || (findHost() ? 'dashboard' : 'contact');
    if (options.navigate) {
      try { history.replaceState(null, '', '#doc-center'); } catch (_) {}
    }
    if (contextType === 'dashboard' || contextType === 'settings') {
      if (findHost()) requestEnhancer();
    }
    if (contextType === 'contact' && typeof window.DocCenter?.renderDocs === 'function') {
      return window.DocCenter.renderDocs();
    }
    return { contextType };
  }

  window.DocCenter = window.DocCenter || {};
  window.DocCenter.openDocumentCenter = openDocumentCenter;
  window.DocCenter.ensureEnhancer = requestEnhancer;
})();

export { openDocumentCenter };
