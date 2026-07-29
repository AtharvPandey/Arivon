# Arivon Product Development Bible

# Volume 1 — Chapter 13
## Platform Settings & School Configuration

> This chapter defines the centralized configuration framework that allows each school to customize its ERP while maintaining tenant isolation and enterprise governance.

# 1. Objective

Provide a secure configuration center where School Administrators can manage school-wide settings without modifying application code.

# 2. Navigation

Administration
└── Settings
    ├── General Settings
    ├── School Profile
    ├── Academic Settings
    ├── Branding
    ├── Localization
    ├── Working Days & Calendar
    ├── Security Settings
    ├── Integration Settings
    ├── Feature Flags
    └── Configuration History

# 3. School Profile

Maintain:

- School Name
- School Logo
- Registration Number
- Board Affiliation (CBSE/ICSE/State/IB/etc.)
- Affiliation Number
- Address
- Contact Details
- Website
- Principal Information
- Academic Session

# 4. Branding

Configurable:

- Logo
- Favicon
- Theme Colors
- Login Screen Banner
- Report Header/Footer
- Email Branding

# 5. Localization

Support:

- Time Zone
- Date Format
- Language
- Currency
- Number Format

# 6. Academic Configuration

Configure:

- Academic Sessions
- Terms/Semesters
- Grading Systems
- Attendance Rules
- Working Days
- Holiday Calendar
- Promotion Rules

# 7. Security Configuration

School Administrator CAN:

- Configure password policy
- Configure session timeout
- Enable/disable MFA
- Configure login restrictions
- Define IP restrictions (optional)
- Configure audit retention

# 8. Integrations

Supported integrations:

- Email Provider
- SMS Gateway
- WhatsApp Business API
- Payment Gateway
- Google Workspace (Future)
- Microsoft 365 (Future)

# 9. Feature Flags

Enable or disable modules:

- Hostel
- Transport
- Inventory
- Library
- Payroll
- Visitor Management
- AI Features (Future)

# 10. Configuration History

Track:

- Changed By
- Changed On
- Previous Value
- New Value
- Reason (optional)

# 11. Restrictions

School Administrator CANNOT:

- Modify platform-wide defaults
- Access another school's configuration
- Delete immutable configuration history

# 12. Acceptance Criteria

- All settings are tenant-isolated.
- Configuration changes take effect safely.
- Every change is audited.
- Branding and academic settings are customizable per school.

## Next Chapter

Volume 1 — Chapter 14: File Storage, Documents & Digital Asset Management
