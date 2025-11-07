import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
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
const IDLE_TIMEOUT_MS = 5_000;
const PID_FILE = path.join(REPO_ROOT, '.devserver.pid');

// ---------------------------------------------------------------------------
// NOTE: The Windows "Start CRM" launchers spin up this file in a hidden
// PowerShell host. Those shortcuts assume that only one dev server instance
// can exist at a time: a second launch must detect the running PID and exit
// cleanly after printing a hint for how to attach to it. Keep the single-
// instance guard behaviour in sync with the launcher scripts.
// ---------------------------------------------------------------------------

const activeSessions = new Map();
let idleTimer = null;
const trackedTimeouts = [];
const registeredProcessListeners = [];

const noop = () => {};
let requestShutdown = noop;
let cleanupLogged = false;

function trackTimeoutHandle(handle) {
  if (!handle) return handle;
  if (!trackedTimeouts.includes(handle)) {
    trackedTimeouts.push(handle);
  }
  return handle;
}

function untrackTimeoutHandle(handle, { cancel = true } = {}) {
  if (!handle) return;
  const index = trackedTimeouts.indexOf(handle);
  if (index !== -1) {
    trackedTimeouts.splice(index, 1);
  }
  if (cancel) {
    try { clearTimeout(handle); } catch {}
  }
}

function clearTrackedTimeoutHandles() {
  if (trackedTimeouts.length === 0) return;
  while (trackedTimeouts.length > 0) {
    const handle = trackedTimeouts.pop();
    try { clearTimeout(handle); } catch {}
  }
}

function registerProcessListener(event, listener, { keepDuringCleanup = false } = {}) {
  if (!event || typeof listener !== 'function') return listener;
  try {
    process.on(event, listener);
    registeredProcessListeners.push([event, listener, keepDuringCleanup]);
  } catch {}
  return listener;
}

function removeRegisteredProcessListeners() {
  if (registeredProcessListeners.length === 0) return;
  for (let i = registeredProcessListeners.length - 1; i >= 0; i -= 1) {
    const [event, listener, keepDuringCleanup] = registeredProcessListeners[i];
    if (keepDuringCleanup) {
      continue;
    }
    registeredProcessListeners.splice(i, 1);
    try {
      if (typeof process.off === 'function') {
        process.off(event, listener);
      } else {
        process.removeListener(event, listener);
      }
    } catch {}
  }
}

function logClosedOnce() {
  if (cleanupLogged) return;
  cleanupLogged = true;
  console.info('DEV_SERVER: closed');
}

function clearIdleTimer() {
  if (idleTimer) {
    untrackTimeoutHandle(idleTimer);
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
  const timeout = setTimeout(() => {
    untrackTimeoutHandle(timeout, { cancel: false });
    if (idleTimer === timeout) {
      idleTimer = null;
    }
    if (activeSessions.size === 0) {
      console.info('[SERVER_EXIT] idle drain');
      requestShutdown();
    }
  }, IDLE_TIMEOUT_MS);
  trackTimeoutHandle(timeout);
  if (typeof timeout.unref === 'function') {
    timeout.unref();
  }
  idleTimer = timeout;
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

async function requestExistingDevServerShutdown(port, key) {
  if (!Number.isFinite(port) || port <= 0) return false;
  if (!key || typeof key !== 'string') return false;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(!!result);
    };
    try {
      const req = http.get({
        hostname: '127.0.0.1',
        port,
        path: `/__shutdown?key=${encodeURIComponent(key)}`
      }, (res) => {
        try { res.resume(); }
        catch {}
        finish(res.statusCode >= 200 && res.statusCode < 300);
      });
      req.on('error', () => finish(false));
      req.setTimeout(1500, () => {
        try { req.destroy(); }
        catch {}
        finish(false);
      });
    } catch {
      finish(false);
    }
  });
}

class ShutdownManager {
  constructor({ pidFile, beforeShutdown, afterShutdown } = {}) {
    this.pidFile = pidFile;
    this.beforeShutdown = beforeShutdown;
    this.afterShutdown = afterShutdown;
    this.server = null;
    this.sockets = new Set();
    this.watchers = [];
    this.intervals = [];
    this.childPidMeta = new Map();
    this.shuttingDown = false;
    this.shutdownPromise = null;
    this.exitCode = 0;
  }

