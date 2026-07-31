"""
Core entities for Arivon Phase 0.

Why these 4 tables first, and in this order:

- School:        the tenant. EVERYTHING else belongs to a school. This is
                  what makes Arivon multi-school from day one instead of
                  bolting it on later (which is painful and error-prone).
- AcademicYear:  schools operate in yearly cycles (2026-27, 2027-28...).
                  Almost every future feature (attendance, fees, exams,
                  promotions) will be scoped to "this school, this year."
- Role:          defines WHAT a user can do (Principal, Teacher, Accountant,
                  etc). Kept as its own table (not a hardcoded string) so
                  you can add new roles later without a code change.
- User:          WHO is logged in. Belongs to exactly one School and has
                  exactly one Role (for now — later a user could have
                  multiple roles, but let's not over-engineer yet).
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Date, UniqueConstraint, Index, Float
from sqlalchemy.orm import relationship
from app.database import Base


class School(Base):
    __tablename__ = "schools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    board_type = Column(String, nullable=False)  # CBSE / ICSE / State Board
    city = Column(String)
    state = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Platform-managed fields — set/changed only by Platform Super Admin,
    # never by anyone inside the school itself.
    subscription_status = Column(String, default="trial")  # trial, active, suspended, cancelled
    subscription_plan = Column(String, default="basic")  # basic, pro, enterprise
    education_level = Column(String, default="high_school")  # "high_school" (Nursery-10) or "higher_secondary" (Nursery-12)
    support_access_enabled = Column(Boolean, default=False)

    # White-label branding — cosmetic, safe for platform admin to set on
    # the school's behalf.
    logo_url = Column(String, nullable=True)
    primary_color = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    address = Column(String, nullable=True)

    # ---------- 1. School Identity (additions) ----------
    short_name = Column(String, nullable=True)
    # URL-safe, unique per school — powers /{slug}/login and every
    # authenticated page under that school. Generated once at creation,
    # never changed (see app/core/slug_utils.py).
    slug = Column(String, unique=True, index=True, nullable=True)
    school_type = Column(String, nullable=True)  # see enums.SchoolType
    school_category = Column(String, nullable=True)  # see enums.SchoolCategory
    year_established = Column(Integer, nullable=True)
    motto = Column(String, nullable=True)

    # ---------- 2. Government Recognition & Affiliations ----------
    # `board_type` above is retained as-is (existing field, existing data) —
    # new registrations should populate it from enums.EducationBoard, but
    # the column itself stays a free String to avoid a breaking migration
    # and to preserve the PRD's explicit "Other" extensibility.
    state_board_name = Column(String, nullable=True)  # required only when board_type == state_board
    udise_code = Column(String, nullable=True)  # 11-digit government identifier
    affiliation_number = Column(String, nullable=True)
    affiliation_valid_from = Column(Date, nullable=True)
    affiliation_valid_to = Column(Date, nullable=True)
    recognition_number = Column(String, nullable=True)
    trust_registration_number = Column(String, nullable=True)
    pan_number = Column(String, nullable=True)
    gst_number = Column(String, nullable=True)

    # ---------- 3. Address & Contact (additions) ----------
    # `address`, `contact_email`, `contact_phone` above are the existing
    # general-purpose fields (already used as the primary contact trio).
    # These add the granularity the PRD calls for without duplicating them.
    address_line_2 = Column(String, nullable=True)
    pincode = Column(String, nullable=True)
    website_url = Column(String, nullable=True)
    google_maps_url = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # ---------- 5. Academic Configuration (additions) ----------
    # Academic Session start/end dates are NOT duplicated here — that's
    # already AcademicYear.start_date/end_date. These are the school's
    # standing daily-operation policies, distinct from a specific session.
    school_timing_start = Column(String, nullable=True)  # "08:00"
    school_timing_end = Column(String, nullable=True)  # "14:30"
    working_days = Column(String, nullable=True)  # comma-separated: "mon,tue,wed,thu,fri,sat"
    medium_of_instruction = Column(String, nullable=True)  # see enums.MediumOfInstruction
    grading_system = Column(String, nullable=True)  # see enums.GradingSystem
    attendance_min_percentage = Column(Integer, nullable=True)
    promotion_policy = Column(String, nullable=True)  # see enums.PromotionPolicy

    # ---------- 8. Branding (additions) ----------
    # `logo_url`, `primary_color` above already exist.
    banner_url = Column(String, nullable=True)
    secondary_color = Column(String, nullable=True)
    letterhead_url = Column(String, nullable=True)
    seal_url = Column(String, nullable=True)
    id_card_template = Column(String, nullable=True)  # template name/key, not a full Template entity yet
    report_card_template = Column(String, nullable=True)
    certificate_template = Column(String, nullable=True)

    # ---------- 9. Subscription & Plan (additions) ----------
    # `subscription_status`, `subscription_plan` above already exist.
    billing_cycle = Column(String, nullable=True)  # see enums.BillingCycle
    pricing_model = Column(String, nullable=True)  # see enums.PricingModel
    contract_start_date = Column(Date, nullable=True)
    contract_end_date = Column(Date, nullable=True)
    trial_ends_at = Column(Date, nullable=True)

    # ---------- School Lifecycle & Verification (PRD 3.1) ----------
    # This is now the single authoritative status field. `is_active`
    # above is retained for backward compatibility with existing code
    # that checks it, but should be treated as derived from this field
    # going forward (True only when lifecycle_status == "active").
    lifecycle_status = Column(String, default="draft", index=True)  # see enums.SchoolLifecycleStatus
    verified_by_platform_admin_id = Column(Integer, ForeignKey("platform_admins.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    rejection_reason = Column(String, nullable=True)

    # ---------- 6. Classes Offered (wizard draft state) ----------
    # Comma-separated stage keys, e.g. "primary,middle,secondary" — matches
    # the existing `working_days` pattern (comma-separated String) rather
    # than introducing a new join table for what is fundamentally a small,
    # fixed-vocabulary multi-select.
    selected_stages = Column(String, nullable=True)

    # ---------- 4. Management Details (wizard draft state) ----------
    trust_name = Column(String, nullable=True)
    chairman_name = Column(String, nullable=True)
    managing_director_name = Column(String, nullable=True)
    # The School Admin's intended login — name/email only. The PASSWORD is
    # deliberately never stored here; it's collected fresh at the final
    # "Create School" step and hashed straight into the User row, so a
    # plaintext or even hashed password never sits in a draft record.
    pending_admin_full_name = Column(String, nullable=True)
    pending_admin_email = Column(String, nullable=True)

    academic_years = relationship("AcademicYear", back_populates="school")
    users = relationship("User", back_populates="school")
    organization_settings = relationship(
        "SchoolOrganizationSettings", back_populates="school", uselist=False
    )
    infrastructure = relationship(
        "SchoolInfrastructure", back_populates="school", uselist=False
    )
    departments = relationship("Department", back_populates="school")


class AcademicYear(Base):
    __tablename__ = "academic_years"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    label = Column(String, nullable=False)  # e.g. "2026-2027"
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_current = Column(Boolean, default=False)  # only one should be True per school

    school = relationship("School", back_populates="academic_years")


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)  # e.g. "principal", "teacher"
    description = Column(String)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)

    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    school = relationship("School", back_populates="users")
    role = relationship("Role")

    @property
    def role_name(self) -> str | None:
        return self.role.name if self.role else None

    @property
    def school_name(self) -> str | None:
        return self.school.name if self.school else None

    @property
    def school_logo_url(self) -> str | None:
        return self.school.logo_url if self.school else None

    @property
    def school_primary_color(self) -> str | None:
        return self.school.primary_color if self.school else None

    @property
    def school_secondary_color(self) -> str | None:
        return self.school.secondary_color if self.school else None


class SchoolClass(Base):
    """
    Named SchoolClass (not "Class") because `class` is a reserved word in
    Python. This represents a grade, e.g. "Grade 5" or "Class X".
    """
    __tablename__ = "school_classes"
    __table_args__ = (
        # Prevents the exact bug found in the Sections tab: duplicate
        # class rows (e.g. two "Class 11" rows) within the same academic
        # year, which happened because nothing ever stopped provisioning
        # from running more than once for the same year.
        UniqueConstraint("academic_year_id", "name", name="uq_class_year_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"), nullable=False)
    name = Column(String, nullable=False)  # e.g. "Grade 5", "Class X"
    order_index = Column(Integer, default=0)  # for sorting Nursery < Grade 1 < Grade 2...
    stage = Column(String, nullable=True)  # "pre_primary", "primary", "middle", "secondary", "higher_secondary"

    sections = relationship("Section", back_populates="school_class")


class Section(Base):
    """
    A section is a specific classroom within a grade, e.g. "5-A", "5-B".
    This is what a student is actually enrolled into day to day.
    """
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True)
    school_class_id = Column(Integer, ForeignKey("school_classes.id"), nullable=False)
    name = Column(String, nullable=False)  # e.g. "A", "B"
    capacity = Column(Integer, default=40)
    class_teacher_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    school_class = relationship("SchoolClass", back_populates="sections")
    students = relationship("Student", back_populates="section")


class StaffProfile(Base):
    """
    Extended HR/compliance data for a staff member, kept SEPARATE from the
    User table on purpose: User is about "who can log in and what can they
    do" (auth concerns). StaffProfile is about "who this person actually
    is for HR/government reporting" (employee ID, bank details, Aadhaar).
    Mixing these makes the auth table bloated and the compliance data
    harder to reason about independently.
    """
    __tablename__ = "staff_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    employee_id = Column(String, unique=True, nullable=True)
    designation = Column(String, nullable=True)  # e.g. "PGT Mathematics"
    department = Column(String, nullable=True)  # e.g. "Academics", "Administration", "Transport"
    qualification = Column(String, nullable=True)
    experience_years = Column(Integer, nullable=True)
    date_of_joining = Column(Date, nullable=True)
    phone = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)

    emergency_contact_name = Column(String, nullable=True)
    emergency_contact_phone = Column(String, nullable=True)
    emergency_contact_relation = Column(String, nullable=True)

    # Government-reporting fields — collected once, reused everywhere later
    # (UDISE+, SATS, payroll compliance) instead of re-entered per form.
    aadhaar_number = Column(String, nullable=True)
    pan_number = Column(String, nullable=True)
    bank_account_holder_name = Column(String, nullable=True)
    bank_account_number = Column(String, nullable=True)
    bank_ifsc = Column(String, nullable=True)

    user = relationship("User")


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True)
    guardian_id = Column(Integer, ForeignKey("guardians.id"), nullable=True)
    house_id = Column(Integer, ForeignKey("houses.id"), nullable=True)

    admission_number = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    date_of_birth = Column(Date, nullable=False)
    gender = Column(String, nullable=True)
    blood_group = Column(String, nullable=True)

    guardian_name = Column(String, nullable=False)
    guardian_phone = Column(String, nullable=False)
    guardian_email = Column(String, nullable=True)
    father_name = Column(String, nullable=True)
    mother_name = Column(String, nullable=True)
    address = Column(String, nullable=True)

    # Government-reporting fields (UDISE+, SATS, scholarship eligibility) —
    # captured at admission time so nobody has to chase this down later.
    aadhaar_number = Column(String, nullable=True)
    category = Column(String, nullable=True)  # General / OBC / SC / ST / EWS
    is_rte = Column(Boolean, default=False)  # Right to Education Act fee exemption eligibility
    religion = Column(String, nullable=True)
    nationality = Column(String, nullable=True, default="Indian")
    mother_tongue = Column(String, nullable=True)
    previous_school = Column(String, nullable=True)

    # Profile & wellbeing — deliberately basic (a note field, not a
    # medical records system). Photo used on ID cards and the directory.
    photo_url = Column(String, nullable=True)
    medical_notes = Column(String, nullable=True)  # allergies, conditions — free text, front-office visibility only

    # Transport — a route+stop pair is enough for a school running its
    # own buses; a full Transport module (vehicles, drivers, fee linkage)
    # is a separate, larger feature for later.
    bus_route_id = Column(Integer, ForeignKey("bus_routes.id"), nullable=True)
    bus_stop_id = Column(Integer, ForeignKey("bus_stops.id"), nullable=True)

    # Bank details — used for scholarship disbursement and fee refunds.
    bank_account_holder_name = Column(String, nullable=True)
    bank_account_number = Column(String, nullable=True)
    bank_ifsc = Column(String, nullable=True)

    is_active = Column(Boolean, default=True)
    date_of_leaving = Column(Date, nullable=True)
    leaving_reason = Column(String, nullable=True)
    tc_number = Column(String, nullable=True)  # set when a TC is generated, never reused
    created_at = Column(DateTime, default=datetime.utcnow)

    section = relationship("Section", back_populates="students")
    guardian = relationship("Guardian", back_populates="students")


class AttendanceRecord(Base):
    """
    One row = one student's status for one date, optionally scoped to
    one period. period_number=0 means whole-day attendance (the
    original, still-default behavior — most schools only do this).
    A school that wants period-wise tracking marks with a real period
    number instead; the same student can then have multiple rows for
    one date, one per period. 0 is used instead of NULL as the "whole
    day" sentinel specifically because SQL unique constraints treat
    NULL values as distinct from each other, which would have let
    multiple whole-day rows exist for the same student+date — a real
    row of zeros is comparable and keeps the one-record-per-day
    guarantee intact for every school that never touches this feature.
    """
    __tablename__ = "attendance_records"
    __table_args__ = (
        UniqueConstraint("student_id", "date", "period_number", name="uq_student_date_period"),
    )

    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    date = Column(Date, nullable=False)
    period_number = Column(Integer, nullable=False, default=0)
    status = Column(String, nullable=False)  # "present", "absent", "late", "excused"
    marked_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student")


class StaffAttendanceRecord(Base):
    """
    Mirrors AttendanceRecord (student attendance), but for staff — this
    parallel structure is what lets the Principal Dashboard show "X of Y
    teachers present today" using the same query pattern as students.
    """
    __tablename__ = "staff_attendance_records"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_user_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(String, nullable=False)  # "present", "absent", "late", "leave"
    marked_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])


class FeeStructure(Base):
    """
    A fee definition for a class, e.g. "Grade 5 Tuition Fee, ₹5000/month".
    Invoices are generated FROM a fee structure for individual students —
    the structure defines the rule, the invoice is the actual instance
    of that rule applied to one student in one billing period.
    """
    __tablename__ = "fee_structures"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"), nullable=False)
    school_class_id = Column(Integer, ForeignKey("school_classes.id"), nullable=True)  # null = applies to all classes
    bus_route_id = Column(Integer, ForeignKey("bus_routes.id"), nullable=True)  # set only for fee_type="Transport" fees that vary by route distance; null = a flat transport fee or a non-transport fee type

    fee_type = Column(String, nullable=False)  # "Tuition", "Transport", "Lab", etc.
    amount = Column(Integer, nullable=False)  # stored in whole rupees, not paise
    frequency = Column(String, nullable=False)  # "monthly", "quarterly", "annual", "one_time"

    # Late fee — deliberately a flat amount past a grace period, not a
    # per-day accrual. Computed LIVE against today's date wherever an
    # invoice is displayed, never stored, so it can't go stale the way a
    # once-calculated number would the moment "today" moves forward.
    late_fee_amount = Column(Integer, nullable=False, default=0)
    late_fee_grace_days = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)


class StudentFeeInvoice(Base):
    """
    One billing instance for one student — e.g. "Rahul's July tuition,
    due July 10, ₹5000". amount_paid is updated as payments come in;
    status is derived and stored for fast filtering ("show me all overdue").
    """
    __tablename__ = "student_fee_invoices"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    fee_structure_id = Column(Integer, ForeignKey("fee_structures.id"), nullable=False)

    billing_period = Column(String, nullable=False)  # e.g. "July 2026"
    due_date = Column(Date, nullable=False)
    amount_due = Column(Integer, nullable=False)  # already net of any concession applied at generation time
    amount_paid = Column(Integer, default=0)
    status = Column(String, nullable=False, default="pending")  # pending, partial, paid, overdue
    concession_id = Column(Integer, ForeignKey("fee_concessions.id"), nullable=True)
    concession_amount = Column(Integer, nullable=False, default=0)  # the rupee amount actually deducted, kept alongside amount_due for a transparent receipt/audit trail

    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student")
    fee_structure = relationship("FeeStructure")
    payments = relationship("FeePayment", back_populates="invoice")


class FeePayment(Base):
    """
    One payment against one invoice. An invoice can have multiple partial
    payments — this is why amount_paid on the invoice is a running total,
    not just a copy of the last payment.
    """
    __tablename__ = "fee_payments"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("student_fee_invoices.id"), nullable=False)

    receipt_number = Column(String, nullable=True, unique=True)  # set at creation, never reused — the number printed on the PDF receipt
    amount = Column(Integer, nullable=False)
    payment_date = Column(Date, nullable=False)
    payment_method = Column(String, nullable=False)  # "cash", "upi", "bank_transfer", "cheque", "dd"
    received_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    notes = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    invoice = relationship("StudentFeeInvoice", back_populates="payments")


class House(Base):
    """
    School Houses (e.g. Red/Blue/Green/Yellow) — used for inter-house
    competitions, sports day, and discipline/merit points. A student's
    house assignment lives on Student.house_id.
    """
    __tablename__ = "houses"
    __table_args__ = (
        UniqueConstraint("school_id", "name", name="uq_school_house_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    name = Column(String, nullable=False)
    color = Column(String, nullable=True)  # e.g. "#DC2626" or "Red"
    slogan = Column(String, nullable=True)  # e.g. "Courage. Honor. Victory."
    created_at = Column(DateTime, default=datetime.utcnow)


class Announcement(Base):
    """
    School-wide notice board — now also class- and section-targetable.
    school_class_id and section_id are both nullable; leaving both null
    means school-wide (the original, still-default behavior), setting
    school_class_id only means every section of that class, and setting
    both means one specific section. Anyone at the school can READ
    announcements meant for them (filtering happens in the query, not
    by hiding the endpoint), but only Principal/Vice Principal/
    Administrator can POST one — same "who can act vs who can view"
    split we've used everywhere else.
    """
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(String, nullable=False)
    category = Column(String, nullable=False, default="administrative")  # "academic", "administrative", "event", "holiday", "exam"
    school_class_id = Column(Integer, ForeignKey("school_classes.id"), nullable=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    created_by = relationship("User")


class SchoolEvent(Base):
    """
    A single-day scheduled event — assembly, parent meeting, exhibition,
    staff meeting. Deliberately separate from TimetableSlot: timetable
    entries recur every week and describe regular classes; events are
    one-off (or at least not tied to the weekly class schedule) and are
    what the Dashboard's "Today's Schedule" widget actually needs.
    """
    __tablename__ = "school_events"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    title = Column(String, nullable=False)
    event_date = Column(Date, nullable=False)
    event_time = Column(String, nullable=True)  # "09:00", free text so "All day" works too
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Guardian(Base):
    """
    A parent/guardian as its own entity — NOT just text fields on Student.
    This is what makes "Parent Management" a real feature: siblings can
    share one Guardian record, and Admissions can search/reuse an existing
    parent instead of re-typing their details for every child.
    """
    __tablename__ = "guardians"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    full_name = Column(String, nullable=False)
    relation = Column(String, nullable=True)  # "father", "mother", "guardian"
    phone = Column(String, nullable=False)
    alternate_phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    occupation = Column(String, nullable=True)
    annual_income = Column(Integer, nullable=True)  # for RTE/scholarship eligibility checks
    address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    students = relationship("Student", back_populates="guardian")


class AdmissionApplication(Base):
    """
    The Admissions workflow — deliberately SEPARATE from the Student table.
    A Student row means "this child is enrolled here." An
    AdmissionApplication row means "someone is in the process of applying,"
    which might end in enrollment, rejection, or withdrawal. Converting one
    into the other is an explicit action (see /admissions/applications/{id}/enroll),
    not an automatic side effect.
    """
    __tablename__ = "admission_applications"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"), nullable=False)
    applying_for_class_id = Column(Integer, ForeignKey("school_classes.id"), nullable=False)

    applicant_name = Column(String, nullable=False)
    date_of_birth = Column(Date, nullable=False)
    gender = Column(String, nullable=True)
    previous_school = Column(String, nullable=True)

    guardian_id = Column(Integer, ForeignKey("guardians.id"), nullable=False)

    status = Column(String, nullable=False, default="inquiry")
    # inquiry -> submitted -> under_review -> offer_sent -> enrolled
    #                                                    -> rejected / withdrawn
    notes = Column(String, nullable=True)
    reviewed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    enrolled_student_id = Column(Integer, ForeignKey("students.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    guardian = relationship("Guardian")
    applying_for_class = relationship("SchoolClass")


class Document(Base):
    """
    Polymorphic-ish document storage: entity_type + entity_id together
    identify what this document belongs to (a student, an admission
    application, a staff member) without needing a separate documents
    table per entity type. Files are stored on local disk under
    /uploads for now — swap to S3/cloud storage before production.
    """
    __tablename__ = "documents"
    __table_args__ = (
        # Composite index — every document lookup filters on BOTH
        # columns together (e.g. "school" + school_id, "student" +
        # student_id), never entity_type alone. Added during the
        # production readiness review; this table had no indexes on its
        # most heavily-filtered columns at all.
        Index("ix_documents_entity_type_entity_id", "entity_type", "entity_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    entity_type = Column(String, nullable=False)  # "student", "admission_application", "staff", "school"
    entity_id = Column(Integer, nullable=False)
    document_type = Column(String, nullable=False)  # "birth_certificate", "photo", "affiliation_certificate", etc. — see enums.ComplianceDocumentType for school-level suggested values
    original_filename = Column(String, nullable=False)
    stored_filename = Column(String, nullable=False)  # UUID-based name on disk, avoids collisions
    uploaded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    # ---------- Compliance & expiry tracking (PRD 3.3) ----------
    # Nullable because most existing document types (birth certificates,
    # photos) never expire — only relevant for compliance-category docs.
    issue_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True, index=True)
    # Two separate verifier fields on purpose: verified_by_user_id covers
    # a school staff member verifying a STUDENT/STAFF document (e.g. a
    # front-office check of a birth certificate); verified_by_platform_admin_id
    # covers a Platform Admin verifying a SCHOOL compliance document during
    # the verification review workflow. Different actor types, different
    # FK targets (users vs platform_admins) — one column can't serve both.
    verified_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    verified_by_platform_admin_id = Column(Integer, ForeignKey("platform_admins.id"), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    reminder_60_day_sent = Column(Boolean, default=False)
    reminder_30_day_sent = Column(Boolean, default=False)
    reminder_7_day_sent = Column(Boolean, default=False)


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    name = Column(String, nullable=False)  # "Mathematics", "English"
    code = Column(String, nullable=True)  # "MATH101"
    is_active = Column(Boolean, default=True)


class ClassSubject(Base):
    """Which subjects are taught in which class, and by whom (optional)."""
    __tablename__ = "class_subjects"
    __table_args__ = (
        UniqueConstraint("school_class_id", "subject_id", name="uq_class_subject"),
    )

    id = Column(Integer, primary_key=True, index=True)
    school_class_id = Column(Integer, ForeignKey("school_classes.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    subject = relationship("Subject")


class TimetableSlot(Base):
    """
    One period, one day, one section. e.g. "Section 5-A, Monday, Period 1,
    09:00-09:45, Mathematics, taught by Anita Sharma."
    """
    __tablename__ = "timetable_slots"
    __table_args__ = (
        UniqueConstraint("section_id", "day_of_week", "period_number", name="uq_section_day_period"),
    )

    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    day_of_week = Column(Integer, nullable=False)  # 0=Monday .. 6=Sunday
    period_number = Column(Integer, nullable=False)
    start_time = Column(String, nullable=False)  # "09:00"
    end_time = Column(String, nullable=False)  # "09:45"
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    subject = relationship("Subject")
    section = relationship("Section")


# =========================================================================
# PLATFORM LAYER — everything below this line belongs to Arivon itself,
# not to any single school. PlatformAdmin is a deliberately SEPARATE table
# from User: a platform admin has no school_id, no Role FK into the
# school's role system, and authenticates through a completely different
# endpoint (/platform/auth/login). This mirrors how Stripe or Shopify keep
# their internal ops console structurally separate from the merchant
# dashboard — it's not "a role with more permissions," it's a different
# application surface entirely.
# =========================================================================

class PlatformAdmin(Base):
    __tablename__ = "platform_admins"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class FeatureFlag(Base):
    """
    Per-school feature toggles — e.g. a school on the "basic" plan might
    not have the Finance module enabled until they upgrade. Modeled as
    rows (not a JSON blob on School) so flags are individually queryable
    and it's trivial to add new feature keys later without a migration.
    """
    __tablename__ = "feature_flags"
    __table_args__ = (
        UniqueConstraint("school_id", "feature_key", name="uq_school_feature"),
    )

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    feature_key = Column(String, nullable=False)  # e.g. "finance", "admissions", "academics"
    is_enabled = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuditLog(Base):
    """
    Records platform-admin actions specifically (school suspended, plan
    changed, feature toggled, etc.) — this is what "View Logs" in the
    Platform Super Admin feature list actually means: an accountability
    trail for the Arivon team's own actions on schools, not a full
    request/response logger (which would be a much bigger, separate
    piece of infrastructure).
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    platform_admin_id = Column(Integer, ForeignKey("platform_admins.id"), nullable=False)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=True)
    action = Column(String, nullable=False)  # "school_created", "school_suspended", etc.
    details = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SchoolOrganizationSettings(Base):
    """
    Locale/formatting configuration (PRD 3.2). One-to-one with School,
    kept as its own table rather than more columns on School because
    this is a distinct configuration concern the school can revisit
    independently in Settings, not part of the school's core identity.
    """
    __tablename__ = "school_organization_settings"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False, unique=True)

    timezone = Column(String, default="Asia/Kolkata")
    currency = Column(String, default="INR")
    primary_language = Column(String, default="english")
    date_format = Column(String, default="DD-MM-YYYY")
    number_format = Column(String, default="indian")  # "indian" (1,00,000) vs "international" (100,000)
    week_start_day = Column(String, default="monday")
    fiscal_year_start_month = Column(Integer, default=4)  # April, matching Indian financial year norms

    school = relationship("School", back_populates="organization_settings")


