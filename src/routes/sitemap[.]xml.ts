import { createFileRoute } from "@tanstack/react-router";
import { fetchEntries, sitemapXml } from "../lib/crawler.server";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return new Response(sitemapXml(await fetchEntries()), {
            headers: {
              "content-type": "application/xml; charset=utf-8",
              "cache-control": "public, max-age=300",
            },
          });
        } catch {
          return new Response("Archive temporarily unavailable. Please retry.", {
            status: 503,
            headers: { "retry-after": "60", "cache-control": "no-store" },
          });
        }
      },
    },
  },
});
