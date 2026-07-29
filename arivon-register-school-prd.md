# Arivon Platform — "Register School" Onboarding Wizard
### Product Requirements Document (PRD)

**Actor:** Platform Super Admin
**Goal:** Registering a school should produce a complete, immediately-usable digital organization — not just a database row with a name and an admin login.

---

## 0. Design Principles

1. **A wizard, not a form.** Ten logical steps, each with a single clear purpose, each independently validated before the person can move on. Nobody should reach step 9 and discover step 2 was wrong.
2. **Everything entered here becomes real, structured data on day one** — not free text buried in a "notes" field. The Affiliation Number, the UDISE+ code, the grading system — these all become fields other parts of Arivon (government compliance exports, report cards, ID cards) will read from later. Get the modeling right here once, rather than retrofitting it under a live school later.
3. **Auto-generate wherever the answer is derivable.** If the person tells us the board and state, we can pre-fill a plausible school-year date range. If they tell us the school type, we can suggest (not force) sensible defaults for the rest. A wizard that makes the person type things Arivon could have inferred is a wizard that gets abandoned halfway.
4. **Nothing here is a dead end.** Every optional field skipped today can be filled in later from Settings — the wizard's job is to capture the minimum that makes the school *usable*, not to be a lifetime data-entry marathon.

---

## 1. Global Wizard Behavior

| Aspect | Behavior |
|---|---|
| **Progress indicator** | Persistent horizontal stepper across the top: 10 numbered steps, current step highlighted, completed steps show a checkmark, upcoming steps are dimmed but visible (so the Super Admin always sees the whole journey, not just "step 3 of ???"). |
| **Navigation** | "Back" always available and never loses entered data. "Next" is disabled until the current step's required fields validate. A "Save & Exit" option persists a draft school registration so a long onboarding (e.g. waiting on a document scan) can be resumed later. |
| **Validation timing** | Inline, on blur — never "submit and see 12 errors at once." Each field validates the moment the person leaves it. |
| **Draft persistence** | The in-progress registration is saved as a `draft` school record after Step 1 is completed, so a browser refresh or crash doesn't lose 20 minutes of work. |
| **Exit confirmation** | Leaving mid-wizard (not via Save & Exit) prompts "You have unsaved progress in this step — leave anyway?" |

---

## 2. Step-by-Step Specification

### Step 1 — School Identity

**Purpose:** Establish the school's core identity — the name and type that will appear everywhere in the product, from the login screen to report cards.

| Field | Required | Type | Validation | Description |
|---|---|---|---|---|
| School Name | Yes | Text | 3-150 chars | Full legal/operating name, e.g. "Green Valley Public School" |
| Short Name / Display Name | No | Text | Max 30 chars | Used in tight UI spaces (mobile headers, ID cards) if the full name is long |
| School Type | Yes | Dropdown | — | Private / Government / Government-Aided / Trust-run / International |
| School Category | Yes | Dropdown | — | Co-ed / Boys / Girls |
| Year Established | No | Year picker | 1800–current year | Displayed on official documents/website integrations later |
| School Motto/Tagline | No | Text | Max 100 chars | Optional, appears on branded materials |

**UX recommendations:** School Name is the very first field, auto-focused. As the person types, show a live preview card ("This is how your school will appear") — turns an abstract form into something that feels real immediately.

**Error handling:** Duplicate school-name detection is a soft warning, not a hard block ("A school named 'Green Valley Public School' already exists in Bangalore — is this the same institution?") since legitimate same-named schools exist across different cities.

**Auto-generated:** An internal `school_slug` (URL-safe identifier) is generated from the name silently — never shown to the user, used for future subdomain/branding features.

---

### Step 2 — Government Recognition & Affiliations

**Purpose:** Capture every official identifier the school needs for compliance, board reporting, and — critically — the data that later powers Arivon's government scheme export features (UDISE+, state portals) without re-entry.

