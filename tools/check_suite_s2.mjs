import process from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { detectBrowserEnv } from './check_env.mjs';
import { hasCheck, runCheck } from './feature_check.mjs';

const S2 = [
  { name: 'dashboard:dnd-teardown',      kind: 'browser' },
  { name: 'actionbar:style-dedupe',      kind: 'node'    },
  { name: 'pipeline:filter-idempotent',  kind: 'browser' },
  { name: 'calendar:export-ux',          kind: 'browser' },
  { name: 'workbench:mvp',               kind: 'browser' },
  { name: 'dashboard:persistence-reset', kind: 'browser' },
  { name: 'notifications:toggle-3x',     kind: 'browser' },
  { name: 'calendar:dnd',                kind: 'browser' },
  { name: 'pipeline:status-milestone',   kind: 'browser' },
  { name: 'partners:referral-sort',      kind: 'browser' },
  { name: 'loading:uniform',             kind: 'browser' },
  { name: 'comms:missing-handler',       kind: 'browser' },
  { name: 'comms:adapter-flag',          kind: 'browser' }
];

async function runSuite() {
  const { hasBrowser, reason } = await detectBrowserEnv();
  if (hasBrowser) {
    console.log('ENV_OK: browser available; running full S2 suite');
  } else {
    console.log(`ENV_PARTIAL: browser unavailable (${reason}); running NODE subset; BROWSER checks = SKIP`);
  }

  let pass = 0;
  let skip = 0;
  let fail = 0;

  for (const check of S2) {
    if (check.kind === 'browser' && !hasBrowser) {
      console.log(`SKIP ${check.name}`);
      skip += 1;
      continue;
    }

    if (!(await hasCheck(check.name))) {
      console.log(`SKIP ${check.name}`);
      skip += 1;
      continue;
    }

    try {
      await runCheck(check.name);
      console.log(`PASS ${check.name}`);
      pass += 1;
    } catch (err) {
      console.log(`FAIL ${check.name}`);
      if (err && err.stack) {
        console.error(err.stack);
      } else {
        console.error(String(err));
      }
      fail += 1;
    }
  }

  console.log(`S2 summary: ${pass} PASS, ${skip} SKIP, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}

const modulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;

if (invokedPath === modulePath) {
  runSuite().catch((err) => {
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
  });
}
