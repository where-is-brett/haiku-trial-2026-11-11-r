// tests/statement.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { parseStatement, importStatement, StatementError } from '../src/lib/statement.js';

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
  const text = '﻿' + SAMPLE.replace(/\r?\n/g, '\r\n');
  assert.deepEqual(importStatement(db, text), { added: 128, skipped: 0 });
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

test('a header is accepted with a byte-order mark, spaces and any letter case', () => {
  const [row] = parseStatement('﻿ date ,DESCRIPTION,amount \n02/08/2026,Kestrel,6.50\n');
  assert.equal(row.cents, 650);
});

test('a wrong header is refused and nothing is stored', () => {
  const db = freshDb();
  importStatement(db, SAMPLE);
  assert.throws(() => importStatement(db, 'Date,Payee,Amount\n02/08/2026,Kestrel,6.50\n'), {
    name: 'StatementError',
    message: 'That file is not a bank statement. Expected columns: Date, Description, Amount.',
  });
  assert.equal(count(db), 128);
});

test('a row with four fields is refused', () => {
  assert.throws(() => parseStatement('Date,Description,Amount\n02/08/2026,Rent,1,234.00\n'), {
    name: 'StatementError',
    message: 'Line 2 is not a statement row: it does not have three columns.',
  });
});

test('an impossible date is refused', () => {
  assert.throws(() => parseStatement('Date,Description,Amount\n31/02/2026,Rent,5.00\n'), {
    name: 'StatementError',
    message: 'Line 2 is not a statement row: the date is not DD/MM/YYYY.',
  });
});

test('a date in another form is refused', () => {
  assert.throws(() => parseStatement('Date,Description,Amount\n2026-08-31,Rent,5.00\n'), {
    name: 'StatementError',
    message: 'Line 2 is not a statement row: the date is not DD/MM/YYYY.',
  });
});

test('an amount that is not a number is refused and nothing is stored', () => {
  const db = freshDb();
  assert.throws(() => importStatement(db, 'Date,Description,Amount\n02/08/2026,Bank fee,\n'), {
    name: 'StatementError',
    message: 'Line 2 is not a statement row: the amount is not a number.',
  });
  assert.equal(count(db), 0);
});

test('an amount with letters in it is refused and nothing is stored', () => {
  const db = freshDb();
  assert.throws(() => importStatement(db, 'Date,Description,Amount\n02/08/2026,Bank fee,12abc\n'), {
    name: 'StatementError',
    message: 'Line 2 is not a statement row: the amount is not a number.',
  });
  assert.equal(count(db), 0);
});

test('an amount with two decimal points is refused', () => {
  assert.throws(() => parseStatement('Date,Description,Amount\n02/08/2026,Bank fee,1.2.3\n'), {
    name: 'StatementError',
    message: 'Line 2 is not a statement row: the amount is not a number.',
  });
});

test('a bracketed amount is accepted', () => {
  assert.doesNotThrow(() => parseStatement('Date,Description,Amount\n02/08/2026,Bank fee,(40.00)\n'));
});

test('plain amounts with a minus sign are read as cents', () => {
  const [a, b] = parseStatement('Date,Description,Amount\n02/08/2026,Coffee,8.58\n03/08/2026,Refund,-2112.90\n');
  assert.equal(a.cents, 858);
  assert.equal(b.cents, -211290);
});

test('a bad row late in the file stores none of the rows before it', () => {
  const db = freshDb();
  const text = 'Date,Description,Amount\n02/08/2026,Kestrel,6.50\n03/08/2026,Rent,abc\n';
  assert.throws(() => importStatement(db, text), StatementError);
  assert.equal(count(db), 0);
});

test('a header-only file is valid and adds nothing', () => {
  const db = freshDb();
  assert.deepEqual(importStatement(db, 'Date,Description,Amount\r\n'), { added: 0, skipped: 0 });
  assert.equal(count(db), 0);
});

test('a database error mid-write stores nothing', () => {
  const db = freshDb();
  db.exec("CREATE TRIGGER refuse BEFORE INSERT ON transactions WHEN NEW.cents = 999 BEGIN SELECT RAISE(ABORT, 'refused'); END");
  const text = 'Date,Description,Amount\n02/08/2026,A,6.50\n03/08/2026,B,4.00\n04/08/2026,C,9.99\n';
  assert.throws(() => importStatement(db, text));
  assert.equal(count(db), 0);
});