| Field | Required | Type | Validation | Description |
|---|---|---|---|---|
| Education Board | Yes | Dropdown | — | CBSE / ICSE / State Board / IB / IGCSE / NIOS / Other |
| State Board Name | Conditional | Dropdown | Required if Board = "State Board" | e.g. Karnataka State Board, Maharashtra State Board |
| UDISE+ Code | Yes (India) | Text | Exactly 11 digits | The single most important government identifier — nearly every downstream compliance report keys off this |
| Affiliation Number | Yes | Text | Board-specific format | e.g. CBSE affiliation numbers are 6 digits |
| Affiliation Validity (From/To) | Yes | Date range | To ≥ From | Schools must periodically renew; Arivon can proactively remind before expiry |
| School Recognition Number | No | Text | — | State education department recognition, distinct from board affiliation |
| Trust / Society Registration Number | No | Text | — | For trust-run or society-run schools |
| PAN | Yes | Text | Valid PAN format (5 letters, 4 digits, 1 letter) | Required for financial/compliance features (fee receipts, TDS) |
| GST Number | No | Text | Valid GSTIN format if provided | Only relevant if the school is GST-registered |
| Affiliation Certificate (Upload) | Yes | PDF/Image | Max 10MB | Scanned copy of the board affiliation letter |
| Trust/Society Registration Certificate (Upload) | No | PDF/Image | Max 10MB | If applicable |

**Recommended dropdown values (Education Board):** CBSE, ICSE, State Board, IB (International Baccalaureate), IGCSE (Cambridge), NIOS, Other.

**Validation rules:** UDISE+ code format-checked (11 numeric digits) but not verified against the live government database in v1 — that's a real future integration, not a v1 blocker. PAN/GSTIN validated by regex pattern, not by live API lookup initially.

**UX recommendations:** Group this step visually into two clear sub-sections — "Board & Affiliation" and "Legal & Tax Identifiers" — since they're conceptually different concerns being captured together for onboarding efficiency, not because they're the same thing.

**Error handling:** If UDISE+ format is invalid, show the exact expected format inline ("UDISE+ codes are exactly 11 digits, e.g. 29130100107") rather than a generic "invalid" message.

---

### Step 3 — Address & Contact Information

**Purpose:** Where the school physically is, and how to reach it — powers everything from the platform's own school directory to future SMS/logistics features.

| Field | Required | Type | Validation | Description |
|---|---|---|---|---|
| Address Line 1 | Yes | Text | — | Building/street |
| Address Line 2 | No | Text | — | Locality/landmark |
| City | Yes | Text | — | |
| State | Yes | Dropdown | Indian states + UTs | |
| Pincode | Yes | Text | Exactly 6 digits | |
| Primary Contact Phone | Yes | Text | Valid Indian mobile/landline format | School's official reception number, not the admin's personal number |
| Primary Contact Email | Yes | Email | Valid email format | School's official email — distinct from the School Admin's login email |
| Website (if any) | No | URL | Valid URL format | |
| Google Maps Link | No | URL | — | Helps parents/visitors; also future-proofs a "nearby schools" discovery feature |

**UX recommendations:** Auto-suggest City/State from Pincode where feasible (India Post pincode lookup) to reduce typing — but always leave the fields editable, since pincode-to-city mapping isn't always perfectly reliable for newer localities.

**Validation rules:** Phone number format validated for Indian numbers (10 digits, optionally with +91 prefix) — this is a fixable, low-friction validation, not one requiring OTP verification at this stage.

---

### Step 4 — Management Details

**Purpose:** Who legally/administratively stands behind the school — the Trust/Society and its key office bearers, plus the first School Admin login (the actual person operating Arivon day to day).

| Field | Required | Type | Validation | Description |
|---|---|---|---|---|
| Trust/Society Name | No | Text | — | If the school operates under a trust |
| Chairman/President Name | No | Text | — | |
| Managing Director/Secretary Name | No | Text | — | |
| **School Admin Full Name** | Yes | Text | — | The person who will actually log in and run Arivon |
| **School Admin Email** | Yes | Email | Valid, unique across platform | This becomes their login |
| **School Admin Phone** | Yes | Text | Valid Indian mobile | For account recovery/support contact |
| **Temporary Password** | Yes | Text | Min 8 chars, 1 number, 1 special char | Set during onboarding; School Admin should be prompted to change on first login |

**UX recommendations:** Visually separate "Institutional Management" (Trust/Chairman — largely informational, optional) from "Your Arivon Login" (School Admin credentials — the functionally critical part of this step) so it's unmistakable which fields actually matter for getting into the product.

**Best practice:** Auto-generate a strong temporary password by default (shown once, copyable) rather than asking the Super Admin to invent one under time pressure — with an option to set a custom one instead.

