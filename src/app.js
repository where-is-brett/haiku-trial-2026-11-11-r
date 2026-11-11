// src/app.js
import { importStatement } from './lib/statement.js';

const IMPORT_FAILED = 'Could not read that file.';

function page(body) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Spending tracker</title></head>
<body>
<main>
<h1>Spending tracker</h1>
${body}
</main>
</body>
</html>
`;
}

const IMPORT_FORM = `<form method="post" enctype="multipart/form-data">
<label>Bank statement (CSV) <input type="file" name="statement"></label>
<button type="submit">Import</button>
</form>`;

// Reads the upload and imports it. Any failure answers 400 with the same plain text.
async function handleImport(req, res, url, db) {
  let summary;
  try {
    const request = new Request(url.href, { method: 'POST', headers: req.headers, body: req, duplex: 'half' });
    const form = await request.formData();
    const statement = form.get('statement');
    if (!(statement instanceof File)) throw new Error('no statement file was sent');
    const { added, skipped } = importStatement(db, await statement.text());
    summary = `<p>Added ${added}, skipped ${skipped}</p>`;
  } catch {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(IMPORT_FAILED);
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(page(summary));
}

export function createHandler({ db, flags }) {
  return async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') {
      const { n } = db.prepare('SELECT COUNT(*) AS n FROM transactions').get();
      const body = n === 0 ? '<p>Nothing imported yet</p>' : `<p>${n} transactions imported</p>`;
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(page(body));
      return;
    }
    if (url.pathname === '/import' && flags['statement-import'] === true) {
      if (req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(page(IMPORT_FORM));
        return;
      }
      if (req.method === 'POST') {
        await handleImport(req, res, url, db);
        return;
      }
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  };
}
