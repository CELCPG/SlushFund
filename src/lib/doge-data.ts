// DOGE Savings and Cuts Data
// Sources: doge.gov (claimed), GAO reports (verified), OPM (workforce), usaspending.gov (contracts)
// Last updated: 2026-05-20

export interface DogeSource {
  label: string;
  url: string;
}

export interface DogeAgencySavings {
  agency: string;
  claimed: number;
  verified: number;
  category: 'contracts' | 'grants' | 'workforce' | 'operations';
  claimed_breakdown: string;
  verified_breakdown: string;
  notes: string;
  sources: DogeSource[];
}

export interface DogeStaffCompany {
  name: string;
  ticker?: string;
}

export interface DogeStaffConflict {
  name: string;
  role: string;
  companies: DogeStaffCompany[];
  disclosure_filed: boolean;
  notes: string;
  sources: DogeSource[];
}

export interface DogeContractWinner {
  company: string;
  ticker?: string;
  contract_amount: number;
  date_awarded: string;
  replacing: string;
  agency: string;
  description: string;
  connection_to_doge: string;
  sources: DogeSource[];
}

// ─── Canonical Source References ──────────────────────────────────────────────

const SRC_GAO: DogeSource = { label: 'GAO DOGE audit (GAO-26-106)', url: 'https://www.gao.gov/products/GAO-26-106' };
const SRC_DOGE: DogeSource = { label: 'DOGE public dashboard', url: 'https://doge.gov' };
const SRC_OPM: DogeSource = { label: 'OPM workforce data', url: 'https://www.opm.gov/policy-data-oversight/data-analysis' };
const SRC_USASPENDING: DogeSource = { label: 'USAspending.gov', url: 'https://www.usaspending.gov' };
const SRC_OGE: DogeSource = { label: 'OGE financial disclosures', url: 'https://www.oge.gov' };

// ─── Savings by Agency ────────────────────────────────────────────────────────

export const DOGE_CLAIMED_SAVINGS = 130_000_000_000; // $130B claimed by DOGE
export const GAO_VERIFIED_SAVINGS = 28_000_000_000;   // $28B verified by GAO (as of May 2026)

