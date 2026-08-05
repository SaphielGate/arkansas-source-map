"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const NEUTRAL_RECOVERY_MESSAGE =
  "If an account exists for that email, a password recovery message has been sent.";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function requestRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/account/update-password`,
    });

    setSubmitting(false);
    if (recoveryError) {
      setError("The recovery request could not be completed. Please try again later.");
      return;
    }

    setMessage(NEUTRAL_RECOVERY_MESSAGE);
  }

  return (
    <details>
      <summary>Forgot password?</summary>
      {message && <p className="status" role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <form className="auth-form" onSubmit={requestRecovery}>
        <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <button type="submit" disabled={submitting}>{submitting ? "Sending…" : "Send recovery email"}</button>
      </form>
    </details>
  );
}
