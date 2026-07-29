"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiRequest, isLoggedIn } from "../../../lib/api";
import ClassSelect from "../../../components/ClassSelect";

const STATUSES = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "excused", label: "Excused" },
];

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function AttendancePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkClassId = searchParams.get("class");
  const deepLinkSectionId = searchParams.get("section");

  const [schoolId, setSchoolId] = useState(null);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({}); // { studentId: status }

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  // Step 1: figure out which school this teacher belongs to, then load classes
  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/");
      return;
    }
    (async () => {
      try {
        const me = await apiRequest("/auth/me");
        setSchoolId(me.school_id);
        const classList = await apiRequest(`/classes/?school_id=${me.school_id}`);
        setClasses(classList);
        if (deepLinkClassId) {
          setSelectedClassId(deepLinkClassId);
        }
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  // Step 2: when a class is picked, load its sections
  useEffect(() => {
    if (!selectedClassId) {
      setSections([]);
      setSelectedSectionId("");
      return;
    }
    (async () => {
      try {
        const sectionList = await apiRequest(`/classes/${selectedClassId}/sections`);
        setSections(sectionList);
        if (deepLinkSectionId && sectionList.some((s) => String(s.id) === deepLinkSectionId)) {
          setSelectedSectionId(deepLinkSectionId);
        }
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [selectedClassId]);

  // Step 3: when a section + date are both picked, load the roster and any
  // attendance already marked for that date (so re-opening the page shows
  // what was previously saved, not a blank slate).
  useEffect(() => {
    if (!selectedSectionId || !date || !schoolId) {
      setStudents([]);
      return;
    }
    loadRoster();
  }, [selectedSectionId, date]);

  async function loadRoster() {
    setLoading(true);
    setError("");
    setSavedMessage("");
    try {
      const studentList = await apiRequest(
        `/students/?school_id=${schoolId}&section_id=${selectedSectionId}`
      );
      setStudents(studentList);

      const existing = await apiRequest(
        `/attendance/?section_id=${selectedSectionId}&date=${date}`
      );
      const existingMap = {};
      existing.forEach((record) => {
        existingMap[record.student_id] = record.status;
      });

      // Default anyone not yet marked to "present" — most students are
      // present most days, so this saves the teacher the most taps.
      const defaultMap = {};
      studentList.forEach((s) => {
        defaultMap[s.id] = existingMap[s.id] || "present";
      });
      setAttendance(defaultMap);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function setStatus(studentId, status) {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSavedMessage("");
    try {
      const entries = students.map((s) => ({
        student_id: s.id,
        status: attendance[s.id] || "present",
      }));
      await apiRequest("/attendance/mark", {
        method: "POST",
        body: { section_id: Number(selectedSectionId), date, entries },
      });
      setSavedMessage(`Attendance saved for ${students.length} students.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">Mark Attendance</h2>
        <p className="text-sm text-slate-600 mb-6">
          Pick a class, section, and date to take attendance.
        </p>

        {/* Selectors */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Class</label>
            <ClassSelect
              classes={classes}
              value={selectedClassId}
              onChange={setSelectedClassId}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Section</label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              disabled={!selectedClassId}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">Select a section</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}
        {savedMessage && (
          <p className="text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2 mb-4">
            {savedMessage}
          </p>
        )}

        {/* Roster */}
        {loading ? (
          <p className="text-sm text-slate-600">Loading roster...</p>
        ) : !selectedSectionId ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <p className="text-sm text-slate-600">
              Pick a class and section above to load the student roster.
            </p>
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <p className="text-sm text-slate-600">No students in this section yet.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {students.map((s, i) => (
              <div
                key={s.id}
                className={`flex items-center justify-between px-4 py-3 ${
                  i !== students.length - 1 ? "border-b border-slate-100" : ""
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{s.full_name}</p>
                  <p className="text-xs text-slate-500">{s.admission_number}</p>
                </div>
                <div className="flex gap-1.5">
                  {STATUSES.map((opt) => {
                    const active = attendance[s.id] === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setStatus(s.id, opt.value)}
                        className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
                          active
                            ? "bg-brand-600 border-brand-600 text-white"
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {students.length > 0 && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
          >
            {saving ? "Saving..." : "Save Attendance"}
          </button>
        )}
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-6 py-8 text-sm text-slate-600">Loading...</div>}>
      <AttendancePageInner />
    </Suspense>
  );
}
