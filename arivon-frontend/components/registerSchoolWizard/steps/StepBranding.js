"use client";

import { useState } from "react";
import { Upload, Check, Loader2 } from "lucide-react";
import WizardStepShell from "../WizardStepShell";
import { platformApiRequest, platformApiUpload } from "../../../lib/platformApi";
import { resolveAssetUrl } from "../../../lib/api";

const ASSETS = [
  { key: "logo", label: "Official School Logo", hint: "JPG or PNG", accept: ".jpg,.jpeg,.png" },
  { key: "banner", label: "School Banner", hint: "JPG or PNG", accept: ".jpg,.jpeg,.png" },
  { key: "seal", label: "School Seal", hint: "PNG only — needs a transparent background", accept: ".png" },
  { key: "letterhead", label: "Letterhead", hint: "A4, PDF or PNG", accept: ".pdf,.png" },
];

function AssetUploadCard({ draftId, asset, currentUrl, onUploaded, setError }) {
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const updated = await platformApiUpload(`/school-registration/${draftId}/branding/${asset.key}`, formData);
      onUploaded(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  const isPdf = currentUrl && currentUrl.toLowerCase().endsWith(".pdf");

  return (
    <div className="border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-slate-800">{asset.label}</p>
        {currentUrl && (
          <span className="text-xs font-medium text-brand-700 flex items-center gap-1">
            <Check size={12} /> Uploaded
          </span>
        )}
      </div>
      <p className="text-xs text-slate-400 mb-3">{asset.hint}</p>

      {currentUrl && !isPdf && (
        <div className="mb-3 w-full h-20 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
          <img src={resolveAssetUrl(currentUrl)} alt={asset.label} className="max-h-full max-w-full object-contain" />
        </div>
      )}
      {currentUrl && isPdf && (
        <div className="mb-3 w-full h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
          <p className="text-xs text-slate-500">PDF uploaded — preview not shown inline</p>
        </div>
      )}

      <label className={`flex items-center justify-center gap-2 text-xs font-medium rounded-lg px-3 py-2 border cursor-pointer transition-colors ${
        uploading ? "border-slate-200 text-slate-400" : "border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}>
        {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
        {uploading ? "Uploading..." : currentUrl ? "Replace file" : "Upload file"}
        <input type="file" accept={asset.accept} onChange={handleFileChange} className="hidden" disabled={uploading} />
      </label>
    </div>
  );
}

export default function StepBranding({ draftId, formData, updateFormData, onBack, onNext, onSkip }) {
  const branding = formData.branding;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    updateFormData("branding", { ...branding, [field]: value });
  }

  function handleAssetUploaded(updatedSchool) {
    // The upload endpoint returns the full updated draft — pull just
    // the four asset URLs back into local form state so the preview
    // and "already uploaded" badge update immediately.
    updateFormData("branding", {
      ...branding,
      logo_url: updatedSchool.logo_url,
      banner_url: updatedSchool.banner_url,
      seal_url: updatedSchool.seal_url,
      letterhead_url: updatedSchool.letterhead_url,
    });
  }

  async function handleNext() {
    setError("");
    setSaving(true);
    try {
      // Colors still save the normal way — only the four file assets
      // moved to direct upload.
      await platformApiRequest(`/school-registration/${draftId}/branding`, {
        method: "PATCH",
        body: { primary_color: branding.primary_color, secondary_color: branding.secondary_color },
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
      return;
    }
    setSaving(false);
    onNext();
  }

  return (
    <WizardStepShell
      title="Branding"
      description="Visual identity used across ID cards, report cards, certificates, and the login screen — every asset here is optional and defaults gracefully."
      onBack={onBack}
      onNext={handleNext}
      saving={saving}
      error={error}
      skippable
      onSkip={onSkip}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {ASSETS.map((asset) => (
          <AssetUploadCard
            key={asset.key}
            draftId={draftId}
            asset={asset}
            currentUrl={branding[`${asset.key}_url`]}
            onUploaded={handleAssetUploaded}
            setError={setError}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Primary Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={branding.primary_color || "#6D5BFF"}
              onChange={(e) => set("primary_color", e.target.value)}
              className="w-10 h-9 rounded border border-slate-200"
            />
            <input
              value={branding.primary_color || ""}
              onChange={(e) => set("primary_color", e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Secondary Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={branding.secondary_color || "#F59E0B"}
              onChange={(e) => set("secondary_color", e.target.value)}
              className="w-10 h-9 rounded border border-slate-200"
            />
            <input
              value={branding.secondary_color || ""}
              onChange={(e) => set("secondary_color", e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>
    </WizardStepShell>
  );
}