  setServer(server) {
    this.server = server;
    if (!server) {
      return;
    }
    server.keepAliveTimeout = 1000;
    server.headersTimeout = 1500;
    server.on('connection', (socket) => {
      if (!socket) return;
      this.sockets.add(socket);
      const remove = () => {
        this.sockets.delete(socket);
      };
      try { socket.on('close', remove); } catch {}
      try { socket.on('end', remove); } catch {}
      try { socket.on('error', remove); } catch {}
    });
  }

  trackWatcher(watcher) {
    if (!watcher) return watcher;
    if (!this.watchers.includes(watcher)) {
      this.watchers.push(watcher);
    }
    const remove = () => {
      const index = this.watchers.indexOf(watcher);
      if (index !== -1) {
        this.watchers.splice(index, 1);
      }
    };
    if (typeof watcher.once === 'function') {
      try { watcher.once('close', remove); } catch {}
      try { watcher.once('error', remove); } catch {}
    } else if (typeof watcher.on === 'function') {
      try { watcher.on('close', remove); } catch {}
      try { watcher.on('error', remove); } catch {}
    }
    return watcher;
  }

  trackInterval(interval) {
    if (!interval) return interval;
    if (!this.intervals.includes(interval)) {
      this.intervals.push(interval);
    }
    const clear = () => {
      const index = this.intervals.indexOf(interval);
      if (index !== -1) {
        this.intervals.splice(index, 1);
      }
    };
    try {
      if (typeof interval.once === 'function') {
        interval.once('close', clear);
        interval.once('error', clear);
      }
    } catch {}
    return interval;
  }

  trackChild(child, options = {}) {
    if (!child || typeof child.pid !== 'number') return child;
    this.trackChildPid(child.pid, options);
    const cleanup = () => {
      this.childPidMeta.delete(child.pid);
    };
    try { child.once('exit', cleanup); } catch {}
    try { child.once('close', cleanup); } catch {}
    return child;
  }

  trackChildPid(pid, options = {}) {
    if (!Number.isFinite(pid) || pid <= 0) return pid;
    const meta = {
      detached: Boolean(options && options.detached)
    };
    this.childPidMeta.set(pid, meta);
    return pid;
  }

  destroySockets() {
    const sockets = Array.from(this.sockets);
    this.sockets.clear();
    for (const socket of sockets) {
      try { socket.destroy(); } catch {}
    }
  }

  stopIntervals() {
    if (this.intervals.length === 0) return;
    const intervals = this.intervals.splice(0, this.intervals.length);
    for (const interval of intervals) {
      try { clearInterval(interval); } catch {}
    }
  }

  async stopWatchers() {
    if (this.watchers.length === 0) return;
    const watchers = this.watchers.splice(0, this.watchers.length);
    await Promise.all(watchers.map((watcher) => new Promise((resolve) => {
      if (!watcher) {
        resolve();
        return;
      }
      try {
        if (typeof watcher.close === 'function') {
          watcher.close();
          resolve();
          return;
        }
        if (typeof watcher.stop === 'function') {
          Promise.resolve(watcher.stop()).catch(() => {}).finally(resolve);
          return;
        }
      } catch {}
      resolve();
    })));
  }

  async closeServer() {
    if (!this.server) return;
    const server = this.server;
    this.server = null;
    await new Promise((resolve) => {
      try {
        if (!server.listening) {
          resolve();
          return;
        }
        server.close(() => resolve());
      } catch {
        resolve();
      }
    });
  }

