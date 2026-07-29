"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, CalendarClock, PenLine, Trophy, BarChart3, ClipboardCheck, FileText,
  Lock, Unlock, Plus, Download, CheckCircle2, Circle, Trash2,
} from "lucide-react";
import { apiRequest, isLoggedIn, downloadAuthenticatedFile } from "../../../../../lib/api";
import ClassSelect from "../../../../../components/ClassSelect";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TABS = [
  { key: "schedule", label: "Schedule", icon: CalendarClock, color: "indigo" },
  { key: "marks", label: "Marks Entry", icon: PenLine, color: "amber" },
  { key: "results", label: "Results", icon: Trophy, color: "teal" },
  { key: "analysis", label: "Analysis", icon: BarChart3, color: "violet" },
  { key: "promotion", label: "Promotion List", icon: ClipboardCheck, color: "rose" },
  { key: "reportcards", label: "Report Cards", icon: FileText, color: "sky" },
];

const TAB_COLOR_CLASSES = {
  indigo: "border-indigo-600 text-indigo-700",
  amber: "border-amber-600 text-amber-700",
  teal: "border-teal-600 text-teal-700",
  violet: "border-violet-600 text-violet-700",
  rose: "border-rose-600 text-rose-700",
  sky: "border-sky-600 text-sky-700",
};

const STATUS_STYLES = {
  pass: "bg-brand-100 text-brand-700",
  grace_zone: "bg-amber-100 text-amber-700",
  detained: "bg-rose-100 text-rose-700",
};

