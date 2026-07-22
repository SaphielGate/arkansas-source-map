"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type Observation = Database["public"]["Tables"]["source_observations"]["Row"] & {
  location_records: { record_id: string } | null;
};
type ReviewAction = "approved" | "rejected" | "correction_needed";

const fields = [
  ["source_url", "Source URL", "url"],
  ["source_collection_date", "Source collection date", "date"],
  ["business_name_as_listed", "Business name as listed", "text"],
  ["address", "Street address", "text"],
  ["city", "City", "text"],
  ["county", "County", "text"],
  ["zip_code", "ZIP code", "text"],
  ["latitude", "Latitude", "number"],
  ["longitude", "Longitude", "number"],
  ["review_count", "Review count", "number"],
] as const;

export default function RegistryWorkspace() {
  const [queue, setQueue] = useState<Observation[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const loadQueue = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("source_observations")
      .select("*, location_records(record_id)")
      .eq("human_review_status", "pending")
      .order("submitted_at", { ascending: true });
    setLoading(false);
    if (error) return setMessage(`Unable to load the review queue: ${error.message}`);
    setQueue((data as Observation[]) ?? []);
  }, []);

  useEffect(() => void loadQueue(), [loadQueue]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Saving observation…");
    const form = new FormData(event.currentTarget);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("submit_location_observation", {
      p_source_url: String(form.get("source_url")),
      p_source_collection_date: String(form.get("source_collection_date")),
      p_business_name_as_listed: String(form.get("business_name_as_listed")),
      p_address: String(form.get("address")),
      p_city: String(form.get("city")),
      p_county: String(form.get("county")),
      p_zip_code: String(form.get("zip_code")),
      p_latitude: Number(form.get("latitude")),
      p_longitude: Number(form.get("longitude")),
      p_review_count: Number(form.get("review_count")),
      p_listing_status: String(form.get("listing_status")),
      p_analyst_notes: String(form.get("analyst_notes")),
    });
    if (error) return setMessage(`Observation was not saved: ${error.message}`);
    const result = data?.[0];
    const duplicate = result?.duplicate_match !== "none" ? ` Duplicate matched by ${result.duplicate_match.replace("_", " ")}; a new observation was added to the existing record.` : "";
    setMessage(`Saved as ${result?.record_id ?? "a new record"}.${duplicate}`);
    event.currentTarget.reset();
    await loadQueue();
  }

  async function review(observationId: string, action: ReviewAction) {
    const note = window.prompt("Optional review note") ?? "";
    const { error } = await createClient().rpc("review_location_observation", {
      p_observation_id: observationId,
      p_action: action,
      p_note: note,
    });
    setMessage(error ? `Review action failed: ${error.message}` : `Observation marked ${action.replace("_", " ")}.`);
    if (!error) await loadQueue();
  }

  return (
    <div className="workspace">
      <section aria-labelledby="entry-heading">
        <h2 id="entry-heading">Add a source observation</h2>
        <p className="help">Enter details exactly as observed. Submitting a later observation preserves the earlier one.</p>
        <form onSubmit={submit}>
          <div className="form-grid">
            {fields.map(([name, label, type]) => (
              <label key={name}>{label}<input name={name} type={type} required step={name === "latitude" || name === "longitude" ? "any" : undefined} min={name === "review_count" ? 0 : undefined} /></label>
            ))}
            <label>Listing status
              <select name="listing_status" required defaultValue="active">
                <option value="active">Active</option><option value="temporarily_closed">Temporarily closed</option>
                <option value="permanently_closed">Permanently closed</option><option value="not_listed">Not listed</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>
            <label className="wide">Analyst notes<textarea name="analyst_notes" rows={4} /></label>
          </div>
          <button type="submit">Submit for human review</button>
        </form>
      </section>

      <section aria-labelledby="queue-heading">
        <h2 id="queue-heading">Review queue</h2>
        <p className="help">Approval records a completed human review; it does not independently verify a listing or claim.</p>
        {loading ? <p>Loading…</p> : queue.length === 0 ? <p>No pending observations, or sign in to view the queue.</p> : (
          <div className="queue">{queue.map((item) => (
            <article key={item.id}>
              <p className="record-id">{item.location_records?.record_id}</p>
              <h3>{item.business_name_as_listed}</h3>
              <p>{item.address}, {item.city}, AR {item.zip_code} · {item.county} County</p>
              <p>Collected {item.source_collection_date} · {item.review_count} reviews · {item.listing_status.replaceAll("_", " ")}</p>
              <a href={item.source_url} target="_blank" rel="noreferrer">View submitted source</a>
              {item.analyst_notes && <p>Analyst notes: {item.analyst_notes}</p>}
              <div className="actions">
                <button onClick={() => review(item.id, "approved")}>Approve</button>
                <button className="secondary" onClick={() => review(item.id, "correction_needed")}>Correction needed</button>
                <button className="danger" onClick={() => review(item.id, "rejected")}>Reject</button>
              </div>
            </article>
          ))}</div>
        )}
      </section>
      <p className="feedback" role="status" aria-live="polite">{message}</p>
    </div>
  );
}
