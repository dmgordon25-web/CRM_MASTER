'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CONTACTS_PATH = path.join(REPO_ROOT, 'crm-app', 'js', 'contacts.js');
const MERGE_UI_PATH = path.join(REPO_ROOT, 'crm-app', 'js', 'patch_2025-09-27_merge_ui.js');
const REPORTS_DIR = path.join(REPO_ROOT, 'reports');
const JSON_OUT = path.join(REPORTS_DIR, 'dump_fields.json');
const MD_OUT = path.join(REPORTS_DIR, 'dump_fields.md');

function readFileSyncSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read ${filePath}: ${error.message}`);
  }
}

function splitTopLevelEntries(source) {
  const entries = [];
  let depth = 0;
  let current = '';
  let inString = false;
  let stringQuote = '';
  let prevChar = '';

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    current += ch;
    if (inString) {
      if (ch === stringQuote && prevChar !== '\\') {
        inString = false;
        stringQuote = '';
      }
    } else {
      if (ch === '\'' || ch === '"' || ch === '`') {
        inString = true;
        stringQuote = ch;
      } else if (ch === '{' || ch === '[') {
        depth += 1;
      } else if (ch === '}' || ch === ']') {
        depth = Math.max(0, depth - 1);
      } else if (ch === ',' && depth === 0) {
        const trimmed = current.slice(0, -1).trim();
        if (trimmed) entries.push(trimmed);
        current = '';
        prevChar = ch;
        continue;
      }
    }
    prevChar = ch;
  }

  const tail = current.trim();
  if (tail) entries.push(tail);
  return entries;
}

function parseObjectLiteralEntries(block) {
  const entries = [];
  const trimmed = block.trim().replace(/^[{\[]|[}\]]$/g, '');
  if (!trimmed) return entries;
  splitTopLevelEntries(trimmed).forEach((snippet) => {
    const clean = snippet.trim();
    if (clean) entries.push(clean);
  });
  return entries;
}

function parseStaticFieldDefs(source) {
  const match = source.match(/const\s+STATIC_FIELD_DEFS\s*=\s*\[([\s\S]*?)\]\s*;/);
  if (!match) return [];
  const body = match[1];
  const items = splitTopLevelEntries(body);
  return items.map((item) => {
    const keyMatch = item.match(/key\s*:\s*'([^']+)'/);
    const labelMatch = item.match(/label\s*:\s*'([^']+)'/);
    const typeMatch = item.match(/type\s*:\s*'([^']+)'/);
    const normalizeMatch = item.match(/normalize\s*:\s*([^,}]+)/);
    const allowCustom = /allowCustom\s*:\s*true/.test(item);
    const hidden = /hidden\s*:\s*true/.test(item);

    let normalizer = null;
    if (normalizeMatch) {
      const raw = normalizeMatch[1].trim();
      if (/^[a-zA-Z0-9_.$]+$/.test(raw)) {
        normalizer = raw;
      } else if (raw) {
        normalizer = 'inline';
      }
    }

    return {
      name: keyMatch ? keyMatch[1] : null,
      label: labelMatch ? labelMatch[1] : null,
      type: typeMatch ? typeMatch[1] : null,
      normalizer,
      allowCustom,
      hidden
    };
  }).filter((entry) => entry.name);
}

function buildIdPropertyMap(source) {
  const match = source.match(/const\s+u\s*=\s*Object\.assign\(\{\},\s*c,\s*\{([\s\S]*?)\}\);/);
  if (!match) return { byId: new Map(), byProp: new Map() };
  const body = match[1];
  const idRegex = /\$\('#c-([^']+)'/g;
  const byId = new Map();
  const byProp = new Map();
  let m;
  while ((m = idRegex.exec(body))) {
    const id = `c-${m[1]}`;
    const slice = body.slice(0, m.index);
    const lastComma = slice.lastIndexOf(',');
    const lastBrace = slice.lastIndexOf('{');
    const start = Math.max(lastComma, lastBrace);
    const segment = slice.slice(start + 1).trim();
    const colon = segment.indexOf(':');
    if (colon === -1) continue;
    const prop = segment.slice(0, colon).trim();
    if (!prop) continue;
    if (!byProp.has(prop)) byProp.set(prop, new Set());
    byProp.get(prop).add(id);
    if (!byId.has(id)) byId.set(id, new Set());
    byId.get(id).add(prop);
  }
  return {
    byId,
    byProp
  };
}

