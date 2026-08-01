"use client";

import { useState } from "react";
import { Copy, Check, KeyRound, Clock, ExternalLink, X } from "lucide-react";

function CopyField({ label, value, monospace = false }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <div className={`flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm truncate ${monospace ? "font-mono" : ""}`}>
          {value}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border transition-colors ${
            copied ? "bg-brand-50 border-brand-200 text-brand-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
          }`}
          title="Copy"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

/**
 * result: { fullName, email, temporaryPassword, tempPasswordExpiresAt, loginUrl }
 * This is the ONLY place the plaintext temp password is ever shown —
 * it's never retrievable again after this card is dismissed, so the
 * copy buttons matter more here than almost anywhere else in the app.
 */
export default function CredentialsCard({ result, onDismiss, title = "Account created" }) {
  const expiresDate = new Date(result.tempPasswordExpiresAt);
  const formattedExpiry = expiresDate.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  return (
    <div className="bg-gradient-to-br from-brand-50 to-white border border-brand-200 rounded-2xl p-5 mb-5 relative">
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-700 transition-colors"
        >
          <X size={15} />
        </button>
      )}

      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
          <KeyRound size={13} className="text-white" />
        </div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
      <p className="text-xs text-slate-600 mb-4 pl-9">
        {result.fullName} · {result.email}
      </p>

      <div className="space-y-3 pl-9">
        <CopyField label="Login URL" value={result.loginUrl} />
        <CopyField label="Temporary password" value={result.temporaryPassword} monospace />
      </div>

      <div className="mt-4 ml-9 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
        <Clock size={13} className="mt-0.5 shrink-0" />
        <span>
          Valid until <strong>{formattedExpiry}</strong> — they'll be asked to set their own password the first time they sign in.
          Share this password securely; it won't be shown again.
        </span>
      </div>
    </div>
  );
}
