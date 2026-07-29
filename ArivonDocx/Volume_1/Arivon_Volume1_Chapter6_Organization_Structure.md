# Arivon Product Development Bible

# Volume 1 — Chapter 6
## Organization Structure (Departments, Users & Role Assignment)

> This chapter defines how a school's organizational hierarchy is represented inside Arivon.

# 1. Objective

Provide a flexible organizational model where every school can create its own departments, roles and reporting hierarchy without changing application code.

# 2. Organization Hierarchy

Arivon Platform
↓
School
↓
Academic Session
↓
Departments
↓
Roles
↓
Users

Business records are always owned by a user acting within a department.

# 3. Departments

Default departments:

- Administration
- Academics
- Admissions
- Examination
- Finance
- Human Resources
- Library
- Transport
- Hostel
- Reception
- Inventory
- IT Support

School Administrator may:
- Create departments
- Rename departments
- Disable unused departments
- Assign department heads

Cannot delete a department containing active users.

# 4. Department Head

Every department may have one designated head.

CAN:
- View department dashboard
- Review department reports
- Assign work
- Approve department workflows (where configured)

CANNOT:
- Manage unrelated departments
- Change platform settings
- Modify global permissions

# 5. Users

Each user profile contains:

- Employee ID / Student ID
- Full Name
- Photo
- Email
- Phone
- Department
- Primary Role
- Secondary Roles (optional)
- Reporting Manager
- Employment Status
- Joining Date

# 6. User Lifecycle

Draft
↓
Invited
↓
Active
↓
Suspended
↓
Archived

Every transition is audited.

# 7. Role Assignment

Rules:

- Every user has one primary role.
- Users may have additional roles.
- Effective permissions are the union of assigned roles.
- Denied permissions cannot be bypassed.

# 8. Reporting Structure

Examples:

Principal
├── Vice Principal
├── Academic Coordinator
├── HR Head
├── Finance Head

Academic Coordinator
├── Class Teachers
└── Subject Teachers

Reporting structure is configurable.

# 9. School Administrator

CAN:
- Invite users
- Activate users
- Suspend users
- Archive users
- Change reporting managers
- Transfer departments
- Assign or remove roles

CANNOT:
- Impersonate users
- View passwords
- Modify Arivon platform administrators

# 10. Bulk Operations

Supported:

- Bulk user import
- Bulk department assignment
- Bulk role assignment
- Bulk account activation
- Bulk account suspension

Every bulk operation generates an audit record.

# 11. Notifications

Notify users when:

- Account created
- Role changed
- Department changed
- Reporting manager changed
- Account suspended
- Account reactivated

# 12. Acceptance Criteria

- Every user belongs to exactly one school.
- Every user has at least one role.
- Department hierarchy is configurable.
- Organization changes never affect other schools.
- Every change is fully auditable.

## Next Chapter

Volume 1 — Chapter 7: School Administrator Workspace & Dashboard
