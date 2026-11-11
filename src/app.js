// src/app.js
import { importStatement, StatementError } from './lib/statement.js';
import { listMonths } from './lib/months.js';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const CHOOSE_FILE = 'Choose a statement file to import.';
const TOO_BIG = 'That file is over 5 MB. Choose a smaller statement.';
const NOT_READ = 'Could not read that file.';
const DB_FAILED = 'The ledger could not be updated. Nothing was stored.';

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

// Answers with a status and one plain sentence, shown inside the page.
function answer(res, status, sentence) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
  res.end(page(`<p>${sentence}</p>`));
}

// Reads the upload and imports it. Each failure answers its own status and sentence.
async function handleImport(req, res, url, db) {
  if (Number(req.headers['content-length']) > MAX_UPLOAD_BYTES) return answer(res, 413, TOO_BIG);

  let statement;
  let text;
  try {
    const request = new Request(url.href, { method: 'POST', headers: req.headers, body: req, duplex: 'half' });
    const form = await request.formData();
    statement = form.get('statement');
    if (statement instanceof File && statement.size > 0 && statement.size <= MAX_UPLOAD_BYTES) {
      text = await statement.text();
    }
  } catch {
    return answer(res, 400, NOT_READ);
  }
  if (!(statement instanceof File) || statement.size === 0) return answer(res, 400, CHOOSE_FILE);
  if (statement.size > MAX_UPLOAD_BYTES) return answer(res, 413, TOO_BIG);

  try {
    const { added, skipped } = importStatement(db, text);
    return answer(res, 200, `Added ${added}, skipped ${skipped}`);
  } catch (err) {
    if (err instanceof StatementError) return answer(res, 400, err.message);
    return answer(res, 500, DB_FAILED);
  }
}

export function createHandler({ db, flags }) {
  return async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') {
      const { n } = db.prepare('SELECT COUNT(*) AS n FROM transactions').get();
      let body = n === 0 ? '<p>Nothing imported yet</p>' : `<p>${n} transactions imported</p>`;
      if (flags?.['statement-import'] === true) {
        const months = listMonths(db);
        if (months.length > 0) {
          const items = months
            .map(({ month, count }) => `<li><a href="/month?m=${month}">Month ${month}</a></li>`)
            .join('\n');
          body += `\n<ul>\n${items}\n</ul>`;
        }
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(page(body));
      return;
    }
    if (url.pathname === '/import' && flags?.['statement-import'] === true) {
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
