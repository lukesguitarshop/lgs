export type CsvCell = string | number | null | undefined;

/**
 * Serializes rows to RFC 4180 CSV.
 *
 * Listing descriptions carry commas, quotes and hard newlines, all of which
 * corrupt the Sweetwater bulk import if emitted raw.
 */
export function toCsv(rows: CsvCell[][]): string {
  return rows.map(row => row.map(escapeCell).join(',')).join('\r\n');
}

function escapeCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return '';

  const text = String(cell);
  const needsQuoting = /[",\r\n]/.test(text) || text.trim() !== text;

  return needsQuoting ? `"${text.replace(/"/g, '""')}"` : text;
}
