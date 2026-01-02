'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Download,
  FileText,
  ExternalLink,
  History,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Anomaly {
  id: string;
  type: string;
}

interface SearchItem {
  id: string;
  description: string;
  amount: number;
  date: string;
  category?: string;
  status?: string;
  source: 'STAGING' | 'PRODUCTION';
  departmentName?: string;
  sheetId?: string;
  sheetRowIndex?: number;
  sheetTabName?: string;
  anomalies?: Anomaly[];
}

import { apiClient } from '@/lib/apiClient';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ staging: any[], production: any[], totalSum: number }>({ staging: [], production: [], totalSum: 0 });
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) performSearch();
      else if (query.length === 0) setResults({ staging: [], production: [], totalSum: 0 });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, filterStatus, showDeleted]);

  async function performSearch() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        includeDeleted: showDeleted.toString(),
      });
      if (filterStatus !== 'ALL') params.append('status', filterStatus);

      const res = await apiClient(`/search?${params.toString()}`);
      if (res.ok) {
        setResults(await res.json());
      }
    } catch (e) {
      console.error('Search failed');
    } finally {
      setLoading(false);
    }
  }

  const exportCsv = () => {
    window.open(`http://127.0.0.1:3001/api/v1/search/export?q=${query}&status=${filterStatus}`, '_blank');
  };

  const generatePdf = () => {
    const doc = new jsPDF() as any;
    doc.setFontSize(20);
    doc.text('Global Finance Search Report', 14, 22);
    doc.setFontSize(10);
    doc.text(`Query: ${query} | Date: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Total Sum: ¥${results.totalSum.toLocaleString()}`, 14, 35);

    const tableData = allItems.map(item => [
      item.source,
      new Date(item.date).toLocaleDateString(),
      item.description,
      item.departmentName || 'Ledger',
      `¥${Number(item.amount).toLocaleString()}`,
      item.status || 'FINALIZED'
    ]);

    doc.autoTable({
      startY: 45,
      head: [['Source', 'Date', 'Description', 'Dept', 'Amount', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [124, 58, 237] }
    });

    doc.save(`finance-report-${query}.pdf`);
  };

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="bg-purple-200 text-purple-900 rounded px-0.5">{part}</mark>
          ) : part
        )}
      </span>
    );
  };

  const allItems: SearchItem[] = useMemo(() => {
    const s = results.staging.map(i => ({
      ...i,
      source: 'STAGING',
      departmentName: i.externalSheet?.department?.name,
      sheetId: i.externalSheet?.googleSheetId,
      sheetTabName: i.sheetTabName,
    }));
    const p = results.production.map(i => ({
      ...i,
      source: 'PRODUCTION',
    }));
    return [...(s as any[]), ...(p as any[])];
  }, [results]);

  return (
    <main className="min-h-screen text-slate-800 p-6 md:p-12 pb-32">
      <div className="max-w-6xl mx-auto mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-purple-600 rounded-2xl shadow-lg shadow-purple-600/30">
            <Search size={24} />
          </div>
          <h1 className="text-4xl font-black text-slate-900">
            Global Finance Search
          </h1>
        </div>

        <div className="relative group">
          <input
            type="text"
            placeholder="Search amount, description, or department..."
            className="w-full bg-white border border-slate-200 rounded-[2.5rem] px-10 py-8 text-2xl outline-none focus:border-purple-500 transition-all font-black placeholder:text-slate-300 shadow-xl"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2">
              <Loader2 className="animate-spin text-purple-500" size={28} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 mt-8">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 p-1.5 rounded-[1.5rem] shadow-sm">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${filterStatus === s ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' : 'text-slate-500 hover:text-slate-900'
                  }`}
              >
                {s}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowDeleted(!showDeleted)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${showDeleted ? 'bg-amber-500 text-black border-amber-500' : 'bg-white border-slate-200 text-slate-600'
              }`}
          >
            <History size={14} /> {showDeleted ? 'Ghost Mode Active' : 'Scan Deleted Data'}
          </button>

          <div className="flex-1" />

          <button onClick={exportCsv} className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-600/30">
            <Download size={16} /> Export Sheets
          </button>

          <button onClick={generatePdf} className="flex items-center gap-3 bg-slate-100 hover:bg-slate-200 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-200">
            <FileText size={16} /> Audit Report (PDF)
          </button>
        </div>
      </div>

      {allItems.length > 0 && (
        <div className="max-w-6xl mx-auto mb-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-gradient-to-br from-emerald-600/20 to-transparent border border-emerald-500/20 p-8 rounded-[2.5rem] backdrop-blur-3xl">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-2">Search Value Sum</p>
            <p className="text-4xl font-black tracking-tighter text-emerald-100">¥{results.totalSum.toLocaleString()}</p>
          </motion.div>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }} className="bg-slate-900/40 border border-white/5 p-8 rounded-[2.5rem] backdrop-blur-3xl">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Records Found</p>
            <p className="text-4xl font-black">{allItems.length}</p>
          </motion.div>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }} className="bg-gradient-to-br from-purple-600/10 to-transparent border border-purple-500/20 p-8 rounded-[2.5rem] backdrop-blur-3xl">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500 mb-2">Active Indices</p>
            <p className="text-4xl font-black text-purple-100 italic">Indexed Scan</p>
          </motion.div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        <AnimatePresence>
          {allItems.map((item, idx) => (
            <motion.div
              key={`${item.source}-${item.id}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.03 }}
              className={`bg-white border border-slate-200 p-10 rounded-[3rem] hover:bg-slate-50 transition-all group relative overflow-hidden shadow-lg ${item.status === 'REJECTED' ? 'border-red-300' : ''}`}
            >
              <div className="absolute top-0 right-0 p-6 flex items-center gap-3">
                {item.status === 'REJECTED' && <span className="bg-red-500 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Rejected</span>}
                <span className={`text-[8px] font-black px-4 py-1.5 rounded-full border tracking-[0.2em] ${item.source === 'PRODUCTION' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                  }`}>
                  {item.source}
                </span>
              </div>

              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-10">
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-400 mb-3 block">
                    {new Date(item.date).toLocaleDateString('ja-JP')} • {item.departmentName || 'Master Ledger Account'}
                  </p>
                  <h3 className="text-3xl font-black leading-tight mb-4 tracking-tight text-slate-900 group-hover:text-purple-600 transition-colors">
                    {highlightText(item.description || 'Auto-description empty', query)}
                  </h3>
                  <div className="flex flex-wrap gap-2 text-slate-500">
                    <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl text-slate-600">
                      <TrendingUp size={12} /> {item.category || 'General Ledger'}
                    </span>
                    {item.anomalies?.map(a => (
                      <span key={a.id} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-500 border border-red-500/10 px-3 py-1.5 rounded-xl">
                        <AlertCircle size={12} /> Alert: {a.type}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-4xl font-black tracking-tighter mb-4 group-hover:scale-110 transition-transform origin-right">
                    ¥{highlightText(Number(item.amount).toLocaleString(), query)}
                  </p>
                  <div className="flex justify-end gap-3 translate-y-2 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                    {item.sheetId && (
                      <a
                        href={`https://docs.google.com/spreadsheets/d/${item.sheetId}/edit#gid=0&range=A${item.sheetRowIndex}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-4 bg-white/5 text-slate-400 rounded-2xl hover:bg-white/10 hover:text-white transition-all flex items-center gap-3 text-[10px] font-black uppercase tracking-widest border border-white/5"
                      >
                        <ExternalLink size={16} /> View in Sheet
                      </a>
                    )}
                    <button className="p-4 bg-purple-600/10 text-purple-400 rounded-2xl hover:bg-purple-600 hover:text-white transition-all border border-purple-500/20">
                      <ArrowRight size={24} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </main>
  );
}