// Agency-level data (claimed vs. verified). The 12 named agencies below do not
// sum to the headline totals — the remainder is captured by DOGE_OTHER_AGENCIES.
export const DOGE_AGENCY_SAVINGS: DogeAgencySavings[] = [
  {
    agency: 'USAID',
    claimed: 8_200_000_000,
    verified: 1_100_000_000,
    category: 'grants',
    claimed_breakdown: '$7.5B in grant terminations, $700M in contract cancellations',
    verified_breakdown: '$1.1B in actual grant savings confirmed by GAO',
    notes: 'USAID was effectively gutted. Most claimed savings are grant obligations that were legally binding — termination costs offset savings.',
    sources: [SRC_GAO, SRC_USASPENDING],
  },
  {
    agency: 'Department of Education',
    claimed: 1_900_000_000,
    verified: 220_000_000,
    category: 'contracts',
    claimed_breakdown: '$1.4B in DEI contracts canceled, $500M in grants terminated',
    verified_breakdown: '$220M in actual savings after termination costs',
    notes: 'ED cuts heavily targeted DEI programs. Many contracts had cancellation penalties. Independent verification challenged methodology.',
    sources: [SRC_GAO, SRC_USASPENDING],
  },
  {
    agency: 'Department of Labor',
    claimed: 1_100_000_000,
    verified: 380_000_000,
    category: 'workforce',
    claimed_breakdown: '18,000 workforce reductions at $61K average = $1.1B savings',
    verified_breakdown: 'GAO confirmed ~6,200 actual separations through April 2025 = $378M',
    notes: 'DOGE counted projected future salaries. Actual separations were significantly lower. Many "cuts" were hiring freezes, not firings.',
    sources: [SRC_GAO, SRC_OPM],
  },
  {
    agency: 'OPM',
    claimed: 22_000_000_000,
    verified: 8_800_000_000,
    category: 'workforce',
    claimed_breakdown: '200,000 federal workforce reduction (including DOGE itself)',
    verified_breakdown: '~75,000 actual separations confirmed via OPM payroll data',
    notes: 'Largest single workforce reduction in U.S. history. Claimed savings include projected attrition — not actual firings in many cases.',
    sources: [SRC_GAO, SRC_OPM],
  },
  {
    agency: 'EPA',
    claimed: 3_600_000_000,
    verified: 640_000_000,
    category: 'contracts',
    claimed_breakdown: '$3.2B in contracts canceled, $400M in grants terminated',
    verified_breakdown: '$640M in actual contract savings after cancellation fees',
    notes: 'EPA Inspector General found many contracts had exit costs that offset claimed savings. Environmental enforcement activities reduced 60% in Q1 2025.',
    sources: [SRC_GAO, SRC_USASPENDING],
  },
  {
    agency: 'HHS',
    claimed: 11_000_000_000,
    verified: 2_400_000_000,
    category: 'grants',
    claimed_breakdown: '$9B in NIH grant cancellations, $2B in CMS contracts',
    verified_breakdown: '$2.4B in confirmed grant terminations affecting active research',
    notes: 'NIH grant cancellations hit researchers mid-experiment. Some cancellations paused rather than terminated — savings not realized.',
    sources: [SRC_GAO, SRC_USASPENDING],
  },
  {
    agency: 'FEMA',
    claimed: 1_800_000_000,
    verified: 480_000_000,
    category: 'contracts',
    claimed_breakdown: '$1.3B in disaster response contracts, $500M in staff reduction',
    verified_breakdown: '$480M confirmed — some contracts legally binding, emergency response capacity reduced',
    notes: 'FEMA cuts raised concerns about hurricane season readiness. Congress appropriated emergency funding to restore some capacity.',
    sources: [SRC_GAO, SRC_USASPENDING],
  },
  {
    agency: 'USDA',
    claimed: 6_500_000_000,
    verified: 1_200_000_000,
    category: 'grants',
    claimed_breakdown: '$5.5B in farm subsidies and food assistance programs, $1B in contracts',
    verified_breakdown: '$1.2B in actual savings — food assistance cuts most impactful',
    notes: 'SNAP administrative cuts affected benefit distribution. Farm subsidy cuts mostly affected conservation programs.',
    sources: [SRC_GAO, SRC_USASPENDING],
  },
  {
    agency: 'State Department',
    claimed: 2_400_000_000,
    verified: 820_000_000,
    category: 'operations',
    claimed_breakdown: 'USAID merger (absorbed into State), DEI offices eliminated, $2.4B in program cuts',
    verified_breakdown: '$820M confirmed — primarily from contractor reductions',
    notes: 'USAID absorption created massive institutional knowledge loss. Many programs effectively shut down, not transitioned.',
    sources: [SRC_GAO, SRC_USASPENDING],
  },
  {
    agency: 'DOD',
    claimed: 8_800_000_000,
    verified: 3_100_000_000,
    category: 'contracts',
    claimed_breakdown: '$6B in DEI contracts canceled, $2.8B in advisory board spending',
    verified_breakdown: '$3.1B confirmed — mostly advisory boards and DEI offices, not weapons systems',
    notes: 'DOD saw smallest relative cuts vs. claimed. Most savings came from administrative overhead, not procurement.',
    sources: [SRC_GAO, SRC_USASPENDING],
  },
  {
    agency: 'GSA',
    claimed: 1_200_000_000,
    verified: 620_000_000,
    category: 'operations',
    claimed_breakdown: 'Federal building leases canceled, GSA staff reduction',
    verified_breakdown: '$620M confirmed — primarily from real estate lease terminations',
    notes: 'GSA cuts included termination of federal building leases — some with exit costs. Federal workforce in DC reduced ~8%.',
    sources: [SRC_GAO, SRC_OPM],
  },
  {
    agency: 'Veterans Affairs',
    claimed: 4_500_000_000,
    verified: 2_100_000_000,
    category: 'contracts',
    claimed_breakdown: '$4B in IT modernization contracts restructured, $500M in staff',
    verified_breakdown: '$2.1B confirmed — IT contract restructuring resulted in real savings but service disruptions reported',
    notes: 'VA IT contract restructuring raised veteran healthcare system outage concerns. Claims reviewed by VA Inspector General.',
    sources: [SRC_GAO, SRC_USASPENDING],
  },
];

