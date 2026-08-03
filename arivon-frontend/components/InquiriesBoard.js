"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, X, Phone, Mail, Calendar, ChevronRight, Clock, GraduationCap,
  UserCheck, Search, CalendarClock, CheckCircle2, XCircle, Sparkles,
} from "lucide-react";
import { apiRequest, isLoggedIn } from "../lib/api";
import ClassSelect from "./ClassSelect";

const STAGE_COLUMNS = [
  { key: "lead", label: "Lead", accent: "slate" },
  { key: "inquiry", label: "Inquiry", accent: "indigo" },
  { key: "counseling", label: "Counseling", accent: "amber" },
];

const SOURCE_LABELS = {
  walk_in: "Walk-in", website: "Website", referral: "Referral",
  advertisement: "Advertisement", call: "Call", other: "Other",
};

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function InquiryCard({ application, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-slate-200 rounded-xl p-3.5 hover:border-brand-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-slate-900 truncate">{application.student_name}</p>
        <span className="text-[10px] font-medium text-slate-400 shrink-0">{timeAgo(application.created_at)}</span>
      </div>
      <p className="text-xs text-slate-500 mb-2">{application.parent_name}</p>
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
        <Phone size={11} /> {application.phone}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
          {SOURCE_LABELS[application.source] || application.source}
        </span>
        {application.applying_for_class_name && (
          <span className="text-[10px] text-slate-400">{application.applying_for_class_name}</span>
        )}
      </div>
      {application.assigned_counselor_name && (
        <div className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1 mt-2">
          <UserCheck size={11} /> {application.assigned_counselor_name}
        </div>
      )}
    </button>
  );
}

