import { CropImageButton } from "./PortraitCropper";
import { passwordError } from "./lib/recovery-session";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { X } from "lucide-react";
import {
  client,
  rpc,
  avatarUrl,
  loadProfile,
  usernameError,
  usernameAvailable,
  uploadAvatar,
  loadNotices,
  safeNoticeLink,
  type Profile,
  type Notice,
} from "./lib/member";

const message = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong. Please retry.";
export function Avatar({
  path,
  username,
}: {
  path?: string | null | undefined;
  username?: string | null | undefined;
}) {
  return (
    <img
      className="member-avatar"
      src={avatarUrl(path)}
      alt={username ? `${username}'s avatar` : "GSN default avatar"}
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = "/gsn-logo.png";
      }}
    />
  );
}
function Feedback({ error, status }: { error?: string; status?: string }) {
  return (
    <>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="member-status" role="status">
          {status}
        </p>
      )}
    </>
  );
}
export function LoginRequired({ onSignIn }: { onSignIn: () => void }) {
  return (
    <section className="member-panel">
      <h1>Administrator access</h1>
      <p>Only authorized administrators can access account settings.</p>
      <button className="btn primary" onClick={onSignIn}>
        Admin sign in
      </button>
    </section>
  );
}

export function ProfilePage({ user }: { user: User }) {
  const [profile, setProfile] = useState<Profile | null>(null),
    [username, setUsername] = useState(""),
    [avatar, setAvatar] = useState<File | null>(null),
    [resetAvatar, setResetAvatar] = useState(false),
    [availability, setAvailability] = useState(""),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [tab, setTab] = useState("profile"),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [avatarPreview, setAvatarPreview] = useState(""),
    [email, setEmail] = useState(user.email || "");
  useEffect(() => {
    if (!avatar) {
      setAvatarPreview("");
      return;
    }
    const url = URL.createObjectURL(avatar);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatar]);
  useEffect(() => {
    let stale = false;
    loadProfile(user.id)
      .then((p) => {
        if (!stale) {
          setProfile(p);
          setUsername(p?.username || "");
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!stale) {
          setError(message(e));
          setLoading(false);
        }
      });
    return () => {
      stale = true;
    };
  }, [user.id]);
  useEffect(() => {
    if (!username || usernameError(username)) {
      setAvailability("");
      return;
    }
    let stale = false;
    setAvailability("Checking availability…");
    const timer = setTimeout(() => {
      usernameAvailable(username, user.id)
        .then((yes) => {
          if (!stale)
            setAvailability(yes ? "Username available" : "That username is already taken");
        })
        .catch(() => {
          if (!stale) setAvailability("Availability check unavailable. Save will verify it.");
        });
    }, 400);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [username, user.id]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStatus("");
    const invalid = usernameError(username);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    let uploaded: string | null = null;
    try {
      const path = avatar
        ? (uploaded = await uploadAvatar(avatar, user.id))
        : resetAvatar
          ? null
          : profile?.avatar_path || null;
      await rpc("save_member_profile", { p_username: username, p_avatar_path: path });
      setProfile({ user_id: user.id, username, avatar_path: path });
      setAvatar(null);
      setResetAvatar(false);
      setStatus("Profile saved.");
      window.dispatchEvent(new Event("gsn-account-refresh"));
    } catch (e) {
      if (uploaded) await client().storage.from("member-avatars").remove([uploaded]);
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const settings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const changes: { email?: string; password?: string } = {};
      if (email !== user.email) changes.email = email;
      if (password) {
        const invalid = passwordError(password, confirmation);
        if (invalid) throw new Error(invalid);
        changes.password = password;
      }
      if (!Object.keys(changes).length) {
        setStatus("No account changes to save.");
        return;
      }
      const { error } = await client().auth.updateUser(changes);
      if (error) throw error;
      setPassword("");
      setConfirmation("");
      setStatus(changes.email ? "Check your email to confirm the change." : "Password updated.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="member-console">
      <header className="profile-hero">
        {avatarPreview ? (
          <img
            className="member-avatar"
            src={avatarPreview}
            alt="Unsaved cropped profile preview"
          />
        ) : (
          <Avatar path={resetAvatar ? null : profile?.avatar_path} username={profile?.username} />
        )}
        <div>
          <span className="eyebrow">Admin account</span>
          <h1>{profile?.username || "Account settings"}</h1>
          <p>Manage your administrator identity and private account settings.</p>
        </div>
      </header>
      <div className="member-tabs" role="group" aria-label="Profile sections">
        {[
          ["profile", "Edit profile"],
          ["settings", "Settings"],
        ].map(([id, label]) => (
          <button
            className={`btn ${tab === id ? "primary" : "ghost"}`}
            key={id}
            aria-pressed={tab === id}
            onClick={() => setTab(id!)}
          >
            {label}
          </button>
        ))}
      </div>
      <Feedback error={error} status={status} />
      {loading ? (
        <p role="status">Loading profile…</p>
      ) : (
        <>
          {(!profile || tab === "profile") && (
            <form className="member-panel member-form" onSubmit={save}>
              <h2>Profile identity</h2>
              <label>
                Username
                <input
                  className="text-input"
                  value={username}
                  maxLength={24}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  pattern="[A-Za-z0-9_]{3,24}"
                />
              </label>
              <small role="status">
                {usernameError(username) || availability || "3–24 letters, numbers or underscores."}
              </small>
              <p>
                Choose a picture, position it in the circle, then save your profile. Originals up to
                12 MB; cropped avatars are resized to 512 × 512.
              </p>
              <CropImageButton
                disabled={busy}
                onCropped={(file) => {
                  setAvatar(file);
                  setResetAvatar(false);
                  setStatus("Crop applied to draft. Save profile to publish it.");
                }}
              />
              {avatar && <p>Selected: {avatar.name}</p>}
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setAvatar(null);
                  setResetAvatar(true);
                }}
              >
                Use GSN Arena logo
              </button>
              <button className="btn primary" disabled={busy}>
                {busy ? "Saving…" : "Save profile"}
              </button>
            </form>
          )}
          {tab === "settings" && (
            <form className="member-panel member-form" onSubmit={settings}>
              <h2>Private account settings</h2>
              <label>
                Email
                <input
                  type="email"
                  className="text-input"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                New password
                <input
                  className="text-input"
                  type="password"
                  value={password}
                  minLength={8}
                  autoComplete="new-password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave blank to keep your password"
                />
              </label>
              <label>
                Confirm new password
                <input
                  className="text-input"
                  type="password"
                  value={confirmation}
                  minLength={8}
                  required={Boolean(password)}
                  autoComplete="new-password"
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder="Repeat your new password"
                />
              </label>
              <a href="/reset-password">Forgot your password? Request a recovery email</a>
              <p>
                Email changes may require confirmation; sensitive changes may require a fresh
                sign-in.
              </p>
              <button className="btn primary" disabled={busy}>
                Update account
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
export function NoticeCard() {
  const [notices, setNotices] = useState<Notice[]>([]),
    [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => {
    let stale = false;
    const refresh = () =>
      loadNotices()
        .then((data) => {
          if (!stale)
            setNotices(data.filter((n) => !n.expires_at || Date.parse(n.expires_at) > Date.now()));
        })
        .catch(() => {});
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 60000);
    try {
      const stored: unknown = JSON.parse(localStorage.getItem("gsn-notice-dismissed") || "[]");
      setDismissed(
        Array.isArray(stored)
          ? stored.filter((value): value is string => typeof value === "string").slice(-100)
          : [],
      );
    } catch {
      /* Browser storage may be unavailable. */
    }
    return () => {
      stale = true;
      clearInterval(timer);
    };
  }, []);
  const notice = notices.find(
    (n) =>
      !dismissed.includes(`${n.id}:${n.updated_at}`) &&
      (!n.expires_at || Date.parse(n.expires_at) > Date.now()),
  );
  if (!notice) return null;
  const link = safeNoticeLink(notice.link);
  return (
    <aside className="floating-notice" aria-label="Archive notice">
      <div>
        <span className="eyebrow">Archive notice</span>
        <h2>{notice.title}</h2>
        <p>{notice.message}</p>
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer">
            Learn more →
          </a>
        )}
      </div>
      <button
        className="notice-close"
        aria-label="Dismiss notice"
        onClick={() => {
          const next = [...dismissed, `${notice.id}:${notice.updated_at}`].slice(-100);
          setDismissed(next);
          try {
            localStorage.setItem("gsn-notice-dismissed", JSON.stringify(next));
          } catch {
            /* Browser storage may be unavailable. */
          }
        }}
      >
        <X size={18} />
      </button>
    </aside>
  );
}
export function NoticesAdmin() {
  const [items, setItems] = useState<Notice[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [link, setLink] = useState(""),
    [active, setActive] = useState(false),
    [expiry, setExpiry] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const refresh = () =>
    loadNotices(true)
      .then(setItems)
      .catch((e) => setError(message(e)));
  useEffect(() => {
    void refresh();
  }, []);
  const select = (n?: Notice) => {
    setSelected(n?.id || null);
    setTitle(n?.title || "");
    setBody(n?.message || "");
    setLink(n?.link || "");
    setActive(n?.active || false);
    setExpiry(
      n?.expires_at
        ? new Date(Date.parse(n.expires_at) - new Date().getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16)
        : "",
    );
    setError("");
    setStatus("");
  };
  return (
    <section className="member-console">
      <span className="eyebrow">Admin / announcements</span>
      <h1 className="display-title">
        Archive <em>notices</em>
      </h1>
      <p>
        One published card is displayed at a time, newest first. Expiry uses your local timezone.
        Editing a notice makes it visible again to readers who dismissed it.
      </p>
      <div className="member-section-head">
        <button className="btn" onClick={() => select()}>
          New notice
        </button>
        <button className="btn ghost" onClick={refresh}>
          Refresh
        </button>
      </div>
      <div className="notice-list">
        {items.map((n) => (
          <button className="member-panel" key={n.id} onClick={() => select(n)}>
            <strong>{n.title}</strong>
            <span>
              {n.active ? "Published" : "Draft"}
              {n.expires_at && Date.parse(n.expires_at) < Date.now() ? " · Expired" : ""}
            </span>
          </button>
        ))}
      </div>
      <form
        className="member-panel member-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setStatus("");
          try {
            if (link && !safeNoticeLink(link))
              throw new Error("Use a public HTTP or HTTPS link without credentials.");
            const savedId = await rpc<string>("save_site_notice", {
              p_id: selected,
              p_title: title,
              p_message: body,
              p_link: link,
              p_active: active,
              p_expiry: expiry ? new Date(expiry).toISOString() : null,
            });
            setSelected(savedId);
            setStatus("Notice saved. Public cards refresh within a minute.");
            await refresh();
          } catch (e) {
            setError(message(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>{selected ? "Edit notice" : "Create notice"}</h2>
        <label>
          Title
          <input
            className="text-input"
            maxLength={100}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Message
          <textarea
            className="text-area"
            maxLength={1000}
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <small>{body.length} / 1,000</small>
        <label>
          Optional link
          <input
            type="url"
            className="text-input"
            value={link}
            maxLength={2000}
            onChange={(e) => setLink(e.target.value)}
          />
        </label>
        <label>
          Optional expiry
          <input
            type="datetime-local"
            className="text-input"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          />
        </label>
        <label className="check-control">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />{" "}
          Published (uncheck to dismiss site-wide)
        </label>
        <button className="btn primary" disabled={busy}>
          {busy ? "Saving…" : "Save notice"}
        </button>
        <Feedback error={error} status={status} />
      </form>
    </section>
  );
}
