"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Building2, Users, GraduationCap, Wallet, Megaphone,
  FileText, BarChart3, Settings, LogOut, ChevronDown, Lock, UserPlus, Bus,
} from "lucide-react";
import { clearToken, resolveAssetUrl } from "../lib/api";
import { getHomeRouteForRole } from "../lib/roleRouting";

// Each group maps to a real responsibility area, not a database table.
// "roles: null" means visible to everyone; otherwise only the listed
// roles see the group/item at all. "href: null" means the feature is a
// future sprint — shown for context (so the full org chart is visible)
// but disabled rather than a broken link.
const NAV_GROUPS = [
  {
    label: "Dashboard", icon: LayoutDashboard, href: "/admin", roles: null, standalone: true,
  },
  {
    label: "School", icon: Building2,
    roles: ["school_admin", "administrator", "principal", "vice_principal", "super_admin"],
    items: [
      { label: "School Profile", href: "/admin/school/profile" },
      { label: "Academic Sessions", href: "/admin/school/sessions" },
      { label: "Houses", href: "/admin/school/houses" },
      { label: "Campuses", href: null },
      { label: "Calendar", href: null },
      { label: "Holidays", href: null },
    ],
  },
  {
    label: "People", icon: Users, roles: null,
    items: [
      { label: "Students", href: "/admin/students" },
      { label: "Parents", href: "/admin/people/parents", roles: ["admissions_officer", "school_admin", "administrator", "principal", "vice_principal", "super_admin"] },
      { label: "Teachers", href: "/admin/people/teachers" },
      { label: "Staff", href: "/admin/people/staff", roles: ["school_admin", "administrator", "principal", "super_admin"] },
      { label: "Leave Management", href: "/admin/people/leave" },
      { label: "Departments", href: null },
      { label: "Roles & Permissions", href: "/admin/people/roles", roles: ["school_admin", "administrator", "super_admin"] },
    ],
  },
  {
    label: "Academics", icon: GraduationCap,
    roles: ["academic_coordinator", "teacher", "school_admin", "administrator", "principal", "vice_principal", "super_admin"],
    items: [
      { label: "Classes & Timetable", href: "/admin/academics" },
      { label: "Homework", href: "/admin/academics/homework" },
      { label: "Syllabus Tracking", href: "/admin/academics/syllabus" },
      { label: "Attendance", href: "/admin/attendance", roles: ["teacher"] },
      { label: "Attendance", href: "/admin/attendance/overview", roles: ["school_admin", "principal", "vice_principal", "administrator", "super_admin"] },
      { label: "Staff Register", href: "/admin/attendance/staff-report", roles: ["school_admin", "principal", "vice_principal", "administrator", "super_admin"] },
      { label: "Student Register", href: "/admin/attendance/student-register", roles: ["school_admin", "principal", "vice_principal", "administrator", "super_admin"] },
      { label: "Examinations", href: "/admin/academics/examinations" },
      { label: "Promotion", href: null },
    ],
  },
  {
    label: "Admissions", icon: UserPlus, href: "/admin/admissions", standalone: true,
    roles: ["admissions_officer", "school_admin", "administrator", "principal", "super_admin"],
  },
  {
    label: "Finance", icon: Wallet, roles: ["accountant", "school_admin", "super_admin"],
    items: [
      { label: "Fee Management", href: "/admin/finance" },
      { label: "Scholarships", href: null },
      { label: "Discounts", href: null },
      { label: "Reports", href: null },
    ],
  },
  {
    label: "Communication", icon: Megaphone, roles: null,
    items: [
      { label: "Notices & Messaging", href: "/admin/communication" },
      { label: "Parent Complaints", href: "/admin/communication/complaints" },
      { label: "Events", href: null },
    ],
  },
  {
    label: "Transport", icon: Bus, href: "/admin/transport", standalone: true,
    roles: ["school_admin", "principal", "vice_principal", "administrator", "super_admin"],
  },
  {
    label: "Documents & Certificates", icon: FileText, href: "/admin/documents", standalone: true, roles: null,
  },
  {
    label: "Reports & Analytics", icon: BarChart3, href: "/admin/reports",
    roles: ["school_admin", "administrator", "principal", "vice_principal", "super_admin"], standalone: true,
  },
  {
    label: "Settings", icon: Settings, href: "/admin/settings", roles: null, standalone: true,
  },
];

