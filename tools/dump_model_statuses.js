#!/usr/bin/env node
/*
 * Dev utility: inventories workflow fields, statuses, stages, and milestones.
 * Outputs JSON and markdown reports under reports/model_inventory/.
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const APP_JS = path.join(ROOT, 'crm-app', 'js');
const REPORT_DIR = path.join(ROOT, 'reports', 'model_inventory');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function walkFiles(dir, filterExt = ['.js']) {
  const results = [];
  const queue = [dir];
  while (queue.length) {
    const current = queue.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    entries.forEach((entry) => {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(full);
      } else if (filterExt.includes(path.extname(entry.name))) {
        results.push(full);
      }
    });
  }
  return results;
}

function findMatches(content, needle) {
  const matches = [];
  let idx = content.indexOf(needle);
  while (idx !== -1) {
    const prefix = content.slice(0, idx);
    const line = prefix.split(/\n/).length;
    matches.push(line);
    idx = content.indexOf(needle, idx + needle.length);
  }
  return matches;
}

function readJsonSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

async function importModule(relPath) {
  const full = path.join(ROOT, relPath);
  const url = pathToFileURL(full);
  return import(url.href);
}

async function loadSchemas() {
  const module = await importModule('crm-app/js/tables/column_schema.js');
  const schemas = module.columnSchemas || module.default || {};
  return schemas;
}

async function loadPipelineMetadata() {
  const [constants, stages] = await Promise.all([
    importModule('crm-app/js/pipeline/constants.js'),
    importModule('crm-app/js/pipeline/stages.js')
  ]);
  return {
    stages: stages.PIPELINE_STAGES || [],
    stageKeys: stages.PIPELINE_STAGE_KEYS || [],
    stageLabels: stages.PIPELINE_STAGES || [],
    statusKeys: constants.PIPELINE_STATUS_KEYS || [],
    stageAliases: constants.STAGE_ALIASES || {},
    statusAliases: constants.STATUS_ALIASES || {},
    milestones: constants.PIPELINE_MILESTONES || [],
    tones: constants.PIPELINE_TONES || []
  };
}

function gatherEntityFields(schemas) {
  const entities = {};
  Object.entries(schemas).forEach(([entity, fields]) => {
    entities[entity] = (fields || []).map((field) => ({
      id: field.id,
      label: field.label,
      required: Boolean(field.required),
      simple: field.simple !== false,
      typeHint: field.type || field.sortKey || null
    }));
  });
  return entities;
}

function gatherReferences(universe) {
  const files = walkFiles(APP_JS);
  const references = {};
  universe.forEach((token) => {
    const hits = [];
    files.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = findMatches(content, token);
      if (lines.length) {
        hits.push({ file: path.relative(ROOT, filePath), lines });
      }
    });
    references[token] = hits;
  });
  return references;
}

function renderFieldMarkdown(fields) {
  const rows = [];
  Object.entries(fields).forEach(([entity, items]) => {
    rows.push(`### ${entity}`);
    rows.push('');
    rows.push('| Field | Required | Simple | Type Hint |');
    rows.push('| --- | --- | --- | --- |');
    items.forEach((field) => {
      rows.push(`| ${field.id} | ${field.required ? 'yes' : 'no'} | ${field.simple ? 'yes' : 'no'} | ${field.typeHint || ''} |`);
    });
    rows.push('');
  });
  return rows.join('\n');
}

function renderReferenceMarkdown(label, values, refs) {
  const lines = [`## ${label}`, ''];
  lines.push('| Value | References |');
  lines.push('| --- | --- |');
  values.forEach((value) => {
    const entries = refs[value] || [];
    const formatted = entries
      .map((hit) => `${hit.file}${hit.lines.length ? ` (lines ${hit.lines.join(', ')})` : ''}`)
      .join('<br/>');
    lines.push(`| ${value} | ${formatted || ''} |`);
  });
  lines.push('');
  return lines.join('\n');
}

async function main() {
  ensureDir(REPORT_DIR);
  const [schemas, pipeline] = await Promise.all([loadSchemas(), loadPipelineMetadata()]);
  const entities = gatherEntityFields(schemas);
  const statusUniverse = new Set([
    ...pipeline.statusKeys,
    ...Object.keys(pipeline.statusAliases || {})
  ]);
  const stageUniverse = new Set([
    ...pipeline.stageKeys,
    ...pipeline.stageLabels,
    ...Object.keys(pipeline.stageAliases || {})
  ]);
  const milestoneUniverse = new Set(pipeline.milestones || []);

  const references = gatherReferences([
    ...statusUniverse,
    ...stageUniverse,
    ...milestoneUniverse
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    fields: entities,
    pipeline,
    references
  };

  const jsonPath = path.join(REPORT_DIR, 'model_status_inventory.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const mdParts = [
    '# Model + Status Inventory',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Fields',
    '',
    renderFieldMarkdown(entities),
    renderReferenceMarkdown('Statuses', Array.from(statusUniverse).sort(), references),
    renderReferenceMarkdown('Stages', Array.from(stageUniverse).sort(), references),
    renderReferenceMarkdown('Milestones', Array.from(milestoneUniverse).sort(), references)
  ];

  const mdPath = path.join(REPORT_DIR, 'model_status_inventory.md');
  fs.writeFileSync(mdPath, mdParts.join('\n'));

  const prevManifest = readJsonSafe(path.join(REPORT_DIR, 'manifest.json')) || {};
  const manifest = Object.assign({}, prevManifest, {
    lastGenerated: report.generatedAt,
    files: {
      json: path.relative(ROOT, jsonPath),
      markdown: path.relative(ROOT, mdPath)
    }
  });
  fs.writeFileSync(path.join(REPORT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  // eslint-disable-next-line no-console
  console.log(`Report written to ${path.relative(ROOT, REPORT_DIR)}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
