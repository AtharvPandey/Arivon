"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { apiRequest, isLoggedIn } from "../../../../lib/api";

export default function TeacherClassRosterPage() {
  const router = useRouter();
  const params = useParams();
  const sectionId = params.sectionId;

  const [students, setStudents] = useState([]);
  const [sectionInfo, setSectionInfo] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    (async () => {
      try {
        const me = await apiRequest("/auth/me");
        const [mySections, allStudents] = await Promise.all([
          apiRequest("/my-sections"),
          apiRequest(`/students/?school_id=${me.school_id}&section_id=${sectionId}`),
        ]);
        const thisSection = mySections.find((s) => String(s.section_id) === String(sectionId));
        setSectionInfo(thisSection || null);
        setStudents(allStudents);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [sectionId]);

  if (loading) return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 text-sm text-slate-600">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <button
        onClick={() => router.push("/teacher/classes")}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 mb-3"
      >
        <ArrowLeft size={13} /> My Classes
      </button>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-display font-bold text-slate-900">{sectionInfo?.section_name || "Class"}</h2>
          <p className="text-sm text-slate-600">{students.length} students</p>
        </div>
        <button
          onClick={() => router.push(`/teacher/attendance/mark?section_id=${sectionId}&period_number=0`)}
          className="flex items-center gap-1.5 text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-3 py-2"
        >
          <ClipboardCheck size={13} /> Attendance
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
        {students.length === 0 ? (
          <p className="text-sm text-slate-500 p-6 text-center">No students in this class yet.</p>
        ) : students.map((s) => (
          <button
            key={s.id}
            onClick={() => router.push(`/teacher/students/${s.id}`)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-semibold text-xs shrink-0">
              {s.full_name?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{s.full_name}</p>
              <p className="text-xs text-slate-500">{s.admission_number}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
