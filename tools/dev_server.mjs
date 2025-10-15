#!/usr/bin/env node
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { startServer, app } = require('./node_static_server.js');

app.get('/__shutdown', (req, res) => {
  res.statusCode = 204;
  res.end();
  setImmediate(() => {
    process.exit(0);
  });
});

function main() {
  try {
    const portArg = process.argv.length >= 3 ? process.argv[2] : undefined;
    const server = portArg ? startServer(portArg) : startServer();

    const shutdown = () => {
      try {
        server.close(() => {
          process.exit(0);
        });
      } catch (err) {
        process.exit(0);
      }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('uncaughtException', (err) => {
      console.error('[DEV SERVER] Uncaught exception', err);
      shutdown();
    });
  } catch (err) {
    console.error('[DEV SERVER] Failed to start', err);
    process.exit(1);
  }
}

main();
