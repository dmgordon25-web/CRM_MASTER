import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const APP_INDEX = path.join(REPO_ROOT, 'crm-app', 'index.html');
const APP_ROOT = path.dirname(APP_INDEX);
const SERVER_HEADER_NAME = 'X-CRM-Server';
const SERVER_HEADER_VALUE = 'dev';
const LOG_ENDPOINT_PATH = '/__log';
const CRM_LOG_ROOT = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'CRM', 'logs')
  : path.join(REPO_ROOT, 'logs');
const FRONTEND_LOG_PATH = path.join(CRM_LOG_ROOT, 'frontend.log');
const MAX_LOG_PAYLOAD = 64 * 1024;

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function toPosix(urlPath = '/') {
  const qIndex = urlPath.indexOf('?');
  const hIndex = urlPath.indexOf('#');
  const end = Math.min(qIndex === -1 ? urlPath.length : qIndex, hIndex === -1 ? urlPath.length : hIndex);
  let cleaned = urlPath.slice(0, end) || '/';
  try {
    cleaned = decodeURIComponent(cleaned);
  } catch {
    return { error: 400 };
  }
  cleaned = cleaned.replace(/\\/g, '/');
  if (!cleaned.startsWith('/')) cleaned = `/${cleaned}`;
  const normalized = path.posix.normalize(cleaned);
  if (normalized === '/' || normalized === '') {
    return {
      normalized: '/',
      filePath: APP_INDEX,
      hasExtension: false
    };
  }
  const relativePath = normalized.slice(1);
  const candidate = path.join(REPO_ROOT, relativePath);
  const relative = path.relative(REPO_ROOT, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return { error: 403 };
  }
  return {
    normalized,
    filePath: candidate,
    hasExtension: path.extname(relativePath) !== ''
  };
}

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Content-Security-Policy': "script-src 'self' 'unsafe-inline'; object-src 'none'"
};

function send(res, statusCode, body, extraHeaders = {}) {
  const headers = {
    ...SECURITY_HEADERS,
    'Content-Type': 'text/plain; charset=utf-8',
    [SERVER_HEADER_NAME]: SERVER_HEADER_VALUE,
    ...extraHeaders
  };
  res.writeHead(statusCode, headers);
  res.end(body);
}

function handleLogPost(req, res) {
  let body = '';
  let aborted = false;
  req.setEncoding('utf8');

  const abort = (status, message) => {
    if (aborted) return;
    aborted = true;
    send(res, status, message);
  };

  req.on('data', (chunk) => {
    if (aborted) return;
    body += chunk;
    if (body.length > MAX_LOG_PAYLOAD) {
      abort(413, 'Payload Too Large');
      req.destroy();
    }
  });

  req.on('error', () => {
    if (aborted) return;
    aborted = true;
    if (!res.headersSent) {
      send(res, 400, 'Bad Request');
    } else {
      res.destroy();
    }
  });

  req.on('end', () => {
    if (aborted) return;
    const trimmed = body.trim();
    if (!trimmed) {
      send(res, 204, '');
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      send(res, 400, 'Invalid JSON');
      return;
    }

    const line = `${JSON.stringify(parsed)}\n`;
    try {
      fs.mkdirSync(path.dirname(FRONTEND_LOG_PATH), { recursive: true });
      fs.appendFileSync(FRONTEND_LOG_PATH, line, 'utf8');
    } catch {
      send(res, 500, 'Failed to write log');
      return;
    }

    send(res, 204, '');
  });
}

function serveStream(req, res, filePath, stats) {
  const ext = path.extname(filePath).toLowerCase();
  const headers = {
    ...SECURITY_HEADERS,
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    [SERVER_HEADER_NAME]: SERVER_HEADER_VALUE
  };
  if (stats && stats.isFile()) {
    headers['Content-Length'] = stats.size;
  }
  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) {
      send(res, 500, 'Internal Server Error');
    } else {
      res.destroy();
    }
  });
  stream.pipe(res);
}

function getRootIndexPath() {
  const parsed = toPosix('/') || {};
  if (parsed.error) {
    throw new Error('unable to resolve root index');
  }
  return parsed.filePath || APP_INDEX;
}

