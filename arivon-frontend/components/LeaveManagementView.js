"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, CheckCircle2, XCircle, Clock } from "lucide-react";
import { apiRequest, isLoggedIn } from "../lib/api";

const HR_ROLES = ["school_admin", "principal", "vice_principal", "administrator", "super_admin"];
const LEAVE_TYPES = ["CL", "EL", "ML"];

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-brand-100 text-brand-700",
  rejected: "bg-rose-100 text-rose-700",
};

export default function LeaveManagementView() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [activeTab, setActiveTab] = useState("mine");
  const [myApplications, setMyApplications] = useState([]);
  const [balance, setBalance] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [leaveType, setLeaveType] = useState("CL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const [reviewingId, setReviewingId] = useState(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const isHR = me && HR_ROLES.includes(me.role_name);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/");
      return;
    }
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const currentUser = await apiRequest("/auth/me");
      setMe(currentUser);

      const [mine, myBalance] = await Promise.all([
        apiRequest(`/leave/applications?school_id=${currentUser.school_id}&user_id=${currentUser.id}`),
        apiRequest(`/leave/balance/${currentUser.id}`),
      ]);
      setMyApplications(mine);
      setBalance(myBalance);

      if (HR_ROLES.includes(currentUser.role_name)) {
        const pending = await apiRequest(`/leave/applications?school_id=${currentUser.school_id}&status=pending`);
        setPendingApprovals(pending);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApply(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiRequest("/leave/apply", {
        method: "POST",
        body: { leave_type: leaveType, start_date: startDate, end_date: endDate, reason },
      });
      setStartDate(""); setEndDate(""); setReason("");
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReview(id, decision) {
    try {
      await apiRequest(`/leave/applications/${id}/${decision}`, {
        method: "PATCH",
        body: { review_notes: reviewNotes || null },
      });
      setReviewingId(null);
      setReviewNotes("");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="max-w-3xl mx-auto px-6 py-8 text-sm text-slate-600">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-display font-bold text-slate-900">Leave Management</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg px-4 py-2 flex items-center gap-1.5"
        >
          <CalendarPlus size={15} /> Apply for Leave
        </button>
      </div>
      <p className="text-sm text-slate-600 mb-6">Apply, track, and (for HR roles) approve staff leave.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {showForm && (
        <form onSubmit={handleApply} className="bg-white border border-slate-200 rounded-xl p-5 mb-6 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <button type="submit" disabled={saving} className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2">
            {saving ? "Submitting..." : "Submit Application"}
          </button>
        </form>
      )}

      {balance && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {balance.balances.map((b) => (
            <div key={b.leave_type} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{b.leave_type}</p>
              <p className="text-2xl font-display font-bold text-slate-900 mt-1">{b.remaining}</p>
              <p className="text-xs text-slate-400">of {b.annual_quota} left</p>
            </div>
          ))}
        </div>
      )}

      {isHR && (
        <div className="flex items-center gap-1 border-b border-slate-200 mb-5">
          <button
            onClick={() => setActiveTab("mine")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${activeTab === "mine" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            My Applications
          </button>
          <button
            onClick={() => setActiveTab("approvals")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px flex items-center gap-1.5 ${activeTab === "approvals" ? "border-amber-600 text-amber-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            Approvals {pendingApprovals.length > 0 && <span className="bg-amber-100 text-amber-700 text-[10px] font-semibold px-1.5 rounded-full">{pendingApprovals.length}</span>}
          </button>
        </div>
      )}

      {(!isHR || activeTab === "mine") && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
          {myApplications.length === 0 ? (
            <p className="text-sm text-slate-500 p-6 text-center">No leave applications yet.</p>
          ) : (
            myApplications.map((app) => (
              <div key={app.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{app.leave_type} · {app.days} day(s)</p>
                  <p className="text-xs text-slate-500">{app.start_date} to {app.end_date}</p>
                  {app.reason && <p className="text-xs text-slate-500 mt-0.5">{app.reason}</p>}
                  {app.review_notes && <p className="text-xs text-slate-400 mt-1">Note: {app.review_notes}</p>}
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full capitalize ${STATUS_STYLES[app.status]}`}>
                  {app.status}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {isHR && activeTab === "approvals" && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
          {pendingApprovals.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 size={20} className="text-brand-500 mx-auto mb-2" />
              <p className="text-sm text-slate-600">No pending leave requests.</p>
            </div>
          ) : (
            pendingApprovals.map((app) => (
              <div key={app.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{app.staff_name}</p>
                    <p className="text-xs text-slate-500">{app.leave_type} · {app.days} day(s) · {app.start_date} to {app.end_date}</p>
                    {app.reason && <p className="text-xs text-slate-500 mt-0.5">{app.reason}</p>}
                  </div>
                  {reviewingId === app.id ? (
                    <div className="flex flex-col gap-1.5 shrink-0 w-48">
                      <input
                        value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Notes (optional)"
                        className="text-xs rounded-md border border-slate-200 px-2 py-1.5"
                      />
                      <div className="flex gap-1.5">
                        <button onClick={() => handleReview(app.id, "approve")} className="flex-1 text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-md py-1.5">
                          Approve
                        </button>
                        <button onClick={() => handleReview(app.id, "reject")} className="flex-1 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-md py-1.5">
                          Reject
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setReviewingId(app.id)}
                      className="text-xs font-medium text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-1 shrink-0"
                    >
                      <Clock size={12} /> Review
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
