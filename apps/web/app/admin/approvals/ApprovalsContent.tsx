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

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

export function ApprovalsContent({ initialItems }: { initialItems: StagingTransaction[] }) {
  const queryClient = useQueryClient();
  const [filterDept, setFilterDept] = useState('all');
  const [showUrgentOnly, setShowUrgentOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [fullscreenReceipt, setFullscreenReceipt] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ id: string, value: string } | null>(null);
  const [user, setUser] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<StagingTransaction | null>(null);

  const { data: items = initialItems, isLoading: loading } = useQuery({
    queryKey: ['approvals'],
    queryFn: async () => {
      const res = await apiClient('/google-workspace/approvals');
      if (!res.ok) throw new Error('API Error');
      return res.json();
    },
    initialData: initialItems,
  });

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await apiClient('/auth/me');
        if (res.ok) setUser(await res.json());
      } catch (e) { console.error(e); }
    }
    fetchUser();

    window.addEventListener('online', () => setIsOffline(false));
    window.addEventListener('offline', () => setIsOffline(true));
    return () => {
      window.removeEventListener('online', () => setIsOffline(false));
      window.removeEventListener('offline', () => setIsOffline(true));
    };
  }, []);

  async function triggerManualSync() {
    setSyncing(true);
    try {
      await apiClient('/google-workspace/sync', { method: 'POST' });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    } catch (e) {
      console.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const item = items.find((i: any) => i.id === id);
      const res = await apiClient(`/google-workspace/approvals/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ category: item?.category })
      });
      if (!res.ok) throw new Error('Approval failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string, reason: string }) => {
      const res = await apiClient(`/google-workspace/approvals/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      if (!res.ok) throw new Error('Rejection failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      setShowRejectModal(null);
      setRejectReason('');
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await apiClient('/google-workspace/approvals/bulk-approve', {
        method: 'POST',
        body: JSON.stringify({ ids })
      });
      if (!res.ok) throw new Error('Bulk approval failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      setSelectedIds([]);
    },
  });

  async function handleApprove(id: string) {
    approveMutation.mutate(id);
  }

  async function handleBulkApprove() {
    if (selectedIds.length === 0) return;
    if (!confirm(`Approve ${selectedIds.length} items?`)) return;
    bulkApproveMutation.mutate(selectedIds);
  }

  async function handleReject(id: string, reason: string) {
    rejectMutation.mutate({ id, reason });
  }

  const isTreasurer = user?.role === 'TREASURER' || user?.role === 'SUPER_ADMIN';

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map((i: any) => i.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const filteredItems = items
    .filter((i: any) => filterDept === 'all' || i.externalSheet.department.id === filterDept)
    .filter((i: any) => !showUrgentOnly || (i.anomalies && i.anomalies.some((a: any) => a.severity === 'HIGH')));

  const departments = Array.from(new Set(items.map((i: any) => i.externalSheet.department.id))).map(id => {
    return items.find((i: any) => i.externalSheet.department.id === id)?.externalSheet.department;
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
          {selectedIds.length > 0 && isTreasurer && (
            <button
              onClick={handleBulkApprove}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              Commit Selected ({selectedIds.length})
            </button>
          )}

          <button
            onClick={() => setShowUrgentOnly(!showUrgentOnly)}
            className={`flex-1 md:flex-none px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${showUrgentOnly ? 'bg-red-500 border-red-500 text-white' : 'bg-slate-100 border-slate-200 text-slate-600'
              }`}
          >
            {showUrgentOnly ? 'Risk Center' : 'Filter Risk'}
          </button>

          <div className="flex-1 md:flex-none relative">
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 outline-none appearance-none pr-8"
            >
              <option value="all">Any Department</option>
              {departments.map(d => d && <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <Filter size={12} />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Card Layout */}
      <div className="block md:hidden space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i: any) => <div key={i} className="h-44 bg-slate-100 rounded-[2.5rem] animate-pulse" />)}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
            <p className="text-slate-600 font-bold uppercase tracking-widest text-xs">No Items Pending</p>
          </div>
        ) : (
          filteredItems.map((item: any) => (
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
              <th className="p-8 w-12">
                <input
                  type="checkbox"
                  checked={selectedIds.length === filteredItems.length && filteredItems.length > 0}
                  onChange={toggleSelectAll}
                  className="w-5 h-5 rounded-lg border-slate-300 text-purple-600 focus:ring-purple-500 transition-all cursor-pointer"
                />
              </th>
              <th className="p-8 text-[10px] font-black uppercase tracking-widest text-slate-500">Transaction Detail</th>
              <th className="p-8 text-[10px] font-black uppercase tracking-widest text-slate-500">Risk Scan</th>
              <th className="p-8 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Amount (JPY)</th>
              <th className="p-8 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Commit</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item: any) => (
              <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => setSelectedItem(item)}>
                <td className="p-8" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    className="w-5 h-5 rounded-lg border-slate-300 text-purple-600 focus:ring-purple-500 transition-all cursor-pointer"
                  />
                </td>
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
                    {item.anomalies.map((a: any) => (
                      <span key={a.id} className={`inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1.5 rounded-full border ${a.severity === 'HIGH' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                        }`}>
                        <AlertTriangle size={12} /> {a.type.replace('_', ' ')}
                      </span>
                    ))}
                    {item.amount >= 75000 && !item.anomalies.some((a: any) => a.type === 'HIGH_RISK') && (
                      <span className="inline-flex items-center gap-1.5 bg-red-500/10 text-red-500 text-[10px] font-black px-3 py-1.5 rounded-full border border-red-500/20">
                        <AlertTriangle size={12} /> HIGH RISK
                      </span>
                    )}
                    {item.anomalies.length === 0 && item.amount < 75000 && (
                      <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                        <CheckCircle2 size={14} /> Safe
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-8 text-right font-black text-2xl tracking-tighter">
                  ¥{Number(item.amount).toLocaleString()}
                </td>
                <td className="p-8 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                    {isTreasurer && (
                      <button onClick={() => handleApprove(item.id)} className="p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all"><Check size={24} /></button>
                    )}
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
        className="fixed bottom-10 right-10 p-6 bg-purple-600 rounded-full shadow-2xl shadow-purple-600/40 z-50 flex items-center gap-3 group active:scale-95 transition-all text-white"
      >
        <RefreshCw className={`${syncing ? 'animate-spin' : ''}`} size={24} />
        <span className="max-w-0 overflow-hidden group-hover:max-w-[100px] transition-all duration-300 font-black uppercase text-[10px] tracking-widest whitespace-nowrap">Global Sync</span>
      </motion.button>

      {/* Transaction Detail Side Drawer */}
      <AnimatePresence>
        {selectedItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-2xl z-[210] overflow-y-auto p-10 border-l border-slate-200"
            >
              <div className="flex justify-between items-center mb-10">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-3 bg-slate-100 hover:bg-slate-200 rounded-full transition-all text-slate-500"
                >
                  <X size={24} />
                </button>
                <div className="flex gap-3">
                  {isTreasurer && (
                    <button
                      onClick={() => { handleApprove(selectedItem.id); setSelectedItem(null); }}
                      className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                    >
                      <Check size={18} /> Commit
                    </button>
                  )}
                  <button
                    onClick={() => { setShowRejectModal(selectedItem.id); setSelectedItem(null); }}
                    className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                  >
                    <XCircle size={18} /> Reject
                  </button>
                </div>
              </div>

              <div className="space-y-8">
                <div>
                  <h2 className="text-4xl font-black text-slate-900 mb-2 leading-tight">{selectedItem.description}</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-purple-100 text-purple-600 px-3 py-1 rounded-full">
                      {selectedItem.externalSheet.department.name}
                    </span>
                    <span className="text-slate-400 text-xs font-bold">
                      {new Date(selectedItem.date).toLocaleDateString(undefined, { dateStyle: 'full' })}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 bg-slate-50 rounded-[2rem] p-8 border border-slate-100">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Staged Amount</label>
                    <p className="text-3xl font-black text-slate-900 tracking-tighter">¥{Number(selectedItem.amount).toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Category Hub</label>
                    <p className="text-xl font-bold text-slate-700">{selectedItem.category || 'Uncategorized'}</p>
                  </div>
                </div>

                {/* Risk Feed */}
                <div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Risk Engine Diagnostic</h3>
                  <div className="space-y-3">
                    {selectedItem.anomalies.map((a: any) => (
                      <div key={a.id} className="flex gap-4 bg-red-50 p-4 rounded-2xl border border-red-100">
                        <AlertTriangle className="text-red-500 shrink-0" size={20} />
                        <div>
                          <p className="font-black text-red-600 text-[10px] uppercase tracking-widest mb-1">{a.type}</p>
                          <p className="text-xs text-red-500/80 font-medium leading-relaxed">{a.description}</p>
                        </div>
                      </div>
                    ))}
                    {selectedItem.anomalies.length === 0 && (
                      <div className="flex gap-4 bg-emerald-50 p-4 rounded-2xl border border-emerald-100 italic text-emerald-600 text-xs font-medium">
                        <CheckCircle2 size={18} /> No anomalies detected by system scan.
                      </div>
                    )}
                  </div>
                </div>

                {/* Receipt Image */}
                <div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Verification Artifact (Receipt)</h3>
                  {selectedItem.receiptUrl ? (
                    <div className="relative group rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
                      <img
                        src={selectedItem.receiptUrl}
                        alt="Receipt"
                        className="w-full h-auto max-h-[600px] object-contain"
                      />
                      <button
                        onClick={() => setFullscreenReceipt(selectedItem.receiptUrl!)}
                        className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-sm"
                      >
                        <div className="bg-white/20 p-4 rounded-full text-white">
                          <Maximize2 size={32} />
                        </div>
                      </button>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-dashed border-slate-200 rounded-[2rem] p-12 text-center text-slate-400">
                      <FileText size={48} className="mx-auto mb-4 opacity-20" />
                      <p className="font-medium">No receipt image attached to this record</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[250] flex items-end md:items-center justify-center p-0 md:p-6">
            <motion.div initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }} className="bg-white w-full md:max-w-xl rounded-t-[3rem] md:rounded-[3rem] p-12 shadow-2xl border border-slate-200">
              <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Decline Transaction</h2>
              <p className="text-slate-500 text-sm font-bold mb-8 uppercase tracking-widest">Provide context for the department admin.</p>
              <textarea
                className="w-full bg-slate-50 border border-slate-200 rounded-[2rem] p-8 text-slate-900 outline-none focus:border-red-500/50 mb-8 h-48 font-bold placeholder:text-slate-300 resize-none shadow-inner"
                placeholder="Why is this item being rejected?"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="flex gap-4">
                <button onClick={() => setShowRejectModal(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 p-6 rounded-2xl font-black text-xs uppercase tracking-widest transition-all text-slate-600">Cancel</button>
                <button
                  disabled={!rejectReason.trim()}
                  onClick={() => handleReject(showRejectModal, rejectReason)}
                  className="flex-1 bg-red-600 p-6 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-600/30 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reject Item
                </button>
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