**Error handling:** Email uniqueness is checked live (on blur) against the whole platform, not just this school — "This email is already registered to another school on Arivon" — since School Admin logins are platform-unique.

---

### Step 5 — Academic Configuration

**Purpose:** The operating rhythm of the school year — when it runs, how the day is structured, and the academic rules that every other module (attendance, timetable, report cards) will be built against.

| Field | Required | Type | Validation | Description |
|---|---|---|---|---|
| Academic Session Start Date | Yes | Date | — | e.g. June 1 |
| Academic Session End Date | Yes | Date | End ≥ Start | e.g. April 30 next year |
| School Timing (Start) | Yes | Time | — | e.g. 08:00 AM |
| School Timing (End) | Yes | Time | End > Start | e.g. 02:30 PM |
| Working Days | Yes | Multi-select | At least 1 selected | Mon-Sat checkboxes; most Indian schools select Mon-Sat minus one day off |
| Medium of Instruction | Yes | Dropdown (multi-select allowed) | — | English / Hindi / Regional language / Bilingual |
| Grading System | Yes | Dropdown | — | Percentage / GPA (10-point) / CGPA / Letter Grades (A-F) |
| Attendance Policy — Minimum % | Yes | Number | 0-100 | Minimum attendance % required for promotion eligibility, e.g. 75% |
| Promotion Policy | Yes | Dropdown | — | Automatic / Exam-based / Combined (attendance + exam) |

**Recommended dropdown values (Medium of Instruction):** English, Hindi, Regional Language (specify), Bilingual (English + Regional).

**UX recommendations:** Pre-fill Academic Session dates with the standard Indian school-year pattern (June-April) as an editable suggestion, not a locked default — schools in some states/systems vary.

