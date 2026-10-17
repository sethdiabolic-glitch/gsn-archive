export type ImageView = {
  src: string;
  art?: string;
  title: string;
  credit: string;
  back: string;
  mature: boolean;
};

export function safeImageSource(value: unknown): string {
  if (typeof value !== "string" || value.length > 8192) return "";
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}
export function safeImageBack(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  )
    return "/community";
  try {
    const base = "https://archive.invalid";
    const url = new URL(value, base);
    if (url.origin !== base || url.pathname === "/image") return "/community";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/community";
  }
}
export function imageSearch(search: Record<string, unknown>): ImageView {
  return {
    src: safeImageSource(search["src"]),
    ...(typeof search["art"] === "string" && /^[0-9a-f-]{36}$/i.test(search["art"])
      ? { art: search["art"] }
      : {}),
    title: typeof search["title"] === "string" ? search["title"].slice(0, 250) : "Archive image",
    credit: typeof search["credit"] === "string" ? search["credit"].slice(0, 200) : "",
    back: safeImageBack(search["back"]),
    mature: search["mature"] === "1" || search["mature"] === 1 || search["mature"] === true,
  };
}
export function imageViewPath(
  src: string,
  title: string,
  options: {
    back?: string | undefined;
    credit?: string | undefined;
    mature?: boolean | undefined;
  } = {},
): string | null {
  const safe = safeImageSource(src);
  if (!safe) return null;
  const params = new URLSearchParams({ src: safe, title: title.slice(0, 250) });
  if (options.credit) params.set("credit", options.credit.slice(0, 200));
  if (options.back) params.set("back", safeImageBack(options.back));
  if (options.mature) params.set("mature", "1");
  return `/image?${params}`;
}
export function imageShareUrl(href: string): string {
  const url = new URL(href);
  url.searchParams.delete("back");
  url.hash = "";
  return url.href;
}
export function imageDownloadName(src: string, title: string, mime: string): string {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/avif": "avif",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
    "image/x-icon": "ico",
  };
  let extension = extensions[mime.split(";")[0]!.toLowerCase()];
  if (!extension) {
    try {
      const candidate = new URL(src).pathname.split(".").pop()?.toLowerCase();
      if (candidate && Object.values(extensions).includes(candidate)) extension = candidate;
    } catch {
      /* Use fallback extension. */
    }
  }
  const name =
    title
      .split("")
      .map((character) => (character.charCodeAt(0) < 32 ? "-" : character))
      .join("")
      .replace(/[<>:"/\\|?*]/g, "-")
      .replace(/^\.+/, "")
      .trim()
      .slice(0, 100) || "archive-image";
  return `${name}.${extension || "img"}`;
}
