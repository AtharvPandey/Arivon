"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Search, Plus, X, CheckCircle2, XCircle, Clock, ArrowRight, CreditCard } from "lucide-react";
import { apiRequest, isLoggedIn } from "../lib/api";

const STATUS_META = {
  requested: { label: "Requested", color: "bg-slate-100 text-slate-700" },
  under_review: { label: "Under Review", color: "bg-amber-100 text-amber-700" },
  approved: { label: "Approved", color: "bg-blue-100 text-blue-700" },
  processed: { label: "Processed", color: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Rejected", color: "bg-rose-100 text-rose-700" },
};

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "requested", label: "Requested" },
  { key: "under_review", label: "Under Review" },
  { key: "approved", label: "Approved" },
  { key: "processed", label: "Processed" },
  { key: "rejected", label: "Rejected" },
];

const REVIEW_ROLES = ["finance_manager", "school_admin", "administrator", "super_admin"];

function NewRefundModal({ schoolId, onClose, onCreated }) {
  const [step, setStep] = useState("search");
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [payments, setPayments] = useState([]);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    if (query.trim().length < 2) { setError("Type at least 2 characters."); return; }
    setSearching(true); setError("");
    try {
      const results = await apiRequest(`/finance/students/search?school_id=${schoolId}&q=${encodeURIComponent(query)}`);
      setStudents(results);
    } catch (err) { setError(err.message); } finally { setSearching(false); }
  }

  async function handleSelectStudent(student) {
    setSelectedStudent(student);
    setError("");
    try {
      const eligible = await apiRequest(`/finance/students/${student.id}/eligible-payments`);
      setPayments(eligible);
      setStep("pick-payment");
    } catch (err) { setError(err.message); }
  }

  function handleSelectPayment(payment) {
    setSelectedPayment(payment);
    setAmount(payment.remaining_refundable);
    setStep("form");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await apiRequest("/finance/refunds", {
        method: "POST",
        body: { payment_id: selectedPayment.payment_id, amount: Number(amount), reason },
      });
      onCreated();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-display font-bold text-slate-900 flex items-center gap-2">
            <RotateCcw size={16} className="text-rose-600" /> New Refund Request
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

        {step === "search" && (
          <>
            <form onSubmit={handleSearch} className="relative mb-4">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by student name or admission number"
                className="w-full rounded-lg border border-slate-200 pl-9 pr-20 py-2.5 text-sm"
              />
              <button type="submit" disabled={searching} className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-medium rounded-md px-3 py-1.5">
                {searching ? "..." : "Search"}
              </button>
            </form>
            <div className="space-y-2">
              {students.map((s) => (
                <button key={s.id} onClick={() => handleSelectStudent(s)} className="w-full text-left border border-slate-200 rounded-lg p-3 hover:border-brand-300 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{s.full_name}</p>
                    <p className="text-xs text-slate-500">{s.admission_number} · {s.class_name} {s.section_name}</p>
                  </div>
                  <ArrowRight size={14} className="text-slate-300" />
                </button>
              ))}
              {students.length === 0 && query && !searching && (
                <p className="text-xs text-slate-400 text-center py-6">Search for a student to see their eligible payments.</p>
              )}
            </div>
          </>
        )}

        {step === "pick-payment" && (
          <>
            <button onClick={() => setStep("search")} className="text-xs text-slate-500 hover:underline mb-3">← Back to search</button>
            <p className="text-sm font-medium text-slate-800 mb-3">{selectedStudent.full_name}'s payments</p>
            <div className="space-y-2">
              {payments.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No refundable payments found for this student.</p>
              ) : payments.map((p) => (
                <button key={p.payment_id} onClick={() => handleSelectPayment(p)} className="w-full text-left border border-slate-200 rounded-lg p-3 hover:border-brand-300">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-900">{p.fee_description}</p>
                    <span className="text-xs font-medium text-slate-500">{p.payment_date}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Paid ₹{p.amount.toLocaleString()} via {p.payment_method} · <span className="text-emerald-700 font-medium">₹{p.remaining_refundable.toLocaleString()} refundable</span>
                  </p>
                </button>
              ))}
            </div>
          </>
        )}

        {step === "form" && (
          <>
            <button onClick={() => setStep("pick-payment")} className="text-xs text-slate-500 hover:underline mb-3">← Back to payments</button>
            <div className="bg-slate-50 rounded-lg p-3 mb-4 text-xs text-slate-600">
              {selectedStudent.full_name} · {selectedPayment.fee_description} · Receipt {selectedPayment.receipt_number || "—"}
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Refund amount (max ₹{selectedPayment.remaining_refundable.toLocaleString()})</label>
                <input
                  type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                  max={selectedPayment.remaining_refundable} min={1} required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for refund" required rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <button type="submit" disabled={saving} className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2.5">
                {saving ? "Submitting..." : "Submit Refund Request"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function RefundDetailDrawer({ refund, userRole, onClose, onUpdated }) {
  const [reviewNotes, setReviewNotes] = useState("");
  const [refundMethod, setRefundMethod] = useState("cash");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const canReview = REVIEW_ROLES.includes(userRole);
  const meta = STATUS_META[refund.status];

  async function handleStartReview() {
    setSaving(true); setError("");
    try {
      await apiRequest(`/finance/refunds/${refund.id}/start-review`, { method: "POST" });
      onUpdated();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function handleDecide(decision) {
    setSaving(true); setError("");
    try {
      await apiRequest(`/finance/refunds/${refund.id}/decide`, { method: "POST", body: { decision, review_notes: reviewNotes || null } });
      onUpdated();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function handleProcess(e) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await apiRequest(`/finance/refunds/${refund.id}/process`, { method: "POST", body: { refund_method: refundMethod } });
      onUpdated();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-start justify-between z-10">
          <div>
            <h3 className="text-base font-display font-bold text-slate-900">{refund.student_name}</h3>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>

        <div className="p-5">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

          <div className="bg-slate-50 rounded-xl p-4 mb-5">
            <p className="text-2xl font-display font-bold text-slate-900 mb-1">₹{refund.amount.toLocaleString()}</p>
            <p className="text-xs text-slate-500">{refund.reason}</p>
          </div>

          <div className="space-y-3 mb-5">
            <div className="flex gap-3">
              <Clock size={14} className="text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-slate-700">Requested by {refund.requested_by_name}</p>
                <p className="text-[11px] text-slate-400">{new Date(refund.requested_at).toLocaleString()}</p>
              </div>
            </div>
            {refund.reviewed_by_name && (
              <div className="flex gap-3">
                <CheckCircle2 size={14} className="text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-slate-700">Reviewed by {refund.reviewed_by_name}</p>
                  {refund.review_notes && <p className="text-[11px] text-slate-500 mt-0.5">"{refund.review_notes}"</p>}
                  <p className="text-[11px] text-slate-400">{new Date(refund.reviewed_at).toLocaleString()}</p>
                </div>
              </div>
            )}
            {refund.processed_by_name && (
              <div className="flex gap-3">
                <CreditCard size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-slate-700">Processed by {refund.processed_by_name} via {refund.refund_method}</p>
                  <p className="text-[11px] text-slate-400">Receipt {refund.receipt_number} · {new Date(refund.processed_at).toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>

          {!canReview && refund.status !== "processed" && refund.status !== "rejected" && (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">Only Finance Manager or above can review, approve, or process refunds.</p>
          )}

          {canReview && refund.status === "requested" && (
            <button onClick={handleStartReview} disabled={saving} className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2.5">
              Start Review
            </button>
          )}

          {canReview && refund.status === "under_review" && (
            <div className="space-y-2.5">
              <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Notes (optional)" rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleDecide("approved")} disabled={saving} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-medium rounded-lg py-2.5 flex items-center justify-center gap-1"><CheckCircle2 size={13} /> Approve</button>
                <button onClick={() => handleDecide("rejected")} disabled={saving} className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium rounded-lg py-2.5 flex items-center justify-center gap-1"><XCircle size={13} /> Reject</button>
              </div>
            </div>
          )}

          {canReview && refund.status === "approved" && (
            <form onSubmit={handleProcess} className="space-y-2.5">
              <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
              <button type="submit" disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2.5">
                Process Refund
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RefundsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [refunds, setRefunds] = useState([]);
  const [filter, setFilter] = useState("all");
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState(null);
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
      const data = await apiRequest(`/finance/refunds?school_id=${me.school_id}`);
      setRefunds(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    const data = await apiRequest(`/finance/refunds?school_id=${user.school_id}`);
    setRefunds(data);
    if (selectedRefund) {
      const updated = data.find((r) => r.id === selectedRefund.id);
      setSelectedRefund(updated || null);
    }
  }

  const filtered = filter === "all" ? refunds : refunds.filter((r) => r.status === filter);

  if (loading) return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 text-sm text-slate-600">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900">Refunds</h2>
          <p className="text-sm text-slate-600">Request, review, approve, and process refunds — every step tracked.</p>
        </div>
        <button onClick={() => setShowNewModal(true)} className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 shrink-0">
          <Plus size={15} /> New Refund
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key} onClick={() => setFilter(tab.key)}
            className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${filter === tab.key ? "bg-rose-600 border-rose-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <RotateCcw size={22} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-600">No refunds here.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((r) => {
            const meta = STATUS_META[r.status];
            return (
              <button key={r.id} onClick={() => setSelectedRefund(r)} className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-rose-300 hover:shadow-sm transition-all flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{r.student_name} · ₹{r.amount.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 truncate">{r.reason}</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${meta.color}`}>{meta.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {showNewModal && (
        <NewRefundModal schoolId={user.school_id} onClose={() => setShowNewModal(false)} onCreated={async () => { setShowNewModal(false); await refresh(); }} />
      )}

      {selectedRefund && (
        <RefundDetailDrawer refund={selectedRefund} userRole={user.role_name} onClose={() => setSelectedRefund(null)} onUpdated={refresh} />
      )}
    </div>
  );
}
