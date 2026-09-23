import { createFileRoute } from "@tanstack/react-router";
import { GsnArenaApp } from "../GsnArenaApp";

export const Route = createFileRoute("/$")({
  head: () => ({
    meta: [
      { title: "GSN Arena — Intelligence Archive" },
      { name: "description", content: "Browse GSN Arena dossiers, rankings, comparisons, references, and community artwork." },
      { property: "og:title", content: "GSN Arena — Intelligence Archive" },
      { property: "og:description", content: "Browse GSN Arena dossiers, rankings, comparisons, references, and community artwork." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GsnArenaApp,
});
