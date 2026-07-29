"use client";

const STAGE_LABELS = {
  pre_primary: "Pre-Primary",
  primary: "Primary School",
  middle: "Middle School",
  secondary: "Secondary School",
  higher_secondary: "Higher Secondary School",
};

const STAGE_ORDER = ["pre_primary", "primary", "middle", "secondary", "higher_secondary"];

/**
 * Renders a <select> of classes grouped into <optgroup>s by school stage
 * (Pre-Primary / Primary / Middle / Secondary / Higher Secondary) — one
 * shared component instead of duplicating this grouping logic on every
 * page that needs a class picker (Students, Attendance, Academics,
 * Admissions, Finance).
 */
export default function ClassSelect({ classes, value, onChange, placeholder = "Select a class", className, disabled, required }) {
  const grouped = {};
  classes.forEach((c) => {
    const stage = c.stage || "other";
    if (!grouped[stage]) grouped[stage] = [];
    grouped[stage].push(c);
  });

  const orderedStages = STAGE_ORDER.filter((s) => grouped[s]?.length).concat(
    Object.keys(grouped).filter((s) => !STAGE_ORDER.includes(s))
  );

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      required={required}
      className={className || "rounded-lg border border-slate-200 px-3 py-2 text-sm"}
    >
      <option value="">{placeholder}</option>
      {orderedStages.map((stage) => (
        <optgroup key={stage} label={STAGE_LABELS[stage] || stage}>
          {grouped[stage].map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
