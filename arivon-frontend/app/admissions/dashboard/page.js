"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, UserPlus, TrendingUp, CheckCircle2 } from "lucide-react";
import { apiRequest, isLoggedIn } from "../../../lib/api";
import MiniCalendar from "../../../components/MiniCalendar";
import NoticeBoard from "../../../components/NoticeBoard";

const STAGES = [
  { key: "inquiry", label: "Inquiry" },
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Under Review" },
  { key: "offer_sent", label: "Offer Sent" },
  { key: "enrolled", label: "Enrolled" },
];

export default function AdmissionsDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [counts, setCounts] = useState({});
  const [recentApplications, setRecentApplications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/");
      return;
    }
    init();
  }, []);

  async function init() {
    try {
      const me = await apiRequest("/auth/me");
      setUser(me);

      const stageResults = await Promise.all(
        STAGES.map((s) => apiRequest(`/admissions/applications?school_id=${me.school_id}&status=${s.key}`))
      );
      const newCounts = {};
      STAGES.forEach((s, i) => { newCounts[s.key] = stageResults[i]; });
      setCounts(newCounts);

      const all = stageResults.flat();
      const recent = all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 6);
      setRecentApplications(recent);

      const notices = await apiRequest(`/announcements/?school_id=${me.school_id}`);
      setAnnouncements(notices);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadAnnouncements(schoolId) {
    const data = await apiRequest(`/announcements/?school_id=${schoolId}`);
    setAnnouncements(data);
  }

  const activePipeline = STAGES.slice(0, 4).reduce((sum, s) => sum + (counts[s.key]?.length || 0), 0);
  const enrolledCount = counts.enrolled?.length || 0;

  if (loading) return <div className="max-w-5xl mx-auto px-6 py-8 text-sm text-slate-600">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">
            Welcome back{user ? `, ${user.full_name.split(" ")[0]}` : ""}
          </h2>
          <p className="text-sm text-slate-600">Your admissions pipeline, at a glance.</p>
        </div>
        <button
          onClick={() => router.push("/dashboard/admissions")}
          className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 flex items-center gap-1.5"
        >
          <UserPlus size={16} />
          New Inquiry
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-500">Active Pipeline</p>
            <TrendingUp size={16} className="text-slate-400" />
          </div>
          <p className="text-3xl font-bold text-slate-900">{activePipeline}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-500">Enrolled</p>
            <CheckCircle2 size={16} className="text-brand-600" />
          </div>
          <p className="text-3xl font-bold text-brand-700">{enrolledCount}</p>
        </div>
        {STAGES.slice(0, 2).map((s) => (
          <div key={s.key} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-500">{s.label}</p>
              <ClipboardList size={16} className="text-slate-400" />
            </div>
            <p className="text-3xl font-bold text-slate-900">{counts[s.key]?.length || 0}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-6">
        {STAGES.map((s) => (
          <div key={s.key} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className="text-xl font-bold text-slate-900">{counts[s.key]?.length || 0}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Recent Applications</h3>
        {recentApplications.length === 0 ? (
          <p className="text-sm text-slate-500">No applications yet — create one with "New Inquiry" above.</p>
        ) : (
          <div className="space-y-2">
            {recentApplications.map((a) => (
              <button
                key={a.id}
                onClick={() => router.push(`/dashboard/admissions/${a.id}`)}
                className="w-full flex items-center justify-between border-b border-slate-100 last:border-0 pb-2 last:pb-0 text-left hover:bg-slate-50 rounded px-1"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{a.applicant_name}</p>
                  <p className="text-xs text-slate-500">{a.date_of_birth}</p>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">
                  {a.status.replace("_", " ")}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MiniCalendar />
        {user && (
          <NoticeBoard
            schoolId={user.school_id}
            userRole={user.role_name}
            announcements={announcements}
            onPosted={() => loadAnnouncements(user.school_id)}
          />
        )}
      </div>
    </div>
  );
}
