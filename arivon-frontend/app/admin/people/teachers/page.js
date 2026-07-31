import StaffDirectory from "../../../../components/StaffDirectory";

export default function TeachersPage() {
  return (
    <StaffDirectory
      roleFilter="teacher"
      title="Teachers"
      subtitle="All teaching staff at your school."
    />
  );
}
