#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const rootArg = process.argv[2] ? String(process.argv[2]) : process.cwd();
const serveRoot = path.resolve(rootArg);
const port = Number(process.argv[3] || process.env.PORT || 8080);

if (!Number.isFinite(port) || port <= 0) {
  console.error('[serve] Invalid port provided.');
  process.exit(1);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8'
};

function logsDir(){
  const local = process.env.LOCALAPPDATA || process.env.HOME;
  const dir = local ? path.join(local, 'CRM', 'logs') : path.join(__dirname, '..', 'CRM_logs');
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return dir;
}

function resolvePath(urlPath) {
  try {
    const decoded = decodeURIComponent(urlPath.split('?')[0]);
    let target = decoded;
    if (!target || target === '/' || target === './') {
      target = '/index.html';
    }
    const resolved = path.resolve(path.join(serveRoot, target));
    if (!resolved.startsWith(serveRoot)) {
      return null;
    }
    return resolved;
  } catch (err) {
    return null;
  }
}

const server = http.createServer((req, res) => {
  const cleanPath = (req.url || '').split('?')[0];
  if (cleanPath === '/__log') {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end();
      return;
    }
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('error', () => {
      res.statusCode = 400; res.end();
    });
    req.on('end', () => {
      const entry = (()=>{ try { return JSON.parse(body || '{}'); } catch { return { raw: String(body||'') }; }})();
      const line = JSON.stringify({ ts: Date.now(), ...entry }) + os.EOL;
      try { fs.appendFileSync(path.join(logsDir(), 'frontend.log'), line); } catch {}
      res.statusCode = 204; res.end();
    });
    return;
  }

  const url = req.url || '/';
  const filePath = resolvePath(url);
  if (!filePath) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME_TYPES[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', type);
    if (ext === '.html') {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=60');
    }
    const stream = fs.createReadStream(filePath);
    stream.on('error', (streamErr) => {
      console.error('[serve] stream error', streamErr);
      if (!res.headersSent) {
        res.statusCode = 500;
      }
      res.end('Internal Server Error');
    });
    stream.pipe(res);
  });
});

server.on('error', (err) => {
  console.error('[serve] Server error', err);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[serve] listening on http://127.0.0.1:${port}/ (root: ${serveRoot})`);
});

const shutdown = () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (err) => {
  console.error('[serve] Uncaught exception', err);
  shutdown();
});
