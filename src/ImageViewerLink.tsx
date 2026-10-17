import type { ReactNode } from "react";
import { imageViewPath } from "./lib/image-viewer";

/** Real links work without JS and preserve normal new-tab/context-menu behaviour. */
export function ImageViewerLink({
  src,
  artworkId,
  title,
  credit,
  mature,
  back,
  className,
  children,
}: {
  src: string;
  artworkId?: string | undefined;
  title: string;
  credit?: string | undefined;
  mature?: boolean | undefined;
  back?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  const makePath = (returnTo?: string) => {
    if (artworkId && /^[0-9a-f-]{36}$/i.test(artworkId)) {
      const params = new URLSearchParams({ art: artworkId, title });
      if (returnTo) params.set("back", returnTo);
      return `/image?${params}`;
    }
    return imageViewPath(src, title, { credit, mature, back: returnTo });
  };
  const path = makePath(back);
  if (!path) return <>{children}</>;
  return (
    <a
      className={className || "image-view-link"}
      href={path}
      aria-label={`View image: ${title}`}
      onClick={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          back
        )
          return;
        event.currentTarget.href =
          makePath(window.location.pathname + window.location.search) || path;
      }}
    >
      {children}
    </a>
  );
}
