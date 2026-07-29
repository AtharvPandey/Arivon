"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Megaphone, Send, Users2, Plus, History, CalendarCheck, CheckCircle2, Circle,
} from "lucide-react";
import { apiRequest, isLoggedIn } from "../../../lib/api";
import NoticeBoard from "../../../components/NoticeBoard";
import ClassSelect from "../../../components/ClassSelect";

const CATEGORY_STYLES = {
  academic: "bg-indigo-100 text-indigo-700",
  administrative: "bg-slate-100 text-slate-600",
  event: "bg-teal-100 text-teal-700",
  holiday: "bg-amber-100 text-amber-700",
  exam: "bg-rose-100 text-rose-700",
};

const MESSAGE_TYPE_LABELS = {
  fee_reminder: "Fee Reminder",
  exam_schedule: "Exam Schedule",
  ptm_reminder: "PTM Reminder",
  holiday: "Holiday Notice",
  emergency: "Emergency Broadcast",
  custom: "Custom Message",
};

const TABS = [
  { key: "notices", label: "Notices & Circulars", icon: Megaphone, color: "brand" },
  { key: "bulk", label: "Bulk Messaging", icon: Send, color: "teal" },
  { key: "ptm", label: "PTM", icon: Users2, color: "violet" },
];
const TAB_COLOR_CLASSES = {
  brand: "border-brand-600 text-brand-700",
  teal: "border-teal-600 text-teal-700",
  violet: "border-violet-600 text-violet-700",
};