**Auto-generated:** Once this step is saved, Arivon auto-provisions the full class ladder (Nursery through the school's top class, per Step 6) *tagged to this academic session* — this is the moment the abstract "school" becomes a structured academic entity with real classes.

---

### Step 6 — Classes Offered

**Purpose:** Exactly which grade levels this school runs — directly determines the auto-provisioned class ladder from Step 5, and needs to be more flexible than a simple "up to Class 10 or 12" toggle, since many real schools don't offer every stage (e.g. a Middle School the runs Class 6-10 only, or a Senior Secondary school that starts at Class 9).

| Field | Required | Type | Validation | Description |
|---|---|---|---|---|
| School Stage Coverage | Yes | Multi-select (checkboxes) | At least 1 selected | Pre-Primary (Nursery/LKG/UKG) / Primary (1-5) / Middle (6-8) / Secondary (9-10) / Higher Secondary (11-12) |
| Streams Offered (if Higher Secondary selected) | Conditional | Multi-select | — | Science / Commerce / Humanities |
| Sections per Class (default) | No | Number | 1-10 | Default number of sections to auto-create per class (e.g. "2" pre-creates A and B for every class); School Admin can add more later |

**UX recommendations:** Show a visual ladder diagram (Pre-Primary → Primary → Middle → Secondary → Higher Secondary) with each stage toggleable as a block, rather than 15 individual class checkboxes — matches how a Principal actually thinks about "what stages do we run," not a flat list of grades.

**Validation rules:** Stage selection must be contiguous in most real-world cases (a school can't sensibly offer Pre-Primary and Higher Secondary while skipping everything between) — the wizard should warn (not block) on a non-contiguous selection, since some genuine edge cases exist (e.g. a school phasing out primary intake).

**Auto-generated:** Selecting stages immediately provisions the matching `SchoolClass` rows for the current academic session, each tagged with its stage — no separate manual "create class" step exists elsewhere in the product, by design.

---

### Step 7 — Infrastructure

**Purpose:** A lightweight snapshot of physical capacity — mostly informational at this stage, but seeds future features (room-based timetabling, capacity planning, transport route planning).

| Field | Required | Type | Validation | Description |
|---|---|---|---|---|
| Total Campus Area (sq. ft / acres) | No | Number | — | |
| Number of Classrooms | No | Number | ≥ 0 | |
| Number of Laboratories | No | Number | ≥ 0 | Science/Computer/Language labs |
| Library (Yes/No) | No | Toggle | — | |
| Playground/Sports Facilities | No | Multi-select | — | Indoor / Outdoor / Both / None |
| Transport Facility | No | Toggle | — | Determines whether the Transport module is relevant to enable later |
| Hostel Facility | No | Toggle | — | Determines whether Hostel module is relevant later |
| Medical Room/Infirmary | No | Toggle | — | |

**UX recommendation:** Frame this step explicitly as optional and skippable in the UI copy ("This helps us tailor Arivon to your school — feel free to skip and fill in later") since none of it blocks functional usability, unlike Steps 1-6.

---

### Step 8 — Branding

**Purpose:** Every visual asset that makes Arivon *feel like the school's own system*, not a generic template — this is what appears on ID cards, report cards, certificates, and the login screen the School Admin and (eventually) parents will see.

| Asset | Required | Format | Size/Specs | Where it's used |
|---|---|---|---|---|
| School Logo | Yes | PNG/SVG, transparent background preferred | Recommended 512×512px, max 2MB | Sidebar, login screen, ID cards, letterhead |
| Banner/Cover Image | No | JPG/PNG | Recommended 1600×400px, max 5MB | Dashboard header, parent-facing views (future) |
| Primary Brand Color | Yes | Color picker (hex) | — | Sidebar accent, buttons — replaces Arivon's default violet with the school's own identity |
| Secondary Brand Color | No | Color picker (hex) | — | Complements primary for accents |
| Letterhead Template | No | PDF/Image upload | Max 10MB | Used as the header for official generated documents (TCs, circulars) |
| ID Card Template | No | Template selection or custom upload | — | Choose from Arivon's built-in templates, or upload school's existing design |
| Report Card Template | No | Template selection | — | Same pattern — built-in options vs. custom |
| Certificate Template(s) | No | Template selection/upload | — | For achievement/participation certificates generated later |
| School Seal/Stamp (digital) | No | PNG, transparent background | Max 2MB | Overlaid on official generated documents |

**UX recommendations:** Show a **live mock-up preview** (a sample ID card, a sample login screen) updating in real time as logo/colors are set — branding is inherently visual, and a form full of "upload" buttons with no preview badly undersells how much this personalizes the product.

**Best practice:** Every asset here is optional and defaults gracefully to Arivon's standard look — a school that skips this entire step should still get a clean, professional (just generic) experience, never a broken one.

---

### Step 9 — Subscription & Plan

**Purpose:** What the school is actually paying for, and which features are enabled from day one — this is where Platform Super Admin sets the commercial terms established with the school.

| Field | Required | Type | Validation | Description |
|---|---|---|---|---|
| Subscription Plan | Yes | Dropdown | — | Basic / Pro / Enterprise (or whatever tiering Arivon settles on) |
| Billing Cycle | Yes | Dropdown | — | Annual / Semi-Annual / Quarterly |
| Per-Student or Flat Pricing | Yes | Dropdown | — | Determines how the invoice to the *school* (not the school's own student fees) is calculated |
| Contract Start Date | Yes | Date | — | |
| Contract End Date / Renewal Date | Yes | Date | After start date | |
| Feature Flags Enabled | Yes | Multi-select (pre-filled by plan) | — | Finance module, Transport, Hostel, Library, etc. — plan-appropriate defaults, individually toggleable |
| Trial Period (if applicable) | No | Toggle + duration | — | e.g. 30-day trial before billing starts |

**UX recommendation:** Selecting a plan tier auto-checks the feature flags that tier includes (visually distinct from manually-added extras), so the Super Admin can see at a glance "this is what Pro includes" vs. "this is a custom add-on for this specific school."

**Auto-generated:** `subscription_status` is set to `trial` or `active` based on whether a trial period was configured — matches the existing Arivon subscription model.

---

### Step 10 — Review & Confirmation

**Purpose:** One final, complete summary before the school — and everything auto-provisioned alongside it (classes, sections, subscription) — becomes real and the School Admin's login goes live.

**Layout:** A single scrollable summary page, organized into the same 9 section headers as the wizard itself, each with an "Edit" link that jumps back to that exact step without losing progress elsewhere.

**Explicitly shown before confirmation:**
- Full school identity + branding preview (logo, colors) rendered as a mock login screen
- Every government identifier entered, with document upload status (✅ uploaded / ⚠️ not provided)
- The exact class ladder about to be created (e.g. "15 classes will be created: Nursery through Class 12")
- School Admin login email (with a note: *"An email will be sent to this address with login instructions"*)
- Subscription summary: plan, billing cycle, contract dates, enabled features

**Confirmation action:** A single prominent **"Create School"** button. On click:
1. School record created with all captured fields
2. School Admin login created
3. Academic session created → full class ladder auto-provisioned
4. Subscription/feature flags applied
5. Audit log entry recorded ("School X registered by Platform Admin Y")
6. Confirmation screen shown with the School Admin's login credentials and a **"Copy Credentials"** button (since this is the only time the temporary password is shown in plaintext)

**Error handling:** If creation fails partway (e.g. a database error after school creation but before class provisioning), the wizard should surface a clear, specific error and allow retry from Review — not silently leave a half-created school with no classes and no visible error.

**Post-creation:** Redirect to the Platform Dashboard's Schools table, with the newly created school highlighted/scrolled-into-view, and a toast confirmation: *"Green Valley Public School has been registered successfully."*

---

## 3. Priority Enhancements (Post-Review Additions)

These five areas were identified as necessary before implementation, in priority order. Each is specced to the same depth as the core wizard.

### 3.1 School Lifecycle & Verification Workflow (Highest Priority)

**The gap in the original design:** Step 10 ("Review & Confirmation") went straight from "Platform Admin clicks Create" to a fully active school. That's fine for a trusted internal demo, but wrong for a real commercial onboarding — a UDISE+ code or affiliation number typed into a form is an unverified claim, not a verified fact. Arivon shouldn't activate a paying tenant's full feature set before someone has actually looked at the uploaded affiliation certificate.

**The lifecycle:**

| State | Meaning | Who can enter it | What's accessible in this state |
|---|---|---|---|
| `draft` | Wizard in progress, not yet submitted | Platform Admin (mid-onboarding) | Nothing — school isn't visible outside the wizard |
| `pending_verification` | Wizard completed, submitted for review | Auto-transition on wizard completion | School exists, School Admin login is created but **login is blocked** with a "Your school is under verification" message |
| `verified` | Platform team has reviewed documents/identifiers and approved | Platform Admin (manual review action) | Auto-transitions to `active` immediately — this is a momentary internal state, mostly for audit-trail clarity |
| `active` | Fully live | System (on verification approval) | Full product access, per subscription plan |
| `rejected` | Verification failed (e.g. invalid/fraudulent affiliation document) | Platform Admin (manual review action) | School Admin sees a clear rejection reason; can resubmit corrected documents, looping back to `pending_verification` |
| `suspended` | Existing state — subscription/support issue | Platform Admin (manual, or automated on payment failure) | Read-only or fully blocked, per existing suspension behavior |
| `closed` | School has left the platform | Platform Admin (manual, end of contract) | Data retained per data-retention policy; no active access |

**State diagram (textual):**
```
draft → pending_verification → verified → active ⇄ suspended
                ↓                                      ↓
            rejected → (resubmit) → pending_verification
                                                        ↓
                                                    closed
```

**Verification review screen (new Platform Admin surface):** A queue of schools in `pending_verification`, each showing:
- All Step 2 government identifiers, side-by-side with the uploaded certificate images/PDFs (so the reviewer isn't switching tabs to cross-check)
- A checklist: "UDISE+ format valid," "Affiliation certificate legible," "Affiliation number matches certificate" — each manually ticked, not auto-verified in v1
- Approve / Reject actions, with a **mandatory reason field** on rejection

**Notifications:** School Admin receives an email at every state transition (submitted, verified, rejected-with-reason) — silence during a "your account is pending" period is exactly what erodes trust with a new customer.

**Best practice:** Verification should have a target SLA (e.g. "reviewed within 1 business day") surfaced to the School Admin, so "pending" doesn't feel indefinite.

---

### 3.2 Organization Settings

**The gap:** Nothing in the original wizard captures locale/formatting preferences — every school silently inherits hardcoded assumptions (IST, INR, DD-MM-YYYY, Monday-start weeks). Fine while Arivon is India-only, but these should be **explicit, stored settings**, not accidents of hardcoded defaults — both so international schools (already a category in Step 1) actually work correctly, and so nothing needs a code change later to become configurable.

| Field | Required | Type | Default | Description |
|---|---|---|---|---|
| Time Zone | Yes | Dropdown | Asia/Kolkata (IST) | Affects every timestamp display and any future scheduled notification |
| Currency | Yes | Dropdown | INR (₹) | Affects fee/finance module display formatting |
| Primary Language (UI) | Yes | Dropdown | English | The language Arivon's own interface displays in for this school's staff |
| Date Format | Yes | Dropdown | DD-MM-YYYY | DD-MM-YYYY / MM-DD-YYYY / YYYY-MM-DD |
| Number Format | Yes | Dropdown | Indian (lakh/crore grouping) | Indian (1,00,000) vs International (100,000) grouping |
| Week Start Day | Yes | Dropdown | Monday | Affects calendar widgets, weekly attendance views |
| Fiscal/Financial Year Start | No | Dropdown | April | Relevant for finance reporting cadence, distinct from Academic Session |

**Where this lives:** Presented as its own wizard step (recommend inserting as **Step 5**, immediately before the renumbered Academic Configuration, since academic session dates are easier to reason about once locale/timezone is established) — but every field remains editable later from Settings, never locked in permanently.

**UX recommendation:** Auto-detect and pre-fill Time Zone and Number Format from the school's State (Step 3) — nearly every school will accept the Indian defaults untouched, so this step should take most Platform Admins under 10 seconds, not feel like new homework.

---

### 3.3 Document & Compliance Management (with Expiry Tracking)

**The gap:** Step 2's document uploads were modeled as one-time attachments with no lifecycle — but affiliation certificates, fire safety certificates, and building safety certificates all **expire** in real schools, and a compliance failure discovered during a board inspection is exactly the kind of thing Arivon should proactively prevent, not just passively store.

**Extending the Document model:** every compliance document (not just the ones from Step 2 — this generalizes to any school-level compliance doc added later) gets:

| Field | Description |
|---|---|
| Document Type | Affiliation Certificate / Trust Registration / Fire Safety Certificate / Building Safety Certificate / Recognition Certificate / Other (extensible list) |
| Issue Date | When the document was issued |
| Expiry Date | Nullable — some documents (e.g. PAN) never expire; others (affiliation, safety certificates) do |
| Status (computed, not stored) | `valid` (no expiry, or expiry > 60 days away) / `expiring_soon` (expiry within 60 days) / `expired` (past expiry date) |
| Verified By | Platform Admin who confirmed it during the verification workflow (3.1) |
| Renewal Reminder Sent | Boolean, prevents duplicate reminder emails |

**Compliance Dashboard (new surface):**
- **Platform Admin view:** every school's compliance documents, sorted by soonest-expiring first, across the whole platform — a genuine "what needs my attention" list, same philosophy as the Needs Attention widgets we've built elsewhere in Arivon.
- **School Admin view:** their own school's documents only, same expiry-sorted view, with a direct "Renew" action that opens a re-upload flow (replacing the expiring document, retaining history of the old one rather than deleting it).

**Notification cadence:** Automatic reminder emails at 60 days, 30 days, and 7 days before expiry, escalating in urgency, sent to both the School Admin and (for the final 7-day warning) the Platform Admin as an internal alert too.

**Best practice:** Never silently expire a document's compliance status into something that blocks the school's operations — expiry should be visible and nagging, not punitive, since school compliance renewals are often genuinely slow bureaucratic processes outside the school's control.

---

### 3.4 Automatic Organization Provisioning

**The gap:** Today, registration provisions classes and a subscription — but a real school needs more scaffolding than that to feel "ready to use," not "ready to configure from scratch."

**What should be auto-provisioned at school creation, beyond the class ladder:**

| Item | What gets created | Why |
|---|---|---|
| **Departments** | Standard department records: Administration, Academics, Admissions, Finance, Front Office (extensible; School Admin can rename/add later) | Currently there's no `Department` entity at all in Arivon — staff have roles, but no organizational grouping. This is genuinely new modeling, not just a seed-data convenience. |
| **Default document templates** | A starter Report Card template, ID Card template, and Fee Receipt template, matching the school's board type where template content differs (e.g. CBSE report card format vs. ICSE) | So "generate a report card" produces something usable on day one, not a blank/broken page because no template was ever configured. |
| **Default Organization Settings** | The 3.2 settings, pre-filled with sensible defaults, not left null | Nothing in a freshly created school should have an unset/null configuration field that later code has to null-check around. |
| **Welcome notice** | An auto-posted Notice Board announcement: "Welcome to Arivon — here's how to get started," authored as if from the Platform team | First-login experience shouldn't be a completely empty Communication tab. |
| **Sample data toggle (optional)** | An explicit Platform Admin checkbox: "Populate with sample demo data" — wiring in something like our own `seed_full_school.py`/`seed_demo_data.py` scripts as an in-product action | Extremely useful for a school's *trial* period, letting a prospective customer click around a populated system instead of an empty one — must be clearly reversible/deletable before going live for real. |

**Best practice:** Every auto-provisioned item must be **editable and deletable** by the School Admin afterward — auto-provisioning accelerates setup, it never locks the school into Arivon's assumptions about how they should be organized.

---

### 3.5 Comprehensive Audit Trail

**The gap:** Arivon already has a `PlatformAuditLog` — but it only captures **Platform Admin actions on schools** (registered, suspended, feature toggled). It says nothing about what happens *inside* a school day to day — a fee waiver granted, a student's marks edited after initial entry, a staff account deactivated. For a system holding financial records and children's academic data, "who changed what, when" needs to be answerable at the school level too, not just the platform level.

**Proposed model — `SchoolAuditLog`** (parallel structure to the existing platform one, but scoped per school):

| Field | Description |
|---|---|
| School ID | Which school this event belongs to |
| Actor (User ID + Role) | Who performed the action |
| Action Type | e.g. `fee_waiver_granted`, `marks_edited`, `staff_deactivated`, `student_record_updated`, `document_deleted` |
| Entity Affected | Type + ID (e.g. `invoice:1042`, `student:88`) |
| Before/After Snapshot | For edits specifically — what changed, not just that something changed |
| Timestamp | |
| IP Address (optional) | For higher-sensitivity actions (fee waivers, marks changes) |

**What gets logged (not everything — selectively, on genuinely consequential actions):**
- Financial: fee waivers, discounts applied, payment record edits/deletions
- Academic: marks entry and any subsequent edits, promotion decisions, report card publication
- Administrative: staff account creation/deactivation, role changes, student record edits (especially guardian/contact info changes)
- Compliance: document uploads/deletions, verification decisions

**What does NOT get logged at this granularity:** routine reads (viewing a student's profile), attendance marking (already has its own `marked_by_user_id` field serving this purpose), anything already captured by a more specific existing mechanism — a generic audit log shouldn't duplicate structured data that already exists elsewhere.

**Who can view it:** School Admin and Principal see their own school's full log. Platform Admin can view a school's audit log **only** when Support Access is enabled for that school (reusing the exact support-access gate already built for the Platform layer) — this keeps the same "Platform can't interfere in daily operations" principle consistent here too.

**Retention:** Recommend a minimum 3-year retention given financial and academic record-keeping norms in Indian schools — configurable per compliance requirements, not hardcoded.

---



What already exists and is directly reusable:
- School creation + first School Admin login as one atomic action (`POST /platform/schools`)
- Academic session creation auto-provisioning the class ladder, now tagged by stage (`pre_primary` / `primary` / `middle` / `secondary` / `higher_secondary`)
- Subscription plan/status fields on the School model
- Feature flags system

What this PRD calls for that isn't built yet:
- **Multi-step wizard UI** — today, registration is a single form; this PRD calls for a genuine 10-step flow with draft persistence
- **Flexible stage selection** — today, `education_level` is a binary choice (`high_school` vs `higher_secondary`); this PRD calls for arbitrary stage combinations (e.g. Middle+Secondary only), which needs the underlying model extended
- **Government identifier fields** (UDISE+, Affiliation Number, PAN, GST, Trust/Society registration) — none of these exist on the School model yet
- **Document uploads at registration time** (affiliation certificate, registration certificates) — the generic Documents module exists, but isn't wired into the registration flow
- **Branding assets beyond logo/color** (letterhead, ID card/report card/certificate templates, seal) — `logo_url`/`primary_color` exist; the rest don't
- **Infrastructure snapshot** — entirely new, and lowest-priority given it's purely informational

**Recommended build order:** Government Recognition fields (highest real value — this is what actually differentiates Arivon and unlocks compliance exports later) → flexible Classes Offered → multi-step wizard UI wrapping the existing single-step flow → Branding expansion → Infrastructure (last, since it's the most skippable).
