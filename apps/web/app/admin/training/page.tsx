'use client';

import { useState, useEffect } from 'react';

interface Department {
  id: string;
  name: string;
}

interface SandboxStatus {
  isEnabled: boolean;
  sandboxSheets: Array<{ id: string; name: string; departmentName: string }>;
  transactionCount: number;
  trainedUsers: number;
  pendingGraduations: number;
}

interface TrainingProgress {
  userId: string;
  email: string;
  name: string;
  isTrainedUser: boolean;
  readyForGraduation: boolean;
}

export default function TrainingPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [status, setStatus] = useState<SandboxStatus | null>(null);
  const [progress, setProgress] = useState<TrainingProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [deptRes, statusRes, progressRes] = await Promise.all([
        fetch('http://127.0.0.1:3001/api/v1/departments', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('http://127.0.0.1:3001/api/v1/sandbox/status', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('http://127.0.0.1:3001/api/v1/sandbox/progress', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (deptRes.ok) setDepartments(await deptRes.json());
      if (statusRes.ok) setStatus(await statusRes.json());
      if (progressRes.ok) setProgress(await progressRes.json());
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }

  async function toggleSandbox(deptId: string, enable: boolean) {
    const endpoint = enable ? 'enable' : 'disable';
    await fetch(`http://127.0.0.1:3001/api/v1/sandbox/${endpoint}/${deptId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchData();
  }

  async function resetSandbox() {
    if (!confirm('Are you sure? This will delete ALL sandbox data.')) return;
    await fetch('http://127.0.0.1:3001/api/v1/sandbox/reset', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchData();
  }

  async function graduateUser(userId: string) {
    await fetch(`http://127.0.0.1:3001/api/v1/sandbox/graduate/${userId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchData();
  }

  if (loading) {
    return <div className="p-8 text-gray-600">Loading training data...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">🎓 Training & Sandbox Mode</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowTutorial(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm"
          >
            📖 Tutorial
          </button>
          <button
            onClick={resetSandbox}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-sm"
          >
            🗑️ Reset Sandbox
          </button>
        </div>
      </div>

      {/* Status Card */}
      {status && (
        <div className="bg-white/60 backdrop-blur-xl border border-gray-200 p-6 rounded-xl shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Sandbox Status</h2>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-yellow-600">{status.isEnabled ? '✅' : '❌'}</div>
              <div className="text-sm text-gray-600 mt-1">Enabled</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-purple-600">{status.transactionCount}</div>
              <div className="text-sm text-gray-600 mt-1">Sandbox Transactions</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600">{status.trainedUsers}</div>
              <div className="text-sm text-gray-600 mt-1">Trained Users</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-orange-600">{status.pendingGraduations}</div>
              <div className="text-sm text-gray-600 mt-1">Pending Graduations</div>
            </div>
          </div>
        </div>
      )}

      {/* Training Mode Toggle */}
      <div className="bg-white/60 backdrop-blur-xl border border-gray-200 p-6 rounded-xl shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Training Mode by Department</h2>
        {departments.length === 0 ? (
          <p className="text-gray-500 italic">No departments available. Create departments first.</p>
        ) : (
          <div className="space-y-3">
            {departments.map((dept) => {
              const isSandboxActive = status?.sandboxSheets.some(s => s.departmentName === dept.name);
              return (
                <div key={dept.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-gray-800 font-medium">{dept.name}</span>
                  <button
                    onClick={() => toggleSandbox(dept.id, !isSandboxActive)}
                    className={`px-4 py-2 rounded-lg font-medium ${
                      isSandboxActive 
                        ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {isSandboxActive ? '🎓 Training Active' : 'Enable Training'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* User Graduation */}
      <div className="bg-white/60 backdrop-blur-xl border border-gray-200 p-6 rounded-xl shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">User Training Progress</h2>
        {progress.length === 0 ? (
          <p className="text-gray-500 italic">No users to display.</p>
        ) : (
          <div className="space-y-2">
            {progress.map((user) => (
              <div key={user.userId} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <span className="text-gray-800 font-medium">{user.name}</span>
                  <span className="text-gray-500 text-sm ml-2">{user.email}</span>
                </div>
                {user.isTrainedUser ? (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium text-sm">✅ Trained</span>
                ) : (
                  <button
                    onClick={() => graduateUser(user.userId)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                  >
                    Graduate User
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Loom Video Embed */}
      <div className="bg-white/60 backdrop-blur-xl border border-gray-200 p-6 rounded-xl shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">📹 How To: Using the Finance System</h2>
        <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden">
          {/* Replace 'placeholder' with actual Loom video ID */}
          <iframe
            src="https://www.loom.com/embed/placeholder"
            frameBorder="0"
            allowFullScreen
            className="w-full h-full rounded-lg"
            title="Training Video"
          ></iframe>
        </div>
        <p className="text-gray-600 text-sm mt-3">
          Watch this video to learn how to enter transactions, attach receipts, and submit for approval.
        </p>
      </div>

      {/* Tutorial Modal */}
      {showTutorial && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl max-w-2xl w-full mx-4 shadow-2xl border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">📖 Training Tutorial</h2>
            
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <h3 className="font-semibold text-blue-800">Step 1: Enable Training Mode</h3>
                <p className="text-blue-700">Click "Enable Training" next to your department above. This creates a [TEST] sheet.</p>
              </div>
              
              <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                <h3 className="font-semibold text-green-800">Step 2: Enter Practice Data</h3>
                <p className="text-green-700">Open the [TEST] sheet in Google Sheets. Enter sample transactions - they won't affect real data.</p>
              </div>
              
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                <h3 className="font-semibold text-purple-800">Step 3: Practice Approvals</h3>
                <p className="text-purple-700">Go to the Approvals page. You'll see your practice transactions. Try approving/rejecting.</p>
              </div>
              
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                <h3 className="font-semibold text-orange-800">Step 4: Get Graduated</h3>
                <p className="text-orange-700">Once comfortable, ask your admin to "Graduate" you for real access.</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowTutorial(false)}
              className="mt-6 w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
