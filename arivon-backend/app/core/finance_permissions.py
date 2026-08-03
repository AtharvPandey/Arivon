"""
Finance permissions — deliberately ONE place that maps "what action" to
"which roles can do it," rather than scattering role tuples across
every endpoint. This is what makes it possible to later introduce a
configurable, per-school permission matrix without redesigning the
Finance module: only require_finance_permission() below would need to
change (e.g. to query a database table instead of this fixed dict) -
every endpoint that calls it stays exactly as it is.

Fixed hierarchy for now, per the confirmed decision:
    Accountant < Senior Accountant < Finance Manager < School Admin/Super Admin
Principal is read-only everywhere in Finance - never appears in a
write permission below.
"""

from fastapi import Depends
from app.core.deps import require_roles

FINANCE_PERMISSIONS: dict[str, tuple[str, ...]] = {
    # Day-to-day operations - anyone on the Finance team
    "record_payment": ("accountant", "senior_accountant", "finance_manager", "school_admin", "administrator", "super_admin"),
    "generate_invoice": ("accountant", "senior_accountant", "finance_manager", "school_admin", "administrator", "super_admin"),
    "issue_receipt": ("accountant", "senior_accountant", "finance_manager", "school_admin", "administrator", "super_admin"),
    "request_waiver": ("accountant", "senior_accountant", "finance_manager", "school_admin", "administrator", "super_admin"),
    "request_refund": ("accountant", "senior_accountant", "finance_manager", "school_admin", "administrator", "super_admin"),

    # Configuration authority - Senior Accountant and above
    "manage_fee_structures": ("senior_accountant", "finance_manager", "school_admin", "administrator", "super_admin"),
    "manage_fee_categories": ("senior_accountant", "finance_manager", "school_admin", "administrator", "super_admin"),
    "manage_concessions": ("senior_accountant", "finance_manager", "school_admin", "administrator", "super_admin"),

    # Approval authority - Finance Manager and above
    "approve_waiver": ("finance_manager", "school_admin", "administrator", "super_admin"),
    "review_refund": ("finance_manager", "school_admin", "administrator", "super_admin"),
    "approve_refund": ("finance_manager", "school_admin", "administrator", "super_admin"),
    "process_refund": ("finance_manager", "school_admin", "administrator", "super_admin"),
    "manage_finance_settings": ("finance_manager", "school_admin", "administrator", "super_admin"),

    # View-only - includes Principal, who has NO write permission anywhere above
    "view_dashboard": ("accountant", "senior_accountant", "finance_manager", "school_admin", "administrator", "principal", "super_admin"),
    "view_reports": ("accountant", "senior_accountant", "finance_manager", "school_admin", "administrator", "principal", "super_admin"),
}


def require_finance_permission(permission_name: str):
    """Use this instead of require_roles(...) directly on any Finance
    endpoint - e.g. dependencies=[Depends(require_finance_permission("approve_refund"))]."""
    allowed_roles = FINANCE_PERMISSIONS.get(permission_name, ())
    return require_roles(*allowed_roles)
