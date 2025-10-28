const tableSyncRaf = typeof requestAnimationFrame === 'function'
  ? requestAnimationFrame
  : (fn) => setTimeout(fn, 16);
const tableSyncCancel = typeof cancelAnimationFrame === 'function'
  ? cancelAnimationFrame
  : (id) => clearTimeout(id);
const tableSyncMicrotask = typeof queueMicrotask === 'function'
  ? queueMicrotask
  : (fn) => Promise.resolve().then(fn);

function resolveDocument(node){
  if(node && node.ownerDocument) return node.ownerDocument;
  if(typeof document !== 'undefined') return document;
  return null;
}

function ensureColgroup(table, desired){
  if(!table) return null;
  const doc = resolveDocument(table);
  if(!doc) return null;
  let colgroup = table.querySelector(':scope > colgroup[data-role="layout"]');
  if(!colgroup){
    colgroup = doc.createElement('colgroup');
    colgroup.setAttribute('data-role', 'layout');
    table.insertBefore(colgroup, table.firstChild || null);
  }else if(colgroup !== table.firstElementChild){
    table.insertBefore(colgroup, table.firstChild || null);
  }
  while(colgroup.children.length < desired){
    colgroup.appendChild(doc.createElement('col'));
  }
  while(colgroup.children.length > desired){
    const last = colgroup.lastElementChild;
    if(!last) break;
    colgroup.removeChild(last);
  }
  return colgroup;
}

function measureCell(cell){
  if(!cell) return 0;
  let width = 0;
  try{
    if(typeof cell.scrollWidth === 'number' && cell.scrollWidth){
      width = Math.max(width, cell.scrollWidth);
    }
    if(typeof cell.offsetWidth === 'number' && cell.offsetWidth){
      width = Math.max(width, cell.offsetWidth);
    }
    if(typeof cell.getBoundingClientRect === 'function'){
      const rect = cell.getBoundingClientRect();
      if(rect && rect.width){
        width = Math.max(width, rect.width);
      }
    }
  }catch (_err){}
  return Math.max(0, Math.ceil(width));
}

function isPlaceholderRow(row){
  if(!row) return true;
  if(row.hidden || row.getAttribute('hidden') === 'true') return true;
  if(row.getAttribute && row.getAttribute('aria-hidden') === 'true') return true;
  if(row.dataset){
    if(row.dataset.placeholder === '1') return true;
    if(row.dataset.skeletonRow === '1') return true;
    if(row.dataset.loading === '1') return true;
  }
  if(row.style && row.style.display === 'none') return true;
  return false;
}

function findFirstDataRow(tbody){
  if(!tbody || !tbody.rows) return null;
  const rows = Array.from(tbody.rows);
  for(const row of rows){
    if(!row) continue;
    if(isPlaceholderRow(row)) continue;
    if(row.getBoundingClientRect){
      try{
        const rect = row.getBoundingClientRect();
        if(rect && rect.width === 0 && rect.height === 0) continue;
      }catch (_err){}
    }
    return row;
  }
  return null;
}

function normalizeLabel(cell){
  if(!cell) return '';
  return String(cell.textContent || '').trim();
}

function detectColumnMeta(headerCell, bodyCell){
  const label = normalizeLabel(headerCell);
  const field = headerCell?.dataset?.field || '';
  const normalized = label.toLowerCase();
  const isSelect = headerCell?.getAttribute('data-role') === 'select'
    || Boolean(headerCell?.querySelector?.('[data-role="select-all"]'));
  const isStar = Boolean(bodyCell?.querySelector?.('[data-ui="row-star"]'))
    || Boolean(headerCell?.querySelector?.('[data-ui="row-star"]'));
  const isName = headerCell?.dataset?.wrap === '1'
    || normalized === 'name'
    || field === 'name';
  const isNumeric = normalized === 'amount' || normalized === 'funded';

  const headerWidth = measureCell(headerCell);
  const cellWidth = measureCell(bodyCell);
  let width = Math.max(headerWidth, cellWidth);
  let minWidth = 120;
  let flexible = true;
  let fixed = false;

  if(isSelect){
    minWidth = 40;
    width = 40;
    flexible = false;
    fixed = true;
  }else if(isStar){
    minWidth = 48;
    width = 48;
    flexible = false;
    fixed = true;
  }else if(isName){
    minWidth = 200;
    width = Math.max(width, minWidth);
  }else if(normalized === 'loan type'
    || normalized === 'stage'
    || normalized === 'referred by'
    || normalized === 'last activity'){
    minWidth = 140;
    width = Math.max(width, minWidth);
  }else if(isNumeric){
    minWidth = 110;
    width = Math.max(width, minWidth);
    flexible = false;
  }else{
    minWidth = Math.max(110, Math.min(180, Math.round(width) || 0));
    width = Math.max(width, minWidth);
  }

  return {
    label,
    field,
    width: Math.max(width, minWidth),
    minWidth,
    flexible: Boolean(flexible && !fixed),
    fixed,
    isName: Boolean(isName && !fixed)
  };
}

