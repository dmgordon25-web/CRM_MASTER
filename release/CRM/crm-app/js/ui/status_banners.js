import { createInlineLoader } from '../../components/Loaders/InlineLoader.js';

const NOOP_MANAGER = {
  clear(){},
  showLoading(){},
  showEmpty(){},
  showError(){},
};

function ensureHost(node){
  if(!node || typeof node !== 'object') return null;
  if(node.nodeType !== 1) return null;
  return node;
}

function assignMessage(node, message){
  if(!node) return;
  node.textContent = message == null ? '' : String(message);
}

export function attachStatusBanner(host, options = {}){
  const root = ensureHost(host);
  if(!root){
    return NOOP_MANAGER;
  }

  const { tone = 'muted' } = options;
  let cleanup = null;

  const reset = () => {
    if(cleanup){
      try{ cleanup(); }
      catch(_err){}
      cleanup = null;
    }
    while(root.firstChild){
      root.removeChild(root.firstChild);
    }
    if(root.classList){
      root.classList.remove('is-error');
      root.classList.remove('is-loading');
      root.classList.remove('is-empty');
      if(tone){
        root.classList.add(tone);
      }
    }
  };

  const render = (node, nextCleanup = null) => {
    reset();
    if(node){
      root.appendChild(node);
      cleanup = nextCleanup;
    }
  };

  const manager = {
    clear(){
      reset();
      if(root.classList){
        root.classList.remove('is-error', 'is-loading', 'is-empty');
      }
    },
    showLoading(message = 'Loading…'){
      const doc = root.ownerDocument || document;
      const banner = doc.createElement('div');
      banner.dataset.qa = 'loading';
      banner.className = 'status-banner status-banner-loading';
      const loader = createInlineLoader({ document: doc, message, size: 'sm' });
      if(loader){
        loader.classList.add('status-banner-loader');
        banner.appendChild(loader);
      }else{
        assignMessage(banner, message);
      }
      if(root.classList){
        root.classList.add('is-loading');
      }
      render(banner);
    },
    showEmpty(message = 'Nothing to display yet.'){
      const banner = root.ownerDocument ? root.ownerDocument.createElement('div') : document.createElement('div');
      banner.dataset.qa = 'empty-state';
      banner.className = 'status-banner status-banner-empty';
      assignMessage(banner, message);
      if(root.classList){
        root.classList.add('is-empty');
      }
      render(banner);
    },
    showError(message = 'Something went wrong.', { onRetry, retryLabel = 'Retry' } = {}){
      const doc = root.ownerDocument || document;
      const banner = doc.createElement('div');
      banner.dataset.qa = 'error-banner';
      banner.className = 'status-banner status-banner-error';
      const text = doc.createElement('span');
      text.className = 'status-banner-text';
      assignMessage(text, message);
      banner.appendChild(text);
      let retryCleanup = null;
      if(typeof onRetry === 'function'){
        const retry = doc.createElement('button');
        retry.type = 'button';
        retry.className = 'btn ghost';
        retry.textContent = retryLabel;
        retry.dataset.qa = 'retry-action';
        const handler = (event) => {
          try{ onRetry(event); }
          catch(_err){}
        };
        retry.addEventListener('click', handler);
        retryCleanup = () => {
          retry.removeEventListener('click', handler);
        };
        banner.appendChild(retry);
      }
      if(root.classList){
        root.classList.add('is-error');
      }
      render(banner, retryCleanup);
    }
  };

  manager.clear();
  return manager;
}
