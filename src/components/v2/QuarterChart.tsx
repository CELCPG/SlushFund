import type { QuarterBucket } from '@/lib/v2/people';

/**
 * Disclosed transactions per quarter: stock purchases above the line, stock sales below, and
 * everything else (exchanges, options, other assets) as a number under the quarter. Counts only;
 * no amounts (the disclosed bands can't be added up). Scrolls sideways inside its card on phones.
 */
export default function QuarterChart({ buckets, label }: { buckets: QuarterBucket[]; label: string }) {
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.buys, b.sells)));
  const H = 84;
  const h = (n: number) => (n ? Math.max(4, Math.round((n / max) * H)) : 0);
  const anyOther = buckets.some((b) => b.other);
  return (
    <div className="overflow-x-auto pb-1">
      <div role="img" aria-label={label} className="inline-flex min-w-full items-stretch gap-1.5">
        <div aria-hidden className="flex w-[54px] shrink-0 flex-col text-[11.5px] font-semibold text-muted">
          <span className="flex items-start" style={{ height: H + 16 }}>Purchases</span>
          <span className="flex items-end" style={{ height: H + 16 }}>Sales</span>
          <span className="mt-1.5 h-[16px]" />
          {anyOther && <span className="h-[16px] leading-[16px]">Other</span>}
        </div>
        {buckets.map((b) => (
          <div key={b.key} aria-hidden className="flex w-[34px] shrink-0 flex-col items-center">
            <div className="flex w-full flex-col items-center justify-end" style={{ height: H + 16 }}>
              {b.buys > 0 && <span className="font-mono text-[10.5px] leading-[14px] text-trades-ink">{b.buys}</span>}
              <span className="w-[24px] rounded-t-[4px] bg-trades" style={{ height: h(b.buys) }} />
            </div>
            <div className="h-px w-full bg-ink/60" />
            <div className="flex w-full flex-col items-center justify-start" style={{ height: H + 16 }}>
              <span className="w-[24px] rounded-b-[4px] bg-[#8B6BE0]" style={{ height: h(b.sells) }} />
              {b.sells > 0 && <span className="font-mono text-[10.5px] leading-[14px] text-trades-ink">{b.sells}</span>}
            </div>
            <span className="mt-1.5 h-[16px] whitespace-nowrap font-mono text-[10.5px] leading-[16px] text-muted">
              {b.q === 1 || b === buckets[0] ? `Q${b.q} '${String(b.year).slice(2)}` : `Q${b.q}`}
            </span>
            {anyOther && <span className="h-[16px] font-mono text-[10.5px] leading-[16px] text-muted">{b.other || ''}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
