"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, CreditCard, FolderOpen, Search, Download, Plus, Trophy,
} from "lucide-react";
import { apiRequest, isLoggedIn, downloadAuthenticatedFile } from "../lib/api";

const ENTITY_LABELS = { student: "Student", admission_application: "Admission Application", staff: "Staff" };

const CERTIFICATE_TYPES = [
  { key: "bonafide-certificate", label: "Bonafide Certificate", color: "indigo" },
  { key: "character-certificate", label: "Character Certificate", color: "teal" },
  { key: "study-certificate", label: "Study Certificate", color: "amber" },
  { key: "migration-certificate", label: "Migration Certificate", color: "rose" },
];
const COLOR_CLASSES = {
  indigo: "bg-indigo-50 text-indigo-700 hover:border-indigo-300",
  teal: "bg-teal-50 text-teal-700 hover:border-teal-300",
  amber: "bg-amber-50 text-amber-700 hover:border-amber-300",
  rose: "bg-rose-50 text-rose-700 hover:border-rose-300",
};

const TABS = [
  { key: "certificates", label: "Certificates", icon: FileText, color: "indigo" },
  { key: "achievements", label: "Achievements", icon: Trophy, color: "amber" },
  { key: "idcards", label: "ID Cards", icon: CreditCard, color: "teal" },
  { key: "all", label: "All Documents", icon: FolderOpen, color: "slate" },
];
const TAB_COLOR_CLASSES = {
  indigo: "border-indigo-600 text-indigo-700",
  amber: "border-amber-600 text-amber-700",
  teal: "border-teal-600 text-teal-700",
  slate: "border-slate-600 text-slate-700",
};

