"""
Pydantic schemas: define the shape of data going IN and OUT of the API.

Rule of thumb: models.py = what's in the database.
              schemas.py = what the outside world is allowed to see/send.
This is why UserOut below has no password field, even though the User
model does — we never want a password hash going out in an API response.
"""

import re
from datetime import date, datetime
from pydantic import BaseModel, EmailStr, field_validator


# ---------- School ----------

class SchoolCreate(BaseModel):
    name: str
    board_type: str
    city: str | None = None
    state: str | None = None


class SchoolOut(BaseModel):
    id: int
    name: str
    board_type: str
    city: str | None
    state: str | None
    is_active: bool
    education_level: str
    contact_email: str | None = None
    contact_phone: str | None = None
    address: str | None = None

    logo_url: str | None = None
    primary_color: str | None = None

    short_name: str | None = None
    slug: str | None = None
    school_type: str | None = None
    school_category: str | None = None
    year_established: int | None = None
    motto: str | None = None

    state_board_name: str | None = None
    udise_code: str | None = None
    affiliation_number: str | None = None
    affiliation_valid_from: date | None = None
    affiliation_valid_to: date | None = None
    recognition_number: str | None = None
    trust_registration_number: str | None = None
    pan_number: str | None = None
    gst_number: str | None = None

    address_line_2: str | None = None
    pincode: str | None = None
    website_url: str | None = None
    google_maps_url: str | None = None
    latitude: float | None = None
    longitude: float | None = None

    school_timing_start: str | None = None
    school_timing_end: str | None = None
    working_days: str | None = None
    medium_of_instruction: str | None = None
    grading_system: str | None = None
    attendance_min_percentage: int | None = None
    promotion_policy: str | None = None

    trust_name: str | None = None
    chairman_name: str | None = None
    managing_director_name: str | None = None

    class Config:
        from_attributes = True  # lets Pydantic read data straight off SQLAlchemy objects


class SchoolUpdate(BaseModel):
    name: str | None = None
    board_type: str | None = None
    city: str | None = None
    state: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    address: str | None = None

    primary_color: str | None = None

    short_name: str | None = None
    school_type: str | None = None
    school_category: str | None = None
    year_established: int | None = None
    motto: str | None = None

    state_board_name: str | None = None
    udise_code: str | None = None
    affiliation_number: str | None = None
    affiliation_valid_from: date | None = None
    affiliation_valid_to: date | None = None
    recognition_number: str | None = None
    trust_registration_number: str | None = None
    pan_number: str | None = None
    gst_number: str | None = None

    address_line_2: str | None = None
    pincode: str | None = None
    website_url: str | None = None
    google_maps_url: str | None = None
    latitude: float | None = None
    longitude: float | None = None

    school_timing_start: str | None = None
    school_timing_end: str | None = None
    working_days: str | None = None
    medium_of_instruction: str | None = None
    grading_system: str | None = None
    attendance_min_percentage: int | None = None
    promotion_policy: str | None = None

    trust_name: str | None = None
    chairman_name: str | None = None
    managing_director_name: str | None = None


class RoleOut(BaseModel):
    id: int
    name: str
    description: str | None

    class Config:
        from_attributes = True


