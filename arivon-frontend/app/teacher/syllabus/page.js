"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookMarked, Check, Circle } from "lucide-react";
import { apiRequest, isLoggedIn } from "../../../lib/api";

export default function TeacherSyllabusPage() {
  const router = useRouter();
  const [combos, setCombos] = useState([]); // distinct {class_id, class_name, subject_id, subject_name}
  const [selected, setSelected] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    (async () => {
      try {
        const me = await apiRequest("/auth/me");
        const mySections = await apiRequest("/my-sections");

        // Build distinct (class, subject) combos across every section —
        // a teacher can teach the same subject to multiple sections of
        // one class (syllabus is class-wide, not section-specific).
        const seen = new Set();
        const list = [];
        mySections.forEach((s) => {
          s.subjects_taught?.forEach((subj) => {
            const key = `${s.school_class_id}-${subj.id}`;
            if (!seen.has(key)) {
              seen.add(key);
              list.push({
                school_class_id: s.school_class_id, class_name: s.school_class_name,
                subject_id: subj.id, subject_name: subj.name,
              });
            }
          });
        });
        setCombos(list);
        if (list.length > 0) {
          setSelected(list[0]);
          await loadProgress(me.school_id, list[0]);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function loadProgress(schoolId, combo) {
    const data = await apiRequest(`/syllabus/progress?school_id=${schoolId}&school_class_id=${combo.school_class_id}&subject_id=${combo.subject_id}`);
    setProgress(data[0] || null);
  }

  async function selectCombo(combo) {
    setSelected(combo);
    const me = await apiRequest("/auth/me");
    await loadProgress(me.school_id, combo);
  }

  async function toggleChapter(chapterId) {
    await apiRequest(`/syllabus/chapters/${chapterId}/toggle`, { method: "PATCH" });
    const me = await apiRequest("/auth/me");
    await loadProgress(me.school_id, selected);
  }

  if (loading) return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 text-sm text-slate-600">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 mb-1">Syllabus Tracking</h2>
      <p className="text-sm text-slate-600 mb-5">Mark chapters as you teach them.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {combos.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-sm text-slate-500">No subjects assigned to you yet.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            {combos.map((combo) => {
              const key = `${combo.school_class_id}-${combo.subject_id}`;
              const isSelected = selected && selected.school_class_id === combo.school_class_id && selected.subject_id === combo.subject_id;
              return (
                <button
                  key={key}
                  onClick={() => selectCombo(combo)}
                  className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    isSelected ? "bg-brand-600 border-brand-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {combo.class_name} · {combo.subject_name}
                </button>
              );
            })}
          </div>

          {!progress || progress.total_chapters === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
              <BookMarked size={20} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-600">No chapters set up yet for this subject.</p>
              <p className="text-xs text-slate-400 mt-1">Your Academic Coordinator sets up the chapter list.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-800">{progress.completed_chapters}/{progress.total_chapters} chapters completed</p>
                <p className="text-sm font-bold text-brand-700">{progress.completion_pct}%</p>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-5">
                <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${progress.completion_pct}%` }} />
              </div>

              <div className="space-y-1.5">
                {progress.chapters.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => toggleChapter(ch.id)}
                    className="w-full flex items-center gap-3 border border-slate-100 rounded-lg px-3 py-2.5 hover:border-slate-200 transition-colors text-left"
                  >
                    {ch.is_completed ? (
                      <div className="w-6 h-6 rounded-md bg-brand-600 flex items-center justify-center shrink-0">
                        <Check size={13} className="text-white" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-md border-2 border-slate-200 flex items-center justify-center shrink-0" />
                    )}
                    <span className={`text-sm ${ch.is_completed ? "text-slate-400 line-through" : "text-slate-800"}`}>
                      {ch.chapter_name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
