import RegistryWorkspace from "./registry-workspace";

export default function Home() {
  return (
    <main>
      <p className="eyebrow">Milestone 2</p>
      <h1>Arkansas Source Map</h1>
      <p className="lede">
        A manual registry for documenting source observations about Arkansas locations.
      </p>
      <aside aria-label="Evidence notice">
        Inclusion in this index does not verify, endorse, or establish the truth of a claim. Source
        records and evidence require independent review, context, and corroboration.
      </aside>
      <p className="status">Records remain unverified until an authenticated reviewer approves the observation.</p>
      <RegistryWorkspace />
    </main>
  );
}
