"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users, GraduationCap, Wallet, ClipboardList, Briefcase, FileSpreadsheet,
  Download, ArrowRight, ChevronDown, ChevronUp, Building2,
} from "lucide-react";
import { apiRequest, isLoggedIn, downloadAuthenticatedFile } from "../lib/api";

function ReportCard({ icon: Icon, color, title, description, children, action }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button onClick={() => (children ? setExpanded(!expanded) : action?.())} className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color.bg}`}>
          <Icon size={18} className={color.text} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
        {children ? (
          expanded ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />
        ) : (
          <ArrowRight size={16} className="text-slate-400 shrink-0" />
        )}
      </button>
      {children && expanded && <div className="border-t border-slate-100 p-4">{children}</div>}
    </div>
  );
}

function SectionHeading({ children }) {
  return <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 mt-6 first:mt-0">{children}</h3>;
}

export default function ReportsHubView({ rolePrefix = "/admin" }) {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState(null);
  const [error, setError] = useState("");
  const [strength, setStrength] = useState(null);
  const [staffList, setStaffList] = useState(null);
  const [demographics, setDemographics] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    apiRequest("/auth/me").then((me) => setSchoolId(me.school_id)).catch((err) => setError(err.message));
  }, []);

  async function loadStrength() {
    if (strength) return;
    try { setStrength(await apiRequest(`/reports/student-strength?school_id=${schoolId}`)); } catch (err) { setError(err.message); }
  }
  async function loadStaffList() {
    if (staffList) return;
    try { setStaffList(await apiRequest(`/reports/staff-list?school_id=${schoolId}`)); } catch (err) { setError(err.message); }
  }
  async function loadDemographics() {
    if (demographics) return;
    try { setDemographics(await apiRequest(`/reports/demographics?school_id=${schoolId}`)); } catch (err) { setError(err.message); }
  }

  if (!schoolId) return <div className="max-w-4xl mx-auto px-6 py-8 text-sm text-slate-600">Loading...</div>;

  const strengthTotals = strength ? {
    total: strength.reduce((s, r) => s + r.total, 0), boys: strength.reduce((s, r) => s + r.boys, 0),
    girls: strength.reduce((s, r) => s + r.girls, 0),
  } : null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">Reports & Analytics</h2>
      <p className="text-sm text-slate-600 mb-6">The reports you'd otherwise be maintaining in Excel — student strength, attendance, fees, exams, staff, and government filing.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <SectionHeading>Student Reports</SectionHeading>
      <div className="space-y-2">
        <ReportCard
          icon={Users} color={{ bg: "bg-indigo-50", text: "text-indigo-700" }}
          title="Student Strength Report" description="Class-wise, section-wise, gender-wise, and category-wise headcount"
          action={loadStrength}
        >
          {!strength ? <button onClick={loadStrength} className="text-xs text-brand-700 underline">Load report</button> : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-500">Total: <b className="text-slate-800">{strengthTotals.total}</b> · Boys: <b className="text-slate-800">{strengthTotals.boys}</b> · Girls: <b className="text-slate-800">{strengthTotals.girls}</b></p>
                <button onClick={() => downloadAuthenticatedFile(`/reports/student-strength/export?school_id=${schoolId}`, "student_strength_report.csv")} className="text-xs font-medium text-brand-700 flex items-center gap-1"><Download size={12} /> Export CSV</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-slate-400 border-b border-slate-100"><th className="py-1.5 pr-3">Class</th><th className="pr-3">Section</th><th className="pr-3">Total</th><th className="pr-3">Boys</th><th className="pr-3">Girls</th><th>General/OBC/SC/ST/EWS</th></tr></thead>
                  <tbody>
                    {strength.map((r, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        <td className="py-1.5 pr-3 text-slate-800">{r.class_name}</td>
                        <td className="pr-3 text-slate-600">{r.section_name}</td>
                        <td className="pr-3 font-medium text-slate-800">{r.total}</td>
                        <td className="pr-3 text-slate-600">{r.boys}</td>
                        <td className="pr-3 text-slate-600">{r.girls}</td>
                        <td className="text-slate-500">{r.general}/{r.obc}/{r.sc}/{r.st}/{r.ews}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </ReportCard>

        <ReportCard
          icon={Building2} color={{ bg: "bg-violet-50", text: "text-violet-700" }}
          title="Student Demographic Summary" description="Gender, category, religion, nationality, and mother tongue — for government/board reporting"
          action={loadDemographics}
        >
          {!demographics ? <button onClick={loadDemographics} className="text-xs text-brand-700 underline">Load report</button> : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: "Gender", data: demographics.by_gender },
                { label: "Category", data: demographics.by_category },
                { label: "Religion", data: demographics.by_religion },
                { label: "Nationality", data: demographics.by_nationality },
                { label: "Mother Tongue", data: demographics.by_mother_tongue },
              ].map((group) => (
                <div key={group.label}>
                  <p className="text-xs font-semibold text-slate-600 mb-1">{group.label}</p>
                  {group.data.map((entry) => (
                    <div key={entry.label} className="flex justify-between text-xs text-slate-500">
                      <span>{entry.label}</span><span className="font-medium text-slate-700">{entry.count}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </ReportCard>

        <ReportCard
          icon={ClipboardList} color={{ bg: "bg-teal-50", text: "text-teal-700" }}
          title="Student Promotion List" description="Pass/fail/grace-zone status by exam — open an exam to view"
          action={() => router.push(`${rolePrefix}/academics/examinations`)}
        />
      </div>

      <SectionHeading>Attendance</SectionHeading>
      <div className="space-y-2">
        <ReportCard
          icon={Users} color={{ bg: "bg-amber-50", text: "text-amber-700" }}
          title="Student Attendance Register" description="Monthly register per section, exportable to CSV"
          action={() => router.push(`${rolePrefix}/attendance/student-register`)}
        />
        <ReportCard
          icon={Briefcase} color={{ bg: "bg-amber-50", text: "text-amber-700" }}
          title="Staff Attendance Register" description="Monthly attendance summary for every staff member"
          action={() => router.push(`${rolePrefix}/attendance/staff-report`)}
        />
      </div>

      <SectionHeading>Finance</SectionHeading>
      <div className="space-y-2">
        <ReportCard
          icon={Wallet} color={{ bg: "bg-rose-50", text: "text-rose-700" }}
          title="Fee Defaulter List & Collection Summary" description="Daily, monthly, yearly collection — and who owes what"
          action={() => router.push(`${rolePrefix}/finance`)}
        />
      </div>

      <SectionHeading>Academics</SectionHeading>
      <div className="space-y-2">
        <ReportCard
          icon={GraduationCap} color={{ bg: "bg-sky-50", text: "text-sky-700" }}
          title="Exam Result Analysis" description="Class-wise and subject-wise pass percentage per exam"
          action={() => router.push(`${rolePrefix}/academics/examinations`)}
        />
      </div>

      <SectionHeading>Staff</SectionHeading>
      <div className="space-y-2">
        <ReportCard
          icon={Briefcase} color={{ bg: "bg-slate-100", text: "text-slate-700" }}
          title="Staff List with Qualifications" description="Every staff member's designation, qualification, and experience"
          action={loadStaffList}
        >
          {!staffList ? <button onClick={loadStaffList} className="text-xs text-brand-700 underline">Load report</button> : (
            <div>
              <div className="flex justify-end mb-2">
                <button onClick={() => downloadAuthenticatedFile(`/reports/staff-list/export?school_id=${schoolId}`, "staff_list_report.csv")} className="text-xs font-medium text-brand-700 flex items-center gap-1"><Download size={12} /> Export CSV</button>
              </div>
              <div className="divide-y divide-slate-100">
                {staffList.map((s) => (
                  <div key={s.id} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-medium text-slate-800">{s.full_name}</p>
                      <p className="text-slate-500">{(s.role_name || "").replace(/_/g, " ")} {s.designation && `· ${s.designation}`}</p>
                    </div>
                    <span className="text-slate-500">{s.qualification || "—"} {s.experience_years != null && `· ${s.experience_years}yrs`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ReportCard>
      </div>

      <SectionHeading>Government Reporting</SectionHeading>
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"><FileSpreadsheet size={18} /></div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">UDISE+ Data Export</p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              School profile, class-wise enrollment by gender and category, and teaching staff by qualification — the standard data points UDISE+ asks for every year, ready to copy into the government portal instead of counting by hand.
              Always cross-check field labels against the current year's official UDISE+ form before final submission.
            </p>
            <button
              onClick={() => downloadAuthenticatedFile(`/reports/udise-export?school_id=${schoolId}`, "udise_export.csv")}
              className="mt-3 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2 flex items-center gap-1.5"
            >
              <Download size={13} /> Download UDISE+ Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
