"use client";

import { useEffect, useRef } from "react";

/**
 * A client-only Leaflet map (no API key needed — OpenStreetMap tiles)
 * showing the school as a home marker, every stop on the route as a
 * numbered marker in pickup order, connected by a line so the route's
 * actual shape is visible at a glance. Clicking anywhere on the map
 * fires onMapClick(lat, lng) — used to set a new stop's location by
 * clicking where it actually is, rather than typing coordinates by hand.
 */
export default function RouteMap({ school, stops, onMapClick, height = 320 }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const layerGroupRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !mapContainerRef.current) return;

      // Fix Leaflet's default marker icon paths, which break under bundlers.
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const center = school?.latitude && school?.longitude
        ? [school.latitude, school.longitude]
        : stops.length > 0 && stops[0].latitude
        ? [stops[0].latitude, stops[0].longitude]
        : [20.5937, 78.9629]; // fallback: center of India

      if (!mapRef.current) {
        mapRef.current = L.map(mapContainerRef.current).setView(center, 13);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(mapRef.current);

        if (onMapClick) {
          mapRef.current.on("click", (e) => onMapClick(e.latlng.lat, e.latlng.lng));
        }
      } else {
        mapRef.current.setView(center, mapRef.current.getZoom());
      }

      if (layerGroupRef.current) {
        layerGroupRef.current.clearLayers();
      } else {
        layerGroupRef.current = L.layerGroup().addTo(mapRef.current);
      }

      const schoolIcon = L.divIcon({
        html: `<div style="background:#4F46E5;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);font-size:15px;">🏫</div>`,
        className: "", iconSize: [30, 30], iconAnchor: [15, 15],
      });

      if (school?.latitude && school?.longitude) {
        L.marker([school.latitude, school.longitude], { icon: schoolIcon })
          .bindPopup(`<b>${school.name}</b><br/>School`)
          .addTo(layerGroupRef.current);
      }

      const validStops = stops.filter((s) => s.latitude && s.longitude);
      const routeLatLngs = [];
      if (school?.latitude && school?.longitude) routeLatLngs.push([school.latitude, school.longitude]);

      validStops.forEach((stop) => {
        const stopIcon = L.divIcon({
          html: `<div style="background:#F59E0B;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);color:white;font-weight:700;font-size:12px;">${stop.stop_order}</div>`,
          className: "", iconSize: [26, 26], iconAnchor: [13, 13],
        });
        L.marker([stop.latitude, stop.longitude], { icon: stopIcon })
          .bindPopup(`<b>${stop.stop_name}</b>${stop.pickup_time ? `<br/>Pickup: ${stop.pickup_time}` : ""}`)
          .addTo(layerGroupRef.current);
        routeLatLngs.push([stop.latitude, stop.longitude]);
      });

      if (routeLatLngs.length > 1) {
        L.polyline(routeLatLngs, { color: "#F59E0B", weight: 3, dashArray: "6, 6" }).addTo(layerGroupRef.current);
      }

      if (routeLatLngs.length > 0) {
        mapRef.current.fitBounds(routeLatLngs, { padding: [40, 40] });
      }
    });

    return () => { cancelled = true; };
  }, [school, stops]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return <div ref={mapContainerRef} style={{ height: `${height}px`, width: "100%", borderRadius: "12px", zIndex: 0 }} />;
}
