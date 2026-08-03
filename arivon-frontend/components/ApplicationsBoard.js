"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X, Phone, Mail, Search, CheckCircle2, XCircle, FileCheck, ClipboardCheck,
  Award, Users2, ThumbsUp, ThumbsDown, PauseCircle, CreditCard, BadgeCheck,
  AlertTriangle, Home, Bus,
} from "lucide-react";
import { apiRequest, isLoggedIn } from "../lib/api";

const STAGE_META = {
  application_submitted: { label: "Submitted", color: "bg-slate-100 text-slate-700" },
  document_verification: { label: "Verification", color: "bg-indigo-100 text-indigo-700" },
  admission_test: { label: "Test", color: "bg-violet-100 text-violet-700" },
  interview: { label: "Interview", color: "bg-amber-100 text-amber-700" },
  decision_pending: { label: "Decision Pending", color: "bg-orange-100 text-orange-700" },
  rejected: { label: "Rejected", color: "bg-rose-100 text-rose-700" },
  waitlisted: { label: "Waitlisted", color: "bg-yellow-100 text-yellow-700" },
  fee_pending: { label: "Fee Pending", color: "bg-teal-100 text-teal-700" },
  admission_confirmed: { label: "Confirmed", color: "bg-emerald-100 text-emerald-700" },
};

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "application_submitted", label: "Submitted" },
  { key: "document_verification", label: "Verification" },
  { key: "admission_test", label: "Test" },
  { key: "interview", label: "Interview" },
  { key: "decision_pending", label: "Decision" },
  { key: "fee_pending", label: "Fee" },
  { key: "admission_confirmed", label: "Confirmed" },
];

const DOC_LABELS = {
  birth_certificate: "Birth Certificate", transfer_certificate: "Transfer Certificate", report_card: "Report Card",
  aadhaar: "Aadhaar", photo: "Passport Photo", caste_certificate: "Caste Certificate", income_certificate: "Income Certificate",
  medical_certificate: "Medical Certificate", residence_proof: "Residence Proof", migration_certificate: "Migration Certificate", other: "Other",
};

const DECISION_ROLES = ["principal", "vice_principal", "school_admin", "administrator", "super_admin"];

