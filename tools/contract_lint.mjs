import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const bootRoot = path.resolve(repoRoot, 'crm-app/js/boot');

function isIdentifierBoundary(code, index) {
  if (index < 0 || index >= code.length) return true;
  const ch = code[index];
  return !(/[A-Za-z0-9_$]/.test(ch));
}

function extractLine(code, index) {
  let start = code.lastIndexOf('\n', index);
  start = start === -1 ? 0 : start + 1;
  let end = code.indexOf('\n', index);
  if (end === -1) end = code.length;
  return code.slice(start, end).trim();
}

function precededByArrow(code, index) {
  for (let i = index - 1; i >= 0 && index - i < 200; i -= 1) {
    const ch = code[i];
    if (/\s/.test(ch)) continue;
    if (ch === '>') {
      let j = i - 1;
      while (j >= 0 && /\s/.test(code[j])) j -= 1;
      return j >= 0 && code[j] === '=';
    }
    if (ch === '(' || ch === '{' || ch === '}' || ch === ';' || ch === ',') return false;
    return false;
  }
  return false;
}

function scanCode(code) {
  const domIssues = [];
  const consoleIssues = [];
  const domSeen = new Set();
  const consoleSeen = new Set();

  let state = 'CODE';
  const stateStack = [];
  const templateExprDepths = [];
  let depth = 0;
  let line = 1;
  const len = code.length;
  let i = 0;

  while (i < len) {
    const ch = code[i];

    if (state === 'LINE_COMMENT') {
      if (ch === '\n') {
        state = stateStack.pop() || 'CODE';
        line += 1;
      }
      i += 1;
      continue;
    }

    if (state === 'BLOCK_COMMENT') {
      if (ch === '\n') {
        line += 1;
        i += 1;
        continue;
      }
      if (ch === '*' && code[i + 1] === '/') {
        state = stateStack.pop() || 'CODE';
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    if (state === 'SINGLE_QUOTE') {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '\n') {
        line += 1;
        i += 1;
        continue;
      }
      if (ch === '\'') {
        state = stateStack.pop() || 'CODE';
        i += 1;
        continue;
      }
      i += 1;
      continue;
    }

    if (state === 'DOUBLE_QUOTE') {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '\n') {
        line += 1;
        i += 1;
        continue;
      }
      if (ch === '"') {
        state = stateStack.pop() || 'CODE';
        i += 1;
        continue;
      }
      i += 1;
      continue;
    }

    if (state === 'TEMPLATE') {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '`') {
        state = stateStack.pop() || 'CODE';
        i += 1;
        continue;
      }
      if (ch === '$' && code[i + 1] === '{') {
        stateStack.push('TEMPLATE');
        templateExprDepths.push(depth);
        state = 'CODE';
        i += 1;
        continue;
      }
      if (ch === '\n') {
        line += 1;
      }
      i += 1;
      continue;
    }

    // CODE state
    if (ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '\n') {
      line += 1;
      i += 1;
      continue;
    }
    if (ch === '/' && code[i + 1] === '/') {
      stateStack.push(state);
      state = 'LINE_COMMENT';
      i += 2;
      continue;
    }
    if (ch === '/' && code[i + 1] === '*') {
      stateStack.push(state);
      state = 'BLOCK_COMMENT';
      i += 2;
      continue;
    }
    if (ch === '\'') {
      stateStack.push(state);
      state = 'SINGLE_QUOTE';
      i += 1;
      continue;
    }
    if (ch === '"') {
      stateStack.push(state);
      state = 'DOUBLE_QUOTE';
      i += 1;
      continue;
    }
    if (ch === '`') {
      stateStack.push(state);
      state = 'TEMPLATE';
      i += 1;
      continue;
    }
    if (ch === '{') {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === '}') {
      if (depth > 0) depth -= 1;
      i += 1;
      if (templateExprDepths.length && depth === templateExprDepths[templateExprDepths.length - 1]) {
        templateExprDepths.pop();
        state = stateStack.pop() || 'CODE';
      }
      continue;
    }

    if (code.startsWith('console', i) && isIdentifierBoundary(code, i - 1)) {
      let j = i + 'console'.length;
      while (j < len && /\s/.test(code[j])) j += 1;
      if (code[j] === '?') {
        j += 1;
      }
      if (code[j] === '.') {
        j += 1;
        while (j < len && /\s/.test(code[j])) j += 1;
        if (code.startsWith('error', j) && isIdentifierBoundary(code, j + 'error'.length)) {
          const snippet = extractLine(code, i);
          const key = `${line}:${snippet}`;
          if (!consoleSeen.has(key)) {
            consoleSeen.add(key);
            consoleIssues.push({ line, snippet });
          }
          i = j + 'error'.length;
          continue;
        }
      }
    }

    if (depth === 0) {
      if (code.startsWith('document', i) && isIdentifierBoundary(code, i - 1)) {
        const after = code[i + 'document'.length];
        if (after === '.' || after === '[') {
          if (!precededByArrow(code, i)) {
            const snippet = extractLine(code, i);
            const key = `${line}:${snippet}`;
            if (!domSeen.has(key)) {
              domSeen.add(key);
              domIssues.push({ line, snippet, kind: 'document' });
            }
          }
        }
      } else if (code.startsWith('window', i) && isIdentifierBoundary(code, i - 1)) {
        let docIndex = -1;
        if (code[i + 'window'.length] === '.' && code.startsWith('document', i + 'window'.length + 1)) {
          docIndex = i + 'window'.length + 1;
        } else if (code.slice(i + 'window'.length, i + 'window'.length + 2) === '?.'
          && code.startsWith('document', i + 'window'.length + 2)) {
          docIndex = i + 'window'.length + 2;
        }
        if (docIndex !== -1 && isIdentifierBoundary(code, docIndex - 1)
          && isIdentifierBoundary(code, docIndex + 'document'.length)) {
          if (!precededByArrow(code, i)) {
            const snippet = extractLine(code, i);
            const key = `${line}:${snippet}`;
            if (!domSeen.has(key)) {
              domSeen.add(key);
              domIssues.push({ line, snippet, kind: 'window' });
            }
          }
        }
      }
    }

    i += 1;
  }

  return { domIssues, consoleIssues };
}

