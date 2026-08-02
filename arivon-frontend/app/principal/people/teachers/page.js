import StaffDirectory from "../../../../components/StaffDirectory";

export default function PrincipalTeachersPage() {
  return <StaffDirectory roleFilter="teacher" title="Teachers" subtitle="All teaching staff at your school." detailPrefix="/principal/people/staff" />;
}
