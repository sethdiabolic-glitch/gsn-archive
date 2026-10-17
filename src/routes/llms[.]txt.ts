import { createFileRoute } from "@tanstack/react-router";
import { fetchEntries, llmsText } from "../lib/crawler.server";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return new Response(llmsText(await fetchEntries()), {
            headers: {
              "content-type": "text/plain; charset=utf-8",
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
