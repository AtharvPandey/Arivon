"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, ShieldCheck, Activity, FileWarning, CreditCard, ListTree, UserCog } from "lucide-react";
import { isPlatformLoggedIn, platformApiRequest } from "../../../../lib/platformApi";

const TABS = [
  { key: "overview", label: "Overview", icon: Activity },
  { key: "timeline", label: "Timeline", icon: ListTree },
  { key: "compliance", label: "Compliance", icon: FileWarning },
  { key: "subscription", label: "Subscription", icon: CreditCard },
  { key: "audit", label: "Audit Logs", icon: ShieldCheck },
];

const STATUS_STYLES = {
  valid: "bg-brand-100 text-brand-700", expiring_soon: "bg-amber-100 text-amber-700", expired: "bg-red-100 text-red-700",
};

export default function SchoolDetailPage() {
  const router = useRouter();
  const params = useParams();
  const schoolId = params.schoolId;

  const [detail, setDetail] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [compliance, setCompliance] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState(false);

  useEffect(() => {
    if (!isPlatformLoggedIn()) {
      router.push("/platform/login");
      return;
    }
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [detailData, timelineData, complianceData] = await Promise.all([
        platformApiRequest(`/platform/school-management/schools/${schoolId}/detail`),
        platformApiRequest(`/platform/school-management/schools/${schoolId}/timeline`),
        platformApiRequest(`/platform/compliance/admin?school_id=${schoolId}`),
      ]);
      setDetail(detailData);
      setTimeline(timelineData);
      setCompliance(complianceData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleImpersonate() {
    setImpersonating(true);
    setError("");
    try {
      const result = await platformApiRequest(`/platform/school-management/schools/${schoolId}/impersonate`, { method: "POST" });
      alert(`Impersonation token issued for ${result.impersonating_user_email} (valid ${result.expires_in_minutes} min). In a full implementation, this would open the school dashboard in a new tab using this token.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setImpersonating(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Loading...</div>;
  if (!detail) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-navy-900 px-6 py-4">
        <span className="font-display font-bold text-white">Arivon Platform — School Details</span>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <button onClick={() => router.push("/platform/schools")} className="text-sm text-slate-600 hover:text-slate-900 mb-4 flex items-center gap-1">
          <ArrowLeft size={14} /> Back to Schools
        </button>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-display font-bold text-slate-900">{detail.name}</h2>
            <p className="text-sm text-slate-600">{detail.board_type} · {detail.city}, {detail.state} · <span className="capitalize">{detail.lifecycle_status.replace(/_/g, " ")}</span></p>
          </div>
          <button
            onClick={handleImpersonate}
            disabled={impersonating}
            className="border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium rounded-lg px-4 py-2 flex items-center gap-1.5"
          >
            <UserCog size={14} /> {impersonating ? "Generating..." : "Impersonate"}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
                activeTab === tab.key ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Health Score</h3>
                <p className="text-3xl font-bold text-slate-900 mb-3">{detail.health_score.score}/100</p>
                {detail.health_score.factors.map((f, i) => (
                  <div key={i} className="flex justify-between text-xs py-1">
                    <span className="text-slate-600">{f.label}</span>
                    <span className="text-slate-900 font-medium">{f.points}/{f.max_points} — {f.detail}</span>
                  </div>
                ))}
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Organization Completeness</h3>
                <p className="text-3xl font-bold text-slate-900 mb-3">{detail.completeness.percentage}%</p>
                {detail.completeness.checks.map((c, i) => (
                  <div key={i} className="flex justify-between text-xs py-1">
                    <span className="text-slate-600">{c.label}</span>
                    <span className={c.complete ? "text-brand-700 font-medium" : "text-slate-400"}>{c.complete ? "✓ Done" : "Pending"}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <StatCard label="Departments" value={detail.department_count} />
              <StatCard label="Students" value={detail.student_count} />
              <StatCard label="Staff" value={detail.staff_count} />
              <StatCard label="Documents" value={detail.document_count} />
            </div>
          </div>
        )}

        {activeTab === "timeline" && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            {timeline.length === 0 ? (
              <p className="text-sm text-slate-500">No activity recorded yet.</p>
            ) : (
              <div className="space-y-4">
                {timeline.map((event, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-900 capitalize">{event.event_type.replace(/_/g, " ")}</p>
                      {event.description && <p className="text-xs text-slate-500">{event.description}</p>}
                      <p className="text-xs text-slate-400">{new Date(event.occurred_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "compliance" && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            {compliance.items.length === 0 ? (
              <p className="text-sm text-slate-500">No compliance documents expiring within 60 days.</p>
            ) : (
              <div className="space-y-2">
                {compliance.items.map((item) => (
                  <div key={item.document_id} className="flex items-center justify-between text-sm border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                    <span className="capitalize text-slate-700">{item.document_type.replace(/_/g, " ")} · expires {item.expiry_date}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[item.computed_status]}`}>
                      {item.computed_status.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "subscription" && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <Row label="Plan" value={detail.subscription_plan} />
            <Row label="Status" value={detail.subscription_status} />
            <Row label="Billing Cycle" value={detail.billing_cycle} />
            <Row label="Contract Start" value={detail.contract_start_date} />
            <Row label="Contract End" value={detail.contract_end_date} />
          </div>
        )}

        {activeTab === "audit" && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Action</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Details</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">When</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((event, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2.5 capitalize">{event.event_type.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2.5 text-slate-600">{event.description || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{new Date(event.occurred_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b border-slate-100 last:border-0 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900 font-medium capitalize">{value || "—"}</span>
    </div>
  );
}
