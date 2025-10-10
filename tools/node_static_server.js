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

const LOG_MAX_BYTES = 1024 * 1024;

function logsDir(){
  const base = process.env.LOCALAPPDATA || process.env.APPDATA || process.env.HOME || '.';
  const dir = path.join(base, 'CRM', 'logs');
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return dir;
}

function safeParse(s){
  try { return JSON.parse(s); } catch { return { raw: s }; }
}

function appendLogLine(entry){
  if (process.env.CRM_QUIET_LOG) return true;
  const file = path.join(logsDir(), 'frontend.log');
  try {
    fs.appendFileSync(file, JSON.stringify(entry) + os.EOL, 'utf8');
    return true;
  } catch {
    return false;
  }
}

function handleLog(req, res) {
  const origin = req.headers.origin || (req.headers.host ? `http://${req.headers.host}` : '*');
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end();
    return;
  }

  let body = '';
  let received = 0;
  let finished = false;
  req.setEncoding('utf8');

  function finish(status, message) {
    if (finished) return;
    finished = true;
    if (message) {
      res.statusCode = status;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(message);
    } else {
      res.writeHead(status);
      res.end();
    }
  }

  req.on('data', (chunk) => {
    if (finished) return;
    received += chunk.length;
    if (received > LOG_MAX_BYTES) {
      finish(413, 'Payload Too Large');
      req.destroy();
      return;
    }
    body += chunk;
  });

  req.on('error', () => finish(400, 'Invalid request'));

  req.on('end', () => {
    if (finished) return;
    const payload = body.trim() ? safeParse(body) : {};
    const entry = {
      ts: Date.now(),
      ip: req.socket && req.socket.remoteAddress ? String(req.socket.remoteAddress) : null,
      payload
    };
    if (!appendLogLine(entry)) {
      finish(500, 'Failed to write log');
      return;
    }
    finish(204);
  });
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
    handleLog(req, res);
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
