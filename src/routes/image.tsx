import { createFileRoute } from "@tanstack/react-router";
import { ImageViewer } from "../ImageViewer";
import { imageSearch } from "../lib/image-viewer";

export const Route = createFileRoute("/image")({
  validateSearch: imageSearch,
  head: ({ match }) => ({
    meta: [
      { title: `${match.search.title || "Image viewer"} — GSN Arena` },
      { name: "robots", content: "noindex, follow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: ImagePage,
});
function ImagePage() {
  const image = Route.useSearch();
  return <ImageViewer key={`${image.src}/${image.mature}`} image={image} />;
}
