// tests/home-months.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../src/app.js';
import { freshDb, withServer } from './helpers.js';

function addRows(db, dates) {
  const insert = db.prepare('INSERT INTO transactions (date, description, cents) VALUES (?, ?, ?)');
  for (const date of dates) insert.run(date, 'Row', 100);
}

test('the home page lists months newest first, linking to each month', async () => {
  const db = freshDb();
  addRows(db, ['2026-08-02', '2026-08-03', '2026-09-01']);
  await withServer(createHandler({ db, flags: { 'statement-import': true } }), async (base) => {
    const text = await (await fetch(base + '/')).text();
    const sep = text.indexOf('Month 2026-09');
    assert.ok(sep > -1 && sep < text.indexOf('Month 2026-08'));
    assert.match(text, /<li><a href="\/month\?m=2026-09">Month 2026-09<\/a><\/li>/);
    assert.match(text, /<li><a href="\/month\?m=2026-08">Month 2026-08<\/a><\/li>/);
  });
});

test('with the switch off the home page is unchanged', async () => {
  const db = freshDb();
  addRows(db, ['2026-08-02']);
  await withServer(createHandler({ db, flags: { 'statement-import': false } }), async (base) => {
    const text = await (await fetch(base + '/')).text();
    assert.match(text, /1 transactions imported/);
    assert.doesNotMatch(text, /Month 2026-08/);
    assert.doesNotMatch(text, /<ul>/);
  });
});

test('an empty ledger lists no months', async () => {
  await withServer(createHandler({ db: freshDb(), flags: { 'statement-import': true } }), async (base) => {
    const text = await (await fetch(base + '/')).text();
    assert.match(text, /Nothing imported yet/);
    assert.doesNotMatch(text, /<ul>/);
  });
});