  async stopChildPid(pid, meta) {
    if (!Number.isFinite(pid) || pid <= 0) return;
    if (process.platform === 'win32') {
      await new Promise((resolve) => {
        try {
          const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
            stdio: 'ignore',
            windowsHide: true
          });
          const done = () => resolve();
          try { killer.once('exit', done); } catch {}
          try { killer.once('close', done); } catch {}
          try { killer.once('error', done); } catch {}
        } catch {
          resolve();
        }
      });
      return;
    }
    try {
      if (meta && meta.detached) {
        process.kill(-pid, 'SIGTERM');
      } else {
        process.kill(pid, 'SIGTERM');
      }
    } catch (error) {
      if (!error || (error.code !== 'ESRCH' && error.code !== 'EINVAL')) {
        try { process.kill(pid, 'SIGTERM'); } catch {}
      }
    }
  }

  async stopChildren() {
    if (this.childPidMeta.size === 0) return;
    const entries = Array.from(this.childPidMeta.entries());
    this.childPidMeta.clear();
    await Promise.all(entries.map(([pid, meta]) => this.stopChildPid(pid, meta)));
  }

  removePidFile() {
    if (!this.pidFile) return;
    try {
      fs.unlinkSync(this.pidFile);
    } catch (error) {
      if (!error || error.code !== 'ENOENT') {
        // ignore
      }
    }
  }

  writePidFile(meta = {}) {
    if (!this.pidFile) return;
    const record = {
      pid: process.pid,
      updatedAt: new Date().toISOString()
    };
    const candidatePort = Number.parseInt(meta && meta.port, 10);
    if (Number.isFinite(candidatePort) && candidatePort > 0) {
      record.port = candidatePort;
    }
    const devKey = meta && typeof meta.devKey === 'string' ? meta.devKey : null;
    if (devKey) {
      record.devKey = devKey;
    }
    fs.writeFileSync(this.pidFile, JSON.stringify(record), 'utf8');
  }

  isPidAlive(pid) {
    if (!Number.isFinite(pid) || pid <= 0) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      if (error && error.code === 'EPERM') {
        return true;
      }
      return false;
    }
  }

  async killPidTree(pid) {
    if (process.platform === 'win32') {
      await this.stopChildPid(pid, {});
      return;
    }
    try {
      process.kill(-pid, 'SIGTERM');
    } catch (error) {
      if (error && error.code === 'ESRCH') {
        return;
      }
      if (error && error.code === 'EPERM') {
        try { process.kill(pid, 'SIGTERM'); } catch {}
        return;
      }
      try { process.kill(pid, 'SIGTERM'); } catch {}
    }
  }

  async waitForPidDeath(pid, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    while (this.isPidAlive(pid) && Date.now() < deadline) {
      await delay(200);
    }
  }

  async ensureSingleInstance() {
    if (!this.pidFile) return;
    let existingRaw;
    try {
      existingRaw = fs.readFileSync(this.pidFile, 'utf8').trim();
    } catch (error) {
      if (!error || error.code === 'ENOENT') {
        return;
      }
      throw error;
    }
    let existingPid = Number.NaN;
    let existingPort = Number.NaN;
    let existingKey = null;
    try {
      const parsed = JSON.parse(existingRaw);
      existingPid = Number.parseInt(parsed && parsed.pid, 10);
      existingPort = Number.parseInt(parsed && parsed.port, 10);
      if (parsed && typeof parsed.devKey === 'string') {
        existingKey = parsed.devKey;
      }
    } catch {
      existingPid = Number.parseInt(existingRaw, 10);
    }

    if (!Number.isFinite(existingPid) || existingPid <= 0 || existingPid === process.pid) {
      this.removePidFile();
      return;
    }
    if (!this.isPidAlive(existingPid)) {
      this.removePidFile();
      return;
    }
    let stillAlive = true;
    let graceful = false;
    if (existingKey && Number.isFinite(existingPort) && existingPort > 0) {
      try {
        const ok = await requestExistingDevServerShutdown(existingPort, existingKey);
        if (ok) {
          graceful = true;
          await this.waitForPidDeath(existingPid, 4000);
        }
      } catch {}
    }
    stillAlive = this.isPidAlive(existingPid);
    if (stillAlive) {
      try {
        await this.killPidTree(existingPid);
        await this.waitForPidDeath(existingPid, 4000);
      } catch {}
      stillAlive = this.isPidAlive(existingPid);
    }
    if (!stillAlive) {
      console.info('[DEV SERVER] reclaimed stale server process before boot.');
      this.removePidFile();
      return;
    }
    const attachPort = Number.isFinite(existingPort) && existingPort > 0 ? existingPort : null;
    const attachUrl = attachPort ? `http://127.0.0.1:${attachPort}/` : null;
    if (graceful) {
      console.info(`[DEV SERVER] previous instance (pid ${existingPid}) did not exit cleanly; unable to reclaim automatically.`);
    } else {
      console.info(`[DEV SERVER] existing instance already running (pid ${existingPid}).`);
    }
    if (attachUrl) {
      console.info(`[DEV SERVER] attach: ${attachUrl}`);
    } else {
      console.info('[DEV SERVER] attach: open the running dev server in your browser.');
    }
    console.info('[DEV SERVER] exiting without starting a new instance.');
    process.exit(0);
  }

  async shutdown(code = 0, { skipExit = false } = {}) {
    if (this.shuttingDown) {
      if (typeof code === 'number' && code > this.exitCode) {
        this.exitCode = code;
      }
      return this.shutdownPromise;
    }
    this.exitCode = typeof code === 'number' ? code : 0;
    this.shuttingDown = true;
    this.shutdownPromise = (async () => {
      try {
        if (typeof this.beforeShutdown === 'function') {
          try { await this.beforeShutdown(); } catch {}
        }
        try { this.stopIntervals(); } catch {}
        try { await this.stopWatchers(); } catch {}
        try { clearTrackedTimeoutHandles(); } catch {}
        try { await this.closeServer(); } catch {}
        this.destroySockets();
        try { await this.stopChildren(); } catch {}
      } finally {
        try { removeRegisteredProcessListeners(); } catch {}
        try { this.removePidFile(); } catch {}
        if (typeof this.afterShutdown === 'function') {
          try { this.afterShutdown(); } catch {}
        }
        const fuse = setTimeout(() => process.exit(0), 1500);
        if (typeof fuse.unref === 'function') fuse.unref();
        if (!skipExit) {
          const exitCode = typeof this.exitCode === 'number' ? this.exitCode : 0;
          setImmediate(() => process.exit(exitCode));
        }
      }
    })();
    return this.shutdownPromise;
  }
}

