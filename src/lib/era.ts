// Era and fiscal-year date ranges.
// Single source of truth for all API routes + UI. Safe for edge runtime
// (pure data, no imports).

export type Era = 'trump_1' | 'covid' | 'biden' | 'trump_2' | 'all';

// Federal fiscal years used for "era" slicing in era-stats + alerts
export const FY_DATE_RANGES: Record<number, { start: string; end: string }> = {
  2019: { start: '2018-10-01', end: '2019-09-30' },
  2020: { start: '2019-10-01', end: '2020-09-30' },
  2021: { start: '2020-10-01', end: '2021-09-30' },
  2022: { start: '2021-10-01', end: '2022-09-30' },
  2023: { start: '2022-10-01', end: '2023-09-30' },
  2024: { start: '2023-10-01', end: '2024-09-30' },
  2025: { start: '2024-10-01', end: '2025-09-30' },
};

// Era definitions (4 admin periods + 'all')
export const ERA_FYS: Record<Exclude<Era, 'all'>, number[]> = {
  trump_1: [2019, 2020],
  covid: [2021],
  biden: [2022, 2023],
  trump_2: [2025],
};

export function eraDateRange(era: Exclude<Era, 'all'>): { start: string; end: string } {
  const fys = ERA_FYS[era];
  const sorted = [...fys].sort((a, b) => a - b);
  const first = FY_DATE_RANGES[sorted[0]];
  const last = FY_DATE_RANGES[sorted[sorted.length - 1]];
  return { start: first.start, end: last.end };
}
