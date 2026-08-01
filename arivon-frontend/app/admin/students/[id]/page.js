"use client";

import StudentProfileView from "../../../../components/StudentProfileView";

export default function AdminStudentDetailPage() {
  return <StudentProfileView readOnly={false} backHref="/admin/students" />;
}
