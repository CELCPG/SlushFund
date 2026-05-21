'use client';
import { Download } from 'lucide-react';
import { downloadCSV, downloadJSON } from '@/lib/export';

/**
 * Two-button export control for reporters. `rows` should be an array of
 * objects (used as-is for JSON; flattened for CSV).
 */
export function ExportMenu({
  rows,
  filename,
  label = 'Export',
}: {
  rows: readonly unknown[];
  filename: string;
  label?: string;
}) {
  if (!rows || rows.length === 0) return null;
  const records = rows as Record<string, unknown>[];
  return (
    <div className="flex items-center gap-2">
      <span className="hidden sm:flex items-center gap-1 text-xs text-slate-500">
        <Download size={12} /> {label}
      </span>
      <button
        onClick={() => downloadCSV(records, filename)}
        className="text-xs font-medium text-slate-300 hover:text-white px-2.5 py-1 border border-slate-700 rounded hover:border-slate-500 transition-colors"
      >
        CSV
      </button>
      <button
        onClick={() => downloadJSON(records, filename)}
        className="text-xs font-medium text-slate-300 hover:text-white px-2.5 py-1 border border-slate-700 rounded hover:border-slate-500 transition-colors"
      >
        JSON
      </button>
    </div>
  );
}
