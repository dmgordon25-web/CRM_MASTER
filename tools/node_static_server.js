#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStaticServer } = require('./static_server.js');

const rootDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..', 'crm-app');
const port = Number(process.argv[3] || process.env.PORT || 8080);
const host = process.env.HOST || '127.0.0.1';
const logFile = process.env.STATIC_SERVER_LOG || path.join(os.tmpdir(), 'playwright-static-server.log');

function logLine(message, error) {
  const detail = error instanceof Error ? `${error.stack || error.message}` : (error ? String(error) : '');
  const line = detail ? `${message} ${detail}` : message;
  const output = `[static-server] ${line}`;
  console.log(output);
  try {
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${output}\n`, 'utf8');
  } catch {
    // Ignore file system write failures for diagnostics logs.
  }
}

const server = createStaticServer(rootDir);

server.on('error', (error) => {
  logLine('server error', error);
});

server.on('clientError', (error, socket) => {
  if (error && error.code !== 'ECONNRESET' && error.code !== 'EPIPE') {
    logLine('clientError', error);
  }
  if (socket && !socket.destroyed) {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  }
});

server.listen(port, host, () => {
  logLine(`LISTENING ${host}:${port} root=${rootDir} log=${logFile}`);
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('SIGHUP', () => {
  logLine('SIGHUP ignored');
});

process.on('uncaughtException', (error) => {
  if (error && error.code !== 'ECONNRESET' && error.code !== 'EPIPE') {
    logLine('uncaughtException', error);
  }
});

process.on('unhandledRejection', (reason) => {
  if (reason && reason.code !== 'ECONNRESET' && reason.code !== 'EPIPE') {
    logLine('unhandledRejection', reason);
  }
});

if (process.stdin && typeof process.stdin.resume === 'function') {
  process.stdin.resume();
  process.stdin.on('error', (error) => {
    if (error && error.code !== 'EPIPE' && error.code !== 'ECONNRESET') {
      logLine('stdin error', error);
    }
  });
}
