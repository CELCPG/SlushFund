'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Scale, Gavel, Users, Radio } from 'lucide-react';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { ExportMenu } from '@/components/ui/ExportMenu';
import {
  BILLS, REGULATORY_ACTIONS,
  Bill, BillStatus, votesForBill, buildScorecard,
} from '@/lib/policy-data';

function fmtMoney(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

const STATUS_TONE: Record<BillStatus, BadgeTone> = {
  introduced: 'neutral',
  in_committee: 'info',
  passed_house: 'warning',
  passed_senate: 'warning',
  passed_both: 'warning',
  enacted: 'success',
  failed: 'danger',
  vetoed: 'danger',
};

const STATUS_LABEL: Record<BillStatus, string> = {
  introduced: 'Introduced',
  in_committee: 'In Committee',
  passed_house: 'Passed House',
  passed_senate: 'Passed Senate',
  passed_both: 'Passed Both Chambers',
  enacted: 'Enacted into Law',
  failed: 'Failed',
  vetoed: 'Vetoed',
};

const VOTE_TONE: Record<string, string> = {
  Yea: 'text-emerald-400',
  Nay: 'text-red-400',
  Present: 'text-amber-400',
  'Not Voting': 'text-slate-500',
};

/** Policy & Bills tab — the connective tissue between money and outcomes. */
export default function PolicyView() {
  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8 space-y-10">
      <header>
        <h1 className="text-2xl lg:text-3xl font-bold text-white">Policy &amp; Bills</h1>
        <p className="mt-2 max-w-3xl text-slate-400 text-sm leading-relaxed">
          The legislation and regulatory actions the money is buying. Each bill links
          back to the PACs and investors backing it, and forward to who profits.
        </p>
      </header>

      <ScorecardSection />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
            Tracked Legislation
          </h2>
          <ExportMenu rows={BILLS} filename="slushfund-bills" label="Export bills" />
        </div>
        {BILLS.map((b) => (
          <BillCard key={b.bill_id} bill={b} />
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
          Regulatory &amp; Executive Timeline
        </h2>
        <div className="relative space-y-3 border-l-2 border-slate-800 pl-5">
          {[...REGULATORY_ACTIONS].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
            <div key={r.id} className="relative rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <span className="absolute -left-[27px] top-5 h-3 w-3 rounded-full bg-red-500 ring-4 ring-slate-950" />
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="danger">{r.agency}</Badge>
                <span className="text-xs text-slate-500">{r.date}</span>
              </div>
              <h3 className="mt-2 font-semibold text-white">{r.action}</h3>
              <p className="mt-1 text-sm text-slate-400">{r.summary}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.beneficiaries.map((x) => (
                  <Badge key={x} tone="success">{x}</Badge>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                {r.source_urls.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline">
                    <ExternalLink size={11} /> Source
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ScorecardSection() {
  const rows = buildScorecard();
  const flaggedCount = rows.filter((r) => r.flagged).length;
  const totalMoney = rows.reduce((s, r) => s + r.crypto_money, 0);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
          Vote-vs-Money Scorecard
        </h2>
        <ExportMenu
          rows={rows.map((r) => ({
            legislator: r.name, party: r.party, chamber: r.chamber, state: r.state,
            crypto_money: r.crypto_money,
            votes: r.votes.map((v) => `${v.bill}:${v.vote}`).join('; '),
            flagged: r.flagged,
          }))}
          filename="slushfund-scorecard"
          label="Export scorecard"
        />
      </div>
      <p className="max-w-3xl text-xs text-slate-500">
        Every legislator with a recorded vote on a crypto bill, cross-referenced against
        crypto-industry election spending that supported them. {flaggedCount} took crypto
        money <span className="text-red-400 font-semibold">and</span> voted for every crypto
        bill they faced ({fmtMoney(totalMoney)} in tracked support).
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/80 border-b border-slate-800">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wide text-slate-400">Legislator</th>
              <th className="text-right px-3 py-2.5 text-xs uppercase tracking-wide text-slate-400">Crypto money</th>
              <th className="text-left px-3 py-2.5 text-xs uppercase tracking-wide text-slate-400">Crypto-bill votes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((r) => (
              <tr key={r.name} className={r.flagged ? 'bg-red-500/5' : ''}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{r.name}</span>
                    <span className="text-xs text-slate-500">
                      {r.party}-{r.state} · {r.chamber}
                    </span>
                    {r.flagged && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-red-400 bg-red-500/10 border border-red-500/30 rounded px-1.5 py-0.5">
                        ⚑ Money + pro-crypto
                      </span>
                    )}
                  </div>
                  {r.money_detail && (
                    <div className="mt-1 text-xs text-slate-500 max-w-xl">
                      {r.money_detail}{' '}
                      {r.money_source && (
                        <a href={r.money_source} target="_blank" rel="noopener noreferrer"
                          className="text-blue-400 hover:underline">[source]</a>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  {r.crypto_money > 0
                    ? <span className="font-mono font-bold text-red-400">{fmtMoney(r.crypto_money)}</span>
                    : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {r.votes.map((v, i) => (
                      <span key={i} className={`text-xs rounded px-1.5 py-0.5 border ${
                        v.vote === 'Yea'
                          ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                          : v.vote === 'Nay'
                          ? 'text-red-300 border-red-500/30 bg-red-500/10'
                          : 'text-slate-400 border-slate-600 bg-slate-700/30'
                      }`}>
                        {v.bill}: {v.vote}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface LiveStatus {
  latest_action: string | null;
  latest_action_date: string | null;
}

function BillCard({ bill }: { bill: Bill }) {
  const [open, setOpen] = useState(false);
  const [live, setLive] = useState<LiveStatus | null>(null);
  const [liveState, setLiveState] = useState<'idle' | 'loading' | 'done' | 'unavailable'>('idle');
  const votes = votesForBill(bill.bill_id);

  // Lazily fetch live Congress.gov status the first time the card is opened.
  useEffect(() => {
    if (!open || liveState !== 'idle') return;
    setLiveState('loading');
    fetch(`/api/policy/bills?id=${bill.bill_id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.live?.latest_action) {
          setLive({ latest_action: j.live.latest_action, latest_action_date: j.live.latest_action_date });
          setLiveState('done');
        } else {
          setLiveState('unavailable');
        }
      })
      .catch(() => setLiveState('unavailable'));
  }, [open, liveState, bill.bill_id]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <Scale size={18} className="mt-0.5 shrink-0 text-blue-400" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-white">{bill.short_name}</span>
            <Badge tone={STATUS_TONE[bill.status]}>{STATUS_LABEL[bill.status]}</Badge>
            <span className="text-xs uppercase tracking-wide text-slate-500">{bill.policy_area}</span>
          </div>
          <p className="mt-1 text-sm text-slate-300">{bill.title}</p>
          <p className="mt-1 text-xs text-slate-500">{bill.status_detail}</p>
        </div>
        {open ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
      </button>

      {open && (
        <div className="border-t border-slate-800 p-4 space-y-4">
          <p className="text-sm text-slate-400">{bill.summary}</p>

          {/* Live Congress.gov status */}
          {liveState === 'done' && live && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <Radio size={12} className="text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                  Live · Congress.gov
                </span>
                {live.latest_action_date && (
                  <span className="text-[10px] text-slate-500">{live.latest_action_date}</span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-300">{live.latest_action}</p>
            </div>
          )}
          {liveState === 'loading' && (
            <div className="text-xs text-slate-500">Checking live Congress.gov status…</div>
          )}

          <Detail icon={<Users size={13} />} label="Sponsors">
            <div className="flex flex-wrap gap-1.5">
              {bill.sponsors.map((s) => (
                <Badge key={s.name} tone={s.party === 'R' ? 'trump' : s.party === 'D' ? 'ally' : 'neutral'}>
                  {s.name} ({s.party}-{s.state}) · {s.role}
                </Badge>
              ))}
            </div>
          </Detail>

          <Detail label="Backed by (PACs & investors)">
            <div className="flex flex-wrap gap-1.5">
              {bill.linked_pacs.map((p) => <Badge key={p} tone="warning">{p}</Badge>)}
              {bill.linked_entities.map((e) => <Badge key={e} tone="info">{e}</Badge>)}
            </div>
          </Detail>

          <Detail label="Who profits">
            <div className="flex flex-wrap gap-1.5">
              {bill.beneficiaries.map((x) => <Badge key={x} tone="success">{x}</Badge>)}
            </div>
          </Detail>

          {votes.length > 0 && (
            <Detail icon={<Gavel size={13} />} label="Roll-call votes">
              {votes.map((v) => (
                <div key={v.vote_label} className="rounded-lg bg-slate-800/50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-200">{v.vote_label}</span>
                    <span className="text-xs text-slate-500">{v.date}</span>
                  </div>
                  <div className="text-xs text-amber-400 mt-0.5">{v.result}</div>
                  <table className="mt-2 w-full text-xs">
                    <tbody>
                      {v.members.map((m) => (
                        <tr key={m.name} className="border-t border-slate-800/60">
                          <td className="py-1 text-slate-300">{m.name}</td>
                          <td className="py-1 text-slate-500">{m.party}-{m.state}</td>
                          <td className={`py-1 text-right font-medium ${VOTE_TONE[m.vote]}`}>{m.vote}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <a href={v.source_url} target="_blank" rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-blue-400 hover:underline">
                    <ExternalLink size={11} /> Official roll call
                  </a>
                </div>
              ))}
            </Detail>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            <a href={bill.congress_gov_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline">
              <ExternalLink size={11} /> Congress.gov
            </a>
            {bill.source_urls.map((u) => (
              <a key={u} href={u} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline">
                <ExternalLink size={11} /> Source
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {icon}{label}
      </div>
      {children}
    </div>
  );
}
