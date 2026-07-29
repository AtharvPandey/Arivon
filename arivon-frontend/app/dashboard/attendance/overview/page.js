"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ClipboardList, GraduationCap, Search, CheckCircle2, Bell,
  ArrowLeft, UserCog, ExternalLink, AlertTriangle,
} from "lucide-react";
import { apiRequest, isLoggedIn } from "../../../../lib/api";

const STATUS_STYLES = {
  present: { bg: "bg-brand-50", text: "text-brand-700", label: "Present" },
  late: { bg: "bg-amber-50", text: "text-amber-700", label: "Late" },
  absent: { bg: "bg-rose-50", text: "text-rose-700", label: "Absent" },
  not_marked: { bg: "bg-slate-100", text: "text-slate-500", label: "Not Marked" },
};

const ROLE_LABELS = {
  school_admin: "School Admin", principal: "Principal", vice_principal: "Vice Principal",
  administrator: "Administrator", teacher: "Teaching Staff", accountant: "Accountant",
  receptionist: "Receptionist", admissions_officer: "Admissions Officer",
  academic_coordinator: "Academic Coordinator", librarian: "Librarian",
  transport_manager: "Transport Manager", driver: "Driver", support_staff: "Support Staff",
};

// Display order for role groups — teaching staff first (largest, most
// operationally relevant group), leadership last (small, rarely the
// thing an Admin is checking on), everything else in between.
const ROLE_GROUP_ORDER = [
  "teacher", "academic_coordinator", "admissions_officer", "accountant", "receptionist",
  "librarian", "transport_manager", "driver", "support_staff",
  "administrator", "vice_principal", "principal", "school_admin",
];

function AttendanceOverviewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") === "staff" ? "staff" : searchParams.get("tab") === "students" ? "students" : "sections");

  const [schoolId, setSchoolId] = useState(null);
  const [lowAttendanceList, setLowAttendanceList] = useState([]);
  const [briefing, setBriefing] = useState(null);
  const [staffOverview, setStaffOverview] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notifying, setNotifying] = useState(null);
  const [notifyResult, setNotifyResult] = useState({});
  const [assigningFor, setAssigningFor] = useState(null);
  const [selectedSubstitute, setSelectedSubstitute] = useState("");

  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState([]);
  const [searchingStudents, setSearchingStudents] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/");
      return;
    }
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const me = await apiRequest("/auth/me");
      setSchoolId(me.school_id);
      const today = new Date().toISOString().split("T")[0];
      const [briefingData, staffData, teacherData, lowAttendanceData] = await Promise.all([
        apiRequest(`/dashboard/morning-briefing/?school_id=${me.school_id}&date=${today}`),
        apiRequest(`/dashboard/morning-briefing/staff-overview?school_id=${me.school_id}&date=${today}`),
        apiRequest(`/staff/?school_id=${me.school_id}&role_name=teacher`),
        apiRequest(`/attendance/low-attendance?school_id=${me.school_id}`),
      ]);
      setBriefing(briefingData);
      setStaffOverview(staffData);
      setTeachers(teacherData);
      setLowAttendanceList(lowAttendanceData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleNotify(sectionId) {
    setNotifying(sectionId);
    try {
      const result = await apiRequest("/dashboard/morning-briefing/notify-attendance-reminder", {
        method: "POST",
        body: { section_id: sectionId },
      });
      setNotifyResult((prev) => ({ ...prev, [sectionId]: result }));
    } catch (err) {
      setNotifyResult((prev) => ({ ...prev, [sectionId]: { sent: false, message: err.message } }));
    } finally {
      setNotifying(null);
    }
  }

  async function handleAssignSubstitute(teacher) {
    if (!selectedSubstitute) return;
    try {
      const today = new Date().toISOString().split("T")[0];
      await Promise.all(
        teacher.uncovered_slot_ids.map((slotId) =>
          apiRequest("/substitutions/", {
            method: "POST",
            body: {
              school_id: schoolId, date: today, timetable_slot_id: slotId,
              original_teacher_id: teacher.user_id, substitute_teacher_id: Number(selectedSubstitute),
            },
          })
        )
      );
      setAssigningFor(null);
      setSelectedSubstitute("");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleStudentSearch(e) {
    e.preventDefault();
    if (studentQuery.trim().length < 2) return;
    setSearchingStudents(true);
    try {
      const results = await apiRequest(
        `/dashboard/morning-briefing/student-search?school_id=${schoolId}&query=${encodeURIComponent(studentQuery)}`
      );
      setStudentResults(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearchingStudents(false);
    }
  }

  if (loading) return <div className="max-w-5xl mx-auto px-6 py-8 text-sm text-slate-500">Loading...</div>;

  // Group staff by role, in the defined display order — an unstructured
  // flat list of 20+ names mixing teachers, drivers, and the Principal
  // together is exactly what made this hard to scan before.
  const staffByRole = {};
  for (const member of staffOverview) {
    if (!staffByRole[member.role_name]) staffByRole[member.role_name] = [];
    staffByRole[member.role_name].push(member);
  }
  const orderedRoleKeys = [
    ...ROLE_GROUP_ORDER.filter((r) => staffByRole[r]),
    ...Object.keys(staffByRole).filter((r) => !ROLE_GROUP_ORDER.includes(r)),
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <button onClick={() => router.push("/dashboard")} className="text-sm text-slate-600 hover:text-slate-900 mb-4 flex items-center gap-1">
        <ArrowLeft size={14} /> Back to Dashboard
      </button>

      <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">Attendance Overview</h2>
      <p className="text-sm text-slate-600 mb-6">Today's attendance status — every section, every staff member, and any student you look up.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="flex items-center gap-1 border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab("sections")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "sections" ? "border-teal-600 text-teal-700" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <ClipboardList size={14} /> Section-wise
        </button>
        <button
          onClick={() => setActiveTab("staff")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "staff" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <GraduationCap size={14} /> Staff ({staffOverview.length})
        </button>
        <button
          onClick={() => setActiveTab("students")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "students" ? "border-sky-600 text-sky-700" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Search size={14} /> Student Lookup
        </button>
        <button
          onClick={() => setActiveTab("lowattendance")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
            activeTab === "lowattendance" ? "border-rose-600 text-rose-700" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <AlertTriangle size={14} /> Low Attendance
        </button>
      </div>

      {activeTab === "sections" && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">
              {briefing.attendance_submission.submitted} of {briefing.attendance_submission.total_sections} sections submitted
            </p>
          </div>
          {briefing.attendance_submission.not_submitted_list.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 size={22} className="text-brand-500 mx-auto mb-2" />
              <p className="text-sm text-slate-600">Every section has submitted attendance today.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {briefing.attendance_submission.not_submitted_list.map((s) => {
                const result = notifyResult[s.section_id];
                return (
                  <div key={s.section_id} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{s.section_name}</p>
                      <p className="text-xs text-slate-500">
                        {s.class_teacher_name ? `Class Teacher: ${s.class_teacher_name}` : "No class teacher assigned"}
                      </p>
                      {result && (
                        <p className={`text-xs mt-1 ${result.sent ? "text-brand-600" : "text-amber-600"}`}>{result.message}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-700 px-2 py-1 rounded-full">
                        Not Submitted
                      </span>
                      <button
                        onClick={() => handleNotify(s.section_id)}
                        disabled={notifying === s.section_id || !s.class_teacher_id}
                        title={!s.class_teacher_id ? "No class teacher assigned to notify" : ""}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg px-2.5 py-1.5 disabled:opacity-40 flex items-center gap-1"
                      >
                        <Bell size={12} /> {notifying === s.section_id ? "..." : "Notify"}
                      </button>
                      <a
                        href={`/dashboard/attendance?class=${s.class_id}&section=${s.section_id}`}
                        className="text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg px-2.5 py-1.5"
                      >
                        Mark Now
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "staff" && (
        <div className="space-y-5">
          {orderedRoleKeys.map((roleKey) => (
            <div key={roleKey} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {ROLE_LABELS[roleKey] || roleKey.replace(/_/g, " ")} ({staffByRole[roleKey].length})
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {staffByRole[roleKey].map((t) => {
                  const style = STATUS_STYLES[t.status];
                  return (
                    <div key={t.user_id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold shrink-0">
                            {t.full_name.charAt(0)}
                          </div>
                          <p className="text-sm font-medium text-slate-900 truncate">{t.full_name}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${style.bg} ${style.text}`}>
                            {style.label}
                          </span>
                          {t.needs_substitute && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide bg-rose-50 text-rose-700 px-2 py-1 rounded-full">
                              Needs Substitute
                            </span>
                          )}
                          <a
                            href="/dashboard/people/staff"
                            className="text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1"
                          >
                            Profile <ExternalLink size={11} />
                          </a>
                        </div>
                      </div>

                      {t.needs_substitute && (
                        <div className="mt-2 pl-11">
                          {assigningFor === t.user_id ? (
                            <div className="flex items-center gap-1.5">
                              <select
                                value={selectedSubstitute}
                                onChange={(e) => setSelectedSubstitute(e.target.value)}
                                className="text-xs rounded-md border border-slate-200 px-2 py-1"
                              >
                                <option value="">Choose teacher</option>
                                {teachers.filter((tc) => tc.id !== t.user_id).map((tc) => (
                                  <option key={tc.id} value={tc.id}>{tc.full_name}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleAssignSubstitute(t)}
                                className="text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-2 py-1"
                              >
                                Assign
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setAssigningFor(t.user_id)}
                              className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                            >
                              <UserCog size={11} /> Assign substitute
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "students" && (
        <div>
          <form onSubmit={handleStudentSearch} className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="Search a student by name..."
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={searchingStudents}
              className="bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2.5"
            >
              {searchingStudents ? "Searching..." : "Search"}
            </button>
          </form>

          {studentResults.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {studentResults.map((s) => (
                <div key={s.student_id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{s.full_name}</p>
                    <p className="text-xs text-slate-500">{s.section_name}</p>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">Today</p>
                      {s.today_status ? (
                        <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${STATUS_STYLES[s.today_status]?.bg} ${STATUS_STYLES[s.today_status]?.text}`}>
                          {STATUS_STYLES[s.today_status]?.label}
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Not Marked</span>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">Last 30 Days</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {s.attendance_pct_last_30_days !== null ? `${s.attendance_pct_last_30_days}%` : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "lowattendance" && (
        <div>
          <p className="text-sm text-slate-600 mb-4">Students below the 75% board-mandated threshold, computed across the whole session so far.</p>
          {lowAttendanceList.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
              <CheckCircle2 size={20} className="text-brand-500 mx-auto mb-2" />
              <p className="text-sm text-slate-600">No students currently below 75% attendance.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {lowAttendanceList.map((s) => (
                <div key={s.student_id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{s.full_name}</p>
                    <p className="text-xs text-slate-500">{s.admission_number} · {s.section_name} · {s.total_marked_days} day(s) marked</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700">
                    {s.attendance_pct}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AttendanceOverviewPage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-6 py-8 text-sm text-slate-500">Loading...</div>}>
      <AttendanceOverviewInner />
    </Suspense>
  );
}
