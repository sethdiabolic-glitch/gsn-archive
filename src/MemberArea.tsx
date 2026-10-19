import { CropImageButton } from "./PortraitCropper";
import { passwordError } from "./lib/recovery-session";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { Bell, UserRound, X, ArrowLeft, Image as ImageIcon } from "lucide-react";
import {
  client,
  rpc,
  avatarUrl,
  loadProfile,
  usernameError,
  usernameAvailable,
  uploadAvatar,
  loadNotifications,
  loadNotices,
  safeNoticeLink,
  type Profile,
  type Comment,
  type Notice,
  type Notification,
} from "./lib/member";
import {
  getMyArt,
  deleteMyArt,
  resolveArtworkImages,
  setArtStatus,
  type Artwork,
} from "./lib/community";
import { ImageViewerLink } from "./ImageViewerLink";

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
      <h1>Sign in to your archive console</h1>
      <p>Your profile, submissions and notifications are private account tools.</p>
      <button className="btn primary" onClick={onSignIn}>
        Sign in / Create account
      </button>
    </section>
  );
}

export function AccountMenu({
  user,
  onSignIn,
  onSignOut,
}: {
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null),
    [unread, setUnread] = useState(0),
    [notifications, setNotifications] = useState<Notification[]>([]),
    [open, setOpen] = useState(false),
    [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const [p, n, c] = await Promise.all([
          loadProfile(user.id),
          loadNotifications(),
          client()
            .from("member_notifications")
            .select("id", { count: "exact", head: true })
            .is("read_at", null),
        ]);
        if (c.error) throw c.error;
        if (!cancelled) {
          setProfile(p);
          setNotifications(n.slice(0, 4));
          setUnread(c.count || 0);
          setError("");
        }
      } catch {
        if (!cancelled) setError("Notifications unavailable. Open your inbox to retry.");
      }
    };
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 60000);
    window.addEventListener("gsn-account-refresh", refresh);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("gsn-account-refresh", refresh);
    };
  }, [user]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  if (!user)
    return (
      <button className="btn ghost mini" onClick={onSignIn}>
        Sign in
      </button>
    );
  return (
    <div className="account-menu" ref={ref}>
      <button
        className="account-trigger"
        aria-label={`Account and notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Avatar path={profile?.avatar_path} />
        <Bell size={16} />
        {unread > 0 && <span className="unread-badge">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="account-popover">
          <strong>{profile?.username || "Your archive console"}</strong>
          <nav aria-label="Account">
            <a href="/profile">
              <UserRound size={15} /> Profile / My Images
            </a>
            <a href="/notifications">
              <Bell size={15} /> Notifications {unread > 0 ? `(${unread})` : ""}
            </a>
          </nav>
          {error && <p role="status">{error}</p>}
          {notifications.map((n) => (
            <a className="notification-preview" href={notificationHref(n)} key={n.id}>
              {!n.read_at && <span className="unread-dot" />}
              {n.title}
            </a>
          ))}
          <button className="btn ghost mini" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
function notificationHref(n: Notification) {
  return n.entry_id
    ? `/comments/${n.entry_id}${n.comment_id ? `#comment-${n.comment_id}` : ""}`
    : n.artwork_id
      ? `/profile#art-${n.artwork_id}`
      : "/profile";
}

export function ProfilePage({
  user,
  children,
  onChanged,
}: {
  user: User;
  children: ReactNode;
  onChanged: () => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null),
    [username, setUsername] = useState(""),
    [avatar, setAvatar] = useState<File | null>(null),
    [resetAvatar, setResetAvatar] = useState(false),
    [availability, setAvailability] = useState(""),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0),
    [tab, setTab] = useState("images"),
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
  }, [user.id, version]);
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
          <span className="eyebrow">Your archive console</span>
          <h1>{profile?.username || "Create your profile"}</h1>
          <p>Your email is private. Your username and avatar appear with comments.</p>
        </div>
      </header>
      <div className="member-tabs" role="group" aria-label="Profile sections">
        {[
          ["images", "My Images"],
          ["activity", "Activity"],
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
          {tab === "images" && (
            <>
              <div className="member-panel">
                <h2>
                  <ImageIcon size={20} /> Submit artwork
                </h2>
                {profile ? children : <p>Save your username above to unlock submissions.</p>}
              </div>
              <MyImages
                userId={user.id}
                refreshKey={version}
                onChanged={() => {
                  setVersion((v) => v + 1);
                  onChanged();
                }}
              />
            </>
          )}
          {tab === "activity" && <MyActivity userId={user.id} />}
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
function MyActivity({ userId }: { userId: string }) {
  const [items, setItems] = useState<{ id: string; entry_id: string; body: string }[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let stale = false;
    client()
      .from("entry_comments")
      .select("id,entry_id,body")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!stale) {
          if (error) setError(error.message);
          else setItems(data || []);
        }
      });
    return () => {
      stale = true;
    };
  }, [userId]);
  return (
    <section className="member-panel">
      <h2>Recent comments</h2>
      <Feedback error={error} />
      {items.length ? (
        items.map((c) => (
          <a className="activity-item" key={c.id} href={`/comments/${c.entry_id}#comment-${c.id}`}>
            {c.body}
          </a>
        ))
      ) : (
        <p>No recent comments.</p>
      )}
      <small>Showing your most recent 50 comments.</small>
    </section>
  );
}
function MyImages({
  userId,
  refreshKey,
  onChanged,
}: {
  userId: string;
  refreshKey: number;
  onChanged: () => void;
}) {
  const [localRefresh, setLocalRefresh] = useState(0);
  useEffect(() => {
    const refresh = () => setLocalRefresh((v) => v + 1);
    window.addEventListener("gsn-my-images-refresh", refresh);
    return () => window.removeEventListener("gsn-my-images-refresh", refresh);
  }, []);
  const [items, setItems] = useState<Artwork[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let stale = false;
    setLoading(true);
    getMyArt(userId)
      .then(async (data) => {
        let target: Artwork[] = [];
        if (
          /^#art-[0-9a-f-]{36}$/i.test(location.hash) &&
          !data.some((art) => `#art-${art.id}` === location.hash)
        ) {
          const { data: record, error } = await client()
            .from("artworks")
            .select("*")
            .eq("id", location.hash.slice(5))
            .eq("user_id", userId)
            .maybeSingle();
          if (error) throw error;
          if (record) target = await resolveArtworkImages([record as Artwork]);
        }
        if (!stale) {
          setItems([...target, ...data]);
          setCursor(data.at(-1)?.id || null);
          setMore(data.length === 24);
          setError("");
        }
      })
      .catch((e) => {
        if (!stale) setError(message(e));
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [userId, refreshKey, localRefresh]);
  useEffect(() => {
    if (!loading && location.hash.startsWith("#art-"))
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "center" });
  }, [loading]);
  const next = async () => {
    setBusy(true);
    try {
      const data = await getMyArt(userId, cursor || undefined);
      setItems((prev) => [...new Map([...prev, ...data].map((art) => [art.id, art])).values()]);
      setCursor(data.at(-1)?.id || cursor);
      setMore(data.length === 24);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <div className="member-section-head">
        <h2>My Images</h2>
        <button className="btn ghost mini" onClick={onChanged}>
          Refresh images
        </button>
      </div>
      <p>
        Rejected or removed submissions remain here with the moderation reason. Private image links
        expire after five minutes; refresh to renew them.
      </p>
      <Feedback error={error} />
      {loading ? (
        <p role="status">Loading your submissions…</p>
      ) : (
        <div className="member-image-grid">
          {items.map((art) => (
            <OwnedArtwork key={art.id} art={art} onChanged={onChanged} />
          ))}
          {!items.length && (
            <p className="member-panel">No submissions yet. Upload your first artwork above.</p>
          )}
        </div>
      )}
      {more && (
        <button className="btn" disabled={busy} onClick={next}>
          {busy ? "Loading…" : "Load more images"}
        </button>
      )}
    </section>
  );
}
function OwnedArtwork({ art, onChanged }: { art: Artwork; onChanged: () => void }) {
  const [reason, setReason] = useState(""),
    [title, setTitle] = useState(art.title),
    [description, setDescription] = useState(art.description),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [accepted, setAccepted] = useState(art.rating !== "nsfw");
  const act = async (action: string) => {
    if (
      action === "delete" &&
      !window.confirm(
        "Permanently delete this withdrawn submission and its stored image? This cannot be undone.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      if (action === "delete") await deleteMyArt(art);
      else await rpc("manage_member_art", { p_id: art.id, p_action: action, p_message: reason });
      onChanged();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const resubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await rpc("resubmit_member_art", {
        p_id: art.id,
        p_title: title,
        p_description: description,
      });
      onChanged();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="owned-art member-panel" id={`art-${art.id}`}>
      {accepted ? (
        <ImageViewerLink
          src={art.image_url}
          title={art.title}
          artworkId={art.id}
          mature={art.rating === "nsfw"}
          back="/profile"
        >
          <img className="owned-art-image" src={art.image_url} alt={art.title} loading="lazy" />
        </ImageViewerLink>
      ) : (
        <button className="mature-placeholder" onClick={() => setAccepted(true)}>
          Mature image · Show preview
        </button>
      )}
      <span className={`status-badge status-${art.status}`}>{art.status}</span>
      <h3>{art.title}</h3>
      <p>Artist credit: {art.artist_name}</p>
      {!art.storage_path && (
        <p className="legacy-warning">
          Legacy public upload: its old image URL may remain accessible outside the gallery.
        </p>
      )}
      {art.moderation_reason && (
        <p className="moderation-reason">
          <strong>Moderation reason:</strong> {art.moderation_reason}
        </p>
      )}
      {art.review_request && (
        <p>
          <strong>Review requested:</strong> {art.review_request}
        </p>
      )}
      <Feedback error={error} />
      {["rejected", "removed"].includes(art.status) && (
        <>
          <label>
            Request review
            <textarea
              className="text-area"
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this decision should be reviewed"
            />
          </label>
          <small>{reason.length} / 1,000</small>
          <button
            className="btn"
            disabled={busy || reason.trim().length < 3}
            onClick={() => act("review")}
          >
            Request review
          </button>
        </>
      )}
      {["rejected", "removed", "withdrawn"].includes(art.status) && (
        <details>
          <summary>Edit & resubmit</summary>
          <form className="member-form" onSubmit={resubmit}>
            <label>
              Title
              <input
                className="text-input"
                value={title}
                maxLength={150}
                required
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              Description
              <textarea
                className="text-area"
                value={description}
                maxLength={1000}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <p>
              This returns the same image to the moderation queue. To replace the image, create a
              new submission.
            </p>
            <button className="btn" disabled={busy}>
              Resubmit for review
            </button>
          </form>
        </details>
      )}
      <button
        className="btn danger mini"
        disabled={busy}
        onClick={() => act(art.status === "withdrawn" ? "delete" : "withdraw")}
      >
        {busy
          ? "Working…"
          : art.status === "withdrawn"
            ? "Permanently delete"
            : "Withdraw from gallery"}
      </button>
    </article>
  );
}

export function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(false);
  const refresh = async () => {
    setLoading(true);
    try {
      const n = await loadNotifications();
      setItems(n);
      setMore(n.length === 50);
      setError("");
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  const read = async (id?: string) => {
    setBusy(true);
    try {
      await rpc("mark_notifications_read", { p_id: id || null });
      setItems((prev) =>
        prev.map((n) => (!id || n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
      window.dispatchEvent(new Event("gsn-account-refresh"));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="member-console">
      <span className="eyebrow">Private inbox</span>
      <h1 className="display-title">
        Your <em>notifications</em>
      </h1>
      <div className="row-actions">
        <button className="btn ghost" onClick={refresh}>
          Refresh
        </button>
        <button
          className="btn"
          disabled={busy || !items.some((n) => !n.read_at)}
          onClick={() => read()}
        >
          Mark all as read
        </button>
      </div>
      <Feedback error={error} />
      {loading ? (
        <p role="status">Loading notifications…</p>
      ) : items.length ? (
        items.map((n) => (
          <article className={`notification-item ${n.read_at ? "" : "unread"}`} key={n.id}>
            <Bell size={18} />
            <div>
              <h2>
                <a href={notificationHref(n)}>{n.title}</a>
              </h2>
              <p>{n.message}</p>
              <time dateTime={n.created_at}>{new Date(n.created_at).toLocaleString()}</time>
            </div>
            {!n.read_at && (
              <button className="btn ghost mini" disabled={busy} onClick={() => read(n.id)}>
                Mark read
              </button>
            )}
          </article>
        ))
      ) : (
        <p className="member-panel">
          You’re all caught up. Artwork decisions and comment replies will appear here.
        </p>
      )}
      {more && (
        <button
          className="btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const next = await loadNotifications(items.at(-1)?.id);
              setItems((prev) => [...prev, ...next]);
              setMore(next.length === 50);
            } catch (e) {
              setError(message(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Load older notifications
        </button>
      )}
    </section>
  );
}

function mergeComments(a: Comment[], b: Comment[]) {
  return [...new Map([...a, ...b].map((c) => [c.id, c])).values()].sort(
    (x, y) => x.created_at.localeCompare(y.created_at) || x.id.localeCompare(y.id),
  );
}

export function CommentsPage({
  entryId,
  user,
  isAdmin,
  onSignIn,
}: {
  entryId: string;
  user: User | null;
  isAdmin: boolean;
  onSignIn: () => void;
}) {
  const [entry, setEntry] = useState<{ name: string; category: string } | null>(null),
    [comments, setComments] = useState<Comment[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let stale = false;
    setLoading(true);
    Promise.all([
      client().from("archive_entries").select("name,category").eq("id", entryId).maybeSingle(),
      rpc<Comment[]>("comment_page", { p_entry: entryId }),
      /^#comment-[0-9a-f-]{36}$/i.test(location.hash)
        ? rpc<Comment[]>("comment_context", { p_comment: location.hash.slice(9) })
        : Promise.resolve([] as Comment[]),
    ])
      .then(([e, c, context]) => {
        if (e.error) throw e.error;
        if (!e.data) throw new Error("Entry not found.");
        if (!stale) {
          setEntry(e.data);
          setComments(
            mergeComments(
              c,
              context.filter((row) => row.entry_id === entryId),
            ),
          );
          setCursor(c.at(-1)?.id || null);
          setMore(c.length === 50);
          setError("");
        }
      })
      .catch((e) => {
        if (!stale) setError(message(e));
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [entryId, version]);
  useEffect(() => {
    if (!loading && location.hash.startsWith("#comment-"))
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "center" });
  }, [loading, comments]);
  const refresh = () => setVersion((v) => v + 1);
  const remove = async (id: string) => {
    if (!window.confirm("Delete this comment? Replies remain in the thread.")) return;
    setBusy(true);
    try {
      await rpc("delete_entry_comment", { p_id: id });
      refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const render = (c: Comment) => (
    <article
      className={`comment-card ${c.is_admin ? "admin-comment" : ""}`}
      id={`comment-${c.id}`}
      key={c.id}
    >
      <Avatar path={c.avatar_path} username={c.username} />
      <div className="comment-content">
        <header>
          <strong>{c.username || "Former member"}</strong>
          {c.is_admin && <span className="admin-badge">Admin</span>}
          <time dateTime={c.created_at}>{new Date(c.created_at).toLocaleString()}</time>
        </header>
        <p>{c.deleted_at ? "Comment deleted" : c.body}</p>
        {!c.deleted_at && user && (c.user_id === user.id || isAdmin) && (
          <button className="btn ghost mini" disabled={busy} onClick={() => remove(c.id)}>
            Delete comment
          </button>
        )}
      </div>
    </article>
  );
  return (
    <section className="comments-page">
      <a
        className="back-link"
        href={entry ? `/entry/${entry.category}/${encodeURIComponent(entry.name)}` : "/"}
      >
        <ArrowLeft size={14} /> Back to dossier
      </a>
      <span className="eyebrow">Discussion dossier</span>
      <h1 className="display-title">
        {entry?.name || "Entry"} <em>comments</em>
      </h1>
      <p>
        Be respectful. Admins can respond to any comment; the original author can continue their
        thread after an admin responds. Other members can post their own comments.
      </p>
      <Feedback error={error} />
      {loading ? (
        <p role="status">Loading discussion…</p>
      ) : (
        <>
          {entry &&
            (user ? (
              <CommentComposer entryId={entryId} onPosted={refresh} />
            ) : (
              <button className="btn primary" onClick={onSignIn}>
                Sign in to comment
              </button>
            ))}
          <button className="btn ghost mini" onClick={refresh}>
            Refresh discussion
          </button>
          {comments
            .filter((c) => !c.parent_id)
            .map((root) => {
              const replies = comments.filter((c) => c.parent_id === root.id);
              const canReply =
                user &&
                !root.deleted_at &&
                (isAdmin ||
                  (root.user_id === user.id && replies.some((c) => c.is_admin && !c.deleted_at)));
              return (
                <section className="comment-thread" key={root.id}>
                  {render(root)}
                  <div className="thread-replies">
                    {replies.map(render)}
                    {canReply && (
                      <details>
                        <summary>Reply in this thread</summary>
                        <CommentComposer entryId={entryId} parentId={root.id} onPosted={refresh} />
                      </details>
                    )}
                  </div>
                </section>
              );
            })}
          {!comments.length && entry && (
            <p className="member-panel">No comments yet. Start the discussion.</p>
          )}
          {more && (
            <button
              className="btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const next = await rpc<Comment[]>("comment_page", {
                    p_entry: entryId,
                    p_after: cursor,
                  });
                  setComments((prev) => mergeComments(prev, next));
                  setCursor(next.at(-1)?.id || cursor);
                  setMore(next.length === 50);
                } catch (e) {
                  setError(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Loading…" : "Load more comments"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
function CommentComposer({
  entryId,
  parentId,
  onPosted,
}: {
  entryId: string;
  parentId?: string;
  onPosted: () => void;
}) {
  const [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  return (
    <form
      className="comment-composer member-panel"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy || cooldown) return;
        setBusy(true);
        setError("");
        try {
          await rpc("post_entry_comment", {
            p_entry: entryId,
            p_body: body,
            p_parent: parentId || null,
          });
          setBody("");
          setCooldown(15);
          onPosted();
          window.dispatchEvent(new Event("gsn-account-refresh"));
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        {parentId ? "Your reply" : "Your comment"}
        <textarea
          className="text-area"
          maxLength={1000}
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-describedby={`counter-${parentId || "new"}`}
          placeholder="Plain text only. Choose a username in Profile before posting."
        />
      </label>
      <div className="composer-foot">
        <span id={`counter-${parentId || "new"}`}>{body.length} / 1,000</span>
        <button className="btn primary" disabled={busy || cooldown > 0 || !body.trim()}>
          {busy
            ? "Posting…"
            : cooldown
              ? `Wait ${cooldown}s`
              : parentId
                ? "Post reply"
                : "Post comment"}
        </button>
      </div>
      <Feedback error={error} />
      {error.includes("username") && <a href="/profile">Set up your profile</a>}
    </form>
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

async function moderationRows(status: string, cursor?: Artwork | null) {
  let query = client()
    .from("artworks")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(24);
  if (cursor)
    query = query.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
    );
  const { data, error } = await query;
  if (error) throw error;
  return resolveArtworkImages((data || []) as Artwork[]);
}

export function ModerationPage({ onChanged }: { onChanged: () => void }) {
  const [filter, setFilter] = useState("pending"),
    [items, setItems] = useState<Artwork[]>([]),
    [cursor, setCursor] = useState<Artwork | null>(null),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  const generation = useRef<symbol>(Symbol());
  const load = async (append = false) => {
    const request = Symbol();
    generation.current = request;
    setLoading(true);
    setError("");
    try {
      const rows = await moderationRows(filter, append ? cursor : null);
      if (request === generation.current) {
        setItems((prev) => (append ? [...prev, ...rows] : rows));
        setCursor(rows.at(-1) || null);
        setMore(rows.length === 24);
      }
    } catch (e) {
      if (request === generation.current) setError(message(e));
    } finally {
      if (request === generation.current) setLoading(false);
    }
  };
  useEffect(() => {
    const request = Symbol();
    generation.current = request;
    setItems([]);
    setLoading(true);
    setError("");
    moderationRows(filter)
      .then((rows) => {
        if (request === generation.current) {
          setItems(rows);
          setCursor(rows.at(-1) || null);
          setMore(rows.length === 24);
        }
      })
      .catch((e) => {
        if (request === generation.current) setError(message(e));
      })
      .finally(() => {
        if (request === generation.current) setLoading(false);
      });
    return () => {
      generation.current = Symbol();
    };
  }, [filter, version]);
  const changed = () => {
    setVersion((v) => v + 1);
    onChanged();
  };
  return (
    <section className="member-console">
      <span className="eyebrow">Admin / community control</span>
      <h1 className="display-title">
        Artwork <em>moderation</em>
      </h1>
      <p>
        Rejection and removal require a reason, delivered privately to the owner. Review requests
        preserve the original submission and decision history.
      </p>
      <div className="member-tabs">
        {["pending", "approved", "rejected", "removed"].map((state) => (
          <button
            className={`btn ${filter === state ? "primary" : "ghost"}`}
            key={state}
            onClick={() => setFilter(state)}
          >
            {state}
          </button>
        ))}
        <button className="btn ghost" onClick={() => setVersion((v) => v + 1)}>
          Refresh
        </button>
      </div>
      <Feedback error={error} />
      <div className="moderation-list">
        {items.map((art) => (
          <ModerationDecision key={art.id} art={art} onChanged={changed} />
        ))}
      </div>
      {loading ? (
        <p role="status">Loading submissions…</p>
      ) : (
        !items.length && <p className="member-panel">No {filter} submissions.</p>
      )}
      {more && (
        <button className="btn" disabled={loading} onClick={() => load(true)}>
          Load more submissions
        </button>
      )}
    </section>
  );
}
function ModerationDecision({ art, onChanged }: { art: Artwork; onChanged: () => void }) {
  const [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(art.rating !== "nsfw");
  const decide = async (status: "approved" | "rejected" | "removed") => {
    setBusy(true);
    setError("");
    try {
      await setArtStatus(art.id, status, reason);
      onChanged();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const [history, setHistory] = useState<
    { id: string; action: string; reason: string; created_at: string }[]
  >([]);
  const loadHistory = async () => {
    try {
      const { data, error } = await client()
        .from("artwork_moderation_log")
        .select("id,action,reason,created_at")
        .eq("artwork_id", art.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setHistory(data || []);
    } catch (e) {
      setError(message(e));
    }
  };
  return (
    <article className="moderation-card">
      <div>
        {show ? (
          <img src={art.image_url} alt={art.title} loading="lazy" />
        ) : (
          <button className="mature-placeholder" onClick={() => setShow(true)}>
            Mature submission · Show preview
          </button>
        )}
      </div>
      <div className="moderation-info">
        <span className={`status-badge status-${art.status}`}>{art.status}</span>
        <h2>{art.title}</h2>
        <p>
          Artist credit: {art.artist_name} · {art.rating === "nsfw" ? "Mature" : "General"}
        </p>
        <p>{art.description}</p>
        {art.review_request && (
          <p className="moderation-reason">
            <strong>Review requested:</strong> {art.review_request}
          </p>
        )}
        {art.moderation_reason && <p>Previous reason: {art.moderation_reason}</p>}
        {["pending", "approved"].includes(art.status) && (
          <>
            <label>
              Reason to send the owner
              <textarea
                className="text-area"
                value={reason}
                maxLength={1000}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Required for rejection or removal"
              />
            </label>
            <small>{reason.length} / 1,000</small>
            <div className="row-actions">
              {art.status === "pending" && (
                <button className="btn primary" disabled={busy} onClick={() => decide("approved")}>
                  Approve
                </button>
              )}
              <button
                className="btn danger"
                disabled={busy || reason.trim().length < 3}
                onClick={() => decide(art.status === "approved" ? "removed" : "rejected")}
              >
                {art.status === "approved" ? "Remove from gallery" : "Reject"}
              </button>
            </div>
          </>
        )}
        <Feedback error={error} />
        <details
          onToggle={(e) => {
            if (e.currentTarget.open) void loadHistory();
          }}
        >
          <summary>Moderation history (latest 50)</summary>
          {history.map((h) => (
            <p key={h.id}>
              <strong>{h.action}</strong> · {new Date(h.created_at).toLocaleString()}
              <br />
              {h.reason}
            </p>
          ))}
        </details>
      </div>
    </article>
  );
}
