"use client";

import { useState } from "react";
import WizardStepShell from "../WizardStepShell";
import { platformApiRequest } from "../../../lib/platformApi";

const BOARDS = [
  { value: "CBSE", label: "CBSE" },
  { value: "ICSE", label: "ICSE" },
  { value: "state_board", label: "State Board" },
  { value: "IB", label: "IB" },
  { value: "IGCSE", label: "IGCSE" },
  { value: "NIOS", label: "NIOS" },
  { value: "other", label: "Other" },
];

export default function StepGovernmentRecognition({ draftId, formData, updateFormData, onBack, onNext }) {
  const gov = formData.government_recognition;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    updateFormData("government_recognition", { ...gov, [field]: value });
  }

  async function handleNext() {
    setError("");
    if (!gov.board_type) {
      setError("Education Board is required.");
      return;
    }
    if (gov.board_type === "state_board" && !gov.state_board_name) {
      setError("State Board Name is required when Education Board is 'State Board'.");
      return;
    }
    if (gov.udise_code && gov.udise_code.length !== 11) {
      setError("UDISE+ code must be exactly 11 digits.");
      return;
    }

    if (draftId) {
      setSaving(true);
      try {
        await platformApiRequest(`/school-registration/${draftId}/draft`, {
          method: "PATCH",
          body: { government_recognition: gov },
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
      title="Government Recognition & Affiliations"
      description="Official identifiers used for compliance reporting and government scheme exports."
      onBack={onBack}
      onNext={handleNext}
      saving={saving}
      error={error}
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Education Board *</label>
          <select
            value={gov.board_type || ""}
            onChange={(e) => set("board_type", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Select board</option>
            {BOARDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>
        {gov.board_type === "state_board" && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">State Board Name *</label>
            <input
              value={gov.state_board_name || ""}
              onChange={(e) => set("state_board_name", e.target.value)}
              placeholder="e.g. Karnataka State Board"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">UDISE+ Code</label>
          <input
            value={gov.udise_code || ""}
            onChange={(e) => set("udise_code", e.target.value)}
            placeholder="11-digit code, e.g. 29130100107"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Affiliation Number</label>
          <input
            value={gov.affiliation_number || ""}
            onChange={(e) => set("affiliation_number", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Affiliation Valid From</label>
          <input
            type="date"
            value={gov.affiliation_valid_from || ""}
            onChange={(e) => set("affiliation_valid_from", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Affiliation Valid To</label>
          <input
            type="date"
            value={gov.affiliation_valid_to || ""}
            onChange={(e) => set("affiliation_valid_to", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Recognition Number</label>
          <input
            value={gov.recognition_number || ""}
            onChange={(e) => set("recognition_number", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Trust/Society Registration No.</label>
          <input
            value={gov.trust_registration_number || ""}
            onChange={(e) => set("trust_registration_number", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">PAN</label>
          <input
            value={gov.pan_number || ""}
            onChange={(e) => set("pan_number", e.target.value.toUpperCase())}
            placeholder="ABCDE1234F"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">GST Number (optional)</label>
          <input
            value={gov.gst_number || ""}
            onChange={(e) => set("gst_number", e.target.value.toUpperCase())}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>
    </WizardStepShell>
  );
}
