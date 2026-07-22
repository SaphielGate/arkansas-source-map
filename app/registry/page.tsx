import Link from "next/link";
import RegistryWorkspace from "../registry-workspace";
import { signOut } from "../auth-actions";
import { requireRole } from "@/lib/auth/authorization";

export default async function RegistryPage() {
  const { user, role } = await requireRole(["analyst", "reviewer", "admin"]);
  return (
    <main>
      <nav className="session-nav" aria-label="Account navigation">
        <Link href="/">Home</Link><Link href="/review">Review queue</Link>
        <span>{user.email} · {role}</span><form action={signOut}><button type="submit">Sign out</button></form>
      </nav>
      <p className="eyebrow">Milestone 2.5 · restricted</p>
      <h1>Registry entry</h1>
      <aside aria-label="Evidence notice">Inclusion in this index does not verify, endorse, or establish the truth of a claim. Source records and evidence require independent review, context, and corroboration.</aside>
      <RegistryWorkspace mode="entry" />
    </main>
  );
}
