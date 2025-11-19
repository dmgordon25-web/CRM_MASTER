import { columnSchemas, getColumnSchema } from './column_schema.js';

const STORAGE_KEY = 'columns:config:v1';
const ADVANCED_DEFAULT_VIEW_CONFIG = {
  contacts: {
    order: ['name', 'email', 'phone', 'city', 'status', 'owner'],
    hidden: ['stage', 'pipelineMilestone', 'loanType', 'loanAmount', 'referredBy', 'lastTouch', 'nextAction', 'fundedDate', 'createdAt', 'updatedAt']
  },
  longshots: {
    order: ['name', 'status', 'loanType', 'loanAmount', 'referredBy', 'lastTouch'],
    hidden: ['email', 'phone', 'city', 'stage', 'owner', 'nextAction', 'pipelineMilestone', 'createdAt', 'updatedAt']
  },
  pipeline: {
    order: ['name', 'stage', 'loanType', 'loanAmount', 'referredBy'],
    hidden: ['status', 'email', 'phone', 'city', 'pipelineMilestone', 'owner', 'lastTouch', 'nextAction', 'createdAt', 'updatedAt']
  },
  clients: {
    order: ['name', 'stage', 'loanAmount', 'fundedDate', 'owner'],
    hidden: ['email', 'phone', 'city', 'pipelineMilestone', 'loanType', 'lastTouch', 'updatedAt']
  },
  partners: {
    order: ['name', 'company', 'tier', 'referrals', 'funded', 'active', 'volume', 'conversion', 'email', 'phone'],
    hidden: ['owner', 'lastTouch', 'nextTouch', 'createdAt', 'updatedAt']
  },
  'pipeline-main': {
    order: ['name', 'stage', 'loanAmount', 'pipelineMilestone', 'nextAction', 'owner'],
    hidden: ['status', 'loanType', 'email', 'phone', 'city', 'referredBy', 'lastTouch', 'createdAt', 'updatedAt']
  },
  'leads-main': {
    order: ['name', 'status', 'stage', 'loanAmount', 'loanType', 'owner'],
    hidden: ['pipelineMilestone', 'email', 'phone', 'city', 'referredBy', 'lastTouch', 'nextAction', 'createdAt', 'updatedAt']
  },
  'partners-main': {
    order: ['name', 'company', 'tier', 'referrals', 'funded', 'active', 'volume', 'conversion', 'email', 'phone'],
    hidden: ['owner', 'lastTouch', 'nextTouch', 'createdAt', 'updatedAt']
  }
};

function buildDefaultViewConfig(mode = 'advanced'){
  if(mode === 'simple'){
    const config = {};
    Object.keys(columnSchemas).forEach((viewKey) => {
      const schema = getColumnSchema(viewKey);
      const simpleColumns = schema.filter((col) => col.required || col.simple !== false);
      const order = simpleColumns.map((col) => col.id);
      const visibleSet = new Set(order);
      const hidden = schema.filter((col) => !col.required && !visibleSet.has(col.id)).map((col) => col.id);
      config[viewKey] = { order, hidden };
    });
    return config;
  }
  return ADVANCED_DEFAULT_VIEW_CONFIG;
}

function normalizeViewConfig(entry){
  const order = Array.isArray(entry?.order) ? entry.order.filter((id) => typeof id === 'string' && id.trim()) : [];
  const hidden = Array.isArray(entry?.hidden) ? entry.hidden.filter((id) => typeof id === 'string' && id.trim()) : [];
  return { order, hidden };
}

function normalizeConfig(raw, mode = 'advanced'){
  const config = {};
  const defaults = buildDefaultViewConfig(mode);
  if(raw && typeof raw === 'object'){
    Object.keys(raw).forEach((key) => {
      config[key] = normalizeViewConfig(raw[key]);
    });
  }
  Object.keys(columnSchemas).forEach((viewKey) => {
    if(config[viewKey]){
      config[viewKey] = normalizeViewConfig(config[viewKey]);
    }else{
      const fallback = defaults[viewKey] || { order: [], hidden: [] };
      config[viewKey] = normalizeViewConfig(fallback);
    }
  });
  return config;
}

function loadColumnConfig(){
  let stored = null;
  try{
    if(typeof localStorage !== 'undefined'){
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        stored = JSON.parse(raw);
      }
    }
  }catch (_err){ stored = null; }
  return normalizeConfig(stored || {});
}

function saveColumnConfig(config){
  const normalized = normalizeConfig(config || {});
  try{
    if(typeof localStorage !== 'undefined'){
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }
  }catch (_err){}
  return normalized;
}

function applyOrder(schema, viewConfig){
  const allowedIds = new Set(schema.map((col) => col.id));
  const order = (viewConfig?.order || []).filter((id) => allowedIds.has(id));
  const hidden = new Set((viewConfig?.hidden || []).filter((id) => allowedIds.has(id)));
  const ordered = [];
  const seen = new Set();

  order.forEach((id) => {
    const col = schema.find((entry) => entry.id === id);
    if(!col || seen.has(id)) return;
    seen.add(id);
    if(col.required){
      hidden.delete(id);
      ordered.push(col);
      return;
    }
    if(hidden.has(id)) return;
    ordered.push(col);
  });

  schema.forEach((col) => {
    if(seen.has(col.id)) return;
    seen.add(col.id);
    if(col.required){
      hidden.delete(col.id);
      ordered.push(col);
      return;
    }
    if(hidden.has(col.id)) return;
    ordered.push(col);
  });

  const visibleSet = new Set(ordered.map((col) => col.id));
  const hiddenColumns = schema.filter((col) => !col.required && !visibleSet.has(col.id));

  return { visibleColumns: ordered, hiddenColumns };
}

function getColumnsForView(viewKey, mode = 'advanced', cachedConfig = null){
  const schema = getColumnSchema(viewKey);
  if(!schema.length) return { visibleColumns: [], hiddenColumns: [], config: normalizeConfig(cachedConfig || loadColumnConfig()) };
  const filteredSchema = schema.filter((col) => mode !== 'simple' || col.simple !== false);
  const config = normalizeConfig(cachedConfig || loadColumnConfig(), mode);
  const viewConfig = config[viewKey] || { order: [], hidden: [] };
  const { visibleColumns, hiddenColumns } = applyOrder(filteredSchema, viewConfig);
  return { visibleColumns, hiddenColumns, config };
}

export { loadColumnConfig, saveColumnConfig, getColumnsForView };
export default { loadColumnConfig, saveColumnConfig, getColumnsForView };