function readIndexInfo() {
  const indexPath = getRootIndexPath();
  const servedRoot = path.dirname(indexPath);
  let buffer;
  try {
    buffer = fs.readFileSync(indexPath);
  } catch (error) {
    return { error, indexPath, servedRoot };
  }
  const html = buffer.toString('utf8');
  const sha1 = crypto.createHash('sha1').update(buffer).digest('hex');
  const containsBootStamp = html.includes('<!-- BOOT_STAMP: crm-app-index -->');
  return {
    indexPath,
    indexSha1: sha1,
    indexContainsBootStamp: containsBootStamp,
    buffer,
    html,
    servedRoot
  };
}

function guardBootStampOnStartup() {
  const info = readIndexInfo();
  if (info.error) {
    const indexPath = path.resolve(info.indexPath || APP_INDEX);
    const root = path.resolve(info.servedRoot || APP_ROOT);
    const message = info.error && info.error.message ? info.error.message : String(info.error);
    console.error(`[DEV SERVER] Failed to read index (${message}) at ${indexPath}`);
    throw info.error;
  }
  if (!info.indexContainsBootStamp) {
    const indexPath = path.resolve(info.indexPath || APP_INDEX);
    const root = path.resolve(info.servedRoot || APP_ROOT);
    console.log(`[BOOT_GUARD] INDEX_MISMATCH root=${root} index=${indexPath}`);
    process.exit(3);
    return null;
  }
  return info;
}

function sendIndexMismatch(res, info) {
  const mismatchBody = [
    '<!doctype html><meta charset="utf-8"><title>INDEX_MISMATCH</title>',
    '<pre>Dev server misconfigured. Expected BOOT_STAMP not found.',
    `servedRoot=${info.servedRoot} indexPath=${info.indexPath}</pre>`
  ].join('\n');
  res.writeHead(503, {
    ...SECURITY_HEADERS,
    'Content-Type': 'text/html; charset=utf-8',
    [SERVER_HEADER_NAME]: SERVER_HEADER_VALUE
  });
  res.end(mismatchBody);
}

function serveSpa(req, res) {
  try {
    const info = readIndexInfo();
    if (info.error) {
      send(res, 500, `crm-app/index.html not found at ${APP_INDEX}`);
      return;
    }
    if (!info.indexContainsBootStamp) {
      sendIndexMismatch(res, info);
      return;
    }
    const headers = {
      ...SECURITY_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': info.buffer.length,
      [SERVER_HEADER_NAME]: SERVER_HEADER_VALUE
    };
    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(info.buffer);
  } catch {
    send(res, 500, `crm-app/index.html not found at ${APP_INDEX}`);
  }
}

function shouldSpaFallback(method, normalized, hasExtension) {
  if (method !== 'GET' && method !== 'HEAD') return false;
  if (normalized === '/') return true;
  if (normalized === '/crm-app' || normalized.startsWith('/crm-app/')) return true;
  if (!hasExtension && normalized.startsWith('/crm-app')) return true;
  return false;
}

