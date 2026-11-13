// tests/month-rows.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb } from './helpers.js';
import { listMonthRows, monthTotal } from '../src/lib/months.js';

function addRow(db, date, description, cents) {
  db.prepare('INSERT INTO transactions (date, description, cents) VALUES (?, ?, ?)').run(date, description, cents);
}

test('only the rows of that month are listed, first and last day included', () => {
  const db = freshDb();
  addRow(db, '2026-08-31', 'Last day', 100);
  addRow(db, '2026-09-01', 'Next month', 200);
  addRow(db, '2026-08-01', 'First day', 300);
  const rows = listMonthRows(db, '2026-08');
  assert.deepEqual(rows.map((row) => row.description), ['First day', 'Last day']);
});

test('the total is the sum of signed cents', () => {
  const db = freshDb();
  addRow(db, '2026-08-02', 'Rent', 4000);
  addRow(db, '2026-08-03', 'Refund', -4000);
  assert.equal(monthTotal(listMonthRows(db, '2026-08')), 0);
});

test('a month with no rows has a zero total', () => {
  const db = freshDb();
  assert.deepEqual(listMonthRows(db, '2026-07'), []);
  assert.equal(monthTotal([]), 0);
});
