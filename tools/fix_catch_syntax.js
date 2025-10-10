#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const targetDir = path.join(rootDir, 'crm-app', 'js');

async function walk(dir, fileList = []) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, fileList);
    } else if (entry.isFile() && fullPath.endsWith('.js')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function applyTransformations(content, stats) {
  let updated = content;

  const transforms = [
    {
      regex: /([{,]\s*)(catch)(\s*:)/gi,
      replacer: (match, p1, _p2, p3) => `${p1}"catch"${p3}`,
    },
    {
      regex: /\.catch\s*\{([\s\S]*?)\}/g,
      replacer: (match, body) => `.catch((e)=>{${body}})`,
    },
    {
      regex: /catch\s+([_$A-Za-z][_$0-9A-Za-z]*)\s*\)\s*\{/g,
      replacer: (match, identifier, offset, source) => {
        const prevChar = offset > 0 ? source[offset - 1] : '';
        if (prevChar === '.') {
          return match;
        }
        return `catch (${identifier}) {`;
      },
    },
    {
      regex: /catch\s*\(\s*([^\)\s]*)\s*\)??\s*\{/g,
      replacer: (match, identifier, offset, source) => {
        const prevChar = offset > 0 ? source[offset - 1] : '';
        if (prevChar === '.') {
          return match;
        }
        const name = (identifier || '').trim();
        if (!name) {
          return 'catch (e) {';
        }
        if (name.startsWith('{') || name.startsWith('[')) {
          return match;
        }
        return `catch (${name}) {`;
      },
    },
    {
      regex: /\}\s*,\s*catch\s*\(/g,
      replacer: (match) => '} catch (',
    },
  ];

  for (const { regex, replacer } of transforms) {
    updated = updated.replace(regex, (...args) => {
      const replacement = replacer(...args);
      if (replacement !== args[0]) {
        stats.replacements += 1;
      }
      return replacement;
    });
  }

  return updated;
}

function getParser() {
  try {
    const babelParser = require('@babel/parser');
    return {
      name: '@babel/parser',
      parse: (code) =>
        babelParser.parse(code, {
          sourceType: 'unambiguous',
          allowReturnOutsideFunction: true,
          allowAwaitOutsideFunction: true,
          plugins: [
            'jsx',
            'classProperties',
            'classPrivateProperties',
            'classPrivateMethods',
            ['decorators', { decoratorsBeforeExport: true }],
            'dynamicImport',
            'importMeta',
            'topLevelAwait',
          ],
        }),
    };
  } catch (err) {
    try {
      const acorn = require('acorn');
      return {
        name: 'acorn',
        parse: (code) =>
          acorn.parse(code, {
            ecmaVersion: 'latest',
            sourceType: 'module',
            allowAwaitOutsideFunction: true,
            allowReturnOutsideFunction: true,
          }),
      };
    } catch (err2) {
      return null;
    }
  }
}

async function main() {
  if (!fs.existsSync(targetDir)) {
    console.error(`Target directory not found: ${targetDir}`);
    process.exit(1);
  }

  const files = await walk(targetDir);
  const parser = getParser();
  const changedFiles = [];
  let totalReplacements = 0;
  let parseSuccess = 0;
  let parseWarnings = 0;
  const parseErrors = [];

  for (const file of files) {
    const original = await fs.promises.readFile(file, 'utf8');
    const stats = { replacements: 0 };
    const transformed = applyTransformations(original, stats);

    if (transformed !== original) {
      await fs.promises.writeFile(file, transformed, 'utf8');
      changedFiles.push(path.relative(rootDir, file));
    }
    totalReplacements += stats.replacements;

    if (parser) {
      try {
        parser.parse(transformed);
        parseSuccess += 1;
      } catch (error) {
        parseWarnings += 1;
        const location = error.loc || error.position || {};
        const line = location.line || location.start && location.start.line;
        parseErrors.push(`${path.relative(rootDir, file)}: ${error.message}${line ? ` (line ${line})` : ''}`);
      }
    }
  }

  if (changedFiles.length) {
    console.log('Modified files:');
    for (const file of changedFiles) {
      console.log(` - ${file}`);
    }
  } else {
    console.log('No files were modified.');
  }

  if (parser) {
    console.log(`Fixed ${totalReplacements} occurrences; ${parseSuccess} files parsed cleanly; ${parseWarnings} parse warnings`);
    if (parseErrors.length) {
      console.log('Parse warnings:');
      for (const warning of parseErrors) {
        console.log(` - ${warning}`);
      }
    }
  } else {
    console.log(`Fixed ${totalReplacements} occurrences; parsing skipped (parser not available).`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
