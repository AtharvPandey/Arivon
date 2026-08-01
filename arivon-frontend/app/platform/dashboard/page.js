"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Plus, LogOut, Building2, Users, GraduationCap, RotateCcw } from "lucide-react";
import { platformApiRequest, isPlatformLoggedIn, clearPlatformToken } from "../../../lib/platformApi";
import CredentialsCard from "../../../components/CredentialsCard";

const STATUS_STYLES = {
  trial: "bg-amber-100 text-amber-700",
  active: "bg-green-100 text-green-700",
  suspended: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
};

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

export default function PlatformDashboardPage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState(null);
  const [schools, setSchools] = useState([]);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [resettingSchoolId, setResettingSchoolId] = useState(null);
  const [credentialResult, setCredentialResult] = useState(null);

  useEffect(() => {
    if (!isPlatformLoggedIn()) {
      router.push("/platform/login");
      return;
    }
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [a, s, l] = await Promise.all([
        platformApiRequest("/platform/analytics"),
        platformApiRequest("/platform/schools"),
        platformApiRequest("/platform/logs"),
      ]);
      setAnalytics(a);
      setSchools(s);
      setLogs(l);
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleSubscription(school) {
    setError("");
    try {
      const newStatus = school.subscription_status === "suspended" ? "active" : "suspended";
      await platformApiRequest(`/platform/schools/${school.id}/subscription`, {
        method: "PATCH",
        body: { subscription_status: newStatus },
      });
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleResetAdminPassword(school) {
    if (!confirm(`Reset the School Admin password for ${school.name}? Their current password will stop working immediately.`)) return;
    setResettingSchoolId(school.id);
    setError(""); setCredentialResult(null);
    try {
      const result = await platformApiRequest(`/platform/schools/${school.id}/reset-admin-password`, { method: "POST" });
      setCredentialResult({
        fullName: result.user.full_name,
        email: result.user.email,
        temporaryPassword: result.temporary_password,
        tempPasswordExpiresAt: result.temp_password_expires_at,
        loginUrl: `${window.location.origin}${result.login_url_path}`,
        title: `${school.name} — School Admin password reset`,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setResettingSchoolId(null);
    }
  }

  function handleLogout() {
    clearPlatformToken();
    router.push("/platform/login");
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-navy-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-brand-400" />
            <span className="font-display font-bold text-white">Arivon Platform</span>
          </div>
          <nav className="flex items-center gap-4">
            <button className="text-sm text-white font-medium">Overview</button>
            <button onClick={() => router.push("/platform/schools")} className="text-sm text-slate-300 hover:text-white">Schools</button>
            <button onClick={() => router.push("/platform/verification")} className="text-sm text-slate-300 hover:text-white">Verification</button>
            <button onClick={() => router.push("/platform/compliance")} className="text-sm text-slate-300 hover:text-white">Compliance</button>
          </nav>
        </div>
        <button onClick={handleLogout} className="text-sm text-slate-300 hover:text-white flex items-center gap-1.5">
          <LogOut size={14} /> Log out
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">Schools</h2>
            <p className="text-sm text-slate-600">Every school on Arivon, platform-wide.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/platform/register-school")}
              className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg px-4 py-2 flex items-center gap-1.5"
            >
              <Plus size={16} /> Register School
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

        {credentialResult && (
          <CredentialsCard result={credentialResult} title={credentialResult.title} onDismiss={() => setCredentialResult(null)} />
        )}

        {analytics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard icon={Building2} label="Total Schools" value={analytics.total_schools} />
            <StatCard icon={Building2} label="Active" value={analytics.active_schools} />
            <StatCard icon={GraduationCap} label="Students Platform-wide" value={analytics.total_students_platform_wide} />
            <StatCard icon={Users} label="Staff Platform-wide" value={analytics.total_staff_platform_wide} />
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left">
                <th className="px-4 py-3 font-medium text-slate-600">School</th>
                <th className="px-4 py-3 font-medium text-slate-600">Board</th>
                <th className="px-4 py-3 font-medium text-slate-600">Plan</th>
                <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 font-medium text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                  <td className="px-4 py-3 text-slate-600">{s.board_type}</td>
                  <td className="px-4 py-3 text-slate-600 capitalize">{s.subscription_plan}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[s.subscription_status]}`}>
                      {s.subscription_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleResetAdminPassword(s)}
                        disabled={resettingSchoolId === s.id}
                        title="Reset School Admin password"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                      >
                        <RotateCcw size={13} />
                      </button>
                      <button
                        onClick={() => toggleSubscription(s)}
                        className="text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1 hover:bg-slate-50"
                      >
                        {s.subscription_status === "suspended" ? "Reactivate" : "Suspend"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {schools.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">No schools yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Recent Platform Activity (Audit Log)</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {logs.map((l) => (
              <div key={l.id} className="text-xs text-slate-600 border-b border-slate-100 last:border-0 pb-2">
                <span className="font-medium text-slate-800 capitalize">{l.action.replace(/_/g, " ")}</span>
                {l.details && <span> — {l.details}</span>}
                <span className="text-slate-400 ml-2">{new Date(l.created_at).toLocaleString()}</span>
              </div>
            ))}
            {logs.length === 0 && <p className="text-xs text-slate-500">No activity yet.</p>}
          </div>
        </div>
      </div>
    </main>
  );
}
