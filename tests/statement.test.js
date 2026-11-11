// tests/statement.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { parseStatement, importStatement } from '../src/lib/statement.js';

const SAMPLE = fs.readFileSync(new URL('../data/sample-statement.csv', import.meta.url), 'utf8');

function freshDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE transactions (id INTEGER PRIMARY KEY, date TEXT, description TEXT, cents INTEGER)');
  return db;
}
const count = (db) => db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n;

test('a row is read as date, description and cents', () => {
  assert.deepEqual(parseStatement('Date,Description,Amount\r\n02/08/2026,Kestrel Coffee Bar,6.50\r\n'), [
    { date: '2026-08-02', description: 'Kestrel Coffee Bar', cents: 650 },
  ]);
});

test('a minus sign gives negative cents', () => {
  const [row] = parseStatement('Date,Description,Amount\n25/08/2026,Brightwave Payroll,-2100.00\n');
  assert.equal(row.cents, -210000);
});

test('a quoted thousands separator is read as the full amount', () => {
  const [row] = parseStatement('Date,Description,Amount\n01/08/2026,Rent,"1,234.00"\n');
  assert.equal(row.cents, 123400);
});

test('a description with a comma keeps the comma', () => {
  const [row] = parseStatement('Date,Description,Amount\n06/08/2026,"Pasta, Pizza & Co REF 3946",102.29\n');
  assert.equal(row.description, 'Pasta, Pizza & Co REF 3946');
});

test('the sample statement adds 128 rows', () => {
  const db = freshDb();
  assert.deepEqual(importStatement(db, SAMPLE), { added: 128, skipped: 0 });
  assert.equal(count(db), 128);
});

test('importing the same file twice adds nothing', () => {
  const db = freshDb();
  importStatement(db, SAMPLE);
  assert.deepEqual(importStatement(db, SAMPLE), { added: 0, skipped: 128 });
  assert.equal(count(db), 128);
});

test('a byte-order-mark CRLF file imported twice adds nothing', () => {
  const db = freshDb();
  const text = '﻿' + SAMPLE.replace(/\n/g, '\r\n');
  importStatement(db, text);
  assert.deepEqual(importStatement(db, text), { added: 0, skipped: 128 });
});

test('two identical lines in one new file are both added', () => {
  const db = freshDb();
  const text = 'Date,Description,Amount\n02/08/2026,Kestrel Coffee Bar,6.50\n02/08/2026,Kestrel Coffee Bar,6.50\n';
  assert.deepEqual(importStatement(db, text), { added: 2, skipped: 0 });
  assert.equal(count(db), 2);
});

test('a row already stored is skipped and the new rows are added', () => {
  const db = freshDb();
  importStatement(db, 'Date,Description,Amount\n02/08/2026,Kestrel Coffee Bar,6.50\n');
  const text = 'Date,Description,Amount\n02/08/2026,Kestrel Coffee Bar,6.50\n03/08/2026,Brightfield Power,121.00\n';
  assert.deepEqual(importStatement(db, text), { added: 1, skipped: 1 });
  assert.equal(count(db), 2);
});
