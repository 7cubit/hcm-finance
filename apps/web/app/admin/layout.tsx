'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Globe } from 'lucide-react';

interface HealthData {
  status: string;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch('http://127.0.0.1:3001/api/v1/health');
        if (res.ok) {
          const data = await res.json();
          setHealth(data);
        }
      } catch {
        // API not available
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-800 dark:text-slate-200 font-sans antialiased transition-colors duration-300">
      <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-surface-light/90 dark:bg-background-dark/90 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary/30">
                H
              </div>
              <div className="leading-tight">
                <h1 className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">HCMJ</h1>
                <p className="text-[10px] font-mono text-primary uppercase tracking-widest">Finance OS</p>
              </div>
            </div>
            <nav className="hidden lg:flex items-center space-x-1">
              {[
                { label: 'Dashboard', href: '/admin' },
                { label: 'Departments', href: '/admin/departments' },
                { label: 'Approvals', href: '/admin/approvals' },
                { label: 'Rollover', href: '/admin/rollover' },
                { label: 'Security', href: '/admin/security' },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? 'text-slate-900 dark:text-white border-b-2 border-primary'
                      : 'text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary'
                  }`}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              <span className="text-xs font-mono text-secondary uppercase tracking-wider">Encrypted</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-slate-800 pl-4">
              <Globe size={16} />
              <span>NODE-ONLINE</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
              AD
            </div>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <div className="max-w-[1600px] mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  );
}
