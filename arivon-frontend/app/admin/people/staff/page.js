import StaffDirectory from "../../../../components/StaffDirectory";

export default function AdminStaffPage() {
  return <StaffDirectory roleFilter={null} title="Staff" subtitle="Every staff member at your school, across every department." detailPrefix="/admin/people/staff" />;
}
