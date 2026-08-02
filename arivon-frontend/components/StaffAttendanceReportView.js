"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ArrowLeft } from "lucide-react";
import { apiRequest, isLoggedIn } from "../lib/api";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function StaffAttendanceReportView({ backHref = "/admin" }) {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState(null);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/");
      return;
    }
    (async () => {
      const me = await apiRequest("/auth/me");
      setSchoolId(me.school_id);
    })();
  }, []);

  useEffect(() => {
    if (schoolId) load();
  }, [schoolId, year, month]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest(`/staff-attendance/monthly-report?school_id=${schoolId}&year=${year}&month=${month}`);
      setReport(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    const token = sessionStorage.getItem("arivon_token");
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const response = await fetch(`${API_URL}/staff-attendance/export?school_id=${schoolId}&year=${year}&month=${month}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `staff_attendance_${year}_${String(month).padStart(2, "0")}.csv`;
    a.click();
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <button onClick={() => router.push(backHref)} className="text-sm text-slate-600 hover:text-slate-900 mb-4 flex items-center gap-1">
        <ArrowLeft size={14} /> Back to Dashboard
      </button>

      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-display font-bold text-slate-900">Staff Attendance Register</h2>
        <button onClick={handleExport} className="border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-medium rounded-lg px-4 py-2 flex items-center gap-1.5">
          <Download size={14} /> Export CSV
        </button>
      </div>
      <p className="text-sm text-slate-600 mb-6">Monthly attendance summary for every staff member.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="flex items-center gap-3 mb-5">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-slate-600">Loading...</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left">
                <th className="px-4 py-3 font-medium text-slate-600">Name</th>
                <th className="px-4 py-3 font-medium text-slate-600">Role</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-center">Present</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-center">Absent</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-center">Late</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-center">Half Day</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-center">Not Marked</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-center">Attendance %</th>
              </tr>
            </thead>
            <tbody>
              {report.map((r) => (
                <tr key={r.user_id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.full_name}</td>
                  <td className="px-4 py-3 text-slate-600 capitalize">{r.role_name.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-center text-slate-700">{r.present_days}</td>
                  <td className="px-4 py-3 text-center text-slate-700">{r.absent_days}</td>
                  <td className="px-4 py-3 text-center text-slate-700">{r.late_days}</td>
                  <td className="px-4 py-3 text-center text-slate-700">{r.half_days}</td>
                  <td className="px-4 py-3 text-center text-slate-400">{r.not_marked_days}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.attendance_pct >= 90 ? "bg-brand-100 text-brand-700" : r.attendance_pct >= 75 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                      {r.attendance_pct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
