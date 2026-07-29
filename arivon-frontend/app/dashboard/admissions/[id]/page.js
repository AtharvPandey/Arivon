"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Upload, CheckCircle2, Circle, IndianRupee } from "lucide-react";
import { apiRequest, apiUpload, isLoggedIn, downloadAuthenticatedFile } from "../../../../lib/api";

const NEXT_STEPS = {
  inquiry: ["submitted", "withdrawn"],
  submitted: ["under_review", "withdrawn"],
  under_review: ["offer_sent", "rejected", "withdrawn"],
  offer_sent: ["enrolled", "rejected", "withdrawn"],
  rejected: [],
  withdrawn: [],
  enrolled: [],
};

const STAGE_COLORS = {
  inquiry: "bg-slate-100 text-slate-600",
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-amber-100 text-amber-700",
  offer_sent: "bg-brand-100 text-brand-700",
  enrolled: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  withdrawn: "bg-slate-100 text-slate-500",
};

// The standard checklist — matches the Student Management plan exactly.
// "type" is what's stored in Document.document_type; nothing here is
// invented on the fly, this is the fixed required set every admission
// goes through.
const REQUIRED_DOCUMENTS = [
  { type: "birth_certificate", label: "Birth Certificate" },
  { type: "transfer_certificate", label: "Previous School TC" },
  { type: "aadhaar_card", label: "Aadhaar Card" },
  { type: "caste_certificate", label: "Caste Certificate" },
  { type: "photo", label: "Photo" },
];

