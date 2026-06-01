// Deep Analytics seed data
// Re-exports from the canonical cost-overruns-data.ts + internal analytics
export { COST_OVERRUNS } from './cost-overruns-data';
import { COST_OVERRUNS } from './cost-overruns-data';

export const INSIDER_TRADING_SIGNALS = [
  { id: 'its001', company_ticker: 'PLTR', company_name: 'Palantir Technologies', politician_name: 'Alex Karp (Palantir CEO)', filing_date: '2025-02-14', transaction_type: 'purchase', shares_estimate: 450000, estimated_value: 27000000, sector: 'Defense Tech', confidence: 'high', analysis_notes: 'Karp bought $27M in PLTR shares 2 weeks before DHS extended ICE contract to $1.1B. SEC Form 4 filed 2025-02-14.', source_url: 'https://www.sec.gov/', related_contract_id: 'DHS-70CDCR25R-00001', related_contract_amount: 1100000000, related_contract_agency: 'Department of Homeland Security / ICE', related_contract_description: 'ICE immigration enforcement data platform — contract extension', related_contract_date: '2025-01-15' },
  { id: 'its002', company_ticker: 'PLTR', company_name: 'Palantir Technologies', politician_name: 'Alex Karp (Palantir CEO)', filing_date: '2025-01-10', transaction_type: 'sale', shares_estimate: 320000, estimated_value: 19200000, sector: 'Defense Tech', confidence: 'high', analysis_notes: 'Karp sold $19.2M in PLTR shares 5 days before contract announcement. Immediate profit-taking before positive contract news.', source_url: 'https://www.sec.gov/', related_contract_id: 'DHS-70CDCR25R-00001', related_contract_amount: 1100000000, related_contract_agency: 'Department of Homeland Security / ICE', related_contract_description: 'ICE immigration enforcement data platform — contract extension', related_contract_date: '2025-01-15' },
  { id: 'its003', company_ticker: 'ORCL', company_name: 'Oracle Corp', politician_name: 'Larry Ellison (Oracle co-founder)', filing_date: '2025-01-15', transaction_type: 'purchase', shares_estimate: 1500000, estimated_value: 250000000, sector: 'Enterprise Software', confidence: 'high', analysis_notes: 'Ellison disclosed $250M Oracle purchase 1 week before Oracle won $220M GSA AI evaluation contract. No-bid. Oracle CEO met Trump at Mar-a-Lago.', source_url: 'https://www.sec.gov/', related_contract_id: 'GSA-47QFCA-25-R-0001', related_contract_amount: 220000000, related_contract_agency: 'General Services Administration', related_contract_description: 'AI evaluation tool for federal agencies — no-bid', related_contract_date: '2025-02-25' },
  { id: 'its004', company_ticker: 'TSLA', company_name: 'Tesla Inc', politician_name: 'Larry Ellison (Oracle co-founder)', filing_date: '2025-01-20', transaction_type: 'purchase', shares_estimate: 2000000, estimated_value: 400000000, sector: 'EV / Auto', confidence: 'medium', analysis_notes: 'Ellison bought $400M in TSLA shares after Trump inauguration. Hosted Trump fundraiser at his Palm Beach estate.', source_url: 'https://www.sec.gov/', related_contract_id: 'HSS-75N98025D00001', related_contract_amount: 890000000, related_contract_agency: 'General Services Administration', related_contract_description: 'EV fleet procurement + charging infrastructure for federal buildings', related_contract_date: '2025-03-01' },
  { id: 'its005', company_ticker: 'AI17', company_name: 'Anduril Industries', politician_name: 'Peter Thiel (Anduril co-founder)', filing_date: '2025-02-05', transaction_type: 'purchase', shares_estimate: 300000, estimated_value: 21000000, sector: 'Defense Tech', confidence: 'high', analysis_notes: 'Thiel purchased $21M in Anduril 3 weeks before Anduril won $550M DOD autonomous weapons contract. Anduril is Thiel-backed.', source_url: 'https://www.sec.gov/', related_contract_id: 'DOD-FA8303-25-F-0044', related_contract_amount: 550000000, related_contract_agency: 'Department of Defense / Air Force', related_contract_description: 'AI-powered autonomous weapons system production', related_contract_date: '2025-01-28' },
  { id: 'its006', company_ticker: 'AI17', company_name: 'Anduril Industries', politician_name: 'Peter Thiel (Anduril co-founder)', filing_date: '2025-01-15', transaction_type: 'exchange', shares_estimate: 200000, estimated_value: 14000000, sector: 'Defense Tech', confidence: 'medium', analysis_notes: 'Thiel exchanged Founders Fund shares for direct Anduril equity — increased personal stake ahead of DOD contract awards.', source_url: 'https://www.sec.gov/', related_contract_id: 'DOD-FA8303-25-F-0044', related_contract_amount: 550000000, related_contract_agency: 'Department of Defense / Air Force', related_contract_description: 'AI-powered autonomous weapons system production', related_contract_date: '2025-01-28' },
  { id: 'its007', company_ticker: 'SPACEX', company_name: 'SpaceX (private)', politician_name: 'Elon Musk (SpaceX CEO)', filing_date: '2025-02-01', transaction_type: 'purchase', shares_estimate: 5000000, estimated_value: 5000000000, sector: 'Aerospace', confidence: 'high', analysis_notes: 'Musk increased SpaceX stake (via secondary) while DOGE was negotiating $2.3B Space Force launch contract. Company valuation jumped 30% in Q1 2025.', source_url: 'https://www.sec.gov/', related_contract_id: 'FA8806-25-F-0001', related_contract_amount: 2300000000, related_contract_agency: 'Department of Defense / Space Force', related_contract_description: 'NSSL Phase 2 Expansion — classified satellite launch services', related_contract_date: '2025-02-14' },
  { id: 'its008', company_ticker: 'DODT', company_name: 'Trump MediaTech', politician_name: 'Donald Trump Jr', filing_date: '2025-02-01', transaction_type: 'purchase', shares_estimate: 500000, estimated_value: 9500000, sector: 'Media', confidence: 'high', analysis_notes: 'DJT stock purchase by Trump Jr same week Trump MediaTech announced SPAC merger closure. Company value tied to Trump political brand.', source_url: 'https://www.sec.gov/', related_contract_id: null, related_contract_amount: null, related_contract_agency: null, related_contract_description: null, related_contract_date: null },
  { id: 'its009', company_ticker: 'RKLB', company_name: 'Rocket Lab', politician_name: 'Peter Thiel', filing_date: '2025-02-15', transaction_type: 'purchase', shares_estimate: 150000, estimated_value: 3000000, sector: 'Aerospace', confidence: 'medium', analysis_notes: 'Thiel added to Rocket Lab position ahead of new NASA launch award. Company wins NASA/DOD launch contracts.', source_url: 'https://www.sec.gov/', related_contract_id: null, related_contract_amount: null, related_contract_agency: null, related_contract_description: null, related_contract_date: null },
  { id: 'its010', company_ticker: 'SPCE', company_name: 'Virgin Galactic', politician_name: 'Richard Branson', filing_date: '2025-03-01', transaction_type: 'sale', shares_estimate: 2000000, estimated_value: 12000000, sector: 'Aerospace', confidence: 'low', analysis_notes: 'Branson sold $12M in Virgin Galactic shares. Company has not turned profit and had multiple flight failures. No direct federal contract signal.', source_url: 'https://www.sec.gov/', related_contract_id: null, related_contract_amount: null, related_contract_agency: null, related_contract_description: null, related_contract_date: null },
];

