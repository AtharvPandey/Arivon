"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Users, User, ChevronRight, Search, Phone, BookOpen,
  UserCheck,
} from "lucide-react";
import { apiRequest, isLoggedIn } from "../../../../../../lib/api";

export default function SectionDetailPage() {
  const router = useRouter();
  const { classId, sectionId } = useParams();
  const [section, setSection] = useState(null);
  const [students, setStudents] = useState([]);
  const [schoolId, setSchoolId] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    (async () => {
      try {
        const me = await apiRequest("/auth/me");
        setSchoolId(me.school_id);
        // Nested lookup: /classes/{classSlug}/sections/{sectionSlug}/detail
        // — sections are only meaningful within their class, and the URL
        // now mirrors that. section.id comes back from this endpoint so
        // the students query can still key off the numeric ID.
        const sectionData = await apiRequest(
          `/classes/${classId}/sections/${sectionId}/detail?school_id=${me.school_id}`
        );
        setSection(sectionData);
        const studentsData = await apiRequest(
          `/students/?school_id=${me.school_id}&section_id=${sectionData.id}`
        );
        setStudents(studentsData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [classId, sectionId]);

  if (loading) return (
    <div className="max-w-6xl mx-auto px-6 py-8 animate-pulse space-y-4">
      <div className="h-40 bg-slate-200 rounded-2xl" />
      <div className="grid grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-slate-200 rounded-xl" />)}
      </div>
    </div>
  );

  if (error) return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
    </div>
  );

  const filtered = students.filter((s) =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.admission_number.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <button onClick={() => router.push(`/admin/school/classes/${classId}`)} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-4">
        <ArrowLeft size={12} /> Back to {section.class_name}
      </button>

      {/* Section hero */}
      <div className="bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700 rounded-2xl p-7 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-medium text-white/70 mb-2 uppercase tracking-widest">
              {section.class_name}
            </p>
            <h2 className="text-3xl font-display font-bold text-white mb-1">Section {section.name}</h2>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-sm text-white/90">
                <User size={13} /> {section.class_teacher_name || "No class teacher assigned"}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-white/90">
                <Users size={13} /> {section.total_students} students
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-2xl font-display font-bold text-white leading-none">{section.boys}</p>
              <p className="text-[10px] font-medium text-white/70 uppercase tracking-wide mt-1">Boys</p>
            </div>
            <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-2xl font-display font-bold text-white leading-none">{section.girls}</p>
              <p className="text-[10px] font-medium text-white/70 uppercase tracking-wide mt-1">Girls</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-3 text-slate-400" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or admission number..."
          className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2.5 text-sm"
        />
      </div>

      <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
        <BookOpen size={14} className="text-violet-600" />
        Students {filtered.length > 0 && <span className="text-xs text-slate-500 font-normal">· {filtered.length}</span>}
      </h3>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-sm text-slate-500">
            {students.length === 0 ? "No students in this section yet" : "No students match your search"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((student) => {
            const initial = student.full_name.trim()[0]?.toUpperCase() || "?";
            const genderColor = student.gender === "Male"
              ? { bg: "bg-indigo-50", text: "text-indigo-700" }
              : student.gender === "Female"
              ? { bg: "bg-rose-50", text: "text-rose-700" }
              : { bg: "bg-slate-100", text: "text-slate-600" };

            return (
              <button
                key={student.id}
                onClick={() => router.push(`/admin/students/${student.id}`)}
                className="text-left bg-white border border-slate-200 hover:border-violet-300 hover:shadow-sm rounded-xl p-3.5 transition-all group flex items-center gap-3"
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-display font-bold ${genderColor.bg} ${genderColor.text}`}>
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{student.full_name}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {student.admission_number} · {student.gender || "—"}
                  </p>
                  {student.guardian_phone && (
                    <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1 truncate">
                      <Phone size={9} /> {student.guardian_phone}
                    </p>
                  )}
                </div>
                <ChevronRight size={14} className="text-slate-400 group-hover:text-violet-600 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
