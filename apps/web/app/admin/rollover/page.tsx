'use client';

import { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Send,
  Loader2,
  Lock,
  ArrowRight
} from 'lucide-react';

export default function RolloverPage() {
  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [targetYear] = useState(2026);
  const [options, setOptions] = useState({ carryOver: true, notifyStaff: true });
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    if (step === 1) fetchPreview();
  }, [step]);

  async function fetchPreview() {
    setIsLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:3001/api/v1/rollover/preview?year=${targetYear}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setPreview(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleExecute() {
    setIsLoading(true);
    setStep(3);
    try {
      const res = await fetch('http://127.0.0.1:3001/api/v1/rollover/execute', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ targetYear, ...options })
      });
      if (res.ok) setResults(await res.json());
      else setStep(2); // Fail back to config
    } catch (e) {
      console.error(e);
      setStep(2);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen text-slate-800 p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center border border-purple-200">
              <RefreshCw size={28} />
            </div>
            Fiscal Rollover
          </h1>
          <p className="text-slate-400">Orchestrate the transition from {targetYear - 1} to {targetYear}.</p>
        </div>

        {/* Steps Tracker */}
        <div className="flex items-center gap-4 mb-12">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-all ${
                step >= s ? 'bg-purple-600 border-purple-500 text-white' : 'border-slate-200 text-slate-400'
              }`}>
                {step > s ? <CheckCircle2 size={20} /> : s}
              </div>
              {s < 3 && <div className={`w-12 h-0.5 ${step > s ? 'bg-purple-600' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white border border-slate-200 rounded-[32px] p-10 shadow-xl">
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold mb-6 text-slate-900">Step 1: System Audit</h2>
              <p className="text-slate-400 mb-8">Checking current departments and 2025 sheet status.</p>
              
              <div className="space-y-4 mb-10">
                {isLoading ? (
                  <div className="flex flex-col items-center py-20 gap-4">
                    <Loader2 className="animate-spin text-purple-500" size={40} />
                    <p className="text-slate-500 text-sm">Auditing active departments...</p>
                  </div>
                ) : (
                  preview.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                          <ShieldCheck size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-900">{d.name}</p>
                          <p className="text-[10px] text-slate-500 tracking-wider">MIGRATING {d.userCount} USERS</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Budget Limit</p>
                        <p className="text-sm font-mono text-purple-400">¥{d.budgetLimit.toLocaleString()}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button 
                onClick={() => setStep(2)}
                className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
              >
                Configure Rollover <ChevronRight size={20} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-bold mb-6 text-slate-900">Step 2: Rollover Options</h2>
              
              <div className="space-y-6 mb-10">
                <div 
                  onClick={() => setOptions({...options, carryOver: !options.carryOver})}
                  className={`p-6 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    options.carryOver ? 'bg-purple-500/10 border-purple-500/50' : 'bg-slate-950 border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex gap-4">
                    <div className={`p-3 rounded-xl ${options.carryOver ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                      <RefreshCw size={24} />
                    </div>
                    <div>
                      <p className="font-bold">Carry-Over Balances</p>
                      <p className="text-xs text-slate-500">Transfer positive/negative balances from {targetYear-1}.</p>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${options.carryOver ? 'bg-purple-500 border-purple-400 text-white' : 'border-slate-800'}`}>
                    {options.carryOver && <CheckCircle2 size={14} />}
                  </div>
                </div>

                <div 
                  onClick={() => setOptions({...options, notifyStaff: !options.notifyStaff})}
                  className={`p-6 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    options.notifyStaff ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-slate-950 border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex gap-4">
                    <div className={`p-3 rounded-xl ${options.notifyStaff ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                      <Send size={24} />
                    </div>
                    <div>
                      <p className="font-bold">Email Notifications</p>
                      <p className="text-xs text-slate-500">Blast new 2026 sheet links to all Department Heads.</p>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${options.notifyStaff ? 'bg-cyan-500 border-cyan-400 text-white' : 'border-slate-800'}`}>
                    {options.notifyStaff && <CheckCircle2 size={14} />}
                  </div>
                </div>

                <div className="p-6 rounded-2xl border bg-red-500/5 border-red-500/20 flex gap-4">
                  <Lock className="text-red-400 shrink-0" size={24} />
                  <div>
                    <p className="text-red-400 font-bold text-sm underline underline-offset-4 decoration-red-500/30 mb-1">Archival Protocol</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed uppercase tracking-wider">
                      ALL {targetYear-1} SHEETS WILL BE RENAMED TO [ARCHIVED] AND FULLY LOCKED. THIS ACTION CANNOT BE AUTOMATICALLY REVERSED.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={() => setStep(1)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl transition-all">
                  Back
                </button>
                <button 
                  onClick={handleExecute}
                  className="flex-[2] bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-bold py-4 rounded-2xl hover:brightness-110 transition-all shadow-xl shadow-purple-500/20"
                >
                  Start {targetYear} Initialization
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in fade-in zoom-in-95 duration-500 text-center py-10">
              {!results ? (
                <>
                  <div className="relative w-32 h-32 mx-auto mb-10">
                    <div className="absolute inset-0 rounded-full border-4 border-purple-500/10 border-t-purple-500 animate-spin" />
                    <div className="absolute inset-4 rounded-full border-4 border-cyan-500/10 border-b-cyan-500 animate-spin-slow" />
                    <RefreshCw className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-400" size={32} />
                  </div>
                  <h2 className="text-3xl font-bold mb-4">Initializing {targetYear}...</h2>
                  <p className="text-slate-500 max-w-sm mx-auto">
                    Please keep this window open while we archive old records and generate new Workspace environments.
                  </p>
                </>
              ) : (
                <div className="text-left py-4">
                   <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-8">
                    <CheckCircle2 size={40} />
                  </div>
                  <h2 className="text-3xl font-bold text-center mb-8">{targetYear} Rollover Complete!</h2>
                  
                  <div className="space-y-3 mb-10">
                    {results.results.map((r: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                        <div className="flex items-center gap-3">
                          {r.status === 'SUCCESS' ? <CheckCircle2 className="text-emerald-500" size={16} /> : <AlertCircle className="text-red-500" size={16} />}
                          <span className="text-sm font-medium">{r.department}</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${r.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                          {r.status}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={() => window.location.href = '/admin/departments'}
                    className="w-full bg-slate-800 hover:bg-slate-700 py-4 rounded-2xl transition-all flex items-center justify-center gap-2 group"
                  >
                    Return to Dashboard <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
