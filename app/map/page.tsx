import Link from "next/link";
import MapLoader from "./map-loader";
import { signOut } from "../auth-actions";
import { requireRole } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import type { MapRecord } from "./map-view";

export default async function MapPage() {
  const { user, role } = await requireRole(["viewer", "analyst", "reviewer", "admin"]);
  const canReview = role === "reviewer" || role === "admin";
  const { data, error } = await createClient().rpc("get_map_records", { p_include_pending: canReview });
  const records = (data ?? []).map((record) => ({ ...record, latitude: Number(record.latitude), longitude: Number(record.longitude) })) as MapRecord[];

  return <main className="map-page">
    <nav className="session-nav" aria-label="Account navigation"><Link href="/">Home</Link><Link href="/registry">Registry entry</Link>{canReview && <Link href="/review">Review queue</Link>}<span>{user.email} · {role}</span><form action={signOut}><button type="submit">Sign out</button></form></nav>
    <p className="eyebrow">Milestone 3 · authenticated map</p><h1>Arkansas Source Map</h1>
    <aside aria-label="Map disclaimer">This map documents businesses appearing in selected public-source datasets. Inclusion, review activity, proximity, or clustering does not establish criminal conduct.</aside>
    <MapLoader records={records} canReview={canReview} loadError={error ? "The map records could not be loaded. Try again or contact an administrator." : undefined} />
  </main>;
}
