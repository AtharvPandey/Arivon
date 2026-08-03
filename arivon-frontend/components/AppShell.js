"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import TeacherSidebar from "./TeacherSidebar";
import FinanceSidebar from "./FinanceSidebar";
import Topbar from "./Topbar";
import MobileBottomNav from "./MobileBottomNav";
import { apiRequest, isLoggedIn } from "../lib/api";

const FINANCE_TIER_ROLES = ["accountant", "senior_accountant", "finance_manager"];

/**
 * Shared shell (Sidebar + Topbar + login check) used by every top-level
 * route group: /admin/*, /teacher/*, /admissions/*, /finance/*, and
 * any future role-specific route tree. Pulled out once so adding a new
 * role's route group never means re-copying this auth/layout logic.
 *
 * Teacher gets a bespoke sidebar always, matching its own route tree.
 *
 * Finance gets a bespoke, grouped sidebar (FinanceSidebar) whenever
 * EITHER of two things is true: the logged-in user is on the Finance
 * tier (Accountant/Senior Accountant/Finance Manager - they live here
 * full-time), OR the current path is inside a Finance workspace
 * (/admin/finance, /principal/finance) - so School Admin/Principal/
 * Super Admin get the same specialized nav the moment they step into
 * Finance as one of the many areas they oversee, and lose it again the
 * moment they navigate elsewhere. This is context-sensitive by path,
 * not just a fixed per-role choice.
 */
export default function AppShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
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
  const isFinanceRole = FINANCE_TIER_ROLES.includes(user?.role_name);
  const isInFinancePath = pathname.includes("/finance");
  const showFinanceSidebar = isFinanceRole || isInFinancePath;
  const financeRolePrefix = isFinanceRole ? "/finance" : pathname.split("/finance")[0] + "/finance";

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <div className={isTeacher ? "hidden md:flex" : "flex"}>
        {isTeacher ? (
          <TeacherSidebar user={user} />
        ) : showFinanceSidebar ? (
          <FinanceSidebar user={user} rolePrefix={financeRolePrefix} />
        ) : (
          <Sidebar user={user} />
        )}
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
