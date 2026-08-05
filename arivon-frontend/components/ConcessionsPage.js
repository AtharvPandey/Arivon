"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Percent, Award, Plus, X } from "lucide-react";
import { apiRequest, isLoggedIn } from "../lib/api";

function Section({ title, icon: Icon, color, items, onAdd, category, schoolId, onCreated }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("custom");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await apiRequest("/fees/concessions", {
        method: "POST",
        body: { school_id: schoolId, name, category, concession_type: type, discount_type: discountType, discount_value: Number(discountValue) },
      });
      setShowForm(false); setName(""); setDiscountValue("");
      onCreated();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><Icon size={14} className={color} /> {title}</h3>
        <button onClick={() => setShowForm(!showForm)} className={`text-xs font-medium ${color === "text-teal-600" ? "bg-teal-600 hover:bg-teal-700" : "bg-violet-600 hover:bg-violet-700"} text-white rounded-lg px-3 py-1.5 flex items-center gap-1`}>
          <Plus size={12} /> Add {title.slice(0, -1)}
        </button>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 rounded-xl p-3 mb-3 grid grid-cols-2 gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required className="col-span-2 rounded-lg border border-slate-200 px-2 py-2 text-xs" />
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-xs">
            <option value="sibling">Sibling</option>
            <option value="rte">RTE</option>
            <option value="category">Category-based</option>
            <option value="custom">Custom</option>
          </select>
          <select value={discountType} onChange={(e) => setDiscountType(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-xs">
            <option value="percentage">Percentage</option>
            <option value="flat">Flat amount</option>
          </select>
          <input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder={discountType === "percentage" ? "% (0-100)" : "₹ amount"} required className="col-span-2 rounded-lg border border-slate-200 px-2 py-2 text-xs" />
          <button type="submit" disabled={saving} className="col-span-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white text-xs font-medium rounded-lg py-2">
            {saving ? "Saving..." : "Save"}
          </button>
        </form>
      )}

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">None yet.</p>
        ) : items.map((c) => (
          <div key={c.id} className="flex items-center justify-between border border-slate-100 rounded-lg p-3">
            <div>
              <p className="text-sm font-medium text-slate-800">{c.name}</p>
              <p className="text-xs text-slate-500 capitalize">{c.concession_type.replace("_", " ")}</p>
            </div>
            <span className="text-xs font-semibold text-slate-700">{c.discount_type === "percentage" ? `${c.discount_value}%` : `₹${c.discount_value}`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ConcessionsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [concessions, setConcessions] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    init();
  }, []);

  async function init() {
    try {
      const me = await apiRequest("/auth/me");
      setUser(me);
      await refresh(me.school_id);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function refresh(schoolId) {
    const data = await apiRequest(`/fees/concessions?school_id=${schoolId || user.school_id}`);
    setConcessions(data);
  }

  if (loading) return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 text-sm text-slate-600">Loading...</div>;

  const scholarships = concessions.filter((c) => c.category === "scholarship");
  const regularConcessions = concessions.filter((c) => c.category !== "scholarship");

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-bold text-slate-900">Discounts & Scholarships</h2>
        <p className="text-sm text-slate-600">Standing rules applied automatically when generating an invoice — separate from Waivers, which are one-off, case-by-case approvals.</p>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <Section title="Concessions" icon={Percent} color="text-teal-600" items={regularConcessions} category="concession" schoolId={user.school_id} onCreated={refresh} />
      <Section title="Scholarships" icon={Award} color="text-violet-600" items={scholarships} category="scholarship" schoolId={user.school_id} onCreated={refresh} />
    </div>
  );
}
