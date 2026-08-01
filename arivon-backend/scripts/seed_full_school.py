"""
Populates a FULL school roster on top of whatever already exists:
- Ensures every class has exactly 3 sections (A, B, C) — tops up if some
  already exist (e.g. from an earlier seed run) rather than duplicating.
- Ensures every section has exactly 10 students — same top-up logic.
- Creates a pool of teachers if the school doesn't already have enough.

This is deliberately idempotent-ish: run it once after seed_demo_data.py,
and it fills in the gaps without creating duplicate sections or blowing
past 10 students per section on a second run.

Usage:
    python3 scripts/seed_full_school.py
"""

import requests
import random
import sys

BASE = "http://localhost:8000"

SCHOOL_ADMIN_EMAIL = "admin@greenvalley.edu"
SCHOOL_ADMIN_PASSWORD = "SchoolAdminPass123"
ACADEMIC_EMAIL = "academic@greenvalley.edu"
ACADEMIC_PASSWORD = "AcademicPass123"
ADMISSIONS_EMAIL = "admissions@greenvalley.edu"
ADMISSIONS_PASSWORD = "AdmissionsPass123"

SECTIONS_PER_CLASS = 3
STUDENTS_PER_SECTION = 10

MALE_FIRST_NAMES = [
    "Aarav", "Vihaan", "Aditya", "Arjun", "Sai", "Reyansh", "Krishna", "Ishaan",
    "Rohan", "Kabir", "Aryan", "Dhruv", "Vivaan", "Ayaan", "Shaurya", "Karan",
    "Yash", "Rudra", "Aarush", "Devansh",
]
FEMALE_FIRST_NAMES = [
    "Ananya", "Diya", "Aadhya", "Saanvi", "Myra", "Aarohi", "Ira", "Anika",
    "Kiara", "Navya", "Riya", "Siya", "Pari", "Prisha", "Avni", "Meera",
    "Tara", "Zara", "Nitya", "Vanya",
]
LAST_NAMES = [
    "Sharma", "Verma", "Gupta", "Kumar", "Singh", "Patel", "Reddy", "Nair",
    "Iyer", "Rao", "Mehta", "Joshi", "Kapoor", "Malhotra", "Chopra", "Desai",
    "Agarwal", "Bhat", "Menon", "Pillai",
]

TEACHER_NAMES = [
    "Anjali Krishnan", "Ravi Shankar", "Deepa Nambiar", "Suresh Pillai",
    "Lakshmi Venkatesan", "Manoj Tiwari", "Pooja Bhatt", "Arun Chandra",
    "Sneha Kulkarni", "Vijay Rathod", "Kavya Menon", "Ramesh Bhatia",
    "Nisha Choudhary", "Ashok Yadav", "Meenakshi Iyer", "Girish Kamath",
]

SUBJECTS = ["Mathematics", "English", "Science", "Social Studies", "Hindi", "Computer Science"]


