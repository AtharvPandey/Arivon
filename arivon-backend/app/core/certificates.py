"""
Transfer Certificate (TC) generation — the most-generated document in
any Indian school, per the School Admin plan. Produces a standard-format
PDF (the fields here match what CBSE/State Board TCs conventionally
require) and stores it as a Document row, reusing the existing
polymorphic Document model rather than inventing a parallel storage
mechanism just for certificates.
"""

import os
import uuid
from datetime import date

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER

from app import models

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def generate_transfer_certificate_pdf(
    student: models.Student,
    school: models.School,
    school_class_name: str,
    section_name: str | None,
    tc_number: str,
) -> str:
    """
    Builds the actual PDF file on disk and returns its stored filename
    (not the full path — matches the convention every other upload in
    Arivon already uses via Document.stored_filename).
    """
    stored_filename = f"{uuid.uuid4().hex}.pdf"
    stored_path = os.path.join(UPLOAD_DIR, stored_filename)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TCTitle", parent=styles["Title"], fontSize=16, alignment=TA_CENTER, spaceAfter=4)
    school_style = ParagraphStyle("SchoolName", parent=styles["Title"], fontSize=14, alignment=TA_CENTER)
    sub_style = ParagraphStyle("SchoolSub", parent=styles["Normal"], fontSize=9, alignment=TA_CENTER, textColor=colors.grey)

    doc = SimpleDocTemplate(stored_path, pagesize=A4, topMargin=25 * mm, bottomMargin=20 * mm, leftMargin=20 * mm, rightMargin=20 * mm)
    story = []

    story.append(Paragraph(school.name, school_style))
    subtitle_parts = [p for p in [school.board_type, school.city, school.state] if p]
    if subtitle_parts:
        story.append(Paragraph(" · ".join(subtitle_parts), sub_style))
    if school.udise_code:
        story.append(Paragraph(f"UDISE+ Code: {school.udise_code}", sub_style))
    story.append(Spacer(1, 14))
    story.append(Paragraph("TRANSFER CERTIFICATE", title_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"TC No: <b>{tc_number}</b> &nbsp;&nbsp;&nbsp; Date of Issue: <b>{date.today().strftime('%d-%m-%Y')}</b>", styles["Normal"]))
    story.append(Spacer(1, 16))

    rows = [
        ["1. Name of the Student", student.full_name],
        ["2. Father's/Guardian's Name", student.guardian_name],
        ["3. Admission Number", student.admission_number],
        ["4. Date of Birth", student.date_of_birth.strftime("%d-%m-%Y")],
        ["5. Nationality", student.nationality or "Indian"],
        ["6. Category", student.category or "—"],
        ["7. Class at the time of leaving", f"{school_class_name}" + (f" - {section_name}" if section_name else "")],
        ["8. Date of Leaving", student.date_of_leaving.strftime("%d-%m-%Y") if student.date_of_leaving else "—"],
        ["9. Reason for Leaving", student.leaving_reason or "—"],
        ["10. Conduct", "Good"],
    ]
    table = Table(rows, colWidths=[70 * mm, 95 * mm])
    table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
    ]))
    story.append(table)
    story.append(Spacer(1, 40))

    signature_row = Table(
        [["", ""], ["Class Teacher", "Principal / Head of Institution"]],
        colWidths=[82 * mm, 82 * mm],
    )
    signature_row.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (0, 0), 0.75, colors.black),
        ("LINEABOVE", (1, 0), (1, 0), 0.75, colors.black),
        ("TOPPADDING", (0, 0), (-1, 0), 30),
        ("FONTSIZE", (0, 1), (-1, 1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(signature_row)

    doc.build(story)
    return stored_filename


def generate_report_card_pdf(student, school, exam, result, class_name: str, section_name: str) -> str:
    """
    Report card PDF — school header, student details, a per-subject
    marks table, and the overall total/percentage/grade/rank/result
    summary. Kept board-agnostic on purpose rather than hardcoding a
    CBSE-only layout: every school's marks table and summary look
    essentially the same regardless of board, and this same output
    already carries a computed grade (see percentage_to_grade in
    exams.py) alongside raw marks, which is what CBSE's CCE format and
    most State Board formats both actually need.
    """
    stored_filename = f"{uuid.uuid4().hex}.pdf"
    stored_path = os.path.join(UPLOAD_DIR, stored_filename)

    styles = getSampleStyleSheet()
    school_style = ParagraphStyle("RCSchoolName", parent=styles["Title"], fontSize=14, alignment=TA_CENTER)
    sub_style = ParagraphStyle("RCSchoolSub", parent=styles["Normal"], fontSize=9, alignment=TA_CENTER, textColor=colors.grey)
    title_style = ParagraphStyle("RCTitle", parent=styles["Title"], fontSize=15, alignment=TA_CENTER, spaceAfter=4)

    doc = SimpleDocTemplate(stored_path, pagesize=A4, topMargin=20 * mm, bottomMargin=18 * mm, leftMargin=20 * mm, rightMargin=20 * mm)
    story = []

    story.append(Paragraph(school.name, school_style))
    subtitle_parts = [p for p in [school.board_type, school.city, school.state] if p]
    if subtitle_parts:
        story.append(Paragraph(" · ".join(subtitle_parts), sub_style))
    story.append(Spacer(1, 10))
    story.append(Paragraph(f"REPORT CARD — {exam.name}", title_style))
    story.append(Spacer(1, 12))

    info_rows = [
        ["Student Name", result.student_name, "Admission No.", result.admission_number],
        ["Class", f"{class_name} - {section_name}", "Rank", str(result.rank)],
    ]
    info_table = Table(info_rows, colWidths=[35 * mm, 55 * mm, 30 * mm, 45 * mm])
    info_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 14))

    marks_rows = [["Subject", "Max Marks", "Marks Obtained", "Grade", "Result"]]
    for s in result.subjects:
        obtained_display = "Absent" if s.is_absent else (str(s.marks_obtained) if s.marks_obtained is not None else "—")
        marks_rows.append([
            s.subject_name, str(s.max_marks), obtained_display,
            s.grade or ("—" if s.is_absent else ""), "Pass" if s.passed else "Fail",
        ])
    marks_table = Table(marks_rows, colWidths=[55 * mm, 30 * mm, 35 * mm, 25 * mm, 20 * mm])
    marks_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(marks_table)
    story.append(Spacer(1, 16))

    summary_rows = [
        ["Total Marks", f"{result.total_obtained} / {result.total_max}"],
        ["Percentage", f"{result.percentage}%"],
        ["Overall Grade", result.overall_grade],
        ["Result", "PASS" if result.passed else "FAIL"],
    ]
    summary_table = Table(summary_rows, colWidths=[50 * mm, 50 * mm])
    summary_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 10.5),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 3), (1, 3), "Helvetica-Bold"),
        ("TEXTCOLOR", (1, 3), (1, 3), colors.HexColor("#16A34A") if result.passed else colors.HexColor("#DC2626")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 40))

    signature_row = Table(
        [["", "", ""], ["Class Teacher", "Principal", "Parent/Guardian Signature"]],
        colWidths=[54 * mm, 54 * mm, 54 * mm],
    )
    signature_row.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, 0), 0.75, colors.black),
        ("TOPPADDING", (0, 0), (-1, 0), 30),
        ("FONTSIZE", (0, 1), (-1, 1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(signature_row)

    doc.build(story)
    return stored_filename


def generate_fee_receipt_pdf(student, school, payment, invoice, fee_category_name: str | None = None) -> str:
    """
    A fee receipt — deliberately compact (a single small page, not a
    full-page document) since this is handed over or shared at the
    payment counter, not filed away like a report card or TC.
    """
    stored_filename = f"{uuid.uuid4().hex}.pdf"
    stored_path = os.path.join(UPLOAD_DIR, stored_filename)

    styles = getSampleStyleSheet()
    school_style = ParagraphStyle("RcptSchoolName", parent=styles["Title"], fontSize=13, alignment=TA_CENTER)
    sub_style = ParagraphStyle("RcptSub", parent=styles["Normal"], fontSize=8.5, alignment=TA_CENTER, textColor=colors.grey)
    title_style = ParagraphStyle("RcptTitle", parent=styles["Title"], fontSize=13, alignment=TA_CENTER, spaceAfter=2)

    doc = SimpleDocTemplate(stored_path, pagesize=A4, topMargin=20 * mm, bottomMargin=20 * mm, leftMargin=25 * mm, rightMargin=25 * mm)
    story = []

    story.append(Paragraph(school.name, school_style))
    subtitle_parts = [p for p in [school.city, school.state] if p]
    if subtitle_parts:
        story.append(Paragraph(" · ".join(subtitle_parts), sub_style))
    story.append(Spacer(1, 10))
    story.append(Paragraph("FEE RECEIPT", title_style))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        f"Receipt No: <b>{payment.receipt_number}</b> &nbsp;&nbsp;&nbsp; Date: <b>{payment.payment_date.strftime('%d-%m-%Y')}</b>",
        styles["Normal"],
    ))
    story.append(Spacer(1, 14))

    rows = [
        ["Student Name", student.full_name],
        ["Admission Number", student.admission_number],
        ["Fee Type", fee_category_name or "—"],
        ["Billing Period", invoice.billing_period],
        ["Payment Method", payment.payment_method.replace("_", " ").upper()],
    ]
    if payment.notes:
        rows.append(["Notes", payment.notes])

    info_table = Table(rows, colWidths=[50 * mm, 95 * mm])
    info_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 16))

    amount_table = Table([["Amount Received", f"Rs. {payment.amount:,}"]], colWidths=[75 * mm, 70 * mm])
    amount_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 13),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F0FDF4")),
        ("TEXTCOLOR", (1, 0), (1, 0), colors.HexColor("#16A34A")),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(amount_table)
    story.append(Spacer(1, 30))

    story.append(Paragraph("This is a computer-generated receipt.", sub_style))

    doc.build(story)
    return stored_filename


