# Testing & Tooling

## Continuous Integration
- Run all unit tests (same command used by CI):
  - `npm run ci`
- Run the focused unit suite locally with config output:
  - `npm run test:unit`

## Optional smoke test
- Chromium smoke flow (not part of CI):
  - `npm run e2e:smoke`

## Browser runtime dependencies
- Before running any Chromium-based automation (including `npm run test:boot`), install the required system libraries and
  bundled browser binaries:
  - `npx playwright install-deps chromium`
  - `npx playwright install chromium`
  These commands ensure the Puppeteer/Playwright Chromium builds have the GTK/ATK and NSS stacks available on a fresh
  machine so the smoke tests can launch the browser process without missing shared libraries.

## Playwright CI stability
- CI runs add Chromium launch flags (`--disable-dev-shm-usage`, `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-gpu`)
  to reduce intermittent launch crashes in containerized environments (see `playwright.config.js`).

## Feature gate & proof artifact
- Local parity with CI (stamped HTML, Hello dialog, splash hide, avatar persistence, screenshot capture):
  - `npm run check:features`
- The command launches the guarded dev server, verifies `/__whoami` and `/__raw_root`, walks through the profile avatar flow,
  reloads to confirm persistence, and captures `proofs/feature-proof.png` for the CI artifact upload. The image is generated on
  demand and excluded from version control so local and remote environments consume the same bytes served during verification.

## Static sweep
- Generate orphan/dup listener report and refresh `reports/orphan_report.*`:
  - `npm run sweep`
- Pre-commit guard (strict mode, also wired to `npm run precommit`):
  - `npm run sweep -- --strict`

## Cleaning up a stuck server
- Windows (PowerShell): `Get-Process -Name python,py,node | Stop-Process -Force`
- macOS/Linux: `lsof -ti:8080 | xargs kill -9`
- The launchers (`Start-CRM.bat` / `Start-CRM.command`) now stop their helper servers automatically when the shell exits, but the commands above will free port 8080 if a process is left behind.