function NewLeadModal({ schoolId, academicYearId, onClose, onCreated }) {
  const [source, setSource] = useState("walk_in");
  const [studentName, setStudentName] = useState("");
  const [parentName, setParentName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiRequest("/admission-pipeline/leads", {
        method: "POST",
        body: {
          school_id: schoolId, academic_year_id: academicYearId, source,
          student_name: studentName, parent_name: parentName, phone, email: email || null,
        },
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-display font-bold text-slate-900 flex items-center gap-2">
            <Sparkles size={16} className="text-brand-600" /> New Inquiry
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            {Object.entries(SOURCE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Student's name" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Parent's name" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" type="email" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <button type="submit" disabled={saving} className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2.5 mt-2">
            {saving ? "Creating..." : "Create Inquiry"}
          </button>
        </form>
      </div>
    </div>
  );
}

function DetailDrawer({ application, classes, staffList, onClose, onUpdated }) {
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [classId, setClassId] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [currentSchool, setCurrentSchool] = useState("");
  const [address, setAddress] = useState("");

  const [counselorId, setCounselorId] = useState(application.assigned_counselor_user_id || "");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionTime, setSessionTime] = useState("");

  const [guardianName, setGuardianName] = useState(application.parent_name || "");
  const [guardianPhone, setGuardianPhone] = useState(application.phone || "");
  const [guardianEmail, setGuardianEmail] = useState(application.email || "");
  const [transportRequired, setTransportRequired] = useState(false);
  const [hostelRequired, setHostelRequired] = useState(false);

  const [showLostForm, setShowLostForm] = useState(false);
  const [lostReason, setLostReason] = useState("");

  useEffect(() => {
    if (application.stage === "counseling" || application.stage === "inquiry") {
      apiRequest(`/admission-pipeline/applications/${application.id}/counseling-sessions`).then(setSessions).catch(() => {});
    }
  }, [application.id, application.stage]);

  async function handleAdvanceToInquiry(e) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await apiRequest(`/admission-pipeline/applications/${application.id}/advance-to-inquiry`, {
        method: "PATCH",
        body: { applying_for_class_id: Number(classId), date_of_birth: dob, gender: gender || null, current_school: currentSchool || null, address: address || null },
      });
      onUpdated();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function handleAssignCounselor(e) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await apiRequest(`/admission-pipeline/applications/${application.id}/assign-counselor`, {
        method: "PATCH", body: { counselor_user_id: Number(counselorId) },
      });
      onUpdated();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function handleScheduleSession(e) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await apiRequest(`/admission-pipeline/applications/${application.id}/counseling-sessions`, {
        method: "POST",
        body: { counselor_user_id: Number(counselorId), scheduled_at: `${sessionDate}T${sessionTime || "10:00"}:00` },
      });
      setSessionDate(""); setSessionTime("");
      onUpdated();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function handleRecordOutcome(sessionId, outcome) {
    setError("");
    try {
      await apiRequest(`/admission-pipeline/counseling-sessions/${sessionId}`, {
        method: "PATCH", body: { outcome },
      });
      const updated = await apiRequest(`/admission-pipeline/applications/${application.id}/counseling-sessions`);
      setSessions(updated);
    } catch (err) { setError(err.message); }
  }

  async function handleSubmitApplication(e) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await apiRequest(`/admission-pipeline/applications/${application.id}/submit`, {
        method: "POST",
        body: {
          guardian_full_name: guardianName, guardian_phone: guardianPhone, guardian_email: guardianEmail || null,
          transport_required: transportRequired, hostel_required: hostelRequired,
        },
      });
      onUpdated();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function handleMarkLost(e) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await apiRequest(`/admission-pipeline/applications/${application.id}/mark-lost`, {
        method: "POST", body: { reason: lostReason },
      });
      onUpdated();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  const hasInterestedSession = sessions.some((s) => s.outcome === "interested");

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-start justify-between z-10">
          <div>
            <h3 className="text-base font-display font-bold text-slate-900">{application.student_name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{application.parent_name} · {application.phone}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>

        <div className="p-5">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

          <div className="bg-slate-50 rounded-xl p-3.5 mb-5 space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-slate-600"><Phone size={12} /> {application.phone}</div>
            {application.email && <div className="flex items-center gap-2 text-xs text-slate-600"><Mail size={12} /> {application.email}</div>}
            <div className="flex items-center gap-2 text-xs text-slate-600"><Calendar size={12} /> Created {timeAgo(application.created_at)}</div>
          </div>

          {application.stage === "lead" && (
            <div className="mb-5">
              <h4 className="text-sm font-semibold text-slate-800 mb-3">Advance to Inquiry</h4>
              <form onSubmit={handleAdvanceToInquiry} className="space-y-2.5">
                <ClassSelect classes={classes} value={classId} onChange={setClassId} required />
                <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Date of birth" />
                <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="">Gender (optional)</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                <input value={currentSchool} onChange={(e) => setCurrentSchool(e.target.value)} placeholder="Current school (optional)" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address (optional)" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <button type="submit" disabled={saving} className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2.5">
                  {saving ? "Saving..." : "Advance to Inquiry"}
                </button>
              </form>
            </div>
          )}

          {(application.stage === "inquiry" || application.stage === "counseling") && (
            <div className="mb-5">
              <h4 className="text-sm font-semibold text-slate-800 mb-3">Counselor</h4>
              <form onSubmit={handleAssignCounselor} className="flex gap-2 mb-4">
                <select value={counselorId} onChange={(e) => setCounselorId(e.target.value)} required className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="">Assign a counselor</option>
                  {staffList.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.role_name})</option>)}
                </select>
                <button type="submit" disabled={saving} className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg px-3 disabled:opacity-60">
                  Assign
                </button>
              </form>

              <h4 className="text-sm font-semibold text-slate-800 mb-3">Counseling Sessions</h4>
              {sessions.length > 0 && (
                <div className="space-y-2 mb-3">
                  {sessions.map((s) => (
                    <div key={s.id} className="border border-slate-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-slate-800">{new Date(s.scheduled_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                        {s.outcome && (
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${s.outcome === "interested" ? "bg-brand-50 text-brand-700" : s.outcome === "not_interested" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>
                            {s.outcome.replace("_", " ")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mb-2">with {s.counselor_name}</p>
                      {!s.outcome && (
                        <div className="flex gap-1.5">
                          <button onClick={() => handleRecordOutcome(s.id, "interested")} className="text-[10px] font-medium bg-brand-50 text-brand-700 px-2 py-1 rounded-md hover:bg-brand-100">Interested</button>
                          <button onClick={() => handleRecordOutcome(s.id, "needs_follow_up")} className="text-[10px] font-medium bg-amber-50 text-amber-700 px-2 py-1 rounded-md hover:bg-amber-100">Follow up</button>
                          <button onClick={() => handleRecordOutcome(s.id, "not_interested")} className="text-[10px] font-medium bg-rose-50 text-rose-700 px-2 py-1 rounded-md hover:bg-rose-100">Not interested</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleScheduleSession} className="flex gap-2">
                <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} required className="flex-1 rounded-lg border border-slate-200 px-2 py-2 text-xs" />
                <input type="time" value={sessionTime} onChange={(e) => setSessionTime(e.target.value)} className="w-24 rounded-lg border border-slate-200 px-2 py-2 text-xs" />
                <button type="submit" disabled={saving || !counselorId} className="bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white text-xs font-medium rounded-lg px-3 flex items-center gap-1">
                  <CalendarClock size={12} /> Schedule
                </button>
              </form>

              {application.stage === "counseling" && hasInterestedSession && (
                <div className="mt-5 pt-5 border-t border-slate-100">
                  <h4 className="text-sm font-semibold text-slate-800 mb-3">Submit Application</h4>
                  <form onSubmit={handleSubmitApplication} className="space-y-2.5">
                    <input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="Guardian full name" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} placeholder="Guardian phone" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <input value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} placeholder="Guardian email (optional)" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <div className="flex gap-4 text-xs text-slate-600">
                      <label className="flex items-center gap-1.5"><input type="checkbox" checked={transportRequired} onChange={(e) => setTransportRequired(e.target.checked)} /> Transport needed</label>
                      <label className="flex items-center gap-1.5"><input type="checkbox" checked={hostelRequired} onChange={(e) => setHostelRequired(e.target.checked)} /> Hostel needed</label>
                    </div>
                    <button type="submit" disabled={saving} className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2.5 flex items-center justify-center gap-1.5">
                      <CheckCircle2 size={14} /> Submit Application
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-slate-100">
            {!showLostForm ? (
              <button onClick={() => setShowLostForm(true)} className="text-xs font-medium text-rose-600 hover:underline flex items-center gap-1">
                <XCircle size={12} /> Mark as lost
              </button>
            ) : (
              <form onSubmit={handleMarkLost} className="space-y-2">
                <input value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="Reason (e.g. chose another school)" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                <div className="flex gap-2">
                  <button type="submit" disabled={saving} className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-medium rounded-lg py-2">Confirm lost</button>
                  <button type="button" onClick={() => setShowLostForm(false)} className="text-xs text-slate-500 px-3">Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InquiriesBoard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [applications, setApplications] = useState([]);
  const [classes, setClasses] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [academicYearId, setAcademicYearId] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState(null);
  const [showNewLead, setShowNewLead] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    init();
  }, []);

  async function init() {
    try {
      const me = await apiRequest("/auth/me");
      setUser(me);
      const [apps, classList, staff, years] = await Promise.all([
        apiRequest(`/admission-pipeline/inquiries?school_id=${me.school_id}`),
        apiRequest(`/classes/?school_id=${me.school_id}`),
        apiRequest(`/admission-pipeline/staff?school_id=${me.school_id}`),
        apiRequest(`/academic-years/?school_id=${me.school_id}`),
      ]);
      setApplications(apps);
      setClasses(classList);
      setStaffList(staff);
      const current = years.find((y) => y.is_current) || years[0];
      setAcademicYearId(current?.id || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    const apps = await apiRequest(`/admission-pipeline/inquiries?school_id=${user.school_id}`);
    setApplications(apps);
    if (selectedApp) {
      const updated = apps.find((a) => a.id === selectedApp.id);
      setSelectedApp(updated || null);
    }
  }

  const filtered = applications.filter((a) =>
    !search || a.student_name.toLowerCase().includes(search.toLowerCase()) || a.parent_name.toLowerCase().includes(search.toLowerCase()) || a.phone.includes(search)
  );

  if (loading) return <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 text-sm text-slate-600">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900">Inquiries</h2>
          <p className="text-sm text-slate-600">The early funnel — Lead, Inquiry, and Counseling, before a formal application.</p>
        </div>
        <button
          onClick={() => setShowNewLead(true)}
          disabled={!academicYearId}
          className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2.5 shrink-0"
        >
          <Plus size={15} /> New Inquiry
        </button>
      </div>

      {!academicYearId && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
          Set up an academic session first, under School → Academic Sessions, before creating inquiries.
        </p>
      )}
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="relative mb-6 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone"
          className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STAGE_COLUMNS.map((col) => {
          const items = filtered.filter((a) => a.stage === col.key);
          return (
            <div key={col.key} className="bg-slate-50 rounded-2xl p-3.5">
              <div className="flex items-center justify-between mb-3 px-1">
                <p className="text-sm font-semibold text-slate-700">{col.label}</p>
                <span className="text-xs font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">{items.length}</span>
              </div>
              <div className="space-y-2.5">
                {items.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">Nothing here.</p>
                ) : (
                  items.map((app) => <InquiryCard key={app.id} application={app} onClick={() => setSelectedApp(app)} />)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showNewLead && (
        <NewLeadModal
          schoolId={user.school_id} academicYearId={academicYearId}
          onClose={() => setShowNewLead(false)}
          onCreated={async () => { setShowNewLead(false); await refresh(); }}
        />
      )}

      {selectedApp && (
        <DetailDrawer
          application={selectedApp} classes={classes} staffList={staffList}
          onClose={() => setSelectedApp(null)}
          onUpdated={refresh}
        />
      )}
    </div>
  );
}
