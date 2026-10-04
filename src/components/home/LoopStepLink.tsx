'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { trackEvent } from '@/components/Plausible';

type Props = {
  step: { n: number; label: string; desc: string; href: string };
};

/**
 * Step card in the Loop explainer. Tracks clicks as a Plausible event so we
 * can see which step of the funnel visitors pull on.
 */
export default function LoopStepLink({ step }: Props) {
  return (
    <Link
      href={step.href}
      onClick={() => trackEvent('loop_step_click', { step: step.n, label: step.label })}
      className="group relative rounded-xl border border-slate-800 bg-slate-900/40 p-5 hover:border-red-600/50 hover:bg-slate-900/60 transition-colors block"
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-10 h-10 rounded-full bg-red-600/10 border border-red-600/30 flex items-center justify-center text-red-400 font-black font-mono">
          {step.n}
        </div>
        <div className="flex-1">
          <h3 className="text-white font-bold text-lg mb-1">{step.label}</h3>
          <p className="text-slate-400 text-sm">{step.desc}</p>
          <p className="text-red-400/70 text-xs font-mono mt-2 group-hover:text-red-300 transition-colors">
            See the evidence for step {step.n} →
          </p>
        </div>
        <ArrowRight size={16} className="text-slate-600 group-hover:text-red-400 transition-colors mt-2" />
      </div>
    </Link>
  );
}
