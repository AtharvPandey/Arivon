"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, X, Clock3, FileQuestion, CheckCheck } from "lucide-react";
import { apiRequest, isLoggedIn } from "../../../../lib/api";

const STATUS_CONFIG = {
  present: { label: "Present", icon: Check, activeClass: "bg-brand-600 text-white border-brand-600" },
  absent: { label: "Absent", icon: X, activeClass: "bg-rose-600 text-white border-rose-600" },
  late: { label: "Late", icon: Clock3, activeClass: "bg-amber-500 text-white border-amber-500" },
  excused: { label: "Excused", icon: FileQuestion, activeClass: "bg-slate-500 text-white border-slate-500" },
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function MarkAttendanceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sectionId = searchParams.get("section_id");
  const periodNumber = searchParams.get("period_number") || "0";
  const date = searchParams.get("date") || todayISO();

  const [sectionName, setSectionName] = useState("");
  const [students, setStudents] = useState([]);
  const [statuses, setStatuses] = useState({}); // student_id -> status
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    if (!sectionId) { setError("No class specified."); setLoading(false); return; }
    (async () => {
      try {
        const me = await apiRequest("/auth/me");
        const [mySections, studentList, existing] = await Promise.all([
          apiRequest("/my-sections"),
          apiRequest(`/students/?school_id=${me.school_id}&section_id=${sectionId}`),
          apiRequest(`/attendance/?section_id=${sectionId}&date=${date}&period_number=${periodNumber}`),
        ]);
        const thisSection = mySections.find((s) => String(s.section_id) === String(sectionId));
        setSectionName(thisSection?.section_name || "Class");
        setStudents(studentList);

        // Default everyone to present, then apply any already-marked
        // statuses on top — matches how most classes actually go, and
        // means a teacher with no absentees can submit in one tap.
        const initial = {};
        studentList.forEach((s) => { initial[s.id] = "present"; });
        existing.forEach((record) => { initial[record.student_id] = record.status; });
        setStatuses(initial);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [sectionId, periodNumber, date]);

  function setStudentStatus(studentId, status) {
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
  }

  function markAllPresent() {
    const allPresent = {};
    students.forEach((s) => { allPresent[s.id] = "present"; });
    setStatuses(allPresent);
  }

  async function handleSubmit() {
    setSaving(true);
    setError("");
    try {
      await apiRequest("/attendance/mark", {
        method: "POST",
        body: {
          section_id: Number(sectionId),
          date,
          period_number: Number(periodNumber),
          entries: students.map((s) => ({ student_id: s.id, status: statuses[s.id] || "present" })),
        },
      });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 text-sm text-slate-600">Loading...</div>;

  if (saved) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 text-center">
        <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mx-auto mb-4">
          <CheckCheck size={26} />
        </div>
        <h3 className="text-lg font-display font-bold text-slate-900 mb-1">Attendance saved</h3>
        <p className="text-sm text-slate-600 mb-6">{sectionName} · {date}</p>
        <button
          onClick={() => router.push("/teacher/dashboard")}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg px-5 py-2.5"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const presentCount = Object.values(statuses).filter((s) => s === "present").length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-28">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 mb-3"
      >
        <ArrowLeft size={13} /> Back
      </button>

      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-display font-bold text-slate-900">{sectionName}</h2>
        <button onClick={markAllPresent} className="text-xs font-medium text-brand-700 hover:underline">
          Mark all present
        </button>
      </div>
      <p className="text-sm text-slate-600 mb-5">
        {date} · {presentCount}/{students.length} present
      </p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="space-y-2 mb-6">
        {students.map((s) => {
          const current = statuses[s.id] || "present";
          return (
            <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-semibold text-xs shrink-0">
                {s.full_name?.charAt(0)}
              </div>
              <p className="flex-1 min-w-0 text-sm font-medium text-slate-900 truncate">{s.full_name}</p>
              <div className="flex gap-1 shrink-0">
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => setStudentStatus(s.id, key)}
                    title={config.label}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${
                      current === key ? config.activeClass : "bg-white border-slate-200 text-slate-300"
                    }`}
                  >
                    <config.icon size={14} />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-16 md:bottom-4 inset-x-0 px-4">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl py-3 shadow-lg"
          >
            {saving ? "Saving..." : "Save Attendance"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MarkAttendancePage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 text-sm text-slate-600">Loading...</div>}>
      <MarkAttendanceContent />
    </Suspense>
  );
}
