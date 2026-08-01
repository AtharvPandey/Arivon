"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, CheckCircle2, Circle, ArrowRight, Users2, BookOpen, ClipboardList } from "lucide-react";
import { apiRequest, isLoggedIn } from "../../../lib/api";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
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

  if (loading) return <div className="max-w-lg mx-auto px-4 py-6 text-sm text-slate-600">Loading...</div>;

  const totalStudents = sections.reduce((sum, s) => sum + s.student_count, 0);
  const markedCount = today.filter((p) => p.attendance_marked).length;
  const todayDateStr = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-8">
      {/* Hero */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-700 rounded-2xl p-5 mb-5 text-white">
        <p className="text-xs text-brand-100 mb-0.5">{todayDateStr}</p>
        <h2 className="text-xl font-display font-bold mb-3">
          {greeting()}{user ? `, ${user.full_name.split(" ")[0]}` : ""}
        </h2>
        <div className="flex items-center gap-4 text-sm">
          <div>
            <p className="text-2xl font-bold leading-none">{today.length}</p>
            <p className="text-xs text-brand-100 mt-1">Periods today</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div>
            <p className="text-2xl font-bold leading-none">{markedCount}/{today.length}</p>
            <p className="text-xs text-brand-100 mt-1">Attendance done</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div>
            <p className="text-2xl font-bold leading-none">{totalStudents}</p>
            <p className="text-xs text-brand-100 mt-1">Total students</p>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {/* Today's Schedule */}
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-sm font-semibold text-slate-800">Today's Schedule</h3>
        <button onClick={() => router.push("/teacher/schedule")} className="text-xs font-medium text-brand-700 hover:underline flex items-center gap-0.5">
          Full week <ArrowRight size={11} />
        </button>
      </div>

      {today.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-center mb-6">
          <p className="text-sm text-slate-500">No periods scheduled for you today.</p>
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {today.map((p) => (
            <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center gap-3">
              <div className="flex flex-col items-center justify-center w-14 shrink-0">
                <p className="text-xs font-semibold text-slate-700">{p.start_time}</p>
                <p className="text-[10px] text-slate-400">P{p.period_number}</p>
              </div>
              <div className="w-px h-9 bg-slate-100 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{p.subject_name}</p>
                <p className="text-xs text-slate-500 truncate">{p.section_name}</p>
              </div>
              {p.attendance_marked ? (
                <span className="flex items-center gap-1 text-[11px] font-medium text-brand-700 bg-brand-50 px-2.5 py-1.5 rounded-lg shrink-0">
                  <CheckCircle2 size={12} /> Marked
                </span>
              ) : (
                <button
                  onClick={() => router.push(`/teacher/attendance/mark?section_id=${p.section_id}&period_number=${p.period_number}`)}
                  className="flex items-center gap-1 text-[11px] font-medium text-white bg-brand-600 hover:bg-brand-700 px-2.5 py-1.5 rounded-lg shrink-0"
                >
                  <Circle size={11} /> Mark
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => router.push("/teacher/classes")}
          className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col items-center gap-1.5 hover:bg-slate-50 transition-colors"
        >
          <Users2 size={18} className="text-brand-600" />
          <span className="text-xs font-medium text-slate-700">Classes</span>
        </button>
        <button
          onClick={() => router.push("/admin/academics/homework")}
          className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col items-center gap-1.5 hover:bg-slate-50 transition-colors"
        >
          <ClipboardList size={18} className="text-brand-600" />
          <span className="text-xs font-medium text-slate-700">Homework</span>
        </button>
        <button
          onClick={() => router.push("/admin/academics/syllabus")}
          className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col items-center gap-1.5 hover:bg-slate-50 transition-colors"
        >
          <BookOpen size={18} className="text-brand-600" />
          <span className="text-xs font-medium text-slate-700">Syllabus</span>
        </button>
      </div>
    </div>
  );
}
