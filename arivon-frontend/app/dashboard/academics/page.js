"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, LayoutGrid, CalendarDays, Printer, Pencil, Check, X, Plus, Trash2, Clock3 } from "lucide-react";
import { apiRequest, isLoggedIn } from "../../../lib/api";
import ClassSelect from "../../../components/ClassSelect";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const SUBJECT_COLORS = [
  { bg: "bg-indigo-50", text: "text-indigo-700", chip: "bg-indigo-100" },
  { bg: "bg-teal-50", text: "text-teal-700", chip: "bg-teal-100" },
  { bg: "bg-amber-50", text: "text-amber-700", chip: "bg-amber-100" },
  { bg: "bg-rose-50", text: "text-rose-700", chip: "bg-rose-100" },
  { bg: "bg-sky-50", text: "text-sky-700", chip: "bg-sky-100" },
  { bg: "bg-violet-50", text: "text-violet-700", chip: "bg-violet-100" },
];
function colorFor(id) {
  return SUBJECT_COLORS[id % SUBJECT_COLORS.length];
}

const DAY_BLOCK_COLORS = {
  assembly: "bg-violet-50 text-violet-700",
  period: "bg-slate-50 text-slate-700",
  break: "bg-teal-50 text-teal-700",
  lunch: "bg-amber-50 text-amber-700",
  closing: "bg-rose-50 text-rose-700",
  other: "bg-slate-50 text-slate-700",
};

