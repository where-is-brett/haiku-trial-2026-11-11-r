// tests/helpers.js
import http from 'node:http';
import { openLedger } from '../src/db.js';

export function freshDb() {
  return openLedger(':memory:');
}

export async function withServer(handler, fn) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    server.closeAllConnections();
  }
}
