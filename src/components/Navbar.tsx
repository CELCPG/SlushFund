'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ExternalLink, Database, BarChart3 } from 'lucide-react';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard', icon: <BarChart3 size={14} /> },
  { href: '/about', label: 'About' },
];

export default function Navbar() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-white">
          <span className="text-lg">💰</span>
          <span className="font-black tracking-tight">Slush Fund</span>
        </Link>
        <div className="flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                pathname === link.href
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
          <a
            href="https://usaspending.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 ml-2 px-3 py-1.5 rounded-md text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
          >
            <ExternalLink size={14} />
            USAspending
          </a>
        </div>
      </div>
    </nav>
  );
}