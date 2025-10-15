import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WEBROOT = process.env.WEBROOT
  ? path.resolve(process.env.WEBROOT)
  : path.resolve(__dirname, '../crm-app');

const INDEX_HTML = path.join(WEBROOT, 'index.html');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const isCI = Boolean(process.env.CI || process.env.GITHUB_ACTIONS || process.env.SMOKE);
const isWindows = process.platform === 'win32';

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : String(body ?? '');
  res.writeHead(status, {
    'Cache-Control': 'no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    ...headers
  });
  res.end(payload);
}

function serveFile(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

  const headers = {
    'Content-Type': contentType,
    'Cache-Control': 'no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  if (req.method === 'HEAD') {
    res.writeHead(200, headers);
    res.end();
    return;
  }

  const stream = fs.createReadStream(filePath);

  stream.on('open', () => {
    res.writeHead(200, headers);
  });

  stream.on('error', () => {
    if (!res.headersSent) {
      send(res, 404, 'Not found');
    } else {
      res.end();
    }
  });

  stream.pipe(res);
}

function spaFallback(req, res) {
  if (!fs.existsSync(INDEX_HTML)) {
    send(res, 500, `[SERVER] index.html missing at ${INDEX_HTML}`);
    return;
  }
  serveFile(req, res, INDEX_HTML);
}

function isShutdownRequest(req) {
  if (!req.url || req.method !== 'GET') return false;
  const parsed = new URL(req.url, 'http://127.0.0.1');
  return parsed.pathname === '/__shutdown';
}

function safeResolve(targetPath) {
  const normalised = path.posix.normalize(targetPath || '/');
  const trimmed = normalised === '/' ? '' : normalised.replace(/^\/+/, '');
  const absolute = path.resolve(WEBROOT, trimmed);
  const relative = path.relative(WEBROOT, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return absolute;
}

const server = http.createServer((req, res) => {
  try {
    if (isShutdownRequest(req)) {
      send(res, 200, 'bye');
      if (!isCI) {
        setImmediate(() => process.exit(0));
      }
      return;
    }

    const requestUrl = req.url ? new URL(req.url, 'http://127.0.0.1') : new URL('http://127.0.0.1/');
    const pathname = decodeURIComponent(requestUrl.pathname || '/');
    const absolutePath = safeResolve(pathname);

    if (!absolutePath) {
      spaFallback(req, res);
      return;
    }

    let stat = null;
    try {
      stat = fs.statSync(absolutePath);
    } catch (error) {
      stat = null;
    }

    if (stat && stat.isDirectory()) {
      const directoryIndex = path.join(absolutePath, 'index.html');
      if (fs.existsSync(directoryIndex)) {
        serveFile(req, res, directoryIndex);
        return;
      }
      spaFallback(req, res);
      return;
    }

    if (stat && stat.isFile()) {
      serveFile(req, res, absolutePath);
      return;
    }

    spaFallback(req, res);
  } catch (error) {
    send(res, 500, '[SERVER] request handling error');
  }
});

function openBrowser(url) {
  try {
    spawn('cmd', ['/c', 'start', '', url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    }).unref();
  } catch (error) {
    // Best effort only; failure should not crash the dev server.
  }
}

async function findFreePort(start, end) {
  for (let port = start; port <= end; port += 1) {
    const available = await new Promise((resolve) => {
      const tester = http.createServer();
      tester.once('error', () => resolve(false));
      tester.once('listening', () => {
        tester.close(() => resolve(true));
      });
      tester.listen(port, '127.0.0.1');
    });
    if (available) {
      return port;
    }
  }
  throw new Error(`No free port available between ${start} and ${end}`);
}

function ensureWebroot() {
  if (!fs.existsSync(WEBROOT)) {
    throw new Error(`WEBROOT missing: ${WEBROOT}`);
  }
}

async function startServer() {
  ensureWebroot();

  const port = isCI
    ? 8080
    : (process.env.PORT ? Number(process.env.PORT) : await findFreePort(8087, 8099));

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('Invalid port configuration');
  }

  const rootUrl = `http://127.0.0.1:${port}/`;
  const appUrl = `${rootUrl}index.html#/`;

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });

  server.on('error', (err) => {
    console.error(`[SERVER] ${err && err.message ? err.message : err}`);
    process.exit(1);
  });

  console.log(`[SERVER] listening on ${rootUrl} (root: ${WEBROOT})`);

  if (isCI) {
    return;
  }

  if (isWindows) {
    console.log('[SERVER] server: node:http');
    console.log(`[SERVE] URL : ${appUrl}`);
    try {
      openBrowser(appUrl);
    } catch (error) {
      // Non-fatal if the browser fails to open.
    }
  }
}

startServer().catch((error) => {
  console.error(`[SERVER] ${error && error.message ? error.message : error}`);
  process.exit(1);
});
