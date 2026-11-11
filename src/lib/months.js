// src/lib/months.js

// The months that have transactions, newest first. Each is { month: 'YYYY-MM', count }.
// The month is the first seven characters of the stored YYYY-MM-DD date.
export function listMonths(db) {
  const rows = db
    .prepare('SELECT substr(date, 1, 7) AS month, COUNT(*) AS count FROM transactions GROUP BY month ORDER BY month DESC')
    .all();
  return rows.map((row) => ({ month: row.month, count: row.count }));
}
