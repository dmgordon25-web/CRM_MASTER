import { canonicalStatusKey, PIPELINE_STATUS_KEYS } from '../pipeline/constants.js';
import { CANONICAL_STAGES, normalizeStage } from '../workflows/status_canonical.js';


const KNOWN_STATUS_KEYS = new Set([
  ...PIPELINE_STATUS_KEYS,
  'funded',
  'approved',
  'followup',
  'canceled',
  'cancelled',
  'denied'
]);

const STORE_FIELD_RULES = Object.freeze([
  { store: 'contacts', fields: [{ key: 'stage', type: 'stage' }, { key: 'status', type: 'status' }] },
  { store: 'deals', fields: [{ key: 'stage', type: 'stage' }, { key: 'status', type: 'status' }] },
  { store: 'documents', fields: [{ key: 'status', type: 'status' }] },
  { store: 'tasks', fields: [{ key: 'status', type: 'status' }] }
]);

function asText(value) {
  if (value == null) return '';
  return String(value).trim();
}

function canonicalFor(type, rawValue) {
  if (type === 'stage') return normalizeStage(rawValue);
  if (type === 'status') {
    const normalized = canonicalStatusKey(rawValue);
    if (!normalized) return null;
    return KNOWN_STATUS_KEYS.has(normalized) ? normalized : null;
  }
  return null;
}

function toExample(record) {
  const id = asText(record?.id || record?.contactId || record?.dealId || record?.taskId || record?.docId || 'unknown');
  const name = asText(record?.name || [record?.first, record?.last].filter(Boolean).join(' ') || record?.title || record?.subject || '');
  return { id, name };
}

function createBucket() {
  return {
    count: 0,
    examples: []
  };
}

function addValue(targetMap, value, record) {
  if (!targetMap.has(value)) targetMap.set(value, createBucket());
  const entry = targetMap.get(value);
  entry.count += 1;
  if (entry.examples.length < 3) {
    entry.examples.push(toExample(record));
  }
}

async function readStore(store) {
  if (typeof window.dbGetAll === 'function') {
    try { return await window.dbGetAll(store, { includePending: true, includeDeleted: true }); }
    catch (_err) { return []; }
  }
  return [];
}

function summarizeMap(map, sortByCount = false) {
  const rows = Array.from(map.entries()).map(([value, detail]) => ({
    value,
    count: detail.count,
    examples: detail.examples.slice(0, 3)
  }));
  rows.sort((a, b) => {
    if (sortByCount && b.count !== a.count) return b.count - a.count;
    return a.value.localeCompare(b.value);
  });
  return rows;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderCanonical(report) {
  const lines = [];
  lines.push(`Stages (${report.stages.canonical.length}): ${report.stages.canonical.map((row) => row.value).join(', ') || 'none'}`);
  lines.push(`Statuses (${report.statuses.canonical.length}): ${report.statuses.canonical.map((row) => row.value).join(', ') || 'none'}`);
  setText('data-diagnostics-canonical', lines.join('\n'));
}

function formatOrphans(rows) {
  if (!rows.length) return 'None detected.';
  return rows.map((row) => {
    const sample = row.examples.map((example) => `${example.id}${example.name ? ` (${example.name})` : ''}`).join(', ');
    return `${row.value} • count ${row.count}${sample ? ` • examples: ${sample}` : ''}`;
  }).join('\n');
}

function renderOrphans(report) {
  const stageText = `Stage orphans (${report.stages.orphans.length})\n${formatOrphans(report.stages.orphans)}`;
  const statusText = `Status orphans (${report.statuses.orphans.length})\n${formatOrphans(report.statuses.orphans)}`;
  setText('data-diagnostics-orphans', `${stageText}\n\n${statusText}`);
}

function renderSummary(report) {
  setText('data-diagnostics-summary', `Scanned ${report.meta.recordsScanned} records across ${report.meta.storesScanned} stores.`);
}

async function buildReport() {
  const stageCanonical = new Map(CANONICAL_STAGES.map((key) => [key, createBucket()]));
  const stageOrphans = new Map();
  const statusCanonical = new Map();
  const statusOrphans = new Map();
  let recordsScanned = 0;

  for (const rule of STORE_FIELD_RULES) {
    const rows = await readStore(rule.store);
    for (const row of rows) {
      recordsScanned += 1;
      for (const fieldRule of rule.fields) {
        const rawValue = asText(row?.[fieldRule.key]);
        if (!rawValue) continue;
        const canonicalValue = canonicalFor(fieldRule.type, rawValue);
        if (fieldRule.type === 'stage') {
          if (canonicalValue) addValue(stageCanonical, canonicalValue, row);
          else addValue(stageOrphans, rawValue, row);
        } else if (fieldRule.type === 'status') {
          if (canonicalValue) addValue(statusCanonical, canonicalValue, row);
          else addValue(statusOrphans, rawValue, row);
        }
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    meta: {
      storesScanned: STORE_FIELD_RULES.length,
      recordsScanned
    },
    stages: {
      canonical: summarizeMap(stageCanonical).filter((row) => row.count > 0),
      orphans: summarizeMap(stageOrphans, true)
    },
    statuses: {
      canonical: summarizeMap(statusCanonical).filter((row) => row.count > 0),
      orphans: summarizeMap(statusOrphans, true)
    }
  };
}

async function copyReport(report) {
  const payload = JSON.stringify(report, null, 2);
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(payload);
    return true;
  }
  return false;
}

export function initDataDiagnostics() {
  const runBtn = document.getElementById('btn-run-data-diagnostics');
  const copyBtn = document.getElementById('btn-copy-data-diagnostics');
  if (!runBtn || runBtn.__wired) return;
  runBtn.__wired = true;
  runBtn.addEventListener('click', async () => {
    runBtn.disabled = true;
    setText('data-diagnostics-summary', 'Running scan…');
    try {
      const report = await buildReport();
      window.__DATA_DIAGNOSTICS_REPORT__ = report;
      renderSummary(report);
      renderCanonical(report);
      renderOrphans(report);
    } finally {
      runBtn.disabled = false;
    }
  });

  if (copyBtn && !copyBtn.__wired) {
    copyBtn.__wired = true;
    copyBtn.addEventListener('click', async () => {
      const report = window.__DATA_DIAGNOSTICS_REPORT__;
      if (!report) {
        setText('data-diagnostics-summary', 'Run scan first, then copy report.');
        return;
      }
      try {
        const ok = await copyReport(report);
        setText('data-diagnostics-summary', ok ? 'Copied diagnostics report.' : 'Clipboard unavailable in this browser.');
      } catch (_err) {
        setText('data-diagnostics-summary', 'Unable to copy diagnostics report.');
      }
    });
  }
}

export async function refreshDataDiagnostics() {
  const report = await buildReport();
  window.__DATA_DIAGNOSTICS_REPORT__ = report;
  renderSummary(report);
  renderCanonical(report);
  renderOrphans(report);
}
