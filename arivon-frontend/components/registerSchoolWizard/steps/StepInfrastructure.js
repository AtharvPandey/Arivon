"use client";

import { useState } from "react";
import WizardStepShell from "../WizardStepShell";
import { platformApiRequest } from "../../../lib/platformApi";

export default function StepInfrastructure({ draftId, formData, updateFormData, onBack, onNext, onSkip }) {
  const infra = formData.infrastructure;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    updateFormData("infrastructure", { ...infra, [field]: value });
  }

  async function handleNext() {
    setError("");
    setSaving(true);
    try {
      await platformApiRequest(`/school-registration/${draftId}/infrastructure`, {
        method: "PATCH",
        body: infra,
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
      title="Infrastructure"
      description="A quick, optional snapshot of physical capacity — entirely skippable, fill in later if you'd rather."
      onBack={onBack}
      onNext={handleNext}
      saving={saving}
      error={error}
      skippable
      onSkip={onSkip}
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Campus Area</label>
          <input
            value={infra.campus_area || ""}
            onChange={(e) => set("campus_area", e.target.value)}
            placeholder="e.g. 5 acres"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Sports Facilities</label>
          <select
            value={infra.sports_facilities || ""}
            onChange={(e) => set("sports_facilities", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Select</option>
            <option value="indoor">Indoor</option>
            <option value="outdoor">Outdoor</option>
            <option value="both">Both</option>
            <option value="none">None</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Number of Classrooms</label>
          <input
            type="number"
            value={infra.number_of_classrooms || ""}
            onChange={(e) => set("number_of_classrooms", e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Number of Labs</label>
          <input
            type="number"
            value={infra.number_of_labs || ""}
            onChange={(e) => set("number_of_labs", e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: "has_library", label: "Library" },
          { key: "has_transport", label: "Transport" },
          { key: "has_hostel", label: "Hostel" },
          { key: "has_medical_room", label: "Medical Room" },
        ].map((item) => (
          <label key={item.key} className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2">
            <input
              type="checkbox"
              checked={!!infra[item.key]}
              onChange={(e) => set(item.key, e.target.checked)}
            />
            {item.label}
          </label>
        ))}
      </div>
    </WizardStepShell>
  );
}
