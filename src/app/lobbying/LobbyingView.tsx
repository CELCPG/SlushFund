'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Building2, DollarSign, FileText, ExternalLink } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Table, type Column } from '@/components/ui/Table';
import topSpenders from '@/data/lobbying/lda_top_spenders.json';
import byIssue from '@/data/lobbying/lda_by_issue.json';

interface Spender {
  client: string;
  registrant: string;
  amount: number;
  filings: number;
}
interface Issue {
  issue: string;
  code: string;
  amount: number;
  filings: number;
}

const SPENDERS = topSpenders.data as Spender[];
const ISSUES = byIssue.data as Issue[];

function fmt(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

const ISSUE_COLORS = ['#ef4444', '#f97316', '#eab308', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#a855f7', '#ec4899', '#64748b'];

export function LobbyingView() {
  const totalTracked = SPENDERS.reduce((s, x) => s + x.amount, 0);
  const issueChart = ISSUES.map((i) => ({ name: i.issue, amount: i.amount }));

  const spenderCols: Column<Spender>[] = [
    {
      key: 'client',
      header: 'Client',
      sortable: true,
      render: (r) => (
        <div>
          <div className="font-medium text-white">{r.client}</div>
          {r.registrant && r.registrant !== r.client && (
            <div className="text-xs text-slate-500">via {r.registrant}</div>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Lobbying Spend',
      sortable: true,
      align: 'right',
      sortValue: (r) => r.amount,
      render: (r) => <span className="font-mono font-bold text-amber-400">{fmt(r.amount)}</span>,
    },
    {
      key: 'filings',
      header: 'Filings',
      sortable: true,
      align: 'right',
      sortValue: (r) => r.filings,
      render: (r) => <span className="font-mono text-slate-300">{r.filings}</span>,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Top-20 tracked spend" value={fmt(totalTracked)} accent="amber" icon={<DollarSign size={14} />} />
        <StatCard label="Clients tracked" value={String(SPENDERS.length)} accent="blue" icon={<Building2 size={14} />} />
        <StatCard label="Issue areas" value={String(ISSUES.length)} accent="purple" icon={<FileText size={14} />} sublabel={`Cycle ${topSpenders.cycle}`} />
      </div>

      <Card padding="lg">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-widest text-white">Lobbying spend by issue area</h2>
        <p className="mb-4 text-xs text-slate-500">Federal lobbying dollars reported under the LDA, by general issue code · cycle {byIssue.cycle}</p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={issueChart} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
            <XAxis type="number" tickFormatter={fmt} tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={160} />
            <Tooltip formatter={(v: any) => [fmt(Number(v)), 'Lobbying spend']} contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
            <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
              {issueChart.map((_, i) => (
                <Cell key={i} fill={ISSUE_COLORS[i % ISSUE_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-white">Top lobbying clients</h2>
        <Table
          columns={spenderCols}
          data={SPENDERS}
          rowKey={(r) => r.client}
          defaultSort={{ key: 'amount', dir: 'desc' }}
        />
      </div>

      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <ExternalLink className="h-3 w-3" />
        Source: <a href="https://lda.senate.gov" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">Senate Office of Public Records — Lobbying Disclosure Act filings</a>.
      </p>
    </div>
  );
}
