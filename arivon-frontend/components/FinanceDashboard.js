"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IndianRupee, AlertCircle, ShieldCheck, RotateCcw, Receipt, Clock, Activity, TrendingDown,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { apiRequest, isLoggedIn } from "../lib/api";

const METHOD_COLORS = { cash: "#D97706", upi: "#5B45F0", bank_transfer: "#0D9488", cheque: "#DB2777", dd: "#475467" };

function KpiCard({ icon: Icon, iconBg, iconColor, label, value, sublabel, onClick }) {
  return (
    <button onClick={onClick} className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-slate-300 hover:shadow-sm transition-all">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${iconBg}`}>
        <Icon size={16} className={iconColor} />
      </div>
      <p className="text-2xl font-display font-bold text-slate-900 leading-none mb-1">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
      {sublabel && <p className="text-[11px] text-slate-400 mt-0.5">{sublabel}</p>}
    </button>
  );
}

export default function FinanceDashboard({ rolePrefix = "/finance" }) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    init();
  }, []);

  async function init() {
    try {
      const me = await apiRequest("/auth/me");
      const dashboard = await apiRequest(`/finance/dashboard?school_id=${me.school_id}`);
      setData(dashboard);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 text-sm text-slate-600">Loading...</div>;
  if (error) return <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 text-sm text-red-600">{error}</div>;
  if (!data) return null;

  const { kpis, payment_mode_today, highest_dues_by_class, upcoming_due_dates, recent_activity } = data;
  const modeData = payment_mode_today.map((m) => ({ name: m.method.replace("_", " "), value: m.amount, color: METHOD_COLORS[m.method] || "#94A3B8" }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 rounded-2xl p-6 sm:p-8 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <p className="text-xs font-medium text-teal-300 mb-2 flex items-center gap-1.5"><IndianRupee size={12} /> Finance</p>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2">Today at a Glance</h2>
          <p className="text-sm text-teal-200">
            ₹{kpis.today_collections.toLocaleString()} collected across {kpis.today_receipts} receipt{kpis.today_receipts !== 1 ? "s" : ""} today.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <KpiCard icon={IndianRupee} iconBg="bg-emerald-50" iconColor="text-emerald-700" label="Today's Collections" value={`₹${kpis.today_collections.toLocaleString()}`} onClick={() => router.push(`${rolePrefix}?tab=billing`)} />
        <KpiCard icon={AlertCircle} iconBg="bg-rose-50" iconColor="text-rose-700" label="Outstanding Amount" value={`₹${kpis.outstanding_amount.toLocaleString()}`} onClick={() => router.push(`${rolePrefix}?tab=reports`)} />
        <KpiCard icon={TrendingDown} iconBg="bg-amber-50" iconColor="text-amber-700" label="Defaulters" value={kpis.defaulters_count} sublabel="students overdue" onClick={() => router.push(`${rolePrefix}?tab=reports`)} />
        <KpiCard icon={ShieldCheck} iconBg="bg-violet-50" iconColor="text-violet-700" label="Pending Waivers" value={kpis.pending_waivers} onClick={() => router.push(`${rolePrefix}?tab=waivers`)} />
        <KpiCard icon={RotateCcw} iconBg="bg-blue-50" iconColor="text-blue-700" label="Pending Refunds" value={kpis.pending_refunds} onClick={() => router.push(`${rolePrefix}?tab=refunds`)} />
        <KpiCard icon={Receipt} iconBg="bg-teal-50" iconColor="text-teal-700" label="Today's Receipts" value={kpis.today_receipts} onClick={() => router.push(`${rolePrefix}?tab=billing`)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Highest Dues by Class</h3>
          {highest_dues_by_class.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-16">No outstanding dues right now.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={highest_dues_by_class} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="class_name" width={80} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `₹${v.toLocaleString()}`} />
                <Bar dataKey="outstanding" fill="#DC2626" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Today's Payment Modes</h3>
          {modeData.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-16">No payments recorded today yet.</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={140}>
                <PieChart>
                  <Pie data={modeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={55}>
                    {modeData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `₹${v.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5">
                {modeData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-slate-600 capitalize">{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5"><Clock size={14} /> Upcoming Due Dates</h3>
          {upcoming_due_dates.length === 0 ? (
            <p className="text-xs text-slate-400">Nothing due in the next 7 days.</p>
          ) : (
            <div className="space-y-2">
              {upcoming_due_dates.map((d, i) => (
                <div key={i} className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2">
                  <span className="text-xs text-slate-700">{d.student_name}</span>
                  <span className="text-[11px] font-medium text-slate-500">₹{d.amount.toLocaleString()} · {d.due_date}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5"><Activity size={14} /> Recent Activity</h3>
          {recent_activity.length === 0 ? (
            <p className="text-xs text-slate-400">Nothing recorded yet today.</p>
          ) : (
            <div className="space-y-2">
              {recent_activity.map((a, i) => (
                <div key={i} className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2">
                  <span className="text-xs text-slate-700">{a.description}</span>
                  <span className="text-[10px] font-medium text-slate-400 shrink-0 ml-2">{new Date(a.timestamp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
