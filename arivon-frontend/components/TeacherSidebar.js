"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, CalendarClock, Users2, ClipboardList, BookMarked,
  FileCheck2, Settings, LogOut, GraduationCap,
} from "lucide-react";
import { clearToken, resolveAssetUrl } from "../lib/api";

const RESERVED_TOP_LEVEL_PATHS = new Set(["admin", "principal", "teacher", "admissions", "platform", "change-password"]);

function stripSlugPrefix(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return pathname;
  if (!RESERVED_TOP_LEVEL_PATHS.has(segments[0])) {
    return "/" + segments.slice(1).join("/");
  }
  return pathname;
}

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/teacher/dashboard" },
  { label: "Schedule", icon: CalendarClock, href: "/teacher/schedule" },
  { label: "My Classes", icon: Users2, href: "/teacher/classes" },
  { label: "Homework", icon: ClipboardList, href: "/teacher/homework" },
  { label: "Syllabus", icon: BookMarked, href: "/teacher/syllabus" },
  { label: "Examinations", icon: FileCheck2, href: "/teacher/exams" },
];

/**
 * A genuinely bespoke desktop nav for Teacher — not a reuse of the
 * admin Sidebar's accordion-heavy layout, which was built for a dozen-
 * plus destinations across many roles. Teacher has exactly 6 primary
 * destinations plus 2 utility items, so a flat list reads cleaner and
 * scans faster than groups that would each only ever contain one item.
 * Settings and Logout sit at the bottom as utility items, separate
 * from primary navigation, matching standard sidebar UX practice.
 */
export default function TeacherSidebar({ user }) {
  const rawPathname = usePathname();
  const pathname = stripSlugPrefix(rawPathname);
  const router = useRouter();

  function handleLogout() {
    clearToken();
    router.push("/");
  }

  return (
    <aside className="w-64 bg-navy-900 text-white flex flex-col shrink-0 h-screen">
      <div className="px-5 py-6 flex items-center gap-3 shrink-0 border-b border-white/5">
        {user?.school_logo_url ? (
          <img
            src={resolveAssetUrl(user.school_logo_url)}
            alt={user.school_name || "School logo"}
            className="w-10 h-10 rounded-lg object-contain bg-white shrink-0"
          />
        ) : (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: user?.school_primary_color || "#6D5BFF" }}
          >
            <GraduationCap size={18} className="text-white" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-400">Teacher Portal</p>
          <p className="text-sm font-semibold text-white truncate">{user?.school_name || "Arivon"}</p>
        </div>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <button
              key={item.label}
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active ? "bg-brand-500 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/5 space-y-1 shrink-0">
        <button
          onClick={() => router.push("/teacher/settings")}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            pathname === "/teacher/settings" ? "bg-brand-500 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
          }`}
        >
          <Settings size={18} />
          Settings
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          Log out
        </button>
      </div>
    </aside>
  );
}
