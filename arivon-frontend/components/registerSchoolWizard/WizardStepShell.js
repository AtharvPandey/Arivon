"use client";

/**
 * Shared wrapper every step component renders inside — consistent
 * title/description/card/footer, so each step only needs to render its
 * own fields, not re-implement this chrome 11 times.
 */
export default function WizardStepShell({
  title,
  description,
  children,
  onBack,
  onNext,
  nextLabel = "Save & Continue",
  isFirst = false,
  saving = false,
  error = "",
  skippable = false,
  onSkip,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <h3 className="text-lg font-display font-bold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-600 mb-6">{description}</p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="space-y-4">{children}</div>

      <div className="flex items-center justify-between mt-8 pt-5 border-t border-slate-100">
        <button
          onClick={onBack}
          disabled={isFirst}
          className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-0 disabled:pointer-events-none"
        >
          ← Back
        </button>
        <div className="flex items-center gap-3">
          {skippable && (
            <button
              onClick={onSkip}
              className="text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              Skip for now
            </button>
          )}
          <button
            onClick={onNext}
            disabled={saving}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-5 py-2.5 transition-colors"
          >
            {saving ? "Saving..." : nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