export default function CommunicationPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [activeTab, setActiveTab] = useState("notices");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/");
      return;
    }
    (async () => {
      try {
        const me = await apiRequest("/auth/me");
        setUser(me);
        const classList = await apiRequest(`/classes/?school_id=${me.school_id}`);
        setClasses(classList);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  if (!user) return <div className="max-w-3xl mx-auto px-6 py-8 text-sm text-slate-600">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">Communication</h2>
      <p className="text-sm text-slate-600 mb-6">Notices, bulk messaging, and parent-teacher meetings.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="flex items-center gap-1 border-b border-slate-200 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.key ? TAB_COLOR_CLASSES[tab.color] : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "notices" && <NoticesTab user={user} classes={classes} setError={setError} />}
      {activeTab === "bulk" && <BulkMessagingTab user={user} classes={classes} setError={setError} />}
      {activeTab === "ptm" && <PTMTab user={user} classes={classes} setError={setError} />}
    </div>
  );
}

// ---------- Notices Tab ----------

function NoticesTab({ user, classes, setError }) {
  const [announcements, setAnnouncements] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("administrative");
  const [classId, setClassId] = useState("");
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);
  async function load() {
    const data = await apiRequest(`/announcements/?school_id=${user.school_id}`);
    setAnnouncements(data);
  }

  useEffect(() => {
    if (!classId) { setSections([]); setSectionId(""); return; }
    apiRequest(`/classes/${classId}/sections`).then(setSections);
  }, [classId]);

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiRequest("/announcements/", {
        method: "POST",
        body: {
          school_id: user.school_id, title, content, category,
          school_class_id: classId ? Number(classId) : null,
          section_id: sectionId ? Number(sectionId) : null,
        },
      });
      setTitle(""); setContent(""); setClassId(""); setSectionId("");
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowForm(!showForm)} className="text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-3 py-1.5 flex items-center gap-1">
          <Plus size={12} /> New Targeted Notice
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-4 mb-5 space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Notice content..." rows={3} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <div className="grid grid-cols-3 gap-2">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
              <option value="academic">Academic</option>
              <option value="administrative">Administrative</option>
              <option value="event">Event</option>
              <option value="holiday">Holiday</option>
              <option value="exam">Exam</option>
            </select>
            <ClassSelect classes={classes} value={classId} onChange={setClassId} placeholder="All classes" />
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!classId} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:bg-slate-50">
              <option value="">All sections</option>
              {sections.map((s) => <option key={s.id} value={s.id}>Section {s.name}</option>)}
            </select>
          </div>
          <button type="submit" disabled={saving} className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-medium rounded-lg px-4 py-2">
            {saving ? "Publishing..." : "Publish Notice"}
          </button>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 mb-6">
        {announcements.length === 0 ? (
          <p className="text-sm text-slate-500 p-6 text-center">No notices yet.</p>
        ) : announcements.map((a) => (
          <div key={a.id} className="px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-slate-900">{a.title}</p>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${CATEGORY_STYLES[a.category] || CATEGORY_STYLES.administrative}`}>
                {a.category}
              </span>
            </div>
            <p className="text-xs text-slate-600">{a.content}</p>
            <p className="text-[11px] text-slate-400 mt-1">
              {a.section_name ? `${a.class_name} - ${a.section_name}` : a.class_name ? a.class_name : "School-wide"}
            </p>
          </div>
        ))}
      </div>

      <NoticeBoard schoolId={user.school_id} userRole={user.role_name} announcements={[]} onPosted={load} />
    </div>
  );
}

// ---------- Bulk Messaging Tab ----------

function BulkMessagingTab({ user, classes, setError }) {
  const [messageType, setMessageType] = useState("holiday");
  const [targetScope, setTargetScope] = useState("school");
  const [classId, setClassId] = useState("");
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [log, setLog] = useState([]);

  useEffect(() => { loadLog(); }, []);
  async function loadLog() {
    const data = await apiRequest(`/communication/bulk-message/log?school_id=${user.school_id}`);
    setLog(data);
  }

  useEffect(() => {
    if (!classId) { setSections([]); setSectionId(""); return; }
    apiRequest(`/classes/${classId}/sections`).then(setSections);
  }, [classId]);

  async function handleSend(e) {
    e.preventDefault();
    setSending(true);
    setError("");
    setResult(null);
    try {
      const res = await apiRequest(`/communication/bulk-message?school_id=${user.school_id}`, {
        method: "POST",
        body: {
          message_type: messageType, target_scope: targetScope,
          school_class_id: targetScope !== "school" && classId ? Number(classId) : null,
          section_id: targetScope === "section" && sectionId ? Number(sectionId) : null,
          message_content: messageContent,
        },
      });
      setResult(res);
      setMessageContent("");
      await loadLog();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleFeeReminder() {
    setSending(true);
    setError("");
    setResult(null);
    try {
      const res = await apiRequest(`/communication/fee-reminder?school_id=${user.school_id}${targetScope === "section" && sectionId ? `&section_id=${sectionId}` : ""}`, { method: "POST" });
      setResult({ recipient_count: res.notified_count, message_type: "fee_reminder" });
      await loadLog();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSend} className="bg-white border border-slate-200 rounded-xl p-4 mb-5 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <select value={messageType} onChange={(e) => setMessageType(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="exam_schedule">Exam Schedule</option>
            <option value="ptm_reminder">PTM Reminder</option>
            <option value="holiday">Holiday Notice</option>
            <option value="emergency">Emergency Broadcast</option>
            <option value="custom">Custom Message</option>
          </select>
          <select value={targetScope} onChange={(e) => setTargetScope(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="school">Entire School</option>
            <option value="class">Whole Class</option>
            <option value="section">Specific Section</option>
          </select>
        </div>
        {targetScope !== "school" && (
          <div className="grid grid-cols-2 gap-2">
            <ClassSelect classes={classes} value={classId} onChange={setClassId} placeholder="Select class" />
            {targetScope === "section" && (
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!classId} className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50">
                <option value="">Select section</option>
                {sections.map((s) => <option key={s.id} value={s.id}>Section {s.name}</option>)}
              </select>
            )}
          </div>
        )}
        <textarea value={messageContent} onChange={(e) => setMessageContent(e.target.value)} placeholder="Message content..." rows={3} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <div className="flex items-center gap-2">
          <button type="submit" disabled={sending} className="bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2 flex items-center gap-1.5">
            <Send size={14} /> {sending ? "Sending..." : "Send Message"}
          </button>
          <button type="button" onClick={handleFeeReminder} disabled={sending} className="text-sm font-medium text-rose-700 border border-rose-200 rounded-lg px-4 py-2">
            Send Fee Reminders to Defaulters
          </button>
        </div>
        {result && (
          <p className="text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
            Sent to {result.recipient_count} recipient(s) — {MESSAGE_TYPE_LABELS[result.message_type] || result.message_type}
          </p>
        )}
      </form>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5">
          <History size={13} className="text-slate-400" /> <p className="text-xs font-semibold text-slate-600">Send History</p>
        </div>
        <div className="divide-y divide-slate-100">
          {log.length === 0 ? (
            <p className="text-sm text-slate-500 p-6 text-center">No messages sent yet.</p>
          ) : log.map((l) => (
            <div key={l.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
              <span className="text-slate-700">{MESSAGE_TYPE_LABELS[l.message_type] || l.message_type} · {l.target_scope}</span>
              <span className="text-slate-500">{l.recipient_count} recipient(s) · {new Date(l.sent_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- PTM Tab ----------

function PTMTab({ user, classes, setError }) {
  const [ptms, setPtms] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState("");
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState("");
  const [ptmDate, setPtmDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("13:00");
  const [venue, setVenue] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [attendance, setAttendance] = useState([]);

  useEffect(() => { load(); }, []);
  async function load() {
    const data = await apiRequest(`/communication/ptm?school_id=${user.school_id}`);
    setPtms(data);
  }

  useEffect(() => {
    if (!classId) { setSections([]); setSectionId(""); return; }
    apiRequest(`/classes/${classId}/sections`).then(setSections);
  }, [classId]);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    try {
      await apiRequest(`/communication/ptm?school_id=${user.school_id}`, {
        method: "POST",
        body: {
          title, school_class_id: classId ? Number(classId) : null, section_id: sectionId ? Number(sectionId) : null,
          ptm_date: ptmDate, start_time: startTime, end_time: endTime, venue: venue || null,
        },
      });
      setTitle(""); setClassId(""); setSectionId(""); setPtmDate(""); setVenue("");
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleNotify(ptmId) {
    try {
      const res = await apiRequest(`/communication/ptm/${ptmId}/notify`, { method: "POST" });
      alert(`Notified ${res.recipient_count} parent(s).`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleExpand(ptm) {
    if (expandedId === ptm.id) { setExpandedId(null); return; }
    setExpandedId(ptm.id);
    const data = await apiRequest(`/communication/ptm/${ptm.id}/attendance`);
    setAttendance(data);
  }

  async function toggleAttendance(ptmId, studentId, current) {
    await apiRequest(`/communication/ptm/${ptmId}/attendance`, {
      method: "POST",
      body: { student_id: studentId, attended: !current },
    });
    const data = await apiRequest(`/communication/ptm/${ptmId}/attendance`);
    setAttendance(data);
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowForm(!showForm)} className="text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-3 py-1.5 flex items-center gap-1">
          <Plus size={12} /> Schedule PTM
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-4 mb-5 space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Term 1 PTM)" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <ClassSelect classes={classes} value={classId} onChange={setClassId} placeholder="All classes" />
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!classId} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:bg-slate-50">
              <option value="">All sections</option>
              {sections.map((s) => <option key={s.id} value={s.id}>Section {s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input type="date" value={ptmDate} onChange={(e) => setPtmDate(e.target.value)} required className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
          </div>
          <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Venue (optional)" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <button type="submit" className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg px-4 py-2">Schedule PTM</button>
        </form>
      )}

      <div className="space-y-2">
        {ptms.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <CalendarCheck size={20} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-600">No PTMs scheduled yet.</p>
          </div>
        ) : ptms.map((ptm) => (
          <div key={ptm.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{ptm.title}</p>
                <p className="text-xs text-slate-500">
                  {ptm.ptm_date} · {ptm.start_time}-{ptm.end_time}{ptm.venue && ` · ${ptm.venue}`}
                  {" · "}{ptm.section_name ? `${ptm.class_name} - ${ptm.section_name}` : ptm.class_name || "School-wide"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleNotify(ptm.id)} className="text-xs font-medium text-violet-700 border border-violet-200 rounded-lg px-3 py-1.5">Notify</button>
                <button onClick={() => toggleExpand(ptm)} className="text-xs font-medium text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5">Attendance</button>
              </div>
            </div>
            {expandedId === ptm.id && (
              <div className="border-t border-slate-100 divide-y divide-slate-100">
                {attendance.map((a) => (
                  <button key={a.student_id} onClick={() => toggleAttendance(ptm.id, a.student_id, a.attended)} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 text-left">
                    <span className="text-sm text-slate-700">{a.student_name}</span>
                    {a.attended ? (
                      <span className="text-xs font-medium text-brand-700 flex items-center gap-1"><CheckCircle2 size={13} /> Attended</span>
                    ) : (
                      <span className="text-xs font-medium text-slate-400 flex items-center gap-1"><Circle size={13} /> Not marked</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
