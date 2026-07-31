"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, BookOpen, CalendarCheck, ClipboardList } from "lucide-react";
import { apiRequest, isLoggedIn } from "../../../lib/api";
import MiniCalendar from "../../../components/MiniCalendar";
import NoticeBoard from "../../../components/NoticeBoard";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function todayDayOfWeek() {
  // JS getDay(): 0=Sunday..6=Saturday. Our schema: 0=Monday..6=Sunday.
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export default function TeacherDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [sections, setSections] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/");
      return;
    }
    init();
  }, []);

  async function init() {
    try {
      const me = await apiRequest("/auth/me");
      setUser(me);
      const [mySections, mySchedule, notices] = await Promise.all([
        apiRequest("/my-sections"),
        apiRequest("/timetable/mine"),
        apiRequest(`/announcements/?school_id=${me.school_id}`),
      ]);
      setSections(mySections);
      setSchedule(mySchedule);
      setAnnouncements(notices);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadAnnouncements(schoolId) {
    const data = await apiRequest(`/announcements/?school_id=${schoolId}`);
    setAnnouncements(data);
  }

  const today = todayDayOfWeek();
  const todaysSchedule = schedule.filter((s) => s.day_of_week === today);
  const totalStudents = sections.reduce((sum, s) => sum + s.student_count, 0);

  if (loading) return <div className="max-w-5xl mx-auto px-6 py-8 text-sm text-slate-600">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">
        Welcome back{user ? `, ${user.full_name.split(" ")[0]}` : ""}
      </h2>
      <p className="text-sm text-slate-600 mb-6">Here's your day at a glance.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-500">My Classes</p>
            <BookOpen size={16} className="text-slate-400" />
          </div>
          <p className="text-3xl font-bold text-slate-900">{sections.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-500">My Students</p>
            <Users size={16} className="text-slate-400" />
          </div>
          <p className="text-3xl font-bold text-slate-900">{totalStudents}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-500">Periods Today</p>
            <CalendarCheck size={16} className="text-slate-400" />
          </div>
          <p className="text-3xl font-bold text-slate-900">{todaysSchedule.length}</p>
        </div>
        <button
          onClick={() => router.push("/admin/attendance")}
          className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl p-5 flex flex-col items-start justify-center gap-1 text-left transition-colors"
        >
          <ClipboardList size={18} />
          <span className="text-sm font-medium">Mark Attendance</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Today's Schedule ({DAY_NAMES[today]})</h3>
          {todaysSchedule.length === 0 ? (
            <p className="text-sm text-slate-500">No periods scheduled for you today.</p>
          ) : (
            <div className="space-y-2">
              {todaysSchedule.map((s) => (
                <div key={s.id} className="flex items-center justify-between border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{s.subject_name}</p>
                    <p className="text-xs text-slate-500">{s.section_name}</p>
                  </div>
                  <span className="text-xs text-slate-500">{s.start_time} - {s.end_time}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">My Classes</h3>
          {sections.length === 0 ? (
            <p className="text-sm text-slate-500">No classes assigned yet — set up via Academics by your Academic Coordinator.</p>
          ) : (
            <div className="space-y-2">
              {sections.map((s) => (
                <div key={s.section_id} className="flex items-center justify-between border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                  <p className="text-sm font-medium text-slate-900">{s.section_name}</p>
                  <span className="text-xs text-slate-500">{s.student_count} students</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MiniCalendar />
        {user && (
          <NoticeBoard
            schoolId={user.school_id}
            userRole={user.role_name}
            announcements={announcements}
            onPosted={() => loadAnnouncements(user.school_id)}
          />
        )}
      </div>
    </div>
  );
}