export default function ApplicationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [app, setApp] = useState(null);
  const [guardian, setGuardian] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [sectionId, setSectionId] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [sections, setSections] = useState([]);
  const [uploadingType, setUploadingType] = useState(null);
  const [verifyingId, setVerifyingId] = useState(null);

  const [enrolledStudent, setEnrolledStudent] = useState(null);
  const [feeStructures, setFeeStructures] = useState([]);
  const [selectedFeeIds, setSelectedFeeIds] = useState(new Set());
  const [billingPeriod, setBillingPeriod] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [feeSaving, setFeeSaving] = useState(false);
  const [feeMessage, setFeeMessage] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/");
      return;
    }
    load();
  }, [params.id]);

  async function load() {
    setLoading(true);
    try {
      const data = await apiRequest(`/admissions/applications/${params.id}`);
      setApp(data);
      const g = await apiRequest(`/guardians/?school_id=${data.school_id}`);
      setGuardian(g.find((x) => x.id === data.guardian_id));
      const secs = await apiRequest(`/classes/${data.applying_for_class_id}/sections`);
      setSections(secs);
      await loadDocuments(data.school_id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadDocuments(schoolId) {
    const sid = schoolId ?? app?.school_id;
    const docs = await apiRequest(`/documents/?school_id=${sid}&entity_type=admission_application&entity_id=${params.id}`);
    setDocuments(docs);
  }

  async function transition(status) {
    setError("");
    try {
      const updated = await apiRequest(`/admissions/applications/${params.id}/status`, {
        method: "PATCH",
        body: { status },
      });
      setApp(updated);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleEnroll(e) {
    e.preventDefault();
    setError("");
    try {
      const student = await apiRequest(`/admissions/applications/${params.id}/enroll`, {
        method: "POST",
        body: { section_id: sectionId ? Number(sectionId) : null, admission_number: admissionNumber || null },
      });
      // Deliberately NOT navigating away immediately — the explicit
      // "assign fee structure" step happens right here, right after
      // enrollment, rather than being a separate thing to remember later.
      setEnrolledStudent(student);
      const applicable = await apiRequest(
        `/admissions/fee-structures?school_id=${app.school_id}&school_class_id=${app.applying_for_class_id}`
      );
      setFeeStructures(applicable);
      const today = new Date();
      setBillingPeriod(today.toLocaleString("en-IN", { month: "long", year: "numeric" }));
      const due = new Date(today.getFullYear(), today.getMonth(), 10);
      if (due < today) due.setMonth(due.getMonth() + 1);
      setDueDate(due.toISOString().split("T")[0]);
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleFeeStructure(id) {
    const next = new Set(selectedFeeIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedFeeIds(next);
  }

  async function handleGenerateInvoices() {
    if (selectedFeeIds.size === 0) {
      setFeeMessage("Select at least one fee structure.");
      return;
    }
    setFeeSaving(true);
    setFeeMessage("");
    try {
      const result = await apiRequest(`/admissions/students/${enrolledStudent.id}/generate-invoices`, {
        method: "POST",
        body: { fee_structure_ids: Array.from(selectedFeeIds), billing_period: billingPeriod, due_date: dueDate },
      });
      setFeeMessage(`${result.length} invoice(s) created for ${billingPeriod}.`);
    } catch (err) {
      setFeeMessage(err.message);
    } finally {
      setFeeSaving(false);
    }
  }

  async function handleUpload(docType, e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingType(docType);
    setError("");
    try {
      const formData = new FormData();
      formData.append("school_id", app.school_id);
      formData.append("entity_type", "admission_application");
      formData.append("entity_id", params.id);
      formData.append("document_type", docType);
      formData.append("file", file);
      await apiUpload("/documents/upload", formData);
      await loadDocuments();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingType(null);
    }
  }

  async function handleVerify(documentId) {
    setVerifyingId(documentId);
    try {
      await apiRequest(`/documents/${documentId}/verify`, { method: "POST" });
      await loadDocuments();
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifyingId(null);
    }
  }

  if (loading) return <div className="max-w-3xl mx-auto px-6 py-8 text-sm text-slate-600">Loading...</div>;
  if (!app) return null;

  const verifiedCount = REQUIRED_DOCUMENTS.filter((req) =>
    documents.find((d) => d.document_type === req.type)?.verified_at
  ).length;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <button onClick={() => router.push("/dashboard/admissions")} className="text-sm text-slate-600 hover:text-slate-900 mb-4 flex items-center gap-1">
        <ArrowLeft size={14} /> Back to Admissions
      </button>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-display font-bold text-slate-900">{app.applicant_name}</h2>
            <p className="text-sm text-slate-500">DOB {app.date_of_birth} · {app.gender || "—"}</p>
          </div>
          <span className={`text-xs font-medium px-3 py-1 rounded-full capitalize ${STAGE_COLORS[app.status]}`}>
            {app.status.replace("_", " ")}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          <div>
            <p className="text-xs text-slate-500">Guardian</p>
            <p className="text-slate-900">{guardian ? `${guardian.full_name} (${guardian.relation})` : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Guardian Phone</p>
            <p className="text-slate-900">{guardian?.phone || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Previous School</p>
            <p className="text-slate-900">{app.previous_school || "—"}</p>
          </div>
        </div>

        {NEXT_STEPS[app.status]?.length > 0 && (
          <div className="flex gap-2 pt-3 border-t border-slate-100">
            {NEXT_STEPS[app.status].map((step) => (
              <button
                key={step}
                onClick={() => transition(step)}
                className="text-xs font-medium border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 capitalize"
              >
                Move to {step.replace("_", " ")}
              </button>
            ))}
          </div>
        )}
      </div>

      {app.status === "offer_sent" && !enrolledStudent && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Enroll as Student</h3>
          <form onSubmit={handleEnroll} className="grid grid-cols-2 gap-3">
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Select section (optional)</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input
              placeholder="Admission number (leave blank to auto-generate)"
              value={admissionNumber} onChange={(e) => setAdmissionNumber(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button type="submit" className="col-span-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg px-4 py-2">
              Confirm Enrollment
            </button>
          </form>
        </div>
      )}

      {enrolledStudent && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={16} className="text-brand-600" />
            <h3 className="text-sm font-semibold text-slate-800">
              Enrolled as {enrolledStudent.admission_number}
            </h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Now assign a fee structure — this is the explicit step that generates the student's first bill.
          </p>

          {feeStructures.length === 0 ? (
            <p className="text-sm text-slate-500 mb-4">No fee structures are defined for this class yet.</p>
          ) : (
            <div className="space-y-2 mb-4">
              {feeStructures.map((fs) => (
                <label key={fs.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={selectedFeeIds.has(fs.id)} onChange={() => toggleFeeStructure(fs.id)} />
                    <span className="text-sm text-slate-800">{fs.fee_type}</span>
                    <span className="text-xs text-slate-400 capitalize">({fs.frequency})</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 flex items-center">
                    <IndianRupee size={12} />{fs.amount.toLocaleString("en-IN")}
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-3">
            <input value={billingPeriod} onChange={(e) => setBillingPeriod(e.target.value)} placeholder="Billing period" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>

          {feeMessage && <p className="text-xs text-brand-700 mb-3">{feeMessage}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleGenerateInvoices}
              disabled={feeSaving || feeStructures.length === 0}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2"
            >
              {feeSaving ? "Generating..." : "Generate Invoices"}
            </button>
            <button
              onClick={() => router.push(`/dashboard/students/${enrolledStudent.id}`)}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg px-4 py-2"
            >
              Skip, go to student profile →
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">Document Checklist</h3>
          <span className="text-xs text-slate-500">{verifiedCount} of {REQUIRED_DOCUMENTS.length} verified</span>
        </div>
        <div className="space-y-2">
          {REQUIRED_DOCUMENTS.map((req) => {
            const doc = documents.find((d) => d.document_type === req.type);
            return (
              <div key={req.type} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2">
                  {doc?.verified_at ? (
                    <CheckCircle2 size={15} className="text-brand-600 shrink-0" />
                  ) : (
                    <Circle size={15} className="text-slate-300 shrink-0" />
                  )}
                  <span className="text-sm text-slate-800">{req.label}</span>
                  {doc && !doc.verified_at && (
                    <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Uploaded — not verified</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {doc ? (
                    <>
                      <button
                        onClick={() => downloadAuthenticatedFile(`/documents/${doc.id}/download`, doc.original_filename)}
                        className="text-xs text-brand-700 hover:underline"
                      >
                        View
                      </button>
                      {!doc.verified_at && (
                        <button
                          onClick={() => handleVerify(doc.id)}
                          disabled={verifyingId === doc.id}
                          className="text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-md px-2 py-1"
                        >
                          {verifyingId === doc.id ? "..." : "Verify"}
                        </button>
                      )}
                    </>
                  ) : (
                    <label className="cursor-pointer text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md px-2 py-1 flex items-center gap-1">
                      <Upload size={11} /> {uploadingType === req.type ? "..." : "Upload"}
                      <input type="file" onChange={(e) => handleUpload(req.type, e)} className="hidden" />
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