const RESERVED_TOP_LEVEL_PATHS = new Set(["admin", "principal", "teacher", "admissions", "platform", "change-password"]);

/**
 * Strips a leading /{slug} segment from a pathname before comparing it
 * against a bare route like "/admin/students". Needed because it's
 * genuinely ambiguous whether usePathname() reflects the browser's
 * visible slug-prefixed URL or the internally-rewritten bare path after
 * a middleware rewrite — normalizing both sides to the same bare form
 * makes the active-link comparison correct either way, rather than
 * relying on an assumption about Next.js internals that's hard to
 * verify with certainty.
 */
function stripSlugPrefix(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return pathname;
  if (!RESERVED_TOP_LEVEL_PATHS.has(segments[0])) {
    return "/" + segments.slice(1).join("/");
  }
  return pathname;
}

export default function Sidebar({ user }) {
  const rawPathname = usePathname();
  const pathname = stripSlugPrefix(rawPathname);
  const router = useRouter();
  const [openGroups, setOpenGroups] = useState({});

  // Teacher gets properly scoped, mobile-matching pages for these three
  // instead of the shared admin views (which show every class in the
  // school, not just theirs, and aren't the premium redesigned version).
  // Every other role keeps the exact same NAV_GROUPS hrefs unchanged.
  const TEACHER_HREF_OVERRIDES = {
    "/admin/academics/homework": "/teacher/homework",
    "/admin/academics/syllabus": "/teacher/syllabus",
    "/admin/academics/examinations": "/teacher/exams",
  };

  function resolveHref(href) {
    if (user?.role_name === "teacher" && TEACHER_HREF_OVERRIDES[href]) {
      return TEACHER_HREF_OVERRIDES[href];
    }
    return href;
  }

  function handleLogout() {
    clearToken();
    router.push("/");
  }

  function toggleGroup(label) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  function visibleFor(roles) {
    return roles === null || (user && roles.includes(user.role_name));
  }

  const visibleGroups = NAV_GROUPS.filter((g) => visibleFor(g.roles));

  return (
    <aside className="w-64 bg-navy-900 text-white flex flex-col shrink-0 h-screen">
      <div className="px-5 py-6 flex items-center shrink-0">
        {user?.school_logo_url ? (
          <img
            src={resolveAssetUrl(user.school_logo_url)}
            alt={user.school_name || "School logo"}
            className="w-11 h-11 rounded-lg object-contain bg-white shrink-0"
          />
        ) : (
          <div
            className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: user?.school_primary_color || "#6D5BFF" }}
          >
            <LayoutDashboard size={20} className="text-white" />
          </div>
        )}
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1">
        {visibleGroups.map((group) => {
          const Icon = group.icon;

          if (group.standalone) {
            const href = group.label === "Dashboard" ? getHomeRouteForRole(user?.role_name) : group.href;
            const active = pathname === href;
            return (
              <button
                key={group.label}
                onClick={() => router.push(href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? "bg-brand-500 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {group.label}
              </button>
            );
          }

          const items = group.items.filter((it) => visibleFor(it.roles ?? null));
          if (items.length === 0) return null;
          const isOpen = openGroups[group.label] ?? items.some((it) => it.href === pathname);

          return (
            <div key={group.label}>
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <span className="flex items-center gap-3">
                  <Icon size={18} />
                  {group.label}
                </span>
                <ChevronDown size={14} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="ml-9 mt-1 space-y-0.5 border-l border-white/10 pl-3">
                  {items.map((item) => {
                    const resolvedHref = item.href ? resolveHref(item.href) : item.href;
                    const active = pathname === resolvedHref;
                    const disabled = !item.href;
                    return (
                      <button
                        key={item.label}
                        disabled={disabled}
                        onClick={() => resolvedHref && router.push(resolvedHref)}
                        title={disabled ? "Coming in a future sprint" : undefined}
                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                          disabled
                            ? "text-slate-600 cursor-not-allowed"
                            : active
                            ? "bg-white/10 text-white font-medium"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        {item.label}
                        {disabled && <Lock size={11} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10 shrink-0">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          Log out
        </button>
      </div>
    </aside>
  );
}
