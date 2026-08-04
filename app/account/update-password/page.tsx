"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { validatePasswordUpdate } from "@/lib/auth/password-recovery";

export default function UpdatePasswordPage({ searchParams }: { searchParams?: { error?: string } }) {
  const router = useRouter();
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) setHasRecoverySession(Boolean(session));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setHasRecoverySession(Boolean(session));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validationError = validatePasswordUpdate(newPassword, confirmation);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!hasRecoverySession) {
      setError("This recovery link is invalid or has expired. Request a new link.");
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await createClient().auth.updateUser({ password: newPassword });
    if (updateError) {
      setSubmitting(false);
      setError("The password could not be updated. Request a new recovery link and try again.");
      return;
    }

    await createClient().auth.signOut();
    setSuccess(true);
    window.setTimeout(() => router.replace("/login"), 1000);
  }

  return (
    <main className="narrow-page">
      <p className="eyebrow">Account recovery</p>
      <h1>Set a new password</h1>
      <p className="lede">Choose a new password for your Arkansas Source Map account.</p>
      {hasRecoverySession === false && (
        <p className="error" role="alert">This recovery link is invalid or has expired. Request a new link.</p>
      )}
      {(error || searchParams?.error) && <p className="error" role="alert">{error || searchParams?.error}</p>}
      {success && <p className="status" role="status">Your password was updated. Redirecting to sign in…</p>}
      <form className="auth-form" onSubmit={submit}>
        <label>New password<input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
        <label>Confirm new password<input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>
        <button type="submit" disabled={submitting || hasRecoverySession === null}>{submitting ? "Updating…" : "Update password"}</button>
      </form>
    </main>
  );
}
