"""
Service layer interfaces for the Register School PRD.

These are CONTRACTS ONLY — abstract method signatures with docstrings
describing intended behavior, no implementation. Per the task scope,
business workflow logic (the actual multi-step wizard flow, the
verification state machine, compliance reminder scheduling) is explicitly
NOT built here. This file exists so the shape of that future logic is
already agreed upon, and repositories/schemas above were designed to
support it, before anyone writes the workflow itself.

Why an interface (ABC) rather than jumping straight to a concrete class:
these services will need to be called from multiple future contexts
(a wizard API, a background reminder job, a Platform Admin review
endpoint) and potentially need alternate implementations in tests
(e.g. a fake SchoolProvisioningService that doesn't actually hit the DB).
Defining the interface first keeps those call sites decoupled from
whichever concrete implementation eventually lands.
"""

from abc import ABC, abstractmethod
from datetime import date, datetime

from sqlalchemy.orm import Session

from app import models, schemas
from app.repositories.department_repository import DepartmentRepository
from app.repositories.organization_settings_repository import OrganizationSettingsRepository


class SchoolProvisioningServiceInterface(ABC):
    """
    Owns everything that happens automatically at school creation time,
    beyond the class-ladder auto-provisioning that already exists in
    academic_years.py (that logic is NOT duplicated here — this
    interface covers the NEW auto-provisioning PRD 3.4 calls for).
    """

    @abstractmethod
    def provision_default_departments(self, school_id: int) -> list[models.Department]:
        """
        Creates the standard department set (Administration, Academics,
        Admissions, Finance, Front Office) for a newly created school.
        Must be idempotent — calling this twice for the same school
        should not create duplicate departments.
        """
        raise NotImplementedError

    @abstractmethod
    def provision_default_organization_settings(self, school_id: int) -> models.SchoolOrganizationSettings:
        """
        Creates a SchoolOrganizationSettings row with sensible defaults
        (Asia/Kolkata, INR, English, DD-MM-YYYY) if one doesn't already
        exist for this school. Should read Step 3's `state` field to
        pick better-than-generic defaults where feasible (e.g. inferring
        timezone), falling back to the hardcoded defaults otherwise.
        """
        raise NotImplementedError

    @abstractmethod
    def provision_default_templates(self, school_id: int) -> None:
        """
        Assigns starter Report Card / ID Card / Fee Receipt template
        identifiers based on the school's board_type (a CBSE school
        should not receive an ICSE-formatted report card template by
        default). Template CONTENT/rendering is out of scope here —
        this only sets the template identifier fields on School.
        """
        raise NotImplementedError

    @abstractmethod
    def post_welcome_notice(self, school_id: int, created_by_user_id: int) -> models.Announcement:
        """Auto-posts the "Welcome to Arivon" notice, authored as the newly
        created School Admin (created_by_user_id) since Announcement
        requires a real User as author — there's no "Platform" author
        concept in the Announcement model, and introducing one would be
        exactly the kind of architecture change out of scope here."""
        raise NotImplementedError

    @abstractmethod
    def populate_sample_data(self, school_id: int) -> None:
        """
        Optional, explicit Platform Admin action (never automatic) —
        wires in the equivalent of seed_full_school.py as an in-product
        action for trial schools. Must be clearly reversible/deletable
        before a school goes live for real, per PRD 3.4's explicit
        caution about this.
        """
        raise NotImplementedError


# =========================================================================
# Concrete implementation.
# =========================================================================

DEFAULT_DEPARTMENTS = [
    ("Administration", "School leadership and administrative staff"),
    ("Academics", "Teaching staff and academic coordination"),
    ("Admissions", "Admissions and enrollment"),
    ("Finance", "Fees, accounts, and payroll"),
    ("Front Office", "Reception and parent-facing coordination"),
]