function shrinkColumns(columns, containerWidth){
  let total = columns.reduce((sum, col) => sum + col.width, 0);
  let overage = total - containerWidth;
  if(overage <= 0) return total;
  const shrinkables = columns.filter((col) => col.flexible && !col.fixed);
  if(!shrinkables.length) return total;
  let safety = 0;
  while(overage > 0 && safety < 8){
    const active = shrinkables.filter((col) => (col.width - col.minWidth) > 0.5);
    if(!active.length) break;
    const flexTotal = active.reduce((sum, col) => sum + (col.width - col.minWidth), 0);
    if(flexTotal <= 0) break;
    active.forEach((col) => {
      const flex = col.width - col.minWidth;
      if(flex <= 0) return;
      const share = overage * (flex / flexTotal);
      const delta = Math.min(flex, share);
      col.width = Math.max(col.minWidth, col.width - delta);
    });
    total = columns.reduce((sum, col) => sum + col.width, 0);
    overage = total - containerWidth;
    safety += 1;
  }
  return columns.reduce((sum, col) => sum + col.width, 0);
}

function getContainerWidth(wrap){
  if(!wrap) return 0;
  let width = 0;
  try{
    if(typeof wrap.getBoundingClientRect === 'function'){
      const rect = wrap.getBoundingClientRect();
      if(rect && rect.width){
        width = rect.width;
      }
    }
  }catch (_err){}

  if(!width && typeof wrap.clientWidth === 'number'){
    width = wrap.clientWidth;
  }

  const scrollbar = (typeof wrap.offsetWidth === 'number' && typeof wrap.clientWidth === 'number')
    ? wrap.offsetWidth - wrap.clientWidth
    : 0;
  if(Number.isFinite(scrollbar) && scrollbar > 0){
    width -= scrollbar;
  }

  if(width <= 0 && typeof wrap.clientWidth === 'number'){
    width = wrap.clientWidth;
  }

  return Math.max(0, Math.floor(width));
}

function applyLayout(manager){
  const { table, tbody, wrap } = manager;
  if(!table || !wrap || !table.tHead) return null;
  const headerRow = table.tHead.rows && table.tHead.rows[0];
  if(!headerRow) return null;
  const headerCells = Array.from(headerRow.cells || []);
  if(!headerCells.length) return null;

  const columnCount = headerCells.length;
  const colgroup = ensureColgroup(table, columnCount);
  if(!colgroup) return null;
  manager.colgroup = colgroup;

  const previousLayout = table.style.tableLayout;
  const cols = Array.from(colgroup.children);
  cols.forEach((col) => {
    col.style.width = '';
    col.style.minWidth = '';
    col.style.maxWidth = '';
  });

  table.style.tableLayout = 'auto';
  try{ void table.offsetWidth; }
  catch (_err){}

  const sampleRow = findFirstDataRow(tbody);
  const sampleCells = sampleRow ? Array.from(sampleRow.cells || []) : [];

  const columns = headerCells.map((headerCell, index) => {
    const bodyCell = sampleCells[index] || null;
    return detectColumnMeta(headerCell, bodyCell);
  });

  const containerWidth = getContainerWidth(wrap);
  let totalWidth = columns.reduce((sum, col) => sum + col.width, 0);

  if(containerWidth > 0 && totalWidth > containerWidth){
    totalWidth = shrinkColumns(columns, containerWidth);
  }

  if(containerWidth > 0 && totalWidth < containerWidth){
    const recipient = columns.find((col) => col.isName && !col.fixed)
      || columns.find((col) => col.flexible && !col.fixed);
    if(recipient){
      const extra = containerWidth - totalWidth;
      if(extra > 0){
        recipient.width += extra;
        totalWidth += extra;
      }
    }
  }

  columns.forEach((colMeta, index) => {
    const col = cols[index];
    if(!col) return;
    const width = Math.max(colMeta.minWidth, Math.round(colMeta.width));
    const value = `${width}px`;
    col.style.width = value;
    col.style.minWidth = value;
    col.style.maxWidth = value;
  });

  table.style.tableLayout = 'fixed';
  if(previousLayout && previousLayout !== 'fixed'){
    try{ table.style.tableLayout = 'fixed'; }
    catch (_err){}
  }

  const snapshotColumns = columns.map((col) => ({
    label: col.label,
    width: Math.max(col.minWidth, Math.round(col.width))
  }));
  const finalTotalWidth = snapshotColumns.reduce((sum, col) => sum + col.width, 0);
  return {
    columns: snapshotColumns,
    totalWidth: finalTotalWidth,
    containerWidth,
    scale: containerWidth > 0
      ? Math.min(1, containerWidth / Math.max(1, finalTotalWidth))
      : 1
  };
}

