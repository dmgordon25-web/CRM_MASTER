# Developer Setup

## Linux prerequisites for headless Chromium (boot smoke)

The boot smoke test runs Chromium in headless mode. On Linux, install the
required shared libraries before running the smoke test locally:

```bash
sudo apt-get update && sudo apt-get install -y \
  libasound2 libatk1.0-0 libatk-bridge2.0-0 libatspi2.0-0 libc6 libdrm2 libgbm1 \
  libgtk-3-0 libnss3 libnspr4 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxdamage1 \
  libxext6 libxfixes3 libxrandr2 libxrender1 libxshmfence1 libpango-1.0-0 libcairo2 \
  libglib2.0-0 libexpat1 fonts-liberation ca-certificates
```

> Windows and macOS developers do not need this step. Our CI runners install
> these packages automatically before executing the headless smoke test.

## SAFE mode for debugging

To bootstrap the application without running PATCHES, append `?safe=1` to the
app URL or set `localStorage.SAFE` to `'1'` in the browser console. SAFE mode
still loads CORE modules and the interactive shell so you can inspect the app
without patch side effects.

Router patterns are precompiled with escaping so malformed dynamic segments fall back safely.

## Action Bar Lifecycle

Smoke tests assert a deterministic visibility contract on `[data-ui="action-bar"]`:

- Always keep the `data-visible` attribute present with the string value `"true"` or `"false"`; never drop the attribute entirely.
- Flip the flag to `"true"` only when both `selectedCount > 0` and `actionsReady === true`; otherwise leave it at `"false"`.
- Wire selection listeners idempotently and replay the current selection snapshot on subscribe so the initial render honors the active selection.

Preserve these invariants when touching selection plumbing or action registration.
