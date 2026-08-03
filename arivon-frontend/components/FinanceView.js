"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Wallet, Tag, Receipt, ShieldCheck, BarChart3, Plus, Download, Check, X,
  AlertTriangle, Search, LayoutDashboard, Users, IndianRupee,
} from "lucide-react";
import { apiRequest, isLoggedIn, downloadAuthenticatedFile } from "../lib/api";
import ClassSelect from "./ClassSelect";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

const STATUS_STYLES = {
  paid: "bg-brand-100 text-brand-700",
  partial: "bg-amber-100 text-amber-700",
  pending: "bg-slate-100 text-slate-600",
  overdue: "bg-rose-100 text-rose-700",
};

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, color: "brand" },
  { key: "structures", label: "Fee Structures", icon: Wallet, color: "indigo" },
  { key: "concessions", label: "Concessions", icon: Tag, color: "teal" },
  { key: "billing", label: "Invoices & Payments", icon: Receipt, color: "amber" },
  { key: "waivers", label: "Waivers", icon: ShieldCheck, color: "violet" },
  { key: "reports", label: "Reports", icon: BarChart3, color: "rose" },
  { key: "salary", label: "Staff Salary", icon: IndianRupee, color: "sky" },
];
const TAB_COLOR_CLASSES = {
  brand: "border-brand-600 text-brand-700",
  indigo: "border-indigo-600 text-indigo-700",
  teal: "border-teal-600 text-teal-700",
  amber: "border-amber-600 text-amber-700",
  violet: "border-violet-600 text-violet-700",
  rose: "border-rose-600 text-rose-700",
  sky: "border-sky-600 text-sky-700",
};

const FINANCE_ROLES = ["accountant", "school_admin"];

function FinanceViewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [schoolId, setSchoolId] = useState(null);
  const [roleName, setRoleName] = useState(null);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "overview");
  const [error, setError] = useState("");
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/");
      return;
    }
    (async () => {
      try {
        const me = await apiRequest("/auth/me");
        setSchoolId(me.school_id);
        setRoleName(me.role_name);
        // Skip fetching anything else if this role can't access Fee
        // Management at all — every tab below assumes Accountant/School
        // Admin access, and calling those endpoints anyway just throws
        // an unhandled 403 that used to crash the whole page.
        if (!FINANCE_ROLES.includes(me.role_name)) return;
        const classList = await apiRequest(`/classes/?school_id=${me.school_id}`);
        setClasses(classList);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  if (!schoolId) return <div className="max-w-5xl mx-auto px-6 py-8 text-sm text-slate-600">Loading...</div>;

  if (!FINANCE_ROLES.includes(roleName)) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">Fee Management</h2>
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center mt-6">
          <ShieldCheck size={22} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-800 mb-1">Access restricted</p>
          <p className="text-sm text-slate-500">
            Fee Management is restricted to Accountant and School Admin roles — this keeps money-handling
            accountable to one department, the way it works in a real school office.
            Log in with an Accountant or School Admin account to view this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">Fee Management</h2>
      <p className="text-sm text-slate-600 mb-6">Structures, concessions, billing, waivers, and reporting — the most sensitive part of the system.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="flex items-center gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              activeTab === tab.key ? TAB_COLOR_CLASSES[tab.color] : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <OverviewTab schoolId={schoolId} setError={setError} setActiveTab={setActiveTab} />}
      {activeTab === "structures" && <StructuresTab schoolId={schoolId} classes={classes} setError={setError} />}
      {activeTab === "concessions" && <ConcessionsTab schoolId={schoolId} setError={setError} />}
      {activeTab === "billing" && <BillingTab schoolId={schoolId} classes={classes} setError={setError} />}
      {activeTab === "waivers" && <WaiversTab schoolId={schoolId} setError={setError} />}
      {activeTab === "reports" && <ReportsTab schoolId={schoolId} classes={classes} setError={setError} />}
      {activeTab === "salary" && <SalaryTab schoolId={schoolId} setError={setError} />}
    </div>
  );
}

// ---------- Overview Tab (School Admin's landing view) ----------

function OverviewTab({ schoolId, setError, setActiveTab }) {
  const [collection, setCollection] = useState(null);
  const [defaulters, setDefaulters] = useState([]);
  const [salarySummary, setSalarySummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        const todayStr = now.toISOString().split("T")[0];
        const [collectionData, defaultersData, salaryData] = await Promise.all([
          apiRequest(`/fees/reports/collection?school_id=${schoolId}&period=monthly&start_date=${monthStart}&end_date=${todayStr}`),
          apiRequest(`/fees/reports/defaulters?school_id=${schoolId}`),
          apiRequest(`/salary/summary?school_id=${schoolId}&month=${now.getMonth() + 1}&year=${now.getFullYear()}`),
        ]);
        setCollection(collectionData.reduce((sum, item) => sum + item.total_collected, 0));
        setDefaulters(defaultersData);
        setSalarySummary(salaryData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="text-sm text-slate-600">Loading...</p>;

  const totalOutstanding = defaulters.reduce((sum, d) => sum + d.total_outstanding, 0);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center mb-2"><Wallet size={16} /></div>
          <p className="text-xl font-display font-bold text-slate-900">₹{(collection || 0).toLocaleString()}</p>
          <p className="text-xs text-slate-500">Collected this month</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center mb-2"><AlertTriangle size={16} /></div>
          <p className="text-xl font-display font-bold text-slate-900">₹{totalOutstanding.toLocaleString()}</p>
          <p className="text-xs text-slate-500">Outstanding ({defaulters.length} students)</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center mb-2"><Users size={16} /></div>
          <p className="text-xl font-display font-bold text-slate-900">{salarySummary?.paid_count || 0}/{salarySummary?.total_staff || 0}</p>
          <p className="text-xs text-slate-500">Staff paid this month</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center mb-2"><IndianRupee size={16} /></div>
          <p className="text-xl font-display font-bold text-slate-900">₹{(salarySummary?.total_pending_amount || 0).toLocaleString()}</p>
          <p className="text-xs text-slate-500">Salary pending</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button onClick={() => setActiveTab("billing")} className="bg-white border border-slate-200 hover:border-amber-300 rounded-xl p-4 text-left transition-colors">
          <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><Receipt size={14} className="text-amber-600" /> Manage Student Invoices</p>
          <p className="text-xs text-slate-500 mt-1">Record payments, generate receipts, apply concessions.</p>
        </button>
        <button onClick={() => setActiveTab("salary")} className="bg-white border border-slate-200 hover:border-sky-300 rounded-xl p-4 text-left transition-colors">
          <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><IndianRupee size={14} className="text-sky-600" /> Process Staff Salary</p>
          <p className="text-xs text-slate-500 mt-1">Record and mark monthly salary payments as paid.</p>
        </button>
        <button onClick={() => setActiveTab("reports")} className="bg-white border border-slate-200 hover:border-rose-300 rounded-xl p-4 text-left transition-colors">
          <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><BarChart3 size={14} className="text-rose-600" /> View Defaulters & Collection Reports</p>
          <p className="text-xs text-slate-500 mt-1">Class-wise breakdowns and who owes what.</p>
        </button>
        <button onClick={() => setActiveTab("structures")} className="bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-4 text-left transition-colors">
          <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><Wallet size={14} className="text-indigo-600" /> Set Up Fee Structures</p>
          <p className="text-xs text-slate-500 mt-1">Tuition, transport, and other fee types per class.</p>
        </button>
      </div>
    </div>
  );
}

// ---------- Fee Structures Tab ----------

function StructuresTab({ schoolId, classes, setError }) {
  const [structures, setStructures] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [classId, setClassId] = useState("");
  const [feeType, setFeeType] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [lateFeeAmount, setLateFeeAmount] = useState(0);
  const [lateFeeGraceDays, setLateFeeGraceDays] = useState(0);

  useEffect(() => { load(); }, []);
  async function load() {
    try {
      const data = await apiRequest(`/fees/structures?school_id=${schoolId}`);
      setStructures(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    try {
      await apiRequest("/fees/structures", {
        method: "POST",
        body: {
          school_id: schoolId, academic_year_id: 1, school_class_id: classId ? Number(classId) : null,
          fee_type: feeType, amount: Number(amount), frequency,
          late_fee_amount: Number(lateFeeAmount), late_fee_grace_days: Number(lateFeeGraceDays),
        },
      });
      setFeeType(""); setAmount(""); setClassId(""); setLateFeeAmount(0); setLateFeeGraceDays(0);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-600">{structures.length} fee structure(s) defined.</p>
        <button onClick={() => setShowForm(!showForm)} className="text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1.5 flex items-center gap-1">
          <Plus size={12} /> Add Fee Structure
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-4 mb-5 grid grid-cols-2 sm:grid-cols-3 gap-2">
          <ClassSelect classes={classes} value={classId} onChange={setClassId} placeholder="All classes" />
          <input value={feeType} onChange={(e) => setFeeType(e.target.value)} placeholder="Fee type (e.g. Tuition)" required className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (₹)" required className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
          <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
            <option value="one_time">One-time</option>
          </select>
          <input type="number" value={lateFeeAmount} onChange={(e) => setLateFeeAmount(e.target.value)} placeholder="Late fee (₹)" className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
          <input type="number" value={lateFeeGraceDays} onChange={(e) => setLateFeeGraceDays(e.target.value)} placeholder="Grace days" className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
          <button type="submit" className="col-span-2 sm:col-span-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg py-1.5">Add Fee Structure</button>
        </form>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {structures.map((s) => (
          <div key={s.id} className="bg-indigo-50 rounded-xl p-4">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center mb-2">
              <Wallet size={16} className="text-indigo-700" />
            </div>
            <p className="text-sm font-semibold text-indigo-700">{s.fee_type}</p>
            <p className="text-xs text-slate-600">₹{s.amount.toLocaleString()} · {s.frequency}</p>
            {s.school_class_id ? (
              <p className="text-xs text-slate-500 mt-1">{classes.find((c) => c.id === s.school_class_id)?.name || "Class"}</p>
            ) : (
              <p className="text-xs text-slate-500 mt-1">All classes</p>
            )}
            {s.late_fee_amount > 0 && (
              <p className="text-[11px] text-rose-600 mt-1">+₹{s.late_fee_amount} after {s.late_fee_grace_days}d grace</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Concessions Tab ----------

function ConcessionsTab({ schoolId, setError }) {
  const [concessions, setConcessions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("sibling");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("");

  useEffect(() => { load(); }, []);
  async function load() {
    try {
      const data = await apiRequest(`/fees/concessions?school_id=${schoolId}`);
      setConcessions(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    try {
      await apiRequest("/fees/concessions", {
        method: "POST",
        body: { school_id: schoolId, name, concession_type: type, discount_type: discountType, discount_value: Number(discountValue) },
      });
      setName(""); setDiscountValue("");
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeactivate(id) {
    if (!confirm("Deactivate this concession? Invoices that already used it keep their discount.")) return;
    await apiRequest(`/fees/concessions/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <p className="text-sm text-slate-600 mb-4">Reusable discount rules — sibling discounts, RTE exemption, category-based concessions — applied when generating an invoice.</p>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowForm(!showForm)} className="text-xs font-medium bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-3 py-1.5 flex items-center gap-1">
          <Plus size={12} /> Add Concession
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-4 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Sibling Discount)" required className="col-span-2 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
            <option value="sibling">Sibling</option>
            <option value="rte">RTE</option>
            <option value="category">Category (SC/ST/OBC)</option>
            <option value="custom">Custom</option>
          </select>
          <select value={discountType} onChange={(e) => setDiscountType(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
            <option value="percentage">Percentage</option>
            <option value="flat">Flat ₹</option>
          </select>
          <input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder={discountType === "percentage" ? "% off" : "₹ off"} required className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
          <button type="submit" className="col-span-2 sm:col-span-3 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-lg py-1.5">Add Concession</button>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
        {concessions.length === 0 ? (
          <p className="text-sm text-slate-500 p-6 text-center">No concessions defined yet.</p>
        ) : concessions.map((c) => (
          <div key={c.id} className="px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">{c.name}</p>
              <p className="text-xs text-slate-500 capitalize">{c.concession_type} · {c.discount_type === "percentage" ? `${c.discount_value}% off` : `₹${c.discount_value} off`}</p>
            </div>
            <button onClick={() => handleDeactivate(c.id)} className="text-xs text-rose-600 hover:underline">Deactivate</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Billing Tab (Invoices & Payments) ----------

function BillingTab({ schoolId, classes, setError }) {
  const [classId, setClassId] = useState("");
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState("");
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);

  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payingInvoiceId, setPayingInvoiceId] = useState(null);
  const [receiptLinks, setReceiptLinks] = useState({});

  useEffect(() => {
    if (!classId) { setSections([]); setSectionId(""); return; }
    apiRequest(`/classes/${classId}/sections`).then(setSections);
  }, [classId]);

  useEffect(() => {
    if (!sectionId) { setStudents([]); return; }
    apiRequest(`/students/?school_id=${schoolId}&section_id=${sectionId}`).then(setStudents);
  }, [sectionId]);

  async function selectStudent(student) {
    setSelectedStudent(student);
    const [inv, history] = await Promise.all([
      apiRequest(`/fees/invoices?school_id=${schoolId}&student_id=${student.id}`),
      apiRequest(`/fees/students/${student.id}/payment-history`),
    ]);
    setInvoices(inv);
    setPaymentHistory(history);
  }

  async function handlePay(invoiceId) {
    setError("");
    try {
      await apiRequest("/fees/payments", {
        method: "POST",
        body: { invoice_id: invoiceId, amount: Number(payAmount), payment_date: todayISO(), payment_method: payMethod },
      });
      setPayAmount(""); setPayingInvoiceId(null);
      await selectStudent(selectedStudent);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerateReceipt(invoiceId) {
    // Find the most recent payment for this invoice from history to generate a receipt for
    const payments = await apiRequest(`/fees/students/${selectedStudent.id}/payment-history`);
    const latest = payments[0];
    if (!latest) return;
    const result = await apiRequest(`/fees/payments/${latest.payment_id}/receipt`, { method: "POST" });
    setReceiptLinks((prev) => ({ ...prev, [invoiceId]: result.download_url }));
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-4 max-w-lg">
        <ClassSelect classes={classes} value={classId} onChange={setClassId} placeholder="Select class" />
        <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!classId} className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50">
          <option value="">Select section</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {students.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {students.map((s) => (
            <button
              key={s.id}
              onClick={() => selectStudent(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border ${selectedStudent?.id === s.id ? "bg-amber-600 text-white border-amber-600" : "bg-white text-slate-700 border-slate-200 hover:border-amber-300"}`}
            >
              {s.full_name}
            </button>
          ))}
        </div>
      )}

      {selectedStudent && (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <div key={inv.id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{inv.fee_type} · {inv.billing_period}</p>
                  <p className="text-xs text-slate-500">
                    Due {inv.due_date} · ₹{inv.amount_due.toLocaleString()}
                    {inv.concession_amount > 0 && <span className="text-teal-600"> (₹{inv.concession_amount} concession applied)</span>}
                    {inv.late_fee_amount > 0 && <span className="text-rose-600"> +₹{inv.late_fee_amount} late fee</span>}
                  </p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[inv.status]}`}>{inv.status}</span>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                <p className="text-sm">
                  <span className="text-slate-500">Paid:</span> <span className="font-medium text-slate-900">₹{inv.amount_paid.toLocaleString()}</span>
                  {" · "}<span className="text-slate-500">Balance:</span> <span className="font-semibold text-rose-600">₹{inv.balance.toLocaleString()}</span>
                </p>
                {inv.balance > 0 && payingInvoiceId !== inv.id && (
                  <button onClick={() => { setPayingInvoiceId(inv.id); setPayAmount(inv.balance); }} className="text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 py-1.5">
                    Record Payment
                  </button>
                )}
                {inv.balance === 0 && (
                  receiptLinks[inv.id] ? (
                    <button onClick={() => downloadAuthenticatedFile(receiptLinks[inv.id], `Receipt_${inv.billing_period}.pdf`)} className="text-xs font-medium text-brand-700 underline flex items-center gap-1">
                      <Download size={12} /> Download Receipt
                    </button>
                  ) : (
                    <button onClick={() => handleGenerateReceipt(inv.id)} className="text-xs font-medium text-brand-700 underline">Generate Receipt</button>
                  )
                )}
              </div>
              {payingInvoiceId === inv.id && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                  <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="dd">DD</option>
                  </select>
                  <button onClick={() => handlePay(inv.id)} className="text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-3 py-1.5">Confirm</button>
                  <button onClick={() => setPayingInvoiceId(null)} className="text-xs text-slate-500">Cancel</button>
                </div>
              )}
            </div>
          ))}
          {invoices.length === 0 && <p className="text-sm text-slate-500">No invoices for this student yet.</p>}

          {paymentHistory.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mt-5">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200"><p className="text-xs font-semibold text-slate-600">Payment History</p></div>
              <div className="divide-y divide-slate-100">
                {paymentHistory.map((p) => (
                  <div key={p.payment_id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                    <span className="text-slate-700">{p.receipt_number || "—"} · {p.fee_type} ({p.billing_period})</span>
                    <span className="text-slate-500">₹{p.amount.toLocaleString()} · {p.payment_method} · {p.payment_date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Waivers Tab ----------

function WaiversTab({ schoolId, setError }) {
  const [waivers, setWaivers] = useState([]);
  const [reviewingId, setReviewingId] = useState(null);
  const [notes, setNotes] = useState("");

  useEffect(() => { load(); }, []);
  async function load() {
    try {
      const data = await apiRequest(`/fees/waivers?school_id=${schoolId}&status=pending`);
      setWaivers(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReview(id, decision) {
    try {
      await apiRequest(`/fees/waivers/${id}/${decision}`, { method: "PATCH", body: { review_notes: notes || null } });
      setReviewingId(null); setNotes("");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <p className="text-sm text-slate-600 mb-4">Case-by-case fee reductions requiring approval — distinct from standing concessions.</p>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
        {waivers.length === 0 ? (
          <div className="p-8 text-center">
            <ShieldCheck size={20} className="text-brand-500 mx-auto mb-2" />
            <p className="text-sm text-slate-600">No pending waiver requests.</p>
          </div>
        ) : waivers.map((w) => (
          <div key={w.id} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{w.student_name} · ₹{w.waiver_amount.toLocaleString()}</p>
                <p className="text-xs text-slate-500">{w.reason}</p>
              </div>
              {reviewingId === w.id ? (
                <div className="flex items-center gap-2">
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className="text-xs rounded-md border border-slate-200 px-2 py-1.5 w-32" />
                  <button onClick={() => handleReview(w.id, "approve")} className="text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-md px-2.5 py-1.5">Approve</button>
                  <button onClick={() => handleReview(w.id, "reject")} className="text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-md px-2.5 py-1.5">Reject</button>
                </div>
              ) : (
                <button onClick={() => setReviewingId(w.id)} className="text-xs font-medium text-violet-700 border border-violet-200 rounded-lg px-3 py-1.5">Review</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Reports Tab ----------

function ReportsTab({ schoolId, classes, setError }) {
  const [reportType, setReportType] = useState("defaulters");
  const [defaulters, setDefaulters] = useState([]);
  const [classWise, setClassWise] = useState([]);
  const [collection, setCollection] = useState([]);
  const [period, setPeriod] = useState("monthly");
  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(todayISO());

  useEffect(() => {
    if (reportType === "defaulters") apiRequest(`/fees/reports/defaulters?school_id=${schoolId}`).then(setDefaulters).catch((e) => setError(e.message));
    if (reportType === "classwise") apiRequest(`/fees/reports/class-wise?school_id=${schoolId}`).then(setClassWise).catch((e) => setError(e.message));
  }, [reportType]);

  async function loadCollection() {
    try {
      const data = await apiRequest(`/fees/reports/collection?school_id=${schoolId}&period=${period}&start_date=${startDate}&end_date=${endDate}`);
      setCollection(data);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-5">
        <button onClick={() => setReportType("defaulters")} className={`text-xs font-medium px-3 py-1.5 rounded-full ${reportType === "defaulters" ? "bg-rose-600 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
          <AlertTriangle size={11} className="inline mr-1" /> Defaulters
        </button>
        <button onClick={() => setReportType("classwise")} className={`text-xs font-medium px-3 py-1.5 rounded-full ${reportType === "classwise" ? "bg-rose-600 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
          Class-wise Collection
        </button>
        <button onClick={() => setReportType("collection")} className={`text-xs font-medium px-3 py-1.5 rounded-full ${reportType === "collection" ? "bg-rose-600 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
          Collection Report
        </button>
      </div>

      {reportType === "defaulters" && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
          {defaulters.length === 0 ? (
            <p className="text-sm text-slate-500 p-6 text-center">No outstanding balances — every fee is fully collected.</p>
          ) : defaulters.map((d) => (
            <div key={d.student_id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{d.student_name}</p>
                <p className="text-xs text-slate-500">{d.admission_number} · {d.class_name} - {d.section_name} · {d.guardian_name} ({d.guardian_phone})</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-rose-600">₹{d.total_outstanding.toLocaleString()}</p>
                <p className="text-[11px] text-slate-400">since {d.oldest_due_date}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {reportType === "classwise" && (
        <div className="space-y-2">
          {classWise.map((c) => (
            <div key={c.school_class_id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-900">{c.class_name}</p>
                <span className="text-xs font-semibold text-rose-700">{c.collection_pct}% collected</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-rose-500" style={{ width: `${c.collection_pct}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
                <span>Billed: <b className="text-slate-800">₹{c.total_billed.toLocaleString()}</b></span>
                <span>Collected: <b className="text-slate-800">₹{c.total_collected.toLocaleString()}</b></span>
                <span>Outstanding: <b className="text-rose-600">₹{c.total_outstanding.toLocaleString()}</b></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {reportType === "collection" && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="daily">Daily</option>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <button onClick={loadCollection} className="text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-lg px-3 py-2">Run Report</button>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
            {collection.length === 0 ? (
              <p className="text-sm text-slate-500 p-6 text-center">Run the report to see results.</p>
            ) : collection.map((c, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-800">{c.period_label}</span>
                <span className="text-sm text-slate-600">₹{c.total_collected.toLocaleString()} · {c.payment_count} payment(s)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Staff Salary Tab ----------

function SalaryTab({ schoolId, setError }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [payments, setPayments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [summary, setSummary] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [staffUserId, setStaffUserId] = useState("");
  const [basicSalary, setBasicSalary] = useState("");
  const [allowances, setAllowances] = useState("0");
  const [deductions, setDeductions] = useState("0");
  const [markingId, setMarkingId] = useState(null);

  useEffect(() => { load(); }, [month, year]);

  async function load() {
    try {
      const [paymentsData, staffData, summaryData] = await Promise.all([
        apiRequest(`/salary/payments?school_id=${schoolId}&month=${month}&year=${year}`),
        apiRequest(`/staff/?school_id=${schoolId}`),
        apiRequest(`/salary/summary?school_id=${schoolId}&month=${month}&year=${year}`),
      ]);
      setPayments(paymentsData);
      setStaffList(staffData.filter((s) => s.role_name !== "school_admin"));
      setSummary(summaryData);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    try {
      await apiRequest(`/salary/payments?school_id=${schoolId}`, {
        method: "POST",
        body: {
          staff_user_id: Number(staffUserId), month, year,
          basic_salary: Number(basicSalary), allowances: Number(allowances), deductions: Number(deductions),
        },
      });
      setStaffUserId(""); setBasicSalary(""); setAllowances("0"); setDeductions("0");
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleMarkPaid(paymentId) {
    setMarkingId(paymentId);
    try {
      await apiRequest(`/salary/payments/${paymentId}/mark-paid`, { method: "POST", body: { payment_date: todayISO() } });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setMarkingId(null);
    }
  }

  const staffWithoutRecord = staffList.filter((s) => !payments.some((p) => p.staff_user_id === s.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString("default", { month: "long" })}</option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm">
            {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="text-xs font-medium bg-sky-600 hover:bg-sky-700 text-white rounded-lg px-3 py-1.5 flex items-center gap-1">
          <Plus size={12} /> Record Salary
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
            <p className="text-lg font-display font-bold text-brand-700">{summary.paid_count}</p>
            <p className="text-xs text-slate-500">Paid</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
            <p className="text-lg font-display font-bold text-amber-600">{summary.pending_count}</p>
            <p className="text-xs text-slate-500">Pending</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
            <p className="text-lg font-display font-bold text-slate-800">₹{summary.total_paid_amount.toLocaleString()}</p>
            <p className="text-xs text-slate-500">Disbursed this month</p>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-4 mb-5 space-y-2">
          <select value={staffUserId} onChange={(e) => setStaffUserId(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">Select staff member...</option>
            {staffWithoutRecord.map((s) => <option key={s.id} value={s.id}>{s.full_name} — {(s.role_name || "").replace(/_/g, " ")}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <input type="number" value={basicSalary} onChange={(e) => setBasicSalary(e.target.value)} placeholder="Basic salary" required className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <input type="number" value={allowances} onChange={(e) => setAllowances(e.target.value)} placeholder="Allowances" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <input type="number" value={deductions} onChange={(e) => setDeductions(e.target.value)} placeholder="Deductions" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-lg px-4 py-2">Save Salary Record</button>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
        {payments.length === 0 ? (
          <p className="text-sm text-slate-500 p-6 text-center">No salary records for this month yet.</p>
        ) : payments.map((p) => (
          <div key={p.id} className="px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">{p.staff_name}</p>
              <p className="text-xs text-slate-500">{p.designation} · ₹{p.net_salary.toLocaleString()} net {p.payment_date && `· Paid ${p.payment_date}`}</p>
            </div>
            {p.payment_status === "paid" ? (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-100 text-brand-700">Paid</span>
            ) : (
              <button onClick={() => handleMarkPaid(p.id)} disabled={markingId === p.id} className="text-xs font-medium bg-sky-600 hover:bg-sky-700 text-white rounded-lg px-3 py-1.5">
                {markingId === p.id ? "Marking..." : "Mark Paid"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FinanceView() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto px-6 py-8 text-sm text-slate-600">Loading...</div>}>
      <FinanceViewInner />
    </Suspense>
  );
}
