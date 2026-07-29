"use client";

import { useState } from "react";
import { Megaphone, Plus } from "lucide-react";
import { apiRequest } from "../lib/api";

const CAN_POST_ROLES = ["principal", "vice_principal", "administrator", "super_admin"];

export default function NoticeBoard({ schoolId, userRole, announcements, onPosted }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [posting, setPosting] = useState(false);

  const canPost = CAN_POST_ROLES.includes(userRole);

  async function handlePost(e) {
    e.preventDefault();
    setPosting(true);
    setError("");
    try {
      await apiRequest("/announcements/", {
        method: "POST",
        body: { school_id: schoolId, title, content },
      });
      setTitle("");
      setContent("");
      setShowForm(false);
      onPosted?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  function timeAgo(dateStr) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Megaphone size={16} className="text-brand-600" />
          <h3 className="text-sm font-semibold text-slate-800">Notice Board</h3>
        </div>
        {canPost && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs font-medium text-brand-700 flex items-center gap-1 hover:text-brand-800"
          >
            <Plus size={14} />
            New
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handlePost} className="mb-4 space-y-2 bg-slate-50 rounded-lg p-3">
          <input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            required
          />
          <textarea
            placeholder="Announcement content..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            required
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={posting}
            className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg px-3 py-1.5"
          >
            {posting ? "Posting..." : "Post Announcement"}
          </button>
        </form>
      )}

      {announcements.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">No announcements yet.</p>
      ) : (
        <div className="space-y-3 max-h-72 overflow-y-auto">
          {announcements.map((a) => (
            <div key={a.id} className="border-b border-slate-100 last:border-0 pb-3 last:pb-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900">{a.title}</p>
                <span className="text-xs text-slate-400 shrink-0 ml-2">{timeAgo(a.created_at)}</span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">{a.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
