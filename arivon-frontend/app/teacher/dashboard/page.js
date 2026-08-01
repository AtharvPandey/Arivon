"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, CalendarClock, CheckCircle2, Circle, ArrowRight, Users2, BookOpen, ClipboardList, GraduationCap, Crown } from "lucide-react";
import { apiRequest, isLoggedIn } from "../../../lib/api";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function friendlyFirstName(fullName) {
  if (!fullName) return "";
  const first = fullName.split(" ")[0];
  return first.replace(/\.$/, "");
}

function KpiCard({ icon: Icon, iconBg, iconColor, label, value, sublabel, onClick }) {
  return (
    <button onClick={onClick} className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-slate-300 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon size={16} className={iconColor} />
        </div>
      </div>
      <p className="text-2xl font-display font-bold text-slate-900 leading-none mb-1">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
      {sublabel && <p className="text-[11px] text-slate-400 mt-0.5">{sublabel}</p>}
    </button>
  );
}

export default function TeacherDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [today, setToday] = useState([]);
  const [sections, setSections] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    init();
  }, []);

  async function init() {
    try {
      const me = await apiRequest("/auth/me");
      setUser(me);
      const [todaySchedule, mySections] = await Promise.all([
        apiRequest("/timetable/today"),
        apiRequest("/my-sections"),
      ]);
      setToday(todaySchedule);
      setSections(mySections);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 text-sm text-slate-600">Loading...</div>;

  const totalStudents = sections.reduce((sum, s) => sum + s.student_count, 0);
  const markedCount = today.filter((p) => p.attendance_marked).length;
  const classTeacherFor = sections.find((s) => s.is_class_teacher);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-8">
      {/* Hero — same premium slate/indigo language used across every dashboard in this app */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-6 sm:p-8 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-violet-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        <div className="relative">
          <p className="text-xs font-medium text-indigo-300 mb-2 flex items-center gap-1.5">
            <Calendar size={12} />
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2">
            {greeting()}, {friendlyFirstName(user?.full_name)}
          </h2>
          <p className="text-sm text-indigo-200 leading-relaxed max-w-xl">
            {today.length === 0
              ? "No periods scheduled for you today — a good day to catch up on syllabus or grading."
              : markedCount === today.length
              ? `All ${today.length} periods' attendance is marked for today. You're all caught up.`
              : `You have ${today.length - markedCount} of ${today.length} periods today still needing attendance.`}
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard
          icon={CalendarClock} iconBg="bg-indigo-50" iconColor="text-indigo-700"
          label="Periods Today" value={today.length}
          onClick={() => router.push("/teacher/schedule")}
        />
        <KpiCard
          icon={CheckCircle2} iconBg="bg-emerald-50" iconColor="text-emerald-700"
          label="Attendance Done" value={`${markedCount}/${today.length}`}
          sublabel={today.length > 0 ? `${Math.round((markedCount / today.length) * 100)}% complete` : null}
        />
        <KpiCard
          icon={Users2} iconBg="bg-violet-50" iconColor="text-violet-700"
          label="My Students" value={totalStudents}
          sublabel={`Across ${sections.length} class${sections.length !== 1 ? "es" : ""}`}
          onClick={() => router.push("/teacher/classes")}
        />
        <KpiCard
          icon={Crown} iconBg="bg-amber-50" iconColor="text-amber-700"
          label="Class Teacher For" value={classTeacherFor ? classTeacherFor.section_name : "—"}
          sublabel={classTeacherFor ? "Homeroom responsibility" : "Not assigned"}
        />
      </div>

      {/* Main content — two columns on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Today's Schedule */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">Today's Schedule</h3>
            <button onClick={() => router.push("/teacher/schedule")} className="text-xs font-medium text-brand-700 hover:underline flex items-center gap-0.5">
              Full week <ArrowRight size={11} />
            </button>
          </div>

          {today.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-500">No periods scheduled for you today.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {today.map((p) => (
                <div key={p.id} className="flex items-center gap-4 border border-slate-100 rounded-xl p-3.5 hover:border-slate-200 transition-colors">
                  <div className="flex flex-col items-center justify-center w-16 shrink-0">
                    <p className="text-sm font-semibold text-slate-700">{p.start_time}</p>
                    <p className="text-[10px] text-slate-400">Period {p.period_number}</p>
                  </div>
                  <div className="w-px h-10 bg-slate-100 shrink-0" />
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                    <BookOpen size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{p.subject_name}</p>
                    <p className="text-xs text-slate-500 truncate">{p.section_name}</p>
                  </div>
                  {p.attendance_marked ? (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg shrink-0">
                      <CheckCircle2 size={12} /> Marked
                    </span>
                  ) : (
                    <button
                      onClick={() => router.push(`/teacher/attendance/mark?section_id=${p.section_id}&period_number=${p.period_number}`)}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-lg shrink-0 transition-colors"
                    >
                      <Circle size={11} /> Mark Attendance
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column — My Classes + Quick Links */}
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800">My Classes</h3>
              <button onClick={() => router.push("/teacher/classes")} className="text-xs font-medium text-brand-700 hover:underline">
                View all
              </button>
            </div>
            {sections.length === 0 ? (
              <p className="text-xs text-slate-500">No classes assigned yet.</p>
            ) : (
              <div className="space-y-2">
                {sections.slice(0, 4).map((s) => (
                  <button
                    key={s.section_id}
                    onClick={() => router.push(`/teacher/classes/${s.section_id}`)}
                    className="w-full flex items-center justify-between text-left border border-slate-100 rounded-lg px-3 py-2.5 hover:border-slate-200 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <GraduationCap size={14} className="text-slate-400 shrink-0" />
                      <span className="text-sm font-medium text-slate-800 truncate">{s.section_name}</span>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">{s.student_count} students</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Quick Links</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => router.push("/admin/academics/homework")}
                className="flex flex-col items-center gap-1.5 border border-slate-100 rounded-xl p-3.5 hover:border-slate-200 transition-colors"
              >
                <ClipboardList size={18} className="text-brand-600" />
                <span className="text-xs font-medium text-slate-700">Homework</span>
              </button>
              <button
                onClick={() => router.push("/admin/academics/syllabus")}
                className="flex flex-col items-center gap-1.5 border border-slate-100 rounded-xl p-3.5 hover:border-slate-200 transition-colors"
              >
                <BookOpen size={18} className="text-brand-600" />
                <span className="text-xs font-medium text-slate-700">Syllabus</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
