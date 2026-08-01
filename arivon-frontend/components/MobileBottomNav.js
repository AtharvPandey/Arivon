"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, CalendarClock, Users2, ClipboardList, MoreHorizontal } from "lucide-react";

const RESERVED_TOP_LEVEL_PATHS = new Set(["admin", "principal", "teacher", "admissions", "platform", "change-password"]);

function stripSlugPrefix(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return pathname;
  if (!RESERVED_TOP_LEVEL_PATHS.has(segments[0])) {
    return "/" + segments.slice(1).join("/");
  }
  return pathname;
}

const TABS = [
  { key: "home", label: "Home", icon: Home, href: "/teacher/dashboard" },
  { key: "schedule", label: "Schedule", icon: CalendarClock, href: "/teacher/schedule" },
  { key: "classes", label: "Classes", icon: Users2, href: "/teacher/classes" },
  { key: "homework", label: "Homework", icon: ClipboardList, href: "/admin/academics/homework" },
  { key: "more", label: "More", icon: MoreHorizontal, href: "/teacher/more" },
];

/**
 * Bottom tab bar, mobile only (parent applies md:hidden). Five
 * destinations is the practical ceiling for this pattern — everything
 * a teacher doesn't reach for multiple times a day (Syllabus, Exams,
 * Leave, Settings) lives one tap further, under "More".
 */
export default function MobileBottomNav() {
  const rawPathname = usePathname();
  const pathname = stripSlugPrefix(rawPathname);
  const router = useRouter();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {TABS.map((tab) => {
          const active = pathname === tab.href || (tab.key === "home" && pathname === "/teacher/dashboard");
          return (
            <button
              key={tab.key}
              onClick={() => router.push(tab.href)}
              className={`flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${
                active ? "text-brand-600" : "text-slate-400"
              }`}
            >
              <tab.icon size={20} strokeWidth={active ? 2.5 : 2} />
              <span className={`text-[10px] ${active ? "font-semibold" : "font-medium"}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
