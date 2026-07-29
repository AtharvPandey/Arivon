"use client";

/**
 * Principal Dashboard — a proper command center, not a landing page.
 *
 * Design principle from real school-ERP research: Principal = oversight
 * and approvals, not configuration. Every widget on this page reflects
 * something a Principal genuinely does in a working school day:
 *
 *   1. Today's Snapshot — four KPIs a Principal glances at each morning
 *   2. Approvals Queue — leave requests they need to act on today
 *   3. Class Strength Overview — every section's headcount at a glance
 *   4. Academic Performance — recent exams to drill into
 *   5. Notices published + Open complaints — communication oversight
 *
 * Deliberately no "Add Student" / "Create Fee Structure" quick actions —
 * those are Admin's domain. A Principal reviews and approves; a
 * Principal does not enter data.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck, Users, TrendingUp, GraduationCap, ChevronRight,
  Calendar, CheckCircle2, ArrowRight, MessageSquareWarning, Megaphone,
  BookOpenCheck, UserCheck, Layers, Bell,
} from "lucide-react";
import { apiRequest, isLoggedIn } from "../../../lib/api";

function todayISO() { return new Date().toISOString().split("T")[0]; }

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// A Principal's name often starts with "Dr." — greeting them as
// "Good morning, Dr." looks broken. Skip the honorific for the greeting
// and use the actual first name.
function friendlyFirstName(fullName) {
  if (!fullName) return "";
  const HONORIFICS = new Set(["dr", "dr.", "mr", "mr.", "mrs", "mrs.", "ms", "ms.", "prof", "prof.", "shri", "smt", "smt."]);
  for (const part of fullName.split(/\s+/)) {
    if (!HONORIFICS.has(part.toLowerCase())) return part;
  }
  return fullName.split(/\s+/)[0];
}

function SectionHeader({ icon: Icon, iconColor, title, subtitle, actionLabel, onAction }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
          <Icon size={14} className={iconColor} /> {title}
        </h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actionLabel && (
        <button onClick={onAction} className="text-xs text-indigo-700 hover:text-indigo-900 flex items-center gap-0.5 font-medium">
          {actionLabel} <ArrowRight size={11} />
        </button>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, iconBg, iconColor, label, value, sublabel, trend, onClick }) {
  return (
    <button onClick={onClick} className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-slate-300 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon size={16} className={iconColor} />
        </div>
        {trend && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${trend.color}`}>{trend.label}</span>}
      </div>
      <p className="text-2xl font-display font-bold text-slate-900 leading-none mb-1">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
      {sublabel && <p className="text-[11px] text-slate-400 mt-0.5">{sublabel}</p>}
    </button>
  );
}

export default function PrincipalDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [openComplaints, setOpenComplaints] = useState([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState([]);
  const [strength, setStrength] = useState([]);
  const [recentExams, setRecentExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    (async () => {
      try {
        const me = await apiRequest("/auth/me");
        setUser(me);
        const [summaryData, leavesData, complaintsData, announcementsData, strengthData, examsData] = await Promise.all([
          apiRequest(`/dashboard/summary?school_id=${me.school_id}&date=${todayISO()}`),
          apiRequest(`/leave/applications?school_id=${me.school_id}&status=pending`),
          apiRequest(`/complaints/?school_id=${me.school_id}&status=open`),
          apiRequest(`/announcements/?school_id=${me.school_id}`),
          apiRequest(`/reports/student-strength?school_id=${me.school_id}`),
          apiRequest(`/exams/?school_id=${me.school_id}`),
        ]);
        setSummary(summaryData);
        setPendingLeaves(leavesData);
        setOpenComplaints(complaintsData);
        setRecentAnnouncements(announcementsData.slice(0, 4));
        setStrength(strengthData);
        setRecentExams(examsData.slice(0, 4));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="animate-pulse space-y-4">
        <div className="h-40 bg-slate-200 rounded-2xl" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-200 rounded-xl" />)}
        </div>
      </div>
    </div>
  );

  const studentAttendancePct = summary && summary.total_students > 0
    ? Math.round((summary.students_present / summary.total_students) * 100) : 0;
  const staffAttendancePct = summary && summary.total_staff > 0
    ? Math.round((summary.staff_present / summary.total_staff) * 100) : 0;

  const strengthTotal = strength.reduce((s, r) => s + r.total, 0);
  const strengthBoys = strength.reduce((s, r) => s + r.boys, 0);
  const strengthGirls = strength.reduce((s, r) => s + r.girls, 0);

  const attendanceTrend = studentAttendancePct >= 90
    ? { label: "Strong", color: "bg-emerald-100 text-emerald-700" }
    : studentAttendancePct >= 75
    ? { label: "Watch", color: "bg-amber-100 text-amber-700" }
    : { label: "Low", color: "bg-rose-100 text-rose-700" };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {/* Hero — calm, oversight-focused, no aggressive CTAs */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-8 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-violet-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-medium text-indigo-300 mb-2 flex items-center gap-1.5">
              <Calendar size={12} />
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
            <h2 className="text-3xl font-display font-bold text-white mb-2">
              {greeting()}, {friendlyFirstName(user?.full_name)}
            </h2>
            <p className="text-sm text-indigo-200 leading-relaxed max-w-xl">
              {pendingLeaves.length > 0 || openComplaints.length > 0
                ? `You have ${pendingLeaves.length} leave ${pendingLeaves.length === 1 ? "request" : "requests"} and ${openComplaints.length} open ${openComplaints.length === 1 ? "complaint" : "complaints"} awaiting your review.`
                : "Everything is running smoothly. No pending items this morning."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => router.push("/dashboard/people/leave")} className="text-xs font-medium bg-white/10 hover:bg-white/15 text-white rounded-lg px-3.5 py-2 flex items-center gap-1.5 backdrop-blur-sm">
              <ClipboardCheck size={13} /> Review Approvals
            </button>
            <button onClick={() => router.push("/dashboard/communication")} className="text-xs font-medium bg-white/10 hover:bg-white/15 text-white rounded-lg px-3.5 py-2 flex items-center gap-1.5 backdrop-blur-sm">
              <Megaphone size={13} /> Publish Notice
            </button>
          </div>
        </div>
      </div>

      {/* Row 1 — Today's Snapshot: 4 KPIs a Principal glances at each morning */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard
          icon={UserCheck} iconBg="bg-emerald-50" iconColor="text-emerald-700"
          label="Students Present Today"
          value={`${studentAttendancePct}%`}
          sublabel={`${summary?.students_present || 0} of ${summary?.total_students || 0}`}
          trend={summary?.total_students > 0 ? attendanceTrend : null}
          onClick={() => router.push("/dashboard/attendance/overview")}
        />
        <KpiCard
          icon={Users} iconBg="bg-indigo-50" iconColor="text-indigo-700"
          label="Staff On Duty"
          value={`${staffAttendancePct}%`}
          sublabel={`${summary?.staff_present || 0} of ${summary?.total_staff || 0}`}
          onClick={() => router.push("/dashboard/attendance/staff-report")}
        />
        <KpiCard
          icon={ClipboardCheck} iconBg="bg-amber-50" iconColor="text-amber-700"
          label="Pending Approvals"
          value={pendingLeaves.length}
          sublabel="Leave requests"
          onClick={() => router.push("/dashboard/people/leave")}
        />
        <KpiCard
          icon={MessageSquareWarning} iconBg="bg-rose-50" iconColor="text-rose-700"
          label="Open Complaints"
          value={openComplaints.length}
          sublabel="Parent grievances"
          onClick={() => router.push("/dashboard/communication/complaints")}
        />
      </div>

      {/* Row 2 — Approvals Queue: the actual work waiting */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5">
          <SectionHeader
            icon={ClipboardCheck} iconColor="text-amber-600"
            title="Leave Approvals"
            subtitle="Staff leave requests awaiting your decision"
            actionLabel={pendingLeaves.length > 4 ? `View all ${pendingLeaves.length}` : null}
            onAction={() => router.push("/dashboard/people/leave")}
          />
          {pendingLeaves.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                <CheckCircle2 size={20} />
              </div>
              <p className="text-sm text-slate-700 font-medium">All caught up</p>
              <p className="text-xs text-slate-400 mt-0.5">No requests pending your review</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingLeaves.slice(0, 4).map((leave) => (
                <button
                  key={leave.id}
                  onClick={() => router.push("/dashboard/people/leave")}
                  className="w-full text-left py-3 flex items-center gap-3 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-semibold shrink-0">
                    {leave.staff_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-800 truncate">{leave.staff_name}</p>
                      <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded ml-2 shrink-0">
                        {leave.days} {leave.days === 1 ? "DAY" : "DAYS"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 capitalize truncate">
                      {leave.leave_type.replace(/_/g, " ")} · {leave.start_date} → {leave.end_date}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <SectionHeader
            icon={Bell} iconColor="text-indigo-600"
            title="Recent Notices"
            actionLabel="All"
            onAction={() => router.push("/dashboard/communication")}
          />
          {recentAnnouncements.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No notices published yet</p>
          ) : (
            <div className="space-y-2.5">
              {recentAnnouncements.map((a) => (
                <div key={a.id} className="border-l-2 border-indigo-200 pl-3 py-0.5">
                  <p className="text-sm font-medium text-slate-800 line-clamp-1">{a.title}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {a.category} · {new Date(a.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 3 — Class Strength Overview.
          Redesigned as a compact chip grid (5 per row on desktop) so
          15 classes fit in ~3 rows instead of taking 15 rows of vertical
          space. Every chip is a summary; the "Full report" link opens
          the section-level breakdown. */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
        <SectionHeader
          icon={Layers} iconColor="text-violet-600"
          title="Class Strength Overview"
          subtitle={`${strengthTotal} students across ${strength.length} sections · ${strengthBoys} boys, ${strengthGirls} girls`}
          actionLabel="Full report"
          onAction={() => router.push("/dashboard/reports")}
        />
        {strength.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">No sections configured yet</p>
        ) : (() => {
          const groupedMap = new Map();
          strength.forEach((s) => {
            if (!groupedMap.has(s.class_name)) groupedMap.set(s.class_name, []);
            groupedMap.get(s.class_name).push(s);
          });
          const grouped = Array.from(groupedMap.entries());

          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
              {grouped.map(([className, sections]) => {
                const classTotal = sections.reduce((sum, s) => sum + s.total, 0);
                const classBoys = sections.reduce((sum, s) => sum + s.boys, 0);
                const classGirls = sections.reduce((sum, s) => sum + s.girls, 0);
                const boysPct = classTotal > 0 ? (classBoys / classTotal) * 100 : 0;
                // Slugify the class name so the URL reads /classes/nursery
                // instead of /classes/1. The backend resolves either form.
                const classSlug = className.trim().toLowerCase().replace(/\s+/g, "-");

                return (
                  <button
                    key={className}
                    onClick={() => router.push(`/dashboard/school/classes/${classSlug}`)}
                    title={`${className}: ${classTotal} students across ${sections.length} sections (${classBoys} boys, ${classGirls} girls)`}
                    className="text-left bg-gradient-to-br from-slate-50 to-white border border-slate-200/70 hover:border-violet-300 hover:shadow-sm rounded-xl p-3 transition-all group"
                  >
                    <div className="flex items-baseline justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-600 truncate">{className}</p>
                      <span className="text-[10px] text-slate-400">{sections.length} sec</span>
                    </div>
                    <p className="text-xl font-display font-bold text-slate-900 leading-none mb-2">{classTotal}</p>
                    <div className="h-1 bg-rose-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${boysPct}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[10px]">
                      <span className="text-indigo-700 font-medium">{classBoys}<span className="text-slate-400 font-normal"> boys</span></span>
                      <span className="text-rose-500 font-medium">{classGirls}<span className="text-slate-400 font-normal"> girls</span></span>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Row 4 — Academic Performance + Open Complaints side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <SectionHeader
            icon={BookOpenCheck} iconColor="text-teal-600"
            title="Academic Performance"
            subtitle="Recent examinations to review"
            actionLabel="All exams"
            onAction={() => router.push("/dashboard/academics/examinations")}
          />
          {recentExams.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No examinations recorded yet</p>
          ) : (
            <div className="space-y-2">
              {recentExams.map((exam) => (
                <button
                  key={exam.id}
                  onClick={() => router.push(`/dashboard/academics/examinations/${exam.id}`)}
                  className="w-full text-left p-3 rounded-lg border border-slate-100 hover:border-teal-200 hover:bg-teal-50/30 transition-colors flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{exam.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5 capitalize">{exam.exam_type} · {exam.status}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <SectionHeader
            icon={MessageSquareWarning} iconColor="text-rose-600"
            title="Open Complaints"
            subtitle="Parent grievances awaiting resolution"
            actionLabel="All"
            onAction={() => router.push("/dashboard/communication/complaints")}
          />
          {openComplaints.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                <CheckCircle2 size={20} />
              </div>
              <p className="text-sm text-slate-700 font-medium">No open complaints</p>
              <p className="text-xs text-slate-400 mt-0.5">Everyone's happy today</p>
            </div>
          ) : (
            <div className="space-y-2">
              {openComplaints.slice(0, 4).map((c) => (
                <button
                  key={c.id}
                  onClick={() => router.push("/dashboard/communication/complaints")}
                  className="w-full text-left p-3 rounded-lg border border-slate-100 hover:border-rose-200 hover:bg-rose-50/30 transition-colors"
                >
                  <p className="text-sm font-medium text-slate-800 line-clamp-1">{c.subject}</p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">from {c.guardian_name}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
