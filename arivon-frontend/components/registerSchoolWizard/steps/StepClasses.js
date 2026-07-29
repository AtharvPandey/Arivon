"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import WizardStepShell from "../WizardStepShell";
import { platformApiRequest } from "../../../lib/platformApi";

const STAGES = [
  { key: "pre_primary", label: "Pre-Primary", detail: "Nursery, LKG, UKG" },
  { key: "primary", label: "Primary School", detail: "Class 1 – 5" },
  { key: "middle", label: "Middle School", detail: "Class 6 – 8" },
  { key: "secondary", label: "Secondary School", detail: "Class 9 – 10" },
  { key: "higher_secondary", label: "Higher Secondary", detail: "Class 11 – 12" },
];

export default function StepClasses({ draftId, formData, updateFormData, onBack, onNext }) {
  const selected = formData.classes_offered.stages || [];
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleStage(key) {
    const updated = selected.includes(key) ? selected.filter((s) => s !== key) : [...selected, key];
    updateFormData("classes_offered", { stages: updated });
  }

  async function handleNext() {
    setError("");
    if (selected.length === 0) {
      setError("Select at least one school stage.");
      return;
    }
    setSaving(true);
    try {
      await platformApiRequest(`/school-registration/${draftId}/classes-offered`, {
        method: "PATCH",
        body: { stages: selected },
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
      title="Classes Offered"
      description="Which school stages this school runs — this determines exactly which classes get created automatically."
      onBack={onBack}
      onNext={handleNext}
      saving={saving}
      error={error}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {STAGES.map((stage) => {
          const isSelected = selected.includes(stage.key);
          return (
            <button
              key={stage.key}
              type="button"
              onClick={() => toggleStage(stage.key)}
              className={`text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                isSelected ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900">{stage.label}</p>
                {isSelected && (
                  <span className="w-5 h-5 rounded-full bg-brand-500 text-white flex items-center justify-center">
                    <Check size={12} />
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{stage.detail}</p>
            </button>
          );
        })}
      </div>

      {selected.length > 0 && (
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
          Classes will be auto-created for: {STAGES.filter((s) => selected.includes(s.key)).map((s) => s.label).join(", ")}
        </p>
      )}
    </WizardStepShell>
  );
}
