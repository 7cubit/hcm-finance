'use client';

import { useState, useEffect } from 'react';
import {
  Building2,
  ExternalLink,
  Plus,
  Users,
  History,
  RefreshCcw,
  Shield,
  Mail,
  Circle,
  TrendingUp,
  Settings2,
  Trash2,
  Lock,
  Unlock,
  Bell,
  Clock,
  AlertCircle,
  CheckCircle2,
  Settings,
  LayoutGrid
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SyncLog {
  id: string;
  status: 'SUCCESS' | 'FAILURE' | 'RUNNING';
  startedAt: string;
  message?: string;
}

interface SheetUser {
  id: string;
  email: string;
  role: 'EDITOR' | 'VIEWER';
}

interface ExternalSheet {
  id: string;
  googleSheetId: string;
  driveUrl: string;
  isActive: boolean;
  lockedMonths: string[];
  users: SheetUser[];
  syncLogs: SyncLog[];
}

interface Department {
  id: string;
  name: string;
  budgetLimit: number;
  spent: number; // Added for progress bar
  headEmail: string;
  externalSheets: ExternalSheet[];
  updatedAt: string;
}

interface UnlockRequest {
  id: string;
  month: string;
  year: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedByEmail: string;
  department: { name: string };
  createdAt: string;
}

import { apiClient } from '@/lib/apiClient';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [requests, setRequests] = useState<UnlockRequest[]>([]);
  const [showRequests, setShowRequests] = useState(false);

  // Form states for new department
  const [newDept, setNewDept] = useState({ name: '', budgetLimit: 0, headEmail: '' });

  useEffect(() => {
    fetchDepartments();
    fetchRequests();
  }, []);

  async function fetchRequests() {
    try {
      const res = await apiClient('/unlock-requests/pending');
      if (res.ok) setRequests(await res.json());
    } catch (e) {
      // Silently fail - API may not be available
    }
  }

  async function fetchDepartments() {
    try {
      const res = await apiClient('/departments');
      if (res.ok) {
        const data = await res.json();
        setDepartments(data);
      }
    } catch (error) {
      // Silently fail - API may not be available
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newDept.name || !newDept.headEmail || newDept.budgetLimit <= 0) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticDept: Department = {
      id: tempId,
      name: newDept.name,
      budgetLimit: newDept.budgetLimit,
      spent: 0,
      headEmail: newDept.headEmail,
      externalSheets: [],
      updatedAt: new Date().toISOString()
    };

    setDepartments([optimisticDept, ...departments]);
    setShowCreateModal(false);

    try {
      const res = await apiClient('/departments', {
        method: 'POST',
        body: JSON.stringify(newDept)
      });

      if (res.ok) {
        // Replace temp with real data
        const saved = await res.json();
        setDepartments(prev => prev.map(d => d.id === tempId ? { ...saved.department, spent: 0 } : d));
      } else {
        throw new Error('Failed to create department');
      }
    } catch (error) {
      console.error('Failed to create department:', error);
      // Mark as error for retry
      setDepartments(prev => prev.map(d => d.id === tempId ? { ...optimisticDept, id: `error-${Date.now()}` } : d));
    }
  }

  async function handleRegenerate(id: string) {
    if (!confirm('Are you sure? This will create a fresh Google Sheet for this year.')) return;
    try {
      const res = await apiClient(`/departments/${id}/regenerate-sheet`, {
        method: 'POST',
      });
      if (res.ok) fetchDepartments();
    } catch (error) {
      console.error('Failed to regenerate sheet:', error);
    }
  }

  async function handleApproveRequest(id: string) {
    try {
      const res = await apiClient(`/unlock-requests/${id}/approve`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchRequests();
        fetchDepartments();
      }
    } catch (e) { console.error(e); }
  }

  return (
    <main className="min-h-screen text-slate-800 p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Departments
          </h1>
          <p className="text-slate-400 font-medium">Manage church hubs, budgets, and Google Sheets factory.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setShowRequests(!showRequests)}
              className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:text-purple-600 hover:border-purple-200 rounded-xl transition-all relative group"
            >
              <Bell size={20} />
              {requests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse border-2 border-white">
                  {requests.length}
                </span>
              )}
            </button>

            {showRequests && (
              <div className="absolute right-0 mt-4 w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 z-40 animate-in slide-in-from-top-2 duration-200">
                <h3 className="text-sm font-bold mb-4 px-2 flex items-center justify-between">
                  <span>Unlock Requests</span>
                  <span className="text-[10px] text-slate-500">{requests.length} Pending</span>
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {requests.map(req => (
                    <div key={req.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded uppercase">
                          {req.month}
                        </span>
                        <span className="text-[10px] text-slate-400">{new Date(req.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 mb-1">{req.department.name}</p>
                      <p className="text-[10px] text-slate-500 mb-3 italic">"{req.reason}"</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApproveRequest(req.id)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold py-2 rounded-lg transition-all shadow-md shadow-emerald-500/10"
                        >
                          Grant 24 Hours
                        </button>
                        <button className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-400 rounded-lg transition-all">
                          &times;
                        </button>
                      </div>
                    </div>
                  ))}
                  {requests.length === 0 && <p className="text-center py-8 text-slate-600 text-xs">No pending requests</p>}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-purple-500/20 active:scale-95"
          >
            <Plus size={20} />
            New Department
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <RefreshCcw className="animate-spin text-purple-500" size={40} />
        </div>
      ) : departments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 bg-white/50 border-2 border-dashed border-slate-200 rounded-3xl text-center">
          <div className="w-24 h-24 bg-purple-100 rounded-full flex items-center justify-center mb-6">
            <LayoutGrid className="text-purple-400" size={48} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Departments yet</h3>
          <p className="text-slate-500 max-w-sm mb-8">
            Click the "+" button to start building your financial hubs and automate your Google Sheets factory.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-bold transition-all"
          >
            <Plus size={20} />
            Add First Department
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Departments List */}
          <div className="space-y-6">
            <AnimatePresence mode="popLayout">
              {departments.map((dept) => {
                const isSyncing = dept.externalSheets?.[0]?.syncLogs?.[0]?.status === 'RUNNING';
                const isNew = dept.id.startsWith('temp-');
                const hasError = dept.id.startsWith('error-');
                const lastSync = dept.externalSheets?.[0]?.syncLogs?.[0];
                const spent = dept.spent || 0;
                const percent = Math.min(100, (spent / dept.budgetLimit) * 100);

                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={dept.id}
                    onClick={() => !isNew && setSelectedDept(dept)}
                    className={`group relative bg-white border ${selectedDept?.id === dept.id
                      ? 'border-purple-500 ring-4 ring-purple-500/5'
                      : 'border-slate-200'
                      } ${isNew || hasError ? 'opacity-80 cursor-wait' : 'cursor-pointer'} rounded-2xl p-6 hover:shadow-xl hover:border-slate-300 transition-all`}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${hasError ? 'bg-red-100 text-red-500' : 'bg-purple-100 text-purple-600'
                          }`}>
                          {isNew ? <RefreshCcw className="animate-spin" size={24} /> : <Building2 size={24} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                              {dept.name}
                            </h3>
                            {isNew && <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase">Generating...</span>}
                            {hasError && <span className="text-[10px] font-bold bg-red-100 text-red-500 px-2 py-0.5 rounded uppercase">Factory Error</span>}
                          </div>
                          <p className="text-slate-500 text-sm flex items-center gap-1">
                            <Mail size={12} className="opacity-40" /> {dept.headEmail}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isNew ? null : hasError ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCreate(); }}
                            className="flex items-center gap-1.5 text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-full border border-red-200 transition-colors"
                          >
                            <RefreshCcw size={12} />
                            Retry
                          </button>
                        ) : isSyncing ? (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-blue-500 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                              <RefreshCcw size={12} />
                            </motion.div>
                            Syncing
                          </span>
                        ) : lastSync?.status === 'SUCCESS' ? (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                            <CheckCircle2 size={12} />
                            Synced
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                            <Clock size={12} />
                            {lastSync?.startedAt ? new Date(lastSync.startedAt).toLocaleDateString() : 'Pending'}
                          </span>
                        )}

                        {!isNew && !hasError && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedDept(dept); }}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                          >
                            <Settings size={18} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar (Spent vs Budget) */}
                    <div className="mb-6">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Budget Utilization</span>
                        <div className="text-right">
                          <span className="text-sm font-bold text-slate-900 font-mono">¥{spent.toLocaleString()}</span>
                          <span className="text-xs text-slate-400 font-mono"> / ¥{dept.budgetLimit.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className={`h-full rounded-full ${percent > 90 ? 'bg-red-500' : percent > 75 ? 'bg-orange-500' : 'bg-purple-500'
                            }`}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                      <div className="flex gap-4">
                        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                          <History size={12} />
                          {lastSync ? `Updated ${new Date(lastSync.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not Synced'}
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                          <Users size={12} />
                          {dept.externalSheets?.[0]?.users?.length || 0} Members
                        </div>
                      </div>

                      {!isNew && !hasError && dept.externalSheets?.[0]?.driveUrl && (
                        <a
                          href={dept.externalSheets[0].driveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 px-4 py-2 rounded-xl transition-all border border-purple-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <LayoutGrid size={14} />
                          Sheets
                          <ExternalLink size={12} className="opacity-50" />
                        </a>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Department Detail / Editor */}
          {selectedDept ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 sticky top-8 h-fit">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-bold flex items-center gap-3">
                  <Settings2 className="text-purple-400" />
                  {selectedDept.name}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRegenerate(selectedDept.id)}
                    className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-all"
                    title="Regenerate Sheet"
                  >
                    <RefreshCcw size={20} />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                  <p className="text-slate-500 text-xs mb-1">Monthly Budget</p>
                  <input
                    type="number"
                    value={selectedDept.budgetLimit}
                    className="bg-transparent text-xl font-bold text-white w-full outline-none focus:text-purple-400 transition-colors"
                  />
                </div>
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                  <p className="text-slate-500 text-xs mb-1">YTD Spend</p>
                  <p className="text-xl font-bold text-slate-300">¥0</p>
                </div>
              </div>

              {/* Sheet Access Section */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Shield size={16} />
                  Sheet Access
                </h3>
                <div className="space-y-3">
                  {selectedDept.externalSheets?.[0]?.users?.map((user) => (
                    <div key={user.id} className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] uppercase">
                          {user.email[0]}
                        </div>
                        <span className="text-sm">{user.email}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${user.role === 'EDITOR' ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-500/20 text-slate-400'}`}>
                        {user.role}
                      </span>
                    </div>
                  ))}
                  <button className="w-full border border-dashed border-slate-700 hover:border-purple-500/50 hover:bg-purple-500/5 p-3 rounded-xl text-xs text-slate-500 hover:text-purple-400 transition-all flex items-center justify-center gap-2 mt-2">
                    <Plus size={14} />
                    Invite User
                  </button>
                </div>
              </div>

              {/* Period Closing (Month Locks) */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Lock size={16} />
                  Period Closing (Month Locks)
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((month) => {
                    const monthMap: any = {
                      Jan: "January", Feb: "February", Mar: "March", Apr: "April",
                      May: "May", Jun: "June", Jul: "July", Aug: "August",
                      Sep: "September", Oct: "October", Nov: "November", Dec: "December"
                    };
                    const fullName = monthMap[month];
                    const isLocked = selectedDept.externalSheets?.[0]?.lockedMonths?.includes(fullName);
                    const isCurrentMonth = fullName === new Date().toLocaleString('en-US', { month: 'long' });

                    return (
                      <button
                        key={month}
                        disabled={isCurrentMonth && !isLocked}
                        title={isCurrentMonth ? "Current month cannot be locked" : ""}
                        onClick={async () => {
                          const action = isLocked ? 'unlock' : 'lock';
                          const sheetId = selectedDept.externalSheets?.[0]?.id;
                          if (!sheetId) return;

                          try {
                            const res = await apiClient(`/google-workspace/locks/${sheetId}/${action}/${fullName}`, {
                              method: 'POST',
                            });
                            if (res.ok) fetchDepartments();
                          } catch (e) { console.error(e); }
                        }}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${isLocked
                          ? 'bg-red-500/10 border-red-500/30 text-red-500'
                          : isCurrentMonth
                            ? 'bg-slate-900 border-slate-900 text-slate-700 cursor-not-allowed opacity-50'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-purple-500/50 hover:text-purple-400'
                          }`}
                      >
                        <span className="text-[10px] font-bold mb-1">{month}</span>
                        {isLocked ? <Lock size={12} /> : <Unlock size={12} className="opacity-30" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Audit Logs / Sync History */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <History size={14} className="text-blue-400" />
                  Sync Log
                </h3>
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                  {selectedDept.externalSheets?.[0]?.syncLogs?.map((log) => (
                    <div key={log.id} className="flex items-center gap-4 p-4 text-xs">
                      <div className={`w-2 h-2 rounded-full ${log.status === 'SUCCESS' ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-red-500'}`} />
                      <span className="text-slate-400 font-mono font-bold tracking-tight">
                        {new Date(log.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="flex-1 truncate text-slate-600 font-medium">{log.message || 'Sync completed successfully'}</span>
                    </div>
                  ))}
                  {!selectedDept.externalSheets?.[0]?.syncLogs?.length && (
                    <div className="p-8 text-center text-slate-400 text-xs italic">No sync activity recorded</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center bg-white/50 border-2 border-dashed border-slate-200 rounded-3xl p-20 text-slate-400 h-full">
              <Building2 size={64} className="mb-6 opacity-10" />
              <p className="font-medium">Select a department hub to manage configurations</p>
            </div>
          )}
        </div>
      )}

      {/* Create Modal (Shadcn-like Framer Motion) */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white border border-slate-200 rounded-3xl p-10 max-w-lg w-full shadow-2xl relative z-10"
            >
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Setup New Department</h2>
                <p className="text-slate-500 font-medium">This will initialize a new Google Sheet from the factory template.</p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Department Name</label>
                  <div className="relative group">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-purple-500 transition-colors" size={20} />
                    <input
                      type="text"
                      placeholder="e.g. Media & Communications"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/5 transition-all text-slate-900 font-medium"
                      onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Budget (¥)</label>
                    <div className="relative group">
                      <TrendingUp className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-purple-500 transition-colors" size={20} />
                      <input
                        type="number"
                        placeholder="50000"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/5 transition-all text-slate-900 font-mono font-bold"
                        onChange={(e) => setNewDept({ ...newDept, budgetLimit: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Admin Email</label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-purple-500 transition-colors" size={20} />
                      <input
                        type="email"
                        placeholder="head@hcmj.org"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/5 transition-all text-slate-900 font-medium"
                        onChange={(e) => setNewDept({ ...newDept, headEmail: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-12">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition-all"
                >
                  Discard
                </button>
                <button
                  onClick={handleCreate}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-purple-500/20 active:scale-95"
                >
                  Build Department Hub
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
