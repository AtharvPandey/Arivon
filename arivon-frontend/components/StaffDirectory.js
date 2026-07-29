"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, isLoggedIn } from "../lib/api";

/**
 * One shared list view for both "Teachers" and "Staff" nav items — same
 * underlying data (GET /staff/), just a different role_name filter.
 * Avoids building near-identical pages twice.
 */
export default function StaffDirectory({ roleFilter, title, subtitle }) {
  const router = useRouter();
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/");
      return;
    }
    (async () => {
      try {
        const me = await apiRequest("/auth/me");
        const query = roleFilter ? `&role_name=${roleFilter}` : "";
        const data = await apiRequest(`/staff/?school_id=${me.school_id}${query}`);
        setStaff(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [roleFilter]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">{title}</h2>
      <p className="text-sm text-slate-600 mb-6">{subtitle}</p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-600">Loading...</p>
      ) : staff.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-sm text-slate-600">No one here yet — added via Register in the API docs for now.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left">
                <th className="px-4 py-3 font-medium text-slate-600">Name</th>
                <th className="px-4 py-3 font-medium text-slate-600">Role</th>
                <th className="px-4 py-3 font-medium text-slate-600">Department</th>
                <th className="px-4 py-3 font-medium text-slate-600">Designation</th>
                <th className="px-4 py-3 font-medium text-slate-600">Employee ID</th>
                <th className="px-4 py-3 font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => router.push(`/dashboard/people/staff/${s.id}`)}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-slate-900 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold overflow-hidden shrink-0">
                      {s.photo_url ? (
                        <img src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${s.photo_url}`} alt={s.full_name} className="w-full h-full object-cover" />
                      ) : (
                        s.full_name.charAt(0)
                      )}
                    </div>
                    {s.full_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 capitalize">{s.role_name?.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-slate-600">{s.department || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{s.designation || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{s.employee_id || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.is_active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-600"}`}>
                      {s.is_active ? "Active" : "Inactive"}
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
