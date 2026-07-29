"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle, RotateCcw, ShieldCheck } from "lucide-react";
import { isPlatformLoggedIn, platformApiRequest } from "../../../../lib/platformApi";

const STATUS_STYLES = {
  valid: "bg-brand-100 text-brand-700",
  expiring_soon: "bg-amber-100 text-amber-700",
  expired: "bg-red-100 text-red-700",
  no_expiry: "bg-slate-100 text-slate-600",
};

export default function VerificationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const schoolId = params.schoolId;

  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    if (!isPlatformLoggedIn()) {
      router.push("/platform/login");
      return;
    }
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await platformApiRequest(`/platform/verification/${schoolId}`);
      setDetail(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyDocument(documentId) {
    setError("");
    try {
      await platformApiRequest(`/platform/verification/${schoolId}/documents/${documentId}/verify`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleApprove() {
    setError("");
    setActing(true);
    try {
      await platformApiRequest(`/platform/verification/${schoolId}/approve`, { method: "POST" });
      router.push("/platform/verification");
    } catch (err) {
      setError(err.message);
      setActing(false);
    }
  }

  async function handleReject() {
    setError("");
    if (!rejectReason.trim()) {
      setError("A rejection reason is required.");
      return;
    }
    setActing(true);
    try {
      await platformApiRequest(`/platform/verification/${schoolId}/reject`, {
        method: "POST",
        body: { reason: rejectReason },
      });
      router.push("/platform/verification");
    } catch (err) {
      setError(err.message);
      setActing(false);
    }
  }

  async function handleResubmit() {
    setError("");
    setActing(true);
    try {
      await platformApiRequest(`/platform/verification/${schoolId}/resubmit`, {
        method: "POST",
        body: { notes: "Resubmitted for review" },
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setActing(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Loading...</div>;
  if (!detail) return null;

  const isRejected = detail.lifecycle_status === "rejected";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-navy-900 px-6 py-4">
        <span className="font-display font-bold text-white">Arivon Platform — Verification</span>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <button onClick={() => router.push("/platform/verification")} className="text-sm text-slate-600 hover:text-slate-900 mb-4 flex items-center gap-1">
          <ArrowLeft size={14} /> Back to Queue
        </button>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-display font-bold text-slate-900">{detail.school_name}</h2>
            <p className="text-sm text-slate-600">Status: <span className="font-medium capitalize">{detail.lifecycle_status.replace(/_/g, " ")}</span></p>
          </div>
          {isRejected && (
            <button
              onClick={handleResubmit}
              disabled={acting}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg px-4 py-2 flex items-center gap-1.5"
            >
              <RotateCcw size={14} /> Resubmit for Review
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Identity</h3>
            <Row label="School Type" value={detail.identity.school_type} />
            <Row label="Category" value={detail.identity.school_category} />
            <Row label="Year Established" value={detail.identity.year_established} />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Government Recognition</h3>
            <Row label="Board" value={detail.government_recognition.board_type} />
            <Row label="UDISE+ Code" value={detail.government_recognition.udise_code} />
            <Row label="Affiliation No." value={detail.government_recognition.affiliation_number} />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Address & Contact</h3>
            <Row label="City" value={detail.address_contact.city} />
            <Row label="State" value={detail.address_contact.state} />
            <Row label="Contact Email" value={detail.address_contact.contact_email} />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Management</h3>
            <Row label="School Admin" value={detail.management.admin_full_name} />
            <Row label="Admin Email" value={detail.management.admin_email} />
          </div>
        </div>

        {/* Checklist */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <ShieldCheck size={16} className="text-brand-600" /> Verification Checklist
          </h3>
          <div className="space-y-2">
            {detail.checklist.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {item.passed ? (
                    <CheckCircle2 size={15} className="text-brand-600 shrink-0" />
                  ) : (
                    <XCircle size={15} className="text-amber-500 shrink-0" />
                  )}
                  <span className="text-slate-700">{item.label}</span>
                </div>
                <span className="text-xs text-slate-500">{item.detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Documents */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Documents</h3>
          {detail.documents.length === 0 ? (
            <p className="text-sm text-slate-500">No documents uploaded.</p>
          ) : (
            <div className="space-y-2">
              {detail.documents.map((d) => (
                <div key={d.id} className="flex items-center justify-between border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                  <div>
                    <p className="text-sm text-slate-900 capitalize">{d.document_type.replace(/_/g, " ")}</p>
                    <p className="text-xs text-slate-500">{d.original_filename} {d.expiry_date && `· expires ${d.expiry_date}`}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[d.computed_status]}`}>
                      {d.computed_status.replace(/_/g, " ")}
                    </span>
                    <button
                      onClick={() => handleVerifyDocument(d.id)}
                      className="text-xs font-medium text-brand-700 border border-brand-200 rounded-lg px-2.5 py-1 hover:bg-brand-50"
                    >
                      Mark Verified
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Approve / Reject */}
        {detail.lifecycle_status === "pending_verification" && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Decision</h3>

            {showRejectForm ? (
              <div className="space-y-3">
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason for rejection (required, visible to the school on request)"
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleReject}
                    disabled={acting}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg px-4 py-2"
                  >
                    Confirm Reject
                  </button>
                  <button
                    onClick={() => setShowRejectForm(false)}
                    className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={handleApprove}
                  disabled={acting}
                  className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-5 py-2.5 flex items-center gap-1.5"
                >
                  <CheckCircle2 size={15} /> Approve
                </button>
                <button
                  onClick={() => setShowRejectForm(true)}
                  className="border border-red-200 text-red-700 hover:bg-red-50 text-sm font-medium rounded-lg px-5 py-2.5 flex items-center gap-1.5"
                >
                  <XCircle size={15} /> Reject
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900 font-medium">{value || "—"}</span>
    </div>
  );
}
