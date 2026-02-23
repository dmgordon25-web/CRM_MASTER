const tableState = new WeakMap();

function resolveTable(target){
  if(!target) return null;
  if(target instanceof HTMLTableElement) return target;
  if(typeof target === 'string'){ return document.getElementById(target); }
  return null;
}

function ensureState(table){
  let state = tableState.get(table);
  if(!state){
    state = { frame: 0, observer: null, mutation: null, scrollHost: null, resizeHandler: null };
    tableState.set(table, state);
  }
  return state;
}

function findScrollHost(table){
  if(typeof window === 'undefined' || !table) return null;
  let node = table.parentElement;
  while(node){
    try{
      const style = window.getComputedStyle(node);
      const overflowY = style.overflowY || style.overflow || '';
      if(/auto|scroll|overlay/i.test(overflowY)){
        return node;
      }
    }catch (_err){}
    node = node.parentElement;
  }
  return null;
}

function ensureColgroup(table, count){
  if(!table) return null;
  let colgroup = table.querySelector(':scope > colgroup[data-table-sync="1"]');
  if(!colgroup){
    colgroup = document.createElement('colgroup');
    colgroup.dataset.tableSync = '1';
    table.insertBefore(colgroup, table.firstChild || null);
  }
  const cols = Array.from(colgroup.children);
  if(cols.length > count){
    for(let idx = cols.length - 1; idx >= count; idx -= 1){
      colgroup.removeChild(cols[idx]);
    }
  }else if(cols.length < count){
    for(let idx = cols.length; idx < count; idx += 1){
      const col = document.createElement('col');
      colgroup.appendChild(col);
    }
  }
  return colgroup;
}

function collectRows(table){
  const rows = [];
  if(!table || !table.tBodies || !table.tBodies.length) return rows;
  const body = table.tBodies[0];
  rows.push(...Array.from(body.rows || []).filter(row => !row.dataset || row.dataset.skeletonRow !== '1'));
  return rows;
}

function measureRow(row, widths){
  if(!row || !row.cells) return;
  let cursor = 0;
  Array.from(row.cells).forEach(cell => {
    const span = cell.colSpan || 1;
    const rect = cell.getBoundingClientRect();
    const width = rect && rect.width ? rect.width : cell.offsetWidth;
    const share = span > 1 ? width / span : width;
    for(let offset = 0; offset < span && (cursor + offset) < widths.length; offset += 1){
      widths[cursor + offset] = Math.max(widths[cursor + offset], share);
    }
    cursor += span;
  });
}

function computeColumnCount(table){
  if(!table) return 0;
  const head = table.tHead && table.tHead.rows ? table.tHead.rows[0] : null;
  if(head && head.cells && head.cells.length){
    return Array.from(head.cells).reduce((total, cell) => total + (cell.colSpan || 1), 0);
  }
  const rows = collectRows(table);
  const sample = rows.find(row => row && row.cells && row.cells.length);
  if(!sample) return 0;
  return Array.from(sample.cells).reduce((total, cell) => total + (cell.colSpan || 1), 0);
}

function applyScrollbarHint(table, host){
  if(!table || !host) return;
  let width = 0;
  try{
    width = host.offsetWidth - host.clientWidth;
    if(width < 0) width = 0;
  }catch (_err){ width = 0; }
  const value = width ? `${Math.round(width)}px` : '0px';
  table.style.setProperty('--table-scrollbar-width', value);
  if(host instanceof HTMLElement){
    host.classList.add('table-scroll-host');
  }
}

function syncTable(table){
  if(!table || !table.isConnected) return;
  if(!table.tHead || !table.tBodies || !table.tBodies.length) return;
  if(table.offsetParent === null && table.getBoundingClientRect().width === 0){
    return;
  }
  const columnCount = computeColumnCount(table);
  if(!columnCount) return;
  const widths = new Array(columnCount).fill(0);
  const headRow = table.tHead.rows && table.tHead.rows[0];
  if(headRow){
    measureRow(headRow, widths);
  }
  collectRows(table).slice(0, 20).forEach(row => measureRow(row, widths));
  const maxWidth = Math.max(...widths);
  if(!maxWidth){
    return;
  }
  const colgroup = ensureColgroup(table, widths.length);
  widths.forEach((width, idx) => {
    const col = colgroup.children[idx];
    if(!col) return;
    const px = `${Math.ceil(width)}px`;
    col.style.width = px;
    col.style.minWidth = px;
    col.style.maxWidth = px;
  });
  table.dataset.tableLayoutReady = '1';
  const state = ensureState(table);
  if(!state.scrollHost || !state.scrollHost.isConnected){
    state.scrollHost = findScrollHost(table);
  }
  if(state.scrollHost){
    applyScrollbarHint(table, state.scrollHost);
  }
}

function scheduleSync(table){
  const state = ensureState(table);
  if(state.frame){
    return;
  }
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null;
  if(!raf){
    syncTable(table);
    return;
  }
  state.frame = raf(() => {
    state.frame = 0;
    syncTable(table);
  });
}

function observeTable(table){
  if(typeof ResizeObserver !== 'function'){
    return;
  }
  const state = ensureState(table);
  if(!state.observer){
    const observer = new ResizeObserver(() => scheduleSync(table));
    observer.observe(table);
    if(table.tHead){ observer.observe(table.tHead); }
    if(table.tBodies && table.tBodies[0]){ observer.observe(table.tBodies[0]); }
    state.observer = observer;
  }
  if(!state.mutation && typeof MutationObserver === 'function' && table.tBodies && table.tBodies[0]){
    const mutation = new MutationObserver(() => scheduleSync(table));
    mutation.observe(table.tBodies[0], { childList: true, subtree: false });
    state.mutation = mutation;
  }
  if(!state.resizeHandler && typeof window !== 'undefined'){
    const handler = () => scheduleSync(table);
    window.addEventListener('resize', handler, { passive: true });
    state.resizeHandler = handler;
  }
}

export function syncTableLayout(target){
  if(typeof document === 'undefined') return null;
  const table = resolveTable(target);
  if(!table) return null;
  observeTable(table);
  scheduleSync(table);
  return table;
}

function autoInstall(){
  if(typeof document === 'undefined') return;
  const tables = Array.from(document.querySelectorAll('table')).filter(tbl => tbl.tHead && tbl.tBodies && tbl.tBodies.length);
  tables.forEach(table => syncTableLayout(table));
}

if(typeof document !== 'undefined'){
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', autoInstall, { once: true });
  }else{
    autoInstall();
  }
}

export default { syncTableLayout };