def post(path, json=None, data=None, token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return requests.post(f"{BASE}{path}", json=json, data=data, headers=headers)


def get(path, token=None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return requests.get(f"{BASE}{path}", headers=headers)


def login(email, password):
    r = post("/auth/login", data={"username": email, "password": password})
    if r.status_code != 200:
        print(f"Login failed for {email}: {r.status_code} {r.text}")
        sys.exit(1)
    return r.json()["access_token"]


def random_dob_for_class(order_index):
    # order_index 0 = Nursery (~age 3), climbing roughly one year per class
    age = 3 + order_index
    year = 2026 - age
    month = random.randint(1, 12)
    day = random.randint(1, 28)
    return f"{year}-{month:02d}-{day:02d}"


def random_name():
    gender = random.choice(["Male", "Female"])
    first = random.choice(MALE_FIRST_NAMES if gender == "Male" else FEMALE_FIRST_NAMES)
    last = random.choice(LAST_NAMES)
    return f"{first} {last}", gender


def ensure_sections(school_class_id, academic_token):
    """Tops up a class to exactly SECTIONS_PER_CLASS sections."""
    sections = get(f"/classes/{school_class_id}/sections").json()
    while len(sections) < SECTIONS_PER_CLASS:
        r = post("/sections/", json={"school_class_id": school_class_id, "capacity": 40}, token=academic_token)
        if r.status_code != 201:
            print(f"    Failed to add section: {r.status_code} {r.text}")
            break
        sections.append(r.json())
    return sections


def fill_section(section_id, school_id, academic_year_id, order_index, admissions_token, counter):
    """Tops up a section to exactly STUDENTS_PER_SECTION students."""
    existing = get(f"/students/?school_id={school_id}&section_id={section_id}").json()
    needed = STUDENTS_PER_SECTION - len(existing)
    created = 0

    for _ in range(needed):
        full_name, gender = random_name()
        guardian_first = random.choice(LAST_NAMES)
        phone = f"9{random.randint(100000000, 999999999)}"

        gr = post("/guardians/", json={
            "school_id": school_id,
            "full_name": f"{guardian_first} (Guardian)",
            "relation": random.choice(["father", "mother"]),
            "phone": phone,
        }, token=admissions_token)
        guardian_id = gr.json().get("id") if gr.status_code == 201 else None

        counter[0] += 1
        sr = post("/students/", json={
            "school_id": school_id,
            "academic_year_id": academic_year_id,
            "section_id": section_id,
            "admission_number": f"2026-{counter[0]:04d}",
            "full_name": full_name,
            "date_of_birth": random_dob_for_class(order_index),
            "gender": gender,
            "guardian_name": f"{guardian_first} (Guardian)",
            "guardian_phone": phone,
            "guardian_id": guardian_id,
        })
        if sr.status_code == 201:
            created += 1
        else:
            print(f"    Student creation failed: {sr.status_code} {sr.text}")

    return created


def main():
    print("=== Checking backend is reachable ===")
    try:
        requests.get(f"{BASE}/health", timeout=3)
    except requests.exceptions.ConnectionError:
        print("Backend not reachable — start it with: python -m uvicorn app.main:app --reload")
        sys.exit(1)

    school_admin_token = login(SCHOOL_ADMIN_EMAIL, SCHOOL_ADMIN_PASSWORD)
    me = get("/auth/me", token=school_admin_token).json()
    school_id = me["school_id"]
    print(f"=== Working on school_id={school_id} ===")

    academic_token = login(ACADEMIC_EMAIL, ACADEMIC_PASSWORD)
    admissions_token = login(ADMISSIONS_EMAIL, ADMISSIONS_PASSWORD)

    years = get(f"/academic-years/?school_id={school_id}").json()
    current_year = next((y for y in years if y["is_current"]), years[0])
    academic_year_id = current_year["id"]

    print("=== Ensuring teacher pool exists ===")
    existing_staff = get(f"/staff/?school_id={school_id}&role_name=teacher", token=school_admin_token).json()
    existing_emails = {s["email"] for s in existing_staff}
    created_teachers = 0
    for name in TEACHER_NAMES:
        slug = name.lower().replace(" ", ".")
        email = f"{slug}@greenvalley.edu"
        if email in existing_emails:
            continue
        r = post("/auth/register", json={
            "role_name": "teacher",
            "full_name": name, "email": email,
        }, token=school_admin_token)
        if r.status_code == 201:
            temp_password = r.json()["temporary_password"]
            temp_token = login("/auth/login", email, temp_password)
            post("/auth/change-password", json={"current_password": temp_password, "new_password": "TeacherPass123"}, token=temp_token)
            created_teachers += 1
    print(f"  {created_teachers} new teachers created (existing ones skipped).")

    print("=== Ensuring subjects exist ===")
    existing_subjects = get(f"/subjects?school_id={school_id}").json()
    existing_subject_names = {s["name"] for s in existing_subjects}
    for name in SUBJECTS:
        if name not in existing_subject_names:
            post("/subjects", json={"school_id": school_id, "name": name}, token=academic_token)
    print(f"  Subjects ensured: {SUBJECTS}")

    classes = get(f"/classes/?school_id={school_id}").json()
    classes.sort(key=lambda c: c["order_index"])
    print(f"=== Populating {len(classes)} classes x {SECTIONS_PER_CLASS} sections x {STUDENTS_PER_SECTION} students ===")

    # Track a running admission-number counter so we never collide, even
    # across multiple runs — start well past anything seed_demo_data.py used.
    existing_students_count = get(f"/students/?school_id={school_id}").json()
    counter = [1000 + len(existing_students_count)]

    total_created = 0
    for school_class in classes:
        sections = ensure_sections(school_class["id"], academic_token)
        section_names = [s["name"] for s in sections]
        print(f"  {school_class['name']}: sections {section_names}")

        for section in sections:
            created = fill_section(
                section["id"], school_id, academic_year_id,
                school_class["order_index"], admissions_token, counter,
            )
            total_created += created
            if created:
                print(f"    Section {section['name']}: +{created} students")

    print()
    print(f"=== Done. {total_created} new students created across the school. ===")
    print(f"Teacher login pattern: firstname.lastname@greenvalley.edu / TeacherPass123")


if __name__ == "__main__":
    main()