const shutdownManager = new ShutdownManager({
  pidFile: PID_FILE,
  beforeShutdown: async () => {
    clearIdleTimer();
    activeSessions.clear();
  },
  afterShutdown: () => {
    logClosedOnce();
  }
});

function trackWatcher(watcher) {
  return shutdownManager.trackWatcher(watcher);
}

function trackInterval(interval) {
  return shutdownManager.trackInterval(interval);
}

function trackChild(child, options) {
  return shutdownManager.trackChild(child, options);
}

function trackChildPid(pid, options) {
  return shutdownManager.trackChildPid(pid, options);
}

requestShutdown = () => shutdownManager.shutdown(0);

try {
  if (!globalThis.__CRM_DEV_SERVER__) {
    Object.defineProperty(globalThis, '__CRM_DEV_SERVER__', {
      value: {},
      configurable: true
    });
  }
  globalThis.__CRM_DEV_SERVER__.trackWatcher = trackWatcher;
  globalThis.__CRM_DEV_SERVER__.trackInterval = trackInterval;
  globalThis.__CRM_DEV_SERVER__.trackChild = trackChild;
  globalThis.__CRM_DEV_SERVER__.trackChildPid = trackChildPid;
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
  'Content-Security-Policy': "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; object-src 'none'"
};

const SECURITY_HEADERS_NO_CSP = {
  'Cache-Control': 'no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

// Helper to get appropriate security headers based on path
function getSecurityHeaders(filePath) {
  // Skip CSP for Lab files - they have their own CSP meta tag
  if (filePath && filePath.includes('/labs/')) {
    return SECURITY_HEADERS_NO_CSP;
  }
  return SECURITY_HEADERS;
}

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
    ...getSecurityHeaders(filePath),
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
    
    // If this is the last session closing, initiate shutdown after a short delay
    if (activeSessions.size === 0) {
      console.info('[SERVER] Last session closed, scheduling shutdown...');
      setTimeout(() => {
        if (activeSessions.size === 0) {
          requestShutdown();
        }
      }, 2000);
    }
    
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

shutdownManager.setServer(server);

console.info('[VIS] shutdown endpoints ready');

['SIGINT', 'SIGTERM', 'SIGBREAK', 'SIGHUP'].forEach((sig) => {
  registerProcessListener(sig, () => {
    shutdownManager.shutdown(0).catch(() => {});
  });
});

registerProcessListener('beforeExit', () => {
  shutdownManager.shutdown(0, { skipExit: true }).catch(() => {});
});

registerProcessListener('exit', () => {
  logClosedOnce();
}, { keepDuringCleanup: true });

registerProcessListener('uncaughtException', (error) => {
  if (error) {
    console.error('[DEV SERVER] uncaughtException', error);
  }
  shutdownManager.shutdown(1).catch(() => {});
});

registerProcessListener('unhandledRejection', (reason) => {
  if (reason) {
    console.error('[DEV SERVER] unhandledRejection', reason);
  }
  shutdownManager.shutdown(1).catch(() => {});
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

function parseCliArgs(argv) {
  const parsed = {
    port: null
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if ((token === '--port' || token === '-p') && i + 1 < argv.length) {
      const value = Number.parseInt(argv[i + 1], 10);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`Invalid --port value: ${argv[i + 1]}`);
      }
      parsed.port = value;
      i += 1;
    }
  }
  return parsed;
}

async function bindServer(preferredPort = null) {
  if (Number.isFinite(preferredPort) && preferredPort > 0) {
    try {
      await listenOnPort(preferredPort);
      return preferredPort;
    } catch (error) {
      if (error && error.code === 'EADDRINUSE') {
        throw new Error(`Requested port ${preferredPort} is already in use`);
      }
      throw error;
    }
  }

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
    trackChild(child, { detached: true });
    if (typeof child.unref === 'function') child.unref();
  } catch {
    try {
      const child = spawn('explorer.exe', [url], {
        stdio: 'ignore',
        detached: true,
        windowsHide: true
      });
      trackChild(child, { detached: true });
      if (typeof child.unref === 'function') child.unref();
    } catch {}
  }
}

