"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
 * Teacher and Finance-tier roles (Accountant/Senior Accountant/Finance
 * Manager) get their own bespoke sidebar ALWAYS, based purely on role -
 * they live in that workspace full-time.
 *
 * Every other role (School Admin, Principal, Super Admin) keeps its
 * OWN sidebar at all times, even while viewing a Finance page -
 * clicking "Finance" changes the page content, never the navigation
 * around it. This was deliberately simplified from an earlier
 * path-based version that swapped the whole sidebar the moment any
 * role's URL contained "/finance" - that made School Admin's own
 * navigation disappear just from viewing one page, which wasn't the
 * right experience.
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
  const isFinanceRole = FINANCE_TIER_ROLES.includes(user?.role_name);
  const usesBespokeSidebar = isTeacher || isFinanceRole;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <div className={usesBespokeSidebar ? "hidden md:flex" : "flex"}>
        {isTeacher ? (
          <TeacherSidebar user={user} />
        ) : isFinanceRole ? (
          <FinanceSidebar user={user} rolePrefix="/finance" />
        ) : (
          <Sidebar user={user} />
        )}
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar user={user} />
        <div className={`flex-1 overflow-y-auto ${usesBespokeSidebar ? "pb-16 md:pb-0" : ""}`}>{children}</div>
      </div>
      {usesBespokeSidebar && (
        <div className="md:hidden">
          <MobileBottomNav />
        </div>
      )}
    </div>
  );
}
