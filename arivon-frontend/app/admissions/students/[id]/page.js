"use client";

import StudentProfileView from "../../../../components/StudentProfileView";

export default function AdmissionsOfficerStudentDetailPage() {
  // Read-only, same reasoning as Teacher - Admissions Officer manages
  // the application/enrollment flow, not the ongoing student record.
  return <StudentProfileView readOnly={true} backHref="/admissions/applications" />;
}
