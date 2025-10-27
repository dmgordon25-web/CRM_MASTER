const DEFAULT_LINE_WIDTHS = [82, 64, 78, 58, 72];
const DEFAULT_ROWS = 6;

function resolveNode(target){
  if(!target) return null;
  if(target instanceof Element) return target;
  if(typeof target === 'string'){ return document.querySelector(target); }
  return null;
}

function applyLineWidths(block, lines, widths){
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
  if(node.__loadingBlock && node.__loadingBlock.block){
    node.classList.add('loading-host', 'is-loading');
    return node.__loadingBlock.block;
  }
  const block = document.createElement('div');
  block.className = 'loading-block';
  block.setAttribute('aria-hidden', 'true');
  const lines = Number.isFinite(options.lines) ? Math.max(1, Math.floor(options.lines)) : DEFAULT_LINE_WIDTHS.length;
  const widths = Array.isArray(options.widths) ? options.widths : null;
  applyLineWidths(block, lines, widths);
  node.classList.add('loading-host', 'is-loading');
  node.insertBefore(block, node.firstChild || null);
  node.__loadingBlock = { block };
  return block;
}

export function detachLoadingBlock(target){
  if(typeof document === 'undefined') return;
  const node = resolveNode(target);
  if(!node) return;
  node.classList.remove('is-loading');
  const state = node.__loadingBlock;
  if(state && state.block && state.block.parentNode === node){
    node.removeChild(state.block);
  }
  if(state){
    delete node.__loadingBlock;
  }
  if(node.classList.contains('loading-host') && !node.querySelector(':scope > .loading-block')){
    node.classList.remove('loading-host');
  }
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
