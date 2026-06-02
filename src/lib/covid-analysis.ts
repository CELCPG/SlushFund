/**
 * Pure-function analysis helpers for the COVID spending page.
 *
 * Takes the raw `get_covid_stats()` payload and returns derived metrics:
 * - Concentration: how much of the total went to the top N vendors.
 * - Pre-COVID baseline: average quarterly obligations in FY2018–FY2019.
 * - Obligations vs outlays gap: obligated ≠ spent.
 * - Agency grouping: bucket raw agency strings into familiar clusters.
 * - Anomaly detection: quarters outside the expected FY2020–FY2022 window
 *   with non-trivial values (suggests a backdated tag or data quirk).
 */

export interface AgencyRow {
  agency: string;
  award_count: number;
  no_bid_count: number;
  no_bid_dollars: number;
  total_covid_obligations: number;
}

export interface VendorRow {
  name: string;
  award_count: number;
  total_covid_obligations: number;
}

export interface CovidStats {
  total_covid_awards: number;
  total_covid_obligations: number;
  total_covid_outlays: number;
  covid_no_bid_count: number;
  covid_no_bid_dollars: number;
  by_agency: AgencyRow[];
  top_vendors: VendorRow[];
  by_quarter: Record<string, number>;
}

export interface AgencyGroup {
  id: string;
  label: string;
  obligations: number;
  award_count: number;
  agencies: string[];
}

// Agency keyword → group. Order matters (first match wins).
const AGENCY_GROUP_RULES: { id: string; label: string; patterns: RegExp[] }[] = [
  {
    id: 'hhs',
    label: 'Health & Human Services',
    patterns: [/health and human services/i, /\bHHS\b/i, /\bCDC\b/i, /\bNIH\b/i, /national institutes of health/i, /centers for disease/i, /indian health/i],
  },
  {
    id: 'dod',
    label: 'Defense',
    patterns: [/defense/i, /\bDOD\b/i, /\bDOD\b/, /army|navy|air force/i, /\bUSAF\b/i],
  },
  {
    id: 'fema_dhs',
    label: 'FEMA & Homeland Security',
    patterns: [/homeland security/i, /\bFEMA\b/i, /emergency management/i, /\bDHS\b/i],
  },
  {
    id: 'treasury',
    label: 'Treasury & IRS',
    patterns: [/treasury/i, /internal revenue/i, /\bIRS\b/i],
  },
  {
    id: 'sba',
    label: 'Small Business Admin (PPP)',
    patterns: [/small business administration/i, /\bSBA\b/i],
  },
  {
    id: 'transportation',
    label: 'Transportation',
    patterns: [/transportation/i, /\bDOT\b/i, /federal aviation/i, /\bFAA\b/i, /transit/i],
  },
  {
    id: 'labor',
    label: 'Labor',
    patterns: [/department of labor/i, /\bDOL\b/i, /workforce/i],
  },
  {
    id: 'education',
    label: 'Education',
    patterns: [/education/i, /\bED\b/i, /university|college|school/i],
  },
  {
    id: 'housing',
    label: 'Housing & Urban Dev',
    patterns: [/housing and urban/i, /\bHUD\b/i],
  },
  {
    id: 'va',
    label: 'Veterans Affairs',
    patterns: [/veterans affairs/i, /\bVA\b/i],
  },
  {
    id: 'agriculture',
    label: 'Agriculture',
    patterns: [/agriculture/i, /\bUSDA\b/i, /food and nutrition/i],
  },
  {
    id: 'state',
    label: 'State Department',
    patterns: [/state department/i],
  },
  {
    id: 'justice',
    label: 'Justice',
    patterns: [/justice/i, /\bDOJ\b/i, /\bFBI\b/i, /federal bureau/i],
  },
  {
    id: 'epa',
    label: 'EPA',
    patterns: [/environmental protection/i, /\bEPA\b/i],
  },
  {
    id: 'energy',
    label: 'Energy',
    patterns: [/energy/i, /\bDOE\b/i],
  },
  {
    id: 'commerce',
    label: 'Commerce',
    patterns: [/commerce/i, /census/i, /\bNOAA\b/i],
  },
  {
    id: 'interior',
    label: 'Interior',
    patterns: [/interior/i, /national park/i, /indian affairs/i],
  },
];

function groupForAgency(agency: string): string {
  for (const rule of AGENCY_GROUP_RULES) {
    if (rule.patterns.some((p) => p.test(agency))) return rule.id;
  }
  return 'other';
}