export default function AcademicsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [schoolId, setSchoolId] = useState(null);
  const [activeTab, setActiveTab] = useState("subjects");
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [timetable, setTimetable] = useState([]);
  const [error, setError] = useState("");

  const [subjectName, setSubjectName] = useState("");
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editSubjectName, setEditSubjectName] = useState("");
  const [editSubjectCode, setEditSubjectCode] = useState("");
  const [subjectCode, setSubjectCode] = useState("");

  const [slotDay, setSlotDay] = useState("0");
  const [slotPeriod, setSlotPeriod] = useState("1");
  const [slotStart, setSlotStart] = useState("09:00");
  const [slotEnd, setSlotEnd] = useState("09:45");
  const [slotSubjectId, setSlotSubjectId] = useState("");

  const [editingSectionId, setEditingSectionId] = useState(null);
  const [editCapacity, setEditCapacity] = useState("");
  const [editTeacherId, setEditTeacherId] = useState("");

  const [daySchedule, setDaySchedule] = useState([]);
  const [showDayScheduleForm, setShowDayScheduleForm] = useState(false);
  const [dsBlockType, setDsBlockType] = useState("assembly");
  const [dsLabel, setDsLabel] = useState("");
  const [dsStart, setDsStart] = useState("08:00");
  const [dsEnd, setDsEnd] = useState("08:15");

  const canEdit = user && ["academic_coordinator", "school_admin", "administrator", "principal", "super_admin"].includes(user.role_name);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/");
      return;
    }
    init();
  }, []);

  async function init() {
    try {
      const me = await apiRequest("/auth/me");
      setUser(me);
      setSchoolId(me.school_id);
      const [teacherList, schedule] = await Promise.all([
        apiRequest(`/staff/?school_id=${me.school_id}&role_name=teacher`),
        apiRequest(`/day-schedule?school_id=${me.school_id}`),
        loadSubjects(me.school_id), loadClasses(me.school_id),
      ]);
      setTeachers(teacherList);
      setDaySchedule(schedule);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadSubjects(sid) {
    const data = await apiRequest(`/subjects?school_id=${sid}`);
    setSubjects(data);
  }
  async function loadClasses(sid) {
    const data = await apiRequest(`/classes/?school_id=${sid}`);
    setClasses(data);
  }

  useEffect(() => {
    if (!selectedClassId) { setSections([]); setSelectedSectionId(""); return; }
    apiRequest(`/classes/${selectedClassId}/sections`).then(setSections);
  }, [selectedClassId]);

  useEffect(() => {
    if (!selectedSectionId) { setTimetable([]); return; }
    loadTimetable();
  }, [selectedSectionId]);

  async function loadTimetable() {
    const data = await apiRequest(`/timetable?section_id=${selectedSectionId}`);
    setTimetable(data);
  }

  async function handleAddSection() {
    setError("");
    try {
      await apiRequest("/sections/", { method: "POST", body: { school_class_id: Number(selectedClassId), capacity: 40 } });
      const updated = await apiRequest(`/classes/${selectedClassId}/sections`);
      setSections(updated);
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditSection(section) {
    setEditingSectionId(section.id);
    setEditCapacity(section.capacity);
    setEditTeacherId(section.class_teacher_id || "");
  }

  async function handleSaveSection(sectionId) {
    setError("");
    try {
      await apiRequest(`/sections/${sectionId}`, {
        method: "PATCH",
        body: { capacity: Number(editCapacity), class_teacher_id: editTeacherId ? Number(editTeacherId) : null },
      });
      const updated = await apiRequest(`/classes/${selectedClassId}/sections`);
      setSections(updated);
      setEditingSectionId(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateSubject(e) {
    e.preventDefault();
    setError("");
    try {
      await apiRequest("/subjects", { method: "POST", body: { school_id: schoolId, name: subjectName, code: subjectCode || null } });
      setSubjectName(""); setSubjectCode("");
      await loadSubjects(schoolId);
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditSubject(subject) {
    setEditingSubjectId(subject.id);
    setEditSubjectName(subject.name);
    setEditSubjectCode(subject.code || "");
  }

  async function handleSaveSubject(subjectId) {
    setError("");
    try {
      await apiRequest(`/subjects/${subjectId}`, {
        method: "PATCH",
        body: { name: editSubjectName, code: editSubjectCode || null },
      });
      setEditingSubjectId(null);
      await loadSubjects(schoolId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteSubject(subjectId, name) {
    if (!confirm(`Remove "${name}"? It will no longer appear in lists, but existing timetable and homework history stays intact.`)) return;
    setError("");
    try {
      await apiRequest(`/subjects/${subjectId}`, { method: "DELETE" });
      await loadSubjects(schoolId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddSlot(e) {
    e.preventDefault();
    setError("");
    try {
      await apiRequest("/timetable", {
        method: "POST",
        body: {
          section_id: Number(selectedSectionId), day_of_week: Number(slotDay), period_number: Number(slotPeriod),
          start_time: slotStart, end_time: slotEnd, subject_id: Number(slotSubjectId),
        },
      });
      await loadTimetable();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddDayScheduleBlock(e) {
    e.preventDefault();
    setError("");
    try {
      await apiRequest("/day-schedule", {
        method: "POST",
        body: { block_type: dsBlockType, label: dsLabel, start_time: dsStart, end_time: dsEnd, order_index: daySchedule.length },
      });
      setDsLabel("");
      setShowDayScheduleForm(false);
      const schedule = await apiRequest(`/day-schedule?school_id=${schoolId}`);
      setDaySchedule(schedule);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteDayScheduleBlock(blockId) {
    try {
      await apiRequest(`/day-schedule/${blockId}`, { method: "DELETE" });
      const schedule = await apiRequest(`/day-schedule?school_id=${schoolId}`);
      setDaySchedule(schedule);
    } catch (err) {
      setError(err.message);
    }
  }

  function handlePrint() {
    window.print();
  }

  function slotFor(day, period) {
    return timetable.find((t) => t.day_of_week === day && t.period_number === period);
  }
  const periods = [1, 2, 3, 4, 5, 6];

  const TABS = [
    { key: "subjects", label: "Subjects", icon: BookOpen, color: "text-indigo-600" },
    { key: "sections", label: "Sections", icon: LayoutGrid, color: "text-teal-600" },
    { key: "timetable", label: "Timetable", icon: CalendarDays, color: "text-amber-600" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">Academics</h2>
      <p className="text-sm text-slate-600 mb-6">Subjects, sections, and timetable — by class and section.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="flex items-center gap-1 border-b border-slate-200 mb-6 print:hidden">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key ? `border-current ${tab.color}` : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <tab.icon size={15} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "subjects" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {canEdit && (
            <div className="sm:col-span-1">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
                  <Plus size={14} className="text-indigo-600" /> Add Subject
                </h3>
                <form onSubmit={handleCreateSubject} className="space-y-2">
                  <input placeholder="Subject name" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
                  <input placeholder="Code (optional)" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg px-3 py-2">
                    Add Subject
                  </button>
                </form>
              </div>
            </div>
          )}
          <div className={canEdit ? "sm:col-span-2" : "sm:col-span-3"}>
            {subjects.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">No subjects yet.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {subjects.map((s) => {
                  const c = colorFor(s.id);
                  if (editingSubjectId === s.id) {
                    return (
                      <div key={s.id} className={`rounded-xl p-4 ${c.bg} space-y-2`}>
                        <input
                          value={editSubjectName} onChange={(e) => setEditSubjectName(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                        />
                        <input
                          value={editSubjectCode} onChange={(e) => setEditSubjectCode(e.target.value)}
                          placeholder="Code" className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                        />
                        <div className="flex gap-1.5">
                          <button onClick={() => handleSaveSubject(s.id)} className="flex-1 flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg py-1.5">
                            <Check size={12} /> Save
                          </button>
                          <button onClick={() => setEditingSubjectId(null)} className="px-2 text-slate-500">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={s.id} className={`group relative rounded-xl p-4 ${c.bg}`}>
                      {canEdit && (
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEditSubject(s)} className="w-6 h-6 rounded-md bg-white/70 hover:bg-white flex items-center justify-center">
                            <Pencil size={11} className={c.text} />
                          </button>
                          <button onClick={() => handleDeleteSubject(s.id, s.name)} className="w-6 h-6 rounded-md bg-white/70 hover:bg-white flex items-center justify-center">
                            <Trash2 size={11} className="text-rose-600" />
                          </button>
                        </div>
                      )}
                      <div className={`w-9 h-9 rounded-lg ${c.chip} flex items-center justify-center mb-2`}>
                        <BookOpen size={16} className={c.text} />
                      </div>
                      <p className={`text-sm font-semibold ${c.text}`}>{s.name}</p>
                      {s.code && <p className="text-xs text-slate-500">{s.code}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "sections" && (
        <div>
          {!selectedClassId ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {classes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedClassId(String(c.id))}
                  className="text-left bg-white border border-slate-200 hover:border-teal-300 hover:shadow-sm rounded-xl p-4 transition-all"
                >
                  <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center mb-2">
                    <LayoutGrid size={16} />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-500">View sections →</p>
                </button>
              ))}
            </div>
          ) : (
            <div>
              <button
                onClick={() => setSelectedClassId("")}
                className="text-sm text-slate-600 hover:text-slate-900 mb-4 flex items-center gap-1"
              >
                ← Back to all classes
              </button>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">
                    {classes.find((c) => String(c.id) === selectedClassId)?.name} · {sections.length} section(s)
                  </p>
                  {canEdit && (
                    <button onClick={handleAddSection} className="text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-3 py-1.5 flex items-center gap-1">
                      <Plus size={12} /> Add Section
                    </button>
                  )}
                </div>
                <div className="divide-y divide-slate-100">
                  {sections.map((s) => {
                    const teacher = teachers.find((t) => t.id === s.class_teacher_id);
                    return (
                      <div key={s.id} className="px-5 py-4">
                        {editingSectionId === s.id ? (
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-sm font-semibold text-slate-900 w-8">{s.name}</span>
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-0.5">Capacity</label>
                              <input type="number" value={editCapacity} onChange={(e) => setEditCapacity(e.target.value)} className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                            </div>
                            <div className="flex-1 min-w-[160px]">
                              <label className="block text-[10px] text-slate-500 mb-0.5">Class Teacher</label>
                              <select value={editTeacherId} onChange={(e) => setEditTeacherId(e.target.value)} className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm">
                                <option value="">Unassigned</option>
                                {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                              </select>
                            </div>
                            <button onClick={() => handleSaveSection(s.id)} className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-lg px-3 py-1.5 flex items-center gap-1 mt-4">
                              <Check size={12} /> Save
                            </button>
                            <button onClick={() => setEditingSectionId(null)} className="text-slate-500 text-xs font-medium px-2 mt-4 flex items-center gap-1">
                              <X size={12} /> Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <span className="w-9 h-9 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center text-sm font-bold">{s.name}</span>
                              <div>
                                <p className="text-sm font-medium text-slate-900">Section {s.name}</p>
                                <p className="text-xs text-slate-500">
                                  Capacity {s.capacity} · Class Teacher: {teacher ? teacher.full_name : "Unassigned"}
                                </p>
                              </div>
                            </div>
                            {canEdit && (
                              <button onClick={() => startEditSection(s)} className="text-xs font-medium text-teal-700 border border-teal-200 rounded-lg px-3 py-1.5 flex items-center gap-1">
                                <Pencil size={12} /> Edit
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "timetable" && (
        <div>
          {/* School Daily Schedule — the anchor: what a normal day looks
              like, regardless of which section is picked below. */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 print:hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <Clock3 size={14} className="text-amber-600" /> School Daily Schedule
              </h3>
              {canEdit && !showDayScheduleForm && (
                <button onClick={() => setShowDayScheduleForm(true)} className="text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 py-1.5 flex items-center gap-1">
                  <Plus size={12} /> Add Block
                </button>
              )}
            </div>

            {showDayScheduleForm && (
              <form onSubmit={handleAddDayScheduleBlock} className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-50 rounded-lg p-3 mb-3">
                <select value={dsBlockType} onChange={(e) => setDsBlockType(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
                  <option value="assembly">Assembly</option>
                  <option value="period">Period</option>
                  <option value="break">Break/Recess</option>
                  <option value="lunch">Lunch</option>
                  <option value="closing">Closing</option>
                  <option value="other">Other</option>
                </select>
                <input value={dsLabel} onChange={(e) => setDsLabel(e.target.value)} placeholder="Label (e.g. Morning Assembly)" required className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                <input type="time" value={dsStart} onChange={(e) => setDsStart(e.target.value)} required className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                <input type="time" value={dsEnd} onChange={(e) => setDsEnd(e.target.value)} required className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                <div className="flex gap-1.5">
                  <button type="submit" className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg py-1.5">Add</button>
                  <button type="button" onClick={() => setShowDayScheduleForm(false)} className="text-xs text-slate-500 px-2">Cancel</button>
                </div>
              </form>
            )}

            {daySchedule.length === 0 ? (
              <p className="text-sm text-slate-500">No daily schedule set up yet — add assembly, recess, lunch, and closing times.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {daySchedule.map((block) => (
                  <div key={block.id} className={`group relative flex items-center gap-2 rounded-lg px-3 py-2 ${DAY_BLOCK_COLORS[block.block_type] || DAY_BLOCK_COLORS.other}`}>
                    <div>
                      <p className="text-xs font-semibold">{block.label}</p>
                      <p className="text-[11px] opacity-75">{block.start_time} – {block.end_time}</p>
                    </div>
                    {canEdit && (
                      <button onClick={() => handleDeleteDayScheduleBlock(block.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mb-4 print:hidden">
            <div className="grid grid-cols-2 gap-3 flex-1 max-w-md">
              <ClassSelect classes={classes} value={selectedClassId} onChange={setSelectedClassId} placeholder="Select class" />
              <select value={selectedSectionId} onChange={(e) => setSelectedSectionId(e.target.value)} disabled={!selectedClassId} className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50">
                <option value="">Select section</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {selectedSectionId && (
              <button onClick={handlePrint} className="text-sm font-medium text-slate-600 border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-1.5 hover:bg-slate-50">
                <Printer size={14} /> Print
              </button>
            )}
          </div>

          {selectedSectionId && (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto mb-4">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left text-slate-500 font-medium p-2">Period</th>
                      {DAYS.map((d) => <th key={d} className="text-left text-slate-500 font-medium p-2">{d}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((p) => (
                      <tr key={p} className="border-t border-slate-100">
                        <td className="p-2 font-medium text-slate-600">P{p}</td>
                        {DAYS.map((_, dayIdx) => {
                          const slot = slotFor(dayIdx, p);
                          const c = slot ? colorFor(slot.subject.id) : null;
                          return (
                            <td key={dayIdx} className="p-2">
                              {slot ? (
                                <div className={`rounded-md px-2 py-1.5 ${c.bg}`}>
                                  <p className={`font-medium ${c.text}`}>{slot.subject.name}</p>
                                  <p className="text-slate-400">{slot.start_time}-{slot.end_time}</p>
                                </div>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {canEdit && (
                <form onSubmit={handleAddSlot} className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-50 rounded-lg p-3 print:hidden">
                  <select value={slotDay} onChange={(e) => setSlotDay(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                  <select value={slotPeriod} onChange={(e) => setSlotPeriod(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
                    {periods.map((p) => <option key={p} value={p}>Period {p}</option>)}
                  </select>
                  <input type="time" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                  <input type="time" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                  <select value={slotSubjectId} onChange={(e) => setSlotSubjectId(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" required>
                    <option value="">Subject</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button type="submit" className="col-span-2 sm:col-span-5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg px-3 py-1.5">
                    Add Timetable Slot
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
