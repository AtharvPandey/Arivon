import StaffDirectory from "../../../../components/StaffDirectory";

export default function AdminTeachersPage() {
  return <StaffDirectory roleFilter="teacher" title="Teachers" subtitle="All teaching staff at your school." detailPrefix="/admin/people/staff" />;
}
