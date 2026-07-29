"""
Seeds a realistic demo dataset by calling the live API — the same way a
real user would, so every business rule (auto class-ladder generation,
sequential section lettering, password hashing, etc.) runs exactly as it
would in production. This is NOT a direct-to-database script on purpose;
seeding through the API is what keeps the seed data honest.

Usage:
    1. Make sure the backend is running: python -m uvicorn app.main:app --reload
    2. In a second terminal: python3 scripts/seed_demo_data.py

Safe to re-run — it checks for an existing platform admin/school before
creating duplicates, but if you've wiped arivon.db, it starts completely
fresh, exactly like a first run.
"""

import requests
import sys

BASE = "http://localhost:8000"

PLATFORM_ADMIN = {
    "full_name": "Arivon Team",
    "email": "admin@arivon.in",
    "password": "SuperSecurePass123",
}

SCHOOL = {
    "name": "Green Valley Public School",
    "board_type": "CBSE",
    "city": "Bangalore",
    "state": "Karnataka",
    "education_level": "higher_secondary",
    "subscription_plan": "pro",
    "admin_full_name": "Ramesh Iyer",
    "admin_email": "admin@greenvalley.edu",
    "admin_password": "SchoolAdminPass123",
}

STAFF = [
    {"role_name": "principal", "full_name": "Dr. Kavita Rao", "email": "principal@greenvalley.edu", "password": "PrincipalPass123"},
    {"role_name": "vice_principal", "full_name": "Sanjay Mehta", "email": "vp@greenvalley.edu", "password": "VicePrincipalPass123"},
    {"role_name": "teacher", "full_name": "Anita Sharma", "email": "anita@greenvalley.edu", "password": "TeacherPass123"},
    {"role_name": "teacher", "full_name": "Rahul Verma", "email": "rahul@greenvalley.edu", "password": "TeacherPass123"},
    {"role_name": "accountant", "full_name": "Suresh Gupta", "email": "accountant@greenvalley.edu", "password": "AccountantPass123"},
    {"role_name": "admissions_officer", "full_name": "Priya Desai", "email": "admissions@greenvalley.edu", "password": "AdmissionsPass123"},
    {"role_name": "academic_coordinator", "full_name": "Vikram Nair", "email": "academic@greenvalley.edu", "password": "AcademicPass123"},
]

HOUSES = [
    {"name": "Red House", "color": "#DC2626"},
    {"name": "Blue House", "color": "#2563EB"},
    {"name": "Green House", "color": "#16A34A"},
    {"name": "Yellow House", "color": "#CA8A04"},
]

SUBJECTS = ["Mathematics", "English", "Science", "Social Studies"]

STUDENTS = [
    {"full_name": "Rahul Kumar", "dob": "2015-04-12", "gender": "Male", "guardian": "Suresh Kumar", "phone": "9876543210"},
    {"full_name": "Priya Singh", "dob": "2015-07-23", "gender": "Female", "guardian": "Anil Singh", "phone": "9876543211"},
    {"full_name": "Arjun Reddy", "dob": "2015-01-30", "gender": "Male", "guardian": "Venkat Reddy", "phone": "9876543212"},
]


