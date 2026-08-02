"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Check } from "lucide-react";
import { apiRequest, isLoggedIn } from "../lib/api";

export default function SettingsView({ schoolProfileHref = "/admin/school/profile" }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [school, setSchool] = useState(null);
  const [error, setError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

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

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwError(""); setPwSuccess(false);
    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New password and confirmation don't match.");
      return;
    }
    setChangingPw(true);
    try {
      await apiRequest("/auth/change-password", {
        method: "POST",
        body: { current_password: currentPassword, new_password: newPassword },
      });
      setPwSuccess(true);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err) {
      setPwError(err.message);
    } finally {
      setChangingPw(false);
    }
  }

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
            Editable via <button onClick={() => router.push(schoolProfileHref)} className="text-brand-700 hover:underline">School Profile</button>.
          </p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound size={15} className="text-brand-600" />
          <p className="text-sm font-semibold text-slate-800">Change Password</p>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Update your own password at any time — this isn't just for temporary passwords.
        </p>

        <form onSubmit={handleChangePassword} className="space-y-3 max-w-sm">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (at least 8 characters)"
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />

          {pwError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{pwError}</p>
          )}
          {pwSuccess && (
            <p className="text-xs text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <Check size={13} /> Password updated successfully.
            </p>
          )}

          <button
            type="submit"
            disabled={changingPw}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            {changingPw ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 mt-4">
        <p className="text-sm font-semibold text-slate-800 mb-1">Coming soon</p>
        <p className="text-xs text-slate-500">
          Notification preferences and branding (logo/color, used for white-labeling) will live here once built.
        </p>
      </div>
    </div>
  );
}