class SchoolInfrastructure(Base):
    """
    Optional physical-capacity snapshot (PRD Step 7). One-to-one with
    School, entirely optional — a school with no row here simply hasn't
    filled this in, which is expected and fine.
    """
    __tablename__ = "school_infrastructure"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False, unique=True)

    campus_area = Column(String, nullable=True)  # free text: "5 acres", "20,000 sq ft"
    number_of_classrooms = Column(Integer, nullable=True)
    number_of_labs = Column(Integer, nullable=True)
    has_library = Column(Boolean, default=False)
    sports_facilities = Column(String, nullable=True)  # "indoor", "outdoor", "both", "none"
    has_transport = Column(Boolean, default=False)
    has_hostel = Column(Boolean, default=False)
    has_medical_room = Column(Boolean, default=False)

    school = relationship("School", back_populates="infrastructure")


class Department(Base):
    """
    Organizational grouping for staff (PRD 3.4) — distinct from Role.
    A Role defines WHAT a user can do (teacher, accountant); a Department
    is WHICH organizational unit they belong to (Academics, Finance,
    Front Office). Auto-provisioned with standard defaults at school
    creation, editable/extensible afterward.
    """
    __tablename__ = "departments"
    __table_args__ = (
        UniqueConstraint("school_id", "name", name="uq_school_department_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    school = relationship("School", back_populates="departments")


class SchoolAuditLog(Base):
    """
    School-level audit trail (PRD 3.5) — parallel to PlatformAuditLog,
    but scoped to consequential actions taken INSIDE a school (fee
    waivers, marks edits, staff changes), not Platform Admin actions on
    the school itself. Selective by design — see enums.SchoolAuditActionType
    for what qualifies; routine reads and anything already covered by a
    more specific existing field (e.g. AttendanceRecord.marked_by_user_id)
    are deliberately NOT duplicated here.
    """
    __tablename__ = "school_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action_type = Column(String, nullable=False)  # see enums.SchoolAuditActionType
    entity_type = Column(String, nullable=True)  # e.g. "invoice", "student", "staff"
    entity_id = Column(Integer, nullable=True)
    before_snapshot = Column(String, nullable=True)  # JSON-serialized, nullable for creation events
    after_snapshot = Column(String, nullable=True)  # JSON-serialized
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class NotificationTemplate(Base):
    """
    In-app/WhatsApp/SMS notification templates, auto-provisioned when a
    school goes active. Makes message text configurable per school
    instead of hardcoded — e.g. app/core/notifications.py's absence
    alert currently builds its message inline; a future revision can
    read from here instead, without changing who calls it.
    """
    __tablename__ = "notification_templates"
    __table_args__ = (
        UniqueConstraint("school_id", "template_key", name="uq_school_notification_template"),
    )

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    template_key = Column(String, nullable=False)  # e.g. "attendance_absence_alert", "fee_reminder"
    channel = Column(String, nullable=False)  # "in_app", "whatsapp", "sms"
    subject = Column(String, nullable=True)
    body = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class EmailTemplate(Base):
    """
    Email templates, auto-provisioned alongside notification templates.
    No email-sending infrastructure exists yet (see
    ComplianceService.send_expiry_reminders' dry-run note) — these are
    configuration ready for when that's built, not wired to anything yet.
    """
    __tablename__ = "email_templates"
    __table_args__ = (
        UniqueConstraint("school_id", "template_key", name="uq_school_email_template"),
    )

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    template_key = Column(String, nullable=False)  # e.g. "welcome_email", "fee_receipt"
    subject = Column(String, nullable=False)
    body_html = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Holiday(Base):
    """Default national holidays, auto-provisioned for the school's first
    academic year — editable/extensible afterward, not a locked list."""
    __tablename__ = "holidays"
    __table_args__ = (
        UniqueConstraint("school_id", "academic_year_id", "date", name="uq_school_year_holiday_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"), nullable=False)
    name = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ParentComplaint(Base):
    """
    Lightweight complaint/grievance log — not a full ticketing system.
    A School Admin logs what a parent raised (phone call, in-person, a
    written note) and tracks whether it's been resolved. This is
    genuinely new; nothing like it existed before the Morning Briefing.
    """
    __tablename__ = "parent_complaints"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True)  # nullable — not every complaint is about one specific student
    guardian_name = Column(String, nullable=False)
    guardian_phone = Column(String, nullable=True)
    subject = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, nullable=False, default="open")  # "open", "resolved"
    logged_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    resolved_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolution_notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    student = relationship("Student")


