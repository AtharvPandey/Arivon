"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Plus, ChevronRight } from "lucide-react";
import { apiRequest, isLoggedIn } from "../lib/api";

const STATUS_STYLES = {
  draft: "bg-slate-100 text-slate-600",
  scheduled: "bg-sky-100 text-sky-700",
  ongoing: "bg-amber-100 text-amber-700",
  completed: "bg-teal-100 text-teal-700",
  results_published: "bg-brand-100 text-brand-700",
};

export default function ExaminationsListView({ rolePrefix = "/admin" }) {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState(null);
  const [academicYearId, setAcademicYearId] = useState(null);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [examName, setExamName] = useState("");
  const [examType, setExamType] = useState("marks_based");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/");
      return;
    }
    (async () => {
      try {
        const me = await apiRequest("/auth/me");
        setSchoolId(me.school_id);
        const years = await apiRequest(`/academic-years/?school_id=${me.school_id}`);
        const current = years.find((y) => y.is_current) || years[0];
        setAcademicYearId(current?.id);
        const examList = await apiRequest(`/exams/?school_id=${me.school_id}`);
        setExams(examList);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const exam = await apiRequest("/exams/", {
        method: "POST",
        body: { academic_year_id: academicYearId, name: examName, exam_type: examType },
      });
      router.push(`${rolePrefix}/academics/examinations/${exam.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-display font-bold text-slate-900">Examinations</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg px-4 py-2 flex items-center gap-1.5"
        >
          <Plus size={15} /> Create Exam
        </button>
      </div>
      <p className="text-sm text-slate-600 mb-6">Exam setup, marks entry, results, and report cards.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-5 mb-6 space-y-3">
          <input
            value={examName} onChange={(e) => setExamName(e.target.value)}
            placeholder="Exam name (e.g. Unit Test 1, Half Yearly, Annual Exam)" required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <select value={examType} onChange={(e) => setExamType(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="marks_based">Marks-based (numeric marks entered per subject)</option>
            <option value="grade_based">Grade-based (a grade entered directly, no marks)</option>
          </select>
          <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2">
            {saving ? "Creating..." : "Create Exam"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-600">Loading...</p>
      ) : exams.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <GraduationCap size={20} className="text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-600">No exams created yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {exams.map((exam) => (
            <button
              key={exam.id}
              onClick={() => router.push(`${rolePrefix}/academics/examinations/${exam.id}`)}
              className="w-full bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm rounded-xl p-4 flex items-center justify-between transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <GraduationCap size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{exam.name}</p>
                  <p className="text-xs text-slate-500 capitalize">{exam.exam_type.replace("_", "-")}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[exam.status]}`}>
                  {exam.status.replace(/_/g, " ")}
                </span>
                <ChevronRight size={16} className="text-slate-400" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
