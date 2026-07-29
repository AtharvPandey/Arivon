"use client";

import { useState } from "react";
import WizardStepShell from "../WizardStepShell";
import { platformApiRequest } from "../../../lib/platformApi";

export default function StepBranding({ draftId, formData, updateFormData, onBack, onNext, onSkip }) {
  const branding = formData.branding;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    updateFormData("branding", { ...branding, [field]: value });
  }

  async function handleNext() {
    setError("");
    setSaving(true);
    try {
      await platformApiRequest(`/school-registration/${draftId}/branding`, {
        method: "PATCH",
        body: branding,
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
      description="Visual identity used across ID cards, report cards, and the login screen — every field here is optional and defaults gracefully."
      onBack={onBack}
      onNext={handleNext}
      saving={saving}
      error={error}
      skippable
      onSkip={onSkip}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Logo URL</label>
            <input
              value={branding.logo_url || ""}
              onChange={(e) => set("logo_url", e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Banner URL</label>
            <input
              value={branding.banner_url || ""}
              onChange={(e) => set("banner_url", e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
        </div>

        {/* Live preview */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">Preview</p>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div
              className="h-20 flex items-center px-4"
              style={{ backgroundColor: branding.primary_color || "#6D5BFF" }}
            >
              {branding.logo_url ? (
                <img src={branding.logo_url} alt="Logo preview" className="h-10 w-10 rounded bg-white object-contain p-1" />
              ) : (
                <div className="h-10 w-10 rounded bg-white/20 flex items-center justify-center text-white text-xs font-bold">
                  LOGO
                </div>
              )}
              <span className="ml-3 text-white font-display font-semibold">
                {formData.identity.name || "Your School Name"}
              </span>
            </div>
            <div className="p-4 bg-slate-50">
              <p className="text-xs text-slate-500">This is how your sidebar/login accent will look.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 pt-2">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Letterhead URL</label>
          <input
            value={branding.letterhead_url || ""}
            onChange={(e) => set("letterhead_url", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">School Seal URL</label>
          <input
            value={branding.seal_url || ""}
            onChange={(e) => set("seal_url", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>
    </WizardStepShell>
  );
}
