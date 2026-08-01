"use client";

import StudentProfileView from "../../../../components/StudentProfileView";

export default function TeacherStudentDetailPage() {
  // Teachers get a read-only view — no editing student records, no
  // Transfer Certificate generation, no re-admission. Those remain
  // School Admin / Admissions-level actions.
  return <StudentProfileView readOnly={true} backHref="/teacher/classes" />;
}
