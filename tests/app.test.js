// tests/app.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../src/app.js';
import { freshDb, withServer } from './helpers.js';

test('home says nothing is imported on an empty ledger', async () => {
  const handler = createHandler({ db: freshDb(), flags: {} });
  await withServer(handler, async (base) => {
    const text = await (await fetch(base + '/')).text();
    assert.match(text, /Nothing imported yet/);
  });
});

test('home counts the stored transactions', async () => {
  const db = freshDb();
  db.exec("INSERT INTO transactions (date, description, cents) VALUES ('2026-08-02', 'Kestrel', 650), ('2026-08-03', 'Brightfield', 12100)");
  await withServer(createHandler({ db, flags: {} }), async (base) => {
    const text = await (await fetch(base + '/')).text();
    assert.match(text, /2 transactions imported/);
  });
});

test('an unknown path is a 404', async () => {
  await withServer(createHandler({ db: freshDb(), flags: {} }), async (base) => {
    assert.equal((await fetch(base + '/nope')).status, 404);
  });
});

test('a null flags object answers 404 for /import and does not throw', async () => {
  await withServer(createHandler({ db: freshDb(), flags: null }), async (base) => {
    assert.equal((await fetch(base + '/import')).status, 404);
  });
});
