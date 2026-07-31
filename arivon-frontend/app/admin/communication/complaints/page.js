"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, MessageCircleWarning, CheckCircle2, ArrowLeft } from "lucide-react";
import { apiRequest, isLoggedIn } from "../../../../lib/api";

export default function ComplaintsPage() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("open");
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const [resolvingId, setResolvingId] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/");
      return;
    }
    (async () => {
      try {
        const me = await apiRequest("/auth/me");
        setSchoolId(me.school_id);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  useEffect(() => {
    if (schoolId) load();
  }, [schoolId, statusFilter]);

  async function load() {
    setLoading(true);
    try {
      const data = await apiRequest(`/complaints/?school_id=${schoolId}&status=${statusFilter}`);
      setComplaints(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogComplaint(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiRequest("/complaints/", {
        method: "POST",
        body: { school_id: schoolId, guardian_name: guardianName, guardian_phone: guardianPhone, subject, description },
      });
      setGuardianName(""); setGuardianPhone(""); setSubject(""); setDescription("");
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleResolve(id) {
    try {
      await apiRequest(`/complaints/${id}/resolve`, {
        method: "PATCH",
        body: { resolution_notes: resolutionNotes || null },
      });
      setResolvingId(null);
      setResolutionNotes("");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <button onClick={() => router.push("/admin")} className="text-sm text-slate-600 hover:text-slate-900 mb-4 flex items-center gap-1">
        <ArrowLeft size={14} /> Back to Dashboard
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">Parent Complaints</h2>
          <p className="text-sm text-slate-600">A simple log of what's been raised, and whether it's been resolved.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg px-4 py-2 flex items-center gap-1.5"
        >
          <Plus size={16} /> Log Complaint
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {showForm && (
        <form onSubmit={handleLogComplaint} className="bg-white border border-slate-200 rounded-xl p-5 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              value={guardianName} onChange={(e) => setGuardianName(e.target.value)}
              placeholder="Guardian name *" required
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)}
              placeholder="Guardian phone (optional)"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <input
            value={subject} onChange={(e) => setSubject(e.target.value)}
            placeholder="What was raised? *" required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Additional details (optional)" rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2">
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="flex items-center gap-1 border-b border-slate-200 mb-5">
        <button
          onClick={() => setStatusFilter("open")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${statusFilter === "open" ? "border-rose-600 text-rose-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          Open
        </button>
        <button
          onClick={() => setStatusFilter("resolved")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${statusFilter === "resolved" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          Resolved
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : complaints.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <MessageCircleWarning size={22} className="text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-600">
            {statusFilter === "open" ? "Nothing open right now." : "Nothing resolved yet."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
          {complaints.map((c) => (
            <div key={c.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{c.subject}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {c.guardian_name}{c.guardian_phone && ` · ${c.guardian_phone}`}
                  </p>
                  {c.description && <p className="text-sm text-slate-600 mt-2">{c.description}</p>}
                  <p className="text-[11px] text-slate-400 mt-2">{new Date(c.created_at).toLocaleString()}</p>
                  {c.status === "resolved" && c.resolution_notes && (
                    <p className="text-xs text-brand-700 bg-brand-50 rounded-lg px-2.5 py-1.5 mt-2">
                      Resolved: {c.resolution_notes}
                    </p>
                  )}
                </div>
                {c.status === "open" && (
                  resolvingId === c.id ? (
                    <div className="flex flex-col gap-1.5 shrink-0 w-48">
                      <input
                        value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)}
                        placeholder="Resolution notes (optional)"
                        className="text-xs rounded-md border border-slate-200 px-2 py-1.5"
                      />
                      <button
                        onClick={() => handleResolve(c.id)}
                        className="text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-md px-2 py-1.5"
                      >
                        Confirm Resolved
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setResolvingId(c.id)}
                      className="text-xs font-medium text-brand-700 border border-brand-200 rounded-lg px-3 py-1.5 flex items-center gap-1 shrink-0"
                    >
                      <CheckCircle2 size={13} /> Resolve
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
