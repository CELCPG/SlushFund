'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, TrendingUp, ArrowRight } from 'lucide-react';
import type { LatestItem } from '@/lib/latest';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SkeletonCard } from '@/components/ui/Skeleton';

type Filter = 'all' | 'contract' | 'trade';

function timeAgo(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`).getTime();
  const days = Math.floor((Date.now() - d) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function LatestFeed() {
  const [items, setItems] = useState<LatestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataUnavailable, setDataUnavailable] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/latest?limit=60');
        const data = await res.json();
        if (cancelled) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setDataUnavailable(Boolean(data.unavailable));
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = filter === 'all' ? items : items.filter((i) => i.kind === filter);
  const TABS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Everything' },
    { key: 'contract', label: 'Contracts' },
    { key: 'trade', label: 'Trades' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === t.key ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : dataUnavailable || filtered.length === 0 ? (
        <Card padding="lg" className="text-center text-sm text-slate-400">
          {dataUnavailable
            ? 'The activity feed is unavailable: the contract and trade databases did not answer.'
            : 'No recent activity in this category.'}
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <Link key={item.id} href={item.href} className="group block">
              <Card padding="md" className="transition-colors hover:border-slate-600">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 shrink-0 ${item.kind === 'contract' ? 'text-emerald-400' : 'text-blue-400'}`}>
                    {item.kind === 'contract' ? <FileText className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate font-semibold text-white group-hover:text-emerald-400">{item.title}</h3>
                      <span className="shrink-0 text-xs text-slate-500">{timeAgo(item.date)}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-sm text-slate-400">{item.description}</p>
                    {item.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.tags.map((tag) => (
                          <Badge key={tag} tone={item.kind === 'contract' ? 'warning' : 'info'}>
                            {tag.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-600 group-hover:text-emerald-400" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
