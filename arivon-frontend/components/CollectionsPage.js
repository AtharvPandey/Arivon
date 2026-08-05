"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CreditCard, CheckCircle2, Printer, History, X } from "lucide-react";
import { apiRequest, isLoggedIn } from "../lib/api";

const PAYMENT_METHODS = [
  { key: "cash", label: "Cash" },
  { key: "upi", label: "UPI" },
  { key: "card", label: "Card" },
  { key: "bank_transfer", label: "Bank Transfer" },
  { key: "cheque", label: "Cheque" },
];

function PaymentPanel({ invoice, onClose, onPaid }) {
  const [amount, setAmount] = useState(invoice.balance);
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const payment = await apiRequest("/fees/payments", {
        method: "POST",
        body: { invoice_id: invoice.id, amount: Number(amount), payment_date: new Date().toISOString().slice(0, 10), payment_method: method, notes: notes || null },
      });
      const receipt = await apiRequest(`/fees/payments/${payment.id}/receipt`, { method: "POST" });
      setReceiptUrl(receipt.download_url);
      onPaid();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  if (receiptUrl) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
        <CheckCircle2 size={20} className="text-emerald-600 mx-auto mb-2" />
        <p className="text-sm font-semibold text-emerald-800 mb-2">Payment recorded — ₹{amount}</p>
        <a href={receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-2">
          <Printer size={12} /> View / Print Receipt
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 rounded-xl p-4 space-y-3">
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">₹</span>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} max={invoice.balance} min={1} required className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold" />
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PAYMENT_METHODS.map((m) => (
          <button key={m.key} type="button" onClick={() => setMethod(m.key)} className={`text-xs font-medium px-3 py-1.5 rounded-full border ${method === m.key ? "bg-brand-600 border-brand-600 text-white" : "bg-white border-slate-200 text-slate-600"}`}>
            {m.label}
          </button>
        ))}
      </div>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" />
      <button type="submit" disabled={saving} className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2.5 flex items-center justify-center gap-1.5">
        <CreditCard size={14} /> {saving ? "Recording..." : "Record Payment"}
      </button>
    </form>
  );
}

export default function CollectionsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [payingInvoiceId, setPayingInvoiceId] = useState(null);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    apiRequest("/auth/me").then(setUser).catch(() => router.push("/")).finally(() => setLoading(false));
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    if (query.trim().length < 2) { setError("Type at least 2 characters."); return; }
    setSearching(true); setError(""); setSelectedStudent(null);
    try {
      const results = await apiRequest(`/finance/students/search?school_id=${user.school_id}&q=${encodeURIComponent(query)}`);
      setStudents(results);
    } catch (err) { setError(err.message); } finally { setSearching(false); }
  }

  async function handleSelectStudent(student) {
    setSelectedStudent(student);
    setPayingInvoiceId(null);
    setShowHistory(false);
    setError("");
    try {
      const [invoiceData, historyData] = await Promise.all([
        apiRequest(`/fees/invoices?school_id=${user.school_id}&student_id=${student.id}`),
        apiRequest(`/fees/students/${student.id}/payment-history`),
      ]);
      setInvoices(invoiceData);
      setHistory(historyData);
    } catch (err) { setError(err.message); }
  }

  async function refreshStudent() {
    await handleSelectStudent(selectedStudent);
  }

  if (loading) return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 text-sm text-slate-600">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-bold text-slate-900">Collections</h2>
        <p className="text-sm text-slate-600">Search a student → see what they owe → record a payment. Most payments take under 30 seconds.</p>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <form onSubmit={handleSearch} className="relative mb-5 max-w-lg">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by student name or admission number"
          className="w-full rounded-xl border border-slate-200 pl-10 pr-24 py-3 text-sm"
        />
        <button type="submit" disabled={searching} className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-medium rounded-lg px-4 py-2">
          {searching ? "..." : "Search"}
        </button>
      </form>

      {!selectedStudent && students.length > 0 && (
        <div className="space-y-2 max-w-lg">
          {students.map((s) => (
            <button key={s.id} onClick={() => handleSelectStudent(s)} className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-brand-300 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{s.full_name}</p>
                <p className="text-xs text-slate-500">{s.admission_number} · {s.class_name} {s.section_name}</p>
              </div>
              <div className="text-right">
                {s.total_outstanding > 0 ? (
                  <span className="text-xs font-semibold text-rose-600">₹{s.total_outstanding.toLocaleString()} due</span>
                ) : (
                  <span className="text-xs font-medium text-emerald-600">All paid</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedStudent && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-base font-semibold text-slate-900">{selectedStudent.full_name}</p>
              <p className="text-xs text-slate-500">{selectedStudent.admission_number} · {selectedStudent.class_name} {selectedStudent.section_name}</p>
            </div>
            <button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700">
              <History size={13} /> {showHistory ? "Hide" : "Show"} History
            </button>
          </div>

          {showHistory && (
            <div className="p-5 border-b border-slate-100 bg-slate-50 space-y-2">
              {history.length === 0 ? (
                <p className="text-xs text-slate-400">No payments recorded yet.</p>
              ) : history.map((p) => (
                <div key={p.payment_id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">{p.receipt_number || "—"} · {p.fee_type} ({p.billing_period})</span>
                  <span className="text-slate-500">₹{p.amount.toLocaleString()} · {p.payment_date} · {p.payment_method}</span>
                </div>
              ))}
            </div>
          )}

          <div className="divide-y divide-slate-100">
            {invoices.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">No invoices found for this student.</p>
            ) : invoices.map((inv) => (
              <div key={inv.id} className="p-5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-slate-900">{inv.fee_type} · {inv.billing_period}</p>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${inv.status === "paid" ? "bg-emerald-100 text-emerald-700" : inv.status === "overdue" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{inv.status}</span>
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  Due {inv.due_date} · ₹{inv.amount_due.toLocaleString()}
                  {inv.concession_amount > 0 && <span className="text-teal-600"> (₹{inv.concession_amount} concession)</span>}
                  {inv.late_fee_amount > 0 && <span className="text-rose-600"> +₹{inv.late_fee_amount} late fee</span>}
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-sm">
                    <span className="text-slate-500">Paid:</span> <span className="font-medium text-slate-900">₹{inv.amount_paid.toLocaleString()}</span>
                    {" · "}<span className="text-slate-500">Balance:</span> <span className="font-semibold text-rose-600">₹{inv.balance.toLocaleString()}</span>
                  </p>
                  {inv.balance > 0 && payingInvoiceId !== inv.id && (
                    <button onClick={() => setPayingInvoiceId(inv.id)} className="text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 py-1.5">
                      Record Payment
                    </button>
                  )}
                </div>
                {payingInvoiceId === inv.id && (
                  <div className="mt-3">
                    <PaymentPanel invoice={inv} onClose={() => setPayingInvoiceId(null)} onPaid={refreshStudent} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
