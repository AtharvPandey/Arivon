"use client";

import SettingsView from "../../../components/SettingsView";

export default function AdmissionsSettingsPage() {
  // Admissions Officer doesn't have its own School Profile view (no
  // sidebar access to that section) - falls back to admin's read view.
  return <SettingsView schoolProfileHref="/admin/school/profile" />;
}
