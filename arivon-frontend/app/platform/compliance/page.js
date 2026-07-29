"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, Clock } from "lucide-react";
import { isPlatformLoggedIn, platformApiRequest, clearPlatformToken } from "../../../lib/platformApi";

const STATUS_STYLES = {
  valid: "bg-brand-100 text-brand-700",
  expiring_soon: "bg-amber-100 text-amber-700",
  expired: "bg-red-100 text-red-700",
};

export default function CompliancePage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);

  useEffect(() => {
    if (!isPlatformLoggedIn()) {
      router.push("/platform/login");
      return;
    }
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await platformApiRequest("/platform/compliance/dashboard");
      setDashboard(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunReminders() {
    setRunning(true);
    setError("");
    try {
      const result = await platformApiRequest("/platform/compliance/reminders/run", { method: "POST" });
      setRunResult(result);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  function handleLogout() {
    clearPlatformToken();
    router.push("/platform/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-navy-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-display font-bold text-white">Arivon Platform</span>
          <nav className="flex items-center gap-4">
            <button onClick={() => router.push("/platform/dashboard")} className="text-sm text-slate-300 hover:text-white">Overview</button>
            <button onClick={() => router.push("/platform/schools")} className="text-sm text-slate-300 hover:text-white">Schools</button>
            <button onClick={() => router.push("/platform/verification")} className="text-sm text-slate-300 hover:text-white">Verification</button>
            <button className="text-sm text-white font-medium">Compliance</button>
          </nav>
        </div>
        <button onClick={handleLogout} className="text-sm text-slate-300 hover:text-white">Log out</button>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">Compliance Dashboard</h2>
            <p className="text-sm text-slate-600">Every school's compliance documents, soonest-expiring first.</p>
          </div>
          <button
            onClick={handleRunReminders}
            disabled={running}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2 flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={running ? "animate-spin" : ""} /> Run Reminder Engine
          </button>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}
        {runResult && (
          <p className="text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2 mb-4">
            {runResult.reminders_sent} reminder(s) sent.
          </p>
        )}

        {loading ? (
          <p className="text-sm text-slate-600">Loading...</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-medium text-slate-500 mb-1">Total Expiring (60 days)</p>
                <p className="text-3xl font-bold text-slate-900">{dashboard.total_expiring}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-medium text-slate-500 mb-1">Expiring Soon</p>
                <p className="text-3xl font-bold text-amber-600">{dashboard.expiring_soon_count}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs font-medium text-slate-500 mb-1">Expired</p>
                <p className="text-3xl font-bold text-red-600">{dashboard.expired_count}</p>
              </div>
            </div>

            {dashboard.items.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                <AlertTriangle size={26} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-600">No documents expiring in the next 60 days.</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {dashboard.items.map((item, i) => (
                  <div key={item.document_id} className={`flex items-center justify-between px-5 py-3 ${i !== dashboard.items.length - 1 ? "border-b border-slate-100" : ""}`}>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.school_name}</p>
                      <p className="text-xs text-slate-500 capitalize">{item.document_type.replace(/_/g, " ")} · expires {item.expiry_date}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock size={12} /> {item.days_remaining >= 0 ? `${item.days_remaining}d left` : `${Math.abs(item.days_remaining)}d overdue`}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[item.computed_status]}`}>
                        {item.computed_status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
