import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  try {
    // Get all awards with COVID obligations
    const { data, error } = await supabaseAdmin
      .from('awards')
      .select(`
        dollar_amount,
        covid_obligations,
        covid_outlays,
        awarding_agency,
        awarding_agency_code,
        competition_status,
        connection_type,
        recipient_name,
        posted_date,
        flags,
        description
      `)
      .gt('covid_obligations', 0);

    if (error) throw error;
    if (!data || data.length === 0) {
      return NextResponse.json({ total_covid_awards: 0, total_covid_dollars: 0, breakdown: {} });
    }

    const num = (v: unknown) => Number(v) || 0;

    // Overall stats
    const totalCovidObligations = data.reduce((s, a) => s + num(a.covid_obligations), 0);
    const totalCovidOutlays = data.reduce((s, a) => s + num(a.covid_outlays), 0);
    const covidNoBid = data.filter(
      a => a.competition_status === 'no_bid' || a.competition_status === 'sole_source'
    );
    const covidNoBidDollars = covidNoBid.reduce((s, a) => s + num(a.covid_obligations), 0);

    // By agency
    const byAgency: Record<string, {
      agency: string;
      award_count: number;
      total_covid_obligations: number;
      no_bid_count: number;
      no_bid_dollars: number;
    }> = {};
    for (const a of data) {
      const agency = a.awarding_agency || 'Unknown';
      if (!byAgency[agency]) {
        byAgency[agency] = { agency, award_count: 0, total_covid_obligations: 0, no_bid_count: 0, no_bid_dollars: 0 };
      }
      byAgency[agency].award_count++;
      byAgency[agency].total_covid_obligations += num(a.covid_obligations);
      if (a.competition_status === 'no_bid' || a.competition_status === 'sole_source') {
        byAgency[agency].no_bid_count++;
        byAgency[agency].no_bid_dollars += num(a.covid_obligations);
      }
    }

    // Top vendors
    const byVendor: Record<string, { name: string; total_covid_obligations: number; award_count: number }> = {};
    for (const a of data) {
      const name = a.recipient_name || 'Unknown';
      if (!byVendor[name]) byVendor[name] = { name, total_covid_obligations: 0, award_count: 0 };
      byVendor[name].total_covid_obligations += num(a.covid_obligations);
      byVendor[name].award_count++;
    }
    const topVendors = Object.values(byVendor)
      .sort((a, b) => b.total_covid_obligations - a.total_covid_obligations)
      .slice(0, 20);

    // Quarterly breakdown (FY2020 = Oct 2019-Sep 2020, FY2021 = Oct 2020-Sep 2021)
    const byQuarter: Record<string, number> = {};
    for (const a of data) {
      if (!a.posted_date) continue;
      const d = new Date(a.posted_date);
      const quarter = `Q${Math.ceil((d.getMonth() + 1) / 3)} FY${d.getFullYear()}`;
      byQuarter[quarter] = (byQuarter[quarter] || 0) + num(a.covid_obligations);
    }

    return NextResponse.json({
      total_covid_awards: data.length,
      total_covid_obligations: totalCovidObligations,
      total_covid_outlays: totalCovidOutlays,
      covid_no_bid_count: covidNoBid.length,
      covid_no_bid_dollars: covidNoBidDollars,
      by_agency: Object.values(byAgency).sort((a, b) => b.total_covid_obligations - a.total_covid_obligations),
      top_vendors: topVendors,
      by_quarter: byQuarter,
    });
  } catch (err) {
    console.error('[covid-stats] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}