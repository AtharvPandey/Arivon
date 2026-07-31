"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, FileEdit } from "lucide-react";
import { isPlatformLoggedIn, platformApiRequest, clearPlatformToken } from "../../../lib/platformApi";
import WizardStepper from "../../../components/registerSchoolWizard/WizardStepper";
import StepIdentity from "../../../components/registerSchoolWizard/steps/StepIdentity";
import StepGovernmentRecognition from "../../../components/registerSchoolWizard/steps/StepGovernmentRecognition";
import StepAddress from "../../../components/registerSchoolWizard/steps/StepAddress";
import StepManagement from "../../../components/registerSchoolWizard/steps/StepManagement";
import StepOrganizationSettings from "../../../components/registerSchoolWizard/steps/StepOrganizationSettings";
import StepAcademicConfig from "../../../components/registerSchoolWizard/steps/StepAcademicConfig";
import StepClasses from "../../../components/registerSchoolWizard/steps/StepClasses";
import StepInfrastructure from "../../../components/registerSchoolWizard/steps/StepInfrastructure";
import StepBranding from "../../../components/registerSchoolWizard/steps/StepBranding";
import StepSubscription from "../../../components/registerSchoolWizard/steps/StepSubscription";
import StepReview from "../../../components/registerSchoolWizard/steps/StepReview";

const STEPS = [
  { key: "identity", label: "Identity" },
  { key: "government", label: "Govt. Recognition" },
  { key: "address", label: "Address" },
  { key: "management", label: "Management" },
  { key: "org_settings", label: "Org Settings" },
  { key: "academic", label: "Academic Config" },
  { key: "classes", label: "Classes" },
  { key: "infrastructure", label: "Infrastructure" },
  { key: "branding", label: "Branding" },
  { key: "subscription", label: "Subscription" },
  { key: "review", label: "Review" },
];

const EMPTY_FORM_DATA = {
  identity: {},
  government_recognition: {},
  address_contact: {},
  management: {},
  organization_settings: {
    timezone: "Asia/Kolkata", currency: "INR", primary_language: "english",
    date_format: "DD-MM-YYYY", number_format: "indian", week_start_day: "monday",
    fiscal_year_start_month: 4,
  },
  academic_config: { working_days: [] },
  classes_offered: { stages: [] },
  infrastructure: {},
  branding: {},
  subscription: {},
};

function RegisterSchoolWizardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftIdFromUrl = searchParams.get("draft");

  const [mode, setMode] = useState("loading"); // "landing" | "wizard" | "loading"
  const [drafts, setDrafts] = useState([]);
  const [draftId, setDraftId] = useState(draftIdFromUrl ? Number(draftIdFromUrl) : null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [furthestIndex, setFurthestIndex] = useState(0);
  const [formData, setFormData] = useState(EMPTY_FORM_DATA);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isPlatformLoggedIn()) {
      router.push("/platform/login");
      return;
    }
    if (draftIdFromUrl) {
      loadDraft(Number(draftIdFromUrl));
    } else {
      loadLanding();
    }
  }, []);

  async function loadLanding() {
    try {
      const list = await platformApiRequest("/school-registration/drafts");
      setDrafts(list);
      setMode("landing");
    } catch (err) {
      setError(err.message);
      setMode("landing");
    }
  }

  async function loadDraft(id) {
    try {
      const draft = await platformApiRequest(`/school-registration/${id}`);
      setFormData({
        identity: {
          name: draft.name, short_name: draft.short_name, school_type: draft.school_type,
          school_category: draft.school_category, year_established: draft.year_established, motto: draft.motto,
        },
        government_recognition: {
          board_type: draft.board_type, state_board_name: draft.state_board_name,
          udise_code: draft.udise_code, affiliation_number: draft.affiliation_number,
          affiliation_valid_from: draft.affiliation_valid_from, affiliation_valid_to: draft.affiliation_valid_to,
          recognition_number: draft.recognition_number, trust_registration_number: draft.trust_registration_number,
          pan_number: draft.pan_number, gst_number: draft.gst_number,
        },
        address_contact: {
          address: draft.address, address_line_2: draft.address_line_2, city: draft.city, state: draft.state,
          pincode: draft.pincode, contact_phone: draft.contact_phone, contact_email: draft.contact_email,
          website_url: draft.website_url, google_maps_url: draft.google_maps_url,
        },
        management: {
          trust_name: draft.trust_name, chairman_name: draft.chairman_name,
          managing_director_name: draft.managing_director_name,
          admin_full_name: draft.pending_admin_full_name, admin_email: draft.pending_admin_email,
        },
        organization_settings: EMPTY_FORM_DATA.organization_settings,
        academic_config: {
          school_timing_start: draft.school_timing_start, school_timing_end: draft.school_timing_end,
          working_days: draft.working_days ? draft.working_days.split(",") : [],
          medium_of_instruction: draft.medium_of_instruction, grading_system: draft.grading_system,
          attendance_min_percentage: draft.attendance_min_percentage, promotion_policy: draft.promotion_policy,
        },
        classes_offered: { stages: draft.selected_stages ? draft.selected_stages.split(",") : [] },
        infrastructure: {},
        branding: {
          logo_url: draft.logo_url, primary_color: draft.primary_color, banner_url: draft.banner_url,
          secondary_color: draft.secondary_color, letterhead_url: draft.letterhead_url, seal_url: draft.seal_url,
        },
        subscription: {
          subscription_plan: draft.subscription_plan, billing_cycle: draft.billing_cycle,
          pricing_model: draft.pricing_model, contract_start_date: draft.contract_start_date,
          contract_end_date: draft.contract_end_date, trial_ends_at: draft.trial_ends_at,
        },
      });
      setDraftId(id);
      setFurthestIndex(STEPS.length - 1); // resumed drafts can jump anywhere
      setMode("wizard");
    } catch (err) {
      setError(err.message);
      setMode("landing");
    }
  }

  function startNew() {
    setFormData(EMPTY_FORM_DATA);
    setDraftId(null);
    setCurrentIndex(0);
    setFurthestIndex(0);
    setMode("wizard");
  }

  function updateFormData(section, data) {
    setFormData((prev) => ({ ...prev, [section]: data }));
  }

  function goToStep(index) {
    setCurrentIndex(index);
  }

  function handleNext() {
    const next = Math.min(currentIndex + 1, STEPS.length - 1);
    setCurrentIndex(next);
    setFurthestIndex((prev) => Math.max(prev, next));
  }

  function handleBack() {
    setCurrentIndex(Math.max(currentIndex - 1, 0));
  }

  function handleDraftCreated(newDraftId) {
    setDraftId(newDraftId);
    router.replace(`/platform/register-school?draft=${newDraftId}`);
  }

  const commonProps = {
    draftId, formData, updateFormData,
    onBack: handleBack, onNext: handleNext, isFirst: currentIndex === 0,
    onSkip: handleNext,
  };

  const stepComponents = [
    <StepIdentity key="identity" {...commonProps} />,
    <StepGovernmentRecognition key="government" {...commonProps} />,
    <StepAddress key="address" {...commonProps} />,
    <StepManagement key="management" {...commonProps} onDraftCreated={handleDraftCreated} />,
    <StepOrganizationSettings key="org_settings" {...commonProps} />,
    <StepAcademicConfig key="academic" {...commonProps} />,
    <StepClasses key="classes" {...commonProps} />,
    <StepInfrastructure key="infrastructure" {...commonProps} />,
    <StepBranding key="branding" {...commonProps} />,
    <StepSubscription key="subscription" {...commonProps} />,
    <StepReview key="review" draftId={draftId} onBack={handleBack} />,
  ];

  if (mode === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-navy-900 px-6 py-4 flex items-center justify-between">
        <span className="font-display font-bold text-white">Arivon Platform — Register School</span>
        <button
          onClick={() => router.push("/platform/admin")}
          className="text-sm text-slate-300 hover:text-white"
        >
          Exit
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {mode === "landing" ? (
          <div>
            <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">Register a School</h2>
            <p className="text-sm text-slate-600 mb-6">Start a new onboarding, or resume one already in progress.</p>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

            <button
              onClick={startNew}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl px-5 py-4 flex items-center justify-center gap-2 mb-6"
            >
              <Plus size={18} /> Start New Registration
            </button>

            {drafts.length > 0 && (
              <>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">In Progress</p>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  {drafts.map((d, i) => (
                    <button
                      key={d.id}
                      onClick={() => loadDraft(d.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 ${i !== drafts.length - 1 ? "border-b border-slate-100" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        <FileEdit size={16} className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-900">{d.name}</span>
                      </div>
                      <span className="text-xs text-slate-500">Resume →</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="mb-6">
              <WizardStepper steps={STEPS} currentIndex={currentIndex} furthestIndex={furthestIndex} onStepClick={goToStep} />
            </div>
            {stepComponents[currentIndex]}
          </>
        )}
      </div>
    </div>
  );
}

export default function RegisterSchoolWizard() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Loading...</div>}>
      <RegisterSchoolWizardInner />
    </Suspense>
  );
}
