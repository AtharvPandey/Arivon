"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, ChevronRight } from "lucide-react";
import { isPlatformLoggedIn, platformApiRequest, clearPlatformToken } from "../../../lib/platformApi";

export default function VerificationQueuePage() {
  const router = useRouter();
  const [queue, setQueue] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPlatformLoggedIn()) {
      router.push("/platform/login");
      return;
    }
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await platformApiRequest("/platform/verification/queue");
      setQueue(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearPlatformToken();
    router.push("/platform/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-navy-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-display font-bold text-white">Arivon Platform</span>
          <nav className="flex items-center gap-4">
            <button onClick={() => router.push("/platform/dashboard")} className="text-sm text-slate-300 hover:text-white">Overview</button>
            <button onClick={() => router.push("/platform/schools")} className="text-sm text-slate-300 hover:text-white">Schools</button>
            <button className="text-sm text-white font-medium">Verification</button>
            <button onClick={() => router.push("/platform/compliance")} className="text-sm text-slate-300 hover:text-white">Compliance</button>
          </nav>
        </div>
        <button onClick={handleLogout} className="text-sm text-slate-300 hover:text-white">Log out</button>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">Verification Queue</h2>
        <p className="text-sm text-slate-600 mb-6">Schools awaiting review before they go live.</p>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

        {loading ? (
          <p className="text-sm text-slate-600">Loading...</p>
        ) : queue.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <ClipboardCheck size={28} className="text-brand-500 mx-auto mb-3" />
            <p className="text-sm text-slate-600">Nothing waiting for review right now.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {queue.map((item, i) => (
              <button
                key={item.school_id}
                onClick={() => router.push(`/platform/verification/${item.school_id}`)}
                className={`w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 ${i !== queue.length - 1 ? "border-b border-slate-100" : ""}`}
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.school_name}</p>
                  <p className="text-xs text-slate-500">{item.board_type} · {item.city || "—"}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-500">
                    {item.documents_verified_count}/{item.document_count} documents reviewed
                  </span>
                  <ChevronRight size={16} className="text-slate-400" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
