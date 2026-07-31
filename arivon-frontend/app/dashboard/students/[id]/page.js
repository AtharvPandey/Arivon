"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Users, FileOutput, RotateCcw, Pencil, Camera, X, Check } from "lucide-react";
import { apiRequest, apiUpload, isLoggedIn, downloadAuthenticatedFile, resolveAssetUrl } from "../../../../lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STATUS_STYLES = {
  present: "bg-brand-100 text-brand-700",
  absent: "bg-amber-100 text-amber-700",
  late: "bg-slate-100 text-slate-600",
  excused: "bg-slate-100 text-slate-600",
};

const CATEGORIES = ["General", "OBC", "SC", "ST", "EWS"];

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900 font-medium">{value || "—"}</span>
    </div>
  );
}

function EditField({ label, value, onChange, type = "text", options }) {
  return (
    <div className="py-1.5">
      <label className="block text-[11px] font-medium text-slate-500 mb-1">{label}</label>
      {options ? (
        <select value={value || ""} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm">
          <option value="">—</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={type} value={value || ""} onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
        />
      )}
    </div>
  );
}

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [student, setStudent] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [siblings, setSiblings] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [showTCForm, setShowTCForm] = useState(false);
  const [leavingDate, setLeavingDate] = useState("");
  const [leavingReason, setLeavingReason] = useState("");
  const [tcResult, setTcResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [photoUploading, setPhotoUploading] = useState(false);

  const [busRoutes, setBusRoutes] = useState([]);
  const [busStops, setBusStops] = useState([]);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/");
      return;
    }
    load();
  }, [params.id]);

  async function load() {
    setLoading(true);
    try {
      const data = await apiRequest(`/students/${params.id}/detail`);
      setStudent(data);
      setForm(data);
      const [history, siblingList, routesList] = await Promise.all([
        apiRequest(`/attendance/student/${params.id}`),
        apiRequest(`/students/${params.id}/siblings`),
        apiRequest(`/transport/routes?school_id=${data.school_id}`),
      ]);
      setAttendance(history.sort((a, b) => new Date(b.date) - new Date(a.date)));
      setSiblings(siblingList);
      setBusRoutes(routesList);
      if (data.bus_route_id) {
        const stopsList = await apiRequest(`/transport/routes/${data.bus_route_id}/stops`);
        setBusStops(stopsList);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSaveEdit() {
    setSaving(true);
    setError("");
    try {
      const editableFields = [
        "full_name", "date_of_birth", "gender", "blood_group", "category", "religion",
        "nationality", "mother_tongue", "guardian_name", "guardian_phone", "guardian_email",
        "father_name", "mother_name", "address", "aadhaar_number", "previous_school",
        "medical_notes", "bus_route_id", "bus_stop_id",
      ];
      const payload = {};
      editableFields.forEach((f) => { payload[f] = form[f] ?? null; });

      await apiRequest(`/students/${params.id}`, { method: "PATCH", body: payload });
      setEditing(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiUpload(`/students/${params.id}/photo`, formData);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleGenerateTC(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await apiRequest(`/students/${params.id}/transfer-certificate`, {
        method: "POST",
        body: { date_of_leaving: leavingDate, leaving_reason: leavingReason },
      });
      setTcResult(result);
      setShowTCForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReadmit() {
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/students/${params.id}/readmit`, {
        method: "POST",
        body: { academic_year_id: student.academic_year_id, section_id: student.section_id },
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const presentCount = attendance.filter((a) => a.status === "present").length;
  const attendanceRate = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.push("/dashboard/students")} className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1">
          <ArrowLeft size={14} /> Back to Students
        </button>
        {student && !editing && (
          <button onClick={() => setEditing(true)} className="text-sm font-medium text-brand-700 border border-brand-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5 hover:bg-brand-50">
            <Pencil size={13} /> Edit Profile
          </button>
        )}
        {editing && (
          <div className="flex gap-2">
            <button onClick={handleSaveEdit} disabled={saving} className="text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <Check size={13} /> {saving ? "Saving..." : "Save Changes"}
            </button>
            <button onClick={() => { setEditing(false); setForm(student); }} className="text-sm font-medium text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <X size={13} /> Cancel
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-600">Loading...</p>
      ) : student ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Profile */}
          <div className="sm:col-span-1">
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
              <div className="relative w-20 h-20 mx-auto mb-3">
                <div className="w-20 h-20 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-2xl font-bold overflow-hidden">
                  {student.photo_url ? (
                    <img src={resolveAssetUrl(student.photo_url)} alt={student.full_name} className="w-full h-full object-cover" />
                  ) : (
                    student.full_name.charAt(0)
                  )}
                </div>
                <label className="absolute bottom-0 right-0 w-7 h-7 bg-slate-800 hover:bg-slate-900 rounded-full flex items-center justify-center cursor-pointer">
                  <Camera size={12} className="text-white" />
                  <input type="file" accept="image/jpeg,image/png" onChange={handlePhotoUpload} className="hidden" disabled={photoUploading} />
                </label>
              </div>
              {editing ? (
                <input
                  value={form.full_name || ""} onChange={(e) => setField("full_name", e.target.value)}
                  className="w-full text-center font-display font-bold text-lg rounded-lg border border-slate-200 px-2 py-1 mb-1"
                />
              ) : (
                <h2 className="text-lg font-display font-bold text-slate-900">{student.full_name}</h2>
              )}
              <p className="text-sm text-slate-500">Adm. No. {student.admission_number}</p>
              <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-2 ${student.is_active ? "bg-brand-100 text-brand-700" : "bg-slate-200 text-slate-600"}`}>
                {student.is_active ? "Active" : "Inactive"}
              </span>
              {attendanceRate !== null && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-3xl font-bold text-brand-700">{attendanceRate}%</p>
                  <p className="text-xs text-slate-500">Attendance rate</p>
                </div>
              )}

              {!editing && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                  {student.is_active ? (
                    showTCForm ? (
                      <form onSubmit={handleGenerateTC} className="text-left space-y-2">
                        <input
                          type="date" value={leavingDate} onChange={(e) => setLeavingDate(e.target.value)} required
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                        />
                        <input
                          value={leavingReason} onChange={(e) => setLeavingReason(e.target.value)}
                          placeholder="Reason for leaving" required
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                        />
                        <div className="flex gap-1.5">
                          <button type="submit" disabled={saving} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg py-1.5">
                            {saving ? "Generating..." : "Confirm"}
                          </button>
                          <button type="button" onClick={() => setShowTCForm(false)} className="text-xs text-slate-500 px-2">Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <button
                        onClick={() => setShowTCForm(true)}
                        className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-rose-700 border border-rose-200 rounded-lg py-2 hover:bg-rose-50"
                      >
                        <FileOutput size={13} /> Generate Transfer Certificate
                      </button>
                    )
                  ) : (
                    <button
                      onClick={handleReadmit}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-brand-700 border border-brand-200 rounded-lg py-2 hover:bg-brand-50 disabled:opacity-60"
                    >
                      <RotateCcw size={13} /> {saving ? "Re-admitting..." : "Re-admit Student"}
                    </button>
                  )}
                  {tcResult && (
                    <button
                      onClick={() => downloadAuthenticatedFile(tcResult.download_url, `TC_${student.full_name.replace(/ /g, "_")}.pdf`)}
                      className="block w-full text-center text-xs font-medium text-brand-700 underline"
                    >
                      Download TC ({tcResult.tc_number})
                    </button>
                  )}
                  {!student.is_active && student.tc_number && (
                    <p className="text-xs text-slate-500">TC No: {student.tc_number}</p>
                  )}
                </div>
              )}
            </div>

            {siblings.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 mt-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Users size={14} className="text-slate-400" /> Siblings
                </h3>
                <div className="space-y-2">
                  {siblings.map((sib) => (
                    <button
                      key={sib.id}
                      onClick={() => router.push(`/dashboard/students/${sib.id}`)}
                      className="w-full text-left text-xs bg-slate-50 hover:bg-slate-100 rounded-lg px-2.5 py-2"
                    >
                      <p className="font-medium text-slate-800">{sib.full_name}</p>
                      <p className="text-slate-500">{sib.admission_number}{sib.section_name && ` · ${sib.section_name}`}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="sm:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Basic Details</h3>
              {editing ? (
                <div className="grid grid-cols-2 gap-x-4">
                  <EditField label="Date of Birth" type="date" value={form.date_of_birth} onChange={(v) => setField("date_of_birth", v)} />
                  <EditField label="Gender" value={form.gender} onChange={(v) => setField("gender", v)} options={["Male", "Female"]} />
                  <EditField label="Blood Group" value={form.blood_group} onChange={(v) => setField("blood_group", v)} />
                  <EditField label="Category" value={form.category} onChange={(v) => setField("category", v)} options={CATEGORIES} />
                  <EditField label="Religion" value={form.religion} onChange={(v) => setField("religion", v)} />
                  <EditField label="Nationality" value={form.nationality} onChange={(v) => setField("nationality", v)} />
                  <EditField label="Mother Tongue" value={form.mother_tongue} onChange={(v) => setField("mother_tongue", v)} />
                  <EditField label="Aadhaar Number" value={form.aadhaar_number} onChange={(v) => setField("aadhaar_number", v)} />
                  <div className="col-span-2">
                    <EditField label="Medical Notes (allergies, conditions)" value={form.medical_notes} onChange={(v) => setField("medical_notes", v)} />
                  </div>
                </div>
              ) : (
                <>
                  <Row label="Date of Birth" value={student.date_of_birth} />
                  <Row label="Gender" value={student.gender} />
                  <Row label="Blood Group" value={student.blood_group} />
                  <Row label="Category" value={student.category} />
                  <Row label="Religion" value={student.religion} />
                  <Row label="Nationality" value={student.nationality} />
                  <Row label="Mother Tongue" value={student.mother_tongue} />
                  <Row label="Aadhaar Number" value={student.aadhaar_number} />
                  {student.medical_notes && <Row label="Medical Notes" value={student.medical_notes} />}
                </>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Guardian & Contact</h3>
              {editing ? (
                <div className="grid grid-cols-2 gap-x-4">
                  <EditField label="Father's Name" value={form.father_name} onChange={(v) => setField("father_name", v)} />
                  <EditField label="Mother's Name" value={form.mother_name} onChange={(v) => setField("mother_name", v)} />
                  <EditField label="Guardian Name" value={form.guardian_name} onChange={(v) => setField("guardian_name", v)} />
                  <EditField label="Guardian Phone" value={form.guardian_phone} onChange={(v) => setField("guardian_phone", v)} />
                  <EditField label="Guardian Email" value={form.guardian_email} onChange={(v) => setField("guardian_email", v)} />
                  <EditField label="Previous School" value={form.previous_school} onChange={(v) => setField("previous_school", v)} />
                  <div className="col-span-2">
                    <EditField label="Address" value={form.address} onChange={(v) => setField("address", v)} />
                  </div>
                </div>
              ) : (
                <>
                  <Row label="Father's Name" value={student.father_name} />
                  <Row label="Mother's Name" value={student.mother_name} />
                  <Row label="Guardian Name" value={student.guardian_name} />
                  <Row label="Guardian Phone" value={student.guardian_phone} />
                  <Row label="Guardian Email" value={student.guardian_email} />
                  <Row label="Address" value={student.address} />
                  <Row label="Previous School" value={student.previous_school} />
                </>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Transport</h3>
              {editing ? (
                <div className="grid grid-cols-2 gap-x-4">
                  <div className="py-1.5">
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Bus Route</label>
                    <select
                      value={form.bus_route_id || ""}
                      onChange={async (e) => {
                        const routeId = e.target.value ? Number(e.target.value) : null;
                        setField("bus_route_id", routeId);
                        setField("bus_stop_id", null);
                        if (routeId) {
                          const stopsList = await apiRequest(`/transport/routes/${routeId}/stops`);
                          setBusStops(stopsList);
                        } else {
                          setBusStops([]);
                        }
                      }}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                    >
                      <option value="">Not assigned</option>
                      {busRoutes.map((r) => <option key={r.id} value={r.id}>{r.route_name}</option>)}
                    </select>
                  </div>
                  <div className="py-1.5">
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Bus Stop</label>
                    <select
                      value={form.bus_stop_id || ""}
                      onChange={(e) => setField("bus_stop_id", e.target.value ? Number(e.target.value) : null)}
                      disabled={!form.bus_route_id}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm disabled:bg-slate-50"
                    >
                      <option value="">Select a stop</option>
                      {busStops.map((s) => <option key={s.id} value={s.id}>{s.stop_name}</option>)}
                    </select>
                  </div>
                </div>
              ) : student.bus_route_id ? (
                <>
                  <Row label="Route" value={busRoutes.find((r) => r.id === student.bus_route_id)?.route_name} />
                  <Row label="Stop" value={busStops.find((s) => s.id === student.bus_stop_id)?.stop_name} />
                </>
              ) : (
                <p className="text-sm text-slate-500">No transport assigned.</p>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Recent Attendance</h3>
              {attendance.length === 0 ? (
                <p className="text-sm text-slate-500">No attendance records yet.</p>
              ) : (
                <div className="space-y-2">
                  {attendance.slice(0, 8).map((a) => (
                    <div key={a.id} className="flex items-center justify-between">
                      <span className="text-sm text-slate-700">{a.date}</span>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[a.status]}`}
                      >
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
