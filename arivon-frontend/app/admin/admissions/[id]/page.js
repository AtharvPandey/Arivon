"use client";

import AdmissionApplicationView from "../../../../components/AdmissionApplicationView";

export default function AdminAdmissionDetailPage() {
  return <AdmissionApplicationView backHref="/admin/admissions" studentDetailPrefix="/admin/students" />;
}
