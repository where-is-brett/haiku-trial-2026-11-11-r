// src/lib/statement.js
import { parseCsv } from './csv.js';
import { parseDate } from './dates.js';
import { parseAmount } from './money.js';

// A problem with the statement file. Its message is the sentence shown on the page.
export class StatementError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StatementError';
  }
}

const HEADER = ['date', 'description', 'amount'];
// A plain amount such as 8.58, -2112.90 or 1,234.00, or a bracketed one such as (40.00).
const AMOUNT = /^(\(-?\d[\d,]*(\.\d+)?\)|-?\d[\d,]*(\.\d+)?)$/;
const HEADER_MESSAGE ='That file is not a bank statement. Expected columns: Date, Description, Amount.';

// True only for a DD/MM/YYYY date that exists in the calendar, such as 28/02/2026 but not 31/02/2026.
function isRealDate(text) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) return false;
  const [day, month, year] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// Reads a statement into rows of date, description and cents. The first row is the header.
// Checks every row before returning, and throws StatementError with the first problem found.
export function parseStatement(text) {
  const rows = parseCsv(text);
  const header = rows[0] ?? [];
  if (header.length !== HEADER.length || header.some((field, i) => field.toLowerCase() !== HEADER[i])) {
    throw new StatementError(HEADER_MESSAGE);
  }

  return rows.slice(1).map((fields, i) => {
    const line = i + 2;
    const fail = (reason) => new StatementError(`Line ${line} is not a statement row: ${reason}.`);
    const [date, description, amount] = fields;
    if (fields.length !== 3) throw fail('it does not have three columns');
    if (!isRealDate(date)) throw fail('the date is not DD/MM/YYYY');
    if (!AMOUNT.test(amount.trim())) throw fail('the amount is not a number');
    const cents = parseAmount(amount);
    if (!Number.isFinite(cents)) throw fail('the amount is not a number');
    return { date: parseDate(date), description, cents };
  });
}

// Adds the statement's rows that are not already stored. A row is a duplicate only when a row
// stored before this upload has the same date, description and amount. All checks run before
// any insert, so rows in the same file never match each other. Runs in one transaction.
export function importStatement(db, text) {
  const rows = parseStatement(text);
  const findSame = db.prepare(
    'SELECT COUNT(*) AS n FROM transactions WHERE date = ? AND description = ? AND cents = ?',
  );
  const insert = db.prepare('INSERT INTO transactions (date, description, cents) VALUES (?, ?, ?)');

  db.exec('BEGIN');
  try {
    const isNew = rows.map((row) => findSame.get(row.date, row.description, row.cents).n === 0);
    let added = 0;
    rows.forEach((row, i) => {
      if (isNew[i]) {
        insert.run(row.date, row.description, row.cents);
        added++;
      }
    });
    db.exec('COMMIT');
    return { added, skipped: rows.length - added };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
