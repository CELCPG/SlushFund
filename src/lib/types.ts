// ─── Award Types ─────────────────────────────────────────────────────────────
export type AwardCategory = 'contract' | 'grant' | 'loan' | 'direct_payment' | 'other';

export type CompetitionStatus =
  | 'open_competition'
  | 'limited_competition'
  | 'no_bid'
  | 'sole_source'
  | 'unknown';

// ─── Flags ────────────────────────────────────────────────────────────────────
// Competition flags
export type CompetitionFlag = 'no_bid' | 'sole_source' | 'limited_competition' | 'non_competitive';
// Price/Value flags
export type PriceFlag = 'no_compete_high_value' | 'large_award' | 'inflated' | 'cost_plus';
// Connection flags
export type ConnectionFlag = 'related_party' | 'donor' | 'lobbyist' | 'mar-a-lago';
// Structural flags
export type StructuralFlag = 'covid_related' | 'infrastructure' | 'emergency' | 'pass_through';

export type ContractFlag = CompetitionFlag | PriceFlag | ConnectionFlag | StructuralFlag;

// ─── Connection Types ────────────────────────────────────────────────────────
export type ConnectionType =
  | 'trump_family'
  | 'elon_musk'
  | 'trump_ally'
  | 'mar-a-lago'
  | 'gop_donor'
  | 'lobbyist'
  | 'none'
  | 'suspected';

// ─── Core Award Record (contracts, grants, loans, direct payments) ────────────
export interface Award {
  id: string;
  award_id: string; // PIID for contracts, FAIN for grants, URI for loans

  // Recipient
  recipient_name: string;
  recipient_uei: string | null;
  recipient_duns: string | null;
  recipient_parent_name: string | null;
  recipient_location: string | null;

  // Amount
  dollar_amount: number;
  total_outlays: number | null;
  subsidy_cost: number | null; // loans only
  loan_value: number | null;   // loans only

  // Description
  description: string;
  assistance_listing: string | null; // CFDA number for grants
  cfda_program: string | null;

  // Agency
  awarding_agency: string;
  awarding_agency_code: string;
  awarding_sub_agency: string;
  funding_agency: string;
  funding_agency_code: string;
  funding_sub_agency: string;

  // Classification
  award_category: AwardCategory;
  contract_type: string;    // original type code from USAspending
  competition_status: CompetitionStatus;
  extent_competed: string | null;
  extent_competed_code: string | null;
  naics_code: string | null;
  psc_code: string | null;

  // Dates
  posted_date: string;
  performance_start: string | null;
  performance_end: string | null;
  base_obligation_date: string;
  last_modified_date: string;

  // Place of performance
  pop_state: string | null;
  pop_country: string;
  pop_city: string | null;
  primary_place_of_performance: string | null;

  // Flags
  flags: ContractFlag[];
  competition_flags: CompetitionFlag[];
  price_flags: PriceFlag[];
  connection_flags: ConnectionFlag[];
  structural_flags: StructuralFlag[];

  // Political connection
  connection_type: ConnectionType | null;
  political_connection: string | null;
  confidence: 'high' | 'medium' | 'low';
  connection_sources: string[];

  // Risk scoring
  risk_score: number;
  risk_factors: string[];

  // Inflation analysis
  estimated_market_rate: number | null;
  price_premium_pct: number | null;

  // COVID / Infrastructure
  covid_obligations: number | null;
  covid_outlays: number | null;
  infrastructure_obligations: number | null;
  infrastructure_outlays: number | null;

  // Links
  fpds_url: string | null;
  usaspending_url: string | null;

  // Metadata
  notes: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

// ─── Backward-compatibility alias ──────────────────────────────────────────────
export type Contract = Award;

// ─── Vendor (for company-level aggregation) ──────────────────────────────────
export interface Vendor {
  recipient_name: string;
  recipient_uei: string | null;
  total_contracts: number;
  total_grants: number;
  total_dollars: number;
  awards: Award[];
  connection_type: ConnectionType | null;
  political_connection: string | null;
  risk_score: number;
  flags: ContractFlag[];
}

// ─── Agency Spending ─────────────────────────────────────────────────────────
export interface AgencySpending {
  agency: string;
  agency_code: string;
  fiscal_year: number;
  total_obligations: number;
  total_awards: number;
  contract_count: number;
  grant_count: number;
  connected_dollars: number;
  flagged_dollars: number;
  top_vendors: { name: string; dollars: number; connection: ConnectionType | null }[];
}

// ─── Monthly Trend ───────────────────────────────────────────────────────────
export interface MonthlySpending {
  month: string;
  total_contracts: number;
  total_grants: number;
  total_loans: number;
  total_dollars: number;
  connected_dollars: number;
  flagged_dollars: number;
  no_bid_dollars: number;
  new_awards: number;
}

// ─── Political Connection Group ─────────────────────────────────────────────
export interface ConnectionGroup {
  connection_type: ConnectionType;
  label: string;
  total_dollars: number;
  award_count: number;
  vendor_count: number;
  flags: ContractFlag[];
  awards: Award[];
}

// ─── Risk Score Breakdown ───────────────────────────────────────────────────
export interface RiskBreakdown {
  overall_score: number;
  connection_score: number;
  competition_score: number;
  price_score: number;
  structural_score: number;
  factors: string[];
}

// ─── API Response Shapes ─────────────────────────────────────────────────────
export interface AwardsResponse {
  awards: Award[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  demo?: boolean;
}

export interface StatsResponse {
  total_awards: number;
  total_dollars: number;
  contract_count: number;
  grant_count: number;
  loan_count: number;
  connected_count: number;
  connected_dollars: number;
  flagged_count: number;
  flagged_dollars: number;
  no_bid_count: number;
  no_bid_dollars: number;
  breakdown: ConnectionBreakdown[];
  top_agencies: AgencySpending[];
  monthly_trend: MonthlySpending[];
}

export interface ConnectionBreakdown {
  connection_type: ConnectionType;
  label: string;
  count: number;
  total: number;
  risk_score_avg: number;
}

// ─── Stock Holdings & Insider Trading ────────────────────────────────────────
export interface StockHolding {
  ticker: string;
  company_name: string;
  politician_name: string;
  shares_owned: number | null;
  estimated_value_low: number;
  estimated_value_high: number;
  filing_date: string;
  filing_type: 'periodic' | 'initial' | 'annual' | 'amended';
  source_url: string;
  sector: string;
  notes: string;
}

export interface InsiderTradingSignal {
  id: string;
  company_ticker: string;
  company_name: string;
  politician_name: string;
  filing_date: string;
  transaction_type: 'purchase' | 'sale' | 'exchange';
  shares_estimate: number | null;
  estimated_value: number;
  related_contract?: {
    contract_id: string;
    dollar_amount: number;
    awarding_agency: string;
    description: string;
    date: string;
  };
  sector: string;
  confidence: 'high' | 'medium' | 'low';
  analysis_notes: string;
  source_url: string;
}

// ─── Cost Overrun / Project Inflation ────────────────────────────────────────
export interface CostOverrun {
  id: string;
  project_name: string;
  original_cost: number;
  final_cost: number;
  overrun_pct: number;
  agency: string;
  contractor: string;
  state: string;
  start_year: number;
  end_year: number;
  description: string;
  flagged_reason: string;
  source_url: string;
  notes: string;
}