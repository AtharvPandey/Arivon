"use client";

/**
 * The Dashboard Hero — replaces the plain "Welcome back" text header.
 * Deliberately does NOT copy the generic "weather widget in a school
 * ERP" pattern (irrelevant to whether a school is actually running
 * well) — instead, the one thing worth a person's attention here is a
 * real, computed "School Pulse": attendance and fee collection blended
 * into one number, because that's the actual question a School Admin
 * is asking when they open this page.
 */

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function PulseRing({ score }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-20 h-20 shrink-0">
      <svg viewBox="0 0 72 72" className="w-20 h-20 -rotate-90">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
        <circle
          cx="36" cy="36" r={radius} fill="none" stroke="white" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-display font-bold text-white">{Math.round(score)}</span>
      </div>
    </div>
  );
}

export default function DashboardHero({ user, summary }) {
  const pulse = summary
    ? Math.round((summary.attendance_today_pct + (summary.school_health.fees_collected || 0)) / 2)
    : 0;

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-brand-600 to-fuchsia-600 p-6 sm:p-8 mb-6">
      {/* Subtle ambient texture — a few soft dots, not a busy pattern */}
      <div className="absolute inset-0 opacity-[0.07]" style={{
        backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }} />

      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-1">
            {greeting()}{user ? `, ${user.full_name.split(" ")[0]}` : ""}
          </h2>
          <p className="text-white/80 text-sm">
            {summary?.school_name}
            {summary?.academic_year_label && <span className="text-white/60"> · {summary.academic_year_label}</span>}
          </p>
          <p className="text-white/60 text-xs mt-1">{today}</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-white/70 text-xs font-medium uppercase tracking-wide">School Pulse</p>
            <p className="text-white/50 text-[11px]">Attendance + fees, blended</p>
          </div>
          <PulseRing score={pulse} />
        </div>
      </div>

      {summary && (
        <div className="relative grid grid-cols-3 gap-3 mt-6">
          <StatPill label="Students Present" value={`${summary.attendance_today_pct}%`} />
          <StatPill label="Staff Present" value={`${summary.school_health.teacher_attendance ?? 0}%`} />
          <StatPill label="Fee Collected Today" value={`₹${summary.fee_collected_today.toLocaleString("en-IN")}`} />
        </div>
      )}
    </div>
  );
}

function StatPill({ label, value }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-3">
      <p className="text-white/70 text-[11px] font-medium uppercase tracking-wide">{label}</p>
      <p className="text-white text-xl font-display font-bold mt-0.5">{value}</p>
    </div>
  );
}
