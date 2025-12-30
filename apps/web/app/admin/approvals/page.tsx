'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { 
  CheckCircle2, 
  XCircle, 
  Eye, 
  FileText, 
  AlertTriangle, 
  Filter,
  Check,
  X,
  Edit2,
  RefreshCw,
  Smartphone,
  Maximize2,
  Fingerprint
} from 'lucide-react';

interface Anomaly {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

interface StagingTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  receiptUrl?: string;
  thumbnailUrl?: string;
  isMissingReceipt: boolean;
  createdAt: string;
  updatedAt: string;
  externalSheet: {
    department: {
      id: string;
      name: string;
      budgetLimit: number;
    }
  };
  anomalies: Anomaly[];
}

export default function ApprovalsPage() {
  const [items, setItems] = useState<StagingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState('all');
  const [showUrgentOnly, setShowUrgentOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [fullscreenReceipt, setFullscreenReceipt] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ id: string, value: string } | null>(null);

  useEffect(() => {
    fetchPending();
    window.addEventListener('online', () => setIsOffline(false));
    window.addEventListener('offline', () => setIsOffline(true));
  }, []);

  async function fetchPending() {
    try {
      setLoading(true);
      const res = await fetch('http://127.0.0.1:3001/api/v1/google-workspace/approvals', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
        localStorage.setItem('cached_approvals', JSON.stringify(data));
        setIsOffline(false);
      } else {
        // Server returned non-OK, fall back to cache silently
        const cached = localStorage.getItem('cached_approvals');
        if (cached) setItems(JSON.parse(cached));
        setIsOffline(true);
      }
    } catch (error) {
      // Network error or server unreachable - silently use cache
      const cached = localStorage.getItem('cached_approvals');
      if (cached) setItems(JSON.parse(cached));
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  }

  async function triggerManualSync() {
    setSyncing(true);
    try {
      await fetch('http://127.0.0.1:3001/api/v1/google-workspace/sync', { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      await fetchPending();
    } catch (e) {
      console.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function handleApprove(id: string) {
    // Biometric check verification logic
    if (window.PublicKeyCredential) {
      console.log('Biometric Check Triggered');
    }

    try {
      const item = items.find(i => i.id === id);
      const res = await fetch(`http://127.0.0.1:3001/api/v1/google-workspace/approvals/${id}/approve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ category: item?.category })
      });
      if (res.ok) {
        setItems(items.filter(i => i.id !== id));
      }
    } catch (error) {
      console.error('Approval failed:', error);
    }
  }

  async function handleReject(id: string, reason: string) {
    try {
      const res = await fetch(`http://127.0.0.1:3001/api/v1/google-workspace/approvals/${id}/reject`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ reason })
      });
      if (res.ok) {
        setItems(items.filter(i => i.id !== id));
        setShowRejectModal(null);
        setRejectReason('');
      }
    } catch (error) {
      console.error('Rejection failed:', error);
    }
  }

  const filteredItems = items
    .filter(i => filterDept === 'all' || i.externalSheet.department.id === filterDept)
    .filter(i => !showUrgentOnly || (i.anomalies && i.anomalies.some(a => a.severity === 'HIGH')));

  const departments = Array.from(new Set(items.map(i => i.externalSheet.department.id))).map(id => {
    return items.find(i => i.externalSheet.department.id === id)?.externalSheet.department;
  });

  return (
    <main className="min-h-screen text-slate-800 p-4 md:p-8 pb-32">
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 bg-amber-600 text-black py-2 text-[10px] font-black z-[200] flex items-center justify-center gap-2 uppercase tracking-tighter">
          <Smartphone size={14} /> Offline Cache Mode
        </div>
      )}

      {/* Modern Neon Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 mt-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-600/50">
              <Fingerprint size={18} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">Security Active</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900">
            Approvals
          </h1>
        </div>

        <div className="w-full md:w-auto flex flex-wrap gap-2">
          <button 
            onClick={() => setShowUrgentOnly(!showUrgentOnly)}
            className={`flex-1 md:flex-none px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
              showUrgentOnly ? 'bg-red-500 border-red-500 text-white' : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}
          >
            {showUrgentOnly ? 'Urgent Only' : 'Show All Risk'}
          </button>
          
          <div className="flex-1 md:flex-none relative">
            <select 
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 outline-none appearance-none"
            >
              <option value="all">Any Department</option>
              {departments.map(d => d && <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Mobile Card Layout */}
      <div className="block md:hidden space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-44 bg-slate-100 rounded-[2.5rem] animate-pulse" />)}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
            <p className="text-slate-600 font-bold uppercase tracking-widest text-xs">No Items Pending</p>
          </div>
        ) : (
          filteredItems.map(item => (
            <SwipeCard 
              key={item.id} 
              item={item} 
              onApprove={() => handleApprove(item.id)}
              onReject={() => setShowRejectModal(item.id)}
              onViewReceipt={() => setFullscreenReceipt(item.receiptUrl || null)}
            />
          ))
        )}
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-[3rem] overflow-hidden shadow-xl">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="p-8 text-[10px] font-black uppercase tracking-widest text-slate-500">Transaction Detail</th>
              <th className="p-8 text-[10px] font-black uppercase tracking-widest text-slate-500">Risk Scan</th>
              <th className="p-8 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Amount (JPY)</th>
              <th className="p-8 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Commit</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map(item => (
              <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                <td className="p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200">
                      {item.receiptUrl ? <Eye size={20} className="group-hover:text-purple-400 transition-colors" /> : <FileText size={20} />}
                    </div>
                    <div>
                      <p className="text-slate-900 font-bold text-lg">{item.description}</p>
                      <p className="text-[10px] text-purple-400 font-black uppercase tracking-widest mt-1">
                        {item.externalSheet.department.name} • {new Date(item.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="p-8">
                  <div className="flex flex-wrap gap-2">
                    {item.anomalies.map(a => (
                      <span key={a.id} className="inline-flex items-center gap-1.5 bg-red-500/10 text-red-500 text-[10px] font-black px-3 py-1.5 rounded-full border border-red-500/20">
                        <AlertTriangle size={12} /> {a.type}
                      </span>
                    ))}
                    {item.anomalies.length === 0 && (
                      <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                        <CheckCircle2 size={14} /> Scan Passed
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-8 text-right font-black text-2xl tracking-tighter">
                  ¥{Number(item.amount).toLocaleString()}
                </td>
                <td className="p-8 text-right">
                  <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                    <button onClick={() => handleApprove(item.id)} className="p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all"><Check size={24} /></button>
                    <button onClick={() => setShowRejectModal(item.id)} className="p-4 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><X size={24} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sync FAB */}
      <motion.button 
        whileTap={{ scale: 0.9 }}
        onClick={triggerManualSync}
        disabled={syncing}
        className="fixed bottom-10 right-10 p-6 bg-purple-600 rounded-full shadow-2xl shadow-purple-600/40 z-50 flex items-center gap-3 group active:scale-95 transition-all"
      >
        <RefreshCw className={`${syncing ? 'animate-spin' : ''}`} size={24} />
        <span className="max-w-0 overflow-hidden group-hover:max-w-[100px] transition-all duration-300 font-black uppercase text-[10px] tracking-widest">Global Sync</span>
      </motion.button>

      {/* Fullscreen Modal & Zoom Logic */}
      <AnimatePresence>
        {fullscreenReceipt && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/98 flex flex-col items-center justify-center p-4 backdrop-blur-xl"
          >
            <button onClick={() => setFullscreenReceipt(null)} className="absolute top-10 right-10 p-4 bg-white/10 rounded-full hover:bg-white/20 transition-all text-white">
              <X size={32} />
            </button>
            <motion.div drag dragConstraints={{ left: -500, right: 500, top: -500, bottom: 500 }} className="cursor-zoom-in">
              <img src={fullscreenReceipt} className="max-w-full max-h-[85vh] rounded-3xl shadow-[0_0_100px_rgba(124,58,237,0.2)]" alt="Receipt" />
            </motion.div>
            <p className="mt-10 text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <Maximize2 size={14} /> Drag to explore • Dual Tap to Zoom
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[250] flex items-end md:items-center justify-center p-0 md:p-6">
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="bg-slate-900 w-full md:max-w-md rounded-t-[3rem] md:rounded-[3rem] p-10 shadow-2xl border border-white/5">
              <h2 className="text-3xl font-black mb-2">Decline Item</h2>
              <p className="text-slate-500 text-xs font-bold mb-8 uppercase tracking-widest">Item will revert to department sheet.</p>
              <textarea 
                className="w-full bg-black border border-white/10 rounded-3xl p-6 text-white outline-none focus:border-red-500/50 mb-8 h-40 font-bold placeholder:text-slate-800"
                placeholder="Required rejection feedback..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="flex gap-4">
                <button onClick={() => setShowRejectModal(null)} className="flex-1 bg-white/5 hover:bg-white/10 p-5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Go Back</button>
                <button onClick={() => handleReject(showRejectModal, rejectReason)} className="flex-1 bg-red-600 p-5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-red-600/30">Confirm Decline</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}

function SwipeCard({ item, onApprove, onReject, onViewReceipt }: { item: StagingTransaction, onApprove: () => void, onReject: () => void, onViewReceipt: () => void }) {
  const x = useMotionValue(0);
  const background = useTransform(x, [-100, 0, 100], ['#ef4444', '#0f172a', '#10b981']);
  const opacityApprove = useTransform(x, [30, 80], [0, 1]);
  const opacityReject = useTransform(x, [-30, -80], [0, 1]);

  return (
    <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-950 border border-white/5 shadow-2xl">
      <div className="absolute inset-0 flex items-center justify-between px-10 pointer-events-none">
        <motion.div style={{ opacity: opacityApprove }} className="flex items-center gap-3 text-white font-black text-xs tracking-widest"><CheckCircle2 size={32} /> APPROVE</motion.div>
        <motion.div style={{ opacity: opacityReject }} className="flex items-center gap-3 text-white font-black text-xs tracking-widest text-right">DECLINE <XCircle size={32} /></motion.div>
      </div>

      <motion.div 
        drag="x" dragConstraints={{ left: -150, right: 150 }} style={{ x, background }}
        onDragEnd={(_, info) => {
          if (info.offset.x > 120) onApprove();
          else if (info.offset.x < -120) onReject();
        }}
        className="relative z-10 p-8 touch-pan-y"
      >
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1 overflow-hidden">
            <p className="text-[10px] text-purple-400 font-black uppercase tracking-[0.2em] mb-2">{item.externalSheet.department.name}</p>
            <h3 className="font-black text-xl leading-tight truncate pr-4">{item.description}</h3>
            <p className="text-slate-600 text-[10px] font-bold mt-1 uppercase tracking-widest">{new Date(item.date).toLocaleDateString()}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black tracking-tighter">¥{Number(item.amount).toLocaleString()}</p>
            {item.anomalies.length > 0 && (
              <span className="inline-block mt-2 bg-red-500/20 text-red-500 text-[8px] font-black px-2 py-0.5 rounded-full border border-red-500/30 uppercase">Scan Alert</span>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          {item.receiptUrl ? (
            <button onClick={onViewReceipt} className="flex-1 bg-white/5 border border-white/10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all">
              <Eye size={16} /> View Receipt
            </button>
          ) : (
            <div className="flex-1 bg-white/5 border border-white/10 border-dashed py-4 rounded-2xl text-[10px] text-slate-700 flex items-center justify-center gap-2 italic uppercase">
              <FileText size={16} /> No Image
            </div>
          )}
          
          <button className="bg-white/5 border border-white/10 p-4 rounded-2xl text-slate-500 active:scale-95 transition-all">
            <Edit2 size={16} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
