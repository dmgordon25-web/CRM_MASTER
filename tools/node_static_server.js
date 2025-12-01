#!/usr/bin/env node
const path = require('path');
const { createStaticServer } = require('./static_server.js');

const rootDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..', 'crm-app');
const port = Number(process.argv[3] || process.env.PORT || 8080);

const server = createStaticServer(rootDir);

server.listen(port, () => {
  console.log(`[static-server] serving ${rootDir} on http://127.0.0.1:${port}`);
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
