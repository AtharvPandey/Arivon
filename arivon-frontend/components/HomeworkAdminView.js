"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus, CheckCircle2, Circle } from "lucide-react";
import { apiRequest, isLoggedIn } from "../lib/api";
import ClassSelect from "./ClassSelect";

export default function HomeworkAdminView() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState(null);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState("");
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
        await loadHomework(me.school_id, null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedClassId) { setSections([]); setSelectedSectionId(""); return; }
    apiRequest(`/classes/${selectedClassId}/sections`).then(setSections);
  }, [selectedClassId]);

  useEffect(() => {
    if (schoolId) loadHomework(schoolId, selectedSectionId || null);
  }, [selectedSectionId]);

  async function loadHomework(sid, sectionId) {
    const params = new URLSearchParams({ school_id: sid });
    if (sectionId) params.set("section_id", sectionId);
    const data = await apiRequest(`/homework/?${params.toString()}`);
    setHomework(data);
  }

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
      await loadHomework(schoolId, selectedSectionId || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleExpand(hw) {
    if (expandedId === hw.id) {
      setExpandedId(null);
      return;
    }
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
    await loadHomework(schoolId, selectedSectionId || null);
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-display font-bold text-slate-900">Homework & Assignments</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          disabled={!selectedSectionId}
          className="bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2 flex items-center gap-1.5"
        >
          <Plus size={15} /> Assign Homework
        </button>
      </div>
      <p className="text-sm text-slate-600 mb-6">Track what's been assigned and who's submitted — pick a section to get started.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="grid grid-cols-2 gap-3 mb-6 max-w-md">
        <ClassSelect classes={classes} value={selectedClassId} onChange={setSelectedClassId} placeholder="Any class" />
        <select value={selectedSectionId} onChange={(e) => setSelectedSectionId(e.target.value)} disabled={!selectedClassId} className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50">
          <option value="">Any section</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {showForm && selectedSectionId && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-5 mb-6 space-y-3">
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">Select subject</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Chapter 5 exercises)" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <button type="submit" disabled={saving} className="bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2">
            {saving ? "Assigning..." : "Assign Homework"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-600">Loading...</p>
      ) : homework.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <ClipboardList size={20} className="text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-600">No homework assigned yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {homework.map((hw) => (
            <div key={hw.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <button onClick={() => toggleExpand(hw)} className="w-full text-left p-4 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{hw.title}</p>
                  <p className="text-xs text-slate-500">{hw.subject_name} · Due {hw.due_date}</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-50 text-violet-700">
                  {hw.submitted_count}/{hw.total_students} submitted
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
    </div>
  );
}
