"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { apiRequest, isLoggedIn } from "../lib/api";

const MANAGER_ROLES = ["school_admin", "administrator", "principal", "vice_principal", "super_admin"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toISODate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [holidays, setHolidays] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    init();
  }, []);

  useEffect(() => {
    if (user) loadMonth();
  }, [viewDate, user]);

  async function init() {
    try {
      const me = await apiRequest("/auth/me");
      setUser(me);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMonth() {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const start = toISODate(year, month, 1);
    const end = toISODate(year, month, new Date(year, month + 1, 0).getDate());
    try {
      const [holidayData, eventData] = await Promise.all([
        apiRequest(`/holidays/?school_id=${user.school_id}`),
        apiRequest(`/events/range?school_id=${user.school_id}&start_date=${start}&end_date=${end}`),
      ]);
      setHolidays(holidayData.filter((h) => h.date >= start && h.date <= end));
      setEvents(eventData);
    } catch (err) {
      setError(err.message);
    }
  }

  function changeMonth(delta) {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1));
    setSelectedDate(null);
  }

  const canManage = user && MANAGER_ROLES.includes(user.role_name);

  async function handleAddEvent(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiRequest("/events/", {
        method: "POST",
        body: { school_id: user.school_id, title: eventTitle, event_date: selectedDate, event_time: eventTime || null },
      });
      setEventTitle(""); setEventTime(""); setShowForm(false);
      await loadMonth();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEvent(id) {
    if (!confirm("Remove this event?")) return;
    try {
      await apiRequest(`/events/${id}`, { method: "DELETE" });
      await loadMonth();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-sm text-slate-600">Loading...</div>;

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayISO = new Date().toISOString().slice(0, 10);

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedHolidays = selectedDate ? holidays.filter((h) => h.date === selectedDate) : [];
  const selectedEvents = selectedDate ? events.filter((ev) => ev.event_date === selectedDate) : [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-6 sm:p-8 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <p className="text-xs font-medium text-indigo-300 mb-2 flex items-center gap-1.5">
            <CalendarDays size={12} /> Calendar
          </p>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white">School Calendar</h2>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Month grid */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => changeMonth(-1)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-500">
              <ChevronLeft size={16} />
            </button>
            <h3 className="text-sm font-semibold text-slate-800">{MONTH_NAMES[month]} {year}</h3>
            <button onClick={() => changeMonth(1)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-500">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-slate-400 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (d === null) return <div key={i} />;
              const iso = toISODate(year, month, d);
              const isToday = iso === todayISO;
              const isSelected = iso === selectedDate;
              const dayHolidays = holidays.filter((h) => h.date === iso);
              const dayEvents = events.filter((ev) => ev.event_date === iso);
              const hasMarker = dayHolidays.length > 0 || dayEvents.length > 0;

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(iso)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs relative transition-colors ${
                    isSelected ? "bg-brand-600 text-white" : isToday ? "bg-brand-50 text-brand-700 font-semibold" : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  {d}
                  {hasMarker && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dayHolidays.length > 0 && <div className={`w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-rose-500"}`} />}
                      {dayEvents.length > 0 && <div className={`w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-indigo-500"}`} />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <div className="w-2 h-2 rounded-full bg-rose-500" /> Holiday
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <div className="w-2 h-2 rounded-full bg-indigo-500" /> Event
            </div>
          </div>
        </div>

        {/* Selected day panel */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          {!selectedDate ? (
            <p className="text-sm text-slate-400 text-center py-10">Tap a date to see what's happening.</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-800">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                </h3>
                {canManage && (
                  <button onClick={() => setShowForm(!showForm)} className="text-xs font-medium text-brand-700 hover:underline flex items-center gap-1">
                    {showForm ? <X size={12} /> : <Plus size={12} />} {showForm ? "Cancel" : "Add"}
                  </button>
                )}
              </div>

              {showForm && (
                <form onSubmit={handleAddEvent} className="space-y-2 mb-4 border-b border-slate-100 pb-4">
                  <input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="Event title" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <button type="submit" disabled={saving} className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-medium rounded-lg py-2">
                    {saving ? "Adding..." : "Add Event"}
                  </button>
                </form>
              )}

              {selectedHolidays.length === 0 && selectedEvents.length === 0 ? (
                <p className="text-xs text-slate-400">Nothing scheduled.</p>
              ) : (
                <div className="space-y-2">
                  {selectedHolidays.map((h) => (
                    <div key={`h-${h.id}`} className="flex items-center gap-2 bg-rose-50 rounded-lg px-3 py-2">
                      <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                      <p className="text-sm text-rose-800">{h.name}</p>
                      <span className="text-[10px] text-rose-600 ml-auto">Holiday</span>
                    </div>
                  ))}
                  {selectedEvents.map((ev) => (
                    <div key={`e-${ev.id}`} className="flex items-center gap-2 bg-indigo-50 rounded-lg px-3 py-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-indigo-900 truncate">{ev.title}</p>
                        {ev.event_time && <p className="text-[10px] text-indigo-600">{ev.event_time}</p>}
                      </div>
                      {canManage && (
                        <button onClick={() => handleDeleteEvent(ev.id)} className="text-[10px] text-indigo-400 hover:text-rose-600 shrink-0">
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
