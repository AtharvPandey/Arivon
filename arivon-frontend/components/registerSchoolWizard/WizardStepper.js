"use client";

import { Check } from "lucide-react";

/**
 * Persistent horizontal stepper — every step visible at once (not just
 * "step 3 of ???"), completed steps show a checkmark, current step is
 * highlighted, upcoming steps are dimmed but clickable if already
 * reached once (never skip-ahead into unvalidated territory).
 */
export default function WizardStepper({ steps, currentIndex, furthestIndex, onStepClick }) {
  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex items-center min-w-max px-1">
        {steps.map((step, index) => {
          const isComplete = index < furthestIndex;
          const isCurrent = index === currentIndex;
          const isReachable = index <= furthestIndex;

          return (
            <div key={step.key} className="flex items-center">
              <button
                onClick={() => isReachable && onStepClick(index)}
                disabled={!isReachable}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  isCurrent
                    ? "bg-brand-500 text-white"
                    : isComplete
                    ? "text-brand-700 hover:bg-brand-50 cursor-pointer"
                    : isReachable
                    ? "text-slate-600 hover:bg-slate-100 cursor-pointer"
                    : "text-slate-300 cursor-not-allowed"
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    isCurrent
                      ? "bg-white text-brand-600"
                      : isComplete
                      ? "bg-brand-100 text-brand-700"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {isComplete ? <Check size={12} /> : index + 1}
                </span>
                {step.label}
              </button>
              {index < steps.length - 1 && (
                <div className={`w-4 h-px shrink-0 ${index < furthestIndex ? "bg-brand-300" : "bg-slate-200"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
