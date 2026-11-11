// tests/import-page.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHandler } from '../src/app.js';
import { freshDb, withServer } from './helpers.js';

const SAMPLE = fs.readFileSync(new URL('../data/sample-statement.csv', import.meta.url), 'utf8');
const upload = (text) => {
  const form = new FormData();
  form.append('statement', new Blob([text], { type: 'text/csv' }), 'statement.csv');
  return form;
};
const count = (db) => db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n;

test('the import page has a statement file field', async () => {
  await withServer(createHandler({ db: freshDb(), flags: { 'statement-import': true } }), async (base) => {
    const text = await (await fetch(base + '/import')).text();
    assert.match(text, /name="statement"/);
  });
});

test('uploading a clean statement shows the counts', async () => {
  const db = freshDb();
  await withServer(createHandler({ db, flags: { 'statement-import': true } }), async (base) => {
    const res = await fetch(base + '/import', { method: 'POST', body: upload(SAMPLE) });
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Added 128, skipped 0/);
  });
  assert.equal(count(db), 128);
});

test('uploading the same statement again adds nothing', async () => {
  const db = freshDb();
  await withServer(createHandler({ db, flags: { 'statement-import': true } }), async (base) => {
    await fetch(base + '/import', { method: 'POST', body: upload(SAMPLE) });
    const text = await (await fetch(base + '/import', { method: 'POST', body: upload(SAMPLE) })).text();
    assert.match(text, /Added 0, skipped 128/);
  });
  assert.equal(count(db), 128);
});

test('with the switch off, /import is a 404 and nothing is stored', async () => {
  const db = freshDb();
  await withServer(createHandler({ db, flags: { 'statement-import': false } }), async (base) => {
    assert.equal((await fetch(base + '/import')).status, 404);
    assert.equal((await fetch(base + '/import', { method: 'POST', body: upload(SAMPLE) })).status, 404);
  });
  assert.equal(count(db), 0);
});

test('a POST with no file field is a 400 and stores nothing', async () => {
  const db = freshDb();
  await withServer(createHandler({ db, flags: { 'statement-import': true } }), async (base) => {
    const form = new FormData();
    form.append('note', 'no file here');
    const res = await fetch(base + '/import', { method: 'POST', body: form });
    assert.equal(res.status, 400);
    assert.equal(await res.text(), 'Could not read that file.');
  });
  assert.equal(count(db), 0);
});
