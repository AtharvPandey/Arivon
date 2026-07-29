"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { apiRequest, isLoggedIn } from "../lib/api";

/**
 * Shared shell (Sidebar + Topbar + login check) used by every top-level
 * route group: /dashboard/*, /teacher/*, /admissions/*, and any future
 * role-specific route tree. Pulled out once so adding a new role's
 * route group never means re-copying this auth/layout logic again.
 */
export default function AppShell({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/");
      return;
    }
    apiRequest("/auth/me")
      .then(setUser)
      .catch(() => router.push("/"));
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar user={user} />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
