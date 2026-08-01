"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus, CheckCircle2, Circle, X } from "lucide-react";
import { apiRequest, isLoggedIn } from "../../../lib/api";

export default function TeacherHomeworkPage() {
  const router = useRouter();
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [homework, setHomework] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    (async () => {
      try {
        const me = await apiRequest("/auth/me");
        const mySections = await apiRequest("/my-sections");
        setSections(mySections);
        if (mySections.length > 0) {
          setSelectedSectionId(mySections[0].section_id);
          await loadHomework(me.school_id, mySections[0].section_id);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function loadHomework(schoolId, sectionId) {
    const me = await apiRequest("/auth/me");
    const data = await apiRequest(`/homework/?school_id=${schoolId || me.school_id}&section_id=${sectionId}`);
    setHomework(data);
  }

  async function selectSection(sectionId) {
    setSelectedSectionId(sectionId);
    setShowForm(false);
    setExpandedId(null);
    const me = await apiRequest("/auth/me");
    await loadHomework(me.school_id, sectionId);
  }

  const currentSection = sections.find((s) => s.section_id === selectedSectionId);

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiRequest("/homework/", {
        method: "POST",
        body: { section_id: Number(selectedSectionId), subject_id: Number(subjectId), title, description: description || null, due_date: dueDate },
      });
      setTitle(""); setDescription(""); setDueDate(""); setSubjectId("");
      setShowForm(false);
      const me = await apiRequest("/auth/me");
      await loadHomework(me.school_id, selectedSectionId);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleExpand(hw) {
    if (expandedId === hw.id) { setExpandedId(null); return; }
    setExpandedId(hw.id);
    const data = await apiRequest(`/homework/${hw.id}/submissions`);
    setSubmissions(data);
  }

  async function toggleSubmission(hwId, studentId, currentStatus) {
    const newStatus = currentStatus === "submitted" ? "not_submitted" : "submitted";
    await apiRequest(`/homework/${hwId}/submissions`, {
      method: "POST",
      body: { student_ids: [studentId], status: newStatus },
    });
    const data = await apiRequest(`/homework/${hwId}/submissions`);
    setSubmissions(data);
    const me = await apiRequest("/auth/me");
    await loadHomework(me.school_id, selectedSectionId);
  }

  if (loading) return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 text-sm text-slate-600">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900">Homework & Assignments</h2>
        {currentSection && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-brand-600 hover:bg-brand-700 text-white text-xs sm:text-sm font-medium rounded-lg px-3 sm:px-4 py-2 flex items-center gap-1.5"
          >
            {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? "Cancel" : "Assign"}
          </button>
        )}
      </div>
      <p className="text-sm text-slate-600 mb-5">Track what's been assigned and who's submitted.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {sections.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-sm text-slate-500">No classes assigned yet.</p>
        </div>
      ) : (
        <>
          {/* Section chips — scoped to only this teacher's classes, no school-wide picker */}
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            {sections.map((s) => (
              <button
                key={s.section_id}
                onClick={() => selectSection(s.section_id)}
                className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  selectedSectionId === s.section_id
                    ? "bg-brand-600 border-brand-600 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {s.section_name}
              </button>
            ))}
          </div>

          {showForm && currentSection && (
            <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-5 mb-5 space-y-3">
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">Select subject</option>
                {currentSection.subjects_taught?.map((subj) => <option key={subj.id} value={subj.id}>{subj.name}</option>)}
              </select>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Chapter 5 exercises)" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <button type="submit" disabled={saving} className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2.5">
                {saving ? "Assigning..." : "Assign Homework"}
              </button>
            </form>
          )}

          {homework.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
              <ClipboardList size={20} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-600">No homework assigned yet for this class.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {homework.map((hw) => (
                <div key={hw.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <button onClick={() => toggleExpand(hw)} className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{hw.title}</p>
                      <p className="text-xs text-slate-500">{hw.subject_name} · Due {hw.due_date}</p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 shrink-0 ml-2">
                      {hw.submitted_count}/{hw.total_students}
                    </span>
                  </button>
                  {expandedId === hw.id && (
                    <div className="border-t border-slate-100 divide-y divide-slate-100">
                      {submissions.map((s) => (
                        <button
                          key={s.student_id}
                          onClick={() => toggleSubmission(hw.id, s.student_id, s.status)}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 text-left"
                        >
                          <span className="text-sm text-slate-700">{s.student_name}</span>
                          {s.status === "submitted" ? (
                            <span className="text-xs font-medium text-brand-700 flex items-center gap-1"><CheckCircle2 size={13} /> Submitted</span>
                          ) : (
                            <span className="text-xs font-medium text-slate-400 flex items-center gap-1"><Circle size={13} /> Not submitted</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
