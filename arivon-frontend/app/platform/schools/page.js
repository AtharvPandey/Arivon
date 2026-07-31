"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Download, ChevronUp, ChevronDown, Ban, RotateCcw, XCircle } from "lucide-react";
import { isPlatformLoggedIn, platformApiRequest, clearPlatformToken } from "../../../lib/platformApi";

const LIFECYCLE_STYLES = {
  active: "bg-brand-100 text-brand-700",
  pending_verification: "bg-amber-100 text-amber-700",
  verified: "bg-blue-100 text-blue-700",
  draft: "bg-slate-100 text-slate-600",
  rejected: "bg-red-100 text-red-700",
  suspended: "bg-orange-100 text-orange-700",
  closed: "bg-slate-200 text-slate-500",
};

function HealthBadge({ score }) {
  const color = score >= 70 ? "text-brand-700 bg-brand-50" : score >= 40 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>{score}</span>;
}

export default function SchoolsManagementPage() {
  const router = useRouter();
  const [schools, setSchools] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  const [selected, setSelected] = useState(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);

  useEffect(() => {
    if (!isPlatformLoggedIn()) {
      router.push("/platform/login");
      return;
    }
    load();
  }, [lifecycleFilter, planFilter, sortBy, sortDir]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (lifecycleFilter) params.set("lifecycle_status", lifecycleFilter);
      if (planFilter) params.set("subscription_plan", planFilter);
      params.set("sort_by", sortBy);
      params.set("sort_dir", sortDir);

      const data = await platformApiRequest(`/platform/school-management/schools?${params.toString()}`);
      setSchools(data);
      setSelected(new Set());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    load();
  }

  function toggleSort(column) {
    if (sortBy === column) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
  }

  function toggleSelect(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  function toggleSelectAll() {
    setSelected(selected.size === schools.length ? new Set() : new Set(schools.map((s) => s.id)));
  }

  async function handleBulkAction(action) {
    if (selected.size === 0) return;
    setBulkRunning(true);
    setError("");
    try {
      await platformApiRequest("/platform/school-management/schools/bulk-action", {
        method: "POST",
        body: { school_ids: Array.from(selected), action },
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBulkRunning(false);
    }
  }

  async function handleExport() {
    const token = sessionStorage.getItem("arivon_platform_token");
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const response = await fetch(`${API_URL}/platform/school-management/schools/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "arivon_schools_export.csv";
    a.click();
  }

  function handleLogout() {
    clearPlatformToken();
    router.push("/platform/login");
  }

  const SortHeader = ({ column, label }) => (
    <button onClick={() => toggleSort(column)} className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-800">
      {label}
      {sortBy === column && (sortDir === "desc" ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-navy-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-display font-bold text-white">Arivon Platform</span>
          <nav className="flex items-center gap-4">
            <button onClick={() => router.push("/platform/admin")} className="text-sm text-slate-300 hover:text-white">Overview</button>
            <button className="text-sm text-white font-medium">Schools</button>
            <button onClick={() => router.push("/platform/verification")} className="text-sm text-slate-300 hover:text-white">Verification</button>
            <button onClick={() => router.push("/platform/compliance")} className="text-sm text-slate-300 hover:text-white">Compliance</button>
          </nav>
        </div>
        <button onClick={handleLogout} className="text-sm text-slate-300 hover:text-white">Log out</button>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">Schools</h2>
            <p className="text-sm text-slate-600">{schools.length} school(s) on Arivon.</p>
          </div>
          <button
            onClick={handleExport}
            className="border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium rounded-lg px-4 py-2 flex items-center gap-1.5"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

        {/* Search + Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[220px] relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, city, or email..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm"
            />
          </form>
          <select value={lifecycleFilter} onChange={(e) => setLifecycleFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="pending_verification">Pending Verification</option>
            <option value="active">Active</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
            <option value="closed">Closed</option>
          </select>
          <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">All Plans</option>
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="bg-navy-900 text-white rounded-lg px-4 py-2.5 mb-3 flex items-center justify-between">
            <span className="text-sm">{selected.size} selected</span>
            <div className="flex items-center gap-2">
              <button onClick={() => handleBulkAction("suspend")} disabled={bulkRunning} className="text-xs font-medium bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 flex items-center gap-1">
                <Ban size={12} /> Suspend
              </button>
              <button onClick={() => handleBulkAction("reactivate")} disabled={bulkRunning} className="text-xs font-medium bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 flex items-center gap-1">
                <RotateCcw size={12} /> Reactivate
              </button>
              <button onClick={() => handleBulkAction("close")} disabled={bulkRunning} className="text-xs font-medium bg-red-500/80 hover:bg-red-500 rounded-lg px-3 py-1.5 flex items-center gap-1">
                <XCircle size={12} /> Close
              </button>
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* overflow-x-auto here — the table has 7 columns and no
              responsive handling would previously clip content on
              narrow viewports. Found during the production readiness
              review. */}
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={selected.size === schools.length && schools.length > 0} onChange={toggleSelectAll} />
                </th>
                <th className="text-left px-2 py-3"><SortHeader column="name" label="School" /></th>
                <th className="text-left px-2 py-3">Status</th>
                <th className="text-left px-2 py-3">Plan</th>
                <th className="text-left px-2 py-3">Health</th>
                <th className="text-left px-2 py-3"><SortHeader column="created_at" label="Registered" /></th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500">Loading...</td></tr>
              ) : schools.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500">No schools match these filters.</td></tr>
              ) : (
                schools.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} />
                    </td>
                    <td className="px-2 py-3">
                      <button onClick={() => router.push(`/platform/schools/${s.id}`)} className="font-medium text-slate-900 hover:text-brand-600 text-left">
                        {s.name}
                      </button>
                      <p className="text-xs text-slate-500">{s.board_type} · {s.city || "—"}</p>
                    </td>
                    <td className="px-2 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${LIFECYCLE_STYLES[s.lifecycle_status]}`}>
                        {s.lifecycle_status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-2 py-3 capitalize text-slate-700">{s.subscription_plan}</td>
                    <td className="px-2 py-3"><HealthBadge score={s.health_score} /></td>
                    <td className="px-2 py-3 text-slate-500 text-xs">{new Date(s.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => router.push(`/platform/schools/${s.id}`)} className="text-xs font-medium text-brand-700 hover:underline">
                        View →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}
