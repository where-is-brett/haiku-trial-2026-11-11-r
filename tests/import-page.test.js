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
    assert.match(await res.text(), /Choose a statement file to import\./);
  });
  assert.equal(count(db), 0);
});

test('an upload over 5 MB is refused and nothing is stored', async () => {
  const db = freshDb();
  const big = 'Date,Description,Amount\n' + 'x'.repeat(5 * 1024 * 1024);
  await withServer(createHandler({ db, flags: { 'statement-import': true } }), async (base) => {
    const res = await fetch(base + '/import', { method: 'POST', body: upload(big) });
    assert.equal(res.status, 413);
    assert.match(await res.text(), /That file is over 5 MB\. Choose a smaller statement\./);
  });
  assert.equal(count(db), 0);
});

test('a header-only file adds nothing and is not an error', async () => {
  const db = freshDb();
  await withServer(createHandler({ db, flags: { 'statement-import': true } }), async (base) => {
    const res = await fetch(base + '/import', { method: 'POST', body: upload('Date,Description,Amount\n') });
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Added 0, skipped 0/);
  });
  assert.equal(count(db), 0);
});

test('a file that is not a statement is a plain 400 and stores nothing', async () => {
  const db = freshDb();
  await withServer(createHandler({ db, flags: { 'statement-import': true } }), async (base) => {
    const res = await fetch(base + '/import', { method: 'POST', body: upload('Name,Amount\nKestrel,6.50\n') });
    assert.equal(res.status, 400);
    assert.match(await res.text(), /That file is not a bank statement\. Expected columns: Date, Description, Amount\./);
  });
  assert.equal(count(db), 0);
});

test('a missing, empty or text-field upload asks for a statement file', async () => {
  const db = freshDb();
  await withServer(createHandler({ db, flags: { 'statement-import': true } }), async (base) => {
    const none = await fetch(base + '/import', { method: 'POST', body: new FormData() });
    assert.equal(none.status, 400);
    assert.match(await none.text(), /Choose a statement file to import\./);
    const empty = await fetch(base + '/import', { method: 'POST', body: upload('') });
    assert.equal(empty.status, 400);
    assert.match(await empty.text(), /Choose a statement file to import\./);
    const text = new FormData();
    text.append('statement', 'not a file');
    const field = await fetch(base + '/import', { method: 'POST', body: text });
    assert.equal(field.status, 400);
    assert.match(await field.text(), /Choose a statement file to import\./);
  });
  assert.equal(count(db), 0);
});

test('a bad row shows its line number and stores nothing', async () => {
  const db = freshDb();
  await withServer(createHandler({ db, flags: { 'statement-import': true } }), async (base) => {
    const res = await fetch(base + '/import', {
      method: 'POST',
      body: upload('Date,Description,Amount\n02/08/2026,Kestrel,6.50\n31/02/2026,Rent,5.00\n'),
    });
    assert.equal(res.status, 400);
    assert.match(await res.text(), /Line 3 is not a statement row: the date is not DD\/MM\/YYYY\./);
  });
  assert.equal(count(db), 0);
});

test('a database failure answers 500 and says nothing was stored', async () => {
  const db = freshDb();
  db.exec('DROP TABLE transactions');
  await withServer(createHandler({ db, flags: { 'statement-import': true } }), async (base) => {
    const res = await fetch(base + '/import', { method: 'POST', body: upload('Date,Description,Amount\n02/08/2026,Kestrel,6.50\n') });
    assert.equal(res.status, 500);
    assert.match(await res.text(), /The ledger could not be updated\. Nothing was stored\./);
  });
});
