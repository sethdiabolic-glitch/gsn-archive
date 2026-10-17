import type { ReactNode } from "react";
import { imageViewPath } from "./lib/image-viewer";

/** Real links work without JS and preserve normal new-tab/context-menu behaviour. */
export function ImageViewerLink({
  src,
  title,
  credit,
  mature,
  back,
  className,
  children,
}: {
  src: string;
  title: string;
  credit?: string | undefined;
  mature?: boolean | undefined;
  back?: string | undefined;
  className?: string | undefined;
  children: ReactNode;
}) {
  const path = imageViewPath(src, title, { credit, mature, back });
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
          imageViewPath(src, title, {
            credit,
            mature,
            back: window.location.pathname + window.location.search,
          }) || path;
      }}
    >
      {children}
    </a>
  );
}
