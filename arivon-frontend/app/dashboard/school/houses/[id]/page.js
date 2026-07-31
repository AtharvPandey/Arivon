"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Shield, Users, Plus, X, UserCircle2, Search } from "lucide-react";
import { apiRequest, isLoggedIn, resolveAssetUrl } from "../../../../../lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PRESET_TITLES = ["House Captain", "Vice Captain", "Sports Captain", "House Coordinator"];

export default function HouseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [house, setHouse] = useState(null);
  const [positions, setPositions] = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [positionTitle, setPositionTitle] = useState(PRESET_TITLES[0]);
  const [holderType, setHolderType] = useState("student");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    load();
  }, [params.id]);

  async function load() {
    setLoading(true);
    try {
      const houseData = await apiRequest(`/houses/${params.id}`);
      setHouse(houseData);
      const [positionsData, staffData] = await Promise.all([
        apiRequest(`/houses/${params.id}/positions`),
        apiRequest(`/staff/?school_id=${houseData.school_id}`),
      ]);
      setPositions(positionsData);
      setAllStaff(staffData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(query) {
    setSearch(query);
    if (query.length < 2) { setSearchResults([]); return; }
    if (holderType === "student") {
      const data = await apiRequest(`/students/?school_id=${house.school_id}&search=${encodeURIComponent(query)}`);
      setSearchResults(data.slice(0, 6));
    } else {
      const filtered = allStaff.filter((s) => s.full_name.toLowerCase().includes(query.toLowerCase()));
      setSearchResults(filtered.slice(0, 6));
    }
  }

  async function handleAssign(personId) {
    setError("");
    try {
      await apiRequest(`/houses/${params.id}/positions`, {
        method: "POST",
        body: holderType === "student"
          ? { position_title: positionTitle, student_id: personId }
          : { position_title: positionTitle, staff_user_id: personId },
      });
      setSearch(""); setSearchResults([]); setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove(positionId) {
    if (!confirm("Remove this position assignment?")) return;
    try {
      await apiRequest(`/houses/positions/${positionId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="max-w-3xl mx-auto px-6 py-8 text-sm text-slate-600">Loading...</div>;
  if (!house) return null;

  const color = house.color || "#64748B";

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <button onClick={() => router.push("/dashboard/school/houses")} className="text-sm text-slate-600 hover:text-slate-900 mb-4 flex items-center gap-1">
        <ArrowLeft size={14} /> Back to Houses
      </button>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {/* Flag banner header */}
      <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-200 bg-white mb-6">
        <div className="relative h-32 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${color}, ${color}CC)` }}>
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: "repeating-linear-gradient(45deg, white 0, white 2px, transparent 2px, transparent 12px)",
          }} />
          <div className="relative w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center">
            <Shield size={38} className="text-white" fill="currentColor" fillOpacity={0.25} />
          </div>
        </div>
        <div className="p-5 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-display font-bold text-slate-900">{house.name}</h2>
            <p className="text-sm text-slate-500 italic mt-0.5">{house.slogan || "No slogan set yet"}</p>
          </div>
          <span className="text-sm font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1.5">
            <Users size={13} /> {house.student_count} students
          </span>
        </div>
      </div>

      {/* Leadership positions */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800">Leadership & Coordination</h3>
        <button onClick={() => setShowForm(!showForm)} className="text-xs font-medium bg-slate-800 hover:bg-slate-900 text-white rounded-lg px-3 py-1.5 flex items-center gap-1">
          <Plus size={12} /> Assign Position
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <select value={positionTitle} onChange={(e) => setPositionTitle(e.target.value)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm">
              {PRESET_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
              <option value="custom">Custom title...</option>
            </select>
            {positionTitle === "custom" && (
              <input onChange={(e) => setPositionTitle(e.target.value)} placeholder="Custom position title" className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm" />
            )}
            <select value={holderType} onChange={(e) => { setHolderType(e.target.value); setSearch(""); setSearchResults([]); }} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm">
              <option value="student">Student</option>
              <option value="staff">Staff / Teacher</option>
            </select>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input value={search} onChange={(e) => handleSearch(e.target.value)} placeholder={holderType === "student" ? "Search student by name..." : "Search staff by name..."} className="w-full rounded-lg border border-slate-200 pl-8 pr-2.5 py-2 text-sm" />
          </div>
          {searchResults.length > 0 && (
            <div className="border border-slate-100 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
              {searchResults.map((p) => (
                <button key={p.id} onClick={() => handleAssign(p.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                  {p.full_name} {p.admission_number && <span className="text-xs text-slate-400">({p.admission_number})</span>}
                  {p.designation && <span className="text-xs text-slate-400"> · {p.designation}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {positions.length === 0 ? (
          <div className="col-span-2 bg-white border border-slate-200 rounded-xl p-8 text-center">
            <UserCircle2 size={20} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-600">No leadership positions assigned yet.</p>
          </div>
        ) : positions.map((pos) => (
          <div key={pos.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold overflow-hidden shrink-0" style={{ backgroundColor: `${color}22`, color }}>
                {pos.holder_photo_url ? (
                  <img src={resolveAssetUrl(pos.holder_photo_url)} alt={pos.holder_name} className="w-full h-full object-cover" />
                ) : (
                  pos.holder_name ? pos.holder_name.charAt(0) : "?"
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{pos.holder_name || "Unassigned"}</p>
                <p className="text-xs text-slate-500">{pos.position_title} {pos.holder_type === "staff" && "· Staff"}</p>
              </div>
            </div>
            <button onClick={() => handleRemove(pos.id)} className="text-slate-400 hover:text-rose-600"><X size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
