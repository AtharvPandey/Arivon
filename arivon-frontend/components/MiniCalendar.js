"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export default function MiniCalendar() {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleString("default", { month: "long", year: "numeric" });

  // Monday-first calendar grid
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // 0=Mon
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function isToday(day) {
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  }

  function changeMonth(delta) {
    setViewDate(new Date(year, month + delta, 1));
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => changeMonth(-1)} className="text-slate-400 hover:text-slate-700">
          <ChevronLeft size={18} />
        </button>
        <h3 className="text-sm font-semibold text-slate-800">{monthLabel}</h3>
        <button onClick={() => changeMonth(1)} className="text-slate-400 hover:text-slate-700">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d} className="text-xs font-medium text-slate-400 pb-1">
            {d}
          </span>
        ))}
        {cells.map((day, i) => (
          <span
            key={i}
            className={`text-sm py-1.5 rounded-full ${
              day === null
                ? ""
                : isToday(day)
                ? "bg-brand-500 text-white font-semibold"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            {day || ""}
          </span>
        ))}
      </div>
    </div>
  );
}