class StaffMemberOut(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role_name: str | None
    is_active: bool
    employee_id: str | None
    designation: str | None
    department: str | None
    photo_url: str | None


# ---------- Academic Year ----------

class AcademicYearCreate(BaseModel):
    school_id: int
    label: str
    start_date: date
    end_date: date
    is_current: bool = False


class AcademicYearOut(BaseModel):
    id: int
    school_id: int
    label: str
    start_date: date
    end_date: date
    is_current: bool

    class Config:
        from_attributes = True


class AcademicYearUpdate(BaseModel):
    label: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_current: bool | None = None


class AcademicYearStatsOut(BaseModel):
    academic_year_id: int
    label: str
    is_current: bool
    total_classes: int
    total_sections: int
    total_students: int
    total_staff: int
    total_fee_collected: int
    total_fee_billed: int


# ---------- Auth / User ----------

class UserRegister(BaseModel):
    role_name: str  # e.g. "principal", "teacher" — looked up against Role table
    full_name: str
    email: EmailStr
    # No password field — the system generates a temporary one. A
    # human-chosen "temporary" password tends to be weak in exactly the
    # scenario where it matters most, before the real holder has set
    # their own.


class UserOut(BaseModel):
    id: int
    school_id: int
    full_name: str
    email: EmailStr
    is_active: bool
    role_name: str | None = None
    school_name: str | None = None
    school_logo_url: str | None = None
    school_primary_color: str | None = None
    school_secondary_color: str | None = None
    must_change_password: bool = False

    class Config:
        from_attributes = True


class UserCreatedOut(BaseModel):
    """
    Returned once, right after creating a staff account — the only
    place the plaintext temporary password ever appears, since it's
    never stored or retrievable again after this. The frontend shows it
    once for the admin to copy/share, then it's gone.
    """
    user: UserOut
    temporary_password: str
    temp_password_expires_at: datetime
    login_url_path: str  # e.g. "/{slug}/login" — frontend prepends its own origin


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ---------- School Class & Section ----------

class SchoolClassCreate(BaseModel):
    school_id: int
    academic_year_id: int
    name: str
    order_index: int = 0


class SchoolClassOut(BaseModel):
    id: int
    school_id: int
    academic_year_id: int
    name: str
    order_index: int
    stage: str | None

    class Config:
        from_attributes = True


class SectionCreate(BaseModel):
    """
    No `name` field on purpose — section letters (A, B, C...) are assigned
    automatically in strict sequence by the server. Letting a client
    supply an arbitrary name is exactly how you end up with a school that
    has sections A and D but no B or C.
    """
    school_class_id: int
    capacity: int = 40
    class_teacher_id: int | None = None


class SectionUpdate(BaseModel):
    """Both fields optional — the piece that was missing: capacity and
    class_teacher_id could only ever be set once, at section creation."""
    capacity: int | None = None
    class_teacher_id: int | None = None


class SectionOut(BaseModel):
    id: int
    school_class_id: int
    name: str
    capacity: int
    class_teacher_id: int | None

    class Config:
        from_attributes = True


# ---------- Student ----------

class StudentUpdate(BaseModel):
    """
    Every field optional — a genuine partial update. This is the piece
    that was entirely missing before: there was no way to edit a
    student's profile at all after creation (correct a DOB typo, add a
    medical note discovered later, assign a transport route, update
    guardian income for a scholarship review, upload a photo). Bank
    details and admission_number are deliberately excluded — those go
    through their own dedicated, more controlled flows.
    """
    section_id: int | None = None
    house_id: int | None = None
    guardian_id: int | None = None
    full_name: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    blood_group: str | None = None
    guardian_name: str | None = None
    guardian_phone: str | None = None
    guardian_email: EmailStr | None = None
    father_name: str | None = None
    mother_name: str | None = None
    address: str | None = None
    aadhaar_number: str | None = None
    category: str | None = None
    religion: str | None = None
    nationality: str | None = None
    mother_tongue: str | None = None
    previous_school: str | None = None
    medical_notes: str | None = None
    bus_route_id: int | None = None
    bus_stop_id: int | None = None


class StudentCreate(BaseModel):
    school_id: int
    academic_year_id: int
    section_id: int | None = None
    house_id: int | None = None
    admission_number: str | None = None  # None = auto-generate sequentially
    full_name: str
    date_of_birth: date
    gender: str | None = None
    blood_group: str | None = None
    guardian_name: str
    guardian_phone: str
    guardian_email: EmailStr | None = None
    father_name: str | None = None
    mother_name: str | None = None
    guardian_id: int | None = None
    address: str | None = None
    aadhaar_number: str | None = None
    category: str | None = None
    religion: str | None = None
    nationality: str | None = "Indian"
    mother_tongue: str | None = None
    previous_school: str | None = None
    photo_url: str | None = None
    medical_notes: str | None = None
    bus_route_id: int | None = None
    bus_stop_id: int | None = None
    bank_account_holder_name: str | None = None
    bank_account_number: str | None = None
    bank_ifsc: str | None = None


class StudentOut(BaseModel):
    id: int
    school_id: int
    academic_year_id: int
    section_id: int | None
    house_id: int | None
    guardian_id: int | None
    admission_number: str
    full_name: str
    date_of_birth: date
    gender: str | None
    blood_group: str | None
    guardian_name: str
    guardian_phone: str
    guardian_email: EmailStr | None
    father_name: str | None
    mother_name: str | None
    category: str | None
    religion: str | None
    nationality: str | None
    mother_tongue: str | None
    photo_url: str | None
    medical_notes: str | None
    bus_route_id: int | None
    bus_stop_id: int | None
    bus_route_name: str | None = None
    bus_stop_name: str | None = None
    is_active: bool

    class Config:
        from_attributes = True


# ---------- Staff Profile ----------

class StaffProfileCreate(BaseModel):
    user_id: int
    employee_id: str | None = None
    designation: str | None = None
    department: str | None = None
    qualification: str | None = None
    experience_years: int | None = None
    date_of_joining: date | None = None
    phone: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    emergency_contact_relation: str | None = None
    aadhaar_number: str | None = None
    pan_number: str | None = None
    bank_account_holder_name: str | None = None
    bank_account_number: str | None = None
    bank_ifsc: str | None = None


class StaffProfileUpdate(BaseModel):
    """Every field optional — same partial-update pattern as StudentUpdate."""
    designation: str | None = None
    department: str | None = None
    qualification: str | None = None
    experience_years: int | None = None
    date_of_joining: date | None = None
    phone: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    emergency_contact_relation: str | None = None
    aadhaar_number: str | None = None
    pan_number: str | None = None
    bank_account_holder_name: str | None = None
    bank_account_number: str | None = None
    bank_ifsc: str | None = None


class StaffProfileOut(BaseModel):
    id: int
    user_id: int
    employee_id: str | None
    designation: str | None
    department: str | None
    qualification: str | None
    experience_years: int | None
    date_of_joining: date | None
    phone: str | None
    photo_url: str | None
    emergency_contact_name: str | None
    emergency_contact_phone: str | None
    emergency_contact_relation: str | None

    class Config:
        from_attributes = True


class StaffBankDetails(BaseModel):
    """
    Deliberately its own schema/endpoint, same pattern as students' bank
    details — Aadhaar/PAN/bank account numbers stay behind a
    Finance-or-self-only view, never bundled into the general staff
    profile every viewer sees.
    """
    aadhaar_number: str | None
    pan_number: str | None
    bank_account_holder_name: str | None
    bank_account_number: str | None
    bank_ifsc: str | None

    class Config:
        from_attributes = True


# ---------- Attendance ----------

class AttendanceEntry(BaseModel):
    """One student's status within a bulk mark-attendance request."""
    student_id: int
    status: str  # "present", "absent", "late", "excused"


class AttendanceMarkRequest(BaseModel):
    section_id: int
    date: date
    period_number: int = 0  # 0 = whole-day (the default every school starts with); a real period number opts into period-wise tracking
    entries: list[AttendanceEntry]


class AttendanceOut(BaseModel):
    id: int
    section_id: int
    student_id: int
    date: date
    period_number: int
    status: str
    marked_by_user_id: int

    class Config:
        from_attributes = True


# ---------- Staff Attendance ----------

class StaffAttendanceEntry(BaseModel):
    user_id: int
    status: str  # "present", "absent", "late", "leave"


class StaffAttendanceMarkRequest(BaseModel):
    school_id: int
    date: date
    entries: list[StaffAttendanceEntry]


class StaffAttendanceOut(BaseModel):
    id: int
    user_id: int
    date: date
    status: str
    marked_by_user_id: int

    class Config:
        from_attributes = True


# ---------- Dashboard ----------

class DashboardSummary(BaseModel):
    date: date
    total_students: int
    students_present: int
    students_absent: int
    students_late: int
    students_excused: int
    students_unmarked: int
    total_staff: int
    staff_present: int
    staff_absent: int
    staff_late: int
    staff_unmarked: int
    total_classes: int
    total_sections: int


# ---------- Houses ----------

class HouseCreate(BaseModel):
    school_id: int
    name: str
    color: str | None = None
    slogan: str | None = None


class HouseUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    slogan: str | None = None


class HouseOut(BaseModel):
    id: int
    school_id: int
    name: str
    color: str | None
    slogan: str | None
    student_count: int = 0

    class Config:
        from_attributes = True


# ---------- Fees ----------

class FeeStructureCreate(BaseModel):
    school_id: int
    academic_year_id: int
    school_class_id: int | None = None
    fee_type: str
    amount: int
    frequency: str  # "monthly", "quarterly", "annual", "one_time"
    late_fee_amount: int = 0
    late_fee_grace_days: int = 0


class FeeStructureOut(BaseModel):
    id: int
    school_id: int
    academic_year_id: int
    school_class_id: int | None
    fee_type: str
    amount: int
    frequency: str
    late_fee_amount: int
    late_fee_grace_days: int

    class Config:
        from_attributes = True


class GenerateInvoicesRequest(BaseModel):
    fee_structure_ids: list[int]
    billing_period: str
    due_date: date
    concession_id: int | None = None  # applied to every generated invoice, e.g. a sibling discount known at enrollment time


class InvoiceCreate(BaseModel):
    student_id: int
    fee_structure_id: int
    billing_period: str
    due_date: date
    amount_due: int
    concession_id: int | None = None
    concession_amount: int = 0


class InvoiceOut(BaseModel):
    id: int
    student_id: int
    student_name: str
    fee_structure_id: int
    fee_type: str
    billing_period: str
    due_date: date
    amount_due: int
    amount_paid: int
    status: str
    concession_id: int | None
    concession_amount: int
    late_fee_amount: int  # computed live — 0 if not yet past the grace period, non-zero the moment it is
    effective_total_due: int  # amount_due + late_fee_amount, the actual number a parent owes today
    balance: int  # effective_total_due - amount_paid

    class Config:
        from_attributes = True


class PaymentCreate(BaseModel):
    invoice_id: int
    amount: int
    payment_date: date
    payment_method: str  # "cash", "upi", "bank_transfer", "cheque", "dd"
    notes: str | None = None


class PaymentOut(BaseModel):
    id: int
    invoice_id: int
    receipt_number: str | None
    amount: int
    payment_date: date
    payment_method: str
    received_by_user_id: int
    notes: str | None

    class Config:
        from_attributes = True


class StudentBankDetails(BaseModel):
    """Separate from StudentOut on purpose — bank details are sensitive
    and only Finance/Admin should ever retrieve them, not every role that
    can view the student list."""
    id: int
    full_name: str
    bank_account_holder_name: str | None
    bank_account_number: str | None
    bank_ifsc: str | None

    class Config:
        from_attributes = True


# ---------- Announcements ----------

class AnnouncementCreate(BaseModel):
    school_id: int
    title: str
    content: str
    category: str = "administrative"  # "academic", "administrative", "event", "holiday", "exam"
    school_class_id: int | None = None
    section_id: int | None = None


class AnnouncementOut(BaseModel):
    id: int
    school_id: int
    title: str
    content: str
    category: str
    school_class_id: int | None
    section_id: int | None
    class_name: str | None = None
    section_name: str | None = None
    created_by_user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Student detail (for Principal drill-down view) ----------

class StudentDetail(BaseModel):
    """
    Fuller student record for the Principal's "select a student, see
    everything" drill-down view. Deliberately excludes bank details —
    those stay Finance-only regardless of who's viewing a student.
    """
    id: int
    school_id: int
    academic_year_id: int
    section_id: int | None
    house_id: int | None
    guardian_id: int | None
    admission_number: str
    full_name: str
    date_of_birth: date
    gender: str | None
    blood_group: str | None
    guardian_name: str
    guardian_phone: str
    guardian_email: EmailStr | None
    father_name: str | None
    mother_name: str | None
    address: str | None
    aadhaar_number: str | None
    category: str | None
    religion: str | None
    nationality: str | None
    mother_tongue: str | None
    previous_school: str | None
    photo_url: str | None
    medical_notes: str | None
    bus_route_id: int | None
    bus_stop_id: int | None
    bus_route_name: str | None = None
    bus_stop_name: str | None = None
    is_active: bool

    class Config:
        from_attributes = True


# ---------- Guardians (Parent Management) ----------

class GuardianCreate(BaseModel):
    school_id: int
    full_name: str
    relation: str | None = None
    phone: str
    alternate_phone: str | None = None
    email: EmailStr | None = None
    occupation: str | None = None
    annual_income: int | None = None
    address: str | None = None


class GuardianOut(BaseModel):
    id: int
    school_id: int
    full_name: str
    relation: str | None
    phone: str
    alternate_phone: str | None
    email: EmailStr | None
    occupation: str | None
    annual_income: int | None
    address: str | None

    class Config:
        from_attributes = True


# ---------- Admissions ----------

class AdmissionApplicationCreate(BaseModel):
    school_id: int
    academic_year_id: int
    applying_for_class_id: int
    applicant_name: str
    date_of_birth: date
    gender: str | None = None
    previous_school: str | None = None
    guardian_id: int


class AdmissionStatusUpdate(BaseModel):
    status: str  # submitted, under_review, offer_sent, rejected, withdrawn
    notes: str | None = None


class AdmissionApplicationOut(BaseModel):
    id: int
    school_id: int
    academic_year_id: int
    applying_for_class_id: int
    applicant_name: str
    date_of_birth: date
    gender: str | None
    previous_school: str | None
    guardian_id: int
    status: str
    notes: str | None
    enrolled_student_id: int | None
    created_at: datetime

    class Config:
        from_attributes = True


class EnrollRequest(BaseModel):
    section_id: int | None = None
    admission_number: str | None = None  # None = auto-generate sequentially


# ---------- Documents ----------

class DocumentOut(BaseModel):
    id: int
    school_id: int
    entity_type: str
    entity_id: int
    document_type: str
    original_filename: str
    uploaded_by_user_id: int
    uploaded_at: datetime
    verified_by_user_id: int | None
    verified_at: datetime | None

    class Config:
        from_attributes = True


# ---------- Academics: Subjects & Timetable ----------

class SubjectCreate(BaseModel):
    school_id: int
    name: str
    code: str | None = None


class SubjectUpdate(BaseModel):
    name: str | None = None
    code: str | None = None


class SubjectOut(BaseModel):
    id: int
    school_id: int
    name: str
    code: str | None
    is_active: bool

    class Config:
        from_attributes = True


class ClassSubjectCreate(BaseModel):
    school_class_id: int
    subject_id: int
    teacher_id: int | None = None


class ClassSubjectOut(BaseModel):
    id: int
    school_class_id: int
    subject_id: int
    teacher_id: int | None
    subject: SubjectOut

    class Config:
        from_attributes = True


class TimetableSlotCreate(BaseModel):
    section_id: int
    day_of_week: int  # 0=Monday .. 6=Sunday
    period_number: int
    start_time: str
    end_time: str
    subject_id: int
    teacher_id: int | None = None


class TimetableSlotOut(BaseModel):
    id: int
    section_id: int
    day_of_week: int
    period_number: int
    start_time: str
    end_time: str
    subject_id: int
    teacher_id: int | None
    subject: SubjectOut

    class Config:
        from_attributes = True


class MyScheduleSlot(BaseModel):
    """Enriched slot for a teacher's own 'My Schedule' view — includes
    section/class names directly so the frontend doesn't need extra
    lookups just to show 'Grade 5 - A, Period 2, Mathematics'."""
    id: int
    day_of_week: int
    period_number: int
    start_time: str
    end_time: str
    section_id: int
    section_name: str
    school_class_name: str
    subject_name: str


class MySection(BaseModel):
    section_id: int
    section_name: str
    school_class_name: str
    student_count: int


# =========================================================================
# PLATFORM LAYER
# =========================================================================

class PlatformAdminOut(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    is_active: bool

    class Config:
        from_attributes = True


class SchoolRegisterRequest(BaseModel):
    """
    Registering a school also creates its first School Admin login in the
    same request — a school with no way to log in isn't useful to anyone,
    so these are one atomic action rather than two separate steps.
    """
    name: str
    board_type: str
    city: str | None = None
    state: str | None = None
    subscription_plan: str = "basic"
    education_level: str = "high_school"  # "high_school" (Nursery-10) or "higher_secondary" (Nursery-12)

    admin_full_name: str
    admin_email: EmailStr
    admin_password: str


class SchoolPlatformOut(BaseModel):
    id: int
    name: str
    board_type: str
    city: str | None
    state: str | None
    is_active: bool
    education_level: str
    subscription_status: str
    subscription_plan: str
    support_access_enabled: bool
    logo_url: str | None
    primary_color: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class SubscriptionUpdate(BaseModel):
    subscription_status: str | None = None  # trial, active, suspended, cancelled
    subscription_plan: str | None = None  # basic, pro, enterprise


class BrandingUpdate(BaseModel):
    logo_url: str | None = None
    primary_color: str | None = None


class SupportAccessUpdate(BaseModel):
    support_access_enabled: bool


class FeatureFlagUpdate(BaseModel):
    feature_key: str
    is_enabled: bool


class FeatureFlagOut(BaseModel):
    id: int
    school_id: int
    feature_key: str
    is_enabled: bool

    class Config:
        from_attributes = True


class AuditLogOut(BaseModel):
    id: int
    platform_admin_id: int
    school_id: int | None
    action: str
    details: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class PlatformAnalytics(BaseModel):
    total_schools: int
    active_schools: int
    trial_schools: int
    suspended_schools: int
    total_students_platform_wide: int
    total_staff_platform_wide: int


class SupportOverview(BaseModel):
    """
    Deliberately limited, read-only diagnostic info — NOT full access to
    a school's operational data. This is what "support access" unlocks
    right now; full impersonation of a school's own screens is a bigger,
    separate feature with its own security design.
    """
    school_id: int
    school_name: str
    total_students: int
    total_staff: int
    total_classes: int
    subscription_status: str
    last_activity_note: str


# ---------- Events ----------

class SchoolEventCreate(BaseModel):
    school_id: int
    title: str
    event_date: date
    event_time: str | None = None


class SchoolEventOut(BaseModel):
    id: int
    school_id: int
    title: str
    event_date: date
    event_time: str | None
    created_by_user_id: int

    class Config:
        from_attributes = True


# ---------- Workbench Dashboard ----------

class NeedsAttentionItem(BaseModel):
    label: str
    count: int
    link: str


class ApprovalItem(BaseModel):
    label: str
    count: int
    available: bool  # False = module not built yet, shown as "coming soon"
    link: str | None = None


class ActivityItem(BaseModel):
    description: str
    timestamp: datetime


class GenderDistribution(BaseModel):
    male: int
    female: int
    other: int


class ClassStrengthItem(BaseModel):
    class_name: str
    student_count: int


class WorkbenchSummary(BaseModel):
    school_name: str
    academic_year_id: int | None
    academic_year_label: str | None
    total_students: int
    total_teachers: int
    total_staff: int
    admissions_pending: int
    fee_collected_today: int
    attendance_today_pct: float
    needs_attention: list[NeedsAttentionItem]
    school_health: dict
    recent_activity: list[ActivityItem]
    pending_approvals: list[ApprovalItem]
    gender_distribution: GenderDistribution
    class_wise_strength: list[ClassStrengthItem]
    fees_total_due: int
    fees_total_paid: int


# =========================================================================
# Register School PRD — Foundation validation models.
# These validate data shape only; no endpoints are wired to them yet
# (that's explicitly out of scope for this piece of work — see the
# architecture summary delivered alongside this change).
# =========================================================================

from app.enums import (
    EducationBoard, SchoolType, SchoolCategory, MediumOfInstruction,
    GradingSystem, PromotionPolicy, BillingCycle, PricingModel,
    SchoolLifecycleStatus, ComplianceDocumentType, ComplianceStatus,
    SchoolAuditActionType,
)


# ---------- 1. School Identity ----------

class SchoolIdentityUpdate(BaseModel):
    name: str
    short_name: str | None = None
    school_type: SchoolType
    school_category: SchoolCategory
    year_established: int | None = None
    motto: str | None = None


# ---------- 2. Government Recognition & Affiliations ----------

class GovernmentRecognitionUpdate(BaseModel):
    board_type: EducationBoard
    state_board_name: str | None = None  # required if board_type == STATE_BOARD; enforced at service layer, not here
    udise_code: str | None = None
    affiliation_number: str | None = None
    affiliation_valid_from: date | None = None
    affiliation_valid_to: date | None = None
    recognition_number: str | None = None
    trust_registration_number: str | None = None
    pan_number: str | None = None
    gst_number: str | None = None

    @field_validator("udise_code")
    @classmethod
    def validate_udise(cls, value):
        # Previously only checked in the frontend wizard — a direct API
        # call bypassed it entirely. Found during the production
        # readiness review.
        if value and not re.fullmatch(r"\d{11}", value):
            raise ValueError("UDISE+ code must be exactly 11 digits")
        return value

    @field_validator("pan_number")
    @classmethod
    def validate_pan(cls, value):
        if value and not re.fullmatch(r"[A-Z]{5}[0-9]{4}[A-Z]", value.upper()):
            raise ValueError("PAN must be in the format AAAAA9999A")
        return value.upper() if value else value


# ---------- 3. Address & Contact ----------

class SchoolAddressContactUpdate(BaseModel):
    address: str | None = None  # Address Line 1 (existing field, reused)
    address_line_2: str | None = None
    city: str
    state: str
    pincode: str | None = None
    contact_phone: str | None = None  # existing field, reused as Primary Contact Phone
    contact_email: EmailStr | None = None  # existing field, reused as Primary Contact Email
    website_url: str | None = None
    google_maps_url: str | None = None


# ---------- 5. Academic Configuration (school-wide policy defaults) ----------

class SchoolAcademicConfigUpdate(BaseModel):
    school_timing_start: str | None = None  # "08:00"
    school_timing_end: str | None = None  # "14:30"
    working_days: list[str] | None = None  # validated/joined to comma-separated string at service layer
    medium_of_instruction: MediumOfInstruction | None = None
    grading_system: GradingSystem | None = None
    attendance_min_percentage: int | None = None
    promotion_policy: PromotionPolicy | None = None


# ---------- 8. Branding ----------

class SchoolBrandingUpdate(BaseModel):
    logo_url: str | None = None  # existing field, reused
    primary_color: str | None = None  # existing field, reused
    banner_url: str | None = None
    secondary_color: str | None = None
    letterhead_url: str | None = None
    seal_url: str | None = None
    id_card_template: str | None = None
    report_card_template: str | None = None
    certificate_template: str | None = None


# ---------- 9. Subscription & Plan ----------

class SchoolSubscriptionDetailsUpdate(BaseModel):
    subscription_plan: str  # existing field, reused
    billing_cycle: BillingCycle
    pricing_model: PricingModel
    contract_start_date: date
    contract_end_date: date
    trial_ends_at: date | None = None


# ---------- School Lifecycle & Verification (PRD 3.1) ----------

class SchoolLifecycleTransition(BaseModel):
    """Validates a requested state transition — the actual allowed-transitions
    state machine logic belongs in the service layer, not here."""
    new_status: SchoolLifecycleStatus
    rejection_reason: str | None = None  # required by service layer when new_status == REJECTED


class SchoolLifecycleOut(BaseModel):
    lifecycle_status: SchoolLifecycleStatus
    verified_by_platform_admin_id: int | None
    verified_at: datetime | None
    rejection_reason: str | None

    class Config:
        from_attributes = True


# ---------- Organization Settings (PRD 3.2) ----------

class SchoolOrganizationSettingsUpdate(BaseModel):
    timezone: str = "Asia/Kolkata"
    currency: str = "INR"
    primary_language: str = "english"
    date_format: str = "DD-MM-YYYY"
    number_format: str = "indian"
    week_start_day: str = "monday"
    fiscal_year_start_month: int = 4


class SchoolOrganizationSettingsOut(SchoolOrganizationSettingsUpdate):
    id: int
    school_id: int

    class Config:
        from_attributes = True


# ---------- Infrastructure (PRD Step 7) ----------

class SchoolInfrastructureUpdate(BaseModel):
    campus_area: str | None = None
    number_of_classrooms: int | None = None
    number_of_labs: int | None = None
    has_library: bool = False
    sports_facilities: str | None = None  # "indoor" / "outdoor" / "both" / "none"
    has_transport: bool = False
    has_hostel: bool = False
    has_medical_room: bool = False


class SchoolInfrastructureOut(SchoolInfrastructureUpdate):
    id: int
    school_id: int

    class Config:
        from_attributes = True


# ---------- Departments (PRD 3.4) ----------

class DepartmentCreate(BaseModel):
    school_id: int
    name: str
    description: str | None = None


class DepartmentOut(BaseModel):
    id: int
    school_id: int
    name: str
    description: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Document compliance/expiry tracking (PRD 3.3) ----------

class ComplianceDocumentCreate(BaseModel):
    """Extends the existing document upload concept with expiry metadata —
    only meaningful for entity_type="school" compliance documents."""
    school_id: int
    document_type: ComplianceDocumentType
    issue_date: date | None = None
    expiry_date: date | None = None


class ComplianceDocumentOut(BaseModel):
    id: int
    document_type: str
    original_filename: str
    issue_date: date | None
    expiry_date: date | None
    verified_by_user_id: int | None
    verified_at: datetime | None
    computed_status: ComplianceStatus  # populated at service layer from expiry_date, never stored

    class Config:
        from_attributes = True


# ---------- School Audit Log (PRD 3.5) ----------

class SchoolAuditLogCreate(BaseModel):
    school_id: int
    actor_user_id: int
    action_type: SchoolAuditActionType
    entity_type: str | None = None
    entity_id: int | None = None
    before_snapshot: str | None = None
    after_snapshot: str | None = None
    ip_address: str | None = None


class SchoolAuditLogOut(BaseModel):
    id: int
    school_id: int
    actor_user_id: int
    action_type: str
    entity_type: str | None
    entity_id: int | None
    before_snapshot: str | None
    after_snapshot: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Composite: full registration payload (validation shape only) ----------

class SchoolRegistrationFoundation(BaseModel):
    """
    Composes every wizard-step schema above into one payload shape,
    matching the PRD's 10-step structure. This is the validation model
    a future multi-step wizard API would build on top of — no endpoint
    consumes this yet.
    """
    identity: SchoolIdentityUpdate
    government_recognition: GovernmentRecognitionUpdate
    address_contact: SchoolAddressContactUpdate
    academic_config: SchoolAcademicConfigUpdate | None = None
    branding: SchoolBrandingUpdate | None = None
    infrastructure: SchoolInfrastructureUpdate | None = None
    subscription: SchoolSubscriptionDetailsUpdate
    organization_settings: SchoolOrganizationSettingsUpdate | None = None


# =========================================================================
# School Registration Wizard — API request/response models.
# Built on top of the foundation schemas above; this is where the
# individual step schemas get composed into actual endpoint contracts.
# =========================================================================

class ManagementDetailsUpdate(BaseModel):
    """PRD Step 4. Trust/Chairman fields are informational; the School
    Admin name/email are the functionally important part — password is
    deliberately NOT part of this schema (see model comment)."""
    trust_name: str | None = None
    chairman_name: str | None = None
    managing_director_name: str | None = None
    admin_full_name: str
    admin_email: EmailStr


class ClassesOfferedUpdate(BaseModel):
    """PRD Step 6. `stages` must be a non-empty list of valid stage keys."""
    stages: list[str]  # "pre_primary", "primary", "middle", "secondary", "higher_secondary"

    @field_validator("stages")
    @classmethod
    def validate_stages(cls, value):
        valid = {"pre_primary", "primary", "middle", "secondary", "higher_secondary"}
        if not value:
            raise ValueError("At least one school stage must be selected")
        invalid = set(value) - valid
        if invalid:
            raise ValueError(f"Invalid stage(s): {invalid}. Must be one of {valid}")
        return value


class RegisterSchoolRequest(BaseModel):
    """
    POST /school-registration/register — starts a new draft. Combines
    Steps 1-3 (Identity, Government Recognition, Address & Contact) plus
    Step 4's non-sensitive fields, since a draft needs at least this much
    to be a meaningful, resumable record rather than an empty shell.
    """
    identity: SchoolIdentityUpdate
    government_recognition: GovernmentRecognitionUpdate
    address_contact: SchoolAddressContactUpdate
    management: ManagementDetailsUpdate


class SchoolDraftOut(BaseModel):
    """Full current state of a draft — powers both Resume Draft and Review."""
    id: int
    lifecycle_status: str
    name: str
    short_name: str | None
    school_type: str | None
    school_category: str | None
    year_established: int | None
    motto: str | None
    board_type: str
    state_board_name: str | None
    udise_code: str | None
    affiliation_number: str | None
    affiliation_valid_from: date | None
    affiliation_valid_to: date | None
    recognition_number: str | None
    trust_registration_number: str | None
    pan_number: str | None
    gst_number: str | None
    address: str | None
    address_line_2: str | None
    city: str | None
    state: str | None
    pincode: str | None
    contact_phone: str | None
    contact_email: str | None
    website_url: str | None
    google_maps_url: str | None
    trust_name: str | None
    chairman_name: str | None
    managing_director_name: str | None
    pending_admin_full_name: str | None
    pending_admin_email: str | None
    selected_stages: str | None
    school_timing_start: str | None
    school_timing_end: str | None
    working_days: str | None
    medium_of_instruction: str | None
    grading_system: str | None
    attendance_min_percentage: int | None
    promotion_policy: str | None
    logo_url: str | None
    primary_color: str | None
    banner_url: str | None
    secondary_color: str | None
    letterhead_url: str | None
    seal_url: str | None
    id_card_template: str | None
    report_card_template: str | None
    certificate_template: str | None
    subscription_plan: str
    billing_cycle: str | None
    pricing_model: str | None
    contract_start_date: date | None
    contract_end_date: date | None
    trial_ends_at: date | None
    created_at: datetime

    class Config:
        from_attributes = True


class DocumentUploadResultOut(BaseModel):
    id: int
    document_type: str
    original_filename: str
    issue_date: date | None
    expiry_date: date | None
    computed_status: ComplianceStatus

    class Config:
        from_attributes = True


class SchoolReviewSection(BaseModel):
    """One section of the Review screen — a name, its data, and whether
    it's complete enough for Create School to proceed."""
    section: str
    complete: bool
    data: dict


class SchoolReviewOut(BaseModel):
    draft_id: int
    lifecycle_status: str
    sections: list[SchoolReviewSection]
    documents: list[DocumentUploadResultOut]
    classes_to_be_created: list[str]
    ready_to_create: bool
    blocking_issues: list[str]


class CreateSchoolRequest(BaseModel):
    """
    Final step. No admin_password field anymore — the system generates
    a temporary password rather than the Platform Admin typing one in
    on the school's behalf (see app/core/temp_password_utils.py). This
    is a plain, deliberately empty request body; kept as its own class
    in case fields get added here later (e.g. an "approve immediately"
    flag).
    """
    pass


class ProvisioningStepResult(BaseModel):
    step: str
    status: str  # "success" — this list only ever reports completed steps;
                 # a failed step raises and rolls back the whole transaction
                 # instead of appearing here, so there is no partial school.


class CreateSchoolResponse(BaseModel):
    """
    Deliberately lean now — Create School only creates the School Admin
    login and moves the school into pending_verification. It does NOT
    provision academic sessions, classes, departments, templates, etc.
    anymore — see ActiveProvisioningResult below for that, which fires
    only once a Platform Admin actually Approves the school.
    """
    school_id: int
    school_name: str
    lifecycle_status: str
    admin_login_email: str
    provisioning_steps: list[ProvisioningStepResult]
    temporary_password: str
    temp_password_expires_at: datetime
    login_url_path: str


# =========================================================================
# Automatic Organization Provisioning — fires when a school becomes Active
# (see VerificationService.approve), not at Create School time.
# =========================================================================

class NotificationTemplateOut(BaseModel):
    id: int
    school_id: int
    template_key: str
    channel: str
    subject: str | None
    body: str

    class Config:
        from_attributes = True


class EmailTemplateOut(BaseModel):
    id: int
    school_id: int
    template_key: str
    subject: str
    body_html: str

    class Config:
        from_attributes = True


class HolidayOut(BaseModel):
    id: int
    school_id: int
    academic_year_id: int
    name: str
    date: date

    class Config:
        from_attributes = True


class ActiveProvisioningResult(BaseModel):
    """Full summary of everything auto-created the moment a school became
    Active — returned alongside the Approve action's response."""
    school_id: int
    academic_year_id: int
    classes_created: int
    sections_created: int
    departments_created: int
    notification_templates_created: int
    email_templates_created: int
    document_templates_assigned: bool
    branding_defaults_applied: bool
    organization_settings_created: bool
    feature_flags_created: int
    welcome_notice_posted: bool
    holidays_created: int
    attendance_default_applied: bool
    provisioning_steps: list[ProvisioningStepResult]


# =========================================================================
# Verification & Compliance module.
# =========================================================================

# ---------- Verification Queue & Screen ----------

class VerificationQueueItem(BaseModel):
    school_id: int
    school_name: str
    board_type: str
    city: str | None
    submitted_at: datetime  # School.created_at — when the draft entered the queue
    document_count: int
    documents_verified_count: int

    class Config:
        from_attributes = True


class VerificationChecklistItem(BaseModel):
    """One row of the reviewer's checklist — see PRD 3.1's verification
    review screen. Purely informational/derived, never stored."""
    label: str
    passed: bool
    detail: str


class VerificationDetailOut(BaseModel):
    """Full verification review screen: school identity/government
    fields side-by-side with uploaded documents, plus a checklist."""
    school_id: int
    school_name: str
    lifecycle_status: str
    identity: dict
    government_recognition: dict
    address_contact: dict
    management: dict
    documents: list[DocumentUploadResultOut]
    checklist: list[VerificationChecklistItem]
    all_checks_passed: bool


class RejectSchoolRequest(BaseModel):
    reason: str

    @field_validator("reason")
    @classmethod
    def reason_not_blank(cls, value):
        if not value or not value.strip():
            raise ValueError("A rejection reason is required")
        return value


class ResubmitSchoolRequest(BaseModel):
    """Platform Admin action — see school_lifecycle_service.py's docstring
    on why resubmission is Platform-Admin-driven rather than
    School-Admin-driven (a rejected school's admin cannot log in)."""
    notes: str | None = None


class VerificationActionResponse(BaseModel):
    school_id: int
    lifecycle_status: str
    message: str


# ---------- Document Verification ----------

class DocumentVerifyResponse(BaseModel):
    id: int
    document_type: str
    verified_by_platform_admin_id: int
    verified_at: datetime

    class Config:
        from_attributes = True


# ---------- Compliance Dashboard ----------

class ComplianceDashboardItem(BaseModel):
    document_id: int
    school_id: int
    school_name: str
    document_type: str
    expiry_date: date
    computed_status: ComplianceStatus
    days_remaining: int

    class Config:
        from_attributes = True


class ComplianceDashboardOut(BaseModel):
    total_expiring: int
    expired_count: int
    expiring_soon_count: int
    items: list[ComplianceDashboardItem]


class ReminderRunResult(BaseModel):
    reminders_sent: int
    checked_at: datetime


# ---------- Document History (reuses PlatformAuditLog) ----------

class DocumentHistoryEntry(BaseModel):
    action: str
    details: str | None
    performed_at: datetime

    class Config:
        from_attributes = True


# =========================================================================
# Platform Admin School Management module.
# =========================================================================

class HealthScoreFactor(BaseModel):
    label: str
    points: int
    max_points: int
    detail: str


class HealthScoreBreakdown(BaseModel):
    score: int  # 0-100, sum of factor points
    factors: list[HealthScoreFactor]


class CompletenessCheck(BaseModel):
    label: str
    complete: bool


class CompletenessBreakdown(BaseModel):
    percentage: int  # 0-100
    checks: list[CompletenessCheck]


class SchoolListItemOut(BaseModel):
    """Lean row for the Schools Listing table — full detail lives in
    SchoolDetailOut, fetched only when a row is opened."""
    id: int
    name: str
    board_type: str
    city: str | None
    state: str | None
    lifecycle_status: str
    subscription_plan: str
    subscription_status: str
    health_score: int
    created_at: datetime

    class Config:
        from_attributes = True


class SchoolDetailOut(BaseModel):
    id: int
    name: str
    short_name: str | None
    board_type: str
    school_type: str | None
    school_category: str | None
    city: str | None
    state: str | None
    contact_email: str | None
    contact_phone: str | None
    lifecycle_status: str
    subscription_plan: str
    subscription_status: str
    billing_cycle: str | None
    contract_start_date: date | None
    contract_end_date: date | None
    support_access_enabled: bool
    department_count: int
    student_count: int
    staff_count: int
    document_count: int
    documents_needing_attention: int
    health_score: HealthScoreBreakdown
    completeness: CompletenessBreakdown
    created_at: datetime


class TimelineEvent(BaseModel):
    event_type: str
    description: str | None
    occurred_at: datetime


class BulkActionRequest(BaseModel):
    school_ids: list[int]
    action: str  # "suspend" | "reactivate" | "close"


class BulkActionResult(BaseModel):
    succeeded: list[int]
    failed: list[dict]


class ImpersonateResponse(BaseModel):
    access_token: str
    impersonating_user_email: str
    expires_in_minutes: int


# =========================================================================
# School Admin: Morning Operations Briefing.
# =========================================================================

class ParentComplaintCreate(BaseModel):
    school_id: int
    student_id: int | None = None
    guardian_name: str
    guardian_phone: str | None = None
    subject: str
    description: str | None = None


class ParentComplaintResolve(BaseModel):
    resolution_notes: str | None = None


class ParentComplaintOut(BaseModel):
    id: int
    school_id: int
    student_id: int | None
    guardian_name: str
    guardian_phone: str | None
    subject: str
    description: str | None
    status: str
    resolution_notes: str | None
    created_at: datetime
    resolved_at: datetime | None

    class Config:
        from_attributes = True


class SubstitutionCreate(BaseModel):
    school_id: int
    date: date
    timetable_slot_id: int
    original_teacher_id: int
    substitute_teacher_id: int


class SubstitutionOut(BaseModel):
    id: int
    date: date
    timetable_slot_id: int
    original_teacher_id: int
    substitute_teacher_id: int
    substitute_teacher_name: str

    class Config:
        from_attributes = True


class AbsentTeacherItem(BaseModel):
    user_id: int
    full_name: str
    periods_today: int
    periods_covered: int
    needs_substitute: bool
    uncovered_slot_ids: list[int] = []


class TeacherAttendanceBriefing(BaseModel):
    total_teachers: int
    present: int
    absent: int
    late: int
    not_marked: int
    absent_list: list[AbsentTeacherItem]


class UnsubmittedSectionItem(BaseModel):
    section_id: int
    section_name: str
    class_id: int
    class_name: str
    class_teacher_id: int | None
    class_teacher_name: str | None
    class_teacher_has_phone: bool


class AttendanceSubmissionBriefing(BaseModel):
    total_sections: int
    submitted: int
    not_submitted: int
    not_submitted_list: list[UnsubmittedSectionItem]


class ComplaintBriefingItem(BaseModel):
    id: int
    guardian_name: str
    subject: str
    created_at: datetime


class ComplaintsBriefing(BaseModel):
    open_count: int
    items: list[ComplaintBriefingItem]


class FeeCollectionBriefing(BaseModel):
    yesterday_total: int
    yesterday_payment_count: int


class AdmissionInquiryItem(BaseModel):
    id: int
    applicant_name: str
    created_at: datetime


class AdmissionsBriefing(BaseModel):
    pending_count: int
    items: list[AdmissionInquiryItem]


class StaffAttendanceOverviewItem(BaseModel):
    user_id: int
    full_name: str
    role_name: str
    status: str  # "present", "absent", "late", "not_marked"
    needs_substitute: bool
    uncovered_slot_ids: list[int] = []


class NotifyAttendanceReminderRequest(BaseModel):
    section_id: int


class NotifyReminderResult(BaseModel):
    sent: bool
    message: str


class StudentAttendanceSearchItem(BaseModel):
    student_id: int
    full_name: str
    section_name: str
    today_status: str | None  # None if not marked today
    attendance_pct_last_30_days: float | None  # None if no records at all


class MorningBriefingOut(BaseModel):
    date: date
    teacher_attendance: TeacherAttendanceBriefing
    attendance_submission: AttendanceSubmissionBriefing
    complaints: ComplaintsBriefing
    fee_collection: FeeCollectionBriefing
    admissions: AdmissionsBriefing


# =========================================================================
# Student Management: bulk operations, re-admission, TC generation.
# =========================================================================

class BulkSectionShuffleRequest(BaseModel):
    student_ids: list[int]
    new_section_id: int


class BulkPromoteRequest(BaseModel):
    """
    Promotes an entire section at once, into a section in the NEXT
    academic year — matching how promotion actually works in a real
    school (the whole class moves up together). Individual overrides
    (a student repeating a year) are handled separately via a normal
    student edit, not as an exception baked into this bulk action.
    """
    source_section_id: int
    target_section_id: int
    target_academic_year_id: int


class BulkOperationResult(BaseModel):
    succeeded: list[int]
    failed: list[dict]


class ReadmitRequest(BaseModel):
    academic_year_id: int
    section_id: int | None = None


class GenerateTCRequest(BaseModel):
    date_of_leaving: date
    leaving_reason: str


class GenerateTCResponse(BaseModel):
    document_id: int
    tc_number: str
    download_url: str


class SiblingItem(BaseModel):
    id: int
    full_name: str
    admission_number: str
    section_name: str | None

    class Config:
        from_attributes = True


# =========================================================================
# Staff & HR Management: Leave, Teaching Load, Attendance Reporting.
# =========================================================================

class LeaveApplicationCreate(BaseModel):
    leave_type: str  # "CL", "EL", "ML"
    start_date: date
    end_date: date
    reason: str | None = None


class LeaveReviewRequest(BaseModel):
    review_notes: str | None = None


class LeaveApplicationOut(BaseModel):
    id: int
    school_id: int
    user_id: int
    staff_name: str
    leave_type: str
    start_date: date
    end_date: date
    days: int
    reason: str | None
    status: str
    applied_at: datetime
    reviewed_by_user_id: int | None
    reviewed_at: datetime | None
    review_notes: str | None


class LeaveTypeBalance(BaseModel):
    leave_type: str
    annual_quota: int
    used: int
    pending: int
    remaining: int


class LeaveBalanceOut(BaseModel):
    user_id: int
    balances: list[LeaveTypeBalance]


class TeachingLoadItem(BaseModel):
    subject_name: str
    class_name: str
    section_name: str
    periods_per_week: int


class StaffAttendanceMonthlyItem(BaseModel):
    user_id: int
    full_name: str
    role_name: str
    present_days: int
    absent_days: int
    late_days: int
    half_days: int
    not_marked_days: int
    total_working_days: int
    attendance_pct: float


# =========================================================================
# Academics: Homework, Syllabus Tracking, Substitute Timetable View.
# =========================================================================

class HomeworkCreate(BaseModel):
    section_id: int
    subject_id: int
    title: str
    description: str | None = None
    due_date: date


class HomeworkOut(BaseModel):
    id: int
    school_id: int
    section_id: int
    subject_id: int
    subject_name: str
    title: str
    description: str | None
    due_date: date
    assigned_by_user_id: int
    created_at: datetime
    total_students: int
    submitted_count: int


class SubmissionMarkRequest(BaseModel):
    student_ids: list[int]
    status: str = "submitted"  # "submitted" or "not_submitted"


class HomeworkSubmissionOut(BaseModel):
    student_id: int
    student_name: str
    status: str


class SyllabusChapterCreate(BaseModel):
    school_class_id: int
    subject_id: int
    chapter_name: str
    order_index: int = 0


class SyllabusChapterOut(BaseModel):
    id: int
    school_class_id: int
    subject_id: int
    chapter_name: str
    order_index: int
    is_completed: bool
    completed_at: datetime | None

    class Config:
        from_attributes = True


class SyllabusProgressOut(BaseModel):
    subject_id: int
    subject_name: str
    school_class_id: int
    class_name: str
    total_chapters: int
    completed_chapters: int
    completion_pct: float
    chapters: list[SyllabusChapterOut]


class SubstituteTimetableSlot(BaseModel):
    timetable_slot_id: int
    period_number: int
    start_time: str
    end_time: str
    subject_name: str
    original_teacher_id: int
    original_teacher_name: str
    substitute_teacher_id: int | None
    substitute_teacher_name: str | None


class DayScheduleBlockCreate(BaseModel):
    block_type: str  # "assembly", "period", "break", "lunch", "closing", "other"
    label: str
    start_time: str
    end_time: str
    order_index: int = 0


class DayScheduleBlockOut(BaseModel):
    id: int
    school_id: int
    block_type: str
    label: str
    start_time: str
    end_time: str
    order_index: int

    class Config:
        from_attributes = True


# =========================================================================
# Examinations: Setup, Marks Entry, Result Processing, Report Cards.
# =========================================================================

class ExamCreate(BaseModel):
    academic_year_id: int
    name: str
    exam_type: str = "marks_based"  # "marks_based" or "grade_based"


class ExamOut(BaseModel):
    id: int
    school_id: int
    academic_year_id: int
    name: str
    exam_type: str
    status: str
    created_by_user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ExamScheduleCreate(BaseModel):
    school_class_id: int
    subject_id: int
    exam_date: date
    start_time: str
    end_time: str
    room: str | None = None
    max_marks: int = 100
    passing_marks: int = 33


class ExamScheduleOut(BaseModel):
    id: int
    exam_id: int
    school_class_id: int
    class_name: str
    subject_id: int
    subject_name: str
    exam_date: date
    start_time: str
    end_time: str
    room: str | None
    max_marks: int
    passing_marks: int


class MarksEntryItem(BaseModel):
    student_id: int
    marks_obtained: int | None = None
    grade: str | None = None
    is_absent: bool = False


class MarksEntryRequest(BaseModel):
    entries: list[MarksEntryItem]


class ExamMarksOut(BaseModel):
    student_id: int
    student_name: str
    marks_obtained: int | None
    grade: str | None
    is_absent: bool
    is_locked: bool
    max_marks: int
    passing_marks: int


class MarksLockRequest(BaseModel):
    school_class_id: int
    subject_id: int


class MarksCorrectionCreate(BaseModel):
    exam_marks_id: int
    requested_marks: int
    reason: str


class CorrectionReviewRequest(BaseModel):
    review_notes: str | None = None


class MarksCorrectionOut(BaseModel):
    id: int
    exam_marks_id: int
    student_name: str
    subject_name: str
    old_marks: int | None
    requested_marks: int
    reason: str
    status: str
    requested_at: datetime
    reviewed_by_user_id: int | None
    review_notes: str | None


class SubjectResultItem(BaseModel):
    subject_id: int
    subject_name: str
    marks_obtained: int | None
    grade: str | None
    max_marks: int
    passing_marks: int
    is_absent: bool
    passed: bool


class StudentResultOut(BaseModel):
    student_id: int
    student_name: str
    admission_number: str
    subjects: list[SubjectResultItem]
    total_obtained: int
    total_max: int
    percentage: float
    overall_grade: str
    passed: bool
    rank: int


class SubjectAnalysisItem(BaseModel):
    subject_id: int
    subject_name: str
    students_appeared: int
    average_marks: float
    highest_marks: int
    lowest_marks: int
    pass_count: int
    pass_percentage: float


class PromotionListItem(BaseModel):
    student_id: int
    student_name: str
    admission_number: str
    percentage: float
    status: str  # "pass", "detained", "grace_zone"
    failed_subjects: list[str]


class ReportCardSignatureUpdate(BaseModel):
    signed: bool
    signed_date: date | None = None


class GenerateReportCardResponse(BaseModel):
    document_id: int
    download_url: str


# =========================================================================
# Student Attendance: Monthly Register, Percentage, Low-Attendance Alerts.
# =========================================================================

class StudentAttendanceRegisterItem(BaseModel):
    student_id: int
    full_name: str
    admission_number: str
    present_days: int
    absent_days: int
    late_days: int
    excused_days: int
    total_marked_days: int
    attendance_pct: float


class StudentAttendancePercentageOut(BaseModel):
    student_id: int
    full_name: str
    present_days: int
    absent_days: int
    late_days: int
    excused_days: int
    total_marked_days: int
    attendance_pct: float
    below_threshold: bool


class LowAttendanceItem(BaseModel):
    student_id: int
    full_name: str
    admission_number: str
    section_name: str
    attendance_pct: float
    total_marked_days: int


class NotifyAbsenteesResult(BaseModel):
    notified_count: int
    absent_count: int


# =========================================================================
# Fee Management: Concessions, Waivers, Receipts, Reporting.
# =========================================================================

class FeeConcessionCreate(BaseModel):
    school_id: int
    name: str
    concession_type: str  # "sibling", "rte", "category", "custom"
    discount_type: str  # "percentage" or "flat"
    discount_value: int


class FeeConcessionOut(BaseModel):
    id: int
    school_id: int
    name: str
    concession_type: str
    discount_type: str
    discount_value: int
    is_active: bool

    class Config:
        from_attributes = True


class ApplyConcessionRequest(BaseModel):
    concession_id: int


class FeeWaiverCreate(BaseModel):
    invoice_id: int
    waiver_amount: int
    reason: str


class WaiverReviewRequest(BaseModel):
    review_notes: str | None = None


class FeeWaiverOut(BaseModel):
    id: int
    invoice_id: int
    student_name: str
    waiver_amount: int
    reason: str
    status: str
    requested_at: datetime
    reviewed_by_user_id: int | None
    review_notes: str | None


class GenerateReceiptResponse(BaseModel):
    document_id: int
    download_url: str
    receipt_number: str


class DefaulterItem(BaseModel):
    student_id: int
    student_name: str
    admission_number: str
    class_name: str
    section_name: str
    guardian_name: str
    guardian_phone: str
    total_outstanding: int
    oldest_due_date: date
    invoice_count: int


class ClassWiseCollectionItem(BaseModel):
    school_class_id: int
    class_name: str
    total_billed: int
    total_collected: int
    total_outstanding: int
    collection_pct: float


class CollectionReportItem(BaseModel):
    period_label: str
    total_collected: int
    payment_count: int


class PaymentHistoryItem(BaseModel):
    payment_id: int
    receipt_number: str | None
    fee_type: str
    billing_period: str
    amount: int
    payment_date: date
    payment_method: str


class OutstandingByFeeTypeItem(BaseModel):
    fee_type: str
    total_billed: int
    total_collected: int
    total_outstanding: int


# =========================================================================
# Communication: Bulk Messaging, PTM Scheduling.
# =========================================================================

class BulkMessageCreate(BaseModel):
    message_type: str  # "fee_reminder", "exam_schedule", "ptm_reminder", "holiday", "emergency", "custom"
    target_scope: str  # "school", "class", "section"
    school_class_id: int | None = None
    section_id: int | None = None
    message_content: str


class BulkMessageResult(BaseModel):
    recipient_count: int
    message_type: str


class BulkMessageLogOut(BaseModel):
    id: int
    message_type: str
    target_scope: str
    school_class_id: int | None
    section_id: int | None
    message_content: str
    recipient_count: int
    sent_by_user_id: int
    sent_at: datetime

    class Config:
        from_attributes = True


class FeeReminderResult(BaseModel):
    notified_count: int
    skipped_count: int  # students with no outstanding balance


class PTMScheduleCreate(BaseModel):
    title: str
    school_class_id: int | None = None
    section_id: int | None = None
    ptm_date: date
    start_time: str
    end_time: str
    venue: str | None = None


class PTMScheduleOut(BaseModel):
    id: int
    school_id: int
    title: str
    school_class_id: int | None
    section_id: int | None
    class_name: str | None = None
    section_name: str | None = None
    ptm_date: date
    start_time: str
    end_time: str
    venue: str | None
    created_by_user_id: int


class PTMAttendanceMarkRequest(BaseModel):
    student_id: int
    attended: bool
    notes: str | None = None


class PTMAttendanceOut(BaseModel):
    student_id: int
    student_name: str
    attended: bool
    notes: str | None


# =========================================================================
# Transport: Bus Routes, Stops, Student Assignment.
# =========================================================================

class BusRouteCreate(BaseModel):
    school_id: int
    route_name: str
    route_number: str | None = None
    vehicle_number: str | None = None
    driver_name: str | None = None
    driver_phone: str | None = None
    conductor_name: str | None = None
    conductor_phone: str | None = None


class BusRouteUpdate(BaseModel):
    route_name: str | None = None
    route_number: str | None = None
    vehicle_number: str | None = None
    driver_name: str | None = None
    driver_phone: str | None = None
    conductor_name: str | None = None
    conductor_phone: str | None = None


class BusRouteOut(BaseModel):
    id: int
    school_id: int
    route_name: str
    route_number: str | None
    vehicle_number: str | None
    driver_name: str | None
    driver_phone: str | None
    conductor_name: str | None
    conductor_phone: str | None
    is_active: bool
    student_count: int = 0

    class Config:
        from_attributes = True


class BusStopCreate(BaseModel):
    route_id: int
    stop_name: str
    stop_order: int = 0
    latitude: float | None = None
    longitude: float | None = None
    pickup_time: str | None = None
    drop_time: str | None = None


class BusStopOut(BaseModel):
    id: int
    route_id: int
    stop_name: str
    stop_order: int
    latitude: float | None
    longitude: float | None
    pickup_time: str | None
    drop_time: str | None
    student_count: int = 0

    class Config:
        from_attributes = True


class AssignStudentTransportRequest(BaseModel):
    bus_route_id: int | None = None
    bus_stop_id: int | None = None


class RouteStudentListItem(BaseModel):
    student_id: int
    full_name: str
    admission_number: str
    class_name: str
    section_name: str
    stop_name: str | None
    guardian_phone: str


# =========================================================================
# House Leadership Positions.
# =========================================================================

class HousePositionCreate(BaseModel):
    position_title: str
    student_id: int | None = None
    staff_user_id: int | None = None


class HousePositionOut(BaseModel):
    id: int
    house_id: int
    position_title: str
    student_id: int | None
    staff_user_id: int | None
    holder_name: str | None
    holder_type: str | None  # "student" or "staff", or None if unfilled
    holder_photo_url: str | None = None


# =========================================================================
# Certificates & ID Cards.
# =========================================================================

class CertificateGenerateResponse(BaseModel):
    document_id: int
    download_url: str


class AchievementCreate(BaseModel):
    title: str
    event_name: str | None = None
    position: str | None = None
    achievement_date: date
    description: str | None = None


class AchievementOut(BaseModel):
    id: int
    student_id: int
    title: str
    event_name: str | None
    position: str | None
    achievement_date: date
    description: str | None
    issued_by_user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# =========================================================================
# Staff Salary.
# =========================================================================

class SalaryPaymentCreate(BaseModel):
    staff_user_id: int
    month: int
    year: int
    basic_salary: int
    allowances: int = 0
    deductions: int = 0
    notes: str | None = None


class SalaryPaymentOut(BaseModel):
    id: int
    staff_user_id: int
    staff_name: str
    designation: str | None
    month: int
    year: int
    basic_salary: int
    allowances: int
    deductions: int
    net_salary: int
    payment_status: str
    payment_date: date | None
    notes: str | None


class SalaryMarkPaidRequest(BaseModel):
    payment_date: date


class SalarySummaryOut(BaseModel):
    month: int
    year: int
    total_staff: int
    paid_count: int
    pending_count: int
    total_paid_amount: int
    total_pending_amount: int


# =========================================================================
# Reports & Analytics (Step 11) — the reports a Tier 2/3 school admin
# actually maintains today in Excel or on paper.
# =========================================================================

class StudentStrengthItem(BaseModel):
    school_class_id: int
    class_name: str
    section_id: int
    section_name: str
    total: int
    boys: int
    girls: int
    other_gender: int
    general: int
    obc: int
    sc: int
    st: int
    ews: int
    category_unspecified: int


class StaffListItem(BaseModel):
    id: int
    full_name: str
    role_name: str | None
    designation: str | None
    department: str | None
    qualification: str | None
    experience_years: int | None
    email: str
    phone: str | None
    date_of_joining: date | None
    is_active: bool


class DemographicBreakdownEntry(BaseModel):
    label: str
    count: int


class DemographicSummaryOut(BaseModel):
    total_students: int
    by_gender: list[DemographicBreakdownEntry]
    by_category: list[DemographicBreakdownEntry]
    by_religion: list[DemographicBreakdownEntry]
    by_nationality: list[DemographicBreakdownEntry]
    by_mother_tongue: list[DemographicBreakdownEntry]


# =========================================================================
# Class & Section detail (enriched views for the class drill-down flow).
# The plain SchoolClassOut / SectionOut return just IDs; the UI would
# otherwise need 3+ round trips per section to show a proper card
# (fetch section, fetch teacher, count students, count boys/girls).
# These enriched variants roll it into one server-side query, matching
# the pattern already used for student-strength / dashboard-summary.
# =========================================================================

class SectionDetailOut(BaseModel):
    id: int
    school_class_id: int
    class_name: str
    name: str
    section_slug: str = ""  # e.g. "a", "science-a" - derived from name at read time
    capacity: int
    class_teacher_id: int | None
    class_teacher_name: str | None
    total_students: int
    boys: int
    girls: int
    other_gender: int


class ClassDetailOut(BaseModel):
    id: int
    school_id: int
    academic_year_id: int
    name: str
    order_index: int
    stage: str | None
    total_students: int
    total_sections: int
    boys: int
    girls: int
    sections: list[SectionDetailOut]


# =========================================================================
# Public school lookup by slug — powers the branded /{slug}/login page.
# Deliberately minimal: this endpoint has NO authentication, so it must
# never expose anything beyond what a logged-out visitor should see on
# a login screen (name, logo, board type for a subtitle). No contact
# info, no financials, no internal IDs beyond what routing needs.
# =========================================================================

class SchoolPublicOut(BaseModel):
    id: int
    name: str
    slug: str
    short_name: str | None
    logo_url: str | None
    board_type: str
    city: str | None
    state: str | None


# =========================================================================
# Teacher Portal — properly scoped to only what a teacher is assigned
# to teach, never the whole school (see app/core/teacher_scope.py and
# app/routers/teacher_portal.py).
# =========================================================================

class TeacherTodayPeriod(BaseModel):
    slot_id: int
    period_number: int
    start_time: str
    end_time: str
    section_id: int
    class_name: str
    section_name: str
    subject_name: str
    attendance_marked: bool


class TeacherClassSummary(BaseModel):
    section_id: int
    class_name: str
    section_name: str
    student_count: int
    is_class_teacher: bool
    subjects_taught: list[str]
