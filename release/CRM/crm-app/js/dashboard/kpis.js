import { stageKeyFromLabel } from '../pipeline/stages.js';
import { getTodayTasks, getOverdueTasks } from '../tasks/task_scopes.js';
import { getOpenTasks, countTodayTasks, countOverdueTasks } from '../tasks/task_counts.js';

const GROUP_DEFS = [
  { key: 'new', label: 'New', stageKeys: ['new', 'long-shot', 'longshot', 'lead', 'leads', 'prospect', 'application', 'app'] },
  { key: 'qualified', label: 'Qualified', stageKeys: ['qualified', 'preapproved', 'pre-approved', 'preapp', 'processing', 'underwriting', 'approved', 'nurture'] },
  { key: 'won', label: 'Won', stageKeys: ['won', 'ctc', 'clear-to-close', 'cleared-to-close', 'funded', 'post-close', 'postclose', 'client', 'clients'] },
  { key: 'lost', label: 'Lost', stageKeys: ['lost', 'denied', 'declined', 'fallout'] }
];

const STAGE_GROUP_LOOKUP = new Map();

function canonicalStageToken(value){
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function registerStageGroup(groupKey, aliases){
  aliases.forEach(alias => {
    const normalized = canonicalStageToken(alias);
    if(!normalized) return;
    STAGE_GROUP_LOOKUP.set(normalized, groupKey);
    const squished = normalized.replace(/-/g, '');
    if(squished) STAGE_GROUP_LOOKUP.set(squished, groupKey);
  });
}

GROUP_DEFS.forEach(def => registerStageGroup(def.key, def.stageKeys));

const numberFormatter = (typeof Intl !== 'undefined' && Intl.NumberFormat)
  ? new Intl.NumberFormat()
  : null;

function formatCount(value){
  const numeric = Number(value) || 0;
  if(numberFormatter){
    try { return numberFormatter.format(numeric); }
    catch (_err) { /* fall through */ }
  }
  return String(numeric);
}

function canonicalStageFromLabel(label){
  if(!label) return '';
  try {
    const key = stageKeyFromLabel(label);
    if(key) return canonicalStageToken(key);
  } catch (_err) {}
  return canonicalStageToken(label);
}

function readPipelineGroupCounts(){
  const totals = new Map(GROUP_DEFS.map(def => [def.key, 0]));
  const overview = document.getElementById('dashboard-pipeline-overview');
  if(!overview) return totals;
  const rows = overview.querySelectorAll('.grid.cols-2 > .row');
  rows.forEach(row => {
    const labelEl = row.querySelector('.badge-pill');
    const countEl = row.querySelector('strong');
    if(!labelEl || !countEl) return;
    const label = (labelEl.textContent || '').trim();
    const countRaw = countEl.textContent || '0';
    const count = Number(countRaw.replace(/[^0-9.-]/g, '')) || 0;
    const stageKey = canonicalStageFromLabel(label);
    if(!stageKey) return;
    const group = STAGE_GROUP_LOOKUP.get(stageKey) || STAGE_GROUP_LOOKUP.get(stageKey.replace(/-/g, ''));
    if(!group) return;
    totals.set(group, (totals.get(group) || 0) + count);
  });
  return totals;
}

export function computeTaskKpis(tasks, todayDate){
  const openTasks = getOpenTasks(tasks || []);
  const todayTasks = getTodayTasks(openTasks, todayDate);
  const overdueTasks = getOverdueTasks(openTasks, todayDate);
  return {
    todayTasks,
    overdueTasks,
    kpiTasksToday: countTodayTasks(tasks, todayDate),
    kpiTasksOverdue: countOverdueTasks(tasks, todayDate)
  };
}

function ensureTileContainer(host){
  let container = host.querySelector('[data-role="pipeline-kpi-tiles"]');
  if(container) return container;
  container = document.createElement('div');
  container.dataset.role = 'pipeline-kpi-tiles';
  container.className = 'grid kpi pipeline-stage-kpis';
  container.style.marginTop = '12px';
  host.appendChild(container);
  if(!container.__wired){
    container.__wired = true;
    container.addEventListener('click', evt => {
      const button = evt.target.closest('[data-role="pipeline-kpi"]');
      if(!button) return;
      evt.preventDefault();
      const stage = button.getAttribute('data-stage');
      if(!stage) return;
      if(window.CRM && typeof window.CRM.openPipelineWithFilter === 'function'){
        window.CRM.openPipelineWithFilter(stage);
        return;
      }
      try {
        const hash = '#/pipeline?stage=' + encodeURIComponent(stage);
        if(typeof location !== 'undefined' && location.hash !== hash){
          location.hash = hash;
        }
        const evtDetail = new CustomEvent('pipeline:applyFilter', { detail: { stage } });
        window.dispatchEvent(evtDetail);
      } catch (_err) {}
    });
  }
  return container;
}

function renderPipelineTiles(){
  const host = document.getElementById('dashboard-kpis');
  if(!host) return;
  const totals = readPipelineGroupCounts();
  if(!totals) return;
  const container = ensureTileContainer(host);
  container.innerHTML = '';
  const supportsFragment = typeof document.createDocumentFragment === 'function';
  const frag = supportsFragment ? document.createDocumentFragment() : null;
  GROUP_DEFS.forEach(def => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pipeline-kpi-trigger';
    button.setAttribute('data-role', 'pipeline-kpi');
    button.setAttribute('data-stage', def.key);
    button.setAttribute('data-qa', `kpi-open-pipeline-${def.key}`);
    button.style.background = 'transparent';
    button.style.border = 'none';
    button.style.padding = '0';
    button.style.textAlign = 'left';
    button.style.cursor = 'pointer';
    button.style.display = 'block';
    button.style.width = '100%';

    const card = document.createElement('div');
    card.className = 'card';
    const valueEl = document.createElement('div');
    valueEl.className = 'kval';
    valueEl.textContent = formatCount(totals.get(def.key));
    const labelEl = document.createElement('div');
    labelEl.className = 'muted';
    labelEl.textContent = def.label;
    card.appendChild(valueEl);
    card.appendChild(labelEl);
    button.appendChild(card);
    if (frag) {
      frag.appendChild(button);
    } else {
      container.appendChild(button);
    }
  });
  if (frag) {
    container.appendChild(frag);
  }
}

let pending = false;
function scheduleRender(){
  if(pending) return;
  pending = true;
  Promise.resolve().then(() => {
    pending = false;
    try { renderPipelineTiles(); }
    catch (err) { console.warn('pipeline KPI tiles failed', err); }
  });
}

function init(){
  scheduleRender();
  if(typeof document !== 'undefined'){
    document.addEventListener('app:data:changed', scheduleRender);
  }
  if(window.RenderGuard && typeof window.RenderGuard.registerHook === 'function'){
    try { window.RenderGuard.registerHook(scheduleRender); }
    catch (_err) {}
  }
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init, { once: true });
}else{
  init();
}
