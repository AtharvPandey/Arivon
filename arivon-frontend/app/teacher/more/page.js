"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookMarked, FileCheck2, CalendarDays, Megaphone, Settings, LogOut, ChevronRight, Building2 } from "lucide-react";
import { apiRequest, isLoggedIn, clearToken } from "../../../lib/api";

const ITEMS = [
  { label: "Syllabus Tracking", icon: BookMarked, href: "/teacher/syllabus", description: "Track chapter-wise completion" },
  { label: "Examinations", icon: FileCheck2, href: "/teacher/exams", description: "Enter marks, view schedules" },
  { label: "Leave", icon: CalendarDays, href: "/teacher/leave", description: "Apply for leave, check balance" },
  { label: "Notices & Messages", icon: Megaphone, href: "/teacher/notices", description: "School notices and parent messages" },
  { label: "Settings", icon: Settings, href: "/teacher/settings", description: "Your account, change password" },
];

const SCHOOL_ITEMS = [
  { label: "School Profile", href: "/teacher/school/profile" },
  { label: "Academic Sessions", href: "/teacher/school/sessions" },
  { label: "Houses", href: "/teacher/school/houses" },
  { label: "Campus", href: "/teacher/school/campus" },
  { label: "Calendar", href: "/teacher/school/calendar" },
  { label: "Holidays", href: "/teacher/school/holidays" },
];

export default function TeacherMorePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    apiRequest("/auth/me").then(setUser).catch(() => router.push("/"));
  }, []);

  function handleLogout() {
    clearToken();
    router.push("/");
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {user && (
        <div className="flex items-center gap-3 mb-6 px-1">
          <div className="w-11 h-11 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold text-sm shrink-0">
            {user.full_name?.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{user.full_name}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 mb-4">
        {ITEMS.map((item) => (
          <button
            key={item.label}
            onClick={() => router.push(item.href)}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <item.icon size={16} className="text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900">{item.label}</p>
              <p className="text-xs text-slate-500 truncate">{item.description}</p>
            </div>
            <ChevronRight size={16} className="text-slate-300 shrink-0" />
          </button>
        ))}
      </div>

      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 rounded-xl py-3 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
      >
        <LogOut size={15} /> Log out
      </button>
    </div>
  );
}