class Substitution(Base):
    """
    Records that a substitute teacher covered a specific timetable slot
    on a specific date, when the originally-assigned teacher was absent.
    Deliberately keyed to a TimetableSlot (not just "teacher X, date Y")
    so it's period-specific — a teacher absent all day may have some
    periods covered and others not, and the Morning Briefing needs to
    know exactly which.
    """
    __tablename__ = "substitutions"
    __table_args__ = (
        UniqueConstraint("timetable_slot_id", "date", name="uq_slot_date_substitution"),
    )

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    date = Column(Date, nullable=False)
    timetable_slot_id = Column(Integer, ForeignKey("timetable_slots.id"), nullable=False)
    original_teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    substitute_teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    substitute_teacher = relationship("User", foreign_keys=[substitute_teacher_id])


class LeaveApplication(Base):
    """
    Deliberately no separate "leave balance" table — balance is always
    computed live as (annual quota - approved days used this leave
    year), from LEAVE_TYPE_ANNUAL_QUOTA in the leave router. A stored
    balance would need to be kept in sync on every approval/rejection/
    edit and could drift; computing it from the applications themselves
    is the single source of truth and can never go stale.
    """
    __tablename__ = "leave_applications"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    leave_type = Column(String, nullable=False)  # "CL", "EL", "ML"
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    reason = Column(String, nullable=True)
    status = Column(String, nullable=False, default="pending")  # "pending", "approved", "rejected"
    applied_at = Column(DateTime, default=datetime.utcnow)
    reviewed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(String, nullable=True)

    user = relationship("User", foreign_keys=[user_id])


