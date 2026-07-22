import Link from "next/link";
import { signOut } from "../auth-actions";

export default function UnauthorizedPage() {
  return (
    <main className="narrow-page">
      <p className="eyebrow">Access restricted</p>
      <h1>Unauthorized</h1>
      <p className="lede">Your account is signed in but does not have the application role required for that page.</p>
      <p>Ask an administrator to confirm your viewer, analyst, reviewer, or admin role.</p>
      <div className="actions"><Link href="/">Return home</Link><form action={signOut}><button type="submit">Sign out</button></form></div>
    </main>
  );
}
