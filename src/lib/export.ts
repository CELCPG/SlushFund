// SlushFund — data export utilities
// CSV / JSON download helpers so reporters can pull the underlying data.

function csvCell(value: unknown): string {
  if (value == null) return '';
  let s: string;
  if (typeof value === 'object') s = JSON.stringify(value);
  else s = String(value);
  // Escape per RFC 4180: wrap in quotes if it contains comma, quote, or newline.
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Convert an array of flat-ish objects to a CSV string. Nested values become JSON. */
export function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Array.from(
    rows.reduce<Set<string>>((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set()),
  );
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h])).join(','));
  }
  return lines.join('\r\n');
}

function triggerDownload(content: string, filename: string, mime: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  triggerDownload(toCSV(rows), filename.endsWith('.csv') ? filename : `${filename}.csv`, 'text/csv;charset=utf-8');
}

export function downloadJSON(data: unknown, filename: string) {
  triggerDownload(
    JSON.stringify(data, null, 2),
    filename.endsWith('.json') ? filename : `${filename}.json`,
    'application/json',
  );
}
