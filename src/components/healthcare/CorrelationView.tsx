'use client';
import { useEffect, useState } from 'react';
import { Network, AlertTriangle, TrendingUp } from 'lucide-react';
import topRecipientsData from '@/data/opensecrets/top_recipients.json';

function fmt(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

const PHARMA_TICKERS = new Set([
  'PFE', 'MRNA', 'JNJ', 'ABBV', 'UNH', 'MRK', 'LLY', 'AMGN',
  'GILD', 'BIIB', 'REGN', 'VRTX', 'CRSP', 'DTIL', 'BMY', 'AZN',
  'GSK', 'NVO',
]);

interface Trade {
  member_name: string;
  member_chamber: 'House' | 'Senate';
  member_party: string;
  member_state: string;
  ticker: string;
  company_name: string;
  transaction_type: string;
  amount_min: number | null;
  amount_max: number | null;
  transaction_date: string | null;
}

function parseUSD(s: string): number {
  return parseInt(s.replace(/[$,]/g, ''), 10);
}

// Combine a congress member name + state into a normalized key
// Strip suffixes like (D-Wash), (R-Texas) from recipient name before matching
function normalizeMember(name: string): string {
  // e.g. "Maria Cantwell (D-Wash)" → "MARIACANTWELL"
  const clean = name.replace(/\s*\(.*\)/, '');
  return clean.toUpperCase().replace(/[^A-Z]/g, '');
}

export default function CorrelationView() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/trades?limit=500')
      .then((r) => r.json())
      .then((d) => {
        const all: Trade[] = d.trades ?? d.data ?? [];
        setTrades(all);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const pharmaTrades = trades.filter((t) => PHARMA_TICKERS.has(t.ticker?.toUpperCase()));

  // Map: normalized member name → count of pharma trades
  const pharmaMemberTrades: Record<string, number> = {};
  pharmaTrades.forEach((t) => {
    pharmaMemberTrades[t.member_name] = (pharmaMemberTrades[t.member_name] ?? 0) + 1;
  });

  // Parse top recipients
  const recipients = topRecipientsData.data as Array<{
    Recipient: string;
    'From Lobbyists': string;
    'From Lobbyists + Family': string;
  }>;

  // Match recipients to pharma trades
  type MatchedMember = {
    name: string;
    lobbyCash: number;
    pharmaTrades: number;
    tickers: string[];
    chamber: string;
  };

  // Helper: get significant name words (first name + last name, no state/party suffixes)
  function getNameWords(name: string): string[] {
    return name
      .replace(/\s*\(.*\)/, '')           // strip (D-Wash) suffix
      .split(/\s+/)                          // split on whitespace
      .filter(w => w.length > 1 && /^[A-Za-z]+$/.test(w))  // only real words, 2+ chars
      .map(w => w.toUpperCase());
  }

  function nameMatches(recipientName: string, tradeName: string): boolean {
    const rWords = getNameWords(recipientName);
    const tWords = getNameWords(tradeName);
    if (rWords.length === 0 || tWords.length === 0) return false;
    // Check: any rWord matches the last tWord (last name) and first rWord matches first tWord (first name)
    const lastName = rWords[rWords.length - 1];
    const firstName = rWords[0];
    return tWords.includes(lastName) && tWords.includes(firstName);
  }

  const matched: MatchedMember[] = recipients.map((r) => {
    const rWords = getNameWords(r.Recipient);

    const memberTrades = pharmaTrades.filter((t) =>
      nameMatches(r.Recipient, t.member_name)
    );

    const tickers = [...new Set(memberTrades.map((t) => t.ticker))];
    const chamber =
      memberTrades[0]?.member_chamber ??
      (r.Recipient.includes('Sen') || r.Recipient.includes('(R') || r.Recipient.includes('(D') ? 'Senate' : 'House');

    return {
      name: r.Recipient,
      lobbyCash: parseUSD(r['From Lobbyists']),
      pharmaTrades: memberTrades.length,
      tickers,
      chamber,
    };
  });

  const connected = matched.filter((m) => m.pharmaTrades > 0 || m.lobbyCash > 100000);
  const topConnected = [...connected].sort((a, b) => b.pharmaTrades - a.pharmaTrades);

  const tooltipStyle = {
    contentStyle: { background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' },
    labelStyle: { color: '#e2e8f0' },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8 space-y-10">
      <header>
        <h1 className="text-2xl lg:text-3xl font-bold text-white">
          The Pharma–Congress Connection
        </h1>
        <p className="mt-2 max-w-3xl text-slate-400 text-sm leading-relaxed">
          The link between pharmaceutical lobby cash flowing to Congress members and those same members holding pharma stocks.
          If a senator receives hundreds of thousands in pharma lobbying and also trades pharma stocks — that's the connection.
        </p>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-emerald-500/30 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <Network size={14} className="text-emerald-400" />
            <span>Connected Members</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">{connected.length}</div>
          <div className="mt-1 text-xs text-slate-500">Both lobby cash &amp; pharma trades</div>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <AlertTriangle size={14} className="text-amber-400" />
            <span>Total Lobby Cash</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-400">
            {fmt(connected.reduce((s, m) => s + m.lobbyCash, 0))}
          </div>
          <div className="mt-1 text-xs text-slate-500">Received by connected members</div>
        </div>
        <div className="rounded-xl border border-purple-500/30 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <TrendingUp size={14} className="text-purple-400" />
            <span>Pharma Trades</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-400">
            {pharmaTrades.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">By connected members</div>
        </div>
        <div className="rounded-xl border border-blue-500/30 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <Network size={14} className="text-blue-400" />
            <span>Top Tickers</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-400">
            {[...new Set(pharmaTrades.map((t) => t.ticker))].length}
          </div>
          <div className="mt-1 text-xs text-slate-500">Unique pharma tickers held</div>
        </div>
      </section>

      {/* Connection table */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
          Congress Members — Both Pharma Lobby Cash &amp; Pharma Stock Trades
        </h2>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-800">
              <tr className="text-slate-400 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Member</th>
                <th className="text-center px-4 py-3">Chamber</th>
                <th className="text-right px-4 py-3">Lobby Cash</th>
                <th className="text-right px-4 py-3">Pharma Trades</th>
                <th className="text-left px-4 py-3">Stocks Held</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {topConnected.map((m) => (
                <tr key={m.name} className="hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-medium text-slate-200">{m.name}</td>
                  <td className="px-4 py-3 text-center text-slate-400 text-xs">{m.chamber}</td>
                  <td className="px-4 py-3 text-right text-amber-400 font-mono">{fmt(m.lobbyCash)}</td>
                  <td className="px-4 py-3 text-right text-emerald-400 font-mono">{m.pharmaTrades}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {m.tickers.map((t) => (
                        <span key={t} className="inline-block px-2 py-0.5 rounded bg-slate-800 text-amber-400 text-xs font-mono">
                          {t}
                        </span>
                      ))}
                      {m.tickers.length === 0 && (
                        <span className="text-slate-600 text-xs italic">No trades in DB</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Explanation */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">
          How This Works
        </h2>
        <div className="text-slate-400 text-sm leading-relaxed space-y-3">
          <p>
            <strong className="text-slate-200">Pharmaceutical companies</strong> spend hundreds of millions of dollars lobbying the federal government every year — ranking #1 among all industry sectors at over $130 million annually for pharma alone.
          </p>
          <p>
            Congress members receive this lobby cash through their official offices. At the same time, many of those same members file stock trades showing purchases in pharmaceutical companies — creating a direct financial relationship between legislators and the industry they regulate.
          </p>
          <p>
            This tab cross-references OpenSecrets.org lobbying receipts (who gives money to whom) with the congressional stock trading database (who owns which pharma stocks) to surface members with <strong className="text-slate-200">dual exposure</strong> — benefiting from both the industry's lobbying spend and their personal investment returns.
          </p>
          <p className="text-xs text-slate-600">
            Note: Pharma stock trades are tagged by ticker from the existing {trades.length > 0 ? `congress_trades database (${trades.length} total trades loaded)` : 'congress_trades database'}.
            Lobby cash data is from the most recent reporting cycle on OpenSecrets.org.
          </p>
        </div>
      </section>
    </div>
  );
}