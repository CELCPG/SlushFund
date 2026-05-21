'use client';

const STEPS = [
  {
    n: 1,
    short: 'No-bid contract',
    label: 'A no-bid contract is awarded',
    detail: 'A federal agency hands a contract to a politically connected vendor, with no competition.',
  },
  {
    n: 2,
    short: 'Insider owns stock',
    label: 'The insider already owns the stock',
    detail: 'A politician on the committee overseeing that agency holds shares before the public knows.',
  },
  {
    n: 3,
    short: 'Stock jumps',
    label: 'The award goes public and the stock jumps',
    detail: 'The contract is announced. The share price climbs on the news.',
  },
  {
    n: 4,
    short: 'Insider sells',
    label: 'The insider sells at the top',
    detail: 'They exit on the spike. The 401ks and pensions that bought in are left holding it.',
  },
  {
    n: 5,
    short: 'PAC pays back',
    label: "The vendor's PAC funds re-election",
    detail: 'Dark money flows back to the same politician. Same committee, next contract cycle.',
  },
];

// 5 nodes on a circle, r=120, centered at (160,160), starting at top.
const CENTER = 160;
const RADIUS = 120;
const NODES = STEPS.map((s, i) => {
  const angle = (-90 + i * 72) * (Math.PI / 180);
  return {
    ...s,
    x: CENTER + RADIUS * Math.cos(angle),
    y: CENTER + RADIUS * Math.sin(angle),
  };
});

/** Animated, code-built "cycle" graphic for the self-dealing loop. */
export default function LoopDiagram() {
  return (
    <section className="border-b border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="max-w-2xl">
          <span className="text-xs font-mono uppercase tracking-widest text-amber-400">
            The pattern
          </span>
          <h2 className="text-white font-black text-3xl md:text-4xl mt-3 mb-3">The Loop</h2>
          <p className="text-slate-300 text-lg leading-relaxed">
            This isn&apos;t corruption slipping through the cracks. It&apos;s a closed cycle:
            the same five moves, over and over, with public money.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center mt-10">
          {/* Animated circular diagram */}
          <div className="relative mx-auto w-full max-w-md">
            <svg viewBox="0 0 320 320" className="w-full h-auto" role="img" aria-label="The Loop cycle diagram">
              <defs>
                <marker
                  id="loop-arrow"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M0 0 L10 5 L0 10 z" fill="#E63946" />
                </marker>
              </defs>

              {/* Rotating outer ring */}
              <g style={{ transformOrigin: '160px 160px' }} className="animate-spin-slow">
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={RADIUS + 20}
                  fill="none"
                  stroke="#2a2a3a"
                  strokeWidth="1"
                  strokeDasharray="2 8"
                />
              </g>

              {/* Connecting arcs between consecutive nodes */}
              {NODES.map((node, i) => {
                const next = NODES[(i + 1) % NODES.length];
                return (
                  <path
                    key={`arc-${i}`}
                    d={`M ${node.x} ${node.y} A ${RADIUS} ${RADIUS} 0 0 1 ${next.x} ${next.y}`}
                    fill="none"
                    stroke="#E63946"
                    strokeWidth="2"
                    strokeDasharray="6 6"
                    strokeLinecap="round"
                    markerEnd="url(#loop-arrow)"
                    className="animate-dash-flow"
                    style={{ opacity: 0.7 }}
                  />
                );
              })}

              {/* Center hub */}
              <circle cx={CENTER} cy={CENTER} r="50" fill="#15151f" stroke="#3a3a4a" strokeWidth="1" />
              <text
                x={CENTER}
                y={CENTER - 4}
                textAnchor="middle"
                className="fill-white"
                style={{ fontSize: '15px', fontWeight: 900, fontStyle: 'italic' }}
              >
                THE
              </text>
              <text
                x={CENTER}
                y={CENTER + 14}
                textAnchor="middle"
                fill="#E63946"
                style={{ fontSize: '15px', fontWeight: 900, fontStyle: 'italic' }}
              >
                LOOP
              </text>

              {/* Nodes */}
              {NODES.map((node, i) => (
                <g
                  key={`node-${i}`}
                  className="animate-node-pulse"
                  style={{ animationDelay: `${i * 0.48}s` }}
                >
                  <circle cx={node.x} cy={node.y} r="24" fill="#1a1a24" stroke="#E63946" strokeWidth="2" />
                  <text
                    x={node.x}
                    y={node.y + 6}
                    textAnchor="middle"
                    className="fill-white"
                    style={{ fontSize: '18px', fontWeight: 800 }}
                  >
                    {node.n}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          {/* Numbered steps */}
          <ol className="space-y-3">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="flex gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4"
              >
                <span className="shrink-0 w-8 h-8 rounded-full bg-[var(--slush-red)]/15 border border-[var(--slush-red)]/50 text-[var(--slush-red)] font-black flex items-center justify-center text-sm">
                  {s.n}
                </span>
                <div>
                  <div className="text-white font-bold text-sm">{s.label}</div>
                  <div className="text-slate-400 text-sm leading-relaxed mt-0.5">{s.detail}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Caption */}
        <div className="mt-10 max-w-3xl border-l-2 border-[var(--slush-red)] pl-5">
          <p className="text-white font-semibold text-lg leading-relaxed">
            Your taxes fund the contract. Your 401k funds their exit. Your retirement holds the
            bag.
          </p>
          <p className="text-amber-400 font-black text-xl mt-2">Time to break the loop.</p>
        </div>
      </div>
    </section>
  );
}
