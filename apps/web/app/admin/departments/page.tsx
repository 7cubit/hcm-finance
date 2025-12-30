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
  Clock
} from 'lucide-react';

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
      const res = await fetch('http://127.0.0.1:3001/api/v1/unlock-requests/pending', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setRequests(await res.json());
    } catch (e) { 
      // Silently fail - API may not be available
    }
  }

  async function fetchDepartments() {
    try {
      const res = await fetch('http://127.0.0.1:3001/api/v1/departments', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
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
    try {
      const res = await fetch('http://127.0.0.1:3001/api/v1/departments', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newDept)
      });
      if (res.ok) {
        setShowCreateModal(false);
        fetchDepartments();
      }
    } catch (error) {
      console.error('Failed to create department:', error);
    }
  }

  async function handleRegenerate(id: string) {
    if (!confirm('Are you sure? This will create a fresh Google Sheet for this year.')) return;
    try {
      const res = await fetch(`http://127.0.0.1:3001/api/v1/departments/${id}/regenerate-sheet`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) fetchDepartments();
    } catch (error) {
      console.error('Failed to regenerate sheet:', error);
    }
  }

  async function handleApproveRequest(id: string) {
    try {
      const res = await fetch(`http://127.0.0.1:3001/api/v1/unlock-requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
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
          <h1 className="text-3xl font-bold text-slate-900">
            Departments
          </h1>
          <p className="text-slate-400">Manage church departments, budgets, and sync status.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <button 
              onClick={() => setShowRequests(!showRequests)}
              className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:text-slate-700 rounded-xl transition-all relative"
            >
              <Bell size={20} />
              {requests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
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
                        <span className="text-[10px] font-bold text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded uppercase">
                          {req.month}
                        </span>
                        <span className="text-[10px] text-slate-500">{new Date(req.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs font-semibold mb-1">{req.department.name}</p>
                      <p className="text-[10px] text-slate-400 mb-3 italic">"{req.reason}"</p>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleApproveRequest(req.id)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold py-2 rounded-lg transition-all"
                        >
                          Grant 24 Hours
                        </button>
                        <button className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg transition-all">
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
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-purple-500/20"
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
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Departments List */}
          <div className="space-y-6">
            {departments.map((dept) => (
              <div 
                key={dept.id}
                onClick={() => setSelectedDept(dept)}
                className={`group relative bg-white border ${selectedDept?.id === dept.id ? 'border-purple-500/50 shadow-purple-500/5' : 'border-slate-200'} rounded-2xl p-6 cursor-pointer hover:border-slate-300 transition-all shadow-lg`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                      <Building2 size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-purple-600 transition-colors">{dept.name}</h3>
                      <p className="text-slate-500 text-sm flex items-center gap-1">
                        <Mail size={12} /> {dept.headEmail}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {dept.externalSheets?.[0]?.syncLogs?.[0]?.status === 'SUCCESS' ? (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400 bg-green-400/10 px-2.5 py-1 rounded-full border border-green-400/20">
                        <Circle size={8} fill="currentColor" />
                        Healthy
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
                        <Circle size={8} fill="currentColor" />
                        Unknown
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 border-t border-slate-200 pt-4 mt-2">
                  <div>
                    <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Budget</p>
                    <p className="text-slate-900 font-mono">¥{dept.budgetLimit.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Last Sync</p>
                    <p className="text-slate-300 text-sm">
                      {dept.externalSheets?.[0]?.syncLogs?.[0]?.startedAt 
                        ? new Date(dept.externalSheets[0].syncLogs[0].startedAt).toLocaleDateString()
                        : 'Never'
                      }
                    </p>
                  </div>
                  <div className="flex justify-end items-center">
                    <a 
                      href={dept.externalSheets?.[0]?.driveUrl}
                      target="_blank"
                      className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={20} />
                    </a>
                  </div>
                </div>
              </div>
            ))}
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
                            const res = await fetch(`http://127.0.0.1:3001/api/v1/google-workspace/locks/${sheetId}/${action}/${fullName}`, {
                              method: 'POST',
                              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                            });
                            if (res.ok) fetchDepartments();
                          } catch (e) { console.error(e); }
                        }}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                          isLocked 
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
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <History size={16} />
                  Sync History
                </h3>
                <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                  {selectedDept.externalSheets?.[0]?.syncLogs?.map((log) => (
                    <div key={log.id} className="flex items-center gap-4 p-3 border-b border-slate-800 text-xs last:border-0">
                      <div className={`w-1.5 h-1.5 rounded-full ${log.status === 'SUCCESS' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-slate-400 font-mono">{new Date(log.startedAt).toLocaleTimeString()}</span>
                      <span className="flex-1 truncate text-slate-500">{log.message || 'Sync completed successfully'}</span>
                    </div>
                  ))}
                  {!selectedDept.externalSheets?.[0]?.syncLogs?.length && (
                    <div className="p-4 text-center text-slate-600 text-xs">No logs available</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-20 text-slate-600 h-full">
              <Building2 size={48} className="mb-4 opacity-20" />
              <p>Select a department to manage settings and access</p>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-bold mb-6">Setup New Department</h2>
            
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Department Name</label>
                <input 
                  type="text"
                  placeholder="e.g. Media Team"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-purple-500 transition-colors"
                  onChange={(e) => setNewDept({...newDept, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Monthly Budget (¥)</label>
                <input 
                  type="number"
                  placeholder="50000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-purple-500 transition-colors"
                  onChange={(e) => setNewDept({...newDept, budgetLimit: parseFloat(e.target.value)})}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Head of Department Email</label>
                <input 
                  type="email"
                  placeholder="head@hcmj.org"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-purple-500 transition-colors"
                  onChange={(e) => setNewDept({...newDept, headEmail: e.target.value})}
                />
              </div>
            </div>

            <div className="flex gap-4 mt-10">
              <button 
                onClick={() => setShowCreateModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreate}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-purple-500/20"
              >
                Create Hub
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
