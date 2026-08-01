"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Crown, ChevronRight, ClipboardCheck } from "lucide-react";
import { apiRequest, isLoggedIn } from "../../../lib/api";

export default function TeacherClassesPage() {
  const router = useRouter();
  const [sections, setSections] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    apiRequest("/my-sections")
      .then(setSections)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 text-sm text-slate-600">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">My Classes</h2>
      <p className="text-sm text-slate-600 mb-6">
        {sections.length} class{sections.length !== 1 ? "es" : ""} assigned to you.
      </p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {sections.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-sm text-slate-500">No classes assigned yet.</p>
          <p className="text-xs text-slate-400 mt-1">Your Academic Coordinator sets this up via the timetable.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map((s) => (
            <div key={s.section_id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-slate-300 hover:shadow-sm transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="text-base font-semibold text-slate-900">{s.section_name}</p>
                  {s.is_class_teacher && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                      <Crown size={9} /> Class Teacher
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-4">
                <Users size={12} />
                {s.student_count} student{s.student_count !== 1 ? "s" : ""}
                {s.subjects_taught?.length > 0 && (
                  <span className="text-slate-400"> · {s.subjects_taught.map((subj) => subj.name).join(", ")}</span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/teacher/classes/${s.section_id}`)}
                  className="flex-1 flex items-center justify-center gap-1 text-xs font-medium border border-slate-200 rounded-lg py-2 text-slate-700 hover:bg-slate-50"
                >
                  View Roster <ChevronRight size={12} />
                </button>
                <button
                  onClick={() => router.push(`/teacher/attendance/mark?section_id=${s.section_id}&period_number=0`)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2"
                >
                  <ClipboardCheck size={13} /> Attendance
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
