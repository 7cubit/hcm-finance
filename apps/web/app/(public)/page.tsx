'use client';

import { useState, useEffect } from 'react';

interface ApiResponse {
  message: string;
  version: string;
  timestamp: string;
}

export default function HomePage() {
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchApi() {
      try {
        const res = await fetch('http://127.0.0.1:3001/api/v1');
        if (!res.ok) throw new Error('API request failed');
        const data = await res.json();
        setApiData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect to API');
      } finally {
        setLoading(false);
      }
    }
    fetchApi();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center p-8">
      <div className="glass-panel p-8 rounded-2xl max-w-lg w-full text-center">
        <h1 className="text-4xl font-bold text-white mb-4">
          HCMJ Finance
        </h1>
        <p className="text-slate-300 mb-8">
          Church Finance Management System
        </p>

        <div className="bg-slate-800/50 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">API Status</h2>
          {loading && <p className="text-slate-400">Connecting to API...</p>}
          {error && (
            <p className="text-red-400">⚠️ {error}</p>
          )}
          {apiData && (
            <div className="text-left space-y-2">
              <p className="text-green-400">✓ Connected</p>
              <p className="text-slate-300">
                <span className="text-slate-500">Message:</span> {apiData.message}
              </p>
              <p className="text-slate-300">
                <span className="text-slate-500">API Version:</span> {apiData.version}
              </p>
            </div>
          )}
        </div>

        <a
          href="/admin"
          className="inline-block bg-purple-600 hover:bg-purple-500 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
        >
          Go to Admin Dashboard →
        </a>
      </div>
    </main>
  );
}
