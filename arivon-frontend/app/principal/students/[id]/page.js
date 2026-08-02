"use client";

import StudentProfileView from "../../../../components/StudentProfileView";

export default function PrincipalStudentDetailPage() {
  // Principal keeps full edit rights, unlike Teacher's read-only view -
  // Principal is senior staff with the same authority as School Admin
  // over student records, just a genuinely /principal/ URL instead of
  // borrowing /admin/'s.
  return <StudentProfileView readOnly={false} backHref="/principal/dashboard" />;
}