export default function ExamDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [exam, setExam] = useState(null);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [activeTab, setActiveTab] = useState("schedule");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState("");

  // Schedule tab
  const [schedule, setSchedule] = useState([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [schedSubjectId, setSchedSubjectId] = useState("");
  const [schedDate, setSchedDate] = useState("");
  const [schedStart, setSchedStart] = useState("09:00");
  const [schedEnd, setSchedEnd] = useState("10:30");
  const [schedRoom, setSchedRoom] = useState("");
  const [schedMax, setSchedMax] = useState(100);
  const [schedPassing, setSchedPassing] = useState(33);

  // Marks entry tab
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [marksRows, setMarksRows] = useState([]);
  const [marksSaving, setMarksSaving] = useState(false);
  const [marksMessage, setMarksMessage] = useState("");

  // Results / Analysis / Promotion / Report Cards
  const [results, setResults] = useState([]);
  const [analysis, setAnalysis] = useState([]);
  const [promotionList, setPromotionList] = useState([]);
  const [signatures, setSignatures] = useState({});
  const [generatingFor, setGeneratingFor] = useState(null);
  const [reportLinks, setReportLinks] = useState({});

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/");
      return;
    }
    (async () => {
      try {
        const examData = await apiRequest(`/exams/${params.id}`);
        setExam(examData);
        const [classList, subjectList] = await Promise.all([
          apiRequest(`/classes/?school_id=${examData.school_id}`),
          apiRequest(`/subjects?school_id=${examData.school_id}`),
        ]);
        setClasses(classList);
        setSubjects(subjectList);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id]);

  useEffect(() => {
    if (!selectedClassId) { setSections([]); setSelectedSectionId(""); return; }
    apiRequest(`/classes/${selectedClassId}/sections`).then(setSections);
    apiRequest(`/exams/${params.id}/schedule?school_class_id=${selectedClassId}`).then(setSchedule);
  }, [selectedClassId]);

  useEffect(() => {
    if (activeTab === "results" && selectedSectionId) loadResults();
    if (activeTab === "promotion" && selectedSectionId) loadPromotion();
    if (activeTab === "reportcards" && selectedSectionId) loadSignaturesAndResults();
    if (activeTab === "analysis" && selectedClassId) loadAnalysis();
  }, [activeTab, selectedSectionId, selectedClassId]);

  async function loadResults() {
    setError("");
    try {
      const data = await apiRequest(`/exams/${params.id}/results?section_id=${selectedSectionId}`);
      setResults(data);
    } catch (err) { setError(err.message); }
  }

  async function loadPromotion() {
    setError("");
    try {
      const data = await apiRequest(`/exams/${params.id}/promotion-list?section_id=${selectedSectionId}`);
      setPromotionList(data);
    } catch (err) { setError(err.message); }
  }

  async function loadAnalysis() {
    setError("");
    try {
      const data = await apiRequest(`/exams/${params.id}/analysis?school_class_id=${selectedClassId}`);
      setAnalysis(data);
    } catch (err) { setError(err.message); }
  }

  async function loadSignaturesAndResults() {
    setError("");
    try {
      const [res, sigs] = await Promise.all([
        apiRequest(`/exams/${params.id}/results?section_id=${selectedSectionId}`),
        apiRequest(`/exams/${params.id}/signatures?section_id=${selectedSectionId}`),
      ]);
      setResults(res);
      setSignatures(sigs);
    } catch (err) { setError(err.message); }
  }

  async function handleAddSchedule(e) {
    e.preventDefault();
    setError("");
    try {
      await apiRequest(`/exams/${params.id}/schedule`, {
        method: "POST",
        body: {
          school_class_id: Number(selectedClassId), subject_id: Number(schedSubjectId),
          exam_date: schedDate, start_time: schedStart, end_time: schedEnd,
          room: schedRoom || null, max_marks: Number(schedMax), passing_marks: Number(schedPassing),
        },
      });
      setSchedSubjectId(""); setSchedDate(""); setSchedRoom("");
      setShowScheduleForm(false);
      const updated = await apiRequest(`/exams/${params.id}/schedule?school_class_id=${selectedClassId}`);
      setSchedule(updated);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteSchedule(scheduleId) {
    try {
      await apiRequest(`/exams/schedule/${scheduleId}`, { method: "DELETE" });
      const updated = await apiRequest(`/exams/${params.id}/schedule?school_class_id=${selectedClassId}`);
      setSchedule(updated);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadMarksEntry(scheduleId) {
    setSelectedScheduleId(scheduleId);
    setMarksMessage("");
    try {
      const data = await apiRequest(`/exams/schedule/${scheduleId}/marks?section_id=${selectedSectionId}`);
      setMarksRows(data);
    } catch (err) {
      setError(err.message);
    }
  }

  function updateMarksRow(studentId, field, value) {
    setMarksRows((prev) => prev.map((r) => r.student_id === studentId ? { ...r, [field]: value } : r));
  }

  async function handleSaveMarks() {
    setMarksSaving(true);
    setMarksMessage("");
    try {
      const entries = marksRows.map((r) => ({
        student_id: r.student_id,
        marks_obtained: r.is_absent ? null : (r.marks_obtained === "" || r.marks_obtained === null ? null : Number(r.marks_obtained)),
        grade: r.grade || null,
        is_absent: r.is_absent,
      }));
      const updated = await apiRequest(`/exams/schedule/${selectedScheduleId}/marks?section_id=${selectedSectionId}`, {
        method: "POST", body: { entries },
      });
      setMarksRows(updated);
      setMarksMessage("Marks saved.");
    } catch (err) {
      setMarksMessage(err.message);
    } finally {
      setMarksSaving(false);
    }
  }

  async function handleLockToggle(lock) {
    const currentSchedule = schedule.find((s) => s.id === Number(selectedScheduleId));
    if (!currentSchedule) return;
    try {
      await apiRequest(`/exams/${params.id}/marks/${lock ? "lock" : "unlock"}`, {
        method: "POST",
        body: { school_class_id: Number(selectedClassId), subject_id: currentSchedule.subject_id },
      });
      await loadMarksEntry(selectedScheduleId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerateReportCard(studentId) {
    setGeneratingFor(studentId);
    try {
      const result = await apiRequest(`/exams/${params.id}/report-card/${studentId}`, { method: "POST" });
      setReportLinks((prev) => ({ ...prev, [studentId]: result.download_url }));
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingFor(null);
    }
  }

  async function handleSignatureToggle(studentId, currentSigned) {
    try {
      await apiRequest(`/exams/${params.id}/signatures/${studentId}`, {
        method: "PATCH",
        body: { signed: !currentSigned, signed_date: !currentSigned ? new Date().toISOString().split("T")[0] : null },
      });
      const sigs = await apiRequest(`/exams/${params.id}/signatures?section_id=${selectedSectionId}`);
      setSignatures(sigs);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="max-w-5xl mx-auto px-6 py-8 text-sm text-slate-600">Loading...</div>;
  if (!exam) return null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <button onClick={() => router.push("/dashboard/academics/examinations")} className="text-sm text-slate-600 hover:text-slate-900 mb-4 flex items-center gap-1">
        <ArrowLeft size={14} /> Back to Examinations
      </button>

      <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">{exam.name}</h2>
      <p className="text-sm text-slate-600 mb-6 capitalize">{exam.exam_type.replace("_", "-")} · {exam.status.replace(/_/g, " ")}</p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="flex items-center gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              activeTab === tab.key ? TAB_COLOR_CLASSES[tab.color] : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-5">
        <ClassSelect classes={classes} value={selectedClassId} onChange={setSelectedClassId} placeholder="Select a class" />
      </div>

      {/* ---------- Schedule Tab ---------- */}
      {activeTab === "schedule" && selectedClassId && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-700">{schedule.length} paper(s) scheduled</p>
            <button onClick={() => setShowScheduleForm(!showScheduleForm)} className="text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1.5 flex items-center gap-1">
              <Plus size={12} /> Add Paper
            </button>
          </div>

          {showScheduleForm && (
            <form onSubmit={handleAddSchedule} className="bg-white border border-slate-200 rounded-xl p-4 mb-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
              <select value={schedSubjectId} onChange={(e) => setSchedSubjectId(e.target.value)} required className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
                <option value="">Subject</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} required className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
              <input placeholder="Room (optional)" value={schedRoom} onChange={(e) => setSchedRoom(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
              <input type="time" value={schedStart} onChange={(e) => setSchedStart(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
              <input type="time" value={schedEnd} onChange={(e) => setSchedEnd(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
              <div className="flex gap-1">
                <input type="number" value={schedMax} onChange={(e) => setSchedMax(e.target.value)} placeholder="Max" className="w-1/2 rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                <input type="number" value={schedPassing} onChange={(e) => setSchedPassing(e.target.value)} placeholder="Pass" className="w-1/2 rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
              </div>
              <button type="submit" className="col-span-2 sm:col-span-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg py-1.5">Add Paper</button>
            </form>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
            {schedule.map((s) => (
              <div key={s.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{s.subject_name}</p>
                  <p className="text-xs text-slate-500">{s.exam_date} · {s.start_time}-{s.end_time} {s.room && `· ${s.room}`} · Max {s.max_marks} / Pass {s.passing_marks}</p>
                </div>
                <button onClick={() => handleDeleteSchedule(s.id)} className="text-rose-500 hover:text-rose-700">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {schedule.length === 0 && <p className="text-sm text-slate-500 p-6 text-center">No papers scheduled for this class yet.</p>}
          </div>
        </div>
      )}

      {/* ---------- Marks Entry Tab ---------- */}
      {activeTab === "marks" && selectedClassId && (
        <div>
          <div className="grid grid-cols-2 gap-3 mb-4 max-w-lg">
            <select value={selectedSectionId} onChange={(e) => setSelectedSectionId(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Select section</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={selectedScheduleId} onChange={(e) => loadMarksEntry(e.target.value)} disabled={!selectedSectionId} className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50">
              <option value="">Select subject paper</option>
              {schedule.map((s) => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
            </select>
          </div>

          {selectedScheduleId && marksRows.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">
                  {marksRows.some((r) => r.is_locked) ? "🔒 Locked" : "Unlocked"}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => handleLockToggle(true)} className="text-xs font-medium bg-slate-700 hover:bg-slate-800 text-white rounded-lg px-3 py-1.5 flex items-center gap-1">
                    <Lock size={11} /> Lock
                  </button>
                  <button onClick={() => handleLockToggle(false)} className="text-xs font-medium border border-slate-300 text-slate-700 rounded-lg px-3 py-1.5 flex items-center gap-1">
                    <Unlock size={11} /> Unlock
                  </button>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {marksRows.map((r) => (
                  <div key={r.student_id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-800 flex-1">{r.student_name}</span>
                    <label className="flex items-center gap-1 text-xs text-slate-500">
                      <input type="checkbox" checked={r.is_absent} disabled={r.is_locked} onChange={(e) => updateMarksRow(r.student_id, "is_absent", e.target.checked)} />
                      Absent
                    </label>
                    <input
                      type="number" value={r.marks_obtained ?? ""} disabled={r.is_absent || r.is_locked}
                      onChange={(e) => updateMarksRow(r.student_id, "marks_obtained", e.target.value)}
                      placeholder={`/ ${r.max_marks}`}
                      className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:bg-slate-50"
                    />
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-3">
                <button onClick={handleSaveMarks} disabled={marksSaving} className="bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-medium rounded-lg px-4 py-2">
                  {marksSaving ? "Saving..." : "Save Marks"}
                </button>
                {marksMessage && <p className="text-xs text-slate-600">{marksMessage}</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------- Results Tab ---------- */}
      {activeTab === "results" && selectedClassId && (
        <div>
          <select value={selectedSectionId} onChange={(e) => setSelectedSectionId(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm mb-4">
            <option value="">Select section</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {results.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-left">
                    <th className="px-4 py-2.5 font-medium text-slate-600">Rank</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600">Student</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600 text-center">Total</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600 text-center">%</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600 text-center">Grade</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600 text-center">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.student_id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2.5 font-semibold text-teal-700">#{r.rank}</td>
                      <td className="px-4 py-2.5 text-slate-900">{r.student_name}</td>
                      <td className="px-4 py-2.5 text-center">{r.total_obtained}/{r.total_max}</td>
                      <td className="px-4 py-2.5 text-center">{r.percentage}%</td>
                      <td className="px-4 py-2.5 text-center">{r.overall_grade}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.passed ? "bg-brand-100 text-brand-700" : "bg-rose-100 text-rose-700"}`}>
                          {r.passed ? "Pass" : "Fail"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------- Analysis Tab ---------- */}
      {activeTab === "analysis" && selectedClassId && (
        <div className="space-y-3">
          {analysis.map((a) => (
            <div key={a.subject_id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-900">{a.subject_name}</p>
                <span className="text-xs font-semibold text-violet-700">{a.pass_percentage}% passed</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-violet-500" style={{ width: `${a.pass_percentage}%` }} />
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs text-slate-500">
                <span>Appeared: <b className="text-slate-800">{a.students_appeared}</b></span>
                <span>Average: <b className="text-slate-800">{a.average_marks}</b></span>
                <span>Highest: <b className="text-slate-800">{a.highest_marks}</b></span>
                <span>Lowest: <b className="text-slate-800">{a.lowest_marks}</b></span>
              </div>
            </div>
          ))}
          {analysis.length === 0 && <p className="text-sm text-slate-500">No marks entered for this class yet.</p>}
        </div>
      )}

      {/* ---------- Promotion List Tab ---------- */}
      {activeTab === "promotion" && selectedClassId && (
        <div>
          <select value={selectedSectionId} onChange={(e) => setSelectedSectionId(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm mb-4">
            <option value="">Select section</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="space-y-2">
            {promotionList.map((p) => (
              <div key={p.student_id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{p.student_name}</p>
                  <p className="text-xs text-slate-500">{p.percentage}%{p.failed_subjects.length > 0 && ` · Failed: ${p.failed_subjects.join(", ")}`}</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[p.status]}`}>
                  {p.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------- Report Cards Tab ---------- */}
      {activeTab === "reportcards" && selectedClassId && (
        <div>
          <select value={selectedSectionId} onChange={(e) => setSelectedSectionId(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm mb-4">
            <option value="">Select section</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
            {results.map((r) => {
              const sig = signatures[String(r.student_id)];
              return (
                <div key={r.student_id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-800 flex-1">{r.student_name}</span>
                  {reportLinks[r.student_id] ? (
                    <button
                      onClick={() => downloadAuthenticatedFile(reportLinks[r.student_id], `ReportCard_${r.student_name.replace(/ /g, "_")}.pdf`)}
                      className="text-xs font-medium text-sky-700 underline flex items-center gap-1"
                    >
                      <Download size={12} /> Download
                    </button>
                  ) : (
                    <button onClick={() => handleGenerateReportCard(r.student_id)} disabled={generatingFor === r.student_id} className="text-xs font-medium bg-sky-600 hover:bg-sky-700 text-white rounded-lg px-3 py-1.5">
                      {generatingFor === r.student_id ? "Generating..." : "Generate"}
                    </button>
                  )}
                  <button
                    onClick={() => handleSignatureToggle(r.student_id, sig?.signed)}
                    className="flex items-center gap-1 text-xs font-medium text-slate-600"
                  >
                    {sig?.signed ? <CheckCircle2 size={14} className="text-brand-600" /> : <Circle size={14} className="text-slate-300" />}
                    Signed
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!selectedClassId && <p className="text-sm text-slate-500">Select a class above to get started.</p>}
    </div>
  );
}