class Homework(Base):
    """
    Deliberately basic — a title, description, and due date per
    subject+section, with per-student submission tracking. Not a full
    LMS: no file uploads, no grading, no rubrics. Just "was this
    assigned, and who's turned it in."
    """
    __tablename__ = "homework"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    due_date = Column(Date, nullable=False)
    assigned_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class HomeworkSubmission(Base):
    """
    One row per (homework, student) — created lazily the first time a
    teacher marks a student's status, rather than pre-populating every
    student in the section as "not submitted" at homework-creation time.
    A student with no row here is treated as not-submitted by default.
    """
    __tablename__ = "homework_submissions"
    __table_args__ = (
        UniqueConstraint("homework_id", "student_id", name="uq_homework_student"),
    )

    id = Column(Integer, primary_key=True, index=True)
    homework_id = Column(Integer, ForeignKey("homework.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    status = Column(String, nullable=False, default="submitted")  # marking a row = submitted
    marked_at = Column(DateTime, default=datetime.utcnow)
    marked_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)


class SyllabusChapter(Base):
    """
    Chapter-wise completion tracking per subject+class (not per
    section — the syllabus is the same across sections of one class).
    Teachers mark chapters complete as they teach them; this exists
    purely so an Admin can see completion % across every subject
    without asking each teacher individually — the actual reporting
    view is Admin-facing, but marking has to happen somewhere, and a
    teacher is the only one who genuinely knows what's been taught.
    """
    __tablename__ = "syllabus_chapters"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    school_class_id = Column(Integer, ForeignKey("school_classes.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    chapter_name = Column(String, nullable=False)
    order_index = Column(Integer, nullable=False, default=0)
    is_completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    completed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SchoolDayScheduleBlock(Base):
    """
    The school's standing daily rhythm — assembly, recess, lunch,
    closing — school-wide, not per-section. Distinct from TimetableSlot,
    which is "which subject, which teacher, for THIS section." This is
    "what does a normal day look like at all," shown as the anchor
    reference above the per-section timetable picker.
    """
    __tablename__ = "school_day_schedule_blocks"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    block_type = Column(String, nullable=False)  # "assembly", "period", "break", "lunch", "closing", "other"
    label = Column(String, nullable=False)  # "Morning Assembly", "Period 3", "Lunch Break"
    start_time = Column(String, nullable=False)  # "HH:MM", matches TimetableSlot's convention
    end_time = Column(String, nullable=False)
    order_index = Column(Integer, nullable=False, default=0)


class Exam(Base):
    """
    The exam event itself — "Unit Test 1", "Half Yearly", "Annual".
    exam_type decides how ExamMarks are interpreted: "marks_based" means
    raw numeric marks, "grade_based" means a direct grade with no
    underlying number at all (some schools grade primary classes this
    way with no marks ever entered). Totals, percentages, grades, and
    ranks are deliberately NOT stored anywhere — always computed live
    from ExamMarks in the results endpoint, the same reasoning as Leave
    balance: a stored derived number can drift, a computed one can't.
    """
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"), nullable=False)
    name = Column(String, nullable=False)  # "Unit Test 1", "Half Yearly", "Annual Exam"
    exam_type = Column(String, nullable=False, default="marks_based")  # "marks_based", "grade_based"
    status = Column(String, nullable=False, default="draft")  # "draft", "scheduled", "ongoing", "completed", "results_published"
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ExamSchedule(Base):
    """
    One row per (exam, class, subject) — the date/time/room/max-marks/
    passing-marks for that specific paper. A class's papers span
    multiple dates, so this is genuinely per-subject, not per-exam.
    """
    __tablename__ = "exam_schedules"
    __table_args__ = (
        UniqueConstraint("exam_id", "school_class_id", "subject_id", name="uq_exam_class_subject"),
    )

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    school_class_id = Column(Integer, ForeignKey("school_classes.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    exam_date = Column(Date, nullable=False)
    start_time = Column(String, nullable=False)
    end_time = Column(String, nullable=False)
    room = Column(String, nullable=True)
    max_marks = Column(Integer, nullable=False, default=100)
    passing_marks = Column(Integer, nullable=False, default=33)


class ExamMarks(Base):
    """
    One row per (exam_schedule, student) — the actual marks entered.
    is_locked prevents further edits once an Admin has verified them; a
    teacher who needs to fix a locked entry must go through
    MarksCorrectionRequest rather than editing directly, which is the
    entire point of the lock.
    """
    __tablename__ = "exam_marks"
    __table_args__ = (
        UniqueConstraint("exam_schedule_id", "student_id", name="uq_schedule_student"),
    )

    id = Column(Integer, primary_key=True, index=True)
    exam_schedule_id = Column(Integer, ForeignKey("exam_schedules.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    marks_obtained = Column(Integer, nullable=True)  # null until entered
    grade = Column(String, nullable=True)  # used directly when exam_type == "grade_based"
    is_absent = Column(Boolean, default=False)
    entered_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    entered_at = Column(DateTime, nullable=True)
    is_locked = Column(Boolean, default=False)
    locked_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    locked_at = Column(DateTime, nullable=True)


class MarksCorrectionRequest(Base):
    """
    The re-check workflow — a teacher requests a change to LOCKED marks
    (unlocked marks just get edited directly, no request needed). An
    Admin approves or rejects; approving is what actually applies the
    new marks value, so the audit trail (old value, requested value,
    who asked, who approved) survives even after the correction happens.
    """
    __tablename__ = "marks_correction_requests"

    id = Column(Integer, primary_key=True, index=True)
    exam_marks_id = Column(Integer, ForeignKey("exam_marks.id"), nullable=False)
    requested_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    old_marks = Column(Integer, nullable=True)
    requested_marks = Column(Integer, nullable=False)
    reason = Column(String, nullable=False)
    status = Column(String, nullable=False, default="pending")  # "pending", "approved", "rejected"
    requested_at = Column(DateTime, default=datetime.utcnow)
    reviewed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(String, nullable=True)


class ReportCardSignature(Base):
    """
    Physical parent-signature tracking — still paper-based in most tier
    2/3 schools per the plan. One row per (exam, student); the school
    just checks a box once the signed paper copy has been returned.
    """
    __tablename__ = "report_card_signatures"
    __table_args__ = (
        UniqueConstraint("exam_id", "student_id", name="uq_exam_student_signature"),
    )

    id = Column(Integer, primary_key=True, index=True)
    exam_id = Column(Integer, ForeignKey("exams.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    signed = Column(Boolean, default=False)
    signed_date = Column(Date, nullable=True)
    recorded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)


class FeeConcession(Base):
    """
    A named, reusable discount rule — "Sibling Discount 10%", "RTE Full
    Exemption", "SC/ST Concession 20%" — defined once per school, then
    applied to specific invoices at generation time. Kept as its own
    table (rather than baking percentages into FeeStructure directly)
    so the SAME concession can apply across many different fee types
    and classes without redefining it each time, and so every invoice
    that used it can be traced back to exactly which rule applied.
    """
    __tablename__ = "fee_concessions"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    name = Column(String, nullable=False)  # "Sibling Discount", "RTE Exemption", "SC/ST Concession"
    concession_type = Column(String, nullable=False)  # "sibling", "rte", "category", "custom"
    discount_type = Column(String, nullable=False)  # "percentage" or "flat"
    discount_value = Column(Integer, nullable=False)  # a % (0-100) or a flat rupee amount, per discount_type
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class FeeWaiverRequest(Base):
    """
    The approval workflow for a one-off waiver/discount on a SPECIFIC
    invoice — distinct from FeeConcession, which is a standing, reusable
    rule. A waiver is a case-by-case ask ("the family had a medical
    emergency, please reduce this term's fee by ₹2000") that needs a
    named approver, not a rule anyone could apply themselves.
    """
    __tablename__ = "fee_waiver_requests"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("student_fee_invoices.id"), nullable=False)
    requested_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    waiver_amount = Column(Integer, nullable=False)
    reason = Column(String, nullable=False)
    status = Column(String, nullable=False, default="pending")  # "pending", "approved", "rejected"
    requested_at = Column(DateTime, default=datetime.utcnow)
    reviewed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(String, nullable=True)


class BulkMessageLog(Base):
    """
    A record of every bulk WhatsApp send — fee reminders, exam schedule
    notices, PTM reminders, holiday notices, emergency broadcasts. Kept
    for audit ("did the fee reminder actually go out last month?") and
    so the UI can show send history, not just fire messages into the
    void with no record.
    """
    __tablename__ = "bulk_message_logs"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    message_type = Column(String, nullable=False)  # "fee_reminder", "exam_schedule", "ptm_reminder", "holiday", "emergency", "custom"
    target_scope = Column(String, nullable=False)  # "school", "class", "section"
    school_class_id = Column(Integer, ForeignKey("school_classes.id"), nullable=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True)
    message_content = Column(String, nullable=False)
    recipient_count = Column(Integer, nullable=False, default=0)
    sent_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    sent_at = Column(DateTime, default=datetime.utcnow)


class PTMSchedule(Base):
    """
    A Parent-Teacher Meeting slot — school-wide, class-wide, or one
    section, mirroring the same nullable school_class_id/section_id
    targeting pattern as Announcement.
    """
    __tablename__ = "ptm_schedules"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    title = Column(String, nullable=False)
    school_class_id = Column(Integer, ForeignKey("school_classes.id"), nullable=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True)
    ptm_date = Column(Date, nullable=False)
    start_time = Column(String, nullable=False)
    end_time = Column(String, nullable=False)
    venue = Column(String, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class PTMAttendance(Base):
    """
    One row per (PTM, student) — whether that student's parent actually
    showed up. Created lazily the first time someone marks it, same
    lazy-row pattern as Homework submissions — no need to pre-populate
    every student in scope the moment a PTM is scheduled.
    """
    __tablename__ = "ptm_attendance"
    __table_args__ = (
        UniqueConstraint("ptm_schedule_id", "student_id", name="uq_ptm_student"),
    )

    id = Column(Integer, primary_key=True, index=True)
    ptm_schedule_id = Column(Integer, ForeignKey("ptm_schedules.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    attended = Column(Boolean, default=False)
    notes = Column(String, nullable=True)
    marked_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)


class BusRoute(Base):
    """The bus itself — one route, one vehicle, one driver+conductor pair."""
    __tablename__ = "bus_routes"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    route_name = Column(String, nullable=False)  # "Route 1 - Sector 12"
    route_number = Column(String, nullable=True)
    vehicle_number = Column(String, nullable=True)  # license plate
    driver_name = Column(String, nullable=True)
    driver_phone = Column(String, nullable=True)
    conductor_name = Column(String, nullable=True)
    conductor_phone = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class BusStop(Base):
    """
    One stop along a route, in pickup order. stop_order drives the
    route-wise student list's display sequence, and lets a school see
    at a glance which stop is first/last on the morning run.
    """
    __tablename__ = "bus_stops"

    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("bus_routes.id"), nullable=False)
    stop_name = Column(String, nullable=False)
    stop_order = Column(Integer, nullable=False, default=0)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    pickup_time = Column(String, nullable=True)
    drop_time = Column(String, nullable=True)


class HousePosition(Base):
    """
    A leadership role within a house — House Captain, Vice Captain,
    Sports Captain, House Coordinator (a teacher), etc. position_title
    is free text rather than a fixed enum, since schools genuinely name
    these differently ("Head Boy/Girl" vs "Captain" vs "Prefect"). Held
    by EITHER a student OR a staff member, never both — a coordinator
    role is a teacher's job, a captaincy is a student's.
    """
    __tablename__ = "house_positions"

    id = Column(Integer, primary_key=True, index=True)
    house_id = Column(Integer, ForeignKey("houses.id"), nullable=False)
    position_title = Column(String, nullable=False)  # "House Captain", "House Coordinator", etc.
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True)
    staff_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    academic_year_id = Column(Integer, ForeignKey("academic_years.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AchievementRecord(Base):
    """
    A student's achievement — a competition win, a participation, a
    recognition — kept as its own record (not just a one-off PDF) so
    the school has a real history to draw on and can regenerate the
    certificate later without re-entering the details.
    """
    __tablename__ = "achievement_records"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    title = Column(String, nullable=False)  # "1st Prize - Inter-School Science Exhibition"
    event_name = Column(String, nullable=True)
    position = Column(String, nullable=True)  # "1st", "2nd", "Participation"
    achievement_date = Column(Date, nullable=False)
    description = Column(String, nullable=True)
    issued_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class SalaryPayment(Base):
    """
    One staff member's salary for one month — genuinely new module,
    nothing like this existed before. Kept as an actual payment record
    (not just a number) so there's a real paid/pending history per
    person per month, the same way fee payments work for students.
    """
    __tablename__ = "salary_payments"
    __table_args__ = (
        UniqueConstraint("staff_user_id", "month", "year", name="uq_staff_salary_month"),
    )

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    staff_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    month = Column(Integer, nullable=False)  # 1-12
    year = Column(Integer, nullable=False)
    basic_salary = Column(Integer, nullable=False)  # whole rupees
    allowances = Column(Integer, nullable=False, default=0)
    deductions = Column(Integer, nullable=False, default=0)
    net_salary = Column(Integer, nullable=False)  # basic + allowances - deductions, computed at creation
    payment_status = Column(String, nullable=False, default="pending")  # "pending", "paid"
    payment_date = Column(Date, nullable=True)
    paid_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
