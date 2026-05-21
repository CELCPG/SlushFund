'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  BarChart3, Landmark, Bitcoin, ChevronDown, ChevronRight,
  TrendingUp, Shield, AlertTriangle, DollarSign, PieChart,
  Activity, Database, FileText, ExternalLink, Scale, Network
} from 'lucide-react';

const SECTIONS = [
  {
    label: 'Federal Spending',
    icon: <BarChart3 size={15} className="text-emerald-400" />,
    href: '/dashboard',
    color: 'emerald',
    links: [
      { href: '/dashboard', label: 'All Spending', icon: <Database size={13} /> },
      { href: '/defense', label: 'Defense Contracts', icon: <Shield size={13} /> },
      { href: '/tech', label: 'Tech & AI', icon: <Activity size={13} /> },
    ],
  },
  {
    label: 'Congress Trading',
    icon: <Landmark size={15} className="text-blue-400" />,
    href: '/congress/trades',
    color: 'blue',
    links: [
      { href: '/congress/trades', label: 'All Trades', icon: <TrendingUp size={13} /> },
      { href: '/congress/trades?chamber=senate', label: 'Senate', icon: null },
      { href: '/congress/trades?chamber=house', label: 'House', icon: null },
      { href: '/congress/trades/trump', label: 'Trump OGE 278-T', icon: <FileText size={13} /> },
      { href: '/congress/trades?has_contract=true', label: 'Contractor Overlap', icon: <AlertTriangle size={13} /> },
      { href: '/analysis/companies', label: 'Company Deep Dives', icon: <Shield size={13} /> },
    ],
  },
  {
    label: 'Influence',
    icon: <DollarSign size={15} className="text-amber-400" />,
    href: '/influence',
    color: 'orange',
    links: [
      { href: '/influence', label: 'Influence Overview', icon: <PieChart size={13} /> },
      { href: '/influence?tab=crypto', label: 'Crypto & Government', icon: <Bitcoin size={13} /> },
      { href: '/influence?tab=pacs', label: 'Super PACs & Dark Money', icon: <DollarSign size={13} /> },
      { href: '/influence?tab=policy', label: 'Policy & Bills', icon: <Scale size={13} /> },
      { href: '/influence?tab=network', label: 'Influence Network', icon: <Network size={13} /> },
    ],
  },
  {
    label: 'Analytics',
    icon: <PieChart size={15} className="text-purple-400" />,
    href: '/analysis',
    color: 'purple',
    links: [
      { href: '/analysis', label: 'Deep Analytics', icon: <PieChart size={13} /> },
      { href: '/analysis#cost-overruns', label: 'Cost Overruns', icon: null },
      { href: '/analysis#insider-trading', label: 'Insider Signals', icon: null },
      { href: '/analysis/companies', label: 'Company Deep Dives', icon: null },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'Federal Spending': true,
    'Congress Trading': true,
    'Influence': true,
    'Analytics': true,
  });

  const toggleSection = (label: string) => {
    setOpenSections(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const isActiveSection = (section: typeof SECTIONS[0]) => {
    if (pathname === section.href) return true;
    return section.links.some(l => pathname === l.href);
  };

  const colorMap: Record<string, string> = {
    emerald: 'border-emerald-900/50',
    blue: 'border-blue-900/50',
    orange: 'border-orange-900/50',
    purple: 'border-purple-900/50',
  };

  const activeColorMap: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-950/40',
    blue: 'text-blue-400 bg-blue-950/40',
    orange: 'text-orange-400 bg-orange-950/40',
    purple: 'text-purple-400 bg-purple-950/40',
  };

  return (
    <>
      {/* Mobile toggle — shown above content on small screens */}
      <div className="lg:hidden w-full px-4 py-2 border-b border-slate-800 bg-slate-950">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 text-slate-400 text-xs hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          <span>Navigation</span>
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`
          hidden lg:flex flex-col border-r border-slate-800 bg-slate-950 transition-all duration-200 shrink-0
          ${collapsed ? 'w-14' : 'w-56'}
        `}
      >
        {/* Collapse toggle */}
        <div className="flex items-center justify-end px-2 py-2 border-b border-slate-800/50">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-slate-600 hover:text-slate-300 transition-colors p-1 rounded"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} className="rotate-90" />}
          </button>
        </div>

        {/* Sections */}
        <nav className="flex-1 overflow-y-auto py-2">
          {SECTIONS.map((section) => {
            const active = isActiveSection(section);
            const open = openSections[section.label] ?? false;
            const borderColor = colorMap[section.color];
            const activeText = activeColorMap[section.color];

            return (
              <div key={section.label} className="mb-1">
                {/* Section header */}
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    onClick={() => !collapsed && toggleSection(section.label)}
                    className={`flex items-center gap-2 flex-1 min-w-0 ${collapsed ? '' : 'cursor-default'}`}
                  >
                    {section.icon}
                    {!collapsed && (
                      <span className={`text-xs font-semibold truncate ${active ? activeText : 'text-slate-300'}`}>
                        {section.label}
                      </span>
                    )}
                  </button>
                  {!collapsed && (
                    <button
                      onClick={() => toggleSection(section.label)}
                      className="text-slate-600 hover:text-slate-300 shrink-0 transition-colors"
                    >
                      {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                  )}
                </div>

                {/* Links */}
                {!collapsed && open && (
                  <div className={`ml-5 border-l ${borderColor} pl-2 space-y-0.5`}>
                    {section.links.map((link) => {
                      const isActive = pathname === link.href;
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors ${
                            isActive
                              ? 'text-white bg-slate-800 font-medium'
                              : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/40'
                          }`}
                        >
                          {link.icon && <span className="text-slate-400">{link.icon}</span>}
                          <span className="truncate">{link.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Data source footer */}
        {!collapsed && (
          <div className="px-3 py-3 border-t border-slate-800/50">
            <a
              href="https://usaspending.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-slate-600 hover:text-slate-300 text-xs transition-colors"
            >
              <ExternalLink size={11} />
              <span>USAspending.gov</span>
            </a>
          </div>
        )}
      </aside>

      {/* Mobile dropdown overlay */}
      {collapsed === false && (
        <div className="lg:hidden fixed inset-0 z-40 bg-slate-950/95 pt-14">
          <nav className="px-4 py-4 space-y-4">
            {SECTIONS.map((section) => {
              const open = openSections[section.label] ?? false;
              return (
                <div key={section.label}>
                  <Link
                    href={section.href}
                    onClick={() => setCollapsed(true)}
                    className="flex items-center gap-2 text-sm font-semibold text-slate-200 hover:text-white mb-2"
                  >
                    {section.icon}
                    {section.label}
                  </Link>
                  {open && (
                    <div className="ml-7 space-y-1">
                      {section.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setCollapsed(true)}
                          className="block text-xs text-slate-400 hover:text-white py-1"
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}