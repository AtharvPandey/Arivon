"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Pencil, Camera, X, Check, GraduationCap, CalendarClock } from "lucide-react";
import { apiRequest, apiUpload, isLoggedIn, resolveAssetUrl } from "../../../../../lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm text-slate-900 font-medium">{value || "—"}</span>
    </div>
  );
}

function EditField({ label, value, onChange, type = "text" }) {
  return (
    <div className="py-1.5">
      <label className="block text-[11px] font-medium text-slate-500 mb-1">{label}</label>
      <input
        type={type} value={value || ""} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
      />
    </div>
  );
}

export default function StaffDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [me, setMe] = useState(null);
  const [staffMember, setStaffMember] = useState(null);
  const [profile, setProfile] = useState(null);
  const [teachingLoad, setTeachingLoad] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

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
      const currentUser = await apiRequest("/auth/me");
      setMe(currentUser);

      const staffList = await apiRequest(`/staff/?school_id=${currentUser.school_id}`);
      const member = staffList.find((s) => s.id === Number(params.id));
      setStaffMember(member);

      let profileData = null;
      try {
        profileData = await apiRequest(`/staff/profile/${params.id}`);
      } catch {
        profileData = null; // no profile created yet — edit mode will create one implicitly via update once fields are filled
      }
      setProfile(profileData);
      setForm(profileData || {});

      if (member?.role_name === "teacher") {
        const load = await apiRequest(`/staff/${params.id}/teaching-load`);
        setTeachingLoad(load);
      }

      const balance = await apiRequest(`/leave/balance/${params.id}`);
      setLeaveBalance(balance);
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
        "designation", "department", "qualification", "experience_years", "date_of_joining",
        "phone", "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relation",
      ];
      const payload = {};
      editableFields.forEach((f) => { payload[f] = form[f] ?? null; });

      if (!profile) {
        await apiRequest("/staff/profile", { method: "POST", body: { user_id: Number(params.id), ...payload } });
      } else {
        await apiRequest(`/staff/profile/${params.id}`, { method: "PATCH", body: payload });
      }
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
      await apiUpload(`/staff/profile/${params.id}/photo`, formData);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setPhotoUploading(false);
    }
  }

  if (loading) return <div className="max-w-4xl mx-auto px-6 py-8 text-sm text-slate-600">Loading...</div>;
  if (!staffMember) return <div className="max-w-4xl mx-auto px-6 py-8 text-sm text-slate-600">Staff member not found.</div>;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.push("/admin/people/staff")} className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1">
          <ArrowLeft size={14} /> Back to Staff
        </button>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="text-sm font-medium text-brand-700 border border-brand-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5 hover:bg-brand-50">
            <Pencil size={13} /> Edit Profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={handleSaveEdit} disabled={saving} className="text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <Check size={13} /> {saving ? "Saving..." : "Save Changes"}
            </button>
            <button onClick={() => { setEditing(false); setForm(profile || {}); }} className="text-sm font-medium text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <X size={13} /> Cancel
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Profile */}
        <div className="sm:col-span-1">
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
            <div className="relative w-20 h-20 mx-auto mb-3">
              <div className="w-20 h-20 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-2xl font-bold overflow-hidden">
                {profile?.photo_url ? (
                  <img src={resolveAssetUrl(profile.photo_url)} alt={staffMember.full_name} className="w-full h-full object-cover" />
                ) : (
                  staffMember.full_name.charAt(0)
                )}
              </div>
              <label className="absolute bottom-0 right-0 w-7 h-7 bg-slate-800 hover:bg-slate-900 rounded-full flex items-center justify-center cursor-pointer">
                <Camera size={12} className="text-white" />
                <input type="file" accept="image/jpeg,image/png" onChange={handlePhotoUpload} className="hidden" disabled={photoUploading} />
              </label>
            </div>
            <h2 className="text-lg font-display font-bold text-slate-900">{staffMember.full_name}</h2>
            <p className="text-sm text-slate-500">{staffMember.email}</p>
            <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-2 bg-indigo-100 text-indigo-700 capitalize">
              {(staffMember.role_name || "").replace(/_/g, " ")}
            </span>
            {profile?.employee_id && <p className="text-xs text-slate-400 mt-2">ID: {profile.employee_id}</p>}
          </div>

          {leaveBalance && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 mt-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
                <CalendarClock size={14} className="text-slate-400" /> Leave Balance
              </h3>
              <div className="space-y-2">
                {leaveBalance.balances.map((b) => (
                  <div key={b.leave_type} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{b.leave_type}</span>
                    <span className="text-slate-500">{b.remaining} / {b.annual_quota} left</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {teachingLoad.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 mt-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
                <GraduationCap size={14} className="text-slate-400" /> Teaching Load
              </h3>
              <div className="space-y-2">
                {teachingLoad.map((t, i) => (
                  <div key={i} className="text-xs bg-slate-50 rounded-lg px-2.5 py-2">
                    <p className="font-medium text-slate-800">{t.subject_name}</p>
                    <p className="text-slate-500">{t.class_name} - {t.section_name} · {t.periods_per_week}/week</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="sm:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Employment Details</h3>
            {editing ? (
              <div className="grid grid-cols-2 gap-x-4">
                <EditField label="Designation" value={form.designation} onChange={(v) => setField("designation", v)} />
                <EditField label="Department" value={form.department} onChange={(v) => setField("department", v)} />
                <EditField label="Qualification" value={form.qualification} onChange={(v) => setField("qualification", v)} />
                <EditField label="Experience (years)" type="number" value={form.experience_years} onChange={(v) => setField("experience_years", v)} />
                <EditField label="Date of Joining" type="date" value={form.date_of_joining} onChange={(v) => setField("date_of_joining", v)} />
                <EditField label="Phone" value={form.phone} onChange={(v) => setField("phone", v)} />
              </div>
            ) : (
              <>
                <Row label="Designation" value={profile?.designation} />
                <Row label="Department" value={profile?.department} />
                <Row label="Qualification" value={profile?.qualification} />
                <Row label="Experience" value={profile?.experience_years ? `${profile.experience_years} years` : null} />
                <Row label="Date of Joining" value={profile?.date_of_joining} />
                <Row label="Phone" value={profile?.phone} />
              </>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Emergency Contact</h3>
            {editing ? (
              <div className="grid grid-cols-2 gap-x-4">
                <EditField label="Name" value={form.emergency_contact_name} onChange={(v) => setField("emergency_contact_name", v)} />
                <EditField label="Phone" value={form.emergency_contact_phone} onChange={(v) => setField("emergency_contact_phone", v)} />
                <EditField label="Relation" value={form.emergency_contact_relation} onChange={(v) => setField("emergency_contact_relation", v)} />
              </div>
            ) : (
              <>
                <Row label="Name" value={profile?.emergency_contact_name} />
                <Row label="Phone" value={profile?.emergency_contact_phone} />
                <Row label="Relation" value={profile?.emergency_contact_relation} />
              </>
            )}
          </div>

          <p className="text-xs text-slate-400 px-1">
            Aadhaar, PAN, and bank account details are visible only to Accountant / Super Admin roles, from Finance.
          </p>
        </div>
      </div>
    </div>
  );
}
