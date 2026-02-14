#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

const auditScript = path.join(__dirname, 'manifest_audit.js');
const result = spawnSync(process.execPath, [auditScript], { stdio: 'inherit' });

if (result.error) {
  console.error('precommit_check: failed to execute manifest audit');
  console.error(result.error);
  process.exit(2);
}

process.exit(result.status ?? 1);
