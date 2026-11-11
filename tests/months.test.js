// tests/months.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb } from './helpers.js';
import { listMonths } from '../src/lib/months.js';

function addRows(db, dates) {
  const insert = db.prepare('INSERT INTO transactions (date, description, cents) VALUES (?, ?, ?)');
  for (const date of dates) insert.run(date, 'Row', 100);
}

test('months are newest first across a year boundary', () => {
  const db = freshDb();
  addRows(db, ['2026-12-03', '2027-01-04', '2026-11-20']);
  assert.deepEqual(listMonths(db), [
    { month: '2027-01', count: 1 },
    { month: '2026-12', count: 1 },
    { month: '2026-11', count: 1 },
  ]);
});

test('a month is read from the first seven characters of the date', () => {
  const db = freshDb();
  addRows(db, ['2026-08-31', '2026-08-01', '2026-08-15']);
  assert.deepEqual(listMonths(db), [{ month: '2026-08', count: 3 }]);
});

test('a month with one transaction is listed', () => {
  const db = freshDb();
  addRows(db, ['2026-09-05']);
  assert.deepEqual(listMonths(db), [{ month: '2026-09', count: 1 }]);
});

test('an empty ledger lists no months', () => {
  assert.deepEqual(listMonths(freshDb()), []);
});