export const STOCK_HOLDINGS = [
  { id: 'sh001', ticker: 'PLTR', company_name: 'Palantir Technologies', politician_name: 'Peter Thiel', shares_owned: 2200000, estimated_value_low: 82000000, estimated_value_high: 95000000, filing_date: '2025-02-14', filing_type: 'periodic', sector: 'Defense Tech', source_url: 'https://www.sec.gov/', notes: 'Thiel co-founded Palantir. Holds via Founders Fund. Connected to DOD/ICE contracts.' },
  { id: 'sh002', ticker: 'PLTR', company_name: 'Palantir Technologies', politician_name: 'Alex Karp (CEO)', shares_owned: 1800000, estimated_value_low: 67000000, estimated_value_high: 78000000, filing_date: '2025-01-28', filing_type: 'annual', sector: 'Defense Tech', source_url: 'https://www.sec.gov/', notes: 'Palantir CEO. Receives DOD/ICE contracts. Stock surged after election.' },
  { id: 'sh003', ticker: 'TSLA', company_name: 'Tesla Inc', politician_name: 'Larry Ellison', shares_owned: 15000000, estimated_value_low: 2500000000, estimated_value_high: 3000000000, filing_date: '2025-01-15', filing_type: 'annual', sector: 'EV / Auto', source_url: 'https://www.sec.gov/', notes: 'Ellison disclosed large TSLA position. Trump donor + inaugural host.' },
  { id: 'sh004', ticker: 'ORCL', company_name: 'Oracle Corp', politician_name: 'Larry Ellison', shares_owned: 12000000, estimated_value_low: 1800000000, estimated_value_high: 2200000000, filing_date: '2025-01-15', filing_type: 'annual', sector: 'Enterprise Software', source_url: 'https://www.sec.gov/', notes: 'Largest individual Oracle shareholder. Trump inaugural host.' },
  { id: 'sh005', ticker: 'SPACEX', company_name: 'SpaceX (private)', politician_name: 'Elon Musk', shares_owned: 78000000, estimated_value_low: 15600000000, estimated_value_high: 18000000000, filing_date: '2025-03-01', filing_type: 'periodic', sector: 'Aerospace', source_url: 'https://www.sec.gov/', notes: 'Musk owns ~78% of SpaceX. $2.3B+ federal contracts in last 6 months.' },
  { id: 'sh006', ticker: 'AI17', company_name: 'Anduril Industries (private)', politician_name: 'Peter Thiel', shares_owned: 1500000, estimated_value_low: 105000000, estimated_value_high: 135000000, filing_date: '2025-02-01', filing_type: 'periodic', sector: 'Defense Tech', source_url: 'https://www.sec.gov/', notes: 'Thiel-backed Anduril. $550M+ DOD autonomous weapons contract.' },
  { id: 'sh007', ticker: 'RKLB', company_name: 'Rocket Lab', politician_name: 'Peter Thiel', shares_owned: 800000, estimated_value_low: 16000000, estimated_value_high: 20000000, filing_date: '2025-02-10', filing_type: 'periodic', sector: 'Aerospace', source_url: 'https://www.sec.gov/', notes: 'Thiel holding via Founders Fund. Rocket Lab gets NASA/DOD launches.' },
  { id: 'sh008', ticker: 'DODT', company_name: 'Trump MediaTech', politician_name: 'Donald Trump Jr', shares_owned: 2500000, estimated_value_low: 45000000, estimated_value_high: 52000000, filing_date: '2025-03-01', filing_type: 'periodic', sector: 'Media', source_url: 'https://www.sec.gov/', notes: 'DJT stock. Trump MediaTech-SPAC merger. Father is President.' },
  { id: 'sh009', ticker: 'AMZN', company_name: 'Amazon', politician_name: 'Jeff Bezos', shares_owned: 5600000, estimated_value_low: 980000000, estimated_value_high: 1150000000, filing_date: '2025-02-28', filing_type: 'annual', sector: 'Cloud / Tech', source_url: 'https://www.sec.gov/', notes: 'Bezos owns ~9% of Amazon. AWS wins CIA/DOD cloud contracts.' },
  { id: 'sh010', ticker: 'MSFT', company_name: 'Microsoft', politician_name: 'Bill Gates', shares_owned: 4200000, estimated_value_low: 1800000000, estimated_value_high: 2100000000, filing_date: '2025-01-20', filing_type: 'annual', sector: 'Cloud / Tech', source_url: 'https://www.sec.gov/', notes: 'Former Microsoft CEO. Azure wins federal cloud contracts heavily.' },
  { id: 'sh011', ticker: 'META', company_name: 'Meta Platforms', politician_name: 'Mark Zuckerberg', shares_owned: 1800000, estimated_value_low: 950000000, estimated_value_high: 1100000000, filing_date: '2025-01-31', filing_type: 'annual', sector: 'Social Media', source_url: 'https://www.sec.gov/', notes: 'Meta CEO. Connected to federal data/AI contracts.' },
  { id: 'sh012', ticker: 'BRK', company_name: 'Berkshire Hathaway', politician_name: 'Warren Buffett', shares_owned: 380000, estimated_value_low: 1500000000, estimated_value_high: 1750000000, filing_date: '2025-02-15', filing_type: 'annual', sector: 'Conglomerate', source_url: 'https://www.sec.gov/', notes: 'No direct political connection but Berkshire owns companies with major federal contracts.' },
  { id: 'sh013', ticker: 'GD', company_name: 'General Dynamics', politician_name: 'Unknown (institution)', shares_owned: 500000, estimated_value_low: 140000000, estimated_value_high: 160000000, filing_date: '2025-03-01', filing_type: 'periodic', sector: 'Defense', source_url: 'https://www.sec.gov/', notes: 'General Dynamics — major DOD contractor.' },
  { id: 'sh014', ticker: 'LHX', company_name: 'L3Harris Technologies', politician_name: 'Unknown (institution)', shares_owned: 350000, estimated_value_low: 95000000, estimated_value_high: 110000000, filing_date: '2025-03-05', filing_type: 'periodic', sector: 'Defense', source_url: 'https://www.sec.gov/', notes: 'L3Harris — defense contractor with $3B+ DOD awards.' },
  { id: 'sh015', ticker: 'NOC', company_name: 'Northrop Grumman', politician_name: 'Wesley (Chairman)', shares_owned: 180000, estimated_value_low: 95000000, estimated_value_high: 110000000, filing_date: '2025-01-31', filing_type: 'annual', sector: 'Defense', source_url: 'https://www.sec.gov/', notes: 'Northrop Grumman chairman. Company gets $8B+/year in DOD contracts.' },
];

