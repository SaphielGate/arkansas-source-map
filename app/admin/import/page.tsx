import Link from "next/link";
import { requireRole } from "@/lib/auth/authorization";
import { signOut } from "@/app/auth-actions";
import CsvImportWorkspace from "./workspace";

export default async function CsvImportPage() {
  const { user, role } = await requireRole(["admin"]);

  return (
    <main>
      <nav className="session-nav" aria-label="Account navigation">
        <Link href="/">Home</Link>
        <Link href="/map">Map</Link>
        <Link href="/registry">Registry entry</Link>
        <Link href="/review">Review queue</Link>
        <span>{user.email} · {role}</span>
        <form action={signOut}><button type="submit">Sign out</button></form>
      </nav>
      <p className="eyebrow">Milestone 4 · admin only</p>
      <h1>CSV Import Engine</h1>
      <aside aria-label="Import safety notice">
        Imports remain pending in the existing human-review queue. They do not
        create map records or publish locations until an authorized reviewer
        approves each observation.
      </aside>
      <CsvImportWorkspace />
    </main>
  );
}
