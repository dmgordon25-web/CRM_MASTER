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
const BOOT_STAMP = '<!-- BOOT_STAMP: crm-app-index -->';
const SPLASH_BLOCK = '<div id="boot-splash" role="status" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#fff;z-index:99999"><div>Loading CRM…</div></div>';
const SPLASH_MARKER_RE = /id\s*=\s*['"]boot-splash['"]/i;
const SERVER_HEADER_NAME = 'X-CRM-Server';
const SERVER_HEADER_VALUE = 'dev';
const LOG_ENDPOINT_PATH = '/__log';
const CRM_LOG_ROOT = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'CRM', 'logs')
  : path.join(REPO_ROOT, 'logs');
const FRONTEND_LOG_PATH = path.join(CRM_LOG_ROOT, 'frontend.log');
const MAX_LOG_PAYLOAD = 64 * 1024;
const DEV_KEY = crypto.randomBytes(16).toString('hex');
const IDLE_TIMEOUT_MS = 60_000;

const activeSessions = new Map();
let idleTimer = null;

const noop = () => {};
let requestShutdown = noop;
let serverClosePromise = null;
let cleanupPromise = null;
let cleanupLogged = false;
let exitScheduled = false;
const trackedWatchers = new Set();
const trackedChildren = new Set();

function clearIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function scheduleIdleExit() {
  if (activeSessions.size > 0) {
    clearIdleTimer();
    return;
  }
  if (idleTimer) {
    return;
  }
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (activeSessions.size === 0) {
      console.info('[SERVER_EXIT] idle drain');
      requestShutdown();
    }
  }, IDLE_TIMEOUT_MS);
  if (typeof idleTimer.unref === 'function') {
    idleTimer.unref();
  }
}

function markSessionActive(sid) {
  if (!sid) return;
  activeSessions.set(sid, Date.now());
  clearIdleTimer();
}

function markSessionClosed(sid) {
  if (sid) {
    activeSessions.delete(sid);
  } else {
    activeSessions.clear();
  }
  scheduleIdleExit();
}

function trackWatcher(watcher) {
  if (!watcher) return watcher;
  if (typeof watcher.on === 'function') {
    const cleanup = () => {
      trackedWatchers.delete(watcher);
      if (typeof watcher.off === 'function') {
        try {
          watcher.off('close', cleanup);
          watcher.off('error', cleanup);
        } catch {}
      }
    };
    try { watcher.on('close', cleanup); } catch {}
    try { watcher.on('error', cleanup); } catch {}
  }
  trackedWatchers.add(watcher);
  return watcher;
}

function trackChild(child) {
  if (!child) return child;
  const cleanup = () => {
    trackedChildren.delete(child);
  };
  try { child.once('exit', cleanup); } catch {}
  try { child.once('close', cleanup); } catch {}
  trackedChildren.add(child);
  return child;
}

async function shutdownWatchers() {
  const watchers = Array.from(trackedWatchers);
  trackedWatchers.clear();
  await Promise.all(watchers.map((watcher) => new Promise((resolve) => {
    try {
      if (watcher) {
        if (typeof watcher.close === 'function') {
          watcher.close();
          resolve();
          return;
        }
        if (typeof watcher.stop === 'function') {
          Promise.resolve(watcher.stop()).catch(() => {}).finally(resolve);
          return;
        }
      }
    } catch {}
    resolve();
  })));
}

async function shutdownChildren(signal = 'SIGTERM') {
  const children = Array.from(trackedChildren);
  trackedChildren.clear();
  await Promise.all(children.map((child) => new Promise((resolve) => {
    if (!child) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
      resolve();
    }, 2000);
    if (typeof timer.unref === 'function') timer.unref();
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    try { child.once('exit', done); } catch {}
    try { child.once('close', done); } catch {}
    try {
      const killed = child.kill(signal);
      if (!killed) {
        done();
      }
    } catch {
      done();
    }
  })));
}

try {
  if (!globalThis.__CRM_DEV_SERVER__) {
    Object.defineProperty(globalThis, '__CRM_DEV_SERVER__', {
      value: {},
      configurable: true
    });
  }
  globalThis.__CRM_DEV_SERVER__.trackWatcher = trackWatcher;
  globalThis.__CRM_DEV_SERVER__.trackChild = trackChild;
} catch {}

