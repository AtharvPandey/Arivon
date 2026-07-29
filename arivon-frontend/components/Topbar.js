"use client";

import { Search, Bell } from "lucide-react";

export default function Topbar({ user }) {
  const accentColor = user?.school_primary_color || "#6D5BFF";

  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm shrink-0">
      <div className="min-w-0">
        {user?.school_name && (
          <p className="font-display font-bold text-slate-900 text-base truncate max-w-xs">
            {user.school_name}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search..."
            disabled
            title="Search coming in a future sprint"
            className="w-40 pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50/60 text-slate-400 cursor-not-allowed placeholder:text-slate-400"
          />
        </div>

        <button className="relative text-slate-500 hover:text-slate-800 hover:bg-slate-50 p-2 rounded-lg transition-colors">
          <Bell size={19} />
        </button>

        {user && (
          <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0"
              style={{ backgroundColor: accentColor }}
            >
              {user.full_name?.charAt(0)}
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-900">{user.full_name}</p>
              <span
                className="inline-block text-[10px] font-medium capitalize px-1.5 py-0.5 rounded-full mt-0.5"
                style={{ backgroundColor: `${accentColor}1A`, color: accentColor }}
              >
                {(user.role_name || "").replace(/_/g, " ")}
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
