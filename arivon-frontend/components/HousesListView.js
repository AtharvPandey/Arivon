"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Plus, Pencil, Check, X, Users } from "lucide-react";
import { apiRequest, isLoggedIn } from "../lib/api";

const PRESET_COLORS = ["#DC2626", "#2563EB", "#16A34A", "#CA8A04", "#7C3AED", "#DB2777"];

export default function HousesListView({ rolePrefix = "/admin" }) {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState(null);
  const [houses, setHouses] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [slogan, setSlogan] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editSlogan, setEditSlogan] = useState("");
  const [editColor, setEditColor] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    (async () => {
      try {
        const me = await apiRequest("/auth/me");
        setSchoolId(me.school_id);
        await load(me.school_id);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function load(id) {
    const data = await apiRequest(`/houses/?school_id=${id}`);
    setHouses(data);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    try {
      await apiRequest("/houses/", { method: "POST", body: { school_id: schoolId, name, color, slogan: slogan || null } });
      setName(""); setSlogan(""); setColor(PRESET_COLORS[0]);
      setShowForm(false);
      await load(schoolId);
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(house) {
    setEditingId(house.id);
    setEditSlogan(house.slogan || "");
    setEditColor(house.color || PRESET_COLORS[0]);
  }

  async function handleSaveEdit(houseId) {
    setError("");
    try {
      await apiRequest(`/houses/${houseId}`, { method: "PATCH", body: { slogan: editSlogan || null, color: editColor } });
      setEditingId(null);
      await load(schoolId);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-display font-bold text-slate-900">School Houses</h2>
        <button onClick={() => setShowForm(!showForm)} className="text-sm font-medium bg-slate-800 hover:bg-slate-900 text-white rounded-lg px-4 py-2 flex items-center gap-1.5">
          <Plus size={14} /> Add House
        </button>
      </div>
      <p className="text-sm text-slate-600 mb-6">Used for inter-house competitions, sports day, and merit points.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-5 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="House name (e.g. Phoenix House)" required className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} className={`w-7 h-7 rounded-full ${color === c ? "ring-2 ring-offset-2 ring-slate-400" : ""}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <input value={slogan} onChange={(e) => setSlogan(e.target.value)} placeholder="Slogan / motto (e.g. Courage. Honor. Victory.)" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg px-4 py-2">Create House</button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-600">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {houses.map((house) => {
            const isEditing = editingId === house.id;
            const color = isEditing ? editColor : house.color || "#64748B";
            return (
              <div key={house.id} className="rounded-2xl overflow-hidden shadow-sm border border-slate-200 bg-white">
                {/* Flag banner - clickable to detail page */}
                <button
                  onClick={() => !isEditing && router.push(`${rolePrefix}/school/houses/${house.id}`)}
                  className="relative h-28 w-full flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${color}, ${color}CC)` }}
                >
                  <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: "repeating-linear-gradient(45deg, white 0, white 2px, transparent 2px, transparent 12px)",
                  }} />
                  <div className="relative w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center">
                    <Shield size={30} className="text-white" fill="currentColor" fillOpacity={0.25} />
                  </div>
                  {isEditing && (
                    <div className="absolute top-2 right-2 flex gap-1">
                      {PRESET_COLORS.map((c) => (
                        <button key={c} type="button" onClick={(e) => { e.stopPropagation(); setEditColor(c); }} className={`w-5 h-5 rounded-full border-2 ${editColor === c ? "border-white" : "border-white/30"}`} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  )}
                </button>

                {/* Details */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-1">
                    <button onClick={() => router.push(`${rolePrefix}/school/houses/${house.id}`)} className="text-lg font-display font-bold text-slate-900 hover:text-indigo-700">
                      {house.name}
                    </button>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex items-center gap-1 shrink-0">
                      <Users size={11} /> {house.student_count}
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2 mt-2">
                      <input
                        value={editSlogan} onChange={(e) => setEditSlogan(e.target.value)}
                        placeholder="Slogan / motto"
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm italic"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleSaveEdit(house.id)} className="flex-1 flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg py-1.5">
                          <Check size={12} /> Save
                        </button>
                        <button onClick={() => setEditingId(null)} className="px-3 text-xs text-slate-500 border border-slate-200 rounded-lg">
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-sm text-slate-500 italic">
                        {house.slogan || <span className="text-slate-300">No slogan set yet</span>}
                      </p>
                      <button onClick={() => startEdit(house)} className="text-slate-400 hover:text-slate-700 shrink-0 ml-2">
                        <Pencil size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {houses.length === 0 && (
            <div className="col-span-2 bg-white border border-slate-200 rounded-xl p-8 text-center">
              <Shield size={20} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-600">No houses created yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
