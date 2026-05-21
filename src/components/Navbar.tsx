'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3, Landmark, DollarSign, PieChart, Bitcoin, Home,
  ChevronDown, Shield, TrendingUp, Database,
  Activity, AlertTriangle, FileText, ArrowRight, Scale, Network, Menu, X, Search
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    label: 'Federal Spending',
    icon: <BarChart3 size={14} />,
    color: 'text-emerald-400',
    links: [
      { href: '/dashboard', label: 'All Spending', icon: <Database size={12} /> },
      { href: '/compare', label: 'Era Comparison', icon: <BarChart3 size={12} /> },
      { href: '/defense', label: 'Defense Contracts', icon: <Shield size={12} /> },
      { href: '/covid', label: 'COVID Deep Dive', icon: <AlertTriangle size={12} /> },
      { href: '/tech', label: 'Tech & AI', icon: <Activity size={12} /> },
    ],
  },
  {
    label: 'Congress Trading',
    icon: <Landmark size={14} />,
    color: 'text-blue-400',
    links: [
      { href: '/congress/trades', label: 'All Trades', icon: <TrendingUp size={12} /> },
      { href: '/congress/trades?chamber=senate', label: 'Senate', icon: null },
      { href: '/congress/trades?chamber=house', label: 'House', icon: null },
      { href: '/congress/trades/trump', label: 'Trump OGE 278-T', icon: <FileText size={12} /> },
      { href: '/congress/trades?has_contract=true', label: 'Contractor Overlap', icon: <AlertTriangle size={12} /> },
      { href: '/analysis/companies', label: 'Company Deep Dives', icon: <Shield size={12} /> },
      { href: '/blog', label: 'Blog & Investigations', icon: <FileText size={12} /> },
    ],
  },
  {
    label: 'Influence',
    icon: <DollarSign size={14} />,
    color: 'text-amber-400',
    links: [
      { href: '/influence', label: 'Influence Overview', icon: <PieChart size={12} /> },
      { href: '/influence?tab=crypto', label: 'Crypto & Government', icon: <Bitcoin size={12} /> },
      { href: '/influence?tab=pacs', label: 'Super PACs & Dark Money', icon: <DollarSign size={12} /> },
      { href: '/influence?tab=policy', label: 'Policy & Bills', icon: <Scale size={12} /> },
      { href: '/influence?tab=network', label: 'Influence Network', icon: <Network size={12} /> },
    ],
  },
  {
    label: 'Analysis',
    icon: <PieChart size={14} />,
    color: 'text-purple-400',
    links: [
      { href: '/analysis', label: 'Deep Analytics', icon: <PieChart size={12} /> },
      { href: '/analysis#cost-overruns', label: 'Cost Overruns', icon: null },
      { href: '/analysis#insider-trading', label: 'Insider Signals', icon: null },
      { href: '/explain', label: 'How It All Works', icon: <Network size={12} /> },
      { href: '/explain/network', label: 'The Web', icon: <Network size={12} /> },
    ],
  },
  {
    label: 'DOGE',
    icon: <AlertTriangle size={14} />,
    color: 'text-red-400',
    links: [
      { href: '/doge', label: 'DOGE: The Real Score', icon: <AlertTriangle size={12} /> },
      { href: '/doge#savings', label: 'Savings Tracker', icon: null },
      { href: '/doge#conflicts', label: 'Conflicts of Interest', icon: null },
      { href: '/doge#winners', label: "Who's Winning", icon: null },
    ],
  },
];

