import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function About() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-12">
        <div>
          <h1 className="text-4xl font-black text-white mb-4">About Slush Fund</h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            An independent tool for tracking federal spending and political connections in the Trump administration.
            Built as an open civic-tech project for journalists, researchers, and concerned citizens.
          </p>
        </div>

        <div className="space-y-8">
          {[
            {
              title: 'What We Track',
              content: 'Every federal contract, grant, and direct award published on USAspending.gov starting from FY2024. We focus on awards to politically connected vendors — companies tied to Elon Musk, the Trump family, major donors, and administration allies.',
            },
            {
              title: 'How It Works',
              content: 'Data is pulled from USAspending.gov and FPDS.gov via their public APIs. Each contract is analyzed for political connection signals (vendor name matching against known entities), competition status (no-bid, sole-source, limited competition), and pricing anomalies. Flagged contracts are surfaced in the dashboard.',
            },
            {
              title: 'Connection Mapping',
              content: 'We maintain a list of known politically connected vendors and their connection type: Trump Family, Elon Musk, Trump Ally/Donor, Mar-a-Lago Adjacent, Lobbyist/Consultant. New connections are added as they are identified.',
            },
            {
              title: 'Data Sources',
              items: [
                'USAspending.gov — official federal spending database',
                'FPDS.gov — Federal Procurement Data System',
                'OpenSecrets.org — campaign finance and lobbying data',
                'ProPublica — congressional and contract investigations',
              ],
            },
            {
              title: 'Flag Types',
              items: [
                'No Bid — contract awarded without competitive process',
                'Sole Source — only one vendor capable of fulfilling contract',
                'Related Party — vendor directly connected to administration',
                'Inflated — price significantly above market rate',
                'No Compete — contract not opened to competition',
              ],
            },
            {
              title: 'Methodology',
              content: 'We use a risk scoring system (0–100) based on: connection type (Elon Musk +30, Trump Family +40), competition status (no-bid +25), contract size ($100M+ adds 15–20 points), and flag type. Higher scores indicate higher concern. This is directional analysis — all contracts should be verified against primary sources.',
            },
          ].map((section) => (
            <div key={section.title} className="border border-slate-800 bg-slate-900 rounded-xl p-6">
              <h2 className="text-white font-bold text-xl mb-3">{section.title}</h2>
              {section.content && (
                <p className="text-slate-400 leading-relaxed">{section.content}</p>
              )}
              {section.items && (
                <ul className="space-y-2 mt-2">
                  {section.items.map((item) => (
                    <li key={item} className="text-slate-400 text-sm flex items-start gap-2">
                      <span className="text-emerald-500 mt-1">›</span>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-white font-bold text-xl mb-3">Limitations</h2>
          <p className="text-slate-400 leading-relaxed">
            This tool uses mock data for demonstration purposes. A production version would connect live to USAspending.gov APIs.
            Political connection attribution is based on publicly available information and may not capture all relationships.
            This is not legal or financial advice. Always verify with primary sources.
          </p>
        </div>

        <div className="text-center">
          <Link href="/dashboard" className="text-emerald-400 hover:underline text-sm">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}