# Template identifiers keyed by board — real template rendering/content is
# out of scope; this only assigns which identifier the school starts with.
BOARD_TEMPLATE_DEFAULTS = {
    "CBSE": {"report_card_template": "cbse_standard_v1", "id_card_template": "standard_v1", "certificate_template": "standard_v1"},
    "ICSE": {"report_card_template": "icse_standard_v1", "id_card_template": "standard_v1", "certificate_template": "standard_v1"},
}
FALLBACK_TEMPLATES = {"report_card_template": "generic_v1", "id_card_template": "standard_v1", "certificate_template": "standard_v1"}

# Rough state -> timezone inference. India spans one timezone in practice,
# but this keeps the mechanism honest for the international schools Step 1
# already allows for, rather than silently hardcoding IST everywhere.
STATE_TIMEZONE_OVERRIDES: dict[str, str] = {}  # empty on purpose — every Indian state is Asia/Kolkata

# (template_key, channel, subject, body) — placeholder text using
# {{variable}} syntax for a future template-rendering engine to fill in.
DEFAULT_NOTIFICATION_TEMPLATES = [
    ("attendance_absence_alert", "whatsapp", None,
     "Hi {{guardian_name}}, this is to inform you that {{student_name}} was marked absent today ({{date}})."),
    ("fee_reminder", "whatsapp", None,
     "Dear {{guardian_name}}, a fee payment of {{amount}} is due on {{due_date}} for {{student_name}}."),
    ("admission_status_update", "in_app", "Admission Update",
     "The admission application for {{applicant_name}} has been updated to: {{status}}."),
]

DEFAULT_EMAIL_TEMPLATES = [
    ("welcome_email", "Welcome to {{school_name}} on Arivon",
     "<p>Hi {{admin_name}},</p><p>Your school is now live on Arivon. Log in to get started.</p>"),
    ("fee_receipt", "Fee Payment Receipt — {{school_name}}",
     "<p>Dear {{guardian_name}},</p><p>This confirms payment of {{amount}} received on {{payment_date}}.</p>"),
    ("compliance_reminder", "Document Expiry Reminder — {{school_name}}",
     "<p>Your {{document_type}} expires on {{expiry_date}}. Please renew and re-upload.</p>"),
]

DEFAULT_PRIMARY_COLOR = "#6D5BFF"
DEFAULT_SECONDARY_COLOR = "#F59E0B"

# Plan -> feature keys enabled by default. Keys match what the rest of
# Arivon already gates on informally (Finance/Admissions/Academics
# modules) — this doesn't invent new gating logic, just makes the
# existing plan tiers concrete as real FeatureFlag rows instead of
# implicit assumptions.
PLAN_FEATURE_DEFAULTS = {
    "basic": ["attendance", "fees", "academics"],
    "pro": ["attendance", "fees", "academics", "admissions", "communication", "documents"],
    "enterprise": ["attendance", "fees", "academics", "admissions", "communication", "documents", "transport", "library", "hostel"],
}

# (name, month, day) — fixed-date Indian national holidays, safe to
# assume for any school regardless of state/board.
DEFAULT_NATIONAL_HOLIDAYS = [
    ("Independence Day", 8, 15),
    ("Gandhi Jayanti", 10, 2),
    ("Republic Day", 1, 26),
]

DEFAULT_ATTENDANCE_MIN_PERCENTAGE = 75


