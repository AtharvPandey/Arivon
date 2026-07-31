"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, isLoggedIn } from "../../../lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [school, setSchool] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/");
      return;
    }
    (async () => {
      try {
        const me = await apiRequest("/auth/me");
        setUser(me);
        const s = await apiRequest(`/schools/${me.school_id}`);
        setSchool(s);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">Settings</h2>
      <p className="text-sm text-slate-600 mb-6">Your account and school basics.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {user && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Your Account</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-slate-500">Name</p><p className="text-slate-900">{user.full_name}</p></div>
            <div><p className="text-xs text-slate-500">Email</p><p className="text-slate-900">{user.email}</p></div>
            <div><p className="text-xs text-slate-500">Role</p><p className="text-slate-900 capitalize">{user.role_name?.replace(/_/g, " ")}</p></div>
          </div>
        </div>
      )}

      {school && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">School</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-slate-500">Name</p><p className="text-slate-900">{school.name}</p></div>
            <div><p className="text-xs text-slate-500">Board</p><p className="text-slate-900">{school.board_type}</p></div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Editable via <button onClick={() => router.push("/admin/school/profile")} className="text-brand-700 hover:underline">School Profile</button>.
          </p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <p className="text-sm font-semibold text-slate-800 mb-1">Coming soon</p>
        <p className="text-xs text-slate-500">
          Password changes, notification preferences, and branding (logo/color, used for
          white-labeling) will live here once built.
        </p>
      </div>
    </div>
  );
}
