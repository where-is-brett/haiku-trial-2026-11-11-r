// tests/month-page.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../src/app.js';
import { freshDb, withServer } from './helpers.js';

function addRow(db, date, description, cents) {
  db.prepare('INSERT INTO transactions (date, description, cents) VALUES (?, ?, ?)').run(date, description, cents);
}
const on = { 'statement-import': true };

test('the month page lists the month and its total', async () => {
  const db = freshDb();
  addRow(db, '2026-08-02', 'Kestrel Coffee Bar', 650);
  addRow(db, '2026-08-19', 'Marlowe Homewares REFUND', -4000);
  await withServer(createHandler({ db, flags: on }), async (base) => {
    const text = await (await fetch(base + '/month?m=2026-08')).text();
    assert.match(text, /Month 2026-08/);
    assert.match(text, /Kestrel Coffee Bar/);
    assert.match(text, /6\.50/);
    assert.match(text, /-40\.00/);
    assert.match(text, /Total -33\.50/);
  });
});

test('descriptions are escaped on the month page', async () => {
  const db = freshDb();
  addRow(db, '2026-08-02', '<script>alert(1)</script> & co', 100);
  await withServer(createHandler({ db, flags: on }), async (base) => {
    const text = await (await fetch(base + '/month?m=2026-08')).text();
    assert.doesNotMatch(text, /<script>/);
    assert.match(text, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; co/);
  });
});

test('a month with no transactions shows a zero total', async () => {
  await withServer(createHandler({ db: freshDb(), flags: on }), async (base) => {
    const text = await (await fetch(base + '/month?m=2026-07')).text();
    assert.match(text, /Total 0\.00/);
  });
});

test('an invalid month is a 404', async () => {
  await withServer(createHandler({ db: freshDb(), flags: on }), async (base) => {
    assert.equal((await fetch(base + '/month?m=2026-13')).status, 404);
    assert.equal((await fetch(base + '/month?m=abc')).status, 404);
    assert.equal((await fetch(base + '/month')).status, 404);
  });
});

test('with the switch off, the month page is a 404', async () => {
  await withServer(createHandler({ db: freshDb(), flags: { 'statement-import': false } }), async (base) => {
    assert.equal((await fetch(base + '/month?m=2026-08')).status, 404);
  });
});
