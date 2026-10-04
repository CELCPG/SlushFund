'use client';

import { ReactNode, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SkeletonTableRows } from './Skeleton';

export interface Column<T> {
  key: string;
  header: ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  className?: string;
  render?: (row: T) => ReactNode;
  /** Value used for sorting; falls back to row[key]. */
  sortValue?: (row: T) => string | number;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  defaultSort?: { key: string; dir: 'asc' | 'desc' };
  onRowClick?: (row: T) => void;
  stickyHeader?: boolean;
  loading?: boolean;
  empty?: ReactNode;
  className?: string;
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

export function Table<T>({
  columns,
  data,
  rowKey,
  defaultSort,
  onRowClick,
  stickyHeader,
  loading,
  empty = 'No results.',
  className,
}: TableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(defaultSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return data;
    const get = col.sortValue ?? ((row: T) => (row as Record<string, unknown>)[sort.key] as string | number);
    const arr = [...data].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv));
    });
    return sort.dir === 'desc' ? arr.reverse() : arr;
  }, [data, sort, columns]);

  function toggleSort(key: string) {
    setSort((prev) =>
      prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );
  }

  return (
    <div className={cn('overflow-x-auto rounded-xl border border-slate-800', className)}>
      <table className="w-full border-collapse text-sm">
        <thead className={cn('bg-slate-900 text-slate-400', stickyHeader && 'sticky top-0 z-10')}>
          <tr className="border-b border-slate-800">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-xs font-semibold uppercase tracking-wide',
                  ALIGN[col.align ?? 'left'],
                  col.sortable && 'cursor-pointer select-none hover:text-slate-200',
                  col.className,
                )}
                onClick={col.sortable ? () => toggleSort(col.key) : undefined}
              >
                <span className={cn('inline-flex items-center gap-1', col.align === 'right' && 'flex-row-reverse')}>
                  {col.header}
                  {col.sortable &&
                    (sort?.key === col.key ? (
                      sort.dir === 'asc' ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )
                    ) : (
                      <ChevronsUpDown className="h-3 w-3 opacity-40" />
                    ))}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonTableRows rows={6} cols={columns.length} />
          ) : sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-slate-500">
                {empty}
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-slate-800 last:border-0',
                  onRowClick && 'cursor-pointer hover:bg-slate-800',
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3 text-slate-200', ALIGN[col.align ?? 'left'], col.className)}>
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