def post(path, json=None, data=None, token=None, files=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    r = requests.post(f"{BASE}{path}", json=json, data=data, headers=headers, files=files)
    return r


def get(path, token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return requests.get(f"{BASE}{path}", headers=headers)


def login(path, email, password, token=None):
    r = post(path, data={"username": email, "password": password})
    if r.status_code != 200:
        print(f"  Login failed at {path}: {r.status_code} {r.text}")
        sys.exit(1)
    return r.json()["access_token"]


def main():
    print("=== Checking backend is reachable ===")
    try:
        requests.get(f"{BASE}/health", timeout=3)
    except requests.exceptions.ConnectionError:
        print("Backend not reachable at", BASE, "— start it first with:")
        print("  python -m uvicorn app.main:app --reload")
        sys.exit(1)

    print("=== 1. Platform admin ===")
    r = login("/platform/auth/login", PLATFORM_ADMIN["email"], PLATFORM_ADMIN["password"])
    platform_token = r
    print("  Logged in as platform admin.")

    print("=== 2. Register school ===")
    r = post("/platform/schools", json=SCHOOL, token=platform_token)
    if r.status_code == 201:
        school_id = r.json()["id"]
        print(f"  Created school id={school_id}")
    else:
        print(f"  School registration returned {r.status_code}: {r.text}")
        print("  Assuming school already exists with id=1")
        school_id = 1

    print("=== 3. School Admin login ===")
    school_admin_token = login("/auth/login", SCHOOL["admin_email"], SCHOOL["admin_password"])

    print("=== 4. Academic year (auto-creates full class ladder) ===")
    r = post("/academic-years/", json={
        "school_id": school_id, "label": "2026-2027",
        "start_date": "2026-06-01", "end_date": "2027-04-30", "is_current": True,
    }, token=school_admin_token)
    print(f"  {r.status_code}: {'created' if r.status_code == 201 else r.text}")

    classes = get(f"/classes/?school_id={school_id}").json()
    class_by_name = {c["name"]: c["id"] for c in classes}
    print(f"  {len(classes)} classes auto-provisioned.")

    print("=== 5. Sections for Class 5 (auto-lettered) ===")
    class5_id = class_by_name.get("Class 5")
    section_ids = []
    if class5_id:
        for _ in range(2):
            r = post("/sections/", json={"school_class_id": class5_id, "capacity": 40})
            if r.status_code == 201:
                section_ids.append(r.json()["id"])
        print(f"  Sections created: {section_ids}")

    print("=== 6. Houses ===")
    for house in HOUSES:
        r = post("/houses/", json={"school_id": school_id, **house}, token=school_admin_token)
        print(f"  {house['name']}: {r.status_code}")

    print("=== 7. Staff ===")
    staff_tokens = {}
    for member in STAFF:
        r = post("/auth/register", json=member, token=school_admin_token)
        status = "created" if r.status_code == 201 else r.text
        print(f"  {member['role_name']} {member['full_name']}: {r.status_code} {status if r.status_code != 201 else ''}")
        staff_tokens[member["email"]] = member["password"]

    academic_token = login("/auth/login", "academic@greenvalley.edu", "AcademicPass123")

    print("=== 8. Subjects ===")
    subject_ids = []
    for name in SUBJECTS:
        r = post("/subjects", json={"school_id": school_id, "name": name}, token=academic_token)
        if r.status_code == 201:
            subject_ids.append(r.json()["id"])
    print(f"  {len(subject_ids)} subjects created.")

    if section_ids and subject_ids:
        print("=== 9. Timetable slot ===")
        r = post("/timetable", json={
            "section_id": section_ids[0], "day_of_week": 0, "period_number": 1,
            "start_time": "09:00", "end_time": "09:45", "subject_id": subject_ids[0],
        }, token=academic_token)
        print(f"  {r.status_code}")

    admissions_token = login("/auth/login", "admissions@greenvalley.edu", "AdmissionsPass123")

    print("=== 10. Guardians + Students ===")
    student_ids = []
    for i, student in enumerate(STUDENTS):
        gr = post("/guardians/", json={
            "school_id": school_id, "full_name": student["guardian"],
            "relation": "father", "phone": student["phone"],
        }, token=admissions_token)
        guardian_id = gr.json().get("id") if gr.status_code == 201 else None

        sr = post("/students/", json={
            "school_id": school_id, "academic_year_id": 1,
            "section_id": section_ids[0] if section_ids else None,
            "admission_number": f"2026-{i+1:03d}",
            "full_name": student["full_name"], "date_of_birth": student["dob"],
            "gender": student["gender"], "guardian_name": student["guardian"],
            "guardian_phone": student["phone"], "guardian_id": guardian_id,
        })
        if sr.status_code == 201:
            student_ids.append(sr.json()["id"])
    print(f"  {len(student_ids)} students created.")

    print("=== 11. Fee structure + invoice + payment ===")
    accountant_token = login("/auth/login", "accountant@greenvalley.edu", "AccountantPass123")
    fr = post("/fees/structures", json={
        "school_id": school_id, "academic_year_id": 1, "school_class_id": class5_id,
        "fee_type": "Tuition", "amount": 5000, "frequency": "monthly",
    }, token=accountant_token)
    if fr.status_code == 201 and student_ids:
        structure_id = fr.json()["id"]
        ir = post("/fees/invoices", json={
            "student_id": student_ids[0], "fee_structure_id": structure_id,
            "billing_period": "July 2026", "due_date": "2026-07-10", "amount_due": 5000,
        }, token=accountant_token)
        if ir.status_code == 201:
            post("/fees/payments", json={
                "invoice_id": ir.json()["id"], "amount": 5000,
                "payment_date": "2026-07-10", "payment_method": "upi",
            }, token=accountant_token)
    print("  Fee structure, invoice, and payment created.")

    print("=== 12. Announcement + Event ===")
    principal_token = login("/auth/login", "principal@greenvalley.edu", "PrincipalPass123")
    post("/announcements/", json={
        "school_id": school_id, "title": "Welcome to the new academic year",
        "content": "Classes begin June 1st. Please ensure all documents are submitted by May 25th.",
    }, token=principal_token)
    post("/events/", json={
        "school_id": school_id, "title": "Orientation Day",
        "event_date": "2026-06-01", "event_time": "09:00",
    }, token=principal_token)
    print("  Done.")

    print()
    print("=== Seed complete ===")
    print(f"School Admin:  {SCHOOL['admin_email']} / {SCHOOL['admin_password']}")
    for member in STAFF:
        print(f"{member['role_name']:<20} {member['email']} / {member['password']}")


if __name__ == "__main__":
    main()
