import { useEffect, useState } from "react";
import { supabase } from "./lib/community";
import { clearRecovery, hasRecovery, passwordError } from "./lib/recovery-session";
export function ForgotPasswordForm({ initialEmail = "" }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    [error, setError] = useState(""),
    [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  return (
    <form
      className="member-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy || cooldown) return;
        setBusy(true);
        setError("");
        try {
          if (!supabase) throw new Error("Unavailable");
          const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: window.location.origin + "/reset-password",
          });
          if (error) throw error;
          setSent(true);
          setCooldown(60);
        } catch {
          setError("Could not request a reset email. Please wait a moment and try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>Enter your account email. Follow the recovery link to choose a new password.</p>
      <label>
        Email
        <input
          className="text-input"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setSent(false);
          }}
        />
      </label>
      {sent && (
        <p role="status">
          If an account exists for that email, a reset link has been requested. Check your inbox and
          spam folder.
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn primary" disabled={busy || cooldown > 0}>
        {busy ? "Requesting…" : cooldown ? `Request again in ${cooldown}s` : "Send recovery email"}
      </button>
    </form>
  );
}
export function PasswordRecoveryPage() {
  const [state, setState] = useState<"checking" | "ready" | "invalid" | "done">("checking"),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [logoutError, setLogoutError] = useState(false);
  useEffect(() => {
    if (!supabase) {
      setState("invalid");
      return;
    }
    let active = true;
    const check = async () => {
      const { data, error } = await supabase!.auth.getUser();
      if (!active) return;
      setState(!error && data.user && hasRecovery(data.user.id) ? "ready" : "invalid");
      window.history.replaceState(window.history.state, "", window.location.pathname);
    };
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY")
        setTimeout(() => {
          if (active) void check();
        }, 0);
      if (event === "SIGNED_OUT" && active)
        setState((previous) => (previous === "done" ? "done" : "invalid"));
    });
    void check().catch(() => {
      if (active) setState("invalid");
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);
  return (
    <main className="password-recovery-page">
      <section className="member-panel">
        <a className="back-link" href="/">
          ← Back to GSN Arena
        </a>
        <h1>Reset your password</h1>
        {state === "checking" && <p role="status">Checking your recovery link…</p>}
        {state === "invalid" && (
          <>
            <p role="alert">
              This recovery link is missing, expired or already used. Request a new one below. If
              you’re already signed in, you can also change your password in Profile → Settings.
            </p>
            <ForgotPasswordForm />
          </>
        )}
        {state === "ready" && (
          <form
            className="member-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              const invalid = passwordError(password, confirmation);
              if (invalid) {
                setError(invalid);
                return;
              }
              setBusy(true);
              setError("");
              try {
                if (!supabase) throw new Error("Account service unavailable.");
                const { data, error: identityError } = await supabase.auth.getUser();
                if (identityError || !data.user || !hasRecovery(data.user.id)) {
                  clearRecovery();
                  setState("invalid");
                  return;
                }
                const { error } = await supabase.auth.updateUser({ password });
                if (error) throw error;
                clearRecovery();
                setPassword("");
                setConfirmation("");
                setState("done");
                const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
                setLogoutError(Boolean(signOutError));
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Could not update your password. Please try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              New password
              <input
                type="password"
                className="text-input"
                minLength={8}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                className="text-input"
                minLength={8}
                autoComplete="new-password"
                required
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            <p>
              Use at least 8 characters. A password manager can create a strong, unique password for
              you.
            </p>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="btn primary" disabled={busy}>
              {busy ? "Updating…" : "Set new password"}
            </button>
          </form>
        )}
        {state === "done" && (
          <div role="status">
            <p>
              Your password has been changed. Return to the archive and sign in with your new
              password.
            </p>
            {logoutError && (
              <p>
                Your password changed, but automatic sign-out did not finish. Please sign out
                manually.
              </p>
            )}
            <a className="btn primary" href="/">
              Return to sign in
            </a>
          </div>
        )}
      </section>
    </main>
  );
}
