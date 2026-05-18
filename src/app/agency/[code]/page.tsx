'use client';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, AlertTriangle, DollarSign, TrendingUp, Shield } from 'lucide-react';
import { fmt, CONNECTION_LABELS } from '@/lib/utils';
import type { Award, ConnectionType } from '@/lib/types';
import { mockAward } from '@/lib/mock-data-new';

const connColors: Record<string, { border: string; bg: string; text: string }> = {
  elon_musk: { border: 'border-purple-600', bg: 'bg-purple-950/30', text: 'text-purple-300' },
  trump_family: { border: 'border-red-600', bg: 'bg-red-950/30', text: 'text-red-300' },
  trump_ally: { border: 'border-blue-600', bg: 'bg-blue-950/30', text: 'text-blue-300' },
  suspected: { border: 'border-amber-600', bg: 'bg-amber-950/30', text: 'text-amber-300' },
  none: { border: 'border-slate-600', bg: 'bg-slate-900', text: 'text-slate-300' },
};

export default function AgencyPage() {
  const { code } = useParams();
  const [agencyName, setAgencyName] = useState('');
  const [awards, setAwards] = useState<Award[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ total: 0, connected: 0, flagged: 0, noBid: 0 });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/contracts?agency=${encodeURIComponent(String(code))}&limit=100`);
        const data = await res.json();
        if (data.awards?.length > 0) {
          setAgencyName(data.awards[0].awarding_agency);
          setAwards(data.awards as Award[]);
          const total = data.awards.reduce((s: number, a: Award) => s + Number(a.dollar_amount), 0);
          const connected = data.awards.filter((a: Award) => a.connection_type && a.connection_type !== 'none').reduce((s: number, a: Award) => s + Number(a.dollar_amount), 0);
          const flagged = data.awards.filter((a: Award) => a.flags && a.flags.length > 0).reduce((s: number, a: Award) => s + Number(a.dollar_amount), 0);
          const noBid = data.awards.filter((a: Award) => a.competition_status === 'no_bid' || a.competition_status === 'sole_source').reduce((s: number, a: Award) => s + Number(a.dollar_amount), 0);
          setTotals({ total, connected, flagged, noBid });
        } else {
          // Demo mode
          setAgencyName(String(code).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
        }
      } catch {
        setAgencyName(String(code).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
      } finally {
        setLoading(false);
      }
    }
    if (code) load();
  }, [code]);

  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm font-medium transition-colors">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-white font-mono text-sm font-medium">{agencyName || code}</span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between gap-6 flex-wrap mb-8">
          <div>
            <h1 className="text-3xl font-black text-white">{agencyName || 'Agency Spending'}</h1>
            <p className="text-slate-400 mt-1 font-mono text-sm">Agency code: {code}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Obligations', value: fmt.compact(totals.total), color: 'text-white' },
            { label: 'Connected Vendors', value: fmt.compact(totals.connected), color: 'text-purple-400' },
            { label: 'Flagged Awards', value: fmt.compact(totals.flagged), color: 'text-amber-400' },
            { label: 'No-Bid / Sole-Source', value: fmt.compact(totals.noBid), color: 'text-rose-400' },
          ].map(stat => (
            <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
              <div className="text-slate-400 text-xs font-medium uppercase tracking-widest mb-1">{stat.label}</div>
              <div className={`text-3xl font-black ${stat.color}`}>{loading ? '—' : stat.value}</div>
            </div>
          ))}
        </div>

        {/* Awards Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-white font-bold">Awards</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  {['Recipient', 'Amount', 'Type', 'Competition', 'Connection', 'Risk', 'Date'].map(col => (
                    <th key={col} className="px-4 py-3 text-left text-slate-400 text-xs font-medium uppercase tracking-widest whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {awards.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      Connect Supabase to see live data. Showing demo data.
                    </td>
                  </tr>
                )}
                {awards.map((award) => (
                  <tr key={award.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <Link href={`/contract/${award.id}`} className="font-medium text-white hover:text-emerald-400">
                        {award.recipient_name}
                      </Link>
                      <div className="text-slate-500 text-xs mt-0.5 line-clamp-1 max-w-xs">{award.description}</div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-mono font-bold text-white">{fmt.dollars(Number(award.dollar_amount))}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        award.award_category === 'contract' ? 'bg-blue-900 text-blue-300' :
                        award.award_category === 'grant' ? 'bg-green-900 text-green-300' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {award.award_category}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        award.competition_status === 'no_bid' ? 'bg-rose-900 text-rose-300' :
                        award.competition_status === 'sole_source' ? 'bg-orange-900 text-orange-300' :
                        'bg-emerald-900 text-emerald-300'
                      }`}>
                        {award.competition_status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {award.connection_type && award.connection_type !== 'none' ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                          award.connection_type === 'elon_musk' ? 'bg-purple-900 text-purple-200 border-purple-700' :
                          award.connection_type === 'trump_family' ? 'bg-red-900 text-red-200 border-red-700' :
                          'bg-blue-900 text-blue-200 border-blue-700'
                        }`}>
                          {CONNECTION_LABELS[award.connection_type as ConnectionType]}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`font-mono text-sm font-bold ${
                        award.risk_score >= 80 ? 'text-rose-400' :
                        award.risk_score >= 50 ? 'text-amber-400' :
                        'text-slate-400'
                      }`}>
                        {award.risk_score}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-slate-400 text-xs font-mono">
                        {award.posted_date ? new Date(award.posted_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}