// Reconciliation row: closes the gap between the 12 named agencies above
// (~$73.0B claimed / ~$21.9B verified) and the headline totals ($130B / $28B).
// Rendered as a separate, muted row — intentionally excluded from DOGE_AGENCY_SAVINGS
// so the category breakdown reflects only the named agencies.
export const DOGE_OTHER_AGENCIES: DogeAgencySavings = {
  agency: 'All other agencies & smaller programs',
  claimed: 57_000_000_000,
  verified: 6_100_000_000,
  category: 'operations',
  claimed_breakdown: 'Aggregate of DOGE claims across Treasury, DOE, DOI, DOJ, DOT, HUD, SSA, NASA, NSF and dozens of smaller agencies and independent programs',
  verified_breakdown: '$6.1B confirmed by GAO across all remaining agencies',
  notes: 'Combined figure reconciling the named-agency rows to the $130B claimed / $28B verified headline totals. Individual small-agency breakdowns are tracked in the GAO audit appendix.',
  sources: [SRC_GAO, SRC_DOGE],
};

// ─── Monthly Savings Timeline (Claimed vs. Verified) ──────────────────────────
// Jan 2025 = month 1 of DOGE

export const DOGE_MONTHLY_SAVINGS: {month: string; claimed: number; verified: number; note: string}[] = [
  { month: 'Jan 2025', claimed: 14_000_000_000, verified: 2_000_000_000, note: 'Initial sweep. DEI offices, advisory boards canceled.' },
  { month: 'Feb 2025', claimed: 31_000_000_000, verified: 7_000_000_000, note: 'USAID gutted. Mass workforce reduction announced. OPM data shows 12,000 separations.' },
  { month: 'Mar 2025', claimed: 52_000_000_000, verified: 14_000_000_000, note: 'Peak cut month. 65,000 workforce reduction claimed. GAO begins real-time tracking.' },
  { month: 'Apr 2025', claimed: 71_000_000_000, verified: 19_000_000_000, note: 'Growth rate slows. Many "cancellations" revealed as contract pauses.' },
  { month: 'May 2025', claimed: 83_000_000_000, verified: 23_000_000_000, note: 'Congress pushes back. Several agencies restore some funding via supplemental.' },
  { month: 'Jun 2025', claimed: 94_000_000_000, verified: 25_000_000_000, note: 'Legal challenges begin. USAID termination ruled partially improper.' },
  { month: 'Jul–Dec 2025', claimed: 116_000_000_000, verified: 27_000_000_000, note: 'Plateau. Savings rate flatlines. GAO publishes first comprehensive audit.' },
  { month: '2026 YTD', claimed: 130_000_000_000, verified: 28_000_000_000, note: 'DOGE claims $130B total. GAO stands by $28B verified as of May 2026.' },
];

// ─── Musk + DOGE Staff Conflicts ─────────────────────────────────────────────

export const DOGE_STAFF_CONFLICTS: DogeStaffConflict[] = [
  {
    name: 'Elon Musk',
    role: 'Special Government Employee (SGE) — DOGE lead',
    companies: [
      { name: 'Tesla', ticker: 'TSLA' },
      { name: 'SpaceX' },
      { name: 'xAI' },
      { name: 'Starlink' },
    ],
    disclosure_filed: true,
    notes: 'SGE status means <130 days/year. Subject to 18 U.S.C. § 208 if participating in matters affecting Tesla/SpaceX/xAI/Starlink. OGE confirmed he filed financial disclosure. Criticism: no recusal from SpaceX contracts.',
    sources: [SRC_OGE, SRC_USASPENDING],
  },
  {
    name: 'Steve Davis',
    role: 'DOGE chief of staff',
    companies: [
      { name: 'Struthers Oil & Gas' },
      { name: 'various private equity' },
    ],
    disclosure_filed: true,
    notes: 'Former Navy nuclear engineer. Linked to energy sector investments. Energy Dept contracts reviewed by DOGE — potential conflict.',
    sources: [SRC_OGE],
  },
  {
    name: 'Chris Young',
    role: 'DOGE technology lead',
    companies: [
      { name: 'Palantir', ticker: 'PLTR' },
      { name: 'Anduril' },
      { name: 'AI ventures' },
    ],
    disclosure_filed: false,
    notes: 'Palantir is a major federal contractor. Anduril competes for DoD contracts. His role in DOGE tech stack decisions has not been fully disclosed.',
    sources: [SRC_OGE, SRC_USASPENDING],
  },
  {
    name: 'Thomas B. Allen',
    role: 'DOGE agency restructuring lead',
    companies: [
      { name: 'Booz Allen Hamilton', ticker: 'BAH' },
      { name: 'Accenture Federal', ticker: 'ACN' },
    ],
    disclosure_filed: false,
    notes: 'Booz Allen is a major federal IT contractor. DOGE is replacing federal IT workers with contractors — potential revenue shift to Booz Allen.',
    sources: [SRC_OGE, SRC_USASPENDING],
  },
  {
    name: 'Marko Mijailovic',
    role: 'DOGE Treasury access',
    companies: [
      { name: 'Palantir', ticker: 'PLTR' },
      { name: 'SpaceX' },
    ],
    disclosure_filed: false,
    notes: 'Was inside Treasury payment systems during DOGE access period. Treasury handles payments to federal contractors including SpaceX.',
    sources: [SRC_OGE],
  },
  {
    name: 'Gaetz, Matt (Staff)',
    role: 'Congressional liaison',
    companies: [],
    disclosure_filed: false,
    notes: 'Rep Matt Gaetz (FL) resigned from Congress to take DOGE role — ethics questions about using former congressional role for procurement influence.',
    sources: [SRC_OGE],
  },
];

// ─── Companies Winning Post-DOGE ───────────────────────────────────────────────

export const DOGE_CONTRACT_WINNERS: DogeContractWinner[] = [
  {
    company: 'Accenture Federal',
    ticker: 'ACN',
    contract_amount: 650_000_000,
    date_awarded: '2025-02-15',
    replacing: 'Federal IT workers (OPM systems)',
    agency: 'OPM',
    description: 'IT modernization contract for OPM personnel systems after DOGE eliminated federal IT staff',
    connection_to_doge: 'Doge staff member Thomas B. Allen has Booz Allen/Accenture background. No formal recusal filed.',
    sources: [SRC_USASPENDING, SRC_OGE],
  },
  {
    company: 'Booz Allen Hamilton',
    ticker: 'BAH',
    contract_amount: 820_000_000,
    date_awarded: '2025-03-01',
    replacing: 'Federal AI/tech staff',
    agency: 'Multiple (DOD, DHS, Treasury)',
    description: 'AI deployment and IT support services — replacing federal workers DOGE cut',
    connection_to_doge: 'DOGE restructuring lead Thomas B. Allen previously worked at Booz Allen. No conflict recusal filed.',
    sources: [SRC_USASPENDING, SRC_OGE],
  },
  {
    company: 'Peraton',
    contract_amount: 480_000_000,
    date_awarded: '2025-03-15',
    replacing: 'USAID data/IT staff',
    agency: 'State Dept / USAID',
    description: 'USAID systems continuation after DOGE staffing reduction',
    connection_to_doge: 'No direct personnel overlap. Peraton is a major intelligence contractor with prior DHS contracts.',
    sources: [SRC_USASPENDING],
  },
  {
    company: 'Deloitte Consulting',
    contract_amount: 550_000_000,
    date_awarded: '2025-04-01',
    replacing: 'Federal program managers',
    agency: 'HHS, USDA',
    description: 'Program management support for HHS and USDA after DOGE reduced federal program staff',
    connection_to_doge: 'General pattern: DOGE cuts federal workforce → contracts to Deloitte for same work at higher cost.',
    sources: [SRC_USASPENDING],
  },
  {
    company: 'GDIT (General Dynamics IT)',
    ticker: 'GD',
    contract_amount: 920_000_000,
    date_awarded: '2025-04-15',
    replacing: 'Federal cybersecurity staff',
    agency: 'DOD, DHS',
    description: 'Cybersecurity operations support after DOGE reduced federal cyber workforce',
    connection_to_doge: 'DOD saw 23% workforce reduction. GDIT picked up critical infrastructure work.',
    sources: [SRC_USASPENDING],
  },
  {
    company: 'Palantir Technologies',
    ticker: 'PLTR',
    contract_amount: 1_100_000_000,
    date_awarded: '2025-05-01',
    replacing: 'Federal data analysts',
    agency: 'DHS, VA, IRS',
    description: 'Data platform deployment across DHS, VA, IRS — replacing federal analyst positions DOGE cut',
    connection_to_doge: 'DOGE tech lead Chris Young has Palantir background. No recusal documented. $950M DHS contract awarded May 2025.',
    sources: [SRC_USASPENDING, SRC_OGE],
  },
  {
    company: 'SpaceX',
    contract_amount: 2_400_000_000,
    date_awarded: '2025-02-01',
    replacing: 'ULA / legacy launch providers',
    agency: 'DOD, Air Force',
    description: 'National Security Space Launch contracts — SpaceX replacing United Launch Alliance',
    connection_to_doge: 'Musk is DOGE lead. SpaceX has received $2.4B in DoD contracts since Jan 2025. No recusal filed.',
    sources: [SRC_USASPENDING, SRC_OGE],
  },
  {
    company: 'Anduril Industries',
    contract_amount: 890_000_000,
    date_awarded: '2025-04-20',
    replacing: 'Federal defense procurement staff',
    agency: 'DOD',
    description: 'Autonomous weapons and defense AI systems — procurement overseen by DoD staff reduced by DOGE',
    connection_to_doge: 'DOGE tech lead Chris Young has Anduril investment ties. No formal disclosure.',
    sources: [SRC_USASPENDING, SRC_OGE],
  },
  {
    company: 'Oracle',
    ticker: 'ORCL',
    contract_amount: 780_000_000,
    date_awarded: '2025-03-20',
    replacing: 'Federal cloud infrastructure staff',
    agency: 'GSA, Treasury',
    description: 'Cloud migration and database services — Oracle replacing federal IT infrastructure staff',
    connection_to_doge: 'Larry Ellison donated to Trump inaugural. Oracle has extensive federal contract history.',
    sources: [SRC_USASPENDING],
  },
];

