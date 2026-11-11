// tests/money-edge.test.js
// Pins what parseAmount does today for three edge inputs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount } from '../src/lib/money.js';

test('a blank amount is read as NaN', () => {
  assert.ok(Number.isNaN(parseAmount('')));
});

test('a negative amount is read as negative cents', () => {
  assert.equal(parseAmount('-40.00'), -4000);
});

test('a thousands comma is ignored when reading cents', () => {
  assert.equal(parseAmount('1,234.50'), 123450);
});
