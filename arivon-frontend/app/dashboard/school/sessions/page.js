"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, CalendarRange, ChevronRight, Lock, Check } from "lucide-react";
import { apiRequest, isLoggedIn } from "../../../../lib/api";

const MANAGE_ROLES = ["school_admin", "administrator", "super_admin"];

function monthsBetween(startStr, endStr) {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return Math.max(1, months);
}

export default function AcademicSessionsPage() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState(null);
  const [role, setRole] = useState(null);
  const [years, setYears] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [label, setLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [markCurrent, setMarkCurrent] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    (async () => {
      try {
        const me = await apiRequest("/auth/me");
        setSchoolId(me.school_id);
        setRole(me.role_name);
        await load(me.school_id);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function load(id) {
    const data = await apiRequest(`/academic-years/?school_id=${id}`);
    setYears(data);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiRequest("/academic-years/", {
        method: "POST",
        body: { school_id: schoolId, label, start_date: startDate, end_date: endDate, is_current: markCurrent },
      });
      setLabel(""); setStartDate(""); setEndDate(""); setMarkCurrent(false);
      setShowForm(false);
      await load(schoolId);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const canManage = MANAGE_ROLES.includes(role);
  const currentSession = years.find((y) => y.is_current);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-2">
        <h2 className="text-2xl font-display font-bold text-slate-900">Academic Sessions</h2>
        {canManage && !showForm && (
          <button onClick={() => setShowForm(true)} className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg px-3.5 py-2 flex items-center gap-1.5 shrink-0">
            <Plus size={14} /> New Session
          </button>
        )}
      </div>

      {/* Understated meta strip instead of a long descriptive subtitle */}
      {!loading && (
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-6">
          <span>{years.length} {years.length === 1 ? "session" : "sessions"}</span>
          {currentSession && (
            <>
              <span className="text-slate-300">·</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Current: {currentSession.label}
              </span>
            </>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {!canManage && !loading && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 flex items-center gap-2.5">
          <Lock size={15} className="text-slate-400 shrink-0" />
          <p className="text-xs text-slate-500">Only the School Admin can create or change academic sessions. You can view them here.</p>
        </div>
      )}

      {canManage && showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-1.5">
            <CalendarRange size={15} className="text-indigo-600" /> Create a New Session
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Session Label</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. 2027-2028" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Start Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">End Date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 py-1">
              <input type="checkbox" checked={markCurrent} onChange={(e) => setMarkCurrent(e.target.checked)} className="rounded" />
              Mark as current session
            </label>
          </div>
          <div className="flex gap-2 mt-5">
            <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg py-2.5">
              {saving ? "Creating..." : "Create Session"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(2)].map((_, i) => <div key={i} className="h-20 bg-slate-200 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-2.5">
          {years.map((y) => (
            <button
              key={y.id}
              onClick={() => router.push(`/dashboard/school/sessions/${y.id}`)}
              className={`w-full bg-white rounded-xl p-4 flex items-center justify-between transition-all text-left group border ${
                y.is_current ? "border-indigo-200 shadow-sm" : "border-slate-200 hover:border-indigo-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${y.is_current ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                  <CalendarRange size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{y.label}</p>
                  <p className="text-xs text-slate-500">{y.start_date} to {y.end_date} · {monthsBetween(y.start_date, y.end_date)} months</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {y.is_current && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 flex items-center gap-1">
                    <Check size={11} /> Current
                  </span>
                )}
                <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          ))}
          {years.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <CalendarRange size={24} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                {canManage ? "No academic sessions yet — create your first one above." : "No academic sessions have been set up yet."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