def _generate_number(prefix: str) -> str:
    return f"{prefix}-{date.today().year}-{uuid.uuid4().hex[:6].upper()}"


def generate_text_certificate_pdf(student, school, title: str, body_paragraphs: list[str], certificate_number: str) -> str:
    """
    Shared by Character, Bonafide, Study, and Migration certificates —
    every one of these is genuinely the same document shape (a
    letterhead, a title, a few paragraphs of formal text, a signature
    block), so one function renders all four rather than duplicating
    near-identical layout code four times. Only the title and paragraph
    text differ per certificate type.
    """
    stored_filename = f"{uuid.uuid4().hex}.pdf"
    stored_path = os.path.join(UPLOAD_DIR, stored_filename)

    styles = getSampleStyleSheet()
    school_style = ParagraphStyle("CertSchoolName", parent=styles["Title"], fontSize=15, alignment=TA_CENTER)
    sub_style = ParagraphStyle("CertSub", parent=styles["Normal"], fontSize=9, alignment=TA_CENTER, textColor=colors.grey)
    title_style = ParagraphStyle("CertTitle", parent=styles["Title"], fontSize=14, alignment=TA_CENTER, spaceAfter=4, textColor=colors.HexColor("#1E3A8A"))
    body_style = ParagraphStyle("CertBody", parent=styles["Normal"], fontSize=11, leading=18, alignment=4, spaceAfter=12)  # 4 = justify

    doc = SimpleDocTemplate(stored_path, pagesize=A4, topMargin=25 * mm, bottomMargin=25 * mm, leftMargin=25 * mm, rightMargin=25 * mm)
    story = []

    story.append(Paragraph(school.name, school_style))
    subtitle_parts = [p for p in [school.board_type, school.city, school.state] if p]
    if subtitle_parts:
        story.append(Paragraph(" · ".join(subtitle_parts), sub_style))
    story.append(Spacer(1, 6))
    story.append(Paragraph(f"Certificate No: {certificate_number}", sub_style))
    story.append(Spacer(1, 16))
    story.append(Paragraph(title.upper(), title_style))
    story.append(Spacer(1, 14))

    for para in body_paragraphs:
        story.append(Paragraph(para, body_style))

    story.append(Spacer(1, 40))
    signature_row = Table([["", ""], ["Date: " + date.today().strftime("%d-%m-%Y"), "Principal's Signature"]], colWidths=[75 * mm, 75 * mm])
    signature_row.setStyle(TableStyle([
        ("LINEABOVE", (1, 0), (1, 0), 0.75, colors.black),
        ("TOPPADDING", (0, 0), (-1, 0), 30),
        ("FONTSIZE", (0, 1), (-1, 1), 9),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
    ]))
    story.append(signature_row)

    doc.build(story)
    return stored_filename