async function collectFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

function toRelative(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

export async function runContractLint({ quiet = false } = {}) {
  const files = await collectFiles(bootRoot);
  const failures = [];

  for (const file of files) {
    const code = await fs.readFile(file, 'utf8');
    const { domIssues, consoleIssues } = scanCode(code);
    const relative = toRelative(file);

    domIssues.forEach((issue) => {
      failures.push({
        type: 'dom',
        file: relative,
        line: issue.line,
        snippet: issue.snippet,
      });
    });

    if (relative.includes('/boot/contracts/')) {
      consoleIssues.forEach((issue) => {
        failures.push({
          type: 'console',
          file: relative,
          line: issue.line,
          snippet: issue.snippet,
        });
      });
    }
  }

  if (failures.length) {
    const lines = failures.map((failure) => {
      const reason = failure.type === 'dom'
        ? 'top-level DOM access'
        : 'console.error disallowed in contracts';
      return ` - ${failure.file}:${failure.line} ${reason} → ${failure.snippet}`;
    });
    console.error(`[CONTRACT LINT] FAIL\n${lines.join('\n')}`);
    const err = new Error('contract lint failed');
    err.failures = failures;
    throw err;
  }

  if (!quiet) {
    console.log('[CONTRACT LINT] PASS');
  }
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === __filename;

if (invokedDirectly) {
  runContractLint().catch((err) => {
    const message = err && err.message ? err.message : String(err);
    console.error(message);
    process.exit(1);
  });
}