const server = http.createServer((req, res) => {
  const method = (req.method || 'GET').toUpperCase();
  const parsed = toPosix(req.url || '/');
  if (parsed.error === 400) {
    send(res, 400, 'Bad Request');
    return;
  }
  if (parsed.error === 403) {
    send(res, 403, 'Forbidden');
    return;
  }

  if (parsed.normalized === LOG_ENDPOINT_PATH) {
    if (method === 'POST') {
      handleLogPost(req, res);
    } else {
      send(res, 204, '');
    }
    return;
  }

  if (parsed.normalized === '/__whoami') {
    if (method !== 'GET') {
      send(res, 405, 'Method Not Allowed', { Allow: 'GET' });
      return;
    }
    const info = readIndexInfo();
    if (info.error) {
      send(res, 500, 'Failed to read index.html');
      return;
    }
    const body = JSON.stringify({
      cwd: process.cwd(),
      servedRoot: info.servedRoot || APP_ROOT,
      indexPath: info.indexPath,
      indexSha1: info.indexSha1,
      time: new Date().toISOString()
    });
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      [SERVER_HEADER_NAME]: SERVER_HEADER_VALUE
    });
    res.end(body);
    return;
  }

  if (parsed.normalized === '/__raw_root') {
    if (method !== 'GET') {
      send(res, 405, 'Method Not Allowed', { Allow: 'GET' });
      return;
    }
    const info = readIndexInfo();
    if (info.error || !info.buffer) {
      send(res, 500, 'Failed to read index.html');
      return;
    }
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': info.buffer.length,
      [SERVER_HEADER_NAME]: SERVER_HEADER_VALUE
    });
    res.end(info.buffer);
    return;
  }

  if (method !== 'GET' && method !== 'HEAD') {
    send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
    return;
  }

  let { filePath, normalized, hasExtension } = parsed;
  let stats;
  if (filePath) {
    try {
      stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        const indexPath = path.join(filePath, 'index.html');
        const indexStats = fs.statSync(indexPath);
        if (indexStats.isFile()) {
          filePath = indexPath;
          stats = indexStats;
        } else {
          filePath = null;
        }
      } else if (!stats.isFile()) {
        filePath = null;
      }
    } catch {
      filePath = null;
    }
  }

  if ((!filePath || !stats || !stats.isFile())
    && normalized
    && normalized !== '/'
    && !normalized.startsWith('/crm-app')) {
    const fallbackNormalized = path.posix.normalize(`/crm-app${normalized}`);
    if (fallbackNormalized === '/crm-app' || fallbackNormalized.startsWith('/crm-app/')) {
      const fallbackPath = path.join(REPO_ROOT, fallbackNormalized.slice(1));
      try {
        const fallbackStats = fs.statSync(fallbackPath);
        if (fallbackStats.isDirectory()) {
          const indexPath = path.join(fallbackPath, 'index.html');
          const indexStats = fs.statSync(indexPath);
          if (indexStats.isFile()) {
            filePath = indexPath;
            stats = indexStats;
            normalized = fallbackNormalized;
          }
        } else if (fallbackStats.isFile()) {
          filePath = fallbackPath;
          stats = fallbackStats;
          normalized = fallbackNormalized;
        }
      } catch {}
    }
  }

  if (filePath && stats && stats.isFile()) {
    serveStream(req, res, filePath, stats);
    return;
  }

  if (shouldSpaFallback(method, normalized || '/', hasExtension || false)) {
    serveSpa(req, res);
    return;
  }

  send(res, 404, 'Not Found');
});

function listenOnPort(port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      server.removeListener('listening', onListen);
      reject(err);
    };
    const onListen = () => {
      server.removeListener('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListen);
    server.listen(port, '127.0.0.1');
  });
}

async function bindServer() {
  const inCi = process.env.CI === 'true';
  const basePort = 8080;
  const attempts = inCi ? 1 : 10;
  let lastError;
  for (let i = 0; i < attempts; i++) {
    const candidate = basePort + i;
    try {
      await listenOnPort(candidate);
      return candidate;
    } catch (error) {
      lastError = error;
      if (!inCi && error && error.code === 'EADDRINUSE' && i + 1 < attempts) {
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error('Unable to bind dev server');
}

function openBrowser(url) {
  try {
    spawn('cmd.exe', ['/c', 'start', '', url], {
      stdio: 'ignore',
      detached: true,
      windowsHide: true
    });
  } catch {
    try {
      spawn('explorer.exe', [url], {
        stdio: 'ignore',
        detached: true,
        windowsHide: true
      });
    } catch {}
  }
}

async function start() {
  guardBootStampOnStartup();
  const port = await bindServer();
  const url = `http://127.0.0.1:${port}/`;
  console.log(`[SERVER] listening on ${url} (root: ${REPO_ROOT})`);

  const shouldOpen = process.platform === 'win32'
    && process.env.CI !== 'true'
    && process.env.CRM_SKIP_AUTO_OPEN !== '1';
  if (shouldOpen) {
    openBrowser(url);
  }

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };

  ['SIGINT', 'SIGTERM'].forEach((sig) => {
    process.on(sig, shutdown);
  });

  server.on('error', (err) => {
    const message = err && err.message ? err.message : String(err);
    console.error(`[DEV SERVER] ${message}`);
  });
}

start().catch((err) => {
  const message = err && err.message ? err.message : String(err);
  console.error(`[DEV SERVER] ${message}`);
  process.exitCode = 1;
});
