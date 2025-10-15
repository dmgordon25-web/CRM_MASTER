import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Resolve WEBROOT relative to this file so it works from any folder
const WEBROOT = process.env.WEBROOT
  ? path.resolve(process.env.WEBROOT)
  : path.resolve(__dirname, '../crm-app');

const INDEX = path.join(WEBROOT, 'index.html');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico':  'image/x-icon',
  '.map':  'application/json; charset=utf-8',
};

function send(res, code, body, headers = {}) {
  res.writeHead(code, {
    'Cache-Control': 'no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    ...headers
  });
  res.end(body);
}

function serveFile(res, filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const stream = fs.createReadStream(filePath);
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    stream.pipe(res);
  } catch {
    send(res, 404, 'Not found');
  }
}

function spaFallback(res) {
  if (!fs.existsSync(INDEX)) {
    return send(res, 500, `[DEV SERVER] index.html missing at ${INDEX}`);
  }
  serveFile(res, INDEX);
}

// Basic static server with SPA fallback and a dev-only shutdown
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/__shutdown') {
    send(res, 200, 'bye');
    setTimeout(() => process.exit(0), 10);
    return;
  }

  const raw = (req.url || '/').split('?')[0].split('#')[0] || '/';
  let rel = decodeURIComponent(raw);
  if (rel.length > 1 && rel.endsWith('/')) rel = rel.slice(0, -1);

  const filePath = path.join(WEBROOT, rel);
  try {
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        const dirIndex = path.join(filePath, 'index.html');
        return fs.existsSync(dirIndex) ? serveFile(res, dirIndex) : spaFallback(res);
      }
      if (stat.isFile()) return serveFile(res, filePath);
    }
    return spaFallback(res);
  } catch {
    return spaFallback(res);
  }
});

async function findPort(start, attempts = 13) {
  for (let p = start; p < start + attempts; p++) {
    try {
      await new Promise((resolve, reject) => {
        const t = http.createServer()
          .once('error', reject)
          .once('listening', function () { this.close(resolve); })
          .listen(p, '127.0.0.1');
      });
      return p;
    } catch {}
  }
  throw new Error(`No free port found starting at ${start}`);
}

function openBrowser(url) {
  try {
    // Use shell so Windows default-browser changes don't break us
    spawn('cmd.exe', ['/c', 'start', '""', url], { stdio: 'ignore', windowsHide: true, detached: true });
  } catch {
    try {
      spawn('explorer.exe', [url], { stdio: 'ignore', windowsHide: true, detached: true });
    } catch {}
  }
}

(async () => {
  if (!fs.existsSync(WEBROOT)) {
    console.error('[DEV] WEBROOT missing:', WEBROOT);
    process.exit(1);
  }
  if (!fs.existsSync(INDEX)) {
    console.warn('[DEV] index.html not found at', INDEX);
  }

  const IS_CI  = !!(process.env.CI || process.env.GITHUB_ACTIONS || process.env.SMOKE);
  const WINDEV = process.platform === 'win32' && !IS_CI;

  const port = IS_CI
    ? Number(process.env.PORT || 8080)
    : Number(process.env.PORT || await findPort(8087));

  const urlRoot = `http://127.0.0.1:${port}/`;
  const urlApp  = `${urlRoot}index.html#/`;

  server.listen(port, '127.0.0.1', () => {
    // Keep CI log signature stable for the smoke harness
    console.log(`[SERVER] listening on ${urlRoot} (root: ${WEBROOT})`);
    console.log('[SERVER] server: node:http');
    if (WINDEV) { try { openBrowser(urlApp); } catch {} }
  });

  server.on('error', (e) => {
    console.error('[DEV SERVER] error:', e && e.message ? e.message : e);
    process.exit(1);
  });
})();