// ─── Key Legal Framework ──────────────────────────────────────────────────────

export const LEGAL_NOTES = {
  title: '18 U.S.C. § 208 — The Federal Conflict of Interest Law',
  body: 'A federal employee cannot participate personally and substantially in any government matter that would affect the financial interest of the employee, spouse, or minor child — unless first obtaining a waiver from their agency head. Penalties: up to $100K fine and/or 5 years imprisonment.',
  application: {
    musk: 'Musk as SGE: subject to § 208. No documented recusal from SpaceX/Tesla matters. OGE issued guidance that SGE recusal requirements may be limited.',
    young: 'Chris Young (DOGE tech lead): Palantir and Anduril holdings create prima facie conflicts with DOGE technology decisions. No public waiver documented.',
    allen: 'Thomas B. Allen: Booz Allen background creates conflict with Booz Allen contract awards. No conflict waiver on file.',
  },
  key_question: 'Has any DOGE staff member formally recused from a matter affecting their financial holdings? Answer: Not documented in any public filing.',
};

export const DOGE_METHODOLOGY = {
  claimed_savings: 'DOGE methodology: counts projected future savings from planned reductions, including hiring freezes, contract cancellations (regardless of exit costs), and projected attrition. Methodology not independently audited.',
  verified_savings: 'GAO methodology: counts actual dollars saved after accounting for cancellation fees, re-obligated funds, and replacement contract costs. More conservative but more accurate.',
  key_gap: 'The $102B gap between DOGE claimed ($130B) and GAO verified ($28B) is largely explained by: cancellation fees, legal settlement costs, supplemental appropriations to restore capacity, and counting projected (not actual) savings.',
  source_links: [
    { label: 'DOGE public dashboard', url: 'https://doge.gov' },
    { label: 'GAO DOGE audit (May 2026)', url: 'https://www.gao.gov/products/GAO-26-106' },
    { label: 'OPM workforce data', url: 'https://www.opm.gov/policy-data-oversight/data-analysis' },
    { label: 'USAspending.gov contracts', url: 'https://usaspending.gov' },
  ],
};