export function buildAgencyGroups(byAgency: AgencyRow[]): AgencyGroup[] {
  const buckets = new Map<string, AgencyGroup>();
  for (const row of byAgency) {
    const id = groupForAgency(row.agency);
    if (!buckets.has(id)) {
      const label = AGENCY_GROUP_RULES.find((r) => r.id === id)?.label ?? 'Other Federal';
      buckets.set(id, { id, label, obligations: 0, award_count: 0, agencies: [] });
    }
    const bucket = buckets.get(id)!;
    bucket.obligations += Number(row.total_covid_obligations) || 0;
    bucket.award_count += Number(row.award_count) || 0;
    bucket.agencies.push(row.agency);
  }
  return [...buckets.values()].sort((a, b) => b.obligations - a.obligations);
}

export interface ConcentrationMetric {
  topN: number;
  topNObligations: number;
  topNPercent: number;
  total: number;
  topNVendors: { name: string; obligations: number; pct: number }[];
}

export function vendorConcentration(
  topVendors: VendorRow[],
  totalObligations: number,
  n: number
): ConcentrationMetric {
  const slice = topVendors.slice(0, n);
  const sum = slice.reduce((acc, v) => acc + (Number(v.total_covid_obligations) || 0), 0);
  const pct = totalObligations > 0 ? (sum / totalObligations) * 100 : 0;
  return {
    topN: n,
    topNObligations: sum,
    topNPercent: pct,
    total: totalObligations,
    topNVendors: slice.map((v) => ({
      name: v.name,
      obligations: Number(v.total_covid_obligations) || 0,
      pct: totalObligations > 0 ? ((Number(v.total_covid_obligations) || 0) / totalObligations) * 100 : 0,
    })),
  };
}

function quarterKey(label: string): { q: number; year: number } | null {
  const m = label.match(/^Q([1-4])\s+FY(\d{4})$/i);
  return m ? { q: parseInt(m[1], 10), year: parseInt(m[2], 10) } : null;
}

/** Average quarterly obligations across the given fiscal year range. */
export function preCovidBaselineAverage(
  byQuarter: Record<string, number>,
  startYear: number,
  endYear: number
): { average: number; quarterCount: number; total: number } {
  let total = 0;
  let count = 0;
  for (const [label, value] of Object.entries(byQuarter)) {
    const k = quarterKey(label);
    if (!k) continue;
    if (k.year < startYear || k.year > endYear) continue;
    total += value;
    count += 1;
  }
  return { average: count > 0 ? total / count : 0, quarterCount: count, total };
}

export interface OblOutGap {
  obligated: number;
  outlayed: number;
  gap: number;
  gapPercent: number; // % of obligated that's been actually spent
}

export function obligationOutlayGap(stats: CovidStats): OblOutGap {
  const obligated = Number(stats.total_covid_obligations) || 0;
  const outlayed = Number(stats.total_covid_outlays) || 0;
  const gap = obligated - outlayed;
  return {
    obligated,
    outlayed,
    gap,
    gapPercent: obligated > 0 ? (outlayed / obligated) * 100 : 0,
  };
}

export interface Anomaly {
  label: string;
  value: number;
  reason: string;
}

/**
 * Surface quarters that look out of place relative to the FY2020–FY2022
 * COVID-response window. Anything outside that window with non-trivial
 * obligations is worth flagging usually a backdated tag or a
 * non-pandemic award that got mis-coded.
 */
export function findAnomalies(
  byQuarter: Record<string, number>,
  options: { windowStart: number; windowEnd: number; minValue?: number } = {
    windowStart: 2020,
    windowEnd: 2022,
  }
): Anomaly[] {
  const minValue = options.minValue ?? 100_000_000; // $100M
  const out: Anomaly[] = [];
  for (const [label, value] of Object.entries(byQuarter)) {
    const k = quarterKey(label);
    if (!k) continue;
    if (value < minValue) continue;
    if (k.year < options.windowStart || k.year > options.windowEnd) {
      out.push({
        label,
        value,
        reason: `Outside FY${options.windowStart}–FY${options.windowEnd} COVID window`,
      });
    }
  }
  out.sort((a, b) => b.value - a.value);
  return out;
}

export function formatPct(p: number, digits = 1): string {
  return `${p.toFixed(digits)}%`;
}
