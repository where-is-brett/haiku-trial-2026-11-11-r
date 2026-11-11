// tests/csv.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../src/lib/csv.js';

test('plain fields split on commas', () => {
  assert.deepEqual(parseCsv('a,b,c'), [['a', 'b', 'c']]);
});

test('a comma inside quotes stays in its field', () => {
  assert.deepEqual(parseCsv('1,"Pasta, Pizza & Co",3'), [['1', 'Pasta, Pizza & Co', '3']]);
});

test('a doubled quote inside quotes is one quote', () => {
  assert.deepEqual(parseCsv('"say ""hi""",x'), [['say "hi"', 'x']]);
});

test('CRLF and LF both end rows, and a byte-order mark is dropped', () => {
  assert.deepEqual(parseCsv('﻿a,b\r\nc,d\n'), [['a', 'b'], ['c', 'd']]);
});

test('blank lines, including a trailing one, make no row', () => {
  assert.deepEqual(parseCsv('a,b\n\n  \nc,d\n'), [['a', 'b'], ['c', 'd']]);
});

test('fields are trimmed', () => {
  assert.deepEqual(parseCsv(' a , b '), [['a', 'b']]);
});
