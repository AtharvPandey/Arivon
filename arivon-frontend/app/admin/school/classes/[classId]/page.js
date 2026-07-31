"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Users, Layers, UserCheck, ChevronRight, Calendar,
  GraduationCap, User, BookOpen,
} from "lucide-react";
import { apiRequest, isLoggedIn } from "../../../../../lib/api";

function KpiTile({ icon: Icon, label, value, iconBg, iconColor }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 ${iconBg}`}>
        <Icon size={16} className={iconColor} />
      </div>
      <p className="text-2xl font-display font-bold text-slate-900 leading-none mb-1">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

export default function ClassDetailPage() {
  const router = useRouter();
  const { classId } = useParams();
  const [classData, setClassData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    (async () => {
      try {
        // Need school_id to resolve the slug (e.g. "nursery") since
        // slugs are only unique within one school's current academic year.
        const me = await apiRequest("/auth/me");
        setClassData(await apiRequest(`/classes/${classId}/detail?school_id=${me.school_id}`));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [classId]);

  if (loading) return (
    <div className="max-w-6xl mx-auto px-6 py-8 animate-pulse space-y-4">
      <div className="h-40 bg-slate-200 rounded-2xl" />
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-200 rounded-xl" />)}
      </div>
    </div>
  );

  if (error) return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
    </div>
  );

  const boysPct = classData.total_students > 0 ? (classData.boys / classData.total_students) * 100 : 0;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <button onClick={() => router.push("/principal/dashboard")} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-4">
        <ArrowLeft size={12} /> Back to Dashboard
      </button>

      {/* Class hero */}
      <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 rounded-2xl p-7 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-medium text-white/70 mb-2 uppercase tracking-wide flex items-center gap-1.5">
              <GraduationCap size={12} /> {classData.stage?.replace(/_/g, " ") || "Class Overview"}
            </p>
            <h2 className="text-3xl font-display font-bold text-white mb-1">{classData.name}</h2>
            <p className="text-sm text-white/80">
              {classData.total_students} students · {classData.total_sections} {classData.total_sections === 1 ? "section" : "sections"}
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-display font-bold text-white leading-none">{classData.total_students}</div>
            <p className="text-xs text-white/70 mt-1">Total strength</p>
          </div>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiTile icon={Users} label="Total Students" value={classData.total_students} iconBg="bg-violet-50" iconColor="text-violet-700" />
        <KpiTile icon={Layers} label="Sections" value={classData.total_sections} iconBg="bg-indigo-50" iconColor="text-indigo-700" />
        <KpiTile icon={UserCheck} label="Boys" value={classData.boys} iconBg="bg-sky-50" iconColor="text-sky-700" />
        <KpiTile icon={UserCheck} label="Girls" value={classData.girls} iconBg="bg-rose-50" iconColor="text-rose-700" />
      </div>

      {/* Gender split — a single elegant bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-xs font-semibold text-slate-600">Gender Balance</p>
          <p className="text-[11px] text-slate-400">{Math.round(boysPct)}% boys · {Math.round(100 - boysPct)}% girls</p>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-rose-100">
          <div className="bg-indigo-500 rounded-l-full" style={{ width: `${boysPct}%` }} />
        </div>
      </div>

      {/* Sections grid */}
      <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5">
        <Layers size={14} className="text-violet-600" /> Sections
      </h3>
      {classData.sections.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-sm text-slate-500">No sections yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classData.sections.map((section) => {
            const secBoysPct = section.total_students > 0 ? (section.boys / section.total_students) * 100 : 0;
            const capacityPct = section.capacity > 0 ? Math.min(100, (section.total_students / section.capacity) * 100) : 0;

            return (
              <button
                key={section.id}
                onClick={() => router.push(`/admin/school/classes/${classId}/${section.section_slug || section.id}`)}
                className="text-left bg-white border border-slate-200 hover:border-violet-300 hover:shadow-md rounded-2xl overflow-hidden transition-all group"
              >
                {/* Colored section header — makes A/B/C feel like distinct cards */}
                <div className="relative h-16 bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center px-5">
                  <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "radial-gradient(circle at 30% 50%, white 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
                  <div className="relative">
                    <p className="text-[10px] font-medium text-white/70 uppercase tracking-widest">Section</p>
                    <p className="text-2xl font-display font-bold text-white leading-none mt-0.5">{section.name}</p>
                  </div>
                  <div className="ml-auto relative text-right">
                    <p className="text-2xl font-display font-bold text-white leading-none">{section.total_students}</p>
                    <p className="text-[10px] font-medium text-white/70 uppercase tracking-widest mt-0.5">Students</p>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {/* Class teacher — the answer to "who runs this section?" */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                      <User size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Class Teacher</p>
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {section.class_teacher_name || <span className="text-slate-400 italic">Not assigned</span>}
                      </p>
                    </div>
                  </div>

                  {/* Gender split */}
                  <div>
                    <div className="flex items-baseline justify-between text-[11px] mb-1">
                      <span className="text-indigo-700 font-medium">{section.boys} boys</span>
                      <span className="text-rose-500 font-medium">{section.girls} girls</span>
                    </div>
                    <div className="flex h-1.5 rounded-full overflow-hidden bg-rose-100">
                      <div className="bg-indigo-500" style={{ width: `${secBoysPct}%` }} />
                    </div>
                  </div>

                  {/* Capacity — teachers/principals actually care if a section is overflowing */}
                  <div>
                    <div className="flex items-baseline justify-between text-[11px] mb-1">
                      <span className="text-slate-500">Capacity</span>
                      <span className="text-slate-700 font-medium">{section.total_students} / {section.capacity}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${capacityPct >= 90 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${capacityPct}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span className="text-xs text-slate-500 flex items-center gap-1.5">
                      <BookOpen size={11} /> View students
                    </span>
                    <ChevronRight size={13} className="text-slate-400 group-hover:text-violet-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