function drainRequest(req) {
  if (!req || typeof req.resume !== 'function') return;
  req.on('error', noop);
  req.resume();
}

function getSearchParam(urlString, key) {
  if (!urlString) return '';
  try {
    const parsed = new URL(urlString, 'http://127.0.0.1');
    return parsed.searchParams.get(key) || '';
  } catch {
    return '';
  }
}

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

  const originalHtml = buffer.toString('utf8');
  let servedHtml = originalHtml;
  let mutated = false;

  const ensureStamp = () => {
    if (servedHtml.includes(BOOT_STAMP)) {
      return;
    }
    const bodyMatch = servedHtml.match(/<body[^>]*>/i);
    if (bodyMatch) {
      const insertPos = bodyMatch.index + bodyMatch[0].length;
      servedHtml = `${servedHtml.slice(0, insertPos)}\n${BOOT_STAMP}${servedHtml.slice(insertPos)}`;
    } else {
      servedHtml = `${BOOT_STAMP}\n${servedHtml}`;
    }
    mutated = true;
  };

  const findBodyStampIndex = () => {
    const bodyMatch = servedHtml.match(/<body[^>]*>/i);
    if (bodyMatch) {
      const bodyStart = bodyMatch.index + bodyMatch[0].length;
      const bodyStampIndex = servedHtml.indexOf(BOOT_STAMP, bodyStart);
      if (bodyStampIndex !== -1) {
        return bodyStampIndex;
      }
      return bodyStart;
    }
    return servedHtml.indexOf(BOOT_STAMP);
  };

  const ensureSplash = () => {
    if (SPLASH_MARKER_RE.test(servedHtml)) {
      return;
    }
    ensureStamp();
    const stampIndex = findBodyStampIndex();
    const insertPos = stampIndex === -1 ? 0 : stampIndex + BOOT_STAMP.length;
    servedHtml = `${servedHtml.slice(0, insertPos)}\n${SPLASH_BLOCK}${servedHtml.slice(insertPos)}`;
    mutated = true;
  };

  ensureStamp();
  ensureSplash();

  const servedBuffer = Buffer.from(servedHtml, 'utf8');
  const sha1 = crypto.createHash('sha1').update(buffer).digest('hex');

  return {
    indexPath,
    servedRoot,
    indexSha1: sha1,
    originalBuffer: buffer,
    servedBuffer,
    servedHtml,
    mutated
  };
}

function serveSpa(req, res) {
  try {
    const info = readIndexInfo();
    if (info.error || !info.servedBuffer) {
      send(res, 500, `crm-app/index.html not found at ${APP_INDEX}`);
      return;
    }
    const headers = {
      ...SECURITY_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': info.servedBuffer.length,
      [SERVER_HEADER_NAME]: SERVER_HEADER_VALUE
    };
    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(info.servedBuffer);
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

  if (parsed.normalized === '/__hello') {
    if (method !== 'GET') {
      send(res, 405, 'Method Not Allowed', { Allow: 'GET' });
      return;
    }
    const sid = crypto.randomBytes(16).toString('hex');
    markSessionActive(sid);
    const payload = JSON.stringify({ sid, t: new Date().toISOString() });
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      [SERVER_HEADER_NAME]: SERVER_HEADER_VALUE
    });
    res.end(payload);
    return;
  }

  if (parsed.normalized === '/__bye') {
    if (method !== 'GET' && method !== 'POST') {
      send(res, 405, 'Method Not Allowed', { Allow: 'GET, POST' });
      return;
    }
    if (method === 'POST') {
      drainRequest(req);
    }
    const sid = getSearchParam(req.url, 'sid');
    markSessionClosed(sid);
    send(res, 204, '');
    return;
  }

  if (parsed.normalized === '/__shutdown') {
    if (method !== 'GET') {
      send(res, 405, 'Method Not Allowed', { Allow: 'GET' });
      return;
    }
    const key = getSearchParam(req.url, 'key');
    if (!key || key !== DEV_KEY) {
      send(res, 403, 'Forbidden');
      return;
    }
    send(res, 200, 'OK');
    setImmediate(() => requestShutdown());
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
      time: new Date().toISOString(),
      devKey: DEV_KEY
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
    if (info.error || !info.servedBuffer) {
      send(res, 500, 'Failed to read index.html');
      return;
    }
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': info.servedBuffer.length,
      [SERVER_HEADER_NAME]: SERVER_HEADER_VALUE
    });
    res.end(info.servedBuffer);
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
    if (path.resolve(filePath) === APP_INDEX && (parsed.normalized === '/' || parsed.normalized === '')) {
      serveSpa(req, res);
      return;
    }
    serveStream(req, res, filePath, stats);
    return;
  }

  if (shouldSpaFallback(method, normalized || '/', hasExtension || false)) {
    serveSpa(req, res);
    return;
  }

  send(res, 404, 'Not Found');
});

