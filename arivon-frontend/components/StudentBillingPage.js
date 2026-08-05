"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Calendar, Layers, CheckCircle2 } from "lucide-react";
import { apiRequest, isLoggedIn } from "../lib/api";
import ClassSelect from "./ClassSelect";

const MODES = [
  { key: "individual", label: "Individual", icon: Users, desc: "One student, one invoice — for a specific case." },
  { key: "class_batch", label: "Class-wise Batch", icon: Layers, desc: "One billing period, every student in a class, in one action." },
  { key: "year_template", label: "Academic Year Template", icon: Calendar, desc: "An entire year of recurring invoices for a class, generated up front." },
];

function ResultBanner({ result }) {
  if (!result) return null;
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mt-4">
      <div className="flex items-center gap-2 mb-1">
        <CheckCircle2 size={16} className="text-emerald-600" />
        <p className="text-sm font-semibold text-emerald-800">{result.created_count} invoice{result.created_count !== 1 ? "s" : ""} created</p>
      </div>
      {result.skipped_count > 0 && <p className="text-xs text-emerald-700">{result.skipped_count} already existed and were skipped — no duplicates created.</p>}
      {result.periods_generated && <p className="text-xs text-emerald-700 mt-1">Periods: {result.periods_generated.join(", ")}</p>}
    </div>
  );
}

export default function StudentBillingPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState("class_batch");
  const [classes, setClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [structures, setStructures] = useState([]);
  const [students, setStudents] = useState([]);

  const [classId, setClassId] = useState("");
  const [structureId, setStructureId] = useState("");
  const [billingPeriod, setBillingPeriod] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [amountDue, setAmountDue] = useState("");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    init();
  }, []);

  async function init() {
    try {
      const me = await apiRequest("/auth/me");
      setUser(me);
      const [classList, years] = await Promise.all([
        apiRequest(`/classes/?school_id=${me.school_id}`),
        apiRequest(`/academic-years/?school_id=${me.school_id}`),
      ]);
      setClasses(classList);
      setAcademicYears(years);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function loadStructuresForClass(cid) {
    if (!cid) { setStructures([]); return; }
    try {
      const data = await apiRequest(`/fees/structures?school_id=${user.school_id}&school_class_id=${cid}`);
      setStructures(data);
    } catch (err) { setError(err.message); }
  }

  async function loadStudentsForClass(cid) {
    if (!cid) { setStudents([]); return; }
    try {
      const sections = await apiRequest(`/classes/${cid}/sections`);
      const perSection = await Promise.all(
        sections.map((s) => apiRequest(`/students/?school_id=${user.school_id}&section_id=${s.id}`))
      );
      setStudents(perSection.flat());
    } catch (err) { setStudents([]); }
  }

  function handleClassChange(cid) {
    setClassId(cid);
    setStructureId("");
    loadStructuresForClass(cid);
    if (mode === "individual") loadStudentsForClass(cid);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError(""); setResult(null);
    try {
      if (mode === "individual") {
        const structure = structures.find((s) => String(s.id) === structureId);
        const created = await apiRequest("/fees/invoices", {
          method: "POST",
          body: { student_id: Number(studentId), fee_structure_id: Number(structureId), billing_period: billingPeriod, due_date: dueDate, amount_due: Number(amountDue || structure?.amount || 0) },
        });
        setResult({ created_count: 1, skipped_count: 0 });
      } else if (mode === "class_batch") {
        const data = await apiRequest("/finance/billing/class-batch", {
          method: "POST",
          body: { school_id: user.school_id, school_class_id: Number(classId), fee_structure_id: Number(structureId), billing_period: billingPeriod, due_date: dueDate },
        });
        setResult(data);
      } else if (mode === "year_template") {
        const data = await apiRequest("/finance/billing/academic-year-template", {
          method: "POST",
          body: { school_id: user.school_id, school_class_id: Number(classId), fee_structure_id: Number(structureId), academic_year_id: Number(academicYearId), first_due_date: dueDate },
        });
        setResult(data);
      }
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  if (loading) return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 text-sm text-slate-600">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-bold text-slate-900">Student Billing</h2>
        <p className="text-sm text-slate-600">Generate invoices — one student at a time, a whole class in one action, or a full year up front.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {MODES.map((m) => (
          <button
            key={m.key} onClick={() => { setMode(m.key); setResult(null); setError(""); }}
            className={`text-left p-4 rounded-xl border transition-all ${mode === m.key ? "bg-brand-50 border-brand-300" : "bg-white border-slate-200 hover:border-slate-300"}`}
          >
            <m.icon size={18} className={mode === m.key ? "text-brand-600" : "text-slate-400"} />
            <p className="text-sm font-semibold text-slate-900 mt-2">{m.label}</p>
            <p className="text-xs text-slate-500 mt-1">{m.desc}</p>
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <ClassSelect classes={classes} value={classId} onChange={handleClassChange} required />

        {mode === "individual" && (
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} required disabled={!classId} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50">
            <option value="">Select student</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.admission_number})</option>)}
          </select>
        )}

        <select value={structureId} onChange={(e) => setStructureId(e.target.value)} required disabled={!classId} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50">
          <option value="">Select fee structure</option>
          {structures.map((s) => <option key={s.id} value={s.id}>{s.fee_category_name} · ₹{s.amount} · {s.frequency}</option>)}
        </select>

        {mode === "year_template" ? (
          <select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">Select academic year</option>
            {academicYears.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
          </select>
        ) : (
          <input value={billingPeriod} onChange={(e) => setBillingPeriod(e.target.value)} placeholder="Billing period (e.g. August 2026)" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        )}

        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required placeholder={mode === "year_template" ? "Due date for the first period" : "Due date"} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />

        {mode === "individual" && (
          <input type="number" value={amountDue} onChange={(e) => setAmountDue(e.target.value)} placeholder="Amount (defaults to the fee structure's amount)" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        )}

        <button type="submit" disabled={saving} className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2.5">
          {saving ? "Generating..." : mode === "individual" ? "Generate Invoice" : mode === "class_batch" ? "Generate for This Class" : "Generate Full Year"}
        </button>
      </form>

      <ResultBanner result={result} />
    </div>
  );
}