function emitSyncLog(manager, snapshot){
  if(typeof window === 'undefined') return;
  const payload = {
    table: manager.key || manager.label || manager.table?.dataset?.tableLens || '',
    containerWidth: snapshot.containerWidth,
    totalWidth: snapshot.totalWidth,
    scale: snapshot.scale,
    columns: snapshot.columns
  };
  window.__TABLE_SYNC_LOG = payload;
  if(!manager.debugLogged && window.console && typeof window.console.log === 'function'){
    try{ window.console.log('__TABLE_SYNC_LOG', payload); }
    catch (_err){}
  }
  manager.debugLogged = true;
}

export function createTableColgroupManager(options = {}){
  const { table, tbody, wrap, key = '', label = '' } = options;
  if(!table || !wrap) return null;
  const manager = {
    table,
    tbody,
    wrap,
    key,
    label,
    disposed: false,
    rafId: null,
    rafCancel: null,
    needsMeasure: false,
    isUpdating: false,
    fontsReady: true,
    debugLogged: false,
    resizeObserver: null,
    resizeHandler: null,
    colgroup: null
  };

  manager.colgroup = ensureColgroup(table, table.tHead && table.tHead.rows && table.tHead.rows[0]
    ? table.tHead.rows[0].cells.length
    : 0);

  const doc = resolveDocument(table);
  const fontsReady = doc?.fonts?.ready;
  if(fontsReady && typeof fontsReady.then === 'function'){
    manager.fontsReady = false;
    fontsReady.then(() => {
      manager.fontsReady = true;
      if(!manager.disposed){
        manager.scheduleMeasure();
      }
    }).catch(() => {
      manager.fontsReady = true;
    });
  }

  manager.setElements = function setElements(next = {}){
    if(manager.disposed) return;
    const nextWrap = next.wrap || manager.wrap;
    const nextBody = next.tbody || manager.tbody;
    if(nextBody && nextBody !== manager.tbody){
      manager.tbody = nextBody;
    }
    if(nextWrap && nextWrap !== manager.wrap){
      manager.wrap = nextWrap;
      if(manager.resizeObserver){
        try{ manager.resizeObserver.disconnect(); }
        catch (_err){}
        manager.resizeObserver = null;
      }
      if(typeof ResizeObserver === 'function'){
        manager.resizeObserver = new ResizeObserver(() => {
          manager.scheduleMeasure();
        });
        manager.resizeObserver.observe(nextWrap);
      }
    }
    manager.scheduleMeasure();
  };

  manager.scheduleMeasure = function scheduleMeasure(){
    if(manager.disposed) return;
    if(manager.rafId != null) return;
    manager.rafId = tableSyncRaf(() => {
      manager.rafId = null;
      tableSyncMicrotask(() => manager.measure());
    });
  };

  manager.measure = function measure(){
    if(manager.disposed) return;
    if(manager.isUpdating){
      manager.needsMeasure = true;
      return;
    }
    if(!manager.fontsReady){
      manager.needsMeasure = true;
      return;
    }
    manager.isUpdating = true;
    manager.needsMeasure = false;
    try{
      const snapshot = applyLayout(manager);
      if(snapshot){
        manager.lastSnapshot = snapshot;
        emitSyncLog(manager, snapshot);
      }
    }finally{
      manager.isUpdating = false;
    }
    if(manager.needsMeasure && !manager.disposed){
      manager.needsMeasure = false;
      manager.scheduleMeasure();
    }
  };

  manager.dispose = function dispose(){
    if(manager.disposed) return;
    manager.disposed = true;
    if(manager.rafId != null){
      tableSyncCancel(manager.rafId);
      manager.rafId = null;
    }
    if(manager.resizeHandler && typeof window !== 'undefined'){
      try{ window.removeEventListener('resize', manager.resizeHandler); }
      catch (_err){}
      manager.resizeHandler = null;
    }
    if(manager.resizeObserver){
      try{ manager.resizeObserver.disconnect(); }
      catch (_err){}
      manager.resizeObserver = null;
    }
  };

  if(typeof ResizeObserver === 'function'){
    manager.resizeObserver = new ResizeObserver(() => {
      manager.scheduleMeasure();
    });
    manager.resizeObserver.observe(wrap);
  }

  if(typeof window !== 'undefined'){
    manager.resizeHandler = () => {
      manager.scheduleMeasure();
    };
    try{ window.addEventListener('resize', manager.resizeHandler, { passive: true }); }
    catch (_err){}
  }

  return manager;
}

export function disposeTableColgroupManager(manager){
  if(!manager) return;
  if(typeof manager.dispose === 'function'){
    manager.dispose();
    return;
  }
  if(manager.resizeObserver){
    try{ manager.resizeObserver.disconnect(); }
    catch (_err){}
    manager.resizeObserver = null;
  }
  if(manager.resizeHandler && typeof window !== 'undefined'){
    try{ window.removeEventListener('resize', manager.resizeHandler); }
    catch (_err){}
    manager.resizeHandler = null;
  }
  if(manager.rafId != null){
    tableSyncCancel(manager.rafId);
    manager.rafId = null;
  }
  manager.disposed = true;
}

export default {
  createTableColgroupManager,
  disposeTableColgroupManager
};
