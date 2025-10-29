import { createInlineLoader } from '../../components/Loaders/InlineLoader.js';

const DEFAULT_LINE_WIDTHS = [82, 64, 78, 58, 72];
const DEFAULT_ROWS = 6;

function resolveNode(target){
  if(!target) return null;
  if(target instanceof Element) return target;
  if(typeof target === 'string'){ return document.querySelector(target); }
  return null;
}

function applyLineWidths(block, lines, widths){
  if(!Number.isFinite(lines) || lines <= 0) return;
  for(let index = 0; index < lines; index += 1){
    const line = document.createElement('div');
    line.className = 'loading-line';
    const widthHint = widths && widths[index % widths.length];
    if(typeof widthHint === 'number'){
      line.style.setProperty('--loading-line-width', `${Math.max(12, widthHint)}%`);
    }else if(typeof widthHint === 'string' && widthHint.trim()){
      line.style.setProperty('--loading-line-width', widthHint.trim());
    }else{
      const fallback = DEFAULT_LINE_WIDTHS[index % DEFAULT_LINE_WIDTHS.length];
      line.style.setProperty('--loading-line-width', `${fallback}%`);
    }
    block.appendChild(line);
  }
}

export function attachLoadingBlock(target, options = {}){
  if(typeof document === 'undefined') return null;
  const node = resolveNode(target);
  if(!node) return null;
  const prevState = node.__loadingBlock;
  const doc = node.ownerDocument || document;
  const hasReserveOption = Object.prototype.hasOwnProperty.call(options, 'reserve');
  const hasMinHeightOption = Object.prototype.hasOwnProperty.call(options, 'minHeight');
  const messageProvided = Object.prototype.hasOwnProperty.call(options, 'message');

  if(prevState && prevState.block){
    prevState.count = (prevState.count || 1) + 1;
    if(messageProvided && typeof prevState.setMessage === 'function'){
      prevState.setMessage(options.message);
    }
    if(hasReserveOption){
      applyReserveOption(node, prevState, options.reserve);
    }
    if(hasMinHeightOption){
      applyMinHeightOption(node, prevState, options.minHeight);
    }
    node.classList.add('loading-host', 'is-loading');
    node.setAttribute('aria-busy', 'true');
    return prevState.block;
  }

  const block = doc.createElement('div');
  block.className = 'loading-block';
  block.setAttribute('aria-hidden', 'true');

  const loader = createInlineLoader({
    message: messageProvided ? options.message : undefined,
    size: options.size || 'md',
    announce: false,
  });
  if(loader){
    loader.classList.add('loading-block__loader');
    block.appendChild(loader);
  }

  const lines = Number.isFinite(options.lines)
    ? Math.max(0, Math.floor(options.lines))
    : DEFAULT_LINE_WIDTHS.length;
  const widths = Array.isArray(options.widths) ? options.widths : null;
  applyLineWidths(block, lines, widths);

  node.classList.add('loading-host', 'is-loading');
  node.setAttribute('aria-busy', 'true');
  node.insertBefore(block, node.firstChild || null);

  const dataset = node && node.dataset ? node.dataset : null;
  const hadReserve = dataset ? Object.prototype.hasOwnProperty.call(dataset, 'loadingReserve') : false;
  const previousReserve = hadReserve ? dataset.loadingReserve : null;
  const style = node && node.style ? node.style : null;
  const previousMinHeight = style ? style.getPropertyValue('--loading-block-min-height') : '';

  const state = {
    block,
    count: 1,
    loader,
    setMessage: loader && typeof loader.__setMessage === 'function' ? loader.__setMessage : null,
    hadReserve,
    previousReserve,
    activeReserve: '',
    hadMinHeight: Boolean(previousMinHeight && previousMinHeight.trim()),
    previousMinHeight,
    activeMinHeight: '',
  };

  if(hasReserveOption){
    applyReserveOption(node, state, options.reserve);
  }
  if(hasMinHeightOption){
    applyMinHeightOption(node, state, options.minHeight);
  }

  node.__loadingBlock = state;
  return block;
}

export function detachLoadingBlock(target){
  if(typeof document === 'undefined') return;
  const node = resolveNode(target);
  if(!node) return;
  node.classList.remove('is-loading');
  const state = node.__loadingBlock;
  if(!state) return;
  const nextCount = Math.max(0, (state.count || 1) - 1);
  state.count = nextCount;
  if(nextCount > 0){
    return;
  }
  if(state.block && state.block.parentNode === node){
    node.removeChild(state.block);
  }
  const dataset = node && node.dataset ? node.dataset : null;
  if(dataset){
    if(state.hadReserve){
      if(state.previousReserve != null && String(state.previousReserve).trim()){
        dataset.loadingReserve = state.previousReserve;
      }else{
        delete dataset.loadingReserve;
      }
    }else{
      delete dataset.loadingReserve;
    }
  }
  const style = node && node.style ? node.style : null;
  if(style){
    if(state.hadMinHeight && state.previousMinHeight && state.previousMinHeight.trim()){
      style.setProperty('--loading-block-min-height', state.previousMinHeight);
    }else{
      style.removeProperty('--loading-block-min-height');
    }
  }
  delete node.__loadingBlock;
  node.removeAttribute('aria-busy');
  if(node.classList.contains('loading-host') && !node.querySelector(':scope > .loading-block')){
    node.classList.remove('loading-host');
  }
}

