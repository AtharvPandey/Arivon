"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Bus, Plus, MapPin, Phone, Users, ArrowLeft, Search, X, User,
} from "lucide-react";
import { apiRequest, isLoggedIn } from "../../../lib/api";

const RouteMap = dynamic(() => import("../../../components/RouteMap"), { ssr: false });

export default function TransportPage() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState(null);
  const [school, setSchool] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [stops, setStops] = useState([]);
  const [routeStudents, setRouteStudents] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [showRouteForm, setShowRouteForm] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [conductorName, setConductorName] = useState("");
  const [conductorPhone, setConductorPhone] = useState("");

  const [pendingStopLatLng, setPendingStopLatLng] = useState(null);
  const [stopName, setStopName] = useState("");
  const [stopOrder, setStopOrder] = useState(1);
  const [pickupTime, setPickupTime] = useState("");
  const [dropTime, setDropTime] = useState("");

  const [studentSearch, setStudentSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [assigningStopId, setAssigningStopId] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) { router.push("/"); return; }
    (async () => {
      try {
        const me = await apiRequest("/auth/me");
        setSchoolId(me.school_id);
        const [schoolData, routesData] = await Promise.all([
          apiRequest(`/schools/${me.school_id}`),
          apiRequest(`/transport/routes?school_id=${me.school_id}`),
        ]);
        setSchool(schoolData);
        setRoutes(routesData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function loadRoutes() {
    const data = await apiRequest(`/transport/routes?school_id=${schoolId}`);
    setRoutes(data);
  }

  async function selectRoute(route) {
    setSelectedRoute(route);
    setPendingStopLatLng(null);
    const [stopsData, studentsData] = await Promise.all([
      apiRequest(`/transport/routes/${route.id}/stops`),
      apiRequest(`/transport/routes/${route.id}/students`),
    ]);
    setStops(stopsData);
    setRouteStudents(studentsData);
    setStopOrder(stopsData.length + 1);
  }

  async function refreshRouteDetail() {
    if (!selectedRoute) return;
    const [stopsData, studentsData, routesData] = await Promise.all([
      apiRequest(`/transport/routes/${selectedRoute.id}/stops`),
      apiRequest(`/transport/routes/${selectedRoute.id}/students`),
      apiRequest(`/transport/routes?school_id=${schoolId}`),
    ]);
    setStops(stopsData);
    setRouteStudents(studentsData);
    setRoutes(routesData);
  }

  async function handleCreateRoute(e) {
    e.preventDefault();
    setError("");
    try {
      await apiRequest("/transport/routes", {
        method: "POST",
        body: {
          school_id: schoolId, route_name: routeName, vehicle_number: vehicleNumber || null,
          driver_name: driverName || null, driver_phone: driverPhone || null,
          conductor_name: conductorName || null, conductor_phone: conductorPhone || null,
        },
      });
      setRouteName(""); setVehicleNumber(""); setDriverName(""); setDriverPhone(""); setConductorName(""); setConductorPhone("");
      setShowRouteForm(false);
      await loadRoutes();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleMapClick(lat, lng) {
    setPendingStopLatLng({ lat, lng });
    setStopName("");
  }

  async function handleCreateStop(e) {
    e.preventDefault();
    setError("");
    try {
      await apiRequest("/transport/stops", {
        method: "POST",
        body: {
          route_id: selectedRoute.id, stop_name: stopName, stop_order: Number(stopOrder),
          latitude: pendingStopLatLng?.lat ?? null, longitude: pendingStopLatLng?.lng ?? null,
          pickup_time: pickupTime || null, drop_time: dropTime || null,
        },
      });
      setStopName(""); setPickupTime(""); setDropTime(""); setPendingStopLatLng(null);
      await refreshRouteDetail();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSearchStudents(query) {
    setStudentSearch(query);
    if (query.length < 2) { setSearchResults([]); return; }
    const data = await apiRequest(`/students/?school_id=${schoolId}&search=${encodeURIComponent(query)}`);
    setSearchResults(data.slice(0, 8));
  }

  async function handleAssignStudent(studentId) {
    if (!assigningStopId) { setError("Select a stop first."); return; }
    setError("");
    try {
      await apiRequest(`/transport/students/${studentId}/assign`, {
        method: "PATCH",
        body: { bus_route_id: selectedRoute.id, bus_stop_id: Number(assigningStopId) },
      });
      setStudentSearch(""); setSearchResults([]);
      await refreshRouteDetail();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUnassign(studentId) {
    if (!confirm("Remove this student from the route?")) return;
    try {
      await apiRequest(`/transport/students/${studentId}/assign`, { method: "PATCH", body: { bus_route_id: null, bus_stop_id: null } });
      await refreshRouteDetail();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <div className="max-w-5xl mx-auto px-6 py-8 text-sm text-slate-600">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h2 className="text-2xl font-display font-bold text-slate-900 mb-1">Transport</h2>
      <p className="text-sm text-slate-600 mb-6">Bus routes, stops, driver details, and student assignment.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {!selectedRoute ? (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setShowRouteForm(!showRouteForm)} className="text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-4 py-2 flex items-center gap-1.5 shadow-sm">
              <Plus size={15} /> Add Bus Route
            </button>
          </div>

          {showRouteForm && (
            <form onSubmit={handleCreateRoute} className="bg-white border border-slate-200 rounded-xl p-4 mb-5 grid grid-cols-2 sm:grid-cols-3 gap-2">
              <input value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder="Route name (e.g. Route 1 - HSR Layout)" required className="col-span-2 sm:col-span-3 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
              <input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="Vehicle number" className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
              <input value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Driver name" className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
              <input value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} placeholder="Driver phone" className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
              <input value={conductorName} onChange={(e) => setConductorName(e.target.value)} placeholder="Conductor name" className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
              <input value={conductorPhone} onChange={(e) => setConductorPhone(e.target.value)} placeholder="Conductor phone" className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
              <button type="submit" className="col-span-2 sm:col-span-3 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg py-1.5">Add Route</button>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {routes.map((r) => (
              <button key={r.id} onClick={() => selectRoute(r)} className="text-left bg-white border border-slate-200 hover:border-amber-300 hover:shadow-md rounded-2xl overflow-hidden transition-all">
                <div className="relative h-16 bg-gradient-to-r from-amber-400 to-amber-500 flex items-center px-4">
                  <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "repeating-linear-gradient(90deg, black 0, black 2px, transparent 2px, transparent 16px)" }} />
                  <div className="relative w-10 h-10 rounded-xl bg-white/25 backdrop-blur-sm flex items-center justify-center">
                    <Bus size={20} className="text-white" />
                  </div>
                  <span className="relative ml-auto text-xs font-semibold px-2.5 py-1 rounded-full bg-white/25 text-white flex items-center gap-1">
                    <Users size={11} /> {r.student_count}
                  </span>
                </div>
                <div className="p-4">
                  <p className="text-sm font-semibold text-slate-900">{r.route_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{r.vehicle_number || "No vehicle number set"}</p>
                  {r.driver_name && (
                    <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1"><User size={11} /> {r.driver_name} {r.driver_phone && `· ${r.driver_phone}`}</p>
                  )}
                </div>
              </button>
            ))}
            {routes.length === 0 && (
              <div className="col-span-2 bg-white border border-slate-200 rounded-2xl p-10 text-center">
                <Bus size={26} className="text-amber-300 mx-auto mb-3" />
                <p className="text-sm text-slate-600">No bus routes yet — add your first route above.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <button onClick={() => setSelectedRoute(null)} className="text-sm text-slate-600 hover:text-slate-900 mb-4 flex items-center gap-1">
            <ArrowLeft size={14} /> Back to Routes
          </button>

          {/* Route header - bus themed */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-5">
            <div className="relative h-20 bg-gradient-to-r from-amber-400 to-amber-500 flex items-center px-5">
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "repeating-linear-gradient(90deg, black 0, black 2px, transparent 2px, transparent 16px)" }} />
              <div className="relative w-12 h-12 rounded-xl bg-white/25 backdrop-blur-sm flex items-center justify-center">
                <Bus size={24} className="text-white" />
              </div>
              <div className="relative ml-3">
                <p className="text-white font-display font-bold text-lg">{selectedRoute.route_name}</p>
                <p className="text-white/80 text-xs">{selectedRoute.vehicle_number || "No vehicle number"}</p>
              </div>
            </div>
            <div className="p-4 flex flex-wrap gap-6 text-sm">
              {selectedRoute.driver_name && (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center"><User size={14} /></div>
                  <div><p className="text-xs text-slate-400">Driver</p><p className="text-slate-800 font-medium">{selectedRoute.driver_name} {selectedRoute.driver_phone && `· ${selectedRoute.driver_phone}`}</p></div>
                </div>
              )}
              {selectedRoute.conductor_name && (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center"><User size={14} /></div>
                  <div><p className="text-xs text-slate-400">Conductor</p><p className="text-slate-800 font-medium">{selectedRoute.conductor_name} {selectedRoute.conductor_phone && `· ${selectedRoute.conductor_phone}`}</p></div>
                </div>
              )}
            </div>
          </div>

          {/* Map */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><MapPin size={14} className="text-amber-600" /> Route Map</p>
              <p className="text-xs text-slate-400">Click anywhere on the map to add a stop there</p>
            </div>
            <RouteMap school={school} stops={stops} onMapClick={handleMapClick} />

            {pendingStopLatLng && (
              <form onSubmit={handleCreateStop} className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3 space-y-2">
                <p className="text-xs text-amber-700 font-medium">New stop at {pendingStopLatLng.lat.toFixed(4)}, {pendingStopLatLng.lng.toFixed(4)}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <input value={stopName} onChange={(e) => setStopName(e.target.value)} placeholder="Stop name" required className="col-span-2 rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                  <input type="number" value={stopOrder} onChange={(e) => setStopOrder(e.target.value)} placeholder="Order" className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                  <input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg py-1.5">Add Stop Here</button>
                  <button type="button" onClick={() => setPendingStopLatLng(null)} className="px-3 text-xs text-slate-500 border border-slate-200 rounded-lg">Cancel</button>
                </div>
              </form>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Stops list */}
            <div>
              <p className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5"><MapPin size={14} className="text-amber-600" /> Stops</p>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {stops.length === 0 ? (
                  <p className="text-xs text-slate-500 p-4 text-center">Click on the map above to add your first stop.</p>
                ) : stops.map((s) => (
                  <div key={s.id} className="px-3 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center shrink-0">{s.stop_order}</span>
                      <div>
                        <p className="text-sm text-slate-900">{s.stop_name}</p>
                        <p className="text-xs text-slate-500">{s.pickup_time && `Pickup ${s.pickup_time}`} {s.drop_time && `· Drop ${s.drop_time}`} {!s.latitude && "· No location set"}</p>
                      </div>
                    </div>
                    <span className="text-xs text-amber-700 font-medium shrink-0">{s.student_count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Students */}
            <div>
              <p className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-1.5"><Users size={14} className="text-amber-600" /> Assigned Students</p>
              <div className="bg-white border border-slate-200 rounded-xl p-3 mb-3 space-y-2">
                <select value={assigningStopId} onChange={(e) => setAssigningStopId(e.target.value)} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
                  <option value="">Select stop to assign to...</option>
                  {stops.map((s) => <option key={s.id} value={s.id}>{s.stop_name}</option>)}
                </select>
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                  <input value={studentSearch} onChange={(e) => handleSearchStudents(e.target.value)} placeholder="Search student to add..." className="w-full rounded-lg border border-slate-200 pl-7 pr-2 py-1.5 text-xs" />
                </div>
                {searchResults.length > 0 && (
                  <div className="border border-slate-100 rounded-lg divide-y divide-slate-100 max-h-40 overflow-y-auto">
                    {searchResults.map((s) => (
                      <button key={s.id} onClick={() => handleAssignStudent(s.id)} className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-50">
                        {s.full_name} <span className="text-slate-400">({s.admission_number})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {routeStudents.length === 0 ? (
                  <p className="text-xs text-slate-500 p-4 text-center">No students assigned to this route yet.</p>
                ) : routeStudents.map((s) => (
                  <div key={s.student_id} className="px-3 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-900">{s.full_name}</p>
                      <p className="text-xs text-slate-500">{s.class_name} - {s.section_name} · {s.stop_name || "No stop"} · {s.guardian_phone}</p>
                    </div>
                    <button onClick={() => handleUnassign(s.student_id)} className="text-slate-400 hover:text-rose-600"><X size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
