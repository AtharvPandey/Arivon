"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, GraduationCap, LayoutGrid, Users, Briefcase, Wallet, Pencil, Check, X, Star,
} from "lucide-react";
import { apiRequest, isLoggedIn } from "../../../../../lib/api";

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${color.bg}`}>
        <Icon size={16} className={color.text} />
      </div>
      <p className="text-2xl font-display font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

export default function AcademicSessionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [year, setYear] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    load();
  }, [params.id]);

  async function load() {
    setLoading(true);
    try {
      const [yearData, statsData] = await Promise.all([
        apiRequest(`/academic-years/${params.id}`),
        apiRequest(`/academic-years/${params.id}/stats`),
      ]);
      setYear(yearData);
      setForm(yearData);
      setStats(statsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const updated = await apiRequest(`/academic-years/${params.id}`, {
        method: "PATCH",
        body: { label: form.label, start_date: form.start_date, end_date: form.end_date },
      });
      setYear(updated);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkCurrent() {
    setError("");
    try {
      const updated = await apiRequest(`/academic-years/${params.id}`, { method: "PATCH", body: { is_current: true } });
      setYear(updated);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="max-w-3xl mx-auto px-6 py-8 text-sm text-slate-600">Loading...</div>;
  if (!year || !stats) return null;

  const collectionPct = stats.total_fee_billed > 0 ? Math.round((stats.total_fee_collected / stats.total_fee_billed) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <button onClick={() => router.push("/admin/school/sessions")} className="text-sm text-slate-600 hover:text-slate-900 mb-4 flex items-center gap-1">
        <ArrowLeft size={14} /> Back to Sessions
      </button>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {editing ? (
              <input value={form.label || ""} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} className="text-2xl font-display font-bold text-slate-900 border-b border-slate-200 outline-none pb-1 w-full" />
            ) : (
              <h2 className="text-2xl font-display font-bold text-slate-900">{year.label}</h2>
            )}
            {editing ? (
              <div className="flex items-center gap-2 mt-2">
                <input type="date" value={form.start_date || ""} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                <span className="text-slate-400">to</span>
                <input type="date" value={form.end_date || ""} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" />
              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-1">{year.start_date} to {year.end_date}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {year.is_current ? (
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-brand-100 text-brand-700 flex items-center gap-1"><Star size={11} fill="currentColor" /> Current Session</span>
            ) : (
              <button onClick={handleMarkCurrent} className="text-xs font-medium text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5">Mark as Current</button>
            )}
            {editing ? (
              <>
                <button onClick={handleSave} disabled={saving} className="text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-3 py-1.5 flex items-center gap-1"><Check size={12} /> Save</button>
                <button onClick={() => { setEditing(false); setForm(year); }} className="text-xs text-slate-500"><X size={14} /></button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="text-slate-400 hover:text-slate-700"><Pencil size={14} /></button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard icon={LayoutGrid} label="Classes" value={stats.total_classes} color={{ bg: "bg-indigo-50", text: "text-indigo-700" }} />
        <StatCard icon={GraduationCap} label="Sections" value={stats.total_sections} color={{ bg: "bg-teal-50", text: "text-teal-700" }} />
        <StatCard icon={Users} label="Students" value={stats.total_students} color={{ bg: "bg-amber-50", text: "text-amber-700" }} />
        <StatCard icon={Briefcase} label="Staff" value={stats.total_staff} color={{ bg: "bg-violet-50", text: "text-violet-700" }} />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
          <Wallet size={14} className="text-rose-600" /> Fee Collection This Session
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-rose-500" style={{ width: `${collectionPct}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500">
              <span>Collected: <b className="text-slate-800">₹{stats.total_fee_collected.toLocaleString()}</b></span>
              <span>Billed: <b className="text-slate-800">₹{stats.total_fee_billed.toLocaleString()}</b></span>
            </div>
          </div>
          <span className="text-xl font-display font-bold text-rose-600">{collectionPct}%</span>
        </div>
      </div>
    </div>
  );
}
