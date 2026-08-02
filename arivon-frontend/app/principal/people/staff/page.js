import StaffDirectory from "../../../../components/StaffDirectory";

export default function PrincipalStaffPage() {
  return <StaffDirectory roleFilter={null} title="Staff" subtitle="Every staff member at your school, across every department." detailPrefix="/principal/people/staff" />;
}
