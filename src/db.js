// src/db.js
import { DatabaseSync } from 'node:sqlite';

export function openLedger(file) {
  const db = new DatabaseSync(file);
  db.exec(
    'CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY, date TEXT, description TEXT, cents INTEGER)',
  );
  return db;
}
