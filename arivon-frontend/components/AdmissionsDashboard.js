"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, FileText, FileCheck, GraduationCap, IndianRupee, TrendingUp,
  Armchair, Plus, CalendarClock, ClipboardCheck, CreditCard, Clock,
} from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { apiRequest, isLoggedIn } from "../lib/api";

const SOURCE_COLORS = ["#5B45F0", "#0D9488", "#D97706", "#DB2777", "#475467", "#4F46E5"];
const GENDER_COLORS = { male: "#4F46E5", female: "#DB2777", "Not specified": "#94A3B8" };

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

function ChartCard({ title, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-slate-800 mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function AdmissionsDashboard() {
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
      const dashboard = await apiRequest(`/admission-pipeline/dashboard?school_id=${me.school_id}`);
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

  const { kpis, stage_distribution, monthly_trend, source_distribution, admissions_by_class, admissions_by_gender, revenue_by_month, upcoming_follow_ups, pending_documents, todays_meetings, recent_applications } = data;

  const activeStages = stage_distribution.filter((s) => !["rejected", "waitlisted"].includes(s.stage));
  const sourceData = source_distribution.map((s, i) => ({ name: s.name.replace("_", " "), value: s.count, color: SOURCE_COLORS[i % SOURCE_COLORS.length] }));
  const genderData = admissions_by_gender.map((g) => ({ name: g.name, value: g.count, color: GENDER_COLORS[g.name] || "#94A3B8" }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-6 sm:p-8 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-indigo-300 mb-2 flex items-center gap-1.5"><Sparkles size={12} /> Admissions</p>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2">Executive Dashboard</h2>
            <p className="text-sm text-indigo-200">{kpis.conversion_rate_pct}% of every lead ever created has become an enrolled student.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push("/admissions/inquiries")} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white text-xs font-medium rounded-lg px-3 py-2 backdrop-blur-sm"><Plus size={13} /> New Inquiry</button>
            <button onClick={() => router.push("/admissions/applications")} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white text-xs font-medium rounded-lg px-3 py-2 backdrop-blur-sm"><ClipboardCheck size={13} /> Applications</button>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard icon={Sparkles} iconBg="bg-indigo-50" iconColor="text-indigo-700" label="New Inquiries Today" value={kpis.new_inquiries_today} onClick={() => router.push("/admissions/inquiries")} />
        <KpiCard icon={FileText} iconBg="bg-violet-50" iconColor="text-violet-700" label="Applications Submitted" value={kpis.applications_submitted_total} onClick={() => router.push("/admissions/applications")} />
        <KpiCard icon={FileCheck} iconBg="bg-amber-50" iconColor="text-amber-700" label="Pending Verification" value={kpis.pending_verification} onClick={() => router.push("/admissions/applications?filter=document_verification")} />
        <KpiCard icon={CalendarClock} iconBg="bg-teal-50" iconColor="text-teal-700" label="Interviews Today" value={kpis.interviews_today} />
        <KpiCard icon={GraduationCap} iconBg="bg-emerald-50" iconColor="text-emerald-700" label="Admissions Confirmed" value={kpis.admissions_confirmed_total} onClick={() => router.push("/admissions/students-joined")} />
        <KpiCard icon={IndianRupee} iconBg="bg-rose-50" iconColor="text-rose-700" label="Fees Collected Today" value={`₹${kpis.fees_collected_today.toLocaleString()}`} />
        <KpiCard icon={TrendingUp} iconBg="bg-blue-50" iconColor="text-blue-700" label="Conversion Rate" value={`${kpis.conversion_rate_pct}%`} sublabel="Lead → Confirmed" />
        <KpiCard icon={Armchair} iconBg="bg-slate-100" iconColor="text-slate-700" label="Seat Availability" value={kpis.seat_available} sublabel={`of ${kpis.seat_capacity_total} total`} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <ChartCard title="Admission Funnel">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={activeStages} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#5B45F0" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Admission Trend (Monthly Confirmations)">
          {monthly_trend.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-16">No confirmations yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthly_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F3F6" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#5B45F0" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Inquiry Source Distribution">
          {sourceData.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-16">No inquiries yet.</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                    {sourceData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5">
                {sourceData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-slate-600 capitalize">{d.name}</span>
                    <span className="text-slate-400">({d.value})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Admissions by Class">
          {admissions_by_class.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-16">No confirmed admissions yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={admissions_by_class}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#0D9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <ChartCard title="Admissions by Gender">
          {genderData.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-10">No data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={genderData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
                  {genderData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <div className="lg:col-span-2">
          <ChartCard title="Revenue from Admissions">
            {revenue_by_month.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-16">No admission fee payments recorded yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={revenue_by_month}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `₹${v.toLocaleString()}`} />
                  <Bar dataKey="amount" fill="#D97706" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </div>

      {/* Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5"><Clock size={14} /> Today's Meetings</h3>
          {todays_meetings.length === 0 ? (
            <p className="text-xs text-slate-400">Nothing scheduled today.</p>
          ) : (
            <div className="space-y-2">
              {todays_meetings.map((m, i) => (
                <div key={i} className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2">
                  <span className="text-xs text-slate-700">{m.student_name}</span>
                  <span className="text-[10px] font-medium text-slate-500">{new Date(m.scheduled_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · {m.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5"><FileCheck size={14} /> Pending Documents</h3>
          {pending_documents.length === 0 ? (
            <p className="text-xs text-slate-400">Nothing pending.</p>
          ) : (
            <div className="space-y-2">
              {pending_documents.slice(0, 5).map((d, i) => (
                <div key={i} className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2">
                  <span className="text-xs text-slate-700">{d.student_name}</span>
                  <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">{d.document_type.replace("_", " ")}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5"><CalendarClock size={14} /> Upcoming Follow-ups</h3>
          {upcoming_follow_ups.length === 0 ? (
            <p className="text-xs text-slate-400">No follow-ups scheduled.</p>
          ) : (
            <div className="space-y-2">
              {upcoming_follow_ups.map((f, i) => (
                <div key={i} className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2">
                  <span className="text-xs text-slate-700">{f.student_name}</span>
                  <span className="text-[10px] text-slate-500">{f.follow_up_date}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5"><FileText size={14} /> Recent Applications</h3>
          {recent_applications.length === 0 ? (
            <p className="text-xs text-slate-400">Nothing yet.</p>
          ) : (
            <div className="space-y-2">
              {recent_applications.map((a) => (
                <div key={a.application_id} className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2">
                  <span className="text-xs text-slate-700">{a.student_name}</span>
                  <span className="text-[10px] font-medium text-slate-500 capitalize">{a.stage.replace("_", " ")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
