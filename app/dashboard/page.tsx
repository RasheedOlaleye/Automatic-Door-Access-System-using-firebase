"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { ref, query, limitToLast, onValue } from "firebase/database";
import { auth, rtdb } from "@/lib/firebase";
import { LogOut, Wifi, Loader2, ShieldCheck, ShieldX } from "lucide-react";

interface LogEntry {
  cardUID: string;
  owner: string;
  granted: boolean;
  reason: string;
  timestamp: number;
  deviceId: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  useEffect(() => {
    const logsRef = query(ref(rtdb, "access_logs"), limitToLast(100));

    const unsubscribe = onValue(logsRef, (snapshot) => {
      const data = snapshot.val() || {};
      const flattened: LogEntry[] = [];

      Object.entries(data).forEach(([deviceId, entries]: [string, any]) => {
        Object.values(entries || {}).forEach((entry: any) => {
          flattened.push({ ...entry, deviceId });
        });
      });

      flattened.sort((a, b) => b.timestamp - a.timestamp);
      setLogs(flattened);
      setLoadingLogs(false);
    });

    return () => unsubscribe();
  }, []);

  async function handleLogout() {
    await signOut(auth);
    router.push("/auth");
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-100 tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/setup")}
            className="flex items-center gap-1.5 min-h-9 px-3 border border-slate-800 rounded-lg text-xs text-slate-300"
          >
            <Wifi size={14} />
            Change Wi-Fi
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 min-h-9 px-3 border border-slate-800 rounded-lg text-xs text-slate-300"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
            Access logs
          </span>
          {loadingLogs && <Loader2 size={14} className="animate-spin text-slate-600" />}
        </div>

        {!loadingLogs && logs.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-10">
            No access attempts yet. Logs will appear here in real time.
          </p>
        )}

        <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-800">
          {logs.map((log, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                {log.granted ? (
                  <ShieldCheck size={18} className="text-emerald-400 shrink-0" />
                ) : (
                  <ShieldX size={18} className="text-rose-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm text-slate-200 truncate">{log.owner}</p>
                  <p className="text-xs font-mono text-slate-600 truncate">
                    {log.cardUID} · {log.reason}
                  </p>
                </div>
              </div>
              <span className="text-xs text-slate-500 shrink-0 ml-3">
                {new Date(log.timestamp).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}