import { uniqueTags } from "./gallery";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type ArtworkStatus = "pending" | "approved" | "rejected" | "removed" | "withdrawn";
export type ArtworkRating = "sfw" | "nsfw";

export type Artwork = {
  id: string;
  title: string;
  artist_name: string;
  description: string;
  image_url: string;
  rating: ArtworkRating;
  status: ArtworkStatus;
  created_at: string;
  user_id?: string;
  tags?: string[];
  storage_path?: string | null;
  moderation_reason?: string;
  review_request?: string;
};

const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const key = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

const DEMO_KEY = "gsnArenaCommunityArt";

export function getDemoArt(): Artwork[] {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]") as Artwork[];
  } catch {
    return [];
  }
}

export function saveDemoArt(items: Artwork[]) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(items));
}

export async function getArt(): Promise<Artwork[]> {
  if (!supabase) return getDemoArt();
  const { data, error } = await supabase
    .from("artworks")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return resolveArtworkImages((data || []) as Artwork[]);
}

export async function getPendingArt(): Promise<Artwork[]> {
  if (!supabase) return getDemoArt().filter((a) => a.status === "pending");
  const { data, error } = await supabase
    .from("artworks")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return resolveArtworkImages((data || []) as Artwork[]);
}

export async function submitArt(input: {
  title: string;
  artist_name: string;
  description: string;
  rating: ArtworkRating;
  file: File;
  tags?: string[];
}): Promise<void> {
  if (!supabase) {
    const reader = new FileReader();
    const image_url = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(input.file);
    });
    const items = getDemoArt();
    items.unshift({
      id: crypto.randomUUID(),
      title: input.title,
      artist_name: input.artist_name,
      description: input.description,
      image_url,
      rating: input.rating,
      status: "pending",
      created_at: new Date().toISOString(),
    });
    saveDemoArt(items);
    return;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in before submitting artwork.");
  const types: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  if (!types[input.file.type] || input.file.size > 12 * 1024 * 1024)
    throw new Error("Choose a PNG, JPEG, WebP or GIF under 12 MB.");
  const path = `${user.id}/${crypto.randomUUID()}.${types[input.file.type]}`;
  const { error: uploadError } = await supabase.storage
    .from("member-art")
    .upload(path, input.file, { upsert: false, contentType: input.file.type });
  if (uploadError) throw new Error(uploadError.message);
  const { error } = await supabase.from("artworks").insert({
    title: input.title,
    artist_name: input.artist_name,
    description: input.description,
    rating: input.rating,
    image_url: "",
    storage_path: path,
    status: "pending",
    user_id: user.id,
    tags: uniqueTags(input.tags || []),
  });
  if (error) {
    const { error: cleanupError } = await supabase.storage.from("member-art").remove([path]);
    if (cleanupError)
      throw new Error(
        "Submission failed and the uploaded file could not be cleaned up. Please contact an admin.",
      );
    throw new Error(error.message);
  }
}

// Calls the is_gsn_admin() database function (see supabase-schema.sql).
// This runs as SECURITY DEFINER, so it can safely tell a signed-in user
// whether THEY are an admin, without ever exposing the admin list itself.
export async function isGsnAdmin(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("is_gsn_admin");
  if (error) return false;
  return data === true;
}

export async function resolveArtworkImages(items: Artwork[]): Promise<Artwork[]> {
  if (!supabase) return items;
  const paths = [...new Set(items.flatMap((art) => (art.storage_path ? [art.storage_path] : [])))];
  if (!paths.length) return items;
  const signed = new Map<string, string>();
  for (let offset = 0; offset < paths.length; offset += 100) {
    const { data, error } = await supabase.storage
      .from("member-art")
      .createSignedUrls(paths.slice(offset, offset + 100), 300);
    if (error) throw new Error("Could not load artwork images. Refresh to retry.");
    for (const row of data || [])
      if (row.path && row.signedUrl) signed.set(row.path, row.signedUrl);
  }
  return items.map((art) =>
    art.storage_path ? { ...art, image_url: signed.get(art.storage_path) || "" } : art,
  );
}

export async function getMyArt(userId: string, before?: string): Promise<Artwork[]> {
  if (!supabase) throw new Error("Storage is not connected.");
  const { data, error } = await supabase.rpc("my_art_page", { p_after: before || null });
  if (error) throw new Error(error.message);
  return resolveArtworkImages((data || []) as Artwork[]);
}
export async function setArtStatus(id: string, status: ArtworkStatus, reason = ""): Promise<void> {
  if (!supabase) throw new Error("Storage is not connected.");
  const { error } = await supabase.rpc("moderate_member_art", {
    p_id: id,
    p_status: status,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
}

export async function uploadArchiveImage(file: File): Promise<string> {
  if (!supabase) throw new Error("Storage is not connected.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in first.");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${user.id}/archive-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("community-art")
    .upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from("community-art").getPublicUrl(path).data.publicUrl;
}

export async function deleteMyArt(art: Artwork): Promise<void> {
  if (!supabase) throw new Error("Storage is not connected.");
  if (art.status !== "withdrawn") throw new Error("Withdraw the artwork first.");
  let path = art.storage_path,
    bucket = "member-art";
  if (!path) {
    const prefix = `${url}/storage/v1/object/public/community-art/`;
    if (!art.image_url.startsWith(prefix))
      throw new Error("Unrecognised image location. Ask an admin for help.");
    path = decodeURIComponent(art.image_url.slice(prefix.length).split("?")[0]!);
    bucket = "community-art";
  }
  // A missing record means a previous attempt may already have deleted it. Retry file cleanup.
  const { data: existing, error: readError } = await supabase
    .from("artworks")
    .select("id")
    .eq("id", art.id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (existing) {
    const { error } = await supabase.rpc("manage_member_art", { p_id: art.id, p_action: "delete" });
    if (error) throw new Error(error.message);
  }
  const { data: removed, error: cleanup } = await supabase.storage.from(bucket).remove([path]);
  if (cleanup)
    throw new Error(
      "Record deleted, but image cleanup failed. Retry permanent deletion: " + cleanup.message,
    );
  if (!removed?.length) {
    const slash = path.lastIndexOf("/");
    const { data: files, error } = await supabase.storage
      .from(bucket)
      .list(path.slice(0, slash), { search: path.slice(slash + 1) });
    if (error || files?.some((file) => file.name === path!.slice(slash + 1)))
      throw new Error(
        "Image cleanup was not permitted. Retry permanent deletion or contact an admin.",
      );
  }
}

export async function submitArtBatch(input: {
  title: string;
  artist_name: string;
  description: string;
  rating: ArtworkRating;
  items: { file: File; tags: string[]; title: string }[];
  onUploaded?: (file: File) => void;
}): Promise<void> {
  if (input.items.length > 13) throw new Error("You can upload up to 13 images at once.");
  for (let i = 0; i < input.items.length; i++) {
    const it = input.items[i];
    if (!it) continue;
    const title = it.title.trim() || input.title;
    await submitArt({
      title,
      artist_name: input.artist_name,
      description: input.description,
      rating: input.rating,
      file: it.file,
      tags: it.tags,
    });
    input.onUploaded?.(it.file);
  }
}

export async function uploadArchiveFile(file: File, prefix = "voice"): Promise<string> {
  if (!supabase) throw new Error("Storage is not connected.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in first.");
  const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
  const path = `${user.id}/${prefix}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("community-art")
    .upload(path, file, file.type ? { upsert: false, contentType: file.type } : { upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from("community-art").getPublicUrl(path).data.publicUrl;
}
