const http = require('http');
const path = require('path');
const fs = require('fs');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function isPathInside(parent, child) {
  const rel = path.relative(parent, child);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

function resolvePath(root, requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath.split('?')[0]);
  } catch {
    return null;
  }
  const clean = decoded === '/' ? '/index.html' : decoded;
  const stripped = clean.replace(/^\/+/, '');
  const candidate = path.join(root, stripped);
  return candidate;
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  fs.createReadStream(filePath).pipe(res);
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

function createStaticServer(root, { verbose = true } = {}) {
  const base = path.resolve(root);

  const server = http.createServer((req, res) => {
    const { method = 'GET', url = '/' } = req;
    let pathname;
    try {
      pathname = new URL(url, 'http://localhost').pathname;
    } catch {
      return send(res, 400, 'Bad Request');
    }

    if (pathname === '/health' || pathname === '/healthz') {
      return send(res, 200, 'OK');
    }

    if (pathname === '/__log') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        const msg = body ? body.toString() : '';
        if (verbose) console.log('[__log]', msg);
        send(res, 200, 'logged');
      });
      return;
    }

    if (method !== 'GET' && method !== 'HEAD') {
      return send(res, 405, 'Method Not Allowed', { 'Allow': 'GET, HEAD' });
    }

    let filePath = resolvePath(base, pathname);
    if (!filePath) {
      return send(res, 400, 'Bad Request');
    }
    if (!isPathInside(base, filePath)) {
      return send(res, 403, 'Forbidden');
    }

    fs.stat(filePath, (err, stat) => {
      if (!err && stat.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      fs.stat(filePath, (innerErr, innerStat) => {
        if (!innerErr && innerStat.isFile()) {
          return serveFile(res, filePath);
        }

        const fallback = path.join(base, 'index.html');
        fs.stat(fallback, (fbErr, fbStat) => {
          if (!fbErr && fbStat.isFile()) {
            if (verbose) {
              console.warn(`[static-server] fallback to index for ${pathname}`);
            }
            return serveFile(res, fallback);
          }
          send(res, 404, 'Not Found');
        });
      });
    });
  });

  return server;
}

module.exports = { createStaticServer };
