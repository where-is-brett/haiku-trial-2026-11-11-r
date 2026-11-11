// src/server.js
import fs from 'node:fs';
import http from 'node:http';
import { openLedger } from './db.js';
import { createHandler } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const db = openLedger(process.env.LEDGER_DB ?? 'ledger.db');

function readFlags() {
  try {
    const text = fs.readFileSync(new URL('../config/feature-flags.json', import.meta.url), 'utf8');
    return JSON.parse(text);
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

const server = http.createServer(createHandler({ db, flags: readFlags() }));

server.listen(port, () => {
  console.log(`listening on ${server.address().port}`);
});
