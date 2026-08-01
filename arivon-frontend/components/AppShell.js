"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import TeacherSidebar from "./TeacherSidebar";
import Topbar from "./Topbar";
import MobileBottomNav from "./MobileBottomNav";
import { apiRequest, isLoggedIn } from "../lib/api";

/**
 * Shared shell (Sidebar + Topbar + login check) used by every top-level
 * route group: /admin/*, /teacher/*, /admissions/*, and any future
 * role-specific route tree. Pulled out once so adding a new role's
 * route group never means re-copying this auth/layout logic again.
 *
 * Teacher gets two additions, both scoped specifically to
 * role_name === "teacher" so every other role's behavior is completely
 * unchanged:
 *   - Desktop: a bespoke flat-list sidebar (TeacherSidebar) instead of
 *     the admin Sidebar's accordion groups, since Teacher only has 6
 *     primary destinations rather than a dozen-plus.
 *   - Mobile: a 5-tab bottom bar instead of any sidebar at all — the
 *     standard mobile pattern for a small, focused destination set.
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
      .then((data) => {
        if (data.must_change_password) {
          router.push("/change-password");
          return;
        }
        setUser(data);
      })
      .catch(() => router.push("/"));
  }, []);

  const isTeacher = user?.role_name === "teacher";

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <div className={isTeacher ? "hidden md:flex" : "flex"}>
        {isTeacher ? <TeacherSidebar user={user} /> : <Sidebar user={user} />}
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar user={user} />
        <div className={`flex-1 overflow-y-auto ${isTeacher ? "pb-16 md:pb-0" : ""}`}>{children}</div>
      </div>
      {isTeacher && (
        <div className="md:hidden">
          <MobileBottomNav />
        </div>
      )}
    </div>
  );
}
