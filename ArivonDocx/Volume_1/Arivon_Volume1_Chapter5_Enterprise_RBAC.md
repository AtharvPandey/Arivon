# Arivon Product Development Bible

# Volume 1 — Chapter 5
## Enterprise Role-Based Access Control (RBAC)

> This chapter defines the authorization model that governs every screen, API, workflow, report, and action in Arivon.

# 1. Purpose

RBAC ensures every authenticated user can access only the resources required for their job. Authorization is driven entirely by permissions—not hard-coded role checks.

# 2. Core Concepts

Entity hierarchy:

Permission
↓
Permission Group
↓
Role
↓
Department
↓
User

A user may have multiple roles, but only permissions assigned through those roles are granted.

# 3. Permission Actions

Every module supports one or more of:

- View
- Create
- Edit
- Delete
- Approve
- Reject
- Publish
- Configure
- Import
- Export
- Archive
- Restore
- Assign
- Manage

# 4. Permission Groups

Examples:

- Student Management
- Academics
- Attendance
- Admissions
- Finance
- HR
- Examination
- Library
- Transport
- Hostel
- Inventory
- Reports
- Settings
- User Management

# 5. Default Roles

- School Administrator
- Principal
- Vice Principal
- Academic Coordinator
- Teacher
- Accountant
- HR
- Admission Officer
- Receptionist
- Exam Controller
- Librarian
- Transport Manager
- Hostel Warden
- Parent
- Student

Schools may create additional custom roles.

# 6. School Administrator

CAN:
- Create users
- Create departments
- Create custom roles
- Assign permissions
- Configure modules
- View every dashboard
- Generate reports
- Broadcast announcements
- Monitor all departments
- Reset passwords
- Lock or disable accounts

CANNOT:
- Mark attendance
- Collect fees
- Verify admission documents
- Enter examination marks
- Issue library books
- Allocate hostel rooms
- Drive operational workflows belonging to departments

# 7. Teacher

CAN:
- Mark attendance
- Create homework
- Enter internal marks
- Communicate with assigned parents
- View assigned students

CANNOT:
- Access finance
- Change school settings
- View other teachers' private records
- Modify role permissions

# 8. Accountant

CAN:
- Collect fees
- Record payments
- Process refunds
- Generate receipts
- View finance reports

CANNOT:
- Manage attendance
- Admit students
- Change HR records

# 9. Permission Evaluation Flow

1. Authenticate user.
2. Resolve tenant.
3. Load active roles.
4. Merge permissions.
5. Evaluate requested action.
6. Allow or deny.
7. Record audit entry.

# 10. Role Management

School Administrators may:
- Create roles
- Duplicate roles
- Rename roles
- Activate/deactivate roles
- Assign permissions
- Assign users
- Review permission summaries

Deleting a role assigned to users is prohibited until reassignment.

# 11. Audit Requirements

Every permission change records:
- Actor
- Target role
- Permission added/removed
- Timestamp
- IP address
- Reason (optional)

# 12. Acceptance Criteria

- No UI action bypasses permissions.
- No API bypasses authorization middleware.
- Every authorization failure returns a standardized error.
- Every permission change is auditable.

## Next Chapter

Volume 1 — Chapter 6: Organization Structure (Departments, Users & Role Assignment)