function StudentSearch({ schoolId, onSelect, selected }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  async function handleSearch(q) {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    const data = await apiRequest(`/students/?school_id=${schoolId}&search=${encodeURIComponent(q)}`);
    setResults(data.slice(0, 6));
  }

  return (
    <div>
      {selected ? (
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-3">
          <span className="text-sm font-medium text-slate-800">{selected.full_name} <span className="text-slate-400 font-normal">({selected.admission_number})</span></span>
          <button onClick={() => onSelect(null)} className="text-xs text-slate-500 hover:text-rose-600">Change</button>
        </div>
      ) : (
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-3 text-slate-400" />
          <input value={query} onChange={(e) => handleSearch(e.target.value)} placeholder="Search student by name or admission number..." className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2.5 text-sm" />
          {results.length > 0 && (
            <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-lg mt-1 shadow-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {results.map((s) => (
                <button key={s.id} onClick={() => { onSelect(s); setQuery(""); setResults([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                  {s.full_name} <span className="text-slate-400">({s.admission_number})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DocumentsView() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState(null);
  const [activeTab, setActiveTab] = useState("certificates");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    (async () => {
      try {
        const me = await apiRequest("/auth/me");
        setSchoolId(me.school_id);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  if (!schoolId) return <div className="max-w-3xl mx-auto px-6 py-8 text-sm text-slate-600">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">Documents & Certificates</h2>
      <p className="text-sm text-slate-600 mb-6">Student documents, certificate generation, achievements, and ID cards.</p>

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

      {activeTab === "certificates" && <CertificatesTab schoolId={schoolId} setError={setError} />}
      {activeTab === "achievements" && <AchievementsTab schoolId={schoolId} setError={setError} />}
      {activeTab === "idcards" && <IDCardsTab schoolId={schoolId} setError={setError} />}
      {activeTab === "all" && <AllDocumentsTab schoolId={schoolId} setError={setError} />}
    </div>
  );
}

// ---------- Certificates Tab ----------

function CertificatesTab({ schoolId, setError }) {
  const [student, setStudent] = useState(null);
  const [generating, setGenerating] = useState(null);
  const [result, setResult] = useState(null);

  async function handleGenerate(certType) {
    setGenerating(certType);
    setError(""); setResult(null);
    try {
      const res = await apiRequest(`/students/${student.id}/${certType}`, { method: "POST" });
      setResult({ certType, downloadUrl: res.download_url });
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div>
      <p className="text-sm text-slate-600 mb-4">Search a student, then generate any certificate for them instantly.</p>
      <StudentSearch schoolId={schoolId} onSelect={(s) => { setStudent(s); setResult(null); }} selected={student} />

      {student && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          {CERTIFICATE_TYPES.map((cert) => (
            <button
              key={cert.key}
              onClick={() => handleGenerate(cert.key)}
              disabled={generating === cert.key}
              className={`rounded-xl p-4 border border-transparent text-left transition-all ${COLOR_CLASSES[cert.color]}`}
            >
              <FileText size={18} className="mb-2" />
              <p className="text-sm font-semibold">{cert.label}</p>
              <p className="text-xs opacity-70 mt-0.5">{generating === cert.key ? "Generating..." : "Click to generate"}</p>
            </button>
          ))}
        </div>
      )}

      {result && (
        <div className="mt-4 bg-brand-50 border border-brand-100 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-brand-800">Certificate generated successfully.</p>
          <button
            onClick={() => downloadAuthenticatedFile(result.downloadUrl, `${result.certType}.pdf`)}
            className="text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-3 py-1.5 flex items-center gap-1.5"
          >
            <Download size={13} /> Download
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Achievements Tab ----------

function AchievementsTab({ schoolId, setError }) {
  const [student, setStudent] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [eventName, setEventName] = useState("");
  const [position, setPosition] = useState("");
  const [achievementDate, setAchievementDate] = useState("");
  const [generatingId, setGeneratingId] = useState(null);
  const [downloadLinks, setDownloadLinks] = useState({});

  async function selectStudent(s) {
    setStudent(s);
    if (s) {
      const data = await apiRequest(`/students/${s.id}/achievements`);
      setAchievements(data);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    try {
      await apiRequest(`/students/${student.id}/achievements`, {
        method: "POST",
        body: { title, event_name: eventName || null, position: position || null, achievement_date: achievementDate },
      });
      setTitle(""); setEventName(""); setPosition(""); setAchievementDate("");
      setShowForm(false);
      const data = await apiRequest(`/students/${student.id}/achievements`);
      setAchievements(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerateCertificate(achievementId) {
    setGeneratingId(achievementId);
    setError("");
    try {
      const res = await apiRequest(`/achievements/${achievementId}/certificate`, { method: "POST" });
      setDownloadLinks((prev) => ({ ...prev, [achievementId]: res.download_url }));
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingId(null);
    }
  }

  return (
    <div>
      <p className="text-sm text-slate-600 mb-4">Track student achievements and generate certificates for them.</p>
      <StudentSearch schoolId={schoolId} onSelect={selectStudent} selected={student} />

      {student && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowForm(!showForm)} className="text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-3 py-1.5 flex items-center gap-1">
              <Plus size={12} /> Add Achievement
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-4 mb-4 space-y-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. 1st Prize - Science Exhibition)" required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Event name" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Position (e.g. 1st)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <input type="date" value={achievementDate} onChange={(e) => setAchievementDate(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg px-4 py-2">Add Achievement</button>
            </form>
          )}

          <div className="space-y-2">
            {achievements.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">No achievements recorded yet.</p>
            ) : achievements.map((a) => (
              <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><Trophy size={16} /></div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                    <p className="text-xs text-slate-500">{a.event_name && `${a.event_name} · `}{a.position && `${a.position} · `}{a.achievement_date}</p>
                  </div>
                </div>
                {downloadLinks[a.id] ? (
                  <button onClick={() => downloadAuthenticatedFile(downloadLinks[a.id], `Achievement_${a.title}.pdf`)} className="text-xs font-medium text-brand-700 underline flex items-center gap-1">
                    <Download size={12} /> Download
                  </button>
                ) : (
                  <button onClick={() => handleGenerateCertificate(a.id)} disabled={generatingId === a.id} className="text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-3 py-1.5">
                    {generatingId === a.id ? "Generating..." : "Generate Certificate"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- ID Cards Tab ----------

function IDCardsTab({ schoolId, setError }) {
  const [mode, setMode] = useState("student");
  const [student, setStudent] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (mode === "staff") {
      apiRequest(`/staff/?school_id=${schoolId}`).then(setStaffList);
    }
  }, [mode]);

  async function handleGenerate() {
    setGenerating(true);
    setError(""); setResult(null);
    try {
      const res = mode === "student"
        ? await apiRequest(`/students/${student.id}/id-card`, { method: "POST" })
        : await apiRequest(`/staff/${selectedStaff.id}/id-card`, { method: "POST" });
      setResult(res.download_url);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => { setMode("student"); setResult(null); }} className={`text-xs font-medium px-3 py-1.5 rounded-full ${mode === "student" ? "bg-teal-600 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>Student ID</button>
        <button onClick={() => { setMode("staff"); setResult(null); }} className={`text-xs font-medium px-3 py-1.5 rounded-full ${mode === "staff" ? "bg-teal-600 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>Staff ID</button>
      </div>

      {mode === "student" ? (
        <StudentSearch schoolId={schoolId} onSelect={(s) => { setStudent(s); setResult(null); }} selected={student} />
      ) : (
        <select value={selectedStaff?.id || ""} onChange={(e) => { setSelectedStaff(staffList.find((s) => s.id === Number(e.target.value))); setResult(null); }} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm mb-3">
          <option value="">Select staff member...</option>
          {staffList.map((s) => <option key={s.id} value={s.id}>{s.full_name} {s.designation && `(${s.designation})`}</option>)}
        </select>
      )}

      {(mode === "student" ? student : selectedStaff) && (
        <button onClick={handleGenerate} disabled={generating} className="bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2 flex items-center gap-1.5">
          <CreditCard size={14} /> {generating ? "Generating..." : "Generate ID Card"}
        </button>
      )}

      {result && (
        <div className="mt-4 bg-brand-50 border border-brand-100 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-brand-800">ID card generated successfully.</p>
          <button onClick={() => downloadAuthenticatedFile(result, "ID_Card.pdf")} className="text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-3 py-1.5 flex items-center gap-1.5">
            <Download size={13} /> Download
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- All Documents Tab ----------

function AllDocumentsTab({ schoolId, setError }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiRequest(`/documents/?school_id=${schoolId}`);
        setDocuments(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="text-sm text-slate-600">Loading...</p>;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
      {documents.length === 0 ? (
        <p className="text-sm text-slate-500 p-8 text-center">No documents uploaded or generated yet.</p>
      ) : documents.map((d) => (
        <div key={d.id} className="px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">{d.original_filename}</p>
            <p className="text-xs text-slate-500">
              {ENTITY_LABELS[d.entity_type] || d.entity_type} #{d.entity_id} · {d.document_type}
              {d.verified_by_user_id && <span className="text-brand-600"> · Verified</span>}
            </p>
          </div>
          <button
            onClick={() => downloadAuthenticatedFile(`/documents/${d.id}/download`, d.original_filename)}
            className="text-brand-700 hover:text-brand-800 flex items-center gap-1 text-xs font-medium"
          >
            <Download size={13} /> Download
          </button>
        </div>
      ))}
    </div>
  );
}
