"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users, GraduationCap, Briefcase, ClipboardList, IndianRupee, CalendarCheck,
  AlertTriangle, Plus, UserPlus, UserCog, Layers, BookOpen, Megaphone,
  Wallet, FileBarChart, Clock, CheckCircle2, Lock,
} from "lucide-react";
import { apiRequest, isLoggedIn } from "../../lib/api";
import QuickActionModal from "../../components/QuickActionModal";
import MorningBriefing from "../../components/MorningBriefing";
import DashboardHero from "../../components/DashboardHero";
import DashboardCharts from "../../components/DashboardCharts";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function KPICard({ icon: Icon, label, value, sublabel }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <Icon size={16} className="text-slate-400" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sublabel && <p className="text-xs text-slate-500 mt-0.5">{sublabel}</p>}
    </div>
  );
}

function HealthBar({ label, value }) {
  const notTracked = value === null || value === undefined;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-600">{label}</span>
        <span className="text-xs font-medium text-slate-900">{notTracked ? "Not tracked yet" : `${value}%`}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${notTracked ? "bg-slate-200" : "bg-brand-500"}`}
          style={{ width: notTracked ? "100%" : `${value}%` }}
        />
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  { key: "add_student", label: "Add Student", icon: UserPlus, type: "nav", href: "/admin/admissions" },
  { key: "register_teacher", label: "Register Teacher", icon: UserPlus, type: "modal" },
  { key: "register_staff", label: "Register Staff", icon: UserCog, type: "modal" },
  { key: "create_house", label: "Create House", icon: Layers, type: "modal" },
  { key: "create_subject", label: "Create Subject", icon: BookOpen, type: "nav", href: "/admin/academics" },
  { key: "publish_notice", label: "Publish Notice", icon: Megaphone, type: "modal" },
  { key: "collect_fee", label: "Collect Fee", icon: Wallet, type: "nav", href: "/admin/finance" },
  { key: "generate_report", label: "Generate Report", icon: FileBarChart, type: "nav", href: "/admin/reports" },
];

const REPORT_CATEGORIES = ["Students", "Teachers", "Fees", "Attendance", "Examinations", "Admissions", "Finance"];

export default function DashboardHomePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/");
      return;
    }
    init();
  }, []);

  async function init() {
    setLoading(true);
    try {
      const me = await apiRequest("/auth/me");
      setUser(me);
      await Promise.all([loadSummary(me.school_id), loadEvents(me.school_id)]);
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary(schoolId) {
    try {
      const data = await apiRequest(`/dashboard/workbench?school_id=${schoolId}&date=${todayISO()}`);
      setSummary(data);
    } catch (err) {
      setSummaryError(err.message);
    }
  }

  async function loadEvents(schoolId) {
    const data = await apiRequest(`/events/?school_id=${schoolId}&date=${todayISO()}`);
    setEvents(data);
  }

  function handleQuickAction(action) {
    if (action.type === "nav") {
      router.push(action.href);
    } else {
      setActiveModal(action.key);
    }
  }

  function handleModalDone() {
    setActiveModal(false);
    if (user) {
      loadSummary(user.school_id);
      loadEvents(user.school_id);
    }
  }

  if (loading) {
    return <div className="max-w-6xl mx-auto px-6 py-8 text-sm text-slate-600">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <DashboardHero user={user} summary={summary} />

      {user && <MorningBriefing schoolId={user.school_id} />}

      {summaryError ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <p className="text-sm text-slate-600">{summaryError}</p>
        </div>
      ) : summary && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <KPICard icon={Users} label="Students" value={summary.total_students} />
            <KPICard icon={GraduationCap} label="Teachers" value={summary.total_teachers} />
            <KPICard icon={Briefcase} label="Staff" value={summary.total_staff} />
            <KPICard icon={ClipboardList} label="Admissions Pending" value={summary.admissions_pending} />
            <KPICard icon={IndianRupee} label="Fee Collection Today" value={`₹${summary.fee_collected_today.toLocaleString("en-IN")}`} />
            <KPICard icon={CalendarCheck} label="Attendance Today" value={`${summary.attendance_today_pct}%`} />
          </div>

          <DashboardCharts summary={summary} />

          {/* Needs Attention */}
          <div className="bg-white border border-red-100 rounded-xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-500" />
              <h3 className="text-sm font-semibold text-slate-800">Needs Attention</h3>
            </div>
            {summary.needs_attention.length === 0 ? (
              <p className="text-sm text-slate-500 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-brand-600" /> Nothing urgent right now.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {summary.needs_attention.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => router.push(item.link)}
                    className="flex items-center justify-between bg-red-50 hover:bg-red-100 rounded-lg px-3 py-2 text-left transition-colors"
                  >
                    <span className="text-sm text-slate-800">{item.label}</span>
                    <span className="text-sm font-bold text-red-600">{item.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            {/* Today's Schedule */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-brand-600" />
                  <h3 className="text-sm font-semibold text-slate-800">Today's Schedule</h3>
                </div>
                <button onClick={() => setActiveModal("add_event")} className="text-xs font-medium text-brand-700 flex items-center gap-1 hover:text-brand-800">
                  <Plus size={13} /> Add
                </button>
              </div>
              {events.length === 0 ? (
                <p className="text-sm text-slate-500">No events scheduled for today.</p>
              ) : (
                <div className="space-y-2">
                  {events.map((e) => (
                    <div key={e.id} className="flex items-center gap-3 text-sm">
                      <span className="text-slate-400 w-14 shrink-0">{e.event_time || "—"}</span>
                      <span className="text-slate-800">{e.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.key}
                      onClick={() => handleQuickAction(action)}
                      className="flex flex-col items-start gap-2 text-left border border-slate-200 rounded-2xl p-3.5 hover:border-brand-300 hover:shadow-sm transition-all"
                    >
                      <span className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                        <Icon size={16} className="text-brand-600" />
                      </span>
                      <span className="text-xs font-semibold text-slate-800">{action.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            {/* School Health */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">School Health</h3>
              <div className="space-y-3">
                <HealthBar label="Attendance" value={summary.school_health.attendance} />
                <HealthBar label="Fees Collected" value={summary.school_health.fees_collected} />
                <HealthBar label="Teacher Attendance" value={summary.school_health.teacher_attendance} />
                <HealthBar label="Homework Completion" value={summary.school_health.homework_completion} />
                <HealthBar label="Exam Progress" value={summary.school_health.exam_progress} />
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Recent Activity</h3>
              {summary.recent_activity.length === 0 ? (
                <p className="text-sm text-slate-500">Nothing yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {summary.recent_activity.map((a, i) => (
                    <p key={i} className="text-sm text-slate-700">{a.description}</p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Pending Approvals */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Pending Approvals</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {summary.pending_approvals.map((item) => (
                <div
                  key={item.label}
                  onClick={() => item.available && item.link && router.push(item.link)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                    item.available ? "bg-slate-50 hover:bg-slate-100 cursor-pointer" : "bg-slate-50 opacity-60"
                  }`}
                >
                  <span className="text-sm text-slate-700">{item.label}</span>
                  {item.available ? (
                    <span className="text-sm font-bold text-slate-900">{item.count}</span>
                  ) : (
                    <span className="text-xs text-slate-400 flex items-center gap-1"><Lock size={11} /> Soon</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Reports Snapshot */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Reports Snapshot</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {REPORT_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => router.push("/admin/reports")}
                  className="text-xs font-medium text-slate-700 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 hover:border-slate-300"
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {activeModal && user && (
        <QuickActionModal
          action={activeModal}
          schoolId={user.school_id}
          academicYearId={summary?.academic_year_id}
          onClose={() => setActiveModal(null)}
          onDone={handleModalDone}
        />
      )}
    </div>
  );
}
