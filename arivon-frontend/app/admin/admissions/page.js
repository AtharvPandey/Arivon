"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronRight, Lock } from "lucide-react";
import { apiRequest, isLoggedIn } from "../../../lib/api";
import ClassSelect from "../../../components/ClassSelect";

const STAGES = [
  { key: "inquiry", label: "Inquiry" },
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Under Review" },
  { key: "offer_sent", label: "Offer Sent" },
  { key: "enrolled", label: "Enrolled" },
];

const STAGE_COLORS = {
  inquiry: "bg-slate-100 text-slate-600",
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-amber-100 text-amber-700",
  offer_sent: "bg-brand-100 text-brand-700",
  enrolled: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  withdrawn: "bg-slate-100 text-slate-500",
};

export default function AdmissionsPage() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState(null);
  const [role, setRole] = useState(null);
  const [applications, setApplications] = useState([]);
  const [classes, setClasses] = useState([]);
  const [guardians, setGuardians] = useState([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [guardianMode, setGuardianMode] = useState("new");
  const [existingGuardianId, setExistingGuardianId] = useState("");
  const [gName, setGName] = useState("");
  const [gRelation, setGRelation] = useState("father");
  const [gPhone, setGPhone] = useState("");
  const [gEmail, setGEmail] = useState("");

  const [applicantName, setApplicantName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [classId, setClassId] = useState("");
  const [previousSchool, setPreviousSchool] = useState("");

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
      setSchoolId(me.school_id);
      setRole(me.role_name);
      await Promise.all([
        loadApplications(me.school_id),
        loadClasses(me.school_id),
        loadGuardians(me.school_id),
      ]);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadApplications(sid) {
    const data = await apiRequest(`/admissions/applications?school_id=${sid}`);
    setApplications(data);
  }
  async function loadClasses(sid) {
    const data = await apiRequest(`/classes/?school_id=${sid}`);
    setClasses(data);
  }
  async function loadGuardians(sid) {
    const data = await apiRequest(`/guardians/?school_id=${sid}`);
    setGuardians(data);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    try {
      let guardianId = existingGuardianId ? Number(existingGuardianId) : null;

      if (guardianMode === "new") {
        const guardian = await apiRequest("/guardians/", {
          method: "POST",
          body: { school_id: schoolId, full_name: gName, relation: gRelation, phone: gPhone, email: gEmail || null },
        });
        guardianId = guardian.id;
      }

      await apiRequest("/admissions/applications", {
        method: "POST",
        body: {
          school_id: schoolId,
          academic_year_id: 1,
          applying_for_class_id: Number(classId),
          applicant_name: applicantName,
          date_of_birth: dob,
          gender: gender || null,
          previous_school: previousSchool || null,
          guardian_id: guardianId,
        },
      });

      setShowForm(false);
      setApplicantName(""); setDob(""); setGender(""); setClassId(""); setPreviousSchool("");
      setGName(""); setGPhone(""); setGEmail(""); setExistingGuardianId("");
      await Promise.all([loadApplications(schoolId), loadGuardians(schoolId)]);
    } catch (err) {
      setError(err.message);
    }
  }

  function groupedByStage() {
    const groups = {};
    STAGES.forEach((s) => (groups[s.key] = []));
    applications.forEach((a) => {
      if (groups[a.status]) groups[a.status].push(a);
    });
    return groups;
  }

  const groups = groupedByStage();

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">Admissions</h2>
          <p className="text-sm text-slate-600">Inquiry through enrollment, tracked stage by stage.</p>
        </div>
        {role === "admissions_officer" && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg px-4 py-2 flex items-center gap-1.5"
          >
            <Plus size={16} />
            New Inquiry
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {role && role !== "admissions_officer" && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 flex items-center gap-2.5">
          <Lock size={15} className="text-slate-400 shrink-0" />
          <p className="text-xs text-slate-500">Only the Admissions Officer can log new inquiries. You can view the pipeline here.</p>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-5 mb-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Applicant</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <input placeholder="Applicant full name" value={applicantName} onChange={(e) => setApplicantName(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
              <select value={gender} onChange={(e) => setGender(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
              <ClassSelect classes={classes} value={classId} onChange={setClassId} placeholder="Applying for class" required />
              <input placeholder="Previous school (optional)" value={previousSchool} onChange={(e) => setPreviousSchool(e.target.value)} className="col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-4 mb-2">
              <h3 className="text-sm font-semibold text-slate-800">Guardian</h3>
              <label className="text-xs flex items-center gap-1">
                <input type="radio" checked={guardianMode === "new"} onChange={() => setGuardianMode("new")} /> New
              </label>
              <label className="text-xs flex items-center gap-1">
                <input type="radio" checked={guardianMode === "existing"} onChange={() => setGuardianMode("existing")} /> Existing
              </label>
            </div>
            {guardianMode === "existing" ? (
              <select value={existingGuardianId} onChange={(e) => setExistingGuardianId(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required>
                <option value="">Select guardian</option>
                {guardians.map((g) => <option key={g.id} value={g.id}>{g.full_name} — {g.phone}</option>)}
              </select>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <input placeholder="Guardian name" value={gName} onChange={(e) => setGName(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
                <select value={gRelation} onChange={(e) => setGRelation(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                  <option value="guardian">Guardian</option>
                </select>
                <input placeholder="Phone" value={gPhone} onChange={(e) => setGPhone(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
                <input placeholder="Email (optional)" value={gEmail} onChange={(e) => setGEmail(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
            )}
          </div>

          <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg px-4 py-2">
            Create Application
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        {STAGES.map((stage) => (
          <div key={stage.key} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">{stage.label}</span>
              <span className="text-xs text-slate-400">{groups[stage.key].length}</span>
            </div>
            <div className="p-2 space-y-2 min-h-[80px]">
              {groups[stage.key].map((app) => (
                <button
                  key={app.id}
                  onClick={() => router.push(`/admin/admissions/${app.id}`)}
                  className="w-full text-left bg-slate-50 hover:bg-slate-100 rounded-lg px-3 py-2 transition-colors"
                >
                  <p className="text-sm font-medium text-slate-900">{app.applicant_name}</p>
                  <p className="text-xs text-slate-500">{app.date_of_birth}</p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