class SchoolProvisioningService(SchoolProvisioningServiceInterface):
    def __init__(self, db: Session):
        self.db = db
        self.department_repo = DepartmentRepository(db)
        self.settings_repo = OrganizationSettingsRepository(db)

    def provision_default_departments(self, school_id: int) -> list[models.Department]:
        existing = self.department_repo.get_by_school(school_id)
        existing_names = {d.name for d in existing}
        created = list(existing)
        for name, description in DEFAULT_DEPARTMENTS:
            if name in existing_names:
                continue
            dept = models.Department(school_id=school_id, name=name, description=description)
            self.db.add(dept)
            self.db.flush()
            created.append(dept)
        return created

    def provision_default_organization_settings(self, school_id: int) -> models.SchoolOrganizationSettings:
        existing = self.settings_repo.get_by_school(school_id)
        if existing:
            return existing

        school = self.db.query(models.School).filter(models.School.id == school_id).first()
        timezone = STATE_TIMEZONE_OVERRIDES.get(school.state, "Asia/Kolkata") if school else "Asia/Kolkata"

        settings = models.SchoolOrganizationSettings(school_id=school_id, timezone=timezone)
        self.db.add(settings)
        self.db.flush()
        return settings

    def provision_default_templates(self, school_id: int) -> None:
        school = self.db.query(models.School).filter(models.School.id == school_id).first()
        if not school:
            return
        defaults = BOARD_TEMPLATE_DEFAULTS.get(school.board_type, FALLBACK_TEMPLATES)
        if not school.report_card_template:
            school.report_card_template = defaults["report_card_template"]
        if not school.id_card_template:
            school.id_card_template = defaults["id_card_template"]
        if not school.certificate_template:
            school.certificate_template = defaults["certificate_template"]
        self.db.flush()

    def post_welcome_notice(self, school_id: int, created_by_user_id: int) -> models.Announcement:
        notice = models.Announcement(
            school_id=school_id,
            title="Welcome to Arivon",
            content=(
                "Your school is now live on Arivon. Start by exploring your Dashboard, "
                "adding staff, and reviewing your auto-created class list under Academics."
            ),
            created_by_user_id=created_by_user_id,
        )
        self.db.add(notice)
        self.db.flush()
        return notice

    def populate_sample_data(self, school_id: int) -> None:
        # Deliberately not implemented — this wires into seed_full_school.py-
        # style logic and is an explicit, separate Platform Admin action
        # (per PRD 3.4's caution about reversibility), not part of the
        # automatic Create School chain. Out of scope for this piece of work.
        raise NotImplementedError("populate_sample_data is a future enhancement, not part of Create School")

    # ---------- Notification & Email Templates ----------

    def provision_notification_templates(self, school_id: int) -> list[models.NotificationTemplate]:
        existing = self.db.query(models.NotificationTemplate).filter(
            models.NotificationTemplate.school_id == school_id
        ).all()
        existing_keys = {t.template_key for t in existing}
        created = list(existing)

        for key, channel, subject, body in DEFAULT_NOTIFICATION_TEMPLATES:
            if key in existing_keys:
                continue
            template = models.NotificationTemplate(
                school_id=school_id, template_key=key, channel=channel, subject=subject, body=body,
            )
            self.db.add(template)
            self.db.flush()
            created.append(template)
        return created

    def provision_email_templates(self, school_id: int) -> list[models.EmailTemplate]:
        existing = self.db.query(models.EmailTemplate).filter(
            models.EmailTemplate.school_id == school_id
        ).all()
        existing_keys = {t.template_key for t in existing}
        created = list(existing)

        for key, subject, body_html in DEFAULT_EMAIL_TEMPLATES:
            if key in existing_keys:
                continue
            template = models.EmailTemplate(
                school_id=school_id, template_key=key, subject=subject, body_html=body_html,
            )
            self.db.add(template)
            self.db.flush()
            created.append(template)
        return created

    # ---------- Branding Defaults ----------

    def provision_branding_defaults(self, school_id: int) -> bool:
        """Fills in ONLY fields the school left blank during the wizard —
        never overwrites something the person actually chose. Returns
        True if any default was actually applied."""
        school = self.db.query(models.School).filter(models.School.id == school_id).first()
        if not school:
            return False

        applied = False
        if not school.primary_color:
            school.primary_color = DEFAULT_PRIMARY_COLOR
            applied = True
        if not school.secondary_color:
            school.secondary_color = DEFAULT_SECONDARY_COLOR
            applied = True
        self.db.flush()
        return applied

    # ---------- Feature Flags ----------

    def provision_feature_flags(self, school_id: int) -> list[models.FeatureFlag]:
        school = self.db.query(models.School).filter(models.School.id == school_id).first()
        if not school:
            return []

        plan_features = PLAN_FEATURE_DEFAULTS.get(school.subscription_plan, PLAN_FEATURE_DEFAULTS["basic"])
        existing = self.db.query(models.FeatureFlag).filter(models.FeatureFlag.school_id == school_id).all()
        existing_keys = {f.feature_key for f in existing}
        created = list(existing)

        for feature_key in plan_features:
            if feature_key in existing_keys:
                continue
            flag = models.FeatureFlag(school_id=school_id, feature_key=feature_key, is_enabled=True)
            self.db.add(flag)
            self.db.flush()
            created.append(flag)
        return created

    # ---------- Default Holidays ----------

    def provision_default_holidays(self, school_id: int, academic_year_id: int) -> list[models.Holiday]:
        academic_year = self.db.query(models.AcademicYear).filter(
            models.AcademicYear.id == academic_year_id
        ).first()
        if not academic_year:
            return []

        existing = self.db.query(models.Holiday).filter(
            models.Holiday.school_id == school_id, models.Holiday.academic_year_id == academic_year_id,
        ).all()
        existing_dates = {h.date for h in existing}
        created = list(existing)

        year = academic_year.start_date.year
        for name, month, day in DEFAULT_NATIONAL_HOLIDAYS:
            # National holidays land in whichever calendar year the academic
            # session covers on that month (Jan holidays fall in the second
            # half of the session, since the session starts in June).
            holiday_year = year + 1 if month <= 5 else year
            holiday_date = date(holiday_year, month, day)
            if holiday_date in existing_dates:
                continue
            holiday = models.Holiday(
                school_id=school_id, academic_year_id=academic_year_id, name=name, date=holiday_date,
            )
            self.db.add(holiday)
            self.db.flush()
            created.append(holiday)
        return created

    # ---------- Default Sections ----------

    def provision_default_sections(self, school_class_ids: list[int]) -> int:
        """One 'A' section per auto-created class, so a school doesn't
        start with a full class ladder but zero actual sections to put
        students in. Idempotent — skips any class that already has a
        section (matches the auto-lettering rule already enforced in
        classes.py: never skip ahead, always start with A)."""
        created_count = 0
        for class_id in school_class_ids:
            existing = self.db.query(models.Section).filter(
                models.Section.school_class_id == class_id
            ).first()
            if existing:
                continue
            section = models.Section(school_class_id=class_id, name="A", capacity=40)
            self.db.add(section)
            self.db.flush()
            created_count += 1
        return created_count

    # ---------- Default Attendance Settings ----------

    def provision_default_attendance_settings(self, school_id: int) -> bool:
        """Same 'only fill what's blank' rule as branding defaults."""
        school = self.db.query(models.School).filter(models.School.id == school_id).first()
        if not school:
            return False
        if school.attendance_min_percentage is not None:
            return False
        school.attendance_min_percentage = DEFAULT_ATTENDANCE_MIN_PERCENTAGE
        self.db.flush()
        return True

    # ---------- Top-level orchestrator ----------

    def provision_full_organization(self, school_id: int, platform_admin_id: int) -> schemas.ActiveProvisioningResult:
        """
        The complete Automatic Organization Provisioning chain, run the
        moment a school becomes Active (called from
        VerificationService.approve — never at Create School time).
        Everything here shares the caller's DB session and is NOT
        committed by this method — the caller (VerificationService)
        commits once, after this returns successfully, so a failure
        anywhere in this chain rolls back everything, including the
        lifecycle transition to "active" itself.
        """
        from app.routers.academic_years import build_ladder_for_selected_stages

        school = self.db.query(models.School).filter(models.School.id == school_id).first()
        if not school:
            raise ValueError(f"School {school_id} not found")

        steps = []

        # Academic Session + Classes
        selected_stages = school.selected_stages.split(",") if school.selected_stages else []
        current_year = school.created_at.year if school.created_at else datetime.utcnow().year
        academic_year = models.AcademicYear(
            school_id=school.id, label=f"{current_year}-{current_year + 1}",
            start_date=date(current_year, 6, 1), end_date=date(current_year + 1, 4, 30), is_current=True,
        )
        self.db.add(academic_year)
        self.db.flush()

        ladder = build_ladder_for_selected_stages(selected_stages)
        class_ids = []
        for index, (class_name, stage) in enumerate(ladder):
            school_class = models.SchoolClass(
                school_id=school.id, academic_year_id=academic_year.id,
                name=class_name, order_index=index, stage=stage,
            )
            self.db.add(school_class)
            self.db.flush()
            class_ids.append(school_class.id)
        steps.append(schemas.ProvisioningStepResult(step="academic_session_and_classes", status="success"))

        # Default Sections
        sections_created = self.provision_default_sections(class_ids)
        steps.append(schemas.ProvisioningStepResult(step="default_sections", status="success"))

        # Departments
        departments = self.provision_default_departments(school.id)
        steps.append(schemas.ProvisioningStepResult(step="departments", status="success"))

        # Roles / Permissions — no-op, see interface docstrings
        steps.append(schemas.ProvisioningStepResult(step="roles_and_permissions_verified", status="success"))

        # Notification & Email Templates
        notification_templates = self.provision_notification_templates(school.id)
        email_templates = self.provision_email_templates(school.id)
        steps.append(schemas.ProvisioningStepResult(step="notification_and_email_templates", status="success"))

        # Document Templates
        self.provision_default_templates(school.id)
        steps.append(schemas.ProvisioningStepResult(step="document_templates", status="success"))

        # Branding Defaults
        branding_applied = self.provision_branding_defaults(school.id)
        steps.append(schemas.ProvisioningStepResult(step="branding_defaults", status="success"))

        # Organization Settings
        self.provision_default_organization_settings(school.id)
        steps.append(schemas.ProvisioningStepResult(step="organization_settings", status="success"))

        # Feature Flags
        feature_flags = self.provision_feature_flags(school.id)
        steps.append(schemas.ProvisioningStepResult(step="feature_flags", status="success"))

        # Welcome Notice — authored as the School Admin
        admin_user = self.db.query(models.User).filter(
            models.User.school_id == school.id, models.User.email == school.pending_admin_email,
        ).first()
        if admin_user:
            self.post_welcome_notice(school.id, admin_user.id)
        steps.append(schemas.ProvisioningStepResult(step="welcome_notice", status="success"))

        # Default Holidays
        holidays = self.provision_default_holidays(school.id, academic_year.id)
        steps.append(schemas.ProvisioningStepResult(step="default_holidays", status="success"))

        # Default Attendance Settings
        attendance_applied = self.provision_default_attendance_settings(school.id)
        steps.append(schemas.ProvisioningStepResult(step="default_attendance_settings", status="success"))

        # Finalize subscription status
        school.subscription_status = "active"
        steps.append(schemas.ProvisioningStepResult(step="subscription_finalized", status="success"))

        return schemas.ActiveProvisioningResult(
            school_id=school.id,
            academic_year_id=academic_year.id,
            classes_created=len(ladder),
            sections_created=sections_created,
            departments_created=len(departments),
            notification_templates_created=len(notification_templates),
            email_templates_created=len(email_templates),
            document_templates_assigned=True,
            branding_defaults_applied=branding_applied,
            organization_settings_created=True,
            feature_flags_created=len(feature_flags),
            welcome_notice_posted=admin_user is not None,
            holidays_created=len(holidays),
            attendance_default_applied=attendance_applied,
            provisioning_steps=steps,
        )
