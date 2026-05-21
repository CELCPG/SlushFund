'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { LayoutGrid, Bitcoin, DollarSign, Scale, Network } from 'lucide-react';
import { Tabs, TabDef } from '@/components/ui/Tabs';
import OverviewView from '@/components/influence/OverviewView';

// Overview loads eagerly (default tab). The rest are code-split so the initial
// hub payload stays small — CryptoView and PacsView are each ~800–1200 lines.
const TabLoading = () => (
  <div className="max-w-7xl mx-auto px-4 lg:px-6 py-16 text-center text-sm text-slate-500">
    Loading…
  </div>
);
const CryptoView = dynamic(() => import('@/components/influence/CryptoView'), { loading: TabLoading });
const PacsView = dynamic(() => import('@/components/influence/PacsView'), { loading: TabLoading });
const PolicyView = dynamic(() => import('@/components/influence/PolicyView'), { loading: TabLoading });
const NetworkView = dynamic(() => import('@/components/influence/NetworkView'), { loading: TabLoading });

const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutGrid size={14} /> },
  { id: 'crypto', label: 'Crypto', icon: <Bitcoin size={14} /> },
  { id: 'pacs', label: 'Super PACs', icon: <DollarSign size={14} /> },
  { id: 'policy', label: 'Policy & Bills', icon: <Scale size={14} /> },
  { id: 'network', label: 'Network', icon: <Network size={14} /> },
];

const VALID = new Set(TABS.map((t) => t.id));

function InfluenceHub() {
  const params = useSearchParams();
  const tabParam = params.get('tab');
  const [active, setActive] = useState(tabParam && VALID.has(tabParam) ? tabParam : 'overview');

  // Keep the tab in sync when the URL changes (e.g. navbar links, redirects).
  useEffect(() => {
    if (tabParam && VALID.has(tabParam)) setActive(tabParam);
  }, [tabParam]);

  return (
    <div className="min-h-screen bg-slate-950">
      <Tabs tabs={TABS} active={active} onChange={setActive} />
      {active === 'overview' && <OverviewView />}
      {active === 'crypto' && <CryptoView />}
      {active === 'pacs' && <PacsView />}
      {active === 'policy' && <PolicyView />}
      {active === 'network' && <NetworkView />}
    </div>
  );
}

export default function InfluencePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <InfluenceHub />
    </Suspense>
  );
}
