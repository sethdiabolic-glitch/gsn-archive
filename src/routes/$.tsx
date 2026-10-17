import { pageMeta } from '../lib/page-meta';
import { createFileRoute } from "@tanstack/react-router";
import { GsnArenaApp } from "../GsnArenaApp";

export const Route = createFileRoute("/$")({
  head: ({ params }) => pageMeta('/' + (params._splat || '')),
  component: GsnArenaApp,
});
