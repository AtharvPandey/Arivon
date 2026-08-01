"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, ArrowLeft, Lock } from "lucide-react";
import { apiRequest, isLoggedIn } from "../../../lib/api";

export default function TeacherExamsPage() {
  const router = useRouter();
  const [sections, setSections] = useState([]);
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [myEntries, setMyEntries] = useState([]); // schedule entries + which of my sections they apply to
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Marks entry state
  const [activeEntry, setActiveEntry] = useState(null); // { schedule, section }
  const [marks, setMarks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    (async () => {
      try {
        const me = await apiRequest("/auth/me");
        const [mySections, examList] = await Promise.all([
          apiRequest("/my-sections"),
          apiRequest(`/exams/?school_id=${me.school_id}`),
        ]);
        setSections(mySections);
        setExams(examList);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function selectExam(exam) {
    setSelectedExam(exam);
    setActiveEntry(null);
    setError("");
    try {
      const schedule = await apiRequest(`/exams/${exam.id}/schedule`);
      // Only keep schedule entries matching a subject this teacher
      // actually teaches, paired with each of their sections in that
      // class (a teacher with 2 sections of the same class+subject
      // needs to enter marks for each section separately).
      const entries = [];
      schedule.forEach((sched) => {
        sections.forEach((sec) => {
          if (sec.school_class_id === sched.school_class_id) {
            const teachesThisSubject = sec.subjects_taught?.some((s) => s.id === sched.subject_id);
            if (teachesThisSubject) {
              entries.push({ schedule: sched, section: sec });
            }
          }
        });
      });
      setMyEntries(entries);
    } catch (err) {
      setError(err.message);
    }
  }

  async function openEntry(entry) {
    setActiveEntry(entry);
    setSaved(false);
    setError("");
    try {
      const data = await apiRequest(`/exams/schedule/${entry.schedule.id}/marks?section_id=${entry.section.section_id}`);
      setMarks(data);
    } catch (err) {
      setError(err.message);
    }
  }

  function updateMark(studentId, field, value) {
    setMarks((prev) => prev.map((m) => (m.student_id === studentId ? { ...m, [field]: value } : m)));
  }

  async function handleSaveMarks() {
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/exams/schedule/${activeEntry.schedule.id}/marks?section_id=${activeEntry.section.section_id}`, {
        method: "POST",
        body: {
          entries: marks.map((m) => ({
            student_id: m.student_id,
            marks_obtained: m.is_absent ? null : (m.marks_obtained === "" ? null : Number(m.marks_obtained)),
            grade: m.grade || null,
            is_absent: m.is_absent,
          })),
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

  // === Marks entry screen ===
  if (activeEntry) {
    const anyLocked = marks.some((m) => m.is_locked);
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24">
        <button onClick={() => setActiveEntry(null)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 mb-3">
          <ArrowLeft size={13} /> Back
        </button>
        <h2 className="text-xl font-display font-bold text-slate-900 mb-1">
          {activeEntry.schedule.subject_name} · {activeEntry.section.section_name}
        </h2>
        <p className="text-sm text-slate-600 mb-5">
          Max marks: {activeEntry.schedule.max_marks ?? "—"} {anyLocked && <span className="text-amber-600">· Some entries are locked</span>}
        </p>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}
        {saved && <p className="text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2 mb-4">Marks saved.</p>}

        <div className="space-y-2 mb-6">
          {marks.map((m) => (
            <div key={m.student_id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
              <p className="flex-1 min-w-0 text-sm font-medium text-slate-900 truncate">{m.student_name}</p>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 shrink-0">
                <input
                  type="checkbox"
                  checked={m.is_absent}
                  disabled={m.is_locked}
                  onChange={(e) => updateMark(m.student_id, "is_absent", e.target.checked)}
                  className="rounded"
                />
                Absent
              </label>
              <input
                type="number"
                value={m.is_absent ? "" : (m.marks_obtained ?? "")}
                disabled={m.is_absent || m.is_locked}
                onChange={(e) => updateMark(m.student_id, "marks_obtained", e.target.value)}
                placeholder="Marks"
                className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-center disabled:bg-slate-50 shrink-0"
              />
              {m.is_locked && <Lock size={13} className="text-slate-300 shrink-0" />}
            </div>
          ))}
        </div>

        <div className="fixed bottom-16 md:bottom-4 inset-x-0 px-4">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <button
              onClick={handleSaveMarks}
              disabled={saving}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl py-3 shadow-lg"
            >
              {saving ? "Saving..." : "Save Marks"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // === Exam schedule list (after picking an exam) ===
  if (selectedExam) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <button onClick={() => setSelectedExam(null)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 mb-3">
          <ArrowLeft size={13} /> All Exams
        </button>
        <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 mb-1">{selectedExam.name}</h2>
        <p className="text-sm text-slate-600 mb-5">Your subjects for this exam.</p>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

        {myEntries.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <p className="text-sm text-slate-500">No schedule entries for your subjects in this exam yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {myEntries.map((entry, i) => (
              <button
                key={i}
                onClick={() => openEntry(entry)}
                className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-slate-300 hover:shadow-sm transition-all"
              >
                <p className="text-sm font-semibold text-slate-900">{entry.schedule.subject_name}</p>
                <p className="text-xs text-slate-500">{entry.section.section_name} · {entry.schedule.exam_date}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // === Exam list ===
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 mb-1">Examinations</h2>
      <p className="text-sm text-slate-600 mb-5">Pick an exam to enter marks for your subjects.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {exams.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <FileCheck2 size={20} className="text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-600">No exams scheduled yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {exams.map((exam) => (
            <button
              key={exam.id}
              onClick={() => selectExam(exam)}
              className="bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-slate-300 hover:shadow-sm transition-all"
            >
              <p className="text-sm font-semibold text-slate-900">{exam.name}</p>
              <p className="text-xs text-slate-500 capitalize">{exam.exam_type} · {exam.status}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
