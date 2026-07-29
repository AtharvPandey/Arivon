"use client";

import { useState } from "react";
import WizardStepShell from "../WizardStepShell";
import { platformApiRequest } from "../../../lib/platformApi";

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Delhi", "Other",
];

export default function StepAddress({ draftId, formData, updateFormData, onBack, onNext }) {
  const addr = formData.address_contact;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    updateFormData("address_contact", { ...addr, [field]: value });
  }

  async function handleNext() {
    setError("");
    if (!addr.city || !addr.state) {
      setError("City and State are required.");
      return;
    }
    if (addr.pincode && addr.pincode.length !== 6) {
      setError("Pincode must be exactly 6 digits.");
      return;
    }

    if (draftId) {
      setSaving(true);
      try {
        await platformApiRequest(`/school-registration/${draftId}/draft`, {
          method: "PATCH",
          body: { address_contact: addr },
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
      title="Address & Contact Information"
      description="Where the school physically is, and how to reach it."
      onBack={onBack}
      onNext={handleNext}
      saving={saving}
      error={error}
    >
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Address Line 1</label>
        <input
          value={addr.address || ""}
          onChange={(e) => set("address", e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Address Line 2</label>
        <input
          value={addr.address_line_2 || ""}
          onChange={(e) => set("address_line_2", e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">City *</label>
          <input
            value={addr.city || ""}
            onChange={(e) => set("city", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">State *</label>
          <select
            value={addr.state || ""}
            onChange={(e) => set("state", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Select state</option>
            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Pincode</label>
          <input
            value={addr.pincode || ""}
            onChange={(e) => set("pincode", e.target.value)}
            maxLength={6}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Primary Contact Phone</label>
          <input
            value={addr.contact_phone || ""}
            onChange={(e) => set("contact_phone", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Primary Contact Email</label>
          <input
            type="email"
            value={addr.contact_email || ""}
            onChange={(e) => set("contact_email", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Website (optional)</label>
          <input
            value={addr.website_url || ""}
            onChange={(e) => set("website_url", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Google Maps Link (optional)</label>
          <input
            value={addr.google_maps_url || ""}
            onChange={(e) => set("google_maps_url", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>
    </WizardStepShell>
  );
}
