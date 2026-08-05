"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Tag, Copy, Plus, CheckCircle2 } from "lucide-react";
import { apiRequest, isLoggedIn } from "../lib/api";
import ClassSelect from "./ClassSelect";

export default function FeeStructuresPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [view, setView] = useState("structures");
  const [classes, setClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [structures, setStructures] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [showStructureForm, setShowStructureForm] = useState(false);
  const [newClassId, setNewClassId] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newFrequency, setNewFrequency] = useState("monthly");
  const [newYearId, setNewYearId] = useState("");
  const [savingStructure, setSavingStructure] = useState(false);

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  const [showDuplicate, setShowDuplicate] = useState(false);
  const [sourceYearId, setSourceYearId] = useState("");
  const [targetYearId, setTargetYearId] = useState("");
  const [percentIncrease, setPercentIncrease] = useState("0");
  const [duplicateResult, setDuplicateResult] = useState(null);
  const [duplicating, setDuplicating] = useState(false);

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
    const sid = schoolId || user.school_id;
    const [classList, years, structureList, categoryList] = await Promise.all([
      apiRequest(`/classes/?school_id=${sid}`),
      apiRequest(`/academic-years/?school_id=${sid}`),
      apiRequest(`/fees/structures?school_id=${sid}`),
      apiRequest(`/finance/categories?school_id=${sid}`),
    ]);
    setClasses(classList);
    setAcademicYears(years);
    setStructures(structureList);
    setCategories(categoryList);
  }

  async function handleCreateStructure(e) {
    e.preventDefault();
    setSavingStructure(true); setError("");
    try {
      await apiRequest("/fees/structures", {
        method: "POST",
        body: {
          school_id: user.school_id, academic_year_id: Number(newYearId),
          school_class_id: newClassId ? Number(newClassId) : null,
          fee_category_id: Number(newCategoryId), amount: Number(newAmount), frequency: newFrequency,
        },
      });
      setShowStructureForm(false);
      setNewClassId(""); setNewCategoryId(""); setNewAmount("");
      await refresh();
    } catch (err) { setError(err.message); } finally { setSavingStructure(false); }
  }

  async function handleCreateCategory(e) {
    e.preventDefault();
    setSavingCategory(true); setError("");
    try {
      await apiRequest("/finance/categories", { method: "POST", body: { school_id: user.school_id, name: newCategoryName } });
      setShowCategoryForm(false);
      setNewCategoryName("");
      await refresh();
    } catch (err) { setError(err.message); } finally { setSavingCategory(false); }
  }

  async function handleDuplicate(e) {
    e.preventDefault();
    setDuplicating(true); setError(""); setDuplicateResult(null);
    try {
      const result = await apiRequest("/finance/structures/duplicate-to-year", {
        method: "POST",
        body: { source_academic_year_id: Number(sourceYearId), target_academic_year_id: Number(targetYearId), percentage_increase: Number(percentIncrease) },
      });
      setDuplicateResult(result);
      await refresh();
    } catch (err) { setError(err.message); } finally { setDuplicating(false); }
  }

  if (loading) return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 text-sm text-slate-600">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900">Fee Structures</h2>
          <p className="text-sm text-slate-600">The single source of truth every module — including Admissions — draws fee amounts from.</p>
        </div>
        <button onClick={() => setShowDuplicate(true)} className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg px-3 py-2 shrink-0">
          <Copy size={13} /> Duplicate to New Year
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="flex gap-2 mb-5">
        <button onClick={() => setView("structures")} className={`text-xs font-medium px-3 py-1.5 rounded-full border ${view === "structures" ? "bg-brand-600 border-brand-600 text-white" : "bg-white border-slate-200 text-slate-600"}`}>
          <Wallet size={12} className="inline mr-1" /> Structures
        </button>
        <button onClick={() => setView("categories")} className={`text-xs font-medium px-3 py-1.5 rounded-full border ${view === "categories" ? "bg-brand-600 border-brand-600 text-white" : "bg-white border-slate-200 text-slate-600"}`}>
          <Tag size={12} className="inline mr-1" /> Categories
        </button>
      </div>

      {view === "structures" && (
        <>
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowStructureForm(!showStructureForm)} className="text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-3 py-1.5 flex items-center gap-1">
              <Plus size={12} /> Add Fee Structure
            </button>
          </div>
          {showStructureForm && (
            <form onSubmit={handleCreateStructure} className="bg-white border border-slate-200 rounded-xl p-4 mb-4 grid grid-cols-2 gap-2">
              <select value={newYearId} onChange={(e) => setNewYearId(e.target.value)} required className="rounded-lg border border-slate-200 px-2 py-2 text-xs col-span-2">
                <option value="">Academic year</option>
                {academicYears.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
              </select>
              <ClassSelect classes={classes} value={newClassId} onChange={setNewClassId} placeholder="All classes (leave blank)" />
              <select value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value)} required className="rounded-lg border border-slate-200 px-2 py-2 text-xs">
                <option value="">Category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="Amount" required className="rounded-lg border border-slate-200 px-2 py-2 text-xs" />
              <select value={newFrequency} onChange={(e) => setNewFrequency(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-xs">
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
                <option value="one_time">One-time</option>
              </select>
              <button type="submit" disabled={savingStructure} className="col-span-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-medium rounded-lg py-2">
                {savingStructure ? "Saving..." : "Create Structure"}
              </button>
            </form>
          )}
          <div className="space-y-2">
            {structures.map((s) => (
              <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{s.fee_category_name}</p>
                  <p className="text-xs text-slate-500">{academicYears.find((y) => y.id === s.academic_year_id)?.label || "—"} · {classes.find((c) => c.id === s.school_class_id)?.name || "All classes"} · {s.frequency}</p>
                </div>
                <p className="text-sm font-semibold text-slate-700">₹{s.amount.toLocaleString()}</p>
              </div>
            ))}
            {structures.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No fee structures yet.</p>}
          </div>
        </>
      )}

      {view === "categories" && (
        <>
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowCategoryForm(!showCategoryForm)} className="text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-3 py-1.5 flex items-center gap-1">
              <Plus size={12} /> Add Category
            </button>
          </div>
          {showCategoryForm && (
            <form onSubmit={handleCreateCategory} className="flex gap-2 mb-4">
              <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Category name" required className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <button type="submit" disabled={savingCategory} className="bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-xs font-medium rounded-lg px-4">
                {savingCategory ? "..." : "Add"}
              </button>
            </form>
          )}
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <span key={c.id} className="text-xs font-medium bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full">{c.name}</span>
            ))}
          </div>
        </>
      )}

      {showDuplicate && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-lg font-display font-bold text-slate-900 mb-4 flex items-center gap-2"><Copy size={16} /> Duplicate to New Year</h3>
            {duplicateResult ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <CheckCircle2 size={18} className="text-emerald-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-emerald-800">{duplicateResult.created_count} structure(s) duplicated</p>
                {duplicateResult.skipped_count > 0 && <p className="text-xs text-emerald-700 mt-1">{duplicateResult.skipped_count} already existed and were skipped.</p>}
                <button onClick={() => { setShowDuplicate(false); setDuplicateResult(null); }} className="mt-3 text-xs font-medium text-emerald-700 underline">Close</button>
              </div>
            ) : (
              <form onSubmit={handleDuplicate} className="space-y-3">
                <select value={sourceYearId} onChange={(e) => setSourceYearId(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="">From academic year</option>
                  {academicYears.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
                </select>
                <select value={targetYearId} onChange={(e) => setTargetYearId(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="">To academic year</option>
                  {academicYears.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
                </select>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Bulk % increase (optional)</label>
                  <input type="number" value={percentIncrease} onChange={(e) => setPercentIncrease(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={duplicating} className="flex-1 bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2.5">
                    {duplicating ? "Duplicating..." : "Duplicate"}
                  </button>
                  <button type="button" onClick={() => setShowDuplicate(false)} className="text-sm text-slate-500 px-3">Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
