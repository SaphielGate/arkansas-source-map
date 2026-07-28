"use client";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet.heat";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { emptyMapFilters, filterMapRecords, type MapFilters } from "@/lib/map/filtering.mjs";

export type MapRecord = {
  location_record_id: string;
  record_id: string;
  observation_id: string;
  business_name_as_listed: string;
  address: string | null;
  city: string | null;
  county: string;
  zip_code: string | null;
  latitude: number;
  longitude: number;
  source_url: string | null;
  collection_date: string;
  first_seen: string;
  last_seen: string;
  review_count: number;
  record_status: string;
  human_review_status: string;
  analyst_notes: string | null;
  coordinate_confidence: string;
  review_layer: boolean;
};

const statusColors: Record<string, string> = {
  active: "#287a4b",
  temporarily_closed: "#d58924",
  permanently_closed: "#6a6f74",
  not_listed: "#3477a8",
  unknown: "#7d5b8f",
};

function HeatLayer({ records }: { records: MapRecord[] }) {
  const map = useMap();
  useEffect(() => {
    const maxReviews = Math.max(1, ...records.map((record) => record.review_count));
    const points = records.map((record) => [record.latitude, record.longitude, Math.max(0.2, record.review_count / maxReviews)] as [number, number, number]);
    const layer = L.heatLayer(points, { radius: 28, blur: 22, minOpacity: 0.3, maxZoom: 12 }).addTo(map);
    return () => { map.removeLayer(layer); };
  }, [map, records]);
  return null;
}

