# Arivon Product Development Bible

# Volume 1 — Chapter 3
## School Registration & Tenant Onboarding

> This chapter defines the complete lifecycle of onboarding a new school into Arivon.

# 1. Objective

The onboarding process provisions a fully configured school tenant with all required system resources. It must be automated, secure, auditable, and idempotent.

# 2. Actors

## Arivon Platform Administrator
CAN:
- Register a new school
- Approve onboarding
- Suspend onboarding
- Retry failed provisioning

CANNOT:
- Access school business data without explicit platform permissions.

## School Administrator
Receives the first account after provisioning and becomes the highest authority inside that tenant.

# 3. Registration Workflow

1. Platform Admin starts registration.
2. Enter organization details.
3. Validate registration data.
4. Generate tenant.
5. Provision default data.
6. Create School Administrator.
7. Send activation email.
8. Activate tenant.
9. First login wizard.
10. School goes live.

# 4. Registration Information

## School Details
- School Name
- Short Name
- Logo
- Motto
- Board
- Affiliation Number
- Government Registration Number
- UDISE (optional)
- Established Year

## Contact
- Email
- Phone
- Website

## Address
- Country
- State
- City
- Postal Code
- Address Line

## Academic
- Academic Session
- Timezone
- Working Days
- Weekly Off
- Default Language
- Currency

# 5. Automatic Provisioning

The system automatically creates:

- School record
- Academic Session
- School Administrator
- Departments
- Default Roles
- Permission Matrix
- Notification Templates
- Dashboard Configuration
- Audit Settings
- Branding Configuration
- Initial System Settings

# 6. First Login Wizard

The School Administrator must complete:

- Change password
- Verify email
- Upload logo
- Configure school timings
- Create classes
- Review default roles

# 7. Validation Rules

Required:
- Unique school name
- Unique admin email
- Valid affiliation number (if applicable)
- Valid academic session dates

# 8. Failure Recovery

If provisioning fails:
- Roll back incomplete resources
- Record audit event
- Notify platform administrator
- Allow safe retry

# 9. Audit Events

Log:
- Registration requested
- Tenant created
- Provisioning completed
- Activation completed
- First login completed

# 10. Acceptance Criteria

A newly registered school must be production-ready immediately after onboarding without manual database changes.

## Next Chapter

Volume 1 — Chapter 4: Authentication, Identity & Session Management
