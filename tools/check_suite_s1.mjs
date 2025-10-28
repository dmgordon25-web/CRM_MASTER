import process from 'node:process';
import { hasCheck, runCheck } from './feature_check.mjs';

const SPRINT_ONE_CHECKS = [
  'manifest:audit-pass',
  'modal:partner-singleton',
  'actionbar:merge-ready',
  'lists:row-open-10x',
  'contact:modal-layout',
  'pipeline:name-column',
  'calendar:safe-grid',
  'devserver:shutdown',
  'console:zero-error-policy'
];

const results = {
  pass: 0,
  fail: 0,
  skip: 0
};

for (const name of SPRINT_ONE_CHECKS) {
  let available = false;
  try {
    available = await hasCheck(name);
  } catch (err) {
    available = false;
    console.error(`Error while probing ${name}:`, err && err.stack ? err.stack : String(err));
  }

  if (!available) {
    console.log(`SKIP ${name}`);
    results.skip += 1;
    continue;
  }

  try {
    await runCheck(name);
    console.log(`PASS ${name}`);
    results.pass += 1;
  } catch (err) {
    console.log(`FAIL ${name}`);
    console.error(err && err.stack ? err.stack : String(err));
    results.fail += 1;
  }
}

console.log(`SUMMARY pass=${results.pass} fail=${results.fail} skip=${results.skip}`);
process.exit(results.fail > 0 ? 1 : 0);
