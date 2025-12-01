#!/usr/bin/env node
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { createStaticServer } = require('./static_server.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'crm-app'));
const startPort = Number(process.env.PORT || process.argv[3] || 8080);

async function findOpenPort(port) {
  return new Promise((resolve) => {
    const server = createStaticServer(rootDir, { verbose: true });
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        server.close(() => resolve(findOpenPort(port + 1)));
      } else {
        resolve({ server, port });
      }
    });
    server.listen(port, () => resolve({ server, port }));
  });
}

const { server, port } = await findOpenPort(startPort);
console.log(`[dev-server] serving ${rootDir} on http://127.0.0.1:${port}`);
console.log('[dev-server] press Ctrl+C to stop');

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