async function killOrphanedNodeProcesses() {
  if (process.platform !== 'win32') return;
  
  console.info('[CLEANUP] Checking for orphaned Node.js processes...');
  
  try {
    // Find all node processes running dev_server.mjs
    const findProc = spawn('tasklist', ['/FI', 'IMAGENAME eq node.exe', '/FO', 'CSV', '/NH'], {
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true
    });
    
    const output = findProc.stdout ? findProc.stdout.toString() : '';
    const lines = output.split('\n').filter(line => line.includes('node.exe'));
    
    for (const line of lines) {
      const match = line.match(/"(\d+)"/);
      if (match && match[1]) {
        const pid = parseInt(match[1], 10);
        if (pid === process.pid) continue; // Don't kill ourselves
        
        // Try to kill orphaned node processes
        try {
          const killProc = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
            stdio: 'ignore',
            windowsHide: true
          });
          if (killProc.status === 0) {
            console.info(`[CLEANUP] Killed orphaned node process (PID ${pid})`);
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn('[CLEANUP] Could not check for orphaned processes:', err.message);
  }
}

async function start() {
  const cli = parseCliArgs(process.argv);
  
  // Kill any orphaned processes from previous runs before starting
  await killOrphanedNodeProcesses();
  
  await shutdownManager.ensureSingleInstance();
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
  const port = await bindServer(cli.port);
  shutdownManager.writePidFile({ port, devKey: DEV_KEY });
  const url = `http://127.0.0.1:${port}/`;
  console.info(`[SERVER] listening on ${url} (root: ${REPO_ROOT})`);

  const shouldOpen = process.platform === 'win32'
    && process.env.CI !== 'true'
    && process.env.CRM_SKIP_AUTO_OPEN !== '1';
  if (shouldOpen) {
    openBrowser(url);
  }

  server.on('error', (err) => {
    const message = err && err.message ? err.message : String(err);
    console.info(`[DEV SERVER] ${message}`);
  });
}

start().catch((err) => {
  const message = err && err.message ? err.message : String(err);
  console.error(`[DEV SERVER] ${message}`);
  shutdownManager.removePidFile();
  process.exitCode = 1;
});
