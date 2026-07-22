"use client";

import dynamic from "next/dynamic";
import type { MapRecord } from "./map-view";

const MapView = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => <div className="map-state" role="status">Loading interactive map…</div>,
});

export default function MapLoader(props: { records: MapRecord[]; canReview: boolean; loadError?: string }) {
  return <MapView {...props} />;
}