function markerIcon(record: MapRecord) {
  const color = record.review_layer ? "#7d3cb5" : (statusColors[record.record_status] ?? statusColors.unknown);
  const lowConfidence = record.coordinate_confidence === "low" || record.coordinate_confidence === "unknown";
  return L.divIcon({
    className: "map-marker-wrap",
    html: `<span class="map-marker${lowConfidence ? " map-marker--uncertain" : ""}" style="--marker-color:${color}" aria-hidden="true"></span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function options(records: MapRecord[], key: "county" | "city" | "zip_code" | "record_status" | "human_review_status") {
  return Array.from(new Set(records.map((record) => record[key]).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b));
}

export default function MapView({ records, canReview, loadError }: { records: MapRecord[]; canReview: boolean; loadError?: string }) {
  const [filters, setFilters] = useState<MapFilters>({ ...emptyMapFilters });
  const [includePending, setIncludePending] = useState(false);
  const [view, setView] = useState<"markers" | "heat">("markers");
  const [selected, setSelected] = useState<MapRecord | null>(null);
  const visible = useMemo(() => filterMapRecords(records, filters, includePending), [records, filters, includePending]);
  const verifiedCount = records.filter((record) => !record.review_layer).length;
  const lowConfidenceCount = visible.filter((record) => record.coordinate_confidence === "low" || record.coordinate_confidence === "unknown").length;

  function setFilter(name: keyof MapFilters, value: string) {
    setFilters((current) => ({ ...current, [name]: value }));
    setSelected(null);
  }

  if (loadError) return <div className="map-state map-state--error" role="alert">{loadError}</div>;
  if (records.length === 0) return <div className="map-state">No approved and verified records are available for the map.</div>;

  return (
    <div className="map-workspace">
      <section className="map-controls" aria-label="Map filters">
        <div className="filter-grid">
          <label>County<select value={filters.county} onChange={(event) => setFilter("county", event.target.value)}><option value="">All counties</option>{options(records, "county").map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>City<select value={filters.city} onChange={(event) => setFilter("city", event.target.value)}><option value="">All cities</option>{options(records, "city").map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>ZIP code<select value={filters.zipCode} onChange={(event) => setFilter("zipCode", event.target.value)}><option value="">All ZIP codes</option>{options(records, "zip_code").map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Current status<select value={filters.recordStatus} onChange={(event) => setFilter("recordStatus", event.target.value)}><option value="">All statuses</option>{options(records, "record_status").map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
          <label>Human review status<select value={filters.humanReviewStatus} onChange={(event) => setFilter("humanReviewStatus", event.target.value)}><option value="">All review states</option>{options(records, "human_review_status").map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
          <label>First seen on/after<input type="date" value={filters.firstSeenFrom} onChange={(event) => setFilter("firstSeenFrom", event.target.value)} /></label>
          <label>Last seen on/before<input type="date" value={filters.lastSeenThrough} onChange={(event) => setFilter("lastSeenThrough", event.target.value)} /></label>
        </div>
        <div className="map-toggles">
          <fieldset><legend>Display</legend><label><input type="radio" name="view" checked={view === "markers"} onChange={() => setView("markers")} /> Markers and clusters</label><label><input type="radio" name="view" checked={view === "heat"} onChange={() => setView("heat")} /> Heat intensity</label></fieldset>
          {canReview && <label className="review-layer-toggle"><input type="checkbox" checked={includePending} onChange={(event) => { setIncludePending(event.target.checked); setSelected(null); }} /> Show separate pending review layer</label>}
          <button className="secondary" type="button" onClick={() => { setFilters({ ...emptyMapFilters }); setSelected(null); }}>Clear filters</button>
        </div>
        <p className="map-count" role="status">Showing {visible.length} records ({verifiedCount} approved and verified available).{lowConfidenceCount > 0 ? ` ${lowConfidenceCount} visible point${lowConfidenceCount === 1 ? " has" : "s have"} low or unknown coordinate confidence.` : ""}</p>
      </section>

      {visible.length === 0 ? <div className="map-state">No records match the selected filters.</div> : (
        <div className="map-and-detail">
          <MapContainer center={[34.9, -92.3]} zoom={7} minZoom={6} maxBounds={[[32.5, -95.8], [37.5, -88.2]]} className="leaflet-map" scrollWheelZoom>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {view === "heat" ? <HeatLayer records={visible} /> : (
              <MarkerClusterGroup chunkedLoading iconCreateFunction={(cluster: L.MarkerCluster) => L.divIcon({ html: `<span>${cluster.getChildCount()}</span>`, className: "map-cluster", iconSize: L.point(42, 42) })}>
                {visible.map((record) => <Marker key={record.observation_id} position={[record.latitude, record.longitude]} icon={markerIcon(record)} eventHandlers={{ click: () => setSelected(record) }} />)}
              </MarkerClusterGroup>
            )}
          </MapContainer>
          <RecordDetail record={selected} />
        </div>
      )}
      <MapLegend />
    </div>
  );
}

function RecordDetail({ record }: { record: MapRecord | null }) {
  if (!record) return <section className="record-detail"><h2>Record details</h2><p>Select a marker to inspect its latest source observation.</p></section>;
  const uncertain = record.coordinate_confidence === "low" || record.coordinate_confidence === "unknown";
  return <section className="record-detail" aria-live="polite">
    <p className="record-id">{record.record_id}</p><h2>{record.business_name_as_listed}</h2>
    {record.review_layer && <p className="review-only-badge">Pending · review-only layer</p>}
    {uncertain && <p className="coordinate-warning">Coordinate confidence is {record.coordinate_confidence}; use the listed address as the primary location reference.</p>}
    <dl>
      <div><dt>Full address</dt><dd>{record.address}</dd></div><div><dt>City</dt><dd>{record.city}</dd></div>
      <div><dt>County</dt><dd>{record.county}</dd></div><div><dt>ZIP code</dt><dd>{record.zip_code}</dd></div>
      <div><dt>Collection date</dt><dd>{record.collection_date}</dd></div><div><dt>First seen</dt><dd>{record.first_seen}</dd></div>
      <div><dt>Last seen</dt><dd>{record.last_seen}</dd></div><div><dt>Review count</dt><dd>{record.review_count}</dd></div>
      <div><dt>Record status</dt><dd>{record.record_status.replaceAll("_", " ")}</dd></div><div><dt>Human review status</dt><dd>{record.human_review_status.replaceAll("_", " ")}</dd></div>
      <div className="wide"><dt>Source</dt><dd>{record.source_url ? <a href={record.source_url} target="_blank" rel="noreferrer">Open public-source listing</a> : "No source URL supplied."}</dd></div>
      <div className="wide"><dt>Neutral analyst notes</dt><dd>{record.analyst_notes || "No analyst notes recorded."}</dd></div>
    </dl>
  </section>;
}

function MapLegend() {
  return <section className="map-legend" aria-labelledby="legend-title"><h2 id="legend-title">Map legend</h2>
    <ul><li><span className="legend-dot" style={{ background: statusColors.active }} /> Active</li><li><span className="legend-dot" style={{ background: statusColors.temporarily_closed }} /> Temporarily closed</li><li><span className="legend-dot" style={{ background: statusColors.permanently_closed }} /> Permanently closed</li><li><span className="legend-dot" style={{ background: statusColors.not_listed }} /> Not listed</li><li><span className="legend-dot" style={{ background: statusColors.unknown }} /> Unknown status</li><li><span className="legend-dot legend-dot--review" /> Pending review-only record</li><li><span className="legend-dot legend-dot--uncertain" /> Low or unknown coordinate confidence</li><li><span className="legend-cluster">3</span> Cluster containing multiple records</li><li><span className="legend-heat" /> Heat intensity: blue/green is lower concentration; yellow/red is higher concentration</li></ul>
  </section>;
}
