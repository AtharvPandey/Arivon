"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Search, Download, Shuffle, ArrowUpCircle } from "lucide-react";
import { apiRequest, isLoggedIn } from "../lib/api";
import ClassSelect from "./ClassSelect";

const CATEGORIES = ["General", "OBC", "SC", "ST", "EWS"];

export default function StudentsListView({ detailPrefix = "/admin/students" }) {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState(null);
  const [classes, setClasses] = useState([]);
  const [houses, setHouses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [houseFilter, setHouseFilter] = useState("");

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [bulkAction, setBulkAction] = useState(null); // "shuffle" | "promote"
  const [targetSectionId, setTargetSectionId] = useState("");
  const [targetYearId, setTargetYearId] = useState("");
  const [targetClassId, setTargetClassId] = useState("");
  const [targetSections, setTargetSections] = useState([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/");
      return;
    }
    (async () => {
      try {
        const me = await apiRequest("/auth/me");
        setSchoolId(me.school_id);
        const [classList, houseList, yearList] = await Promise.all([
          apiRequest(`/classes/?school_id=${me.school_id}`),
          apiRequest(`/houses/?school_id=${me.school_id}`),
          apiRequest(`/academic-years/?school_id=${me.school_id}`),
        ]);
        setClasses(classList);
        setHouses(houseList);
        setAcademicYears(yearList);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedClassId) {
      setSections([]);
      setSelectedSectionId("");
      return;
    }
    apiRequest(`/classes/${selectedClassId}/sections`).then(setSections);
  }, [selectedClassId]);

  useEffect(() => {
    if (!targetClassId) {
      setTargetSections([]);
      setTargetSectionId("");
      return;
    }
    apiRequest(`/classes/${targetClassId}/sections`).then(setTargetSections);
  }, [targetClassId]);

  useEffect(() => {
    if (schoolId) load();
  }, [schoolId, selectedSectionId, categoryFilter, genderFilter, houseFilter]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ school_id: schoolId });
      if (selectedSectionId) params.set("section_id", selectedSectionId);
      if (search) params.set("search", search);
      if (categoryFilter) params.set("category", categoryFilter);
      if (genderFilter) params.set("gender", genderFilter);
      if (houseFilter) params.set("house_id", houseFilter);
      const data = await apiRequest(`/students/?${params.toString()}`);
      setStudents(data);
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

  function toggleSelect(id) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  function toggleSelectAll() {
    setSelected(selected.size === students.length ? new Set() : new Set(students.map((s) => s.id)));
  }

  async function handleExport(format) {
    const params = new URLSearchParams({ school_id: schoolId });
    if (selectedSectionId) params.set("section_id", selectedSectionId);
    const token = sessionStorage.getItem("arivon_token");
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const path = format === "xlsx" ? "/students/export.xlsx" : "/students/export";
    const response = await fetch(`${API_URL}${path}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = format === "xlsx" ? "students_export.xlsx" : "students_export.csv";
    a.click();
  }

  async function handleBulkSubmit() {
    setBulkRunning(true);
    setBulkMessage("");
    try {
      if (bulkAction === "shuffle") {
        if (!targetSectionId) throw new Error("Choose a target section first.");
        const result = await apiRequest("/students/bulk/section-shuffle", {
          method: "POST",
          body: { student_ids: Array.from(selected), new_section_id: Number(targetSectionId) },
        });
        setBulkMessage(`Moved ${result.succeeded.length} student(s).`);
      } else if (bulkAction === "promote") {
        if (!selectedSectionId) throw new Error("Pick a source section above first.");
        if (!targetSectionId || !targetYearId) throw new Error("Choose a target academic year and section.");
        const result = await apiRequest("/students/bulk/promote", {
          method: "POST",
          body: {
            source_section_id: Number(selectedSectionId),
            target_section_id: Number(targetSectionId),
            target_academic_year_id: Number(targetYearId),
          },
        });
        setBulkMessage(`Promoted ${result.succeeded.length} student(s).`);
      }
      setBulkAction(null);
      setTargetSectionId(""); setTargetClassId(""); setTargetYearId("");
      await load();
    } catch (err) {
      setBulkMessage(err.message);
    } finally {
      setBulkRunning(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-display font-bold text-slate-900">Students</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport("csv")}
            className="border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium rounded-lg px-4 py-2 flex items-center gap-1.5"
          >
            <Download size={14} /> CSV
          </button>
          <button
            onClick={() => handleExport("xlsx")}
            className="border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium rounded-lg px-4 py-2 flex items-center gap-1.5"
          >
            <Download size={14} /> Excel
          </button>
        </div>
      </div>
      <p className="text-sm text-slate-600 mb-6">Search, filter, and manage your student roster.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or admission number..."
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm"
          />
        </form>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ClassSelect classes={classes} value={selectedClassId} onChange={setSelectedClassId} placeholder="Any class" />
          <select
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            disabled={!selectedClassId}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
          >
            <option value="">Any section</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">Any category</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">Any gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
        {houses.length > 0 && (
          <select value={houseFilter} onChange={(e) => setHouseFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">Any house</option>
            {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        )}
      </div>

      {selected.size > 0 && (
        <div className="bg-navy-900 text-white rounded-lg px-4 py-2.5 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">{selected.size} selected</span>
            {!bulkAction && (
              <div className="flex items-center gap-2">
                <button onClick={() => setBulkAction("shuffle")} className="text-xs font-medium bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 flex items-center gap-1">
                  <Shuffle size={12} /> Section Shuffle
                </button>
                <button onClick={() => setBulkAction("promote")} className="text-xs font-medium bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 flex items-center gap-1">
                  <ArrowUpCircle size={12} /> Promote
                </button>
              </div>
            )}
          </div>
          {bulkAction === "shuffle" && (
            <div className="flex items-center gap-2 mt-2">
              <select value={selectedSectionId ? targetClassId : targetClassId} onChange={(e) => setTargetClassId(e.target.value)} className="text-xs rounded-md border-0 px-2 py-1.5 text-slate-800">
                <option value="">Target class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={targetSectionId} onChange={(e) => setTargetSectionId(e.target.value)} disabled={!targetClassId} className="text-xs rounded-md border-0 px-2 py-1.5 text-slate-800">
                <option value="">Target section</option>
                {targetSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button onClick={handleBulkSubmit} disabled={bulkRunning} className="text-xs font-medium bg-teal-500 hover:bg-teal-600 rounded-md px-3 py-1.5">
                {bulkRunning ? "Moving..." : "Confirm Move"}
              </button>
              <button onClick={() => setBulkAction(null)} className="text-xs text-white/70 hover:text-white">Cancel</button>
            </div>
          )}
          {bulkAction === "promote" && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <select value={targetYearId} onChange={(e) => setTargetYearId(e.target.value)} className="text-xs rounded-md border-0 px-2 py-1.5 text-slate-800">
                <option value="">Target academic year</option>
                {academicYears.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
              </select>
              <select value={targetClassId} onChange={(e) => setTargetClassId(e.target.value)} className="text-xs rounded-md border-0 px-2 py-1.5 text-slate-800">
                <option value="">Target class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={targetSectionId} onChange={(e) => setTargetSectionId(e.target.value)} disabled={!targetClassId} className="text-xs rounded-md border-0 px-2 py-1.5 text-slate-800">
                <option value="">Target section</option>
                {targetSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button onClick={handleBulkSubmit} disabled={bulkRunning} className="text-xs font-medium bg-teal-500 hover:bg-teal-600 rounded-md px-3 py-1.5">
                {bulkRunning ? "Promoting..." : "Confirm Promotion"}
              </button>
              <button onClick={() => setBulkAction(null)} className="text-xs text-white/70 hover:text-white">Cancel</button>
            </div>
          )}
          {bulkMessage && <p className="text-xs mt-2 text-white/80">{bulkMessage}</p>}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-600">Loading...</p>
      ) : students.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-sm text-slate-600">No students match these filters.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-3">
            <input type="checkbox" checked={selected.size === students.length && students.length > 0} onChange={toggleSelectAll} />
            <span className="text-xs text-slate-500">{students.length} student(s)</span>
          </div>
          {students.map((s, i) => (
            <div
              key={s.id}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${i !== students.length - 1 ? "border-b border-slate-100" : ""}`}
            >
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} />
              <button onClick={() => router.push(`${detailPrefix}/${s.id}`)} className="flex-1 flex items-center justify-between text-left">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-semibold shrink-0">
                    {s.full_name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{s.full_name}</p>
                    <p className="text-xs text-slate-500">{s.admission_number} {s.category && `· ${s.category}`}</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
