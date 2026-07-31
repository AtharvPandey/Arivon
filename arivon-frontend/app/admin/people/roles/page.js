"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Shield, UserPlus, Check, X, GraduationCap, Wallet, BookOpen, Users2,
  ClipboardList, BadgeCheck, Library, Bus, Car, Wrench, Crown, UserCog,
  Search, Ban, ShieldCheck,
} from "lucide-react";
import { apiRequest, isLoggedIn } from "../../../../lib/api";

const ROLE_META = {
  principal: { label: "Principal", icon: Crown, color: "indigo", description: "Full academic and administrative oversight" },
  vice_principal: { label: "Vice Principal", icon: Crown, color: "indigo", description: "Deputy academic and administrative oversight" },
  administrator: { label: "Administrator", icon: BadgeCheck, color: "slate", description: "General school administration" },
  academic_coordinator: { label: "Academic Coordinator", icon: BookOpen, color: "violet", description: "Subjects, classes, and timetable" },
  teacher: { label: "Teacher", icon: GraduationCap, color: "teal", description: "Classroom teaching and student records" },
  accountant: { label: "Accountant", icon: Wallet, color: "rose", description: "Fees, invoices, and financial reports" },
  admissions_officer: { label: "Admissions Officer", icon: ClipboardList, color: "amber", description: "Admission applications and enrollment" },
  receptionist: { label: "Receptionist", icon: Users2, color: "sky", description: "Front office and visitor management" },
  librarian: { label: "Librarian", icon: Library, color: "emerald", description: "Library management" },
  transport_manager: { label: "Transport Manager", icon: Bus, color: "orange", description: "Bus routes and vehicle assignment" },
  driver: { label: "Driver", icon: Car, color: "stone", description: "Vehicle operation" },
  support_staff: { label: "Support Staff", icon: Wrench, color: "gray", description: "Non-teaching support — cleaning, security, and similar" },
};

const ROLE_ORDER = [
  "school_admin", "principal", "vice_principal", "administrator", "academic_coordinator",
  "teacher", "accountant", "admissions_officer", "receptionist", "librarian",
  "transport_manager", "driver", "support_staff",
];

function roleRank(roleName) {
  const index = ROLE_ORDER.indexOf(roleName);
  return index === -1 ? ROLE_ORDER.length : index;
}

