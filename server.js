#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const rootDir = __dirname;
const appDir = path.join(rootDir, 'crm-app');

function parsePort(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--port') {
      const candidate = Number.parseInt(argv[i + 1], 10);
      if (Number.isInteger(candidate) && candidate >= 0 && candidate < 65536) {
        return candidate;
      }
    }
  }

  const envPort = Number.parseInt(process.env.PORT || '', 10);
  if (Number.isInteger(envPort) && envPort >= 0 && envPort < 65536) {
    return envPort;
  }

  return 8080;
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function safeFilePathFromUrl(requestUrl) {
  const parsed = new URL(requestUrl, 'http://127.0.0.1');
  const pathname = decodeURIComponent(parsed.pathname);
  const normalized = path.posix.normalize(pathname);
  const relative = normalized.replace(/^\/+/, '');
  const targetPath = relative ? path.join(appDir, relative) : path.join(appDir, 'index.html');
  const resolved = path.resolve(targetPath);

  if (!resolved.startsWith(path.resolve(appDir) + path.sep) && resolved !== path.resolve(appDir)) {
    return null;
  }

  return resolved;
}

function serveFile(filePath, res, fallbackToIndex) {
  fs.stat(filePath, (statErr, stats) => {
    if (!statErr && stats.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      return serveFile(indexPath, res, fallbackToIndex);
    }

    if (!statErr && stats.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.statusCode = 200;
      res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
      const stream = fs.createReadStream(filePath);
      stream.on('error', () => {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('500 Internal Server Error');
      });
      return stream.pipe(res);
    }

    if (fallbackToIndex) {
      const indexPath = path.join(appDir, 'index.html');
      return fs.readFile(indexPath, (indexErr, data) => {
        if (indexErr) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('500 Internal Server Error');
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(data);
      });
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('404 Not Found');
    return null;
  });
}

const requestedPort = parsePort(process.argv.slice(2));

const server = http.createServer((req, res) => {
  const parsed = new URL(req.url || '/', 'http://127.0.0.1');
  if (parsed.pathname === '/health') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('ok');
    return;
  }

  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('405 Method Not Allowed');
    return;
  }

  const filePath = safeFilePathFromUrl(parsed.pathname);
  if (!filePath) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('400 Bad Request');
    return;
  }

  const isAssetRequest = path.extname(filePath) !== '';
  serveFile(filePath, res, !isAssetRequest);
});

server.listen(requestedPort, '127.0.0.1', () => {
  const address = server.address();
  const boundPort = typeof address === 'object' && address ? address.port : requestedPort;
  process.stdout.write(`LISTENING http://127.0.0.1:${boundPort}\n`);
});

server.on('error', (err) => {
  process.stderr.write(`Server error: ${err.message}\n`);
  process.exit(1);
});
