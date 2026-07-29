"use client";

import { useState } from "react";
import WizardStepShell from "../WizardStepShell";
import { platformApiRequest } from "../../../lib/platformApi";

export default function StepOrganizationSettings({ draftId, formData, updateFormData, onBack, onNext }) {
  const settings = formData.organization_settings;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    updateFormData("organization_settings", { ...settings, [field]: value });
  }

  async function handleNext() {
    setError("");
    setSaving(true);
    try {
      await platformApiRequest(`/school-registration/${draftId}/organization-settings`, {
        method: "PATCH",
        body: settings,
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
      title="Organization Settings"
      description="Locale and formatting preferences — most schools can accept these Indian defaults as-is."
      onBack={onBack}
      onNext={handleNext}
      saving={saving}
      error={error}
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Time Zone</label>
          <select
            value={settings.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Currency</label>
          <select
            value={settings.currency}
            onChange={(e) => set("currency", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="INR">INR (₹)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Primary Language (UI)</label>
          <select
            value={settings.primary_language}
            onChange={(e) => set("primary_language", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="english">English</option>
            <option value="hindi">Hindi</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date Format</label>
          <select
            value={settings.date_format}
            onChange={(e) => set("date_format", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="DD-MM-YYYY">DD-MM-YYYY</option>
            <option value="MM-DD-YYYY">MM-DD-YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Number Format</label>
          <select
            value={settings.number_format}
            onChange={(e) => set("number_format", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="indian">Indian (1,00,000)</option>
            <option value="international">International (100,000)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Week Start Day</label>
          <select
            value={settings.week_start_day}
            onChange={(e) => set("week_start_day", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="monday">Monday</option>
            <option value="sunday">Sunday</option>
          </select>
        </div>
      </div>
    </WizardStepShell>
  );
}
