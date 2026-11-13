// src/lib/months.js

// The months that have transactions, newest first. Each is { month: 'YYYY-MM', count }.
// The month is the first seven characters of the stored YYYY-MM-DD date.
export function listMonths(db) {
  const rows = db
    .prepare('SELECT substr(date, 1, 7) AS month, COUNT(*) AS count FROM transactions GROUP BY month ORDER BY month DESC')
    .all();
  return rows.map((row) => ({ month: row.month, count: row.count }));
}

// The transactions of one month, oldest first, as { date, description, cents }.
// Money out is positive cents and money coming back is negative cents.
export function listMonthRows(db, month) {
  return db
    .prepare('SELECT date, description, cents FROM transactions WHERE substr(date, 1, 7) = ? ORDER BY date, id')
    .all(month)
    .map((row) => ({ date: row.date, description: row.description, cents: row.cents }));
}

// The month's total in cents: the integer sum of its rows' signed cents.
export function monthTotal(rows) {
  return rows.reduce((sum, row) => sum + row.cents, 0);
}
