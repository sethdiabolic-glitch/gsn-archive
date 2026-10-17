import { createServerFn, createIsomorphicFn } from "@tanstack/react-start";

export const getPublicArchive = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { fetchEntries } = await import("./crawler.server");
    const { archiveFromRows } = await import("./public-archive");
    return archiveFromRows(await fetchEntries());
  } catch {
    // Visitors can still retry in the browser. Never index authored demo/cache content as live data.
    return null;
  }
});

const markUnavailable = createIsomorphicFn()
  .server(async () => {
    const { setResponseHeader } = await import("@tanstack/react-start/server");
    setResponseHeader("X-GSN-Archive-Unavailable", "1");
    setResponseHeader("Retry-After", "60");
  })
  .client(() => {});

export async function loadPublicArchivePage() {
  const archive = await getPublicArchive();
  if (!archive) await markUnavailable();
  return archive;
}
