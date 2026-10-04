'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Building2, TrendingUp, Network } from 'lucide-react';
import { Tabs, TabDef } from '@/components/ui/Tabs';
import LobbyingView from '@/components/healthcare/LobbyingView';
import PharmaStocksView from '@/components/healthcare/PharmaStocksView';
import CorrelationView from '@/components/healthcare/CorrelationView';

const TabLoading = () => (
  <div className="max-w-7xl mx-auto px-4 lg:px-6 py-16 text-center text-sm text-slate-500">
    Loading…
  </div>
);

const TABS: TabDef[] = [
  { id: 'lobbying', label: 'Lobbying', icon: <Building2 size={14} /> },
  { id: 'stocks', label: 'Pharma Stocks', icon: <TrendingUp size={14} /> },
  { id: 'correlation', label: 'The Connection', icon: <Network size={14} /> },
];

const VALID = new Set(TABS.map((t) => t.id));

function HealthcareHub() {
  const params = useSearchParams();
  const tabParam = params.get('tab');
  const [active, setActive] = useState(
    tabParam && VALID.has(tabParam) ? tabParam : 'lobbying',
  );

  useEffect(() => {
    if (tabParam && VALID.has(tabParam)) setActive(tabParam);
  }, [tabParam]);

  return (
    <div className="min-h-screen bg-slate-950">
      <Tabs tabs={TABS} active={active} onChange={setActive} />
      {active === 'lobbying' && <LobbyingView />}
      {active === 'stocks' && <PharmaStocksView />}
      {active === 'correlation' && <CorrelationView />}
    </div>
  );
}

export default function HealthcarePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <HealthcareHub />
    </Suspense>
  );
}