export function computeAnalyticsSummary() {
  const totalOriginal = COST_OVERRUNS.reduce((s, x) => s + x.original_cost, 0);
  const totalFinal = COST_OVERRUNS.reduce((s, x) => s + x.final_cost, 0);
  const totalOverrunDollars = totalFinal - totalOriginal;
  const avgOverrunPct = Math.round(COST_OVERRUNS.reduce((s, x) => s + x.overrun_pct, 0) / COST_OVERRUNS.length);
  const totalStockValueHigh = STOCK_HOLDINGS.reduce((s, x) => s + x.estimated_value_high, 0);
  const totalSignalValue = INSIDER_TRADING_SIGNALS.reduce((s, x) => s + x.estimated_value, 0);
  const highSignals = INSIDER_TRADING_SIGNALS.filter(s => s.confidence === 'high');
  const totalContractValueLinked = highSignals.reduce((s, x) => s + (x.related_contract_amount ?? 0), 0);

  const sectorTotals: Record<string, any> = {};
  for (const sh of STOCK_HOLDINGS) {
    const sec = (sh.sector ?? 'Other');
    if (!sectorTotals[sec]) sectorTotals[sec] = { sector: sec, totalValue: 0, count: 0, companies: [] };
    sectorTotals[sec].totalValue += sh.estimated_value_high;
    sectorTotals[sec].count++;
    if (!sectorTotals[sec].companies.includes(sh.company_name)) sectorTotals[sec].companies.push(sh.company_name);
  }

  const agencyOverruns: Record<string, any> = {};
  for (const co of COST_OVERRUNS) {
    if (!agencyOverruns[co.agency]) agencyOverruns[co.agency] = { agency: co.agency, count: 0, original: 0, final: 0, overrunPct: 0 };
    agencyOverruns[co.agency].count++;
    agencyOverruns[co.agency].original += co.original_cost;
    agencyOverruns[co.agency].final += co.final_cost;
  }
  for (const a of Object.values(agencyOverruns)) {
    a.overrunPct = a.original > 0 ? Math.round(((a.final - a.original) / a.original) * 100) : 0;
  }

  return {
    cost_overruns: COST_OVERRUNS,
    stock_holdings: STOCK_HOLDINGS,
    insider_signals: INSIDER_TRADING_SIGNALS,
    summary: {
      total_overrun_projects: COST_OVERRUNS.length,
      total_original_cost: totalOriginal,
      total_final_cost: totalFinal,
      total_overrun_dollars: totalOverrunDollars,
      avg_overrun_pct: avgOverrunPct,
      total_stock_holdings: STOCK_HOLDINGS.length,
      total_stock_value_high: totalStockValueHigh,
      total_insider_signals: INSIDER_TRADING_SIGNALS.length,
      total_signal_value: totalSignalValue,
      total_contract_value_linked: totalContractValueLinked,
      high_confidence_signals: highSignals.length,
    },
    agency_overruns: Object.values(agencyOverruns).sort((a: any, b: any) => b.final - a.final),
    sector_breakdown: Object.values(sectorTotals).sort((a: any, b: any) => b.totalValue - a.totalValue),
    top_signals: highSignals.slice(0, 10),
  };
}
