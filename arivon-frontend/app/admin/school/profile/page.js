"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Camera, Pencil, Check, X, FileBadge2, MapPin, Clock, Users2,
  Globe, Mail, Phone, Calendar, ShieldCheck, Landmark,
} from "lucide-react";
import { apiRequest, apiUpload, isLoggedIn, resolveAssetUrl } from "../../../../lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const EDIT_ROLES = ["school_admin", "administrator", "super_admin"];

function Field({ label, value, editing, onChange, type = "text", placeholder }) {
  if (editing) {
    return (
      <div>
        <label className="block text-[11px] font-medium text-slate-500 mb-1">{label}</label>
        <input
          type={type} value={value || ""} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-100 outline-none transition-all"
        />
      </div>
    );
  }
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-slate-800 font-medium">{value || <span className="text-slate-300 font-normal">Not set</span>}</p>
    </div>
  );
}

function SectionCard({ icon: Icon, iconColor, title, subtitle, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconColor}`}>
          <Icon size={16} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      <div className="p-6 grid grid-cols-2 gap-x-6 gap-y-5">{children}</div>
    </div>
  );
}

export default function SchoolProfilePage() {
  const router = useRouter();
  const [school, setSchool] = useState(null);
  const [form, setForm] = useState({});
  const [role, setRole] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    load();
  }, []);

  async function load() {
    try {
      const me = await apiRequest("/auth/me");
      setRole(me.role_name);
      const data = await apiRequest(`/schools/${me.school_id}`);
      setSchool(data);
      setForm(data);
    } catch (err) {
      setError(err.message);
    }
  }

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(""); setSaved(false);
    try {
      const editableFields = [
        "name", "board_type", "city", "state", "contact_email", "contact_phone", "address",
        "short_name", "school_type", "year_established", "motto",
        "state_board_name", "udise_code", "affiliation_number", "recognition_number",
        "trust_registration_number", "pan_number", "gst_number",
        "address_line_2", "pincode", "website_url", "google_maps_url",
        "school_timing_start", "school_timing_end", "medium_of_instruction",
        "grading_system", "attendance_min_percentage", "promotion_policy",
        "trust_name", "chairman_name", "managing_director_name",
      ];
      const payload = {};
      editableFields.forEach((f) => { payload[f] = form[f] || null; });

      const updated = await apiRequest(`/schools/${school.id}`, { method: "PATCH", body: payload });
      setSchool(updated);
      setForm(updated);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLogoUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const updated = await apiUpload(`/schools/${school.id}/logo`, formData);
      setSchool(updated);
      setForm(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setLogoUploading(false);
    }
  }

  if (!school) return (
    <div className="max-w-4xl mx-auto px-6 py-8 animate-pulse space-y-5">
      <div className="h-44 bg-slate-200 rounded-2xl" />
      <div className="h-64 bg-slate-200 rounded-2xl" />
    </div>
  );

  const canEdit = EDIT_ROLES.includes(role);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">School Profile</h2>
          <p className="text-sm text-slate-600">Identity, recognition, contact, and academic configuration.</p>
        </div>
        {canEdit && (
          !editing ? (
            <button onClick={() => setEditing(true)} className="text-sm font-medium text-brand-700 border border-brand-200 rounded-lg px-3.5 py-2 flex items-center gap-1.5 hover:bg-brand-50 transition-colors shrink-0">
              <Pencil size={13} /> Edit Profile
            </button>
          ) : (
            <div className="flex gap-2 shrink-0">
              <button onClick={handleSave} disabled={saving} className="text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg px-3.5 py-2 flex items-center gap-1.5">
                <Check size={13} /> {saving ? "Saving..." : "Save Changes"}
              </button>
              <button onClick={() => { setEditing(false); setForm(school); }} className="text-sm font-medium text-slate-600 border border-slate-200 rounded-lg px-3.5 py-2 flex items-center gap-1.5 hover:bg-slate-50">
                <X size={13} /> Cancel
              </button>
            </div>
          )
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}
      {saved && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-4 flex items-center gap-1.5"><Check size={14} /> Saved successfully.</p>}
      {!canEdit && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 flex items-center gap-2.5">
          <ShieldCheck size={15} className="text-slate-400 shrink-0" />
          <p className="text-xs text-slate-500">Only the School Admin can edit the school profile. You can view everything here.</p>
        </div>
      )}

      {/* Header card — simple, flat, single background, no overlapping
          elements. The gradient-banner-with-logo-overlap pattern kept
          rendering with a visible seam, so this drops that entirely in
          favor of something that just works: one card, logo and name
          side by side, colored badges below. */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-5">
        <div className="flex items-center gap-5">
          <div className="relative w-20 h-20 shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center overflow-hidden">
              {school.logo_url ? (
                <img src={resolveAssetUrl(school.logo_url)} alt={school.name} className="w-full h-full object-cover" />
              ) : (
                <Building2 size={28} className="text-indigo-300" />
              )}
            </div>
            {canEdit && (
              <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-slate-800 hover:bg-slate-900 rounded-full flex items-center justify-center cursor-pointer shadow-md transition-colors">
                <Camera size={12} className="text-white" />
                <input type="file" accept="image/jpeg,image/png,image/svg+xml" onChange={handleLogoUpload} className="hidden" disabled={logoUploading} />
              </label>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <input value={form.name || ""} onChange={(e) => setField("name", e.target.value)} className="w-full text-xl font-display font-bold text-slate-900 border-b border-slate-200 focus:border-brand-400 outline-none pb-1" />
            ) : (
              <h3 className="text-xl font-display font-bold text-slate-900 truncate">{school.name}</h3>
            )}
            <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
              <MapPin size={12} /> {school.city}{school.state && `, ${school.state}`}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">{school.board_type}</span>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-teal-100 text-teal-700 capitalize">{school.education_level.replace(/_/g, " ")}</span>
              {school.year_established && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">Est. {school.year_established}</span>}
              {school.short_name && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{school.short_name}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <SectionCard icon={Building2} iconColor="bg-indigo-50 text-indigo-600" title="Identity" subtitle="Core school details">
          <Field label="School Name" value={editing ? form.name : school.name} editing={editing} onChange={(v) => setField("name", v)} />
          <Field label="Short Name" value={editing ? form.short_name : school.short_name} editing={editing} onChange={(v) => setField("short_name", v)} placeholder="e.g. GVPS" />
          <Field label="Board Type" value={editing ? form.board_type : school.board_type} editing={editing} onChange={(v) => setField("board_type", v)} />
          <Field label="Year Established" type="number" value={editing ? form.year_established : school.year_established} editing={editing} onChange={(v) => setField("year_established", v)} />
          <div className="col-span-2">
            <Field label="Motto" value={editing ? form.motto : school.motto} editing={editing} onChange={(v) => setField("motto", v)} placeholder="e.g. Excellence Through Discipline" />
          </div>
        </SectionCard>

        <SectionCard icon={ShieldCheck} iconColor="bg-emerald-50 text-emerald-600" title="Government Recognition & Affiliations" subtitle="Statutory registration numbers">
          <Field label="UDISE Code" value={editing ? form.udise_code : school.udise_code} editing={editing} onChange={(v) => setField("udise_code", v)} placeholder="11-digit code" />
          <Field label="Affiliation Number" value={editing ? form.affiliation_number : school.affiliation_number} editing={editing} onChange={(v) => setField("affiliation_number", v)} />
          <Field label="Recognition Number" value={editing ? form.recognition_number : school.recognition_number} editing={editing} onChange={(v) => setField("recognition_number", v)} />
          <Field label="Trust Registration Number" value={editing ? form.trust_registration_number : school.trust_registration_number} editing={editing} onChange={(v) => setField("trust_registration_number", v)} />
          <Field label="PAN Number" value={editing ? form.pan_number : school.pan_number} editing={editing} onChange={(v) => setField("pan_number", v)} />
          <Field label="GST Number" value={editing ? form.gst_number : school.gst_number} editing={editing} onChange={(v) => setField("gst_number", v)} />
        </SectionCard>

        <SectionCard icon={MapPin} iconColor="bg-rose-50 text-rose-600" title="Contact & Address" subtitle="How to reach the school">
          <Field label="Contact Email" type="email" value={editing ? form.contact_email : school.contact_email} editing={editing} onChange={(v) => setField("contact_email", v)} />
          <Field label="Contact Phone" value={editing ? form.contact_phone : school.contact_phone} editing={editing} onChange={(v) => setField("contact_phone", v)} />
          <Field label="City" value={editing ? form.city : school.city} editing={editing} onChange={(v) => setField("city", v)} />
          <Field label="State" value={editing ? form.state : school.state} editing={editing} onChange={(v) => setField("state", v)} />
          <Field label="Pincode" value={editing ? form.pincode : school.pincode} editing={editing} onChange={(v) => setField("pincode", v)} />
          <Field label="Website" value={editing ? form.website_url : school.website_url} editing={editing} onChange={(v) => setField("website_url", v)} placeholder="https://" />
          <div className="col-span-2">
            <Field label="Address" value={editing ? form.address : school.address} editing={editing} onChange={(v) => setField("address", v)} />
          </div>
          <div className="col-span-2">
            <Field label="Address Line 2" value={editing ? form.address_line_2 : school.address_line_2} editing={editing} onChange={(v) => setField("address_line_2", v)} />
          </div>
        </SectionCard>

        <SectionCard icon={Clock} iconColor="bg-amber-50 text-amber-600" title="Academic Configuration" subtitle="How the school runs day to day">
          <Field label="School Start Time" type="time" value={editing ? form.school_timing_start : school.school_timing_start} editing={editing} onChange={(v) => setField("school_timing_start", v)} />
          <Field label="School End Time" type="time" value={editing ? form.school_timing_end : school.school_timing_end} editing={editing} onChange={(v) => setField("school_timing_end", v)} />
          <Field label="Medium of Instruction" value={editing ? form.medium_of_instruction : school.medium_of_instruction} editing={editing} onChange={(v) => setField("medium_of_instruction", v)} placeholder="e.g. English" />
          <Field label="Grading System" value={editing ? form.grading_system : school.grading_system} editing={editing} onChange={(v) => setField("grading_system", v)} placeholder="e.g. CBSE CCE" />
          <Field label="Minimum Attendance %" type="number" value={editing ? form.attendance_min_percentage : school.attendance_min_percentage} editing={editing} onChange={(v) => setField("attendance_min_percentage", v)} placeholder="75" />
          <Field label="Promotion Policy" value={editing ? form.promotion_policy : school.promotion_policy} editing={editing} onChange={(v) => setField("promotion_policy", v)} />
        </SectionCard>

        <SectionCard icon={Landmark} iconColor="bg-violet-50 text-violet-600" title="Management & Trust" subtitle="Governing body">
          <Field label="Trust Name" value={editing ? form.trust_name : school.trust_name} editing={editing} onChange={(v) => setField("trust_name", v)} />
          <Field label="Chairman Name" value={editing ? form.chairman_name : school.chairman_name} editing={editing} onChange={(v) => setField("chairman_name", v)} />
          <Field label="Managing Director Name" value={editing ? form.managing_director_name : school.managing_director_name} editing={editing} onChange={(v) => setField("managing_director_name", v)} />
        </SectionCard>
      </div>
    </div>
  );
}
