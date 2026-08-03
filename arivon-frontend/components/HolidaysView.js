"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus, X } from "lucide-react";
import { apiRequest, isLoggedIn } from "../lib/api";

const MANAGER_ROLES = ["school_admin", "administrator", "principal", "vice_principal", "super_admin"];

function formatDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function HolidaysPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    init();
  }, []);

  async function init() {
    try {
      const me = await apiRequest("/auth/me");
      setUser(me);
      await loadHolidays(me.school_id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadHolidays(schoolId) {
    const data = await apiRequest(`/holidays/?school_id=${schoolId}`);
    setHolidays(data);
  }

  const canManage = user && MANAGER_ROLES.includes(user.role_name);

  async function handleAdd(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const years = await apiRequest(`/academic-years/?school_id=${user.school_id}`);
      const currentYear = years.find((y) => y.is_current) || years[0];
      if (!currentYear) {
        setError("Set up an academic session first, under School → Academic Sessions.");
        setSaving(false);
        return;
      }
      await apiRequest("/holidays/", {
        method: "POST",
        body: { school_id: user.school_id, academic_year_id: currentYear.id, name, date },
      });
      setName(""); setDate(""); setShowForm(false);
      await loadHolidays(user.school_id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Remove this holiday?")) return;
    try {
      await apiRequest(`/holidays/${id}`, { method: "DELETE" });
      await loadHolidays(user.school_id);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 text-sm text-slate-600">Loading...</div>;

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = holidays.filter((h) => h.date >= today);
  const past = holidays.filter((h) => h.date < today);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-6 sm:p-8 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-indigo-300 mb-2 flex items-center gap-1.5">
              <CalendarDays size={12} /> Holidays
            </p>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2">Holiday Calendar</h2>
            <p className="text-sm text-indigo-200">{holidays.length} holidays recorded this year.</p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="shrink-0 flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white text-xs sm:text-sm font-medium rounded-lg px-3 sm:px-4 py-2 backdrop-blur-sm"
            >
              {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? "Cancel" : "Add Holiday"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border border-slate-200 rounded-xl p-5 mb-6 flex flex-col sm:flex-row gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Holiday name (e.g. Diwali)" required className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <button type="submit" disabled={saving} className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2">
            {saving ? "Adding..." : "Add"}
          </button>
        </form>
      )}

      {holidays.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <CalendarDays size={24} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-600">No holidays recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Upcoming</h3>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {upcoming.map((h) => (
                  <div key={h.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{h.name}</p>
                      <p className="text-xs text-slate-500">{formatDate(h.date)}</p>
                    </div>
                    {canManage && (
                      <button onClick={() => handleDelete(h.id)} className="text-xs text-slate-400 hover:text-rose-600">
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-500 mb-3">Past</h3>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 opacity-60">
                {past.map((h) => (
                  <div key={h.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{h.name}</p>
                      <p className="text-xs text-slate-400">{formatDate(h.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
