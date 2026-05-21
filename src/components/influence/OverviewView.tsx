'use client';
import { DollarSign, FileText, TrendingUp } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { CRYPTO_PACS } from '@/lib/crypto-data';
import { PAC_DATABASE } from '@/lib/pac-data';
import { BILLS, REGULATORY_ACTIONS } from '@/lib/policy-data';

function fmt(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

/** The master "Money → Policy" flow: donors → bills/votes → regulatory outcomes → beneficiaries. */
export default function OverviewView() {
  const cryptoPacTotal = CRYPTO_PACS.reduce((s, p) => s + p.amountRaised, 0);
  const superPacTotal = PAC_DATABASE.reduce((s, p) => s + p.total_raised_2016_2024, 0);
  const cycle2024 = PAC_DATABASE.reduce((s, p) => s + p.raised_2024_cycle, 0);

  const beneficiaries = Array.from(
    new Set([
      ...BILLS.flatMap((b) => b.beneficiaries),
      ...REGULATORY_ACTIONS.flatMap((r) => r.beneficiaries),
    ]),
  );

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8 space-y-10">
      <header>
        <h1 className="text-2xl lg:text-3xl font-bold text-white">
          How Money Shapes Crypto Policy
        </h1>
        <p className="mt-2 max-w-3xl text-slate-400 text-sm leading-relaxed">
          Follow the chain: industry money flows into PACs, PACs back candidates, candidates
          move legislation, regulators stand down — and a known set of companies profit.
          Every node below links to the underlying data and its sources.
        </p>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Crypto industry PACs" value={fmt(cryptoPacTotal)} sublabel="Raised across tracked crypto PACs" icon={<DollarSign size={14} />} accent="amber" />
        <StatCard label="All super PAC money" value={fmt(superPacTotal)} sublabel="2016–2024, tracked PACs" icon={<DollarSign size={14} />} accent="red" />
        <StatCard label="2024 cycle alone" value={fmt(cycle2024)} sublabel="Single-cycle PAC fundraising" icon={<TrendingUp size={14} />} accent="purple" />
        <StatCard label="Bills tracked" value={BILLS.length} sublabel={`${REGULATORY_ACTIONS.length} regulatory actions linked`} icon={<FileText size={14} />} accent="blue" />
      </section>

      {/* The flow */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
          The Money → Policy Pipeline
        </h2>
        <div className="grid lg:grid-cols-4 gap-3">
          {/* 1. Money in */}
          <FlowColumn step="1" title="Money In" tone="warning">
            {CRYPTO_PACS.slice(0, 5).map((p) => (
              <FlowItem key={p.abbr} title={p.pac_name} detail={fmt(p.amountRaised)} />
            ))}
          </FlowColumn>

          {/* 2. Legislation */}
          <FlowColumn step="2" title="Legislation & Votes" tone="info">
            {BILLS.map((b) => (
              <FlowItem key={b.bill_id} title={b.short_name} detail={b.status_detail.slice(0, 60) + '…'} />
            ))}
          </FlowColumn>

          {/* 3. Regulatory outcomes */}
          <FlowColumn step="3" title="Regulators Stand Down" tone="danger">
            {REGULATORY_ACTIONS.map((r) => (
              <FlowItem key={r.id} title={r.action} detail={`${r.agency} · ${r.date}`} />
            ))}
          </FlowColumn>

          {/* 4. Beneficiaries */}
          <FlowColumn step="4" title="Who Profits" tone="green">
            {beneficiaries.slice(0, 7).map((b) => (
              <FlowItem key={b} title={b} />
            ))}
          </FlowColumn>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="text-white font-semibold mb-2">Trace it yourself</h3>
        <p className="text-slate-400 text-sm mb-3">
          Each tab drills into one layer of the pipeline. The Policy &amp; Bills tab links
          every bill back to the PACs and investors behind it.
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge tone="warning">Crypto → exchanges, investors, miners</Badge>
          <Badge tone="danger">Super PACs → donor networks</Badge>
          <Badge tone="info">Policy &amp; Bills → votes &amp; outcomes</Badge>
        </div>
      </section>
    </div>
  );
}

const TONE_RING: Record<string, string> = {
  warning: 'border-amber-500/30',
  info: 'border-blue-500/30',
  danger: 'border-red-500/30',
  green: 'border-emerald-500/30',
};
const TONE_TEXT: Record<string, string> = {
  warning: 'text-amber-400',
  info: 'text-blue-400',
  danger: 'text-red-400',
  green: 'text-emerald-400',
};

function FlowColumn({ step, title, tone, children }: { step: string; title: string; tone: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border ${TONE_RING[tone]} bg-slate-900/60 p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${TONE_RING[tone]} text-xs font-bold ${TONE_TEXT[tone]}`}>
          {step}
        </span>
        <span className={`text-sm font-semibold ${TONE_TEXT[tone]}`}>{title}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FlowItem({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="rounded-lg bg-slate-800/50 px-3 py-2">
      <div className="text-sm text-slate-200 font-medium leading-snug">{title}</div>
      {detail && <div className="mt-0.5 text-xs text-slate-500">{detail}</div>}
    </div>
  );
}
