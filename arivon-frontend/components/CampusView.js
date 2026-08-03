"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Users2, FlaskConical, BookOpen, Dumbbell, Bus, HeartPulse, Home } from "lucide-react";
import { apiRequest, isLoggedIn } from "../lib/api";

function FacilityCard({ icon: Icon, label, value, available }) {
  const hasValue = value !== null && value !== undefined && value !== "";
  const isOn = available === true || hasValue;
  return (
    <div className={`rounded-2xl border p-5 transition-all ${isOn ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100"}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${isOn ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-300"}`}>
        <Icon size={18} />
      </div>
      <p className={`text-lg font-display font-bold mb-0.5 ${isOn ? "text-slate-900" : "text-slate-300"}`}>
        {hasValue ? value : available === true ? "Available" : "Not set up"}
      </p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

export default function CampusPage() {
  const router = useRouter();
  const [infra, setInfra] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    (async () => {
      try {
        const me = await apiRequest("/auth/me");
        const data = await apiRequest(`/schools/${me.school_id}/infrastructure`);
        setInfra(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-sm text-slate-600">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Premium hero, same visual language as every dashboard in this app */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-6 sm:p-8 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <p className="text-xs font-medium text-indigo-300 mb-2 flex items-center gap-1.5">
            <Building2 size={12} /> Campus
          </p>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2">Campus & Facilities</h2>
          <p className="text-sm text-indigo-200 max-w-xl">A snapshot of your school's physical capacity and facilities.</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {!infra ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <Building2 size={24} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-600">Campus details haven't been set up yet.</p>
          <p className="text-xs text-slate-400 mt-1">Ask your School Admin to fill this in via the registration profile.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <FacilityCard icon={Building2} label="Campus Area" value={infra.campus_area} />
          <FacilityCard icon={Home} label="Classrooms" value={infra.number_of_classrooms} />
          <FacilityCard icon={FlaskConical} label="Laboratories" value={infra.number_of_labs} />
          <FacilityCard icon={BookOpen} label="Library" available={infra.has_library} />
          <FacilityCard icon={Dumbbell} label="Sports Facilities" value={infra.sports_facilities} />
          <FacilityCard icon={Bus} label="Transport" available={infra.has_transport} />
          <FacilityCard icon={Home} label="Hostel" available={infra.has_hostel} />
          <FacilityCard icon={HeartPulse} label="Medical Room" available={infra.has_medical_room} />
        </div>
      )}
    </div>
  );
}
