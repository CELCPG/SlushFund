'use client';

import { useState } from 'react';
import { Calculator, Users, PiggyBank, GraduationCap, Heart } from 'lucide-react';
import { fmt } from '@/lib/utils';

interface Props {
  /** The dollar amount to translate. */
  amount: number;
  /** Optional override for the label. */
  label?: string;
}

const TAXPAYERS = 130_000_000;          // ~US tax filers + dependents, rough
const MEDIAN_401K_BALANCE = 28_000;     // median 401k balance
const TEACHER_SALARY = 65_000;          // avg public school teacher
const APPETITE_UNIT = 8;                // $8 per meal in school lunch program

function formatMoney(n: number): string {
  if (n < 0.01) return '< $0.01';
  if (n < 1) return `$${n.toFixed(2)}`;
  if (n < 100) return `$${n.toFixed(2)}`;
  return `$${Math.round(n).toLocaleString()}`;
}

/**
 * "Who Pays" module — translates a federal dollar figure into units the
 * reader can feel. Aggressive microcopy. Use on contract / receipt pages.
 */
export default function WhoPays({ amount, label = 'this contract' }: Props) {
  const [open, setOpen] = useState(false);

  const perTaxpayer = amount / TAXPAYERS;
  const as401kContribs = amount / 2000;           // $2k avg annual employee contrib
  const asTeacherYears = amount / TEACHER_SALARY;  // years of a teacher's pay
  const asSchoolLunches = amount / APPETITE_UNIT; // school lunch equivalents

  return (
    <div className="rounded-xl border border-red-900/40 bg-gradient-to-br from-red-950/30 to-slate-900/60 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-red-950/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="shrink-0 w-9 h-9 rounded-full bg-red-600/15 border border-red-600/40 flex items-center justify-center text-red-400">
            <Calculator size={16} />
          </span>
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-red-400">Who pays for this?</div>
            <div className="text-white font-bold text-base">
              You paid <span className="text-red-300">{formatMoney(perTaxpayer)}</span> for {label}.
            </div>
          </div>
        </div>
        <span className="text-xs text-slate-400 font-mono">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="border-t border-red-900/40 px-5 py-4 grid sm:grid-cols-2 gap-3">
          <WhoPaysRow
            icon={<Users size={14} className="text-blue-300" />}
            headline={`${fmt.compact(perTaxpayer)}`}
            sub="per taxpayer, your share"
            detail={`Federal tax base is roughly ${TAXPAYERS.toLocaleString()} filers. Your cut of ${label} is ${formatMoney(perTaxpayer)}.`}
            aggressive="Your taxes fund the contract."
          />
          <WhoPaysRow
            icon={<PiggyBank size={14} className="text-emerald-300" />}
            headline={`${fmt.compact(as401kContribs)}`}
            sub="median 401k annual contributions"
            detail={`A median 401k holder contributes about $2,000 a year. ${label} is worth ${fmt.compact(as401kContribs)} of those.`}
            aggressive="Your 401k funds their exit."
          />
          <WhoPaysRow
            icon={<GraduationCap size={14} className="text-purple-300" />}
            headline={`${asTeacherYears.toFixed(1)}`}
            sub="years of a public school teacher's pay"
            detail={`A teacher earns ~$${TEACHER_SALARY.toLocaleString()}/year. ${label} could fund ${asTeacherYears.toFixed(1)} years of one.`}
            aggressive="That salary never made the news."
          />
          <WhoPaysRow
            icon={<Heart size={14} className="text-rose-300" />}
            headline={`${fmt.compact(asSchoolLunches)}`}
            sub="school lunches, at $8 each"
            detail={`The federal school lunch program spends ~$8 per meal. ${label} is ${fmt.compact(asSchoolLunches)} meals for kids.`}
            aggressive="That's lunch money for a generation of kids."
          />
        </div>
      )}
    </div>
  );
}

function WhoPaysRow({
  icon, headline, sub, detail, aggressive,
}: {
  icon: React.ReactNode;
  headline: string;
  sub: string;
  detail: string;
  aggressive: string;
}) {
  return (
    <div className="rounded-lg bg-slate-950/50 border border-slate-800 p-3">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="shrink-0">{icon}</span>
        <span className="text-2xl font-black text-white font-mono">{headline}</span>
      </div>
      <div className="text-xs text-slate-400 mb-2">{sub}</div>
      <p className="text-xs text-slate-500 leading-relaxed mb-2">{detail}</p>
      <p className="text-xs font-bold text-red-300 italic leading-relaxed">{aggressive}</p>
    </div>
  );
}
