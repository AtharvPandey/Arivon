"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Bus, Home, CheckCircle2, AlertCircle, Pencil, Check, Phone, ArrowRight, Search } from "lucide-react";
import { apiRequest, isLoggedIn } from "../lib/api";

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function RollNumberCell({ student, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(student.roll_number || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await onSave(student.student_id, value.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus value={value} onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="e.g. 23" className="w-16 rounded-md border border-slate-200 px-2 py-1 text-xs"
        />
        <button onClick={handleSave} disabled={saving} className="w-6 h-6 rounded-md bg-brand-600 text-white flex items-center justify-center shrink-0">
          <Check size={12} />
        </button>
      </div>
    );
  }

  return student.roll_number ? (
    <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-brand-700">
      {student.roll_number} <Pencil size={10} className="text-slate-300" />
    </button>
  ) : (
    <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-md hover:bg-amber-100">
      <AlertCircle size={11} /> Assign
    </button>
  );
}

export default function StudentsJoinedBoard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    init();
  }, []);

  async function init() {
    try {
      const me = await apiRequest("/auth/me");
      setUser(me);
      const data = await apiRequest(`/admission-pipeline/students-joined?school_id=${me.school_id}`);
      setStudents(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAssignRoll(studentId, rollNumber) {
    const updated = await apiRequest(`/admission-pipeline/students-joined/${studentId}/roll-number`, {
      method: "PATCH", body: { roll_number: rollNumber },
    });
    setStudents((prev) => prev.map((s) => (s.student_id === studentId ? updated : s)));
  }

  const filtered = students.filter((s) => !search || s.full_name.toLowerCase().includes(search.toLowerCase()) || s.admission_number.toLowerCase().includes(search.toLowerCase()));
  const pendingRollCount = students.filter((s) => !s.roll_number).length;
  const pendingFeeCount = students.filter((s) => !s.fee_fully_paid).length;

  if (loading) return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-sm text-slate-600">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-6 sm:p-8 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <p className="text-xs font-medium text-indigo-300 mb-2 flex items-center gap-1.5">
            <GraduationCap size={12} /> Students Joined
          </p>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2">The Operational Handoff</h2>
          <p className="text-sm text-indigo-200 max-w-xl">
            Every student confirmed through Admissions — {students.length} total.
            {pendingRollCount > 0 && ` ${pendingRollCount} still need a roll number.`}
            {pendingFeeCount > 0 && ` ${pendingFeeCount} still have fees pending.`}
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="relative mb-5 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or admission number" className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm" />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <GraduationCap size={24} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-600">No students have joined yet.</p>
          <p className="text-xs text-slate-400 mt-1">Confirmed admissions will show up here automatically.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-4 py-2.5 border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
            <div className="col-span-3">Student</div>
            <div className="col-span-2">Admission No.</div>
            <div className="col-span-1">Roll No.</div>
            <div className="col-span-2">Class</div>
            <div className="col-span-2">Guardian</div>
            <div className="col-span-1">Fees</div>
            <div className="col-span-1">Joined</div>
          </div>
          <div className="divide-y divide-slate-100">
            {filtered.map((s) => (
              <div key={s.student_id} className="grid grid-cols-12 gap-3 px-4 py-3.5 items-center hover:bg-slate-50">
                <button onClick={() => router.push(`/admissions/students/${s.student_id}`)} className="col-span-3 flex items-center gap-2.5 text-left min-w-0">
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-semibold text-xs shrink-0">
                    {s.full_name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate flex items-center gap-1">
                      {s.full_name} <ArrowRight size={10} className="text-slate-300 shrink-0" />
                    </p>
                    <p className="text-[11px] text-slate-400">{timeAgo(s.confirmed_at)}</p>
                  </div>
                </button>
                <div className="col-span-2 text-xs text-slate-600 font-mono truncate">{s.admission_number}</div>
                <div className="col-span-1"><RollNumberCell student={s} onSave={handleAssignRoll} /></div>
                <div className="col-span-2 min-w-0">
                  <p className="text-xs text-slate-700">{s.school_class_name} {s.section_name}</p>
                  <div className="flex gap-1 mt-0.5">
                    {s.transport_required && <Bus size={11} className="text-teal-500" title="Transport required" />}
                    {s.hostel_required && <Home size={11} className="text-teal-500" title="Hostel required" />}
                  </div>
                </div>
                <div className="col-span-2 min-w-0">
                  <p className="text-xs text-slate-700 truncate">{s.guardian_name}</p>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1"><Phone size={9} /> {s.guardian_phone}</p>
                </div>
                <div className="col-span-1">
                  {s.fee_fully_paid ? (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full w-fit"><CheckCircle2 size={10} /> Paid</span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full w-fit"><AlertCircle size={10} /> Due</span>
                  )}
                </div>
                <div className="col-span-1 text-[11px] text-slate-400">{timeAgo(s.confirmed_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
