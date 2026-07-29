"use client";

import { useState } from "react";
import WizardStepShell from "../WizardStepShell";
import { platformApiRequest } from "../../../lib/platformApi";

const DAYS = [
  { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" }, { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" }, { key: "sun", label: "Sun" },
];

export default function StepAcademicConfig({ draftId, formData, updateFormData, onBack, onNext, onSkip }) {
  const config = formData.academic_config;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    updateFormData("academic_config", { ...config, [field]: value });
  }

  function toggleDay(day) {
    const current = config.working_days || [];
    const updated = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    set("working_days", updated);
  }

  async function handleNext() {
    setError("");
    setSaving(true);
    try {
      await platformApiRequest(`/school-registration/${draftId}/academic-configuration`, {
        method: "PATCH",
        body: config,
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
      title="Academic Configuration"
      description="The daily operating rhythm of the school — timings, working days, and academic policies."
      onBack={onBack}
      onNext={handleNext}
      saving={saving}
      error={error}
      skippable
      onSkip={onSkip}
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">School Timing (Start)</label>
          <input
            type="time"
            value={config.school_timing_start || ""}
            onChange={(e) => set("school_timing_start", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">School Timing (End)</label>
          <input
            type="time"
            value={config.school_timing_end || ""}
            onChange={(e) => set("school_timing_end", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-2">Working Days</label>
        <div className="flex gap-2">
          {DAYS.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => toggleDay(d.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                (config.working_days || []).includes(d.key)
                  ? "bg-brand-600 border-brand-600 text-white"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Medium of Instruction</label>
          <select
            value={config.medium_of_instruction || ""}
            onChange={(e) => set("medium_of_instruction", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Select</option>
            <option value="english">English</option>
            <option value="hindi">Hindi</option>
            <option value="regional">Regional Language</option>
            <option value="bilingual">Bilingual</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Grading System</label>
          <select
            value={config.grading_system || ""}
            onChange={(e) => set("grading_system", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Select</option>
            <option value="percentage">Percentage</option>
            <option value="gpa_10_point">GPA (10-point)</option>
            <option value="cgpa">CGPA</option>
            <option value="letter_grades">Letter Grades (A-F)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Minimum Attendance % for Promotion</label>
          <input
            type="number"
            min="0"
            max="100"
            value={config.attendance_min_percentage || ""}
            onChange={(e) => set("attendance_min_percentage", e.target.value ? Number(e.target.value) : null)}
            placeholder="e.g. 75"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Promotion Policy</label>
          <select
            value={config.promotion_policy || ""}
            onChange={(e) => set("promotion_policy", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Select</option>
            <option value="automatic">Automatic</option>
            <option value="exam_based">Exam-based</option>
            <option value="combined">Combined (attendance + exam)</option>
          </select>
        </div>
      </div>
    </WizardStepShell>
  );
}
