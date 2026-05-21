import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { COST_OVERRUNS, INSIDER_TRADING_SIGNALS, STOCK_HOLDINGS, computeAnalyticsSummary } from '@/lib/analytics-data';

export async function GET(request: NextRequest) {
  let data = computeAnalyticsSummary();

  if (supabase) {
    try {
      const { data: dbCostOverruns } = await supabase.from('cost_overruns').select('*').order('overrun_pct', { ascending: false });
      const { data: dbStockHoldings } = await supabase.from('stock_holdings').select('*').order('estimated_value_high', { ascending: false });
      const { data: dbSignals } = await supabase.from('insider_trading_signals').select('*').order('estimated_value', { ascending: false });

      if (dbCostOverruns && dbCostOverruns.length > 0) {
        const sigs = dbSignals ?? [];
        const holdings = dbStockHoldings ?? [];
        const overruns = dbCostOverruns;
        const totalSignalValue = sigs.reduce((s: number, x: any) => s + Number(x.estimated_value ?? 0), 0);
        const totalOverrun = overruns.reduce((s: number, x: any) => s + Number(x.final_cost ?? 0), 0);
        const totalOriginal = overruns.reduce((s: number, x: any) => s + Number(x.original_cost ?? 0), 0);
        const highSignals = sigs.filter((s: any) => s.confidence === 'high');
        const totalContractValueLinked = highSignals.reduce((s: number, x: any) => s + Number(x.related_contract_amount ?? 0), 0);

        const sectorTotals: Record<string, any> = {};
        for (const sh of holdings) {
          const sec = (sh.sector ?? 'Other') as string;
          if (!sectorTotals[sec]) sectorTotals[sec] = { sector: sec, totalValue: 0, count: 0, companies: [] };
          sectorTotals[sec].totalValue += Number(sh.estimated_value_high ?? 0);
          sectorTotals[sec].count++;
          if (!sectorTotals[sec].companies.includes(sh.company_name)) sectorTotals[sec].companies.push(sh.company_name);
        }

        const agencyOverruns: Record<string, any> = {};
        for (const co of overruns) {
          if (!agencyOverruns[co.agency]) agencyOverruns[co.agency] = { agency: co.agency, count: 0, original: 0, final: 0, overrunPct: 0 };
          agencyOverruns[co.agency].count++;
          agencyOverruns[co.agency].original += Number(co.original_cost ?? 0);
          agencyOverruns[co.agency].final += Number(co.final_cost ?? 0);
        }
        for (const a of Object.values(agencyOverruns)) {
          a.overrunPct = a.original > 0 ? Math.round(((a.final - a.original) / a.original) * 100) : 0;
        }

        data = {
          cost_overruns: overruns,
          stock_holdings: holdings,
          insider_signals: sigs,
          summary: {
            total_overrun_projects: overruns.length,
            total_original_cost: totalOriginal,
            total_final_cost: totalOverrun,
            total_overrun_dollars: totalOverrun - totalOriginal,
            avg_overrun_pct: overruns.length > 0 ? Math.round(overruns.reduce((s: number, x: any) => s + Number(x.overrun_pct ?? 0), 0) / overruns.length) : 0,
            total_stock_holdings: holdings.length,
            total_stock_value_high: holdings.reduce((s: number, x: any) => s + Number(x.estimated_value_high ?? 0), 0),
            total_insider_signals: sigs.length,
            total_signal_value: totalSignalValue,
            total_contract_value_linked: totalContractValueLinked,
            high_confidence_signals: highSignals.length,
          },
          agency_overruns: Object.values(agencyOverruns).sort((a: any, b: any) => b.final - a.final),
          sector_breakdown: Object.values(sectorTotals).sort((a: any, b: any) => b.totalValue - a.totalValue),
          top_signals: highSignals.slice(0, 10),
        };
      }
    } catch (e) {
      // Fall through to static data
    }
  }

  return NextResponse.json(data);
}
