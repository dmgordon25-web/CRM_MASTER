#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(__dirname, 'boot_smoke_test.mjs');

const child = spawn(process.execPath, [script], { stdio: 'inherit' });
child.on('exit', (code) => {
  if (code !== 0) process.exit(code);
});
