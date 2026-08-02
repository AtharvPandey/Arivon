"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import { apiRequest, isLoggedIn } from "../lib/api";

export default function ParentsView({ studentDetailPrefix = "/admin/students" }) {
  const router = useRouter();
  const [guardians, setGuardians] = useState([]);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [childrenByGuardian, setChildrenByGuardian] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/");
      return;
    }
    (async () => {
      try {
        const me = await apiRequest("/auth/me");
        setSchoolId(me.school_id);
        await load(me.school_id, "");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function load(sid, searchTerm) {
    const query = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : "";
    const data = await apiRequest(`/guardians/?school_id=${sid}${query}`);
    setGuardians(data);
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (schoolId) await load(schoolId, search);
  }

  async function toggleExpand(guardian) {
    if (expandedId === guardian.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(guardian.id);
    if (!childrenByGuardian[guardian.id]) {
      const kids = await apiRequest(`/guardians/${guardian.id}/students`);
      setChildrenByGuardian((prev) => ({ ...prev, [guardian.id]: kids }));
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">Parents</h2>
      <p className="text-sm text-slate-600 mb-6">Every guardian on record, and the children linked to them.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <form onSubmit={handleSearch} className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm"
        />
      </form>

      {loading ? (
        <p className="text-sm text-slate-600">Loading...</p>
      ) : guardians.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-sm text-slate-600">No parent/guardian records yet. These are created through Admissions.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {guardians.map((g, i) => (
            <div key={g.id} className={i !== guardians.length - 1 ? "border-b border-slate-100" : ""}>
              <button
                onClick={() => toggleExpand(g)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-left"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{g.full_name}</p>
                  <p className="text-xs text-slate-500 capitalize">{g.relation} · {g.phone}</p>
                </div>
                {expandedId === g.id ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
              </button>
              {expandedId === g.id && (
                <div className="px-4 pb-3 pl-8">
                  {g.email && <p className="text-xs text-slate-500 mb-2">{g.email}</p>}
                  <p className="text-xs font-medium text-slate-600 mb-1">Children</p>
                  {(childrenByGuardian[g.id] || []).length === 0 ? (
                    <p className="text-xs text-slate-400">No children linked yet.</p>
                  ) : (
                    <div className="space-y-1">
                      {childrenByGuardian[g.id].map((child) => (
                        <button
                          key={child.id}
                          onClick={() => router.push(`${studentDetailPrefix}/${child.id}`)}
                          className="text-xs text-brand-700 hover:underline block"
                        >
                          {child.full_name} ({child.admission_number})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
