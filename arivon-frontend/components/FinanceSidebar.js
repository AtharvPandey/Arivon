"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Wallet, Tag, Percent, Receipt, Banknote, RotateCcw,
  ShieldCheck, BarChart3, Settings, IndianRupee, ChevronDown, LogOut, GraduationCap,
} from "lucide-react";
import { clearToken, resolveAssetUrl } from "../lib/api";

const RESERVED_TOP_LEVEL_PATHS = new Set(["admin", "principal", "teacher", "admissions", "finance", "platform", "change-password"]);

function stripSlugPrefix(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return pathname;
  if (!RESERVED_TOP_LEVEL_PATHS.has(segments[0])) {
    return "/" + segments.slice(1).join("/");
  }
  return pathname;
}

// Each group is a real business function (Fee Management, Billing,
// Approvals) rather than every page sitting in one flat list -
// grouped-by-function scales better as Finance grows, and matches how
// an accountant actually thinks about their own work.
function buildNavGroups(rolePrefix) {
  return [
    { label: "Dashboard", icon: LayoutDashboard, href: `${rolePrefix}/dashboard`, standalone: true },
    {
      label: "Fee Management", icon: Wallet,
      items: [
        { label: "Fee Structures", icon: Wallet, href: `${rolePrefix}?tab=structures` },
        { label: "Fee Categories", icon: Tag, href: `${rolePrefix}?tab=categories` },
        { label: "Discounts & Scholarships", icon: Percent, href: `${rolePrefix}?tab=concessions` },
      ],
    },
    {
      label: "Billing", icon: Receipt,
      items: [
        { label: "Student Billing", icon: Receipt, href: `${rolePrefix}?tab=billing` },
        { label: "Collections", icon: Banknote, href: `${rolePrefix}?tab=billing` },
        { label: "Refunds", icon: RotateCcw, href: `${rolePrefix}?tab=refunds` },
      ],
    },
    {
      label: "Approvals", icon: ShieldCheck,
      items: [
        { label: "Waivers", icon: ShieldCheck, href: `${rolePrefix}?tab=waivers` },
      ],
    },
    { label: "Reports", icon: BarChart3, href: `${rolePrefix}?tab=reports`, standalone: true },
    { label: "Settings", icon: Settings, href: `${rolePrefix}?tab=settings`, standalone: true },
  ];
}

/**
 * A genuinely bespoke Finance workspace nav, matching the pattern
 * established for Teacher — Accountant/Senior Accountant/Finance
 * Manager spend their entire day here, so a flat admin-style
 * accordion isn't the right shape. Grouped by business function
 * (Fee Management, Billing, Approvals) per the confirmed design.
 *
 * rolePrefix lets the same component serve both /finance/* (the
 * Accountant-tier's own workspace) and /admin/finance (when School
 * Admin/Principal/Super Admin step into Finance as one of many areas
 * they oversee) without duplicating this file.
 */
export default function FinanceSidebar({ user, rolePrefix = "/finance" }) {
  const rawPathname = usePathname();
  const pathname = stripSlugPrefix(rawPathname);
  const router = useRouter();
  const [openGroups, setOpenGroups] = useState({ "Fee Management": true, "Billing": true, "Approvals": true });

  const navGroups = buildNavGroups(rolePrefix);

  function toggleGroup(label) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

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
            style={{ backgroundColor: user?.school_primary_color || "#0D9488" }}
          >
            <IndianRupee size={18} className="text-white" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-400">Finance</p>
          <p className="text-sm font-semibold text-white truncate">{user?.school_name || "Arivon"}</p>
        </div>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-1">
        {navGroups.map((group) => {
          if (group.standalone) {
            const active = pathname === group.href.split("?")[0] && rawPathname.includes(group.href.split("?")[1] || "___none___");
            const isPlain = pathname === group.href;
            return (
              <button
                key={group.label}
                onClick={() => router.push(group.href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isPlain ? "bg-teal-600 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <group.icon size={18} />
                {group.label}
              </button>
            );
          }

          const isOpen = openGroups[group.label];
          return (
            <div key={group.label}>
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <span className="flex items-center gap-3"><group.icon size={18} />{group.label}</span>
                <ChevronDown size={14} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="ml-4 mt-1 space-y-0.5 border-l border-white/5 pl-3">
                  {group.items.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => router.push(item.href)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-colors text-left"
                    >
                      <item.icon size={14} />
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Payroll — visually separated, different audience (staff, not parents) and different urgency from student-fee collection above */}
      <div className="px-3 py-4 border-t border-white/5 space-y-1 shrink-0">
        <button
          onClick={() => router.push(`${rolePrefix}?tab=salary`)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
        >
          <GraduationCap size={18} />
          Payroll
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
