"use client";

import { useState } from "react";
import WizardStepShell from "../WizardStepShell";
import { platformApiRequest } from "../../../lib/platformApi";

const SCHOOL_TYPES = [
  { value: "private", label: "Private" },
  { value: "government", label: "Government" },
  { value: "government_aided", label: "Government-Aided" },
  { value: "trust_run", label: "Trust-run" },
  { value: "international", label: "International" },
];
const SCHOOL_CATEGORIES = [
  { value: "co_ed", label: "Co-ed" },
  { value: "boys", label: "Boys" },
  { value: "girls", label: "Girls" },
];

export default function StepIdentity({ draftId, formData, updateFormData, onBack, onNext, isFirst }) {
  const identity = formData.identity;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    updateFormData("identity", { ...identity, [field]: value });
  }

  async function handleNext() {
    setError("");
    if (!identity.name || !identity.school_type || !identity.school_category) {
      setError("School name, type, and category are required.");
      return;
    }

    if (draftId) {
      // Editing an existing draft (resume flow) — persist immediately.
      setSaving(true);
      try {
        await platformApiRequest(`/school-registration/${draftId}/draft`, {
          method: "PATCH",
          body: { identity },
        });
      } catch (err) {
        setError(err.message);
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    onNext();
  }

  return (
    <WizardStepShell
      title="School Identity"
      description="The core identity that will appear everywhere in Arivon, from the login screen to report cards."
      onBack={onBack}
      onNext={handleNext}
      isFirst={isFirst}
      saving={saving}
      error={error}
    >
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">School Name *</label>
        <input
          autoFocus
          value={identity.name || ""}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Green Valley Public School"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Short Name (optional)</label>
        <input
          value={identity.short_name || ""}
          onChange={(e) => set("short_name", e.target.value)}
          placeholder="Used in tight UI spaces, e.g. 'GVPS'"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">School Type *</label>
          <select
            value={identity.school_type || ""}
            onChange={(e) => set("school_type", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Select type</option>
            {SCHOOL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">School Category *</label>
          <select
            value={identity.school_category || ""}
            onChange={(e) => set("school_category", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Select category</option>
            {SCHOOL_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Year Established</label>
          <input
            type="number"
            value={identity.year_established || ""}
            onChange={(e) => set("year_established", e.target.value ? Number(e.target.value) : null)}
            placeholder="e.g. 1998"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Motto / Tagline</label>
          <input
            value={identity.motto || ""}
            onChange={(e) => set("motto", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>
    </WizardStepShell>
  );
}
