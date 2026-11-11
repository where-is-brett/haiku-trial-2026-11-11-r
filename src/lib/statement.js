// src/lib/statement.js
import { parseCsv } from './csv.js';
import { parseDate } from './dates.js';
import { parseAmount } from './money.js';

// Reads a statement into rows of date, description and cents. The first row is the header.
export function parseStatement(text) {
  return parseCsv(text)
    .slice(1)
    .map(([date, description, amount]) => ({
      date: parseDate(date),
      description,
      cents: parseAmount(amount),
    }));
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
