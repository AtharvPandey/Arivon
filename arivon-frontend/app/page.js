"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Building2 } from "lucide-react";
import { apiRequest, saveToken, resolveAssetUrl } from "../lib/api";
import { getHomeRouteForRole } from "../lib/roleRouting";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Same reserved list the middleware uses — kept in sync so the login
// page and the middleware agree on what counts as a school slug vs a
// real app route.
const RESERVED_TOP_LEVEL_PATHS = new Set(["dashboard", "principal", "teacher", "admissions", "platform"]);

function extractSlugFromPath(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  const first = segments[0];
  return RESERVED_TOP_LEVEL_PATHS.has(first) ? null : first;
}

export default function LoginPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [accessRevoked, setAccessRevoked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [school, setSchool] = useState(null);
  const [schoolLoadFailed, setSchoolLoadFailed] = useState(false);

  // usePathname() reflects the ORIGINAL URL the browser requested
  // (e.g. /green-valley/login), not the internally-rewritten target —
  // that's exactly what lets this page know which school's login this
  // is, even though middleware.js has already routed it here.
  const slug = extractSlugFromPath(pathname);

  useEffect(() => {
    if (!slug) return;
    apiRequest(`/schools/by-slug/${slug}`)
      .then(setSchool)
      .catch(() => setSchoolLoadFailed(true));
  }, [slug]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setAccessRevoked(false);
    setLoading(true);
    try {
      // /auth/login expects form-encoded fields named "username" and "password"
      // (an OAuth2 convention FastAPI follows) — "username" here is the email.
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: { username: email, password },
        formEncoded: true,
      });
      saveToken(data.access_token);
      const me = await apiRequest("/auth/me");
      router.push(getHomeRouteForRole(me.role_name, slug));
    } catch (err) {
      // The backend prefixes this one specific error so the frontend can
      // tell "wrong password" apart from "this account was deliberately
      // revoked" — the second one deserves a much clearer, calmer
      // explanation than a generic red error line.
      if (err.message.startsWith("ACCOUNT_DEACTIVATED:")) {
        setAccessRevoked(true);
        setError(err.message.replace("ACCOUNT_DEACTIVATED:", "").trim());
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          {school ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mx-auto mb-3 overflow-hidden">
                {school.logo_url ? (
                  <img src={resolveAssetUrl(school.logo_url)} alt={school.name} className="w-full h-full object-cover" />
                ) : (
                  <Building2 size={26} className="text-indigo-300" />
                )}
              </div>
              <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">{school.name}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {[school.board_type, school.city].filter(Boolean).join(" · ")}
              </p>
            </>
          ) : slug && !schoolLoadFailed ? (
            <div className="h-24 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-slate-200 border-t-brand-500 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl bg-brand-500 flex items-center justify-center mx-auto mb-3">
                <span className="text-white font-display font-bold text-xl">A</span>
              </div>
              <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight">Arivon</h1>
              <p className="mt-1 text-sm text-slate-600">School Operating System</p>
            </>
          )}
        </div>

        {slug && schoolLoadFailed && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
            Couldn't find a school at this URL. Double-check the link, or sign in below if you know your credentials.
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent"
              placeholder="you@school.edu"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && accessRevoked && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 flex items-start gap-2.5">
              <svg className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-rose-800">Access Denied</p>
                <p className="text-xs text-rose-700 mt-0.5">{error}</p>
              </div>
            </div>
          )}
          {error && !accessRevoked && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-3 py-2.5 transition-colors"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-600">
          Use the email and password you registered via <code>/auth/register</code>.
        </p>
      </div>
    </main>
  );
}
