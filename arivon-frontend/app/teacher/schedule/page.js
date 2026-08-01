"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, BookOpen } from "lucide-react";
import { apiRequest, isLoggedIn } from "../../../lib/api";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function todayDayOfWeek() {
  const jsDay = new Date().getDay(); // 0=Sunday..6=Saturday
  return jsDay === 0 ? 6 : jsDay - 1; // convert to 0=Monday..6=Sunday
}

export default function TeacherSchedulePage() {
  const router = useRouter();
  const [schedule, setSchedule] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    apiRequest("/timetable/mine")
      .then(setSchedule)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const today = todayDayOfWeek();

  if (loading) return <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 text-sm text-slate-600">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">My Schedule</h2>
      <p className="text-sm text-slate-600 mb-6">Every period you teach, across the week.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {DAY_NAMES.map((dayName, dayIndex) => {
          const periods = schedule
            .filter((s) => s.day_of_week === dayIndex)
            .sort((a, b) => a.period_number - b.period_number);
          const isToday = dayIndex === today;

          return (
            <div key={dayIndex} className={`bg-white border rounded-2xl p-4 ${isToday ? "border-brand-300 ring-1 ring-brand-100" : "border-slate-200"}`}>
              <div className="flex items-center gap-2 mb-3">
                <p className={`text-sm font-semibold ${isToday ? "text-brand-700" : "text-slate-700"}`}>{dayName}</p>
                {isToday && <span className="text-[10px] font-semibold bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full">Today</span>}
              </div>

              {periods.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No periods scheduled.</p>
              ) : (
                <div className="space-y-2">
                  {periods.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 border border-slate-100 rounded-xl px-3 py-2.5">
                      <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                        <BookOpen size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{p.subject_name}</p>
                        <p className="text-xs text-slate-500 truncate">{p.section_name}</p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-500 shrink-0">
                        <Clock size={11} />
                        {p.start_time}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
