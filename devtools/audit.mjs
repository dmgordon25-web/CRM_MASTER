#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function runScript(relativePath) {
  const scriptPath = path.join(repoRoot, relativePath);

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], { stdio: 'inherit' });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${relativePath} exited with code ${code}`));
    });
  });
}

try {
  await runScript('tools/manifest_audit.js');
  await runScript('tools/feature_check.mjs');
  console.log('[audit] OK: manifest + feature checks passed');
} catch (error) {
  console.error(`[audit] FAIL: ${error.message || error}`);
  process.exit(1);
}