const COLOR_CLASSES = {
  indigo: { bg: "bg-indigo-50", text: "text-indigo-700", ring: "ring-indigo-400", chip: "bg-indigo-100" },
  slate: { bg: "bg-slate-50", text: "text-slate-700", ring: "ring-slate-400", chip: "bg-slate-100" },
  violet: { bg: "bg-violet-50", text: "text-violet-700", ring: "ring-violet-400", chip: "bg-violet-100" },
  teal: { bg: "bg-teal-50", text: "text-teal-700", ring: "ring-teal-400", chip: "bg-teal-100" },
  rose: { bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-400", chip: "bg-rose-100" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-400", chip: "bg-amber-100" },
  sky: { bg: "bg-sky-50", text: "text-sky-700", ring: "ring-sky-400", chip: "bg-sky-100" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-400", chip: "bg-emerald-100" },
  orange: { bg: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-400", chip: "bg-orange-100" },
  stone: { bg: "bg-stone-50", text: "text-stone-700", ring: "ring-stone-400", chip: "bg-stone-100" },
  gray: { bg: "bg-gray-50", text: "text-gray-700", ring: "ring-gray-400", chip: "bg-gray-100" },
};

export default function RolesPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("create");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState(null);
  const [creating, setCreating] = useState(false);
  const [staffSearch, setStaffSearch] = useState("");
  const [togglingId, setTogglingId] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    (async () => {
      try {
        const me = await apiRequest("/auth/me");
        setUser(me);
        if (me.role_name !== "school_admin") setActiveTab("staff");
        await loadStaff(me.school_id);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function loadStaff(schoolId) {
    const data = await apiRequest(`/staff/?school_id=${schoolId}`);
    setStaff(data);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!selectedRole) { setError("Pick a role for this account."); return; }
    setCreating(true);
    setError(""); setSuccess("");
    try {
      await apiRequest("/auth/register", {
        method: "POST",
        body: { role_name: selectedRole, full_name: fullName, email, password },
      });
      setSuccess(`${fullName} added as ${ROLE_META[selectedRole].label}.`);
      setFullName(""); setEmail(""); setPassword(""); setSelectedRole(null);
      await loadStaff(user.school_id);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleAccess(staffMember) {
    const newStatus = !staffMember.is_active;
    if (!confirm(`${newStatus ? "Restore" : "Revoke"} access for ${staffMember.full_name}?${!newStatus ? " They will not be able to log in until access is restored." : ""}`)) return;
    setTogglingId(staffMember.id);
    setError("");
    try {
      await apiRequest(`/staff/${staffMember.id}/access?is_active=${newStatus}`, { method: "PATCH" });
      await loadStaff(user.school_id);
    } catch (err) {
      setError(err.message);
    } finally {
      setTogglingId(null);
    }
  }

  if (loading) return <div className="max-w-4xl mx-auto px-6 py-8 text-sm text-slate-600">Loading...</div>;

  const isSchoolAdmin = user?.role_name === "school_admin";

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">Roles & Permissions</h2>
      <p className="text-sm text-slate-600 mb-6">
        {isSchoolAdmin
          ? "As School Admin, you're the sole authority who creates every other staff account for this school."
          : "Every staff role at this school and what they're responsible for."}
      </p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}
      {success && <p className="text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-lg px-3 py-2 mb-4">{success}</p>}

      <div className="flex items-center gap-1 border-b border-slate-200 mb-6">
        {isSchoolAdmin && (
          <button
            onClick={() => setActiveTab("create")}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "create" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <UserPlus size={14} /> Create Account
          </button>
        )}
        <button
          onClick={() => setActiveTab("staff")}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "staff" ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <UserCog size={14} /> Current Staff {staff.length > 0 && <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-1.5 rounded-full">{staff.length}</span>}
        </button>
      </div>

      {isSchoolAdmin && activeTab === "create" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-1.5">
            <UserPlus size={15} className="text-brand-600" /> Create a Staff Account
          </h3>

          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" required className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Temporary password" required minLength={6} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
            </div>

            <p className="text-xs font-medium text-slate-500 mb-2.5">Select a role</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-5">
              {Object.entries(ROLE_META).map(([key, meta]) => {
                const c = COLOR_CLASSES[meta.color];
                const isSelected = selectedRole === key;
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setSelectedRole(key)}
                    title={meta.description}
                    className={`flex items-center gap-2 text-left rounded-lg px-2.5 py-2 border transition-all ${c.bg} ${
                      isSelected ? `border-transparent ring-2 ${c.ring}` : "border-transparent hover:ring-1 hover:ring-slate-300"
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-md ${c.chip} flex items-center justify-center shrink-0`}>
                      <meta.icon size={12} className={c.text} />
                    </div>
                    <p className={`text-xs font-semibold ${c.text} leading-tight`}>{meta.label}</p>
                  </button>
                );
              })}
            </div>

            <button type="submit" disabled={creating} className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-5 py-2.5 flex items-center gap-1.5">
              <Check size={14} /> {creating ? "Creating..." : "Create Account"}
            </button>
          </form>
        </div>
      )}

      {activeTab === "staff" && (
        <div>
          <div className="relative mb-4">
            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
            <input
              value={staffSearch} onChange={(e) => setStaffSearch(e.target.value)}
              placeholder="Search staff by name or email..."
              className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2.5 text-sm"
            />
          </div>

          {(() => {
            const visibleStaff = staff
              .filter((s) =>
                s.full_name.toLowerCase().includes(staffSearch.toLowerCase()) ||
                s.email.toLowerCase().includes(staffSearch.toLowerCase())
              )
              .sort((a, b) => roleRank(a.role_name) - roleRank(b.role_name) || a.full_name.localeCompare(b.full_name));

            return (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {visibleStaff.length === 0 ? (
                  <p className="text-sm text-slate-500 p-6 text-center">{staff.length === 0 ? "No staff accounts yet." : "No staff match your search."}</p>
                ) : visibleStaff.map((s) => {
              const meta = ROLE_META[s.role_name] || (s.role_name === "school_admin" ? { label: "School Admin", icon: Crown, color: "brand" } : null);
              const c = meta ? (COLOR_CLASSES[meta.color] || { bg: "bg-brand-50", text: "text-brand-700", chip: "bg-brand-100" }) : { bg: "bg-slate-50", text: "text-slate-600", chip: "bg-slate-100" };
              const canManage = isSchoolAdmin && s.role_name !== "school_admin";
              return (
                <div key={s.id} className={`px-4 py-3 flex items-center justify-between ${!s.is_active ? "bg-slate-50" : ""}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg ${c.chip} flex items-center justify-center shrink-0`}>
                      {meta ? <meta.icon size={14} className={c.text} /> : <Shield size={14} className={c.text} />}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${s.is_active ? "text-slate-900" : "text-slate-400"}`}>{s.full_name}</p>
                      <p className="text-xs text-slate-500 truncate">{s.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!s.is_active && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Access Revoked</span>
                    )}
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${c.chip} ${c.text}`}>
                      {meta ? meta.label : (s.role_name || "").replace(/_/g, " ")}
                    </span>
                    {canManage && (
                      <button
                        onClick={() => handleToggleAccess(s)}
                        disabled={togglingId === s.id}
                        title={s.is_active ? "Revoke access" : "Restore access"}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                          s.is_active ? "text-slate-400 hover:bg-rose-50 hover:text-rose-600" : "text-slate-400 hover:bg-brand-50 hover:text-brand-600"
                        }`}
                      >
                        {s.is_active ? <Ban size={14} /> : <ShieldCheck size={14} />}
                      </button>
                    )}
                  </div>
                </div>
              );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
