"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { apiRequest } from "../lib/api";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

/**
 * One shared modal that renders different fields depending on `action`.
 * Keeps the Dashboard's Quick Actions from needing a separate full page
 * for things that are genuinely just "one form, submit, done."
 */
export default function QuickActionModal({ action, schoolId, academicYearId, onClose, onDone }) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Register Teacher / Register Staff
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleName, setRoleName] = useState(action === "register_teacher" ? "teacher" : "receptionist");

  // Create House
  const [houseName, setHouseName] = useState("");
  const [houseColor, setHouseColor] = useState("#DC2626");

  // Publish Notice
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");

  // Add Event
  const [eventTitle, setEventTitle] = useState("");
  const [eventTime, setEventTime] = useState("09:00");

  const titles = {
    register_teacher: "Register Teacher",
    register_staff: "Register Staff",
    create_house: "Create House",
    publish_notice: "Publish Notice",
    add_event: "Add Today's Event",
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (action === "register_teacher" || action === "register_staff") {
        await apiRequest("/auth/register", {
          method: "POST",
          body: { school_id: schoolId, role_name: roleName, full_name: name, email, password },
        });
      } else if (action === "create_house") {
        await apiRequest("/houses/", {
          method: "POST",
          body: { school_id: schoolId, name: houseName, color: houseColor },
        });
      } else if (action === "publish_notice") {
        await apiRequest("/announcements/", {
          method: "POST",
          body: { school_id: schoolId, title: noticeTitle, content: noticeContent },
        });
      } else if (action === "add_event") {
        await apiRequest("/events/", {
          method: "POST",
          body: { school_id: schoolId, title: eventTitle, event_date: todayISO(), event_time: eventTime },
        });
      }
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800">{titles[action]}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {(action === "register_teacher" || action === "register_staff") && (
            <>
              <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
              <input type="password" placeholder="Temporary password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
              {action === "register_staff" && (
                <select value={roleName} onChange={(e) => setRoleName(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="principal">Principal</option>
                  <option value="vice_principal">Vice Principal</option>
                  <option value="receptionist">Receptionist</option>
                  <option value="accountant">Accountant</option>
                  <option value="admissions_officer">Admissions Officer</option>
                  <option value="academic_coordinator">Academic Coordinator</option>
                  <option value="librarian">Librarian</option>
                  <option value="transport_manager">Transport Manager</option>
                  <option value="driver">Driver</option>
                  <option value="support_staff">Support Staff (Cleaner/Peon/Security)</option>
                </select>
              )}
            </>
          )}

          {action === "create_house" && (
            <>
              <input placeholder="House name (e.g. Red House)" value={houseName} onChange={(e) => setHouseName(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Color</label>
                <input type="color" value={houseColor} onChange={(e) => setHouseColor(e.target.value)} className="w-10 h-8 rounded border border-slate-200" />
              </div>
            </>
          )}

          {action === "publish_notice" && (
            <>
              <input placeholder="Title" value={noticeTitle} onChange={(e) => setNoticeTitle(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
              <textarea placeholder="Content" value={noticeContent} onChange={(e) => setNoticeContent(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
            </>
          )}

          {action === "add_event" && (
            <>
              <input placeholder="Event title" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
              <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button type="submit" disabled={submitting} className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-3 py-2">
            {submitting ? "Saving..." : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
}