function applyReserveOption(node, state, reserve){
  if(!state || !node) return;
  const dataset = node && node.dataset ? node.dataset : null;
  if(!dataset) return;
  if(reserve && typeof reserve === 'string'){
    dataset.loadingReserve = reserve;
    state.activeReserve = reserve;
  }else{
    if(state.hadReserve){
      if(state.previousReserve != null && String(state.previousReserve).trim()){
        dataset.loadingReserve = state.previousReserve;
      }else{
        delete dataset.loadingReserve;
      }
    }else{
      delete dataset.loadingReserve;
    }
    state.activeReserve = '';
  }
}

function applyMinHeightOption(node, state, minHeight){
  if(!state || !node || !node.style) return;
  if(minHeight == null){
    if(state.hadMinHeight && state.previousMinHeight && state.previousMinHeight.trim()){
      node.style.setProperty('--loading-block-min-height', state.previousMinHeight);
    }else{
      node.style.removeProperty('--loading-block-min-height');
    }
    state.activeMinHeight = '';
    return;
  }
  const value = typeof minHeight === 'number' ? `${minHeight}px` : String(minHeight);
  node.style.setProperty('--loading-block-min-height', value);
  state.activeMinHeight = value;
}

function pickColumnWidths(count){
  const widths = [];
  for(let idx = 0; idx < count; idx += 1){
    if(idx === 0){
      widths.push('32px');
    }else if(idx === 1){
      widths.push('46%');
    }else if(idx === count - 1){
      widths.push('24%');
    }else{
      widths.push(`${32 + ((idx * 11) % 36)}%`);
    }
  }
  return widths;
}

function resolveTable(target){
  if(!target) return null;
  if(target instanceof HTMLTableElement) return target;
  if(typeof target === 'string'){ return document.getElementById(target); }
  return null;
}

function countColumns(table){
  if(!table) return 0;
  const headRow = table.tHead && table.tHead.rows ? table.tHead.rows[0] : null;
  if(headRow && headRow.cells && headRow.cells.length){
    return Array.from(headRow.cells).reduce((total, cell) => total + (cell.colSpan || 1), 0);
  }
  const body = table.tBodies && table.tBodies[0] ? table.tBodies[0] : null;
  if(!body) return 0;
  const sample = Array.from(body.rows || []).find(row => row && row.cells && row.cells.length);
  if(!sample) return 0;
  return Array.from(sample.cells).reduce((total, cell) => total + (cell.colSpan || 1), 0);
}

export function applyTableSkeleton(target, options = {}){
  if(typeof document === 'undefined') return null;
  const table = resolveTable(target);
  if(!table) return null;
  const body = table.tBodies && table.tBodies[0] ? table.tBodies[0] : null;
  if(!body) return table;
  if(body.dataset.hasData === '1') return table;
  if(body.dataset.skeleton === '1' && body.children.length){
    return table;
  }
  const columnCount = Math.max(1, options.columns || countColumns(table));
  const rows = Math.max(1, Number.isFinite(options.rows) ? Math.floor(options.rows) : DEFAULT_ROWS);
  const columnWidths = pickColumnWidths(columnCount);
  const frag = document.createDocumentFragment();
  for(let rowIndex = 0; rowIndex < rows; rowIndex += 1){
    const tr = document.createElement('tr');
    tr.dataset.skeletonRow = '1';
    for(let colIndex = 0; colIndex < columnCount; colIndex += 1){
      const td = document.createElement('td');
      td.setAttribute('role', 'presentation');
      const bar = document.createElement('div');
      bar.className = colIndex === 0 ? 'skeleton-dot' : 'skeleton-bar';
      if(colIndex > 0){
        bar.style.setProperty('--skeleton-bar-width', columnWidths[colIndex]);
      }
      td.appendChild(bar);
      tr.appendChild(td);
    }
    frag.appendChild(tr);
  }
  body.dataset.skeleton = '1';
  body.innerHTML = '';
  body.appendChild(frag);
  table.dataset.tableSkeleton = '1';
  return table;
}

export function markTableHasData(target){
  if(typeof document === 'undefined') return;
  const table = resolveTable(target);
  if(!table) return;
  const body = table.tBodies && table.tBodies[0] ? table.tBodies[0] : null;
  if(body){
    body.dataset.hasData = '1';
    delete body.dataset.skeleton;
  }
  delete table.dataset.tableSkeleton;
}

export default {
  attachLoadingBlock,
  detachLoadingBlock,
  applyTableSkeleton,
  markTableHasData,
};