def generate_achievement_certificate_pdf(student, school, achievement) -> str:
    """A more decorative certificate — achievements are meant to be
    displayed/kept, not filed away, so this gets a bordered, celebratory
    layout rather than the plain-letter format of the other certificates."""
    stored_filename = f"{uuid.uuid4().hex}.pdf"
    stored_path = os.path.join(UPLOAD_DIR, stored_filename)

    styles = getSampleStyleSheet()
    school_style = ParagraphStyle("AchSchool", parent=styles["Normal"], fontSize=11, alignment=TA_CENTER, textColor=colors.grey)
    heading_style = ParagraphStyle("AchHeading", parent=styles["Title"], fontSize=28, alignment=TA_CENTER, textColor=colors.HexColor("#B45309"), spaceAfter=6)
    sub_style = ParagraphStyle("AchSub", parent=styles["Normal"], fontSize=12, alignment=TA_CENTER, textColor=colors.grey)
    name_style = ParagraphStyle("AchName", parent=styles["Title"], fontSize=22, alignment=TA_CENTER, spaceBefore=14, spaceAfter=6)
    body_style = ParagraphStyle("AchBody", parent=styles["Normal"], fontSize=12, alignment=TA_CENTER, leading=18, spaceAfter=8)

    doc = SimpleDocTemplate(stored_path, pagesize=A4, topMargin=35 * mm, bottomMargin=30 * mm, leftMargin=30 * mm, rightMargin=30 * mm)
    story = []

    story.append(Paragraph(school.name, school_style))
    story.append(Spacer(1, 20))
    story.append(Paragraph("CERTIFICATE", heading_style))
    story.append(Paragraph("OF ACHIEVEMENT", sub_style))
    story.append(Spacer(1, 24))
    story.append(Paragraph("This certificate is proudly presented to", sub_style))
    story.append(Paragraph(student.full_name, name_style))

    body_lines = [f"for {achievement.title}"]
    if achievement.event_name:
        body_lines.append(f"at {achievement.event_name}")
    if achievement.position:
        body_lines.append(f"Position: {achievement.position}")
    for line in body_lines:
        story.append(Paragraph(line, body_style))

    story.append(Spacer(1, 8))
    story.append(Paragraph(achievement.achievement_date.strftime("%d %B %Y"), sub_style))
    story.append(Spacer(1, 50))

    signature_row = Table([["", ""], ["Class Teacher", "Principal"]], colWidths=[75 * mm, 75 * mm])
    signature_row.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, 0), 0.75, colors.black),
        ("TOPPADDING", (0, 0), (-1, 0), 30),
        ("FONTSIZE", (0, 1), (-1, 1), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(signature_row)

    doc.build(story)
    return stored_filename


def generate_student_id_card_pdf(student, school, class_name: str, section_name: str) -> str:
    """
    A compact card, not a full page — printed on card stock and cut
    out, matching how a real school ID card is actually produced.
    Rendered as ONE nested table (header row + photo/details row +
    footer row) with a single outer border wrapping the whole thing, so
    the card has an actual visible frame — not just floating text.
    """
    stored_filename = f"{uuid.uuid4().hex}.pdf"
    stored_path = os.path.join(UPLOAD_DIR, stored_filename)

    CARD_WIDTH = 85.6 * mm

    styles = getSampleStyleSheet()
    school_style = ParagraphStyle("IDSchool", parent=styles["Normal"], fontSize=8.5, alignment=TA_CENTER, textColor=colors.white, fontName="Helvetica-Bold", leading=10)
    name_style = ParagraphStyle("IDName", parent=styles["Normal"], fontSize=12, fontName="Helvetica-Bold", alignment=TA_CENTER, spaceAfter=1, textColor=colors.HexColor("#1E293B"))
    class_style = ParagraphStyle("IDClass", parent=styles["Normal"], fontSize=9, alignment=TA_CENTER, textColor=colors.HexColor("#4F46E5"), fontName="Helvetica-Bold")
    label_style = ParagraphStyle("IDLabel", parent=styles["Normal"], fontSize=6.5, textColor=colors.grey)
    value_style = ParagraphStyle("IDValue", parent=styles["Normal"], fontSize=7.5, textColor=colors.HexColor("#1E293B"), fontName="Helvetica-Bold")
    footer_style = ParagraphStyle("IDFooter", parent=styles["Normal"], fontSize=6, alignment=TA_CENTER, textColor=colors.grey)

    doc = SimpleDocTemplate(stored_path, pagesize=A4, topMargin=40 * mm, bottomMargin=40 * mm, leftMargin=52 * mm, rightMargin=52 * mm)
    story = []

    # Photo placeholder — a plain box with an initial when no photo is
    # on file, matching the exact behavior every profile page in the
    # app already uses (initial-letter avatar as the fallback).
    initial = student.full_name[0].upper() if student.full_name else "?"
    photo_cell = Table([[initial]], colWidths=[18 * mm], rowHeights=[18 * mm])
    photo_cell.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#E0E7FF")),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#4F46E5")),
        ("FONTSIZE", (0, 0), (-1, -1), 16),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#C7D2FE")),
    ]))

    details_rows = [
        [Paragraph("CLASS", label_style), Paragraph(f"{class_name} - {section_name}", value_style)],
        [Paragraph("ADMISSION NO", label_style), Paragraph(student.admission_number, value_style)],
    ]
    if student.blood_group:
        details_rows.append([Paragraph("BLOOD GROUP", label_style), Paragraph(student.blood_group, value_style)])
    details_table = Table(details_rows, colWidths=[22 * mm, 40 * mm])
    details_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))

    photo_and_details = Table([[photo_cell, details_table]], colWidths=[24 * mm, 61.6 * mm])
    photo_and_details.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))

    card_rows = [
        [Paragraph(school.name, school_style)],
        [Spacer(1, 8)],
        [Paragraph(student.full_name, name_style)],
        [Paragraph(f"{class_name} - {section_name}", class_style)],
        [Spacer(1, 8)],
        [photo_and_details],
        [Spacer(1, 6)],
        [Paragraph(f"Guardian: {student.guardian_name} &nbsp;·&nbsp; {student.guardian_phone}", footer_style)],
        [Spacer(1, 4)],
        [Paragraph("If found, please return to the school office.", footer_style)],
    ]
    card = Table(card_rows, colWidths=[CARD_WIDTH])
    card.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 1.2, colors.HexColor("#4F46E5")),
        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#4F46E5")),
        ("TOPPADDING", (0, 0), (0, 0), 6), ("BOTTOMPADDING", (0, 0), (0, 0), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(card)

    doc.build(story)
    return stored_filename


def generate_staff_id_card_pdf(staff_user, staff_profile, school) -> str:
    """Same bordered-card layout as the student ID, using StaffProfile
    for designation/department/employee ID where available. Renders a
    complete, well-structured card even when the staff profile is
    entirely missing (common for admin-created accounts that skip
    StaffProfile setup) — the card never looks broken or unfinished,
    it just omits rows that have nothing to show."""
    stored_filename = f"{uuid.uuid4().hex}.pdf"
    stored_path = os.path.join(UPLOAD_DIR, stored_filename)

    CARD_WIDTH = 85.6 * mm

    styles = getSampleStyleSheet()
    school_style = ParagraphStyle("IDSchool2", parent=styles["Normal"], fontSize=8.5, alignment=TA_CENTER, textColor=colors.white, fontName="Helvetica-Bold", leading=10)
    name_style = ParagraphStyle("IDName2", parent=styles["Normal"], fontSize=12, fontName="Helvetica-Bold", alignment=TA_CENTER, spaceAfter=1, textColor=colors.HexColor("#1E293B"))
    role_style = ParagraphStyle("IDRole2", parent=styles["Normal"], fontSize=9, alignment=TA_CENTER, textColor=colors.HexColor("#0F172A"), fontName="Helvetica-Bold")
    label_style = ParagraphStyle("IDLabel2", parent=styles["Normal"], fontSize=6.5, textColor=colors.grey)
    value_style = ParagraphStyle("IDValue2", parent=styles["Normal"], fontSize=7.5, textColor=colors.HexColor("#1E293B"), fontName="Helvetica-Bold")
    footer_style = ParagraphStyle("IDFooter2", parent=styles["Normal"], fontSize=6, alignment=TA_CENTER, textColor=colors.grey)

    doc = SimpleDocTemplate(stored_path, pagesize=A4, topMargin=40 * mm, bottomMargin=40 * mm, leftMargin=52 * mm, rightMargin=52 * mm)
    story = []

    initial = staff_user.full_name[0].upper() if staff_user.full_name else "?"
    photo_cell = Table([[initial]], colWidths=[18 * mm], rowHeights=[18 * mm])
    photo_cell.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#E2E8F0")),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0F172A")),
        ("FONTSIZE", (0, 0), (-1, -1), 16),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
    ]))

    details_rows = []
    if staff_profile and staff_profile.employee_id:
        details_rows.append([Paragraph("EMPLOYEE ID", label_style), Paragraph(staff_profile.employee_id, value_style)])
    if staff_profile and staff_profile.department:
        details_rows.append([Paragraph("DEPARTMENT", label_style), Paragraph(staff_profile.department, value_style)])
    if not details_rows:
        details_rows.append([Paragraph("ROLE", label_style), Paragraph((staff_user.role_name or "Staff").replace("_", " ").title(), value_style)])
    details_table = Table(details_rows, colWidths=[24 * mm, 38 * mm])
    details_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))

    photo_and_details = Table([[photo_cell, details_table]], colWidths=[24 * mm, 61.6 * mm])
    photo_and_details.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))

    card_rows = [
        [Paragraph(school.name, school_style)],
        [Spacer(1, 8)],
        [Paragraph(staff_user.full_name, name_style)],
        [Paragraph((staff_profile.designation if staff_profile and staff_profile.designation else (staff_user.role_name or "Staff").replace("_", " ").title()), role_style)],
        [Spacer(1, 8)],
        [photo_and_details],
        [Spacer(1, 6)],
        [Paragraph(staff_profile.phone if staff_profile and staff_profile.phone else staff_user.email, footer_style)],
        [Spacer(1, 4)],
        [Paragraph("If found, please return to the school office.", footer_style)],
    ]
    card = Table(card_rows, colWidths=[CARD_WIDTH])
    card.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 1.2, colors.HexColor("#0F172A")),
        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#0F172A")),
        ("TOPPADDING", (0, 0), (0, 0), 6), ("BOTTOMPADDING", (0, 0), (0, 0), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(card)

    doc.build(story)
    return stored_filename
