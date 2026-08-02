"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookMarked, Plus, CheckCircle2, Circle } from "lucide-react";
import { apiRequest, isLoggedIn } from "../lib/api";
import ClassSelect from "./ClassSelect";

export default function SyllabusAdminView() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState(null);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [progress, setProgress] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [chapterName, setChapterName] = useState("");
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
        const [classList, subjectList] = await Promise.all([
          apiRequest(`/classes/?school_id=${me.school_id}`),
          apiRequest(`/subjects?school_id=${me.school_id}`),
        ]);
        setClasses(classList);
        setSubjects(subjectList);
        await loadProgress(me.school_id, null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (schoolId) loadProgress(schoolId, selectedClassId || null);
  }, [selectedClassId]);

  async function loadProgress(sid, classId) {
    const params = new URLSearchParams({ school_id: sid });
    if (classId) params.set("school_class_id", classId);
    const data = await apiRequest(`/syllabus/progress?${params.toString()}`);
    setProgress(data);
  }

  async function handleAddChapter(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiRequest("/syllabus/chapters", {
        method: "POST",
        body: { school_class_id: Number(selectedClassId), subject_id: Number(subjectId), chapter_name: chapterName },
      });
      setChapterName(""); setSubjectId("");
      setShowForm(false);
      await loadProgress(schoolId, selectedClassId || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(chapterId) {
    try {
      await apiRequest(`/syllabus/chapters/${chapterId}/toggle`, { method: "PATCH" });
      await loadProgress(schoolId, selectedClassId || null);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-display font-bold text-slate-900">Syllabus Tracking</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          disabled={!selectedClassId}
          className="bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2 flex items-center gap-1.5"
        >
          <Plus size={15} /> Add Chapter
        </button>
      </div>
      <p className="text-sm text-slate-600 mb-6">Chapter-wise completion, by subject and class — visibility for you, marked as it's taught.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="mb-6 max-w-xs">
        <ClassSelect classes={classes} value={selectedClassId} onChange={setSelectedClassId} placeholder="Select a class" />
      </div>

      {showForm && selectedClassId && (
        <form onSubmit={handleAddChapter} className="bg-white border border-slate-200 rounded-xl p-5 mb-6 space-y-3">
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">Select subject</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input value={chapterName} onChange={(e) => setChapterName(e.target.value)} placeholder="Chapter name" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <button type="submit" disabled={saving} className="bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2">
            {saving ? "Adding..." : "Add Chapter"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-600">Loading...</p>
      ) : progress.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <BookMarked size={20} className="text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-600">{selectedClassId ? "No chapters added for this class yet." : "Select a class to see syllabus progress."}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {progress.map((subj) => (
            <div key={`${subj.school_class_id}-${subj.subject_id}`} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">{subj.subject_name} · {subj.class_name}</p>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500" style={{ width: `${subj.completion_pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-sky-700">{subj.completion_pct}%</span>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {subj.chapters.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => handleToggle(ch.id)}
                    className="w-full flex items-center gap-2.5 px-5 py-2.5 hover:bg-slate-50 text-left"
                  >
                    {ch.is_completed ? (
                      <CheckCircle2 size={16} className="text-sky-600 shrink-0" />
                    ) : (
                      <Circle size={16} className="text-slate-300 shrink-0" />
                    )}
                    <span className={`text-sm ${ch.is_completed ? "text-slate-500 line-through" : "text-slate-800"}`}>{ch.chapter_name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