export default function Navbar() {
  const pathname = usePathname();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close on route change
  useEffect(() => {
    setOpenDropdown(null);
    setMobileOpen(false);
    setMobileSection(null);
  }, [pathname]);

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href.split('?')[0].split('#')[0]);
  }

  // Hover handlers — open on hover, close after a short delay (desktop)
  function openOnHover(label: string) {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenDropdown(label);
  }
  function closeOnLeave() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenDropdown(null), 140);
  }

  return (
    <nav className="sticky top-0 z-[9998] bg-slate-950/95 backdrop-blur border-b border-slate-800" ref={navRef}>
      <div className="max-w-7xl mx-auto px-4 lg:px-6">
        <div className="flex items-center h-14 gap-1">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 mr-4 shrink-0">
            <img
              src="/slushfund-logo.png"
              alt="SlushFund"
              className="h-9 w-auto object-contain"
              style={{ imageRendering: 'crisp-edges' }}
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-0.5 flex-1">
            <Link
              href="/"
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                pathname === '/' ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Home size={13} />
              <span>Home</span>
            </Link>

            {NAV_SECTIONS.map((section) => {
              const active = section.links.some(l => isActive(l.href));
              const open = openDropdown === section.label;
              return (
                <div
                  key={section.label}
                  className="relative"
                  onMouseEnter={() => openOnHover(section.label)}
                  onMouseLeave={closeOnLeave}
                >
                  <button
                    onClick={() => setOpenDropdown(open ? null : section.label)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      open || active
                        ? `${section.color} bg-slate-800/60`
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <span className={open || active ? section.color : ''}>{section.icon}</span>
                    <span>{section.label}</span>
                    <ChevronDown size={11} className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>

                  {open && (
                    <div className="absolute top-full left-0 pt-1.5 w-56 z-[9999]">
                      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/80 overflow-hidden">
                        <div className="px-3 py-2 border-b border-slate-800">
                          <span className={`text-xs font-bold uppercase tracking-widest ${section.color}`}>{section.label}</span>
                        </div>
                        <div className="py-1">
                          {section.links.map((link) => (
                            <Link
                              key={link.href}
                              href={link.href}
                              className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                                isActive(link.href)
                                  ? 'text-white bg-slate-800'
                                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                              }`}
                            >
                              {link.icon && <span className="text-slate-500">{link.icon}</span>}
                              <span>{link.label}</span>
                              {isActive(link.href) && (
                                <ArrowRight size={11} className="ml-auto text-slate-500" />
                              )}
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-900 border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400 text-xs">Live Data</span>
            </div>

            {/* Primary CTA */}
            <Link
              href="/dashboard"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-bold bg-[var(--slush-red)] hover:bg-[var(--slush-red-dark)] text-white transition-colors"
            >
              <Search size={13} /> Explore Data
            </Link>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-md text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors border border-slate-800"
            >
              {mobileOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {/* Mobile menu — per-section accordion */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-slate-800 py-3 space-y-1">
            <Link
              href="/"
              className={`flex items-center gap-2 px-3 py-2.5 text-sm rounded-md ${
                pathname === '/' ? 'text-white bg-slate-800' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Home size={14} /> Home
            </Link>

            {NAV_SECTIONS.map((section) => {
              const expanded = mobileSection === section.label;
              const active = section.links.some(l => isActive(l.href));
              return (
                <div key={section.label} className="rounded-md overflow-hidden">
                  <button
                    onClick={() => setMobileSection(expanded ? null : section.label)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                      expanded || active ? `${section.color} bg-slate-800/60` : 'text-slate-300 hover:bg-slate-800/40'
                    }`}
                  >
                    <span className={section.color}>{section.icon}</span>
                    <span>{section.label}</span>
                    <ChevronDown
                      size={14}
                      className={`ml-auto text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {expanded && (
                    <div className="py-1 bg-slate-900/60">
                      {section.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={`flex items-center gap-2 pl-9 pr-3 py-2 text-sm rounded-md ${
                            isActive(link.href) ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {link.icon && <span className="text-slate-500">{link.icon}</span>}
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <Link
              href="/dashboard"
              className="mt-2 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md text-sm font-bold bg-[var(--slush-red)] hover:bg-[var(--slush-red-dark)] text-white transition-colors"
            >
              <Search size={14} /> Explore Data
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
