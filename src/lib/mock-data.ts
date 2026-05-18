// Old mock data format — kept for reference but no longer used by any page.
// Pages now use mock-data-new.ts which has the correct Award field names.
// This file is not imported anywhere and exists only for potential debugging.
import type { Contract } from './types';

export const MOCK_CONTRACTS: Contract[] = [];
export function mockContract(id: string): Contract | undefined { return undefined; }
export const MONTHLY_SPENDING: { month: string; total: number; flagged: number }[] = [];
export const CONNECTION_BREAKDOWN: { type: string; label: string; total: number; count: number }[] = [];