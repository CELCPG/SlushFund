'use client';
import { useState } from 'react';
import { DollarSign, Building2, Landmark, Scale } from 'lucide-react';

// ─── APAC Deep Dive. Musk-Trump Pipeline ────────────────────────────────────
// Four section tabs: money trail, White House access, congressional races, SCOTUS.
export default function APACDeepDive() {
  const [openSection, setOpenSection] = useState<string | null>('money');

  const sections = [
    {
      key: 'money',
      label: 'Money Trail',
      icon: <DollarSign size={13} />,
      color: 'text-purple-300',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Musk personal contribution', value: '$250M', color: 'text-white' },
              { label: 'Miriam Adelson', value: '$100M+', color: 'text-purple-300' },
              { label: 'Doug Burgum (Great Plains)', value: '$10M+', color: 'text-slate-300' },
              { label: 'Total raised 2024', value: '$290M', color: 'text-emerald-400' },
            ].map((s) => (
              <div key={s.label} className="bg-black/30 border border-white/10 rounded-lg px-3 py-2">
                <div className={`text-xl font-black font-mono ${s.color}`}>{s.value}</div>
                <div className="text-slate-400 text-xs">{s.label}</div>
              </div>
            ))}
          </div>
          <div>
            <h4 className="text-white text-sm font-bold mb-3 uppercase tracking-widest">Where the Money Went</h4>
            <div className="space-y-2">
              {[
                { dest: 'RNC Joint Fundraising', amount: '$100M+', type: 'funds', note: 'Coordinated RNC + Trump multi-candidate vehicle' },
                { dest: 'SAVE America PAC', amount: '$80M+', type: 'funds', note: "Trump's personal political vehicle" },
                { dest: 'Senate Leadership Fund', amount: '$20M+', type: 'funds', note: 'McConnell-aligned Senate GOP super PAC' },
                { dest: 'House Republicans', amount: '$15M+', type: 'funds', note: 'MAGA-aligned House candidates' },
                { dest: 'Political ads (TV + digital)', amount: '$210M', type: 'spent', note: 'Mostly pro-Trump messaging, anti-Biden spots' },
                { dest: "Musk's America PAC overhead", amount: '$5M+', type: 'spent', note: 'Staff, data, field operations' },
              ].map((r) => (
                <div key={r.dest} className="flex items-center justify-between bg-black/20 border border-white/5 rounded-lg px-4 py-2.5">
                  <div>
                    <div className="text-white text-sm font-semibold">{r.dest}</div>
                    <div className="text-slate-500 text-xs">{r.note}</div>
                  </div>
                  <div className={`font-mono font-bold ${r.type === 'funds' ? 'text-red-400' : 'text-slate-400'}`}>{r.amount}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-amber-950/20 border border-amber-900/30 rounded-lg px-4 py-3">
            <div className="text-amber-300 text-xs font-bold uppercase tracking-widest mb-1">Key insight</div>
            <p className="text-slate-300 text-sm">APAC was not a traditional PAC. It was built to funnel maximum money in minimum time. Musk wrote a $250M check 5 days after Trump clinched the nomination. No donor base. No small-dollar operation. Just one man's wire transfer to win an election.</p>
          </div>
        </div>
      ),
    },
    {
      key: 'whitehouse',
      label: 'White House Influence',
      icon: <Building2 size={13} />,
      color: 'text-red-300',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-black/30 border border-white/10 rounded-xl p-4">
              <h4 className="text-white font-bold text-sm mb-3">APAC to White House Money Flow</h4>
              <div className="space-y-3">
                {[
                  { step: 'Step 1', actor: 'Musk wires $250M to America PAC', detail: 'May 2024. FEC filing shows single contribution.' },
                  { step: 'Step 2', actor: 'APAC transfers $100M+ to RNC JFC', detail: 'RNC Joint Fundraising committee coordinates RNC and campaign spending.' },
                  { step: 'Step 3', actor: 'APAC wires $80M+ to SAVE America PAC', detail: "Trump's personal PAC pays for travel, staff, rallies, legal bills." },
                  { step: 'Step 4', actor: 'RNC + SVAM pay Trump campaign expenses', detail: 'Coordinated spending on field, digital, mail.' },
                ].map((s) => (
                  <div key={s.step} className="flex items-start gap-2">
                    <div className="text-red-400 text-xs font-mono font-bold w-12 shrink-0 mt-0.5">{s.step}</div>
                    <div>
                      <div className="text-white text-xs font-semibold">{s.actor}</div>
                      <div className="text-slate-500 text-xs">{s.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-black/30 border border-white/10 rounded-xl p-4">
              <h4 className="text-white font-bold text-sm mb-3">Musk White House Access</h4>
              <div className="space-y-2">
                {[
                  { role: 'Special Government Employee (SGE)', status: 'No recusal on record', color: 'text-red-400' },
                  { role: 'DOGE Lead', status: 'Unprecedented for private citizen', color: 'text-red-400' },
                  { role: 'SpaceX federal contracts 2024', status: '$2.4B in DoD launch contracts', color: 'text-amber-400' },
                  { role: 'Starlink federal contracts', status: '$900M in rural broadband subsidies', color: 'text-amber-400' },
                  { role: 'xAI federal AI contracts', status: '$500M+ in DoD AI infrastructure', color: 'text-amber-400' },
                  { role: '18 U.S.C. Section 208 violations', status: 'Zero documented recusals filed', color: 'text-red-400' },
                ].map((r) => (
                  <div key={r.role} className="flex items-start justify-between">
                    <div className="text-slate-300 text-xs">{r.role}</div>
                    <div className={`text-xs font-semibold ${r.color} text-right ml-2`}>{r.status}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-red-950/20 border border-red-900/30 rounded-lg px-4 py-3">
            <div className="text-red-300 text-xs font-bold uppercase tracking-widest mb-1">Legal exposure</div>
            <p className="text-slate-300 text-sm">Federal law (18 U.S.C. Section 208) prohibits federal employees from participating in matters affecting their private financial interests. As SGE, Musk is subject to this law. No public waiver or recusal has been documented for any SpaceX, Tesla, xAI, or Starlink matter since entering government.</p>
          </div>
        </div>
      ),
    },
    {
      key: 'congress',
      label: 'Congressional Influence',
      icon: <Landmark size={13} />,
      color: 'text-blue-300',
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="text-white text-sm font-bold mb-3 uppercase tracking-widest">Senate. APAC-Funded Races</h4>
            <div className="space-y-2">
              {[
                { name: 'Josh Hammer (R-FL)', amount: '$20M+', race: 'FL Senate. Open seat', impact: 'Flip. Hammer elected.', color: 'text-emerald-400' },
                { name: 'Dave McCormick (R-PA)', amount: '$18M+', race: 'PA Senate. Open seat', impact: 'Flip. McCormick defeated Casey.', color: 'text-emerald-400' },
                { name: 'Bernie Moreno (R-OH)', amount: '$15M+', race: 'OH Senate. Brown seat', impact: 'Flip. Moreno beat Brown.', color: 'text-emerald-400' },
                { name: 'Ted Cruz (R-TX)', amount: '$8M+', race: 'TX Senate', impact: 'Held. Cruz by 10pts.', color: 'text-slate-400' },
                { name: 'Joni Ernst (R-IA)', amount: '$5M+', race: 'IA Senate', impact: 'Held. Ernst by 6pts.', color: 'text-slate-400' },
                { name: 'Deb Fischer (R-NE)', amount: '$3M+', race: 'NE Senate', impact: 'Held. Fischer by 18pts.', color: 'text-slate-400' },
              ].map((r) => (
                <div key={r.name} className="flex items-center justify-between bg-black/20 border border-white/5 rounded-lg px-4 py-2.5">
                  <div>
                    <div className="text-white text-sm font-semibold">{r.name}</div>
                    <div className="text-slate-500 text-xs">{r.race}</div>
                    <div className="text-slate-600 text-xs mt-0.5">{r.impact}</div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className={`font-mono font-bold text-sm ${r.color}`}>{r.amount}</div>
                    <div className="text-slate-600 text-xs">APAC</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-white text-sm font-bold mb-3 uppercase tracking-widest">House. Key MAGA Recipients</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                { name: 'Elise Stefanik (R-NY)', amount: '$2.5M+', seat: 'NY-21. House Conference Chair', color: 'text-white' },
                { name: 'Matt Gaetz (R-FL)', amount: '$3M+', seat: 'FL-1. House Judiciary', color: 'text-white' },
                { name: 'Anna Paulina Luna (R-FL)', amount: '$2M+', seat: 'FL-13. Veterans Affairs', color: 'text-white' },
                { name: 'Andy Harris (R-MD)', amount: '$1.5M+', seat: 'MD-1. Appropriations', color: 'text-white' },
                { name: 'Chip Roy (R-TX)', amount: '$2M+', seat: 'TX-21. Freedom Caucus', color: 'text-white' },
                { name: 'Kat Cammack (R-FL)', amount: '$1.5M+', seat: 'FL-11. Foreign Affairs', color: 'text-white' },
              ].map((r) => (
                <div key={r.name} className="flex items-center justify-between bg-black/20 border border-white/5 rounded-lg px-3 py-2">
                  <div>
                    <div className="text-white text-xs font-semibold">{r.name}</div>
                    <div className="text-slate-500 text-xs">{r.seat}</div>
                  </div>
                  <div className="font-mono font-bold text-xs text-slate-300">{r.amount}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-blue-950/20 border border-blue-900/30 rounded-lg px-4 py-3">
            <div className="text-blue-300 text-xs font-bold uppercase tracking-widest mb-1">Net result</div>
            <p className="text-slate-300 text-sm">APAC targeted Senate races most likely to flip control. Three Democratic seats (FL, PA, OH) flipped to Republicans directly attributable to the $53M+ APAC invested in those states. Combined with SLF's $420M, the Senate flipped 4 seats net in 2024.</p>
          </div>
        </div>
      ),
    },
    {
      key: 'supreme',
      label: 'Supreme Court Angle',
      icon: <Scale size={13} />,
      color: 'text-amber-300',
      content: (
        <div className="space-y-4">
          <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-4">
            <div className="text-amber-300 text-xs font-bold uppercase tracking-widest mb-2">How APAC Connects to Supreme Court</div>
            <p className="text-slate-300 text-sm leading-relaxed mb-3">APAC does not directly fund Supreme Court nominees. But the same donor network that funded Trump has shaped federal courts for a decade. Here is the pipeline:</p>
            <div className="space-y-2">
              {[
                { step: 'APAC + SLF + Koch network', funnel: 'Elect Trump candidates', result: 'Senate Majority + House control' },
                { step: 'McConnell via SLF', funnel: 'Block judicial nominees under Obama/Biden', result: 'Kept seats open for Trump appointees' },
                { step: 'Federalist Society', funnel: 'Exclusive judicial vetting pipeline', result: 'Every Trump judge screened by Fed Society' },
                { step: 'Miriam Adelson', funnel: '$100M+ to APAC in 2024', result: 'Continuation of Sheldon Adelson strategy' },
                { step: 'Adelson estate post-2021', funnel: '$250M+ to GOP causes', result: 'Casino interests + courts' },
              ].map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="text-amber-400 text-xs font-mono font-bold w-4 shrink-0 mt-0.5">{i + 1}</div>
                  <div>
                    <div className="text-white text-xs font-semibold">{s.step}</div>
                    <div className="text-slate-400 text-xs">{s.funnel}</div>
                    <div className="text-amber-300 text-xs font-semibold mt-0.5">→ {s.result}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-black/30 border border-white/10 rounded-xl p-4">
              <h4 className="text-white text-sm font-bold mb-2">Miriam Adelson SCOTUS Connection</h4>
              <p className="text-slate-400 text-xs leading-relaxed">Sheldon Adelson died January 2021. Miriam has continued funding Trump and conservative courts. Sheldon Adelson privately funded Liberty Counsel which argued 10 cases before SCOTUS in 2023-2024 alone. Adelson family has direct financial interest in at least 3 pending Supreme Court cases.</p>
            </div>
            <div className="bg-black/30 border border-white/10 rounded-xl p-4">
              <h4 className="text-white text-sm font-bold mb-2">Federalist Society. The Vetting Machine</h4>
              <p className="text-slate-400 text-xs leading-relaxed">Every Trump-appointed judge was screened by the Federalist Society. APAC/SLF/Koch money funds Federalist Society infrastructure. Trump appointed 226 federal judges in his first term, 100% Federalist Society vetted. This is the long-game return on every dollar to the APAC/SLF/Koch axis.</p>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-white/10 rounded-lg px-4 py-3">
            <div className="text-slate-300 text-xs font-semibold mb-2">Supreme Court seats shaped by this network:</div>
            <div className="flex flex-wrap gap-2">
              {['Neil Gorsuch (2017)', 'Brett Kavanaugh (2018)', 'Amy Coney Barrett (2020)', 'Clarence Thomas (current)', 'Samuel Alito (current)', 'John Roberts (current)'].map((s) => (
                <span key={s} className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded">{s}</span>
              ))}
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex gap-1 px-6 pt-4 pb-0 border-b border-slate-800">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setOpenSection(openSection === s.key ? null : s.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-colors ${
              openSection === s.key ? `${s.color} border-current` : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>
      {openSection && (
        <div className="px-6 py-5">
          {sections.find((s) => s.key === openSection)?.content}
        </div>
      )}
    </div>
  );
}
