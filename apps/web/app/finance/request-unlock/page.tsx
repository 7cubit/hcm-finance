'use client';

import { useState, useEffect } from 'react';
import { 
  Building2, 
  Calendar, 
  Send, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';

export default function RequestUnlockPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [status, setStatus] = useState<'IDLE' | 'SUBMITTING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [formData, setFormData] = useState({
    departmentId: '',
    month: '',
    year: new Date().getFullYear(),
    reason: '',
    email: ''
  });

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  useEffect(() => {
    fetchDepartments();
  }, []);

  async function fetchDepartments() {
    try {
      const res = await fetch('http://127.0.0.1:3001/api/v1/public/info'); // Just testing connectvity
      // In a real app, since this is public, we might need a public/departments list
      // For now, let's fetch from the public-friendly info or assume we need to add a public dept list
      const deptRes = await fetch('http://127.0.0.1:3001/api/v1/departments', {
         // This might fail if auth is required. 
         // Let's assume for this phase we fetch the names.
      });
      // Fallback if not logged in (which is likely)
      setDepartments([
        { id: 'treasurer', name: 'Treasurer' },
        { id: 'media', name: 'Media Team' },
        { id: 'worship', name: 'Worship Team' }
      ]);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('SUBMITTING');
    try {
      const res = await fetch('http://127.0.0.1:3001/api/v1/unlock-requests/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) setStatus('SUCCESS');
      else setStatus('ERROR');
    } catch (e) {
      setStatus('ERROR');
    }
  }

  if (status === 'SUCCESS') {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100">
        <div className="max-w-md w-full bg-slate-900 border border-emerald-500/20 rounded-3xl p-10 text-center shadow-2xl shadow-emerald-500/5 animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h1 className="text-2xl font-bold mb-4">Request Sent!</h1>
          <p className="text-slate-400 mb-8">
            The Treasurer has been notified. You will receive an email once your request is reviewed.
          </p>
          <button 
            onClick={() => setStatus('IDLE')}
            className="w-full bg-slate-800 hover:bg-slate-700 py-3 rounded-xl transition-all"
          >
            Submit another request
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100 font-sans">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-xl w-full relative z-10 glass-panel p-10 rounded-[40px] border border-white/10 shadow-2xl backdrop-blur-xl bg-white/5 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
            <Calendar className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Finance Unlock</h1>
            <p className="text-slate-400 text-sm">Request a temporary 24-hour edit window.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Department</label>
              <select 
                required
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl px-4 py-3.5 outline-none focus:border-purple-500 transition-all appearance-none cursor-pointer"
                onChange={(e) => setFormData({...formData, departmentId: e.target.value})}
              >
                <option value="">Select Department</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Target Month</label>
              <select 
                required
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl px-4 py-3.5 outline-none focus:border-purple-500 transition-all appearance-none cursor-pointer"
                onChange={(e) => setFormData({...formData, month: e.target.value})}
              >
                <option value="">Select Month</option>
                {months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Your Email</label>
            <input 
              required
              type="email"
              placeholder="e.g. volunteer@hcmj.org"
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl px-4 py-3.5 outline-none focus:border-purple-500 transition-all"
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Reason for Unlock</label>
            <textarea 
              required
              placeholder="e.g. Forgot to add utility bill for January..."
              className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl px-4 py-3.5 outline-none focus:border-purple-500 transition-all h-32 resize-none"
              onChange={(e) => setFormData({...formData, reason: e.target.value})}
            />
          </div>

          {status === 'ERROR' && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm animate-in shake duration-300">
              <AlertCircle size={20} />
              <p>Something went wrong. Please try again or contact the Treasurer.</p>
            </div>
          )}

          <button 
            type="submit"
            disabled={status === 'SUBMITTING'}
            className="w-full bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white font-bold py-4 rounded-2xl shadow-xl shadow-purple-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-3 group"
          >
            {status === 'SUBMITTING' ? 'Processing...' : 'Submit Request'}
            <Send size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-slate-800 flex items-center justify-center gap-6 text-slate-500 text-xs">
          <div className="flex items-center gap-1.5"><HelpCircle size={14} /> 24hr Window</div>
          <div className="flex items-center gap-1.5"><HelpCircle size={14} /> Auto Re-Lock</div>
          <div className="flex items-center gap-1.5"><HelpCircle size={14} /> Auditor Approved</div>
        </div>
      </div>
    </main>
  );
}
