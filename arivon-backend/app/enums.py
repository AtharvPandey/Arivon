"""
Centralized enums for the School Registration domain (Register School PRD).

Design note: these are stored as plain String columns in the database
(matching the existing codebase convention — see Role, AttendanceRecord,
AdmissionApplication, etc., none of which use native DB enum types).
SQLite has no native ENUM type anyway, and the rest of Arivon documents
allowed values in a comment next to the column rather than enforcing a
DB-level CHECK constraint. These Python enums exist so that:
  1. Pydantic schemas can validate incoming values against a fixed set
  2. There is ONE canonical place listing valid values, instead of the
     same magic strings copy-pasted across models/schemas/routers
  3. "Other" is explicitly supported wherever the PRD calls for it,
     rather than the enum being falsely exhaustive
"""

from enum import Enum


class EducationBoard(str, Enum):
    CBSE = "CBSE"
    ICSE = "ICSE"
    STATE_BOARD = "state_board"
    IB = "IB"
    IGCSE = "IGCSE"
    NIOS = "NIOS"
    OTHER = "other"


class SchoolType(str, Enum):
    PRIVATE = "private"
    GOVERNMENT = "government"
    GOVERNMENT_AIDED = "government_aided"
    TRUST_RUN = "trust_run"
    INTERNATIONAL = "international"


class SchoolCategory(str, Enum):
    CO_ED = "co_ed"
    BOYS = "boys"
    GIRLS = "girls"


class MediumOfInstruction(str, Enum):
    ENGLISH = "english"
    HINDI = "hindi"
    REGIONAL = "regional"
    BILINGUAL = "bilingual"


class GradingSystem(str, Enum):
    PERCENTAGE = "percentage"
    GPA_10_POINT = "gpa_10_point"
    CGPA = "cgpa"
    LETTER_GRADES = "letter_grades"


class PromotionPolicy(str, Enum):
    AUTOMATIC = "automatic"
    EXAM_BASED = "exam_based"
    COMBINED = "combined"  # attendance + exam


class BillingCycle(str, Enum):
    ANNUAL = "annual"
    SEMI_ANNUAL = "semi_annual"
    QUARTERLY = "quarterly"


class PricingModel(str, Enum):
    PER_STUDENT = "per_student"
    FLAT = "flat"


class SchoolLifecycleStatus(str, Enum):
    """
    See PRD Section 3.1. This is now the SINGLE authoritative state field
    for a school's onboarding/operational status. The existing
    `School.is_active` boolean is retained for backward compatibility
    with code that already checks it, but going forward
    `lifecycle_status` is the source of truth — `is_active` is treated
    as a derived convenience (True only when lifecycle_status == ACTIVE).
    """
    DRAFT = "draft"
    PENDING_VERIFICATION = "pending_verification"
    VERIFIED = "verified"
    ACTIVE = "active"
    REJECTED = "rejected"
    SUSPENDED = "suspended"
    CLOSED = "closed"


class ComplianceDocumentType(str, Enum):
    """
    Suggested values for Document.document_type when entity_type="school"
    (see PRD Section 3.3). NOT enforced as a DB constraint — Document.
    document_type remains a free String column so schools can record
    document types this enum doesn't anticipate, matching the PRD's
    explicit "Other (extensible list)" requirement.
    """
    AFFILIATION_CERTIFICATE = "affiliation_certificate"
    TRUST_REGISTRATION = "trust_registration"
    FIRE_SAFETY_CERTIFICATE = "fire_safety_certificate"
    BUILDING_SAFETY_CERTIFICATE = "building_safety_certificate"
    RECOGNITION_CERTIFICATE = "recognition_certificate"
    OTHER = "other"


class ComplianceStatus(str, Enum):
    """Computed, never stored — derived from Document.expiry_date at read time."""
    VALID = "valid"
    EXPIRING_SOON = "expiring_soon"
    EXPIRED = "expired"
    NO_EXPIRY = "no_expiry"


class SchoolAuditActionType(str, Enum):
    """
    See PRD Section 3.5. Deliberately selective — routine reads and
    anything already covered by a more specific existing mechanism
    (e.g. AttendanceRecord.marked_by_user_id) are NOT logged here.
    """
    FEE_WAIVER_GRANTED = "fee_waiver_granted"
    PAYMENT_RECORD_EDITED = "payment_record_edited"
    PAYMENT_RECORD_DELETED = "payment_record_deleted"
    MARKS_ENTERED = "marks_entered"
    MARKS_EDITED = "marks_edited"
    PROMOTION_DECIDED = "promotion_decided"
    REPORT_CARD_PUBLISHED = "report_card_published"
    STAFF_ACCOUNT_CREATED = "staff_account_created"
    STAFF_ACCOUNT_DEACTIVATED = "staff_account_deactivated"
    STAFF_ROLE_CHANGED = "staff_role_changed"
    STUDENT_RECORD_EDITED = "student_record_edited"
    DOCUMENT_UPLOADED = "document_uploaded"
    DOCUMENT_DELETED = "document_deleted"
    DOCUMENT_VERIFIED = "document_verified"
