"use client";

import { useState } from "react";
import WizardStepShell from "../WizardStepShell";
import { platformApiRequest } from "../../../lib/platformApi";

export default function StepSubscription({ draftId, formData, updateFormData, onBack, onNext }) {
  const sub = formData.subscription;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    updateFormData("subscription", { ...sub, [field]: value });
  }

  async function handleNext() {
    setError("");
    if (!sub.subscription_plan || !sub.billing_cycle || !sub.pricing_model || !sub.contract_start_date || !sub.contract_end_date) {
      setError("Plan, billing cycle, pricing model, and contract dates are all required.");
      return;
    }
    setSaving(true);
    try {
      await platformApiRequest(`/school-registration/${draftId}/subscription`, {
        method: "PATCH",
        body: sub,
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
      title="Subscription & Plan"
      description="What the school is paying for, and which features are enabled from day one."
      onBack={onBack}
      onNext={handleNext}
      saving={saving}
      error={error}
    >
      <div className="grid grid-cols-3 gap-4">
        {["basic", "pro", "enterprise"].map((plan) => (
          <button
            key={plan}
            type="button"
            onClick={() => set("subscription_plan", plan)}
            className={`px-4 py-3 rounded-lg border-2 text-left transition-colors ${
              sub.subscription_plan === plan ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <p className="text-sm font-semibold text-slate-900 capitalize">{plan}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Billing Cycle</label>
          <select
            value={sub.billing_cycle || ""}
            onChange={(e) => set("billing_cycle", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Select</option>
            <option value="annual">Annual</option>
            <option value="semi_annual">Semi-Annual</option>
            <option value="quarterly">Quarterly</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Pricing Model</label>
          <select
            value={sub.pricing_model || ""}
            onChange={(e) => set("pricing_model", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Select</option>
            <option value="per_student">Per Student</option>
            <option value="flat">Flat</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Contract Start Date</label>
          <input
            type="date"
            value={sub.contract_start_date || ""}
            onChange={(e) => set("contract_start_date", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Contract End Date</label>
          <input
            type="date"
            value={sub.contract_end_date || ""}
            onChange={(e) => set("contract_end_date", e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Trial End Date (optional)</label>
        <input
          type="date"
          value={sub.trial_ends_at || ""}
          onChange={(e) => set("trial_ends_at", e.target.value)}
          className="w-full sm:w-1/2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
    </WizardStepShell>
  );
}
