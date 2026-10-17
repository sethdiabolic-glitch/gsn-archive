import { loadPublicArchivePage } from "../lib/archive-loader";
import { pageMeta } from "../lib/page-meta";
import { createFileRoute } from "@tanstack/react-router";
import { GsnArenaApp } from "../GsnArenaApp";

export const Route = createFileRoute("/$")({
  loader: ({ params }) =>
    ["editor", "community-editor"].includes((params._splat || "").split("/")[0] || "")
      ? null
      : loadPublicArchivePage(),
  head: ({ params, loaderData }) => pageMeta("/" + (params._splat || ""), loaderData),
  component: ArchiveRoute,
});

function ArchiveRoute() {
  const initialArchive = Route.useLoaderData();
  return <GsnArenaApp initialArchive={initialArchive} />;
}
