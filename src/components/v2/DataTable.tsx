'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { csvFilename, toCsv } from '@/lib/v2/csv';

export interface DataTableColumn {
  key: string;
  header: string;
  /** Right-aligned monospace figures. */
  numeric?: boolean;
  /** Default true. */
  sortable?: boolean;
  /**
   * Phone layout (under 640px rows become stacked cards):
   * 'title' = card heading, 'subtitle' = line under it, 'field' (default) =
   * label/value pair, 'action' = bottom row (links), 'hidden' = not on phones.
   */
  mobile?: 'title' | 'subtitle' | 'field' | 'action' | 'hidden';
  /** Include in CSV export. Default true. */
  csv?: boolean;
  /** Export-only column: in the CSV, not on screen. */
  csvOnly?: boolean;
  /** Sort on a different raw value than the one exported (e.g. amount_min for a range). */
  sortKey?: string;
  className?: string;
}

export type DataTableValue = string | number | null;

export interface DataTableRow {
  id: string;
  /** Raw values: what sorting and CSV export use. */
  values: Record<string, DataTableValue>;
  /** Rendered cells (server-rendered JSX is fine). Falls back to the raw value. */
  cells?: Record<string, ReactNode>;
}

type Sort = { key: string; dir: 'asc' | 'desc' };

function compare(a: DataTableValue, b: DataTableValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
}

/** Sort with missing values always last, whatever the direction. */
export function sortRows(rows: DataTableRow[], sort: Sort | null): DataTableRow[] {
  if (!sort) return rows;
  const sign = sort.dir === 'asc' ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i }))
    .sort((x, y) => {
      const a = x.r.values[sort.key];
      const b = y.r.values[sort.key];
      const am = a == null || a === '';
      const bm = b == null || b === '';
      if (am || bm) return am && bm ? x.i - y.i : am ? 1 : -1;
      return compare(a, b) * sign || x.i - y.i;
    })
    .map((x) => x.r);
}

/**
 * CSV export hook: returns a function that downloads the given rows as CSV.
 * Uses raw values (not rendered cells), in the current sort order.
 */
export function useCsvExport(columns: DataTableColumn[], rows: DataTableRow[], filenameBase: string) {
  return useCallback(() => {
    const cols = columns.filter((c) => c.csv !== false).map((c) => ({ key: c.key, label: c.header }));
    const csv = toCsv(cols, rows.map((r) => r.values));
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = csvFilename(filenameBase);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [columns, rows, filenameBase]);
}

function display(row: DataTableRow, col: DataTableColumn): ReactNode {
  const c = row.cells?.[col.key];
  if (c !== undefined) return c;
  const v = row.values[col.key];
  if (v == null || v === '') return <span className="text-muted">—</span>;
  return typeof v === 'number' ? v.toLocaleString('en-US') : v;
}

/**
 * Sortable data table. Under 640px each row becomes a stacked card so nothing
 * scrolls sideways. Optional CSV export of the raw values.
 */
export default function DataTable({
  columns,
  rows,
  caption,
  captionHidden = false,
  initialSort,
  csv,
  footer,
  emptyMessage = 'No rows to show.',
  className,
}: {
  columns: DataTableColumn[];
  rows: DataTableRow[];
  /** Table caption: what the rows are. Required for screen readers. */
  caption: string;
  captionHidden?: boolean;
  initialSort?: Sort;
  /** CSV export: filename base ("latest-trades"). Omit to hide the button. */
  csv?: { filename: string; label?: string };
  /** Source line under the table. */
  footer?: ReactNode;
  emptyMessage?: string;
  className?: string;
}) {
  const [sort, setSort] = useState<Sort | null>(initialSort ?? null);
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);
  const exportCsv = useCsvExport(columns, sorted, csv?.filename ?? 'export');

  const visible = columns.filter((c) => !c.csvOnly);
  const titleCol = visible.find((c) => c.mobile === 'title') ?? visible[0];
  const subtitleCols = visible.filter((c) => c.mobile === 'subtitle');
  const fieldCols = visible.filter((c) => c !== titleCol && (c.mobile ?? 'field') === 'field');
  const actionCols = visible.filter((c) => c.mobile === 'action');

  // Sort state holds the raw value key (the column's sortKey, else its key).
  const sortKeyOf = (c: DataTableColumn) => c.sortKey ?? c.key;
  const toggle = (c: DataTableColumn) => {
    const key = sortKeyOf(c);
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: c.numeric ? 'desc' : 'asc' }));
  };

  return (
    <div className={cn('min-w-0', className)}>
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-page px-4 py-6 text-center text-sm text-muted">{emptyMessage}</p>
      ) : (
        <>
          {/* ≥640px: table */}
          <div className="overflow-x-auto max-sm:hidden">
            <table className="w-full border-collapse text-[14.5px]">
              <caption className={cn('pb-2 text-left text-[13px] text-muted', captionHidden && 'sr-only')}>{caption}</caption>
              <thead>
                <tr>
                  {visible.map((c) => {
                    const active = sort?.key === sortKeyOf(c);
                    const sortable = c.sortable !== false;
                    return (
                      <th
                        key={c.key}
                        scope="col"
                        aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                        className={cn('border-b border-line px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-[0.05em] text-muted', c.numeric && 'text-right', c.className)}
                      >
                        {sortable ? (
                          <button type="button" onClick={() => toggle(c)} className={cn('inline-flex items-center gap-1 uppercase hover:text-ink', active && 'text-ink')}>
                            {c.header}
                            <span aria-hidden className="text-[10px]">{active ? (sort!.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
                          </button>
                        ) : c.header}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id} className="hover:bg-page/60">
                    {visible.map((c) => (
                      <td key={c.key} className={cn('border-b border-line px-2.5 py-3 align-middle', c.numeric && 'whitespace-nowrap text-right font-mono text-[13.5px]', c.className)}>
                        {display(r, c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* <640px: stacked cards */}
          <div className="sm:hidden">
            <p className={cn('pb-2 text-[13px] text-muted', captionHidden && 'sr-only')}>{caption}</p>
            <ul className="divide-y divide-line border-y border-line">
              {sorted.map((r) => (
                <li key={r.id} className="py-3">
                  <div className="font-semibold leading-snug">{display(r, titleCol)}</div>
                  {subtitleCols.map((c) => (
                    <div key={c.key} className="text-[13px] text-muted">{display(r, c)}</div>
                  ))}
                  {fieldCols.length > 0 && (
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13.5px]">
                      {fieldCols.map((c) => (
                        <div key={c.key} className="min-w-0">
                          <dt className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">{c.header}</dt>
                          <dd className={cn('break-words', c.numeric && 'font-mono text-[13px]')}>{display(r, c)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {actionCols.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-3">
                      {actionCols.map((c) => <span key={c.key}>{display(r, c)}</span>)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {(footer || (csv && rows.length > 0)) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
          {footer}
          {csv && rows.length > 0 && (
            <button type="button" onClick={exportCsv} className="font-semibold text-trades-ink hover:underline">
              {csv.label ?? 'Download CSV'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
