"use client";

import { useState } from "react";
import WizardStepShell from "../WizardStepShell";
import { platformApiRequest } from "../../../lib/platformApi";

export default function StepManagement({ draftId, formData, updateFormData, onBack, onNext, onDraftCreated }) {
  const mgmt = formData.management;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    updateFormData("management", { ...mgmt, [field]: value });
  }

  async function handleNext() {
    setError("");
    if (!mgmt.admin_full_name || !mgmt.admin_email) {
      setError("School Admin name and email are required — this is the login you'll use to run the school.");
      return;
    }

    setSaving(true);
    try {
      if (!draftId) {
        // First time through — this is the moment the draft actually
        // gets created, bundling Steps 1-4 together in one call.
        const draft = await platformApiRequest("/school-registration/register", {
          method: "POST",
          body: {
            identity: formData.identity,
            government_recognition: formData.government_recognition,
            address_contact: formData.address_contact,
            management: mgmt,
          },
        });
        onDraftCreated(draft.id);
      } else {
        await platformApiRequest(`/school-registration/${draftId}/management`, {
          method: "PATCH",
          body: mgmt,
        });
      }
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
      title="Management Details"
      description="Who stands behind the school, and the School Admin login that will actually run Arivon day to day."
      onBack={onBack}
      onNext={handleNext}
      saving={saving}
      error={error}
      nextLabel={draftId ? "Save & Continue" : "Create Draft & Continue"}
    >
      <div>
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Institutional Management (optional)
        </h4>
        <div className="grid grid-cols-1 gap-4">
          <input
            value={mgmt.trust_name || ""}
            onChange={(e) => set("trust_name", e.target.value)}
            placeholder="Trust / Society Name"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-4">
            <input
              value={mgmt.chairman_name || ""}
              onChange={(e) => set("chairman_name", e.target.value)}
              placeholder="Chairman / President Name"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={mgmt.managing_director_name || ""}
              onChange={(e) => set("managing_director_name", e.target.value)}
              placeholder="Managing Director / Secretary"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="pt-2">
        <h4 className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-3">
          Your Arivon Login
        </h4>
        <div className="bg-brand-50 border border-brand-100 rounded-lg p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">School Admin Full Name *</label>
            <input
              value={mgmt.admin_full_name || ""}
              onChange={(e) => set("admin_full_name", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">School Admin Email *</label>
            <input
              type="email"
              value={mgmt.admin_email || ""}
              onChange={(e) => set("admin_email", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
            />
          </div>
          <p className="text-xs text-slate-500">
            The password for this login is set at the very end, on the Review step — never stored until then.
          </p>
        </div>
      </div>
    </WizardStepShell>
  );
}
