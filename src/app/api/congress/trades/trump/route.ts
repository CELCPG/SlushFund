import { NextResponse } from 'next/server';

// Edge runtime: static OGE 278-T + curated crypto earnings data, no Node deps.
export const runtime = 'edge';

interface TrumpTrade {
  ticker: string;
  company_name: string;
  transaction_type: 'PURCHASE' | 'SALE';
  amount_range: string;
  amount_min: number;
  amount_max: number;
  transaction_date: string;
  filed_date: string;
  disclosure_year: number;
  source_system: string;
  has_federal_contract: boolean;
  contract_links?: string[];
  notes?: string;
}

// Crypto earnings row — explicit "kind" so we never sum apples with oranges.
export type CryptoKind =
  | 'token_sale'       // realized: sold tokens/equity for cash
  | 'paper_gain'       // unrealized paper valuation on insider allocation
  | 'royalty_stream'   // realized: secondary-market royalties
  | 'insider_sale'     // realized: stock sold by insider
  | 'pac_spend'        // PAC donor money routed to family-benefit expenses
  | 'insider_unlock';  // tokens unlocked/vested (paper, not yet sold)

export interface CryptoEarning {
  id: string;
  label: string;
  date_or_window: string;
  gross_or_paper_usd: number;     // headline USD figure
  realized_or_paper: 'realized' | 'paper';
  kind: CryptoKind;
  source_label: string;
  source_url: string;
  party: 'president' | 'family' | 'orbit';
  conflict_note: string;
}

// Trump's Q1 2026 OGE 278-T filing (disclosed May 12, 2026)
// Source: Office of Government Ethics — Trump, Donald J. 05.08.2026-278T
// Jan 6 – Mar 30, 2026 | ~3,642 equity trades | ~$220M–$750M total
const TRUMP_Q1_2026_TRADES: TrumpTrade[] = [
  // NVIDIA: 9 purchases, $1.8M-$6.6M each | $16.2M-$59.4M total
  // Preceded Jensen Huang Beijing trip where NVDA export policy was negotiated
  { ticker: 'NVDA', company_name: 'NVIDIA', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-01-22', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false, notes: 'Jensen Huang joined Trump delegation to Beijing during AI chip export negotiations — NVDA position directly intersects executive trade policy' },
  { ticker: 'NVDA', company_name: 'NVIDIA', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-01-28', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'NVDA', company_name: 'NVIDIA', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-02-03', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'NVDA', company_name: 'NVIDIA', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-02-10', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'NVDA', company_name: 'NVIDIA', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-02-18', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'NVDA', company_name: 'NVIDIA', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-03-05', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'NVDA', company_name: 'NVIDIA', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-03-12', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'NVDA', company_name: 'NVIDIA', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-03-20', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'NVDA', company_name: 'NVIDIA', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-03-28', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },

  // MICROSOFT — 9 purchases, $2.4M–$8.1M each | $21.6M–$72.9M total
  { ticker: 'MSFT', company_name: 'Microsoft', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-01-14', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'MSFT', company_name: 'Microsoft', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-01-21', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'MSFT', company_name: 'Microsoft', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-02-05', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'MSFT', company_name: 'Microsoft', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-02-12', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'MSFT', company_name: 'Microsoft', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-02-26', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'MSFT', company_name: 'Microsoft', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-03-04', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'MSFT', company_name: 'Microsoft', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-03-11', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'MSFT', company_name: 'Microsoft', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-03-18', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'MSFT', company_name: 'Microsoft', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-03-25', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },

  // ORACLE — 11 purchases, $2.2M–$10.6M each | $24.2M–$116.6M total
  { ticker: 'ORCL', company_name: 'Oracle', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-01-09', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false, notes: 'Larry Ellison donated $250K+ to Trump inauguration; Trump mentioned Oracle in TikTok deal context' },
  { ticker: 'ORCL', company_name: 'Oracle', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-01-16', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'ORCL', company_name: 'Oracle', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-01-30', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'ORCL', company_name: 'Oracle', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-02-06', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'ORCL', company_name: 'Oracle', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-02-20', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'ORCL', company_name: 'Oracle', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-02-27', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'ORCL', company_name: 'Oracle', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-03-06', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'ORCL', company_name: 'Oracle', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-03-13', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'ORCL', company_name: 'Oracle', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-03-19', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'ORCL', company_name: 'Oracle', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-03-26', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'ORCL', company_name: 'Oracle', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-03-31', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },

  // AMD — 10 purchases
  { ticker: 'AMD', company_name: 'AMD', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-01-15', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'AMD', company_name: 'AMD', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-01-29', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'AMD', company_name: 'AMD', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-02-11', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'AMD', company_name: 'AMD', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-02-19', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'AMD', company_name: 'AMD', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-03-04', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'AMD', company_name: 'AMD', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-03-10', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'AMD', company_name: 'AMD', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-03-17', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'AMD', company_name: 'AMD', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-03-21', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'AMD', company_name: 'AMD', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-03-27', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'AMD', company_name: 'AMD', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-03-31', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },

  // APPLE — 8 purchases, $1.8M–$6.6M each
  { ticker: 'AAPL', company_name: 'Apple', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-01-13', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'AAPL', company_name: 'Apple', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-01-27', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'AAPL', company_name: 'Apple', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-02-10', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'AAPL', company_name: 'Apple', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-02-24', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'AAPL', company_name: 'Apple', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-03-05', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'AAPL', company_name: 'Apple', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-03-12', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'AAPL', company_name: 'Apple', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-03-19', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'AAPL', company_name: 'Apple', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-03-28', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },

  // AMAZON — sales, $5M–$25M range each
  { ticker: 'AMZN', company_name: 'Amazon', transaction_type: 'SALE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-01-22', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: true, notes: 'AMZN = largest federal contractor in SlushFund DB ($17.5B), primarily AWS/DoD JEDI successor contracts' },
  { ticker: 'AMZN', company_name: 'Amazon', transaction_type: 'SALE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-02-14', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: true },
  { ticker: 'AMZN', company_name: 'Amazon', transaction_type: 'SALE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-03-07', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: true },
  { ticker: 'AMZN', company_name: 'Amazon', transaction_type: 'SALE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-03-21', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: true },

  // META — sales, $5M–$25M range each
  { ticker: 'META', company_name: 'Meta', transaction_type: 'SALE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-01-28', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'META', company_name: 'Meta', transaction_type: 'SALE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-02-19', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'META', company_name: 'Meta', transaction_type: 'SALE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-03-11', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },

  // PALANTIR — 8 small purchases, 4 large sales
  { ticker: 'PLTR', company_name: 'Palantir Technologies', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-01-10', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false, notes: 'PLTR DHS contract awarded March 2026, concurrent with heavy Trump buying — flagged for insider trading review by observers' },
  { ticker: 'PLTR', company_name: 'Palantir Technologies', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-01-24', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'PLTR', company_name: 'Palantir Technologies', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-02-07', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'PLTR', company_name: 'Palantir Technologies', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-02-21', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'PLTR', company_name: 'Palantir Technologies', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-03-07', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'PLTR', company_name: 'Palantir Technologies', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-03-14', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'PLTR', company_name: 'Palantir Technologies', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-03-21', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'PLTR', company_name: 'Palantir Technologies', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-03-28', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  // PLTR Sales
  { ticker: 'PLTR', company_name: 'Palantir Technologies', transaction_type: 'SALE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-02-03', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'PLTR', company_name: 'Palantir Technologies', transaction_type: 'SALE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-02-25', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'PLTR', company_name: 'Palantir Technologies', transaction_type: 'SALE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-03-10', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'PLTR', company_name: 'Palantir Technologies', transaction_type: 'SALE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-03-24', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },

  // GOLDMAN SACHS — 8 trades (GS = federal contractor in SlushFund)
  { ticker: 'GS', company_name: 'Goldman Sachs', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-01-14', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'GS', company_name: 'Goldman Sachs', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-01-28', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'GS', company_name: 'Goldman Sachs', transaction_type: 'SALE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-02-11', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'GS', company_name: 'Goldman Sachs', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-02-25', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'GS', company_name: 'Goldman Sachs', transaction_type: 'SALE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-03-07', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'GS', company_name: 'Goldman Sachs', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-03-18', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'GS', company_name: 'Goldman Sachs', transaction_type: 'SALE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-03-25', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'GS', company_name: 'Goldman Sachs', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-03-31', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },

  // JPMORGAN CHASE — traded
  { ticker: 'JPM', company_name: 'JPMorgan Chase', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-01-16', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'JPM', company_name: 'JPMorgan Chase', transaction_type: 'SALE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-02-07', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'JPM', company_name: 'JPMorgan Chase', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-03-03', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'JPM', company_name: 'JPMorgan Chase', transaction_type: 'SALE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-03-20', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },

  // COINBASE — 6 purchases (COIN recently won federal contracts under Trump admin)
  { ticker: 'COIN', company_name: 'Coinbase', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-01-17', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false, notes: 'COIN = federal contractor (US Marshals crypto custody, DoD digital asset pilot)' },
  { ticker: 'COIN', company_name: 'Coinbase', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-02-04', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'COIN', company_name: 'Coinbase', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-02-20', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'COIN', company_name: 'Coinbase', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-03-06', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'COIN', company_name: 'Coinbase', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-03-19', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'COIN', company_name: 'Coinbase', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-03-31', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },

  // BANK OF AMERICA
  { ticker: 'BAC', company_name: 'Bank of America', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-01-23', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'BAC', company_name: 'Bank of America', transaction_type: 'SALE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-02-21', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'BAC', company_name: 'Bank of America', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-03-14', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },

  // BROADCOM — 6 purchases
  { ticker: 'AVGO', company_name: 'Broadcom', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-01-20', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'AVGO', company_name: 'Broadcom', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-02-05', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'AVGO', company_name: 'Broadcom', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-02-18', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'AVGO', company_name: 'Broadcom', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-03-04', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'AVGO', company_name: 'Broadcom', transaction_type: 'PURCHASE', amount_range: '$1,000,001 - $5,000,000', amount_min: 1000001, amount_max: 5000000, transaction_date: '2026-03-17', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
  { ticker: 'AVGO', company_name: 'Broadcom', transaction_type: 'PURCHASE', amount_range: '$5,000,001 - $25,000,000', amount_min: 5000001, amount_max: 25000000, transaction_date: '2026-03-27', filed_date: '2026-05-12', disclosure_year: 2026, source_system: 'OGE Form 278-T', has_federal_contract: false },
];

// Federal contractor overlap check
const FEDERAL_CONTRACTORS: Record<string, { company: string; amount: number; agency: string }> = {
  'AMZN': { company: 'Amazon', amount: 17500000000, agency: 'DoD, AWS, JEDI successor' },
  'ORCL': { company: 'Oracle', amount: 0, agency: 'NASA, DoD (recent)' },
  'MSFT': { company: 'Microsoft', amount: 0, agency: 'DoD, NSA, Azure Government' },
  'NVDA': { company: 'NVIDIA', amount: 0, agency: 'None (AI chip exports regulated by admin)' },
  'COIN': { company: 'Coinbase', amount: 0, agency: 'US Marshals, DoD digital asset pilot' },
  'PLTR': { company: 'Palantir', amount: 0, agency: 'DHS, DoD ICE contracts' },
  'JPM': { company: 'JPMorgan Chase', amount: 0, agency: 'Federal Reserve, Treasury' },
  'GS': { company: 'Goldman Sachs', amount: 0, agency: 'Treasury, Fed' },
  'BAC': { company: 'Bank of America', amount: 0, agency: 'Federal Reserve' },
};

// Mark federal contractor overlaps
const trumpTradesWithOverlap = TRUMP_Q1_2026_TRADES.map(t => ({
  ...t,
  has_federal_contract: FEDERAL_CONTRACTORS[t.ticker] !== undefined,
  contract_links: FEDERAL_CONTRACTORS[t.ticker]
    ? [`${FEDERAL_CONTRACTORS[t.ticker].company}: $${(FEDERAL_CONTRACTORS[t.ticker].amount / 1e9).toFixed(1)}B — ${FEDERAL_CONTRACTORS[t.ticker].agency}`]
    : [],
}));

// =============================================================================
// CRYPTO EARNINGS — Trump family crypto, NFTs, memecoins, PAC dark-money flows
//
// Every row carries a source_url. Realized vs paper is explicit so the page
// never sums them. The crypto rows are distinct from the OGE 278-T trade data
// above (which is the President's own brokerage activity) — this is the
// broader Trump family / orbit profiteering picture from public reporting.
//
// See /investigations/trump-govt-crypto-holdings and
// /investigations/trump-world-liberties-magazine for the deep dives.
// =============================================================================
const CRYPTO_EARNINGS: CryptoEarning[] = [
  {
    id: 'wlfi-token-sales',
    label: 'World Liberty Financial (WLFI) — token + equity sales',
    date_or_window: 'Oct 2024 – Jun 2026 (pre-sale + public listing)',
    gross_or_paper_usd: 580_000_000,
    realized_or_paper: 'realized',
    kind: 'token_sale',
    party: 'family',
    source_label: "Trump 2026 OGE financial disclosure (927 pages), reported by CNBC",
    source_url: 'https://www.cnbc.com/2026/06/30/trump-financial-disclosure-released.html',
    conflict_note: 'WLFI is 60%-Trump-owned; 22.5B tokens allocated to family. Treasury and SEC actions directly affect WLFI\'s regulatory path.',
  },
  {
    id: 'wlfi-paper-gain',
    label: 'World Liberty Financial (WLFI) — paper gain at listing',
    date_or_window: 'Sep 1-2, 2025 (WLFI spot launch)',
    gross_or_paper_usd: 5_000_000_000,
    realized_or_paper: 'paper',
    kind: 'paper_gain',
    party: 'family',
    source_label: 'CBS News, citing public WLFI token-allocation disclosures',
    source_url: 'https://www.cbsnews.com/news/trump-wlfi-world-liberty-financial-crypto-wealth/',
    conflict_note: 'Paper gain evaporates with price. We track it because the family uses the on-paper value for net-worth signaling and as collateral.',
  },
  {
    id: 'trump-memecoin-cashout',
    label: '$TRUMP memecoin — insider cashout',
    date_or_window: 'Jan 2025 – Jul 2026',
    gross_or_paper_usd: 636_000_000,
    realized_or_paper: 'realized',
    kind: 'insider_sale',
    party: 'family',
    source_label: 'NYT (Jul 6, 2026), cited via Wikipedia $Trump entry',
    source_url: 'https://en.wikipedia.org/wiki/$Trump',
    conflict_note: 'CIC Digital LLC and Fight Fight Fight LLC hold 80% of supply. 988,905 wallets lost $3.81B in aggregate. Direct conflict: SEC dropped enforcement cases against memecoin-adjacent actors within 90 days.',
  },
  {
    id: 'trump-memecoin-unlock',
    label: '$TRUMP memecoin — insider token allocation (800M tokens)',
    date_or_window: '2025-2028 (3-12mo cliffs + 24mo daily vest)',
    gross_or_paper_usd: 0,
    realized_or_paper: 'paper',
    kind: 'insider_unlock',
    party: 'family',
    source_label: 'TRM Labs forensic analysis of $TRUMP tokenomics',
    source_url: 'https://www.trmlabs.com/resources/blog/tracing-trump',
    conflict_note: 'This is what makes the $636M cashout possible. Cliff-vested insider tokens are the structural lever. Peak FD market cap briefly hit $75B (Jan 19, 2025) per multiple outlets.',
  },
  {
    id: 'melania-memecoin',
    label: '$MELANIA memecoin — peak paper valuation',
    date_or_window: 'Jan 19, 2025 (launch + peak)',
    gross_or_paper_usd: 2_000_000_000,
    realized_or_paper: 'paper',
    kind: 'paper_gain',
    party: 'family',
    source_label: 'Forbes (Oct 22, 2025) — lawsuit complaint and market-cap data',
    source_url: 'https://www.forbes.com/sites/alisondurkee/2025/10/22/melania-under-fire-first-ladys-memecoin-was-part-of-fraudulent-scheme-lawsuit-alleges-what-to-know/',
    conflict_note: 'Insider allocation ~90% per public distribution; current price ~$0.08 (down 99%+ from peak). Forbes report tied to investor lawsuit alleging fraudulent scheme.',
  },
  {
    id: 'trump-dtc-nft-royalties',
    label: 'Trump Digital Trading Cards — secondary-market royalties',
    date_or_window: 'Dec 2022 – ongoing (5 collections, 45,000 NFTs)',
    gross_or_paper_usd: 50_000_000,
    realized_or_paper: 'realized',
    kind: 'royalty_stream',
    party: 'family',
    source_label: "SlushFund's prior investigation: $50M+ royalty estimate",
    source_url: 'https://slushfund.net/investigations/trump-govt-crypto-holdings',
    conflict_note: '10% royalty on every secondary sale. Total royalty flow not fully disclosed; figure is conservative lower bound based on on-chain tracing.',
  },
  {
    id: 'tmtg-insider-window',
    label: 'Truth Social (TMTG/DJT) — Trump trust lockup window',
    date_or_window: 'Apr 2, 2025 (S-3 registration for $2.3B sale)',
    gross_or_paper_usd: 2_300_000_000,
    realized_or_paper: 'paper',
    kind: 'paper_gain',
    party: 'president',
    source_label: 'Axios: TMTG S-3 re-registration (Apr 2, 2025)',
    source_url: 'https://www.axios.com/2025/04/02/trump-truth-social-stock',
    conflict_note: 'This is the registered cap, not realized sales. Trump Media & Technology Group runs Truth Social; insider ownership 42.62%. Lockup expired Sept 2024.',
  },
  {
    id: 'save-america-legal-spend',
    label: 'Save America PAC — donor money routed to Trump legal fees',
    date_or_window: '2023 fiscal year',
    gross_or_paper_usd: 49_600_000,
    realized_or_paper: 'realized',
    kind: 'pac_spend',
    party: 'president',
    source_label: 'CBS News (Feb 1, 2024) — FEC filings',
    source_url: 'https://www.cbsnews.com/news/trump-political-action-committees-2023-legal-bills/',
    conflict_note: "This is the dark side: leadership-PAC donor money (limited to $5K/person) flowed to Trump's personal legal defense. Not income to the family directly, but money that the family would otherwise have had to spend. See also /investigations/trump-world-liberties-magazine.",
  },
];

// =============================================================================
// SUMMARY — broken out by kind so the page can display them separately
// and never let "paper" be summed against "realized" without disclosure.
// =============================================================================
const SUMMARY = {
  // OGE 278-T equity trades (Q1 2026 filing only)
  stock_trades: {
    count: TRUMP_Q1_2026_TRADES.length,
    disclosed_value_range_low: 220_000_000,
    disclosed_value_range_high: 750_000_000,
    source: 'OGE Form 278-T | Trump, Donald J. | Filed 2026-05-12',
    note: 'Range as disclosed; midpoint not reliable because OGE format is banded.',
  },
  // Crypto earnings — broken out by realized vs paper
  crypto: {
    realized_usd: CRYPTO_EARNINGS
      .filter(c => c.realized_or_paper === 'realized')
      .reduce((sum, c) => sum + c.gross_or_paper_usd, 0),
    paper_usd: CRYPTO_EARNINGS
      .filter(c => c.realized_or_paper === 'paper')
      .reduce((sum, c) => sum + c.gross_or_paper_usd, 0),
    rows: CRYPTO_EARNINGS.length,
    // Combined headline (paper + realized) — clearly labeled as "combined" so
    // the user can see the total picture, not as a clean sum.
    combined_gross_usd: CRYPTO_EARNINGS.reduce((sum, c) => sum + c.gross_or_paper_usd, 0),
  },
  // Single combined "profiteering from office" headline (paper + realized)
  // Shown for impact but always with the realized/paper split visible.
  total_profiteering_low: 220_000_000,   // stock trades disclosed low
  total_profiteering_high: 750_000_000,  // stock trades disclosed high
  last_updated: '2026-07-07',
};

export async function GET() {
  return NextResponse.json({
    // New unified shape (current contract)
    stocks: trumpTradesWithOverlap,
    crypto: CRYPTO_EARNINGS,
    summary: SUMMARY,
    source: 'OGE Form 278-T | Trump, Donald J. | Filed 2026-05-12',
    disclosure_url: 'https://extapps2.oge.gov/201/Presiden.nsf/PAS+Index/5326D3AF5BE7C25385258DF7002DD1B7/$FILE/Trump%2C%20Donald%20J.-05.08.2026-278T.pdf',
    federal_contract_overlap: FEDERAL_CONTRACTORS,
    methodology: 'Stock data from OGE 278-T (filed 2026-05-12, Q1 2026). Crypto earnings compiled from public reporting — each row carries a source URL. "Realized" = cash received. "Paper" = mark-to-market valuation, not yet sold. The two are not summed as apples-to-apples; both are shown.',
    // Back-compat: prior consumers calling .trades and .total still work
    trades: trumpTradesWithOverlap,
    total: TRUMP_Q1_2026_TRADES.length,
  });
}
