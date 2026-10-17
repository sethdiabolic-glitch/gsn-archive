import { supabase } from "./community";
export const DEFAULT_AVATAR = "/gsn-logo.png";
export type Profile = { user_id: string; username: string; avatar_path: string | null };
export type Comment = {
  id: string;
  entry_id: string;
  user_id: string | null;
  parent_id: string | null;
  body: string;
  created_at: string;
  deleted_at: string | null;
  username: string | null;
  avatar_path: string | null;
  is_admin: boolean;
};
export type Notification = {
  id: string;
  kind: string;
  title: string;
  message: string;
  artwork_id: string | null;
  entry_id: string | null;
  comment_id: string | null;
  created_at: string;
  read_at: string | null;
};
export type Notice = {
  id: string;
  title: string;
  message: string;
  link: string | null;
  active: boolean;
  expires_at: string | null;
  updated_at: string;
};
export function client() {
  if (!supabase) throw new Error("Shared storage is not connected.");
  return supabase;
}
export async function rpc<T = unknown>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await client().rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
export function avatarUrl(path?: string | null) {
  return path
    ? client().storage.from("member-avatars").getPublicUrl(path).data.publicUrl
    : DEFAULT_AVATAR;
}
export function usernameError(name: string): string {
  if (!/^[A-Za-z0-9_]{3,24}$/.test(name)) return "Use 3–24 letters, numbers or underscores.";
  if (["admin", "administrator", "moderator", "system", "gsn"].includes(name.toLowerCase()))
    return "That name is reserved.";
  return "";
}
export function safeNoticeLink(link?: string | null) {
  try {
    const u = new URL(link || "");
    return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
}
export async function loadProfile(id: string): Promise<Profile | null> {
  const { data, error } = await client()
    .from("member_profiles")
    .select("user_id,username,avatar_path")
    .eq("user_id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
export async function usernameAvailable(name: string, _userId: string) {
  return rpc<boolean>("member_username_available", { p_username: name });
}
export async function uploadAvatar(file: File, userId: string) {
  const types: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  };
  if (!types[file.type] || file.size > 2 * 1024 * 1024)
    throw new Error("Choose a PNG, JPEG or WebP image under 2 MB.");
  const path = `${userId}/${crypto.randomUUID()}.${types[file.type]}`;
  const { error } = await client()
    .storage.from("member-avatars")
    .upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return path;
}
export async function loadNotifications(after?: string) {
  return rpc<Notification[]>("notification_page", { p_after: after || null });
}
export async function loadNotices(admin = false) {
  let query = client()
    .from("site_notices")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (!admin) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as Notice[];
}
