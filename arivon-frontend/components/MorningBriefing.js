"use client";

import { useEffect, useState } from "react";
import {
  GraduationCap, ClipboardList, MessageCircleWarning, IndianRupee, UserPlus,
  ChevronDown, CheckCircle2, AlertCircle, Sunrise, ArrowUpRight,
} from "lucide-react";
import { apiRequest } from "../lib/api";

/**
 * The Morning Briefing — the first thing a School Admin sees, answering
 * the five questions they actually ask themselves at 8-10 AM. Two cards
 * (Teacher Attendance, Attendance Submission) expand in place so the
 * Admin can act — assign a substitute, jump to a section — without
 * leaving the dashboard. This is the section's one real idea: a
 * briefing that answers back, not just a wall of numbers to click through.
 */

const CATEGORY_STYLES = {
  indigo: { bg: "bg-indigo-50", iconBg: "bg-indigo-100", icon: "text-indigo-600", text: "text-indigo-700", ring: "ring-indigo-100" },
  teal: { bg: "bg-teal-50", iconBg: "bg-teal-100", icon: "text-teal-600", text: "text-teal-700", ring: "ring-teal-100" },
  rose: { bg: "bg-rose-50", iconBg: "bg-rose-100", icon: "text-rose-600", text: "text-rose-700", ring: "ring-rose-100" },
  amber: { bg: "bg-amber-50", iconBg: "bg-amber-100", icon: "text-amber-600", text: "text-amber-700", ring: "ring-amber-100" },
  sky: { bg: "bg-sky-50", iconBg: "bg-sky-100", icon: "text-sky-600", text: "text-sky-700", ring: "ring-sky-100" },
};

function BriefingCard({ color, icon: Icon, eyebrow, headline, sublabel, expandable, expanded, onToggle, calm, href, children }) {
  const s = CATEGORY_STYLES[color];
  const clickable = expandable || href;

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white overflow-hidden transition-shadow hover:shadow-sm ${expanded ? "ring-2 " + s.ring : ""}`}>
      <a
        href={href}
        onClick={expandable ? (e) => { e.preventDefault(); onToggle(); } : undefined}
        className={`block w-full text-left p-4 ${clickable ? "cursor-pointer" : "cursor-default"}`}
      >
        <div className="flex items-start justify-between">
          <div className={`w-9 h-9 rounded-xl ${s.iconBg} flex items-center justify-center shrink-0`}>
            <Icon size={17} className={s.icon} />
          </div>
          {expandable && (
            <ChevronDown size={16} className={`text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
          )}
          {href && !expandable && (
            <ArrowUpRight size={15} className="text-slate-300" />
          )}
        </div>
        <p className={`text-xs font-semibold uppercase tracking-wide mt-3 ${s.text}`}>{eyebrow}</p>
        <p className="text-2xl font-display font-bold text-slate-900 mt-0.5 leading-tight">{headline}</p>
        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
          {calm ? <CheckCircle2 size={12} className="text-slate-400" /> : <AlertCircle size={12} className="text-slate-400" />}
          {sublabel}
        </p>
      </a>
      {expandable && expanded && (
        <div className={`border-t border-slate-100 ${s.bg} px-4 py-3`}>{children}</div>
      )}
    </div>
  );
}

export default function MorningBriefing({ schoolId }) {
  const [briefing, setBriefing] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (schoolId) load();
  }, [schoolId]);

  async function load() {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const briefingData = await apiRequest(`/dashboard/morning-briefing/?school_id=${schoolId}&date=${today}`);
      setBriefing(briefingData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 mb-6 text-sm text-slate-500">Loading this morning's briefing...</div>;
  }
  if (error || !briefing) {
    return null; // fail quietly — the rest of the dashboard still works without this section
  }

  const ta = briefing.teacher_attendance;
  const as_ = briefing.attendance_submission;
  const needsSubCount = ta.absent_list.filter((t) => t.needs_substitute).length;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Sunrise size={16} className="text-brand-500" />
        <h3 className="text-sm font-semibold text-slate-800">Morning Briefing</h3>
        <span className="text-xs text-slate-400">
          {new Date(briefing.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 items-start">
        {/* Teacher Attendance */}
        <BriefingCard
          color="indigo" icon={GraduationCap} eyebrow="Teachers Today"
          headline={`${ta.present + ta.late}/${ta.total_teachers} in`}
          sublabel={needsSubCount > 0 ? `${needsSubCount} need a substitute` : ta.absent > 0 ? `${ta.absent} absent, all covered` : "Everyone accounted for"}
          calm={needsSubCount === 0}
          href="/dashboard/attendance/overview?tab=staff"
        />

        {/* Attendance Submission */}
        <BriefingCard
          color="teal" icon={ClipboardList} eyebrow="Attendance Status"
          headline={`${as_.submitted}/${as_.total_sections} sections`}
          sublabel={as_.not_submitted > 0 ? `${as_.not_submitted} haven't submitted yet` : "All sections submitted"}
          calm={as_.not_submitted === 0}
          href="/dashboard/attendance/overview?tab=sections"
        />

        {/* Parent Complaints */}
        <BriefingCard
          color="rose" icon={MessageCircleWarning} eyebrow="Open Complaints"
          headline={briefing.complaints.open_count}
          sublabel={briefing.complaints.open_count > 0 ? "Awaiting a response" : "Nothing outstanding"}
          calm={briefing.complaints.open_count === 0}
          href="/dashboard/communication/complaints"
        />

        {/* Fee Collection (yesterday) */}
        <BriefingCard
          color="amber" icon={IndianRupee} eyebrow="Collected Yesterday"
          headline={`₹${briefing.fee_collection.yesterday_total.toLocaleString("en-IN")}`}
          sublabel={`${briefing.fee_collection.yesterday_payment_count} payment(s)`}
          calm
          href="/dashboard/finance"
        />

        {/* Admission Inquiries */}
        <BriefingCard
          color="sky" icon={UserPlus} eyebrow="New Inquiries"
          headline={briefing.admissions.pending_count}
          sublabel={briefing.admissions.pending_count > 0 ? "Awaiting review" : "Nothing pending"}
          calm={briefing.admissions.pending_count === 0}
          href="/dashboard/admissions"
        />
      </div>
    </div>
  );
}
