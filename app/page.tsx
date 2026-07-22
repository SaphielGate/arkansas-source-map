import Link from "next/link";

export default function Home() {
  return (
    <main>
      <p className="eyebrow">Milestone 2.5</p>
      <h1>Arkansas Source Map</h1>
      <p className="lede">
        A manual registry for documenting source observations about Arkansas locations.
      </p>
      <aside aria-label="Evidence notice">
        Inclusion in this index does not verify, endorse, or establish the truth of a claim. Source
        records and evidence require independent review, context, and corroboration.
      </aside>
      <p className="status">Sign in with an administrator-provisioned account. Available tools depend on the account’s application role.</p>
      <div className="home-actions">
        <Link href="/sign-in">Sign in</Link>
        <Link href="/map">Interactive map</Link>
        <Link href="/registry">Registry entry</Link>
        <Link href="/review">Review queue</Link>
      </div>
    </main>
  );
}
