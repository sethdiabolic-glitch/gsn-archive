import type { SupabaseClient } from "@supabase/supabase-js";
const KEY = "gsn-password-recovery";
let recovery: { userId: string; expires: number } | null = null;
export function clearRecovery() {
  recovery = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* Storage may be blocked. */
  }
}
export function hasRecovery(userId: string) {
  try {
    if (!recovery) {
      const value = JSON.parse(sessionStorage.getItem(KEY) || "null");
      if (typeof value?.userId === "string" && typeof value?.expires === "number") recovery = value;
    }
  } catch {
    /* Use the in-memory marker. */
  }
  return Boolean(recovery && recovery.userId === userId && recovery.expires > Date.now());
}
export function installRecoveryTracking(client: SupabaseClient | null) {
  if (!client || typeof window === "undefined") return;
  // Invalidate an earlier recovery if a fresh callback is being opened.
  if (location.pathname === "/reset-password" && (location.hash || location.search))
    clearRecovery();
  client.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session) {
      recovery = { userId: session.user.id, expires: Date.now() + 15 * 60 * 1000 };
      try {
        sessionStorage.setItem(KEY, JSON.stringify(recovery));
      } catch {
        /* Keep in memory only. */
      }
    }
    if (event === "SIGNED_OUT") clearRecovery();
  });
}
export function passwordError(password: string, confirmation: string) {
  if (password.length < 8) return "Use at least 8 characters for your new password.";
  if (password !== confirmation) return "The passwords do not match.";
  return "";
}
