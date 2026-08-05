import { signIn } from "./actions";
import ForgotPasswordForm from "./forgot-password-form";

export default function SignInPage({ searchParams }: { searchParams: { error?: string; next?: string } }) {
  return (
    <main className="narrow-page">
      <p className="eyebrow">Authorized access</p>
      <h1>Sign in</h1>
      <p className="lede">Use the account supplied by an Arkansas Source Map administrator.</p>
      <aside aria-label="Access notice">Public registration is not available. Contact an administrator if you need access or a role change.</aside>
      {searchParams.error && <p className="error" role="alert">{searchParams.error}</p>}
      <form action={signIn} className="auth-form">
        <input type="hidden" name="next" value={searchParams.next ?? "/"} />
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
        <button type="submit">Sign in</button>
      </form>
      <ForgotPasswordForm />
    </main>
  );
}
