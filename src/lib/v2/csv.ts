/** RFC 4180 CSV. Safe in server and client code. */

export type CsvValue = string | number | boolean | null | undefined;

function cell(v: CsvValue): string {
  if (v == null) return '';
  let s = String(v);
  // Neutralize spreadsheet formula injection (=, +, -, @ at the start) for text.
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: { key: string; label: string }[], rows: Record<string, CsvValue>[]): string {
  const lines = [headers.map((h) => cell(h.label)).join(',')];
  for (const r of rows) lines.push(headers.map((h) => cell(r[h.key])).join(','));
  return lines.join('\r\n') + '\r\n';
}

/** Filename-safe slug with today's date: "latest-trades-2026-10-03.csv". */
export function csvFilename(base: string, date: Date = new Date()): string {
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export';
  return `${slug}-${date.toISOString().slice(0, 10)}.csv`;
}
