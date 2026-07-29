"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, Upload, PartyPopper } from "lucide-react";
import { platformApiRequest, platformApiUpload } from "../../../lib/platformApi";

const DOC_TYPES = [
  { value: "affiliation_certificate", label: "Affiliation Certificate" },
  { value: "trust_registration", label: "Trust Registration" },
  { value: "fire_safety_certificate", label: "Fire Safety Certificate" },
  { value: "building_safety_certificate", label: "Building Safety Certificate" },
  { value: "recognition_certificate", label: "Recognition Certificate" },
  { value: "other", label: "Other" },
];

const STATUS_STYLES = {
  valid: "bg-brand-100 text-brand-700",
  expiring_soon: "bg-amber-100 text-amber-700",
  expired: "bg-red-100 text-red-700",
  no_expiry: "bg-slate-100 text-slate-600",
};

export default function StepReview({ draftId, onBack }) {
  const router = useRouter();
  const [review, setReview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [docType, setDocType] = useState("affiliation_certificate");
  const [uploading, setUploading] = useState(false);

  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    loadReview();
  }, []);

  async function loadReview() {
    setLoading(true);
    try {
      const data = await platformApiRequest(`/school-registration/${draftId}/review`);
      setReview(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("document_type", docType);
      formData.append("file", file);
      await platformApiUpload(`/school-registration/${draftId}/documents`, formData);
      await loadReview();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleCreateSchool() {
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters and contain a digit.");
      return;
    }
    setCreating(true);
    try {
      const data = await platformApiRequest(`/school-registration/${draftId}/create`, {
        method: "POST",
        body: { admin_password: password },
      });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  if (result) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mx-auto mb-4">
          <PartyPopper size={26} />
        </div>
        <h3 className="text-xl font-display font-bold text-slate-900 mb-1">
          {result.school_name} is live on Arivon
        </h3>
        <p className="text-sm text-slate-600 mb-6">
          {result.classes_created} classes and {result.departments_created} departments were auto-provisioned.
        </p>

        <div className="bg-slate-50 rounded-lg p-4 mb-6 text-left max-w-sm mx-auto">
          <p className="text-xs text-slate-500 mb-1">School Admin login</p>
          <p className="text-sm font-medium text-slate-900">{result.admin_login_email}</p>
        </div>

        <div className="text-left max-w-sm mx-auto mb-6">
          {result.provisioning_steps.map((step) => (
            <div key={step.step} className="flex items-center gap-2 text-xs text-slate-600 py-1">
              <CheckCircle2 size={14} className="text-brand-600 shrink-0" />
              {step.step.replace(/_/g, " ")}
            </div>
          ))}
        </div>

        <button
          onClick={() => router.push("/platform/dashboard")}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg px-5 py-2.5"
        >
          Back to Platform Dashboard
        </button>
      </div>
    );
  }

  if (loading) return <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-600">Loading review...</div>;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <h3 className="text-lg font-display font-bold text-slate-900 mb-1">Review & Confirmation</h3>
      <p className="text-sm text-slate-600 mb-6">
        One last check before {review?.sections.find((s) => s.section === "identity")?.data.name || "this school"} goes live.
      </p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {review?.blocking_issues.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">Before you can create this school:</p>
          </div>
          <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5">
            {review.blocking_issues.map((issue, i) => <li key={i}>{issue}</li>)}
          </ul>
        </div>
      )}

      <div className="space-y-2 mb-6">
        {review?.sections.map((section) => (
          <div key={section.section} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
            <span className="text-sm text-slate-700 capitalize">{section.section.replace(/_/g, " ")}</span>
            {section.complete ? (
              <span className="flex items-center gap-1 text-xs font-medium text-brand-700">
                <CheckCircle2 size={13} /> Complete
              </span>
            ) : (
              <span className="text-xs font-medium text-slate-400">Optional / Skipped</span>
            )}
          </div>
        ))}
      </div>

      <div className="bg-slate-50 rounded-lg p-4 mb-6">
        <p className="text-xs font-medium text-slate-600 mb-2">
          {review?.classes_to_be_created.length} classes will be auto-created:
        </p>
        <p className="text-xs text-slate-500">{review?.classes_to_be_created.join(", ")}</p>
      </div>

      {/* Documents */}
      <div className="mb-6">
        <p className="text-sm font-semibold text-slate-800 mb-2">Documents</p>
        <div className="flex items-center gap-2 mb-3">
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
          >
            {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg px-3 py-2 flex items-center gap-1.5">
            <Upload size={13} /> {uploading ? "Uploading..." : "Upload File"}
            <input type="file" onChange={handleUpload} disabled={uploading} className="hidden" />
          </label>
        </div>
        {review?.documents.length === 0 ? (
          <p className="text-xs text-slate-500">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-1.5">
            {review.documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-700 capitalize">{d.document_type.replace(/_/g, " ")} — {d.original_filename}</span>
                <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[d.computed_status]}`}>
                  {d.computed_status.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create School */}
      <div className="border-t border-slate-100 pt-5">
        <label htmlFor="school-admin-password" className="text-sm font-semibold text-slate-800 mb-2 block">
          Set the School Admin password
        </label>
        <p id="password-hint" className="text-xs text-slate-500 mb-3">
          This is the only time this password is ever entered — never stored until this exact moment.
        </p>
        <div className="flex gap-3">
          <input
            id="school-admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters, 1 digit"
            aria-describedby="password-hint"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            onClick={handleCreateSchool}
            disabled={creating || !review?.ready_to_create}
            aria-label="Create School"
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-5 py-2.5 whitespace-nowrap"
          >
            {creating ? "Creating..." : "Create School"}
          </button>
        </div>
      </div>

      <button onClick={onBack} className="text-sm font-medium text-slate-600 hover:text-slate-900 mt-6">
        ← Back
      </button>
    </div>
  );
}