function closeServer(){
  if(serverClosePromise) return serverClosePromise;
  serverClosePromise = new Promise((resolve) => {
    try {
      if(!server.listening){
        resolve();
        return;
      }
      server.close(() => resolve());
    } catch {
      resolve();
    }
  });
  return serverClosePromise;
}

function logClosedOnce(){
  if(cleanupLogged) return;
  cleanupLogged = true;
  console.info('DEV_SERVER: closed');
}

function cleanupAll(){
  if(cleanupPromise) return cleanupPromise;
  cleanupPromise = (async () => {
    clearIdleTimer();
    activeSessions.clear();
    try {
      await shutdownChildren('SIGTERM');
    } catch {}
    try {
      await shutdownWatchers();
    } catch {}
    try {
      await closeServer();
    } catch {}
    logClosedOnce();
  })();
  return cleanupPromise;
}

function exitProcess(code = 0){
  if(exitScheduled) return cleanupPromise || Promise.resolve();
  exitScheduled = true;
  const fallback = setTimeout(() => {
    logClosedOnce();
    process.exit(code);
  }, 4000);
  if(typeof fallback.unref === 'function') fallback.unref();
  cleanupAll().finally(() => {
    clearTimeout(fallback);
    process.exit(code);
  });
  return cleanupPromise;
}

requestShutdown = () => exitProcess(0);

console.info('[VIS] shutdown endpoints ready');

['SIGINT', 'SIGTERM'].forEach((sig) => {
  process.once(sig, () => {
    exitProcess(0);
  });
});

process.once('beforeExit', () => {
  cleanupAll().catch(() => {});
});

process.once('exit', () => {
  logClosedOnce();
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
    const child = spawn('cmd.exe', ['/c', 'start', '', url], {
      stdio: 'ignore',
      detached: true,
      windowsHide: true
    });
    trackChild(child);
    if (typeof child.unref === 'function') child.unref();
  } catch {
    try {
      const child = spawn('explorer.exe', [url], {
        stdio: 'ignore',
        detached: true,
        windowsHide: true
      });
      trackChild(child);
      if (typeof child.unref === 'function') child.unref();
    } catch {}
  }
}

async function start() {
  const preflight = readIndexInfo();
  if (preflight && preflight.error) {
    const indexPath = path.resolve(preflight.indexPath || APP_INDEX);
    const message = preflight.error && preflight.error.message ? preflight.error.message : String(preflight.error);
    console.error(`[DEV SERVER] Failed to read index (${message}) at ${indexPath}`);
    throw preflight.error;
  }
  if (!preflight || !preflight.servedHtml || !preflight.servedHtml.includes(BOOT_STAMP)) {
    console.error('[DEV SERVER] BOOT_STAMP missing from served index');
    process.exit(3);
    return;
  }
  const port = await bindServer();
  const url = `http://127.0.0.1:${port}/`;
  console.info(`[SERVER] listening on ${url} (root: ${REPO_ROOT})`);

  const shouldOpen = process.platform === 'win32'
    && process.env.CI !== 'true'
    && process.env.CRM_SKIP_AUTO_OPEN !== '1';
  if (shouldOpen) {
    openBrowser(url);
  }

  requestShutdown = () => exitProcess(0);

  server.on('error', (err) => {
    const message = err && err.message ? err.message : String(err);
    console.info(`[DEV SERVER] ${message}`);
  });
}

start().catch((err) => {
  const message = err && err.message ? err.message : String(err);
  console.error(`[DEV SERVER] ${message}`);
  process.exitCode = 1;
});