function parseRequiredIds(source) {
  const markupMatch = source.match(/body\.innerHTML\s*=\s*`([\s\S]*?)`;/);
  if (!markupMatch) return new Set();
  const markup = markupMatch[1];
  const required = new Set();
  const regex = /<label[^>]*data-required="true"[^>]*>[\s\S]*?id="c-([^"]+)"/g;
  let match;
  while ((match = regex.exec(markup))) {
    required.add(`c-${match[1]}`);
  }
  return required;
}

function parseValueLabelArray(source, constName) {
  const regex = new RegExp(`const\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*;`);
  const match = source.match(regex);
  if (!match) return [];
  const entries = splitTopLevelEntries(match[1]);
  return entries.map((entry) => {
    const valueMatch = entry.match(/value\s*:\s*'([^']+)'/);
    const labelMatch = entry.match(/label\s*:\s*'([^']+)'/);
    return {
      value: valueMatch ? valueMatch[1] : null,
      label: labelMatch ? labelMatch[1] : null
    };
  }).filter((item) => item.value && item.label);
}

function parseStringArray(source, constName) {
  const regex = new RegExp(`const\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*;`);
  const match = source.match(regex);
  if (!match) return [];
  const body = match[1];
  return splitTopLevelEntries(body)
    .map((item) => item.replace(/^['"]|['"]$/g, '').trim())
    .filter(Boolean);
}

function parseDocStages(source) {
  const match = source.match(/const\s+DOC_STAGES\s*=\s*\[([\s\S]*?)\]\s*;/);
  if (!match) return [];
  return splitTopLevelEntries(match[1]).map((entry) => {
    const valueMatch = entry.match(/value\s*:\s*'([^']+)'/);
    const labelMatch = entry.match(/label\s*:\s*'([^']+)'/);
    return {
      value: valueMatch ? valueMatch[1] : null,
      label: labelMatch ? labelMatch[1] : null
    };
  }).filter((item) => item.value && item.label);
}

function parseStringMap(source, constName) {
  const regex = new RegExp(`const\\s+${constName}\\s*=\\s*\{([\\s\\S]*?)\}\\s*;`);
  const match = source.match(regex);
  if (!match) return {};
  const body = match[1];
  const entries = splitTopLevelEntries(body);
  const map = {};
  entries.forEach((entry) => {
    const pair = entry.split(':');
    if (pair.length < 2) return;
    const key = pair[0].trim().replace(/^['"]|['"]$/g, '');
    const value = pair.slice(1).join(':').trim().replace(/^['"]|['"]$/g, '');
    if (key) map[key] = value;
  });
  return map;
}

function formatMarkdownTable(rows, headers) {
  const headerLine = `| ${headers.join(' | ')} |`;
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  const data = rows.map((row) => `| ${row.join(' | ')} |`);
  return [headerLine, separator, ...data].join('\n');
}

function escapeMd(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, '<br>');
}

function ensureReportsDir() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

function buildFields(staticDefs, idMap, requiredIds) {
  const fields = staticDefs.map((entry) => {
    const domIds = [];
    if (entry.name && idMap.byProp.has(entry.name)) {
      domIds.push(...Array.from(idMap.byProp.get(entry.name)));
    }
    const required = domIds.some((id) => requiredIds.has(id));
    const normalizers = entry.normalizer ? [entry.normalizer] : [];
    const flags = {};
    if (entry.hidden) flags.hidden = true;
    if (entry.allowCustom) flags.allowCustom = true;
    return {
      name: entry.name,
      label: entry.label,
      type: entry.type,
      domIds,
      validation: {
        required,
        normalizers,
        flags
      },
      usedBy: ['contact-modal', 'merge-ui']
    };
  });

  idMap.byProp.forEach((ids, prop) => {
    if (fields.some((field) => field.name === prop)) return;
    const domIds = Array.from(ids);
    const required = domIds.some((id) => requiredIds.has(id));
    fields.push({
      name: prop,
      label: prop.replace(/([A-Z])/g, ' $1').replace(/^./, (ch) => ch.toUpperCase()),
      type: 'text',
      domIds,
      validation: {
        required,
        normalizers: [],
        flags: {}
      },
      usedBy: ['contact-modal']
    });
  });

  fields.sort((a, b) => a.name.localeCompare(b.name));
  return fields;
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function writeMarkdown(filePath, payload) {
  const lines = [];
  lines.push('# CRM Field & Automation Dump');
  lines.push('');
  lines.push(`Generated: ${payload.generatedAt}`);
  lines.push('');

  lines.push('## Fields');
  lines.push('');
  const fieldRows = payload.fields.map((field) => {
    const required = field.validation.required ? 'Yes' : '';
    const normalizers = field.validation.normalizers.join(', ');
    const usedBy = field.usedBy.join(', ');
    return [
      escapeMd(field.name),
      escapeMd(field.label || ''),
      escapeMd(field.type || ''),
      escapeMd(required),
      escapeMd(normalizers),
      escapeMd(usedBy)
    ];
  });
  lines.push(formatMarkdownTable(fieldRows, ['Field', 'Label', 'Type', 'Required', 'Normalizers', 'Used By']));
  lines.push('');

  lines.push('## Statuses');
  lines.push('');
  const statusRows = payload.statuses.statuses.map((item) => [escapeMd(item.value), escapeMd(item.label)]);
  lines.push(formatMarkdownTable(statusRows, ['Status', 'Label']));
  lines.push('');

  lines.push('## Stages');
  lines.push('');
  const stageRows = payload.statuses.stages.map((item) => [escapeMd(item.value), escapeMd(item.label)]);
  lines.push(formatMarkdownTable(stageRows, ['Stage', 'Label']));
  lines.push('');

  lines.push('## Document Stages');
  lines.push('');
  const docRows = payload.statuses.docStages.map((item) => [escapeMd(item.value), escapeMd(item.label)]);
  lines.push(formatMarkdownTable(docRows, ['Doc Stage', 'Label']));
  lines.push('');

  lines.push('## Pipeline Milestones');
  lines.push('');
  const milestoneRows = payload.statuses.pipelineMilestones.map((item) => [escapeMd(item)]);
  lines.push(formatMarkdownTable(milestoneRows, ['Milestone']));
  lines.push('');

  lines.push('## Automation Hooks');
  lines.push('');
  const automationRows = Object.entries(payload.automationHooks).map(([stage, desc]) => [escapeMd(stage), escapeMd(desc)]);
  lines.push(formatMarkdownTable(automationRows, ['Stage', 'Automation']));
  lines.push('');

  fs.writeFileSync(filePath, lines.join('\n'));
}

function main() {
  const contactsSource = readFileSyncSafe(CONTACTS_PATH);
  const mergeSource = readFileSyncSafe(MERGE_UI_PATH);

  const staticDefs = parseStaticFieldDefs(mergeSource);
  const idMap = buildIdPropertyMap(contactsSource);
  const requiredIds = parseRequiredIds(contactsSource);

  const fields = buildFields(staticDefs, idMap, requiredIds);

  const statuses = parseValueLabelArray(contactsSource, 'STATUSES');
  const stages = parseValueLabelArray(contactsSource, 'STAGES');
  const docStages = parseDocStages(contactsSource);
  const pipelineMilestones = parseStringArray(contactsSource, 'PIPELINE_MILESTONES');
  const automationHooks = parseStringMap(contactsSource, 'STAGE_AUTOMATIONS');

  const payload = {
    generatedAt: new Date().toISOString(),
    sources: {
      contacts: path.relative(REPO_ROOT, CONTACTS_PATH),
      mergeUi: path.relative(REPO_ROOT, MERGE_UI_PATH)
    },
    fields,
    statuses: {
      statuses,
      stages,
      docStages,
      pipelineMilestones
    },
    automationHooks
  };

  ensureReportsDir();
  writeJson(JSON_OUT, payload);
  writeMarkdown(MD_OUT, payload);

  console.info(`Wrote ${path.relative(REPO_ROOT, JSON_OUT)} and ${path.relative(REPO_ROOT, MD_OUT)}`);
}

main();
