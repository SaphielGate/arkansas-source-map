import Link from "next/link";
import RegistryWorkspace from "../registry-workspace";
import { signOut } from "../auth-actions";
import { requireRole } from "@/lib/auth/authorization";

export default async function ReviewPage() {
  const { user, role } = await requireRole(["reviewer", "admin"]);
  return (
    <main>
      <nav className="session-nav" aria-label="Account navigation">
        <Link href="/">Home</Link><Link href="/map">Map</Link><Link href="/registry">Registry entry</Link>
        <span>{user.email} · {role}</span><form action={signOut}><button type="submit">Sign out</button></form>
      </nav>
      <p className="eyebrow">Milestone 2.5 · restricted</p>
      <h1>Human review</h1>
      <aside aria-label="Evidence notice">Approval records a completed human review. It does not independently verify the accuracy, completeness, or currency of a listing or claim.</aside>
      <RegistryWorkspace mode="review" />
    </main>
  );
}
