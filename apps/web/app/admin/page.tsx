import {
  Wallet,
  DollarSign,
  Users,
  Cloud,
  ArrowUpRight,
  ShieldCheck,
  Rocket,
  FileText,
  Globe,
} from 'lucide-react';
import { AdminClock } from './AdminClock';

async function getStats() {
  // In a real app, this would fetch from the serverClient
  // const res = await serverClient('/admin/stats');
  // return res.json();

  return {
    donations: '¥24.8M',
    revenue: '¥2.4M',
    members: '1,240',
    status: 'STABLE'
  };
}

export default async function AdminDashboard() {
  const stats = await getStats();

  return (
    <main>
      {/* Header Section */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter text-slate-900 uppercase mb-2">
            Command Center <span className="bg-primary inline-block w-3 h-3 rounded-full mb-2 ml-1 align-middle animate-pulse" />
          </h2>
          <div className="flex items-center gap-4 text-xs font-mono tracking-widest text-slate-500">
            <span className="flex items-center gap-1">
              STATUS: <span className="text-secondary">AUTHENTICATED</span>
            </span>
            <span className="text-slate-300">•</span>
            <span>REGION: TOKYO/JP</span>
          </div>
        </div>
        <div className="text-right">
          <AdminClock />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        {/* Card 1: Total Donations */}
        <div className="group relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-6 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:border-primary/50">
          <div className="absolute top-0 right-0 p-4">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">
              +14%
              <ArrowUpRight size={10} />
            </span>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
              <Wallet size={20} />
            </div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Total Donations</h3>
          </div>
          <div className="text-4xl font-mono font-bold text-slate-900 mb-1">
            {stats.donations}
          </div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">Lifetime Acquisition</p>
          <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-primary/20 rounded-full blur-2xl group-hover:bg-primary/30 transition-all" />
        </div>

        {/* Card 2: Fiscal Month */}
        <div className="group relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-6 transition-all duration-300 hover:shadow-lg hover:shadow-secondary/10 hover:border-secondary/50">
          <div className="absolute top-0 right-0 p-4">
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-1 text-xs font-medium text-secondary ring-1 ring-inset ring-secondary/20">
              +12%
            </span>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
              <DollarSign size={20} />
            </div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Fiscal Month</h3>
          </div>
          <div className="text-4xl font-mono font-bold text-slate-900 mb-1">
            {stats.revenue}
          </div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">Estimated Revenue</p>
          <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-secondary/20 rounded-full blur-2xl group-hover:bg-secondary/30 transition-all" />
        </div>

        {/* Card 3: Active Members */}
        <div className="group relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-6 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:border-primary/50">
          <div className="absolute top-0 right-0 p-4">
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-1 text-xs font-medium text-purple-400 ring-1 ring-inset ring-purple-500/20">
              Stable
            </span>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
              <Users size={20} />
            </div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Active Members</h3>
          </div>
          <div className="text-4xl font-mono font-bold text-slate-900 mb-1">
            {stats.members}
          </div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">Verified Accounts</p>
        </div>

        {/* Card 4: Cloud Status */}
        <div className="group relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-6 transition-all duration-300 hover:shadow-lg hover:shadow-secondary/10 hover:border-secondary/50">
          <div className="absolute top-0 right-0 p-4">
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-1 text-xs font-medium text-secondary ring-1 ring-inset ring-secondary/20">
              99.9%
            </span>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
              <Cloud size={20} />
            </div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Cloud Status</h3>
          </div>
          <div className="text-4xl font-mono font-bold text-slate-900 mb-1 tracking-tight">
            {stats.status}
          </div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">Node Latency: 24ms</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Ledger */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-primary" size={16} />
              <h3 className="text-sm font-bold uppercase italic tracking-wider text-slate-900">System Ledger</h3>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-green-500">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              LIVE MONITORING
            </div>
          </div>
          <div className="flex-1 rounded-2xl bg-white border border-slate-200 p-8 flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="relative z-10 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                <ShieldCheck className="text-slate-400" size={40} />
              </div>
              <h4 className="text-xl font-bold tracking-widest text-slate-900 mb-2 uppercase">Integrity Confirmed</h4>
              <p className="text-sm text-slate-500 font-mono">No unauthorized modifications detected in the current session.</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          </div>
        </div>

        {/* Quick Deploy */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-2 px-1">
            <Rocket className="text-secondary" size={16} />
            <h3 className="text-sm font-bold uppercase italic tracking-wider text-slate-900">Quick Deploy</h3>
          </div>
          <div className="flex-1 rounded-2xl bg-white border border-slate-200 p-6 flex flex-col gap-4">
            <button className="group w-full relative flex items-center justify-center gap-3 px-6 py-4 bg-slate-900 text-white rounded-lg font-bold uppercase tracking-wider text-sm transition-transform active:scale-[0.98] shadow-lg hover:shadow-xl">
              <FileText size={20} />
              Review Orders
              <div className="absolute inset-0 rounded-lg ring-2 ring-white/20 group-hover:ring-white/40 transition-all" />
            </button>
            <button
              onClick={() => window.location.href = '/admin/departments'}
              className="group w-full flex items-center justify-center gap-3 px-6 py-3 bg-transparent border border-slate-300 text-slate-700 rounded-lg font-bold uppercase tracking-wider text-sm hover:bg-slate-100 hover:text-slate-900 transition-all"
            >
              <ArrowUpRight className="text-slate-400 group-hover:text-slate-600 transition-colors" size={20} />
              Manage Units
            </button>
            <div className="grid grid-cols-2 gap-4 mt-auto">
              <button className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-600 hover:border-secondary hover:text-secondary transition-colors uppercase">
                + Signal
              </button>
              <button className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-600 hover:border-secondary hover:text-secondary transition-colors uppercase">
                Export Log
              </button>
            </div>
          </div>
        </div>
      </div>

      <p className="fixed bottom-6 left-6 z-50 text-[10px] font-mono text-slate-400 uppercase tracking-widest">
        Secure Terminal v1.0.4
      </p>
    </main>
  );
}
