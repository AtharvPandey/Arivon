# Arivon Product Development Bible

# Volume 1 — Chapter 8
## User Management Workspace

> This chapter defines the complete User Management module available to the School Administrator.

# 1. Objective

Provide a centralized workspace to manage every employee account from onboarding to archival while enforcing RBAC and auditability.

# 2. Navigation

Administration
└── User Management
    ├── Dashboard
    ├── All Users
    ├── Invite User
    ├── Pending Invitations
    ├── Active Users
    ├── Suspended Users
    ├── Archived Users
    ├── Bulk Operations
    └── User Activity

# 3. Dashboard KPIs

- Total Users
- Active Users
- Pending Invitations
- Suspended Accounts
- Locked Accounts
- New Users This Month
- Recently Logged In
- Inactive >30 Days

# 4. User Profile

Every user contains:

- Profile Photo
- Full Name
- Employee ID
- Email
- Phone
- Department
- Primary Role
- Secondary Roles
- Reporting Manager
- Employment Status
- Joining Date
- Account Status
- Last Login
- MFA Status

# 5. School Administrator CAN

- Create users
- Invite users
- Edit user profiles
- Reset passwords
- Unlock accounts
- Suspend users
- Reactivate users
- Archive users
- Assign departments
- Assign roles
- Assign reporting managers
- Force logout active sessions
- Export user directory

# 6. School Administrator CANNOT

- View user passwords
- Access users from another school
- Modify Arivon Platform Administrators
- Bypass audit logging
- Delete immutable audit history

# 7. Bulk Operations

Supported:

- Import users (CSV/Excel)
- Export users
- Bulk activate
- Bulk suspend
- Bulk role assignment
- Bulk department transfer
- Bulk password reset invitation

All bulk actions require confirmation and generate audit records.

# 8. Search & Filters

Search by:

- Name
- Employee ID
- Email

Filter by:

- Department
- Role
- Status
- Joining Date
- Reporting Manager

# 9. Notifications

Automatically notify users when:

- Account created
- Invitation sent
- Password reset
- Role changed
- Department changed
- Account suspended
- Account reactivated

# 10. Audit Trail

Every user action records:

- Actor
- Target User
- Action
- Before Value
- After Value
- Timestamp
- Device
- IP Address

# 11. Acceptance Criteria

- Every user belongs to one school.
- Every user has at least one active role.
- Every profile update is audited.
- User lifecycle is fully traceable.

## Next Chapter

Volume 1 — Chapter 9: Department Management Workspace