function ApplicationRow({ application, onClick }) {
  const meta = STAGE_META[application.stage] || { label: application.stage, color: "bg-slate-100 text-slate-700" };
  return (
    <button onClick={onClick} className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-brand-300 hover:shadow-sm transition-all flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-semibold text-sm shrink-0">
        {application.student_name?.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">{application.student_name}</p>
        <p className="text-xs text-slate-500">{application.parent_name} · {application.applying_for_class_name || "—"}</p>
      </div>
      <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${meta.color}`}>{meta.label}</span>
    </button>
  );
}

function DetailDrawer({ application, user, classes, staffList, onClose, onUpdated }) {
  const [documents, setDocuments] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [sections, setSections] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [subjects, setSubjects] = useState([{ subject: "", marks: "", max_marks: "" }]);
  const [testRecommendation, setTestRecommendation] = useState("recommended");

  const [ivDate, setIvDate] = useState("");
  const [ivTime, setIvTime] = useState("");
  const [ivPanel, setIvPanel] = useState([]);

  const [decisionReason, setDecisionReason] = useState("");
  const [offerValidUntil, setOfferValidUntil] = useState("");

  const [feeItems, setFeeItems] = useState([{ description: "Registration Fee", amount: "", due_date: "" }]);
  const [confirmSectionId, setConfirmSectionId] = useState("");

  const canDecide = DECISION_ROLES.includes(user?.role_name);

  useEffect(() => {
    if (["document_verification", "admission_test", "interview", "decision_pending", "rejected", "waitlisted", "fee_pending", "admission_confirmed"].includes(application.stage)) {
      apiRequest(`/admission-pipeline/applications/${application.id}/documents`).then(setDocuments).catch(() => {});
    }
    if (["interview", "decision_pending", "rejected", "waitlisted", "fee_pending", "admission_confirmed"].includes(application.stage)) {
      apiRequest(`/admission-pipeline/applications/${application.id}/interviews`).then(setInterviews).catch(() => {});
    }
    if (["fee_pending", "admission_confirmed"].includes(application.stage)) {
      apiRequest(`/admission-pipeline/applications/${application.id}/fee-invoices`).then(setInvoices).catch(() => {});
    }
    if (application.applying_for_class_id) {
      apiRequest(`/classes/${application.applying_for_class_id}/sections`).then(setSections).catch(() => {});
    }
  }, [application.id]);

  async function refreshDocs() {
    const docs = await apiRequest(`/admission-pipeline/applications/${application.id}/documents`);
    setDocuments(docs);
  }

  async function handleStartVerification() {
    setSaving(true); setError("");
    try {
      await apiRequest(`/admission-pipeline/applications/${application.id}/start-verification`, { method: "POST" });
      await refreshDocs();
      onUpdated();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function handleVerifyDoc(docId, status) {
    setError("");
    try {
      await apiRequest(`/admission-pipeline/documents/${docId}`, { method: "PATCH", body: { status } });
      await refreshDocs();
    } catch (err) { setError(err.message); }
  }

  async function handleAdvancePastVerification() {
    setSaving(true); setError("");
    try {
      await apiRequest(`/admission-pipeline/applications/${application.id}/advance-past-verification`, { method: "POST" });
      onUpdated();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function handleRecordTest(e) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const validSubjects = subjects.filter((s) => s.subject).map((s) => ({ subject: s.subject, marks: Number(s.marks), max_marks: Number(s.max_marks) }));
      const overall = validSubjects.reduce((sum, s) => sum + s.marks, 0);
      await apiRequest(`/admission-pipeline/applications/${application.id}/test-result`, {
        method: "POST", body: { subjects: validSubjects, overall_score: overall, recommendation: testRecommendation },
      });
      onUpdated();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function handleScheduleInterview(e) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await apiRequest(`/admission-pipeline/applications/${application.id}/interviews`, {
        method: "POST", body: { scheduled_at: `${ivDate}T${ivTime || "10:00"}:00`, panel_user_ids: ivPanel.map(Number) },
      });
      const updated = await apiRequest(`/admission-pipeline/applications/${application.id}/interviews`);
      setInterviews(updated);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function handleRecordInterviewOutcome(interviewId, recommendation) {
    setError("");
    try {
      await apiRequest(`/admission-pipeline/interviews/${interviewId}`, { method: "PATCH", body: { recommendation } });
      const updated = await apiRequest(`/admission-pipeline/applications/${application.id}/interviews`);
      setInterviews(updated);
    } catch (err) { setError(err.message); }
  }

  async function handleAdvancePastInterview() {
    setSaving(true); setError("");
    try {
      await apiRequest(`/admission-pipeline/applications/${application.id}/advance-past-interview`, { method: "POST" });
      onUpdated();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function handleDecision(decision) {
    setSaving(true); setError("");
    try {
      await apiRequest(`/admission-pipeline/applications/${application.id}/decision`, {
        method: "POST", body: { decision, reason: decisionReason || null, offer_valid_until: decision === "approved" ? (offerValidUntil || null) : null },
      });
      onUpdated();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function handleGenerateFees(e) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const items = feeItems.filter((f) => f.description && f.amount).map((f) => ({ description: f.description, amount: Number(f.amount), due_date: f.due_date }));
      await apiRequest(`/admission-pipeline/applications/${application.id}/fee-invoices`, { method: "POST", body: { items } });
      const updated = await apiRequest(`/admission-pipeline/applications/${application.id}/fee-invoices`);
      setInvoices(updated);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function handleConfirm() {
    setSaving(true); setError("");
    try {
      await apiRequest(`/admission-pipeline/applications/${application.id}/confirm`, {
        method: "POST", body: { section_id: confirmSectionId ? Number(confirmSectionId) : null },
      });
      onUpdated();
      onClose();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  const allDocsVerified = documents.length === 0 || documents.every((d) => d.status === "verified");
  const allInvoicesPaid = invoices.length > 0 && invoices.every((inv) => inv.status === "paid");
  const meta = STAGE_META[application.stage] || { label: application.stage, color: "bg-slate-100 text-slate-700" };
  let appJson = {};
  try { appJson = JSON.parse(application.full_application_json || "{}"); } catch {}

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-start justify-between z-10">
          <div>
            <h3 className="text-base font-display font-bold text-slate-900">{application.student_name}</h3>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>

        <div className="p-5">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

          <div className="bg-slate-50 rounded-xl p-3.5 mb-5 space-y-1.5 text-xs text-slate-600">
            <div className="flex items-center gap-2"><Phone size={12} /> {application.phone}</div>
            {application.email && <div className="flex items-center gap-2"><Mail size={12} /> {application.email}</div>}
            <div className="flex items-center gap-2"><Users2 size={12} /> Applying for {application.applying_for_class_name}</div>
            {appJson.transport_required && <div className="flex items-center gap-2 text-teal-700"><Bus size={12} /> Transport required</div>}
            {appJson.hostel_required && <div className="flex items-center gap-2 text-teal-700"><Home size={12} /> Hostel required</div>}
            {appJson.emergency_contact && <div className="flex items-center gap-2"><AlertTriangle size={12} /> Emergency: {appJson.emergency_contact}</div>}
          </div>

          {["application_submitted", "document_verification"].includes(application.stage) && (
            <div className="mb-5">
              <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5"><FileCheck size={14} /> Document Verification</h4>
              {application.stage === "application_submitted" ? (
                <button onClick={handleStartVerification} disabled={saving} className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2.5">
                  Start Verification
                </button>
              ) : (
                <>
                  {documents.length === 0 ? (
                    <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 mb-3">
                      No documents are configured as required for this school yet — nothing to verify, so you can advance directly.
                    </p>
                  ) : (
                    <div className="space-y-2 mb-3">
                      {documents.map((doc) => (
                        <div key={doc.id} className="border border-slate-100 rounded-lg p-3 flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-medium text-slate-800">{DOC_LABELS[doc.document_type] || doc.document_type}</p>
                            {doc.remarks && <p className="text-[10px] text-slate-400">{doc.remarks}</p>}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => handleVerifyDoc(doc.id, "verified")} className={`w-7 h-7 rounded-md flex items-center justify-center ${doc.status === "verified" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400 hover:bg-emerald-50"}`}><CheckCircle2 size={13} /></button>
                            <button onClick={() => handleVerifyDoc(doc.id, "rejected")} className={`w-7 h-7 rounded-md flex items-center justify-center ${doc.status === "rejected" ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-400 hover:bg-rose-50"}`}><XCircle size={13} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={handleAdvancePastVerification} disabled={saving || !allDocsVerified} className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg py-2.5">
                    {allDocsVerified ? "Advance to Next Stage" : "Verify all documents to continue"}
                  </button>
                </>
              )}
            </div>
          )}

          {application.stage === "admission_test" && (
            <div className="mb-5">
              <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5"><Award size={14} /> Admission Test</h4>
              <form onSubmit={handleRecordTest} className="space-y-2.5">
                {subjects.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={s.subject} onChange={(e) => setSubjects(subjects.map((x, j) => j === i ? { ...x, subject: e.target.value } : x))} placeholder="Subject" className="flex-1 rounded-lg border border-slate-200 px-2 py-2 text-xs" />
                    <input value={s.marks} onChange={(e) => setSubjects(subjects.map((x, j) => j === i ? { ...x, marks: e.target.value } : x))} placeholder="Marks" type="number" className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-xs" />
                    <input value={s.max_marks} onChange={(e) => setSubjects(subjects.map((x, j) => j === i ? { ...x, max_marks: e.target.value } : x))} placeholder="Max" type="number" className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-xs" />
                  </div>
                ))}
                <button type="button" onClick={() => setSubjects([...subjects, { subject: "", marks: "", max_marks: "" }])} className="text-xs text-brand-700 hover:underline">+ Add subject</button>
                <select value={testRecommendation} onChange={(e) => setTestRecommendation(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="recommended">Recommended</option>
                  <option value="not_recommended">Not recommended</option>
                </select>
                <button type="submit" disabled={saving} className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2.5">Save Test Result</button>
              </form>
            </div>
          )}

          {application.stage === "interview" && (
            <div className="mb-5">
              <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5"><ClipboardCheck size={14} /> Interview</h4>
              {interviews.length > 0 && (
                <div className="space-y-2 mb-3">
                  {interviews.map((iv) => (
                    <div key={iv.id} className="border border-slate-100 rounded-lg p-3">
                      <p className="text-xs font-medium text-slate-800">{new Date(iv.scheduled_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                      <p className="text-[10px] text-slate-500 mb-2">Panel: {iv.panel_names.join(", ") || "—"}</p>
                      {!iv.recommendation ? (
                        <div className="flex gap-1.5">
                          <button onClick={() => handleRecordInterviewOutcome(iv.id, "recommended")} className="text-[10px] font-medium bg-brand-50 text-brand-700 px-2 py-1 rounded-md hover:bg-brand-100">Recommend</button>
                          <button onClick={() => handleRecordInterviewOutcome(iv.id, "not_recommended")} className="text-[10px] font-medium bg-rose-50 text-rose-700 px-2 py-1 rounded-md hover:bg-rose-100">Don't recommend</button>
                        </div>
                      ) : (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${iv.recommendation === "recommended" ? "bg-brand-50 text-brand-700" : "bg-rose-50 text-rose-700"}`}>{iv.recommendation.replace("_", " ")}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={handleScheduleInterview} className="space-y-2 mb-3">
                <div className="flex gap-2">
                  <input type="date" value={ivDate} onChange={(e) => setIvDate(e.target.value)} required className="flex-1 rounded-lg border border-slate-200 px-2 py-2 text-xs" />
                  <input type="time" value={ivTime} onChange={(e) => setIvTime(e.target.value)} className="w-24 rounded-lg border border-slate-200 px-2 py-2 text-xs" />
                </div>
                <select multiple value={ivPanel} onChange={(e) => setIvPanel(Array.from(e.target.selectedOptions, (o) => o.value))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" size={3}>
                  {staffList.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.role_name})</option>)}
                </select>
                <button type="submit" disabled={saving} className="w-full bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white text-xs font-medium rounded-lg py-2">Schedule Interview</button>
              </form>
              <button onClick={handleAdvancePastInterview} disabled={saving || interviews.length === 0 || interviews.some((iv) => !iv.recommendation)} className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg py-2.5">
                Advance to Decision
              </button>
            </div>
          )}

          {application.stage === "decision_pending" && (
            <div className="mb-5">
              <h4 className="text-sm font-semibold text-slate-800 mb-3">Decision</h4>
              {!canDecide ? (
                <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">Only the Principal or Vice Principal can make this decision.</p>
              ) : (
                <div className="space-y-2.5">
                  <input value={decisionReason} onChange={(e) => setDecisionReason(e.target.value)} placeholder="Reason (optional)" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <input type="date" value={offerValidUntil} onChange={(e) => setOfferValidUntil(e.target.value)} placeholder="Offer valid until (if approved)" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => handleDecision("approved")} disabled={saving} className="flex flex-col items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-medium rounded-lg py-2.5"><ThumbsUp size={14} /> Approve</button>
                    <button onClick={() => handleDecision("waitlisted")} disabled={saving} className="flex flex-col items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-medium rounded-lg py-2.5"><PauseCircle size={14} /> Waitlist</button>
                    <button onClick={() => handleDecision("rejected")} disabled={saving} className="flex flex-col items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium rounded-lg py-2.5"><ThumbsDown size={14} /> Reject</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {(application.stage === "rejected" || application.stage === "waitlisted") && (
            <div className="mb-5 bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-sm font-medium text-slate-700">{application.decision === "rejected" ? "This application was rejected." : "This application is waitlisted."}</p>
              {application.decision_reason && <p className="text-xs text-slate-500 mt-1">{application.decision_reason}</p>}
            </div>
          )}

          {application.stage === "fee_pending" && (
            <div className="mb-5">
              <h4 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5"><CreditCard size={14} /> Fee Collection</h4>
              {invoices.length > 0 && (
                <div className="space-y-2 mb-3">
                  {invoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between border border-slate-100 rounded-lg p-3">
                      <div>
                        <p className="text-xs font-medium text-slate-800">{inv.description}</p>
                        <p className="text-[10px] text-slate-500">Due {inv.due_date}</p>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${inv.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        ₹{inv.amount_due} · {inv.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {invoices.length === 0 && (
                <form onSubmit={handleGenerateFees} className="space-y-2 mb-3">
                  {feeItems.map((f, i) => (
                    <div key={i} className="flex gap-2">
                      <input value={f.description} onChange={(e) => setFeeItems(feeItems.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Fee description" className="flex-1 rounded-lg border border-slate-200 px-2 py-2 text-xs" />
                      <input value={f.amount} onChange={(e) => setFeeItems(feeItems.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} placeholder="Amount" type="number" className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-xs" />
                      <input value={f.due_date} onChange={(e) => setFeeItems(feeItems.map((x, j) => j === i ? { ...x, due_date: e.target.value } : x))} type="date" className="w-32 rounded-lg border border-slate-200 px-2 py-2 text-xs" />
                    </div>
                  ))}
                  <button type="button" onClick={() => setFeeItems([...feeItems, { description: "", amount: "", due_date: "" }])} className="text-xs text-brand-700 hover:underline">+ Add fee item</button>
                  <button type="submit" disabled={saving} className="w-full bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white text-xs font-medium rounded-lg py-2">Generate Invoices</button>
                </form>
              )}
              {invoices.length > 0 && !allInvoicesPaid && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-3 mb-3">Payments are recorded via Fee Collection. Once fully paid, admission can be confirmed here.</p>
              )}
              {allInvoicesPaid && (
                <>
                  <select value={confirmSectionId} onChange={(e) => setConfirmSectionId(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-3">
                    <option value="">Select a section (optional)</option>
                    {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button onClick={handleConfirm} disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg py-2.5 flex items-center justify-center gap-1.5">
                    <BadgeCheck size={15} /> Confirm Admission
                  </button>
                </>
              )}
            </div>
          )}

          {application.stage === "admission_confirmed" && (
            <div className="bg-emerald-50 rounded-xl p-4 text-center">
              <BadgeCheck size={20} className="text-emerald-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-emerald-800">Admission Confirmed</p>
              <p className="text-xs text-emerald-600 mt-1">Student profile created automatically.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ApplicationsBoard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [applications, setApplications] = useState([]);
  const [classes, setClasses] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState(null);
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
      const [apps, classList, staff] = await Promise.all([
        apiRequest(`/admission-pipeline/applications?school_id=${me.school_id}`),
        apiRequest(`/classes/?school_id=${me.school_id}`),
        apiRequest(`/admission-pipeline/staff?school_id=${me.school_id}`),
      ]);
      setApplications(apps);
      setClasses(classList);
      setStaffList(staff);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    const apps = await apiRequest(`/admission-pipeline/applications?school_id=${user.school_id}`);
    setApplications(apps);
    if (selectedApp) {
      const updated = apps.find((a) => a.id === selectedApp.id);
      setSelectedApp(updated || null);
    }
  }

  const filtered = applications.filter((a) => {
    const matchesFilter = filter === "all" || a.stage === filter;
    const matchesSearch = !search || a.student_name.toLowerCase().includes(search.toLowerCase()) || a.parent_name.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (loading) return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 text-sm text-slate-600">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-display font-bold text-slate-900">Applications</h2>
        <p className="text-sm text-slate-600">From submission through confirmation — verification, tests, interviews, decisions, and fees.</p>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key} onClick={() => setFilter(tab.key)}
            className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${filter === tab.key ? "bg-brand-600 border-brand-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name" className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm" />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <p className="text-sm text-slate-500">No applications here.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((app) => <ApplicationRow key={app.id} application={app} onClick={() => setSelectedApp(app)} />)}
        </div>
      )}

      {selectedApp && (
        <DetailDrawer
          application={selectedApp} user={user} classes={classes} staffList={staffList}
          onClose={() => setSelectedApp(null)} onUpdated={refresh}
        />
      )}
    </div>
  );
}
