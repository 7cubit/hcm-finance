'use client';

import { useState, useEffect } from 'react';

interface SandboxStatus {
  isEnabled: boolean;
  sandboxSheets: Array<{ id: string; name: string; departmentName: string }>;
  transactionCount: number;
  trainedUsers: number;
  pendingGraduations: number;
}

export default function SandboxBanner() {
  const [status, setStatus] = useState<SandboxStatus | null>(null);

  useEffect(() => {
    async function checkSandboxStatus() {
      try {
        const res = await fetch('http://127.0.0.1:3001/api/v1/sandbox/status', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        }
      } catch {
        // Silently fail
      }
    }

    checkSandboxStatus();
  }, []);

  if (!status?.isEnabled) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-400 text-yellow-900 px-4 py-2 text-center font-semibold shadow-lg">
      <div className="flex items-center justify-center gap-2">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>🎓 You are in Simulation Mode - {status.transactionCount} sandbox transactions</span>
        <button 
          onClick={() => window.location.href = '/admin/training'}
          className="ml-4 bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700"
        >
          View Training
        </button>
      </div>
    </div>
  );
}
