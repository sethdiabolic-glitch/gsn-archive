import { ImageViewerLink } from "./ImageViewerLink";
import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import parse, { Text, attributesToProps, type DOMNode } from "html-react-parser";
import { X, BookOpen } from "lucide-react";
import { type LinkedEntry } from "./lib/reference-tools";
import { legacyToHtml } from "./lib/entry-content";
import {
  referenceHref,
  referenceIndex,
  referenceParts,
  type ReferenceEntry,
  type ReferenceAlias,
} from "./lib/entry-references";

const ReferenceContext = createContext<{
  entries: LinkedEntry[];
  aliases: ReferenceAlias[];
  resolve: (name: string) => ReferenceEntry | undefined;
  define: (entry: ReferenceEntry, trigger: HTMLElement) => void;
  navigate: (path: string) => void;
} | null>(null);

export function ArchiveReferences({
  entries,
  aliases,
  navigate,
  children,
}: {
  entries: LinkedEntry[];
  aliases: ReferenceAlias[];
  navigate: (path: string) => void;
  children: ReactNode;
}) {
  const resolve = useMemo(() => referenceIndex(entries, aliases), [entries, aliases]);
  const trigger = useRef<HTMLElement | null>(null);
  const [selected, setSelected] = useState<ReferenceEntry | null>(null);
  const value = useMemo(
    () => ({
      resolve,
      entries,
      aliases,
      define: (entry: ReferenceEntry, element: HTMLElement) => {
        trigger.current = element;
        setSelected(entry);
      },
      navigate: (path: string) => {
        setSelected(null);
        navigate(path);
      },
    }),
    [resolve, navigate, entries, aliases],
  );
  return (
    <ReferenceContext.Provider value={value}>
      {children}
      <Dialog.Root
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="definition-overlay" />
          <Dialog.Content
            className="definition-card"
            aria-describedby={undefined}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              trigger.current?.focus();
            }}
          >
            <div className="eyebrow">
              <BookOpen size={14} /> Appendix / definition
            </div>
            <Dialog.Title className="definition-title">{selected?.name}</Dialog.Title>
            <Dialog.Close className="definition-close btn ghost" aria-label="Close definition">
              <X size={18} />
            </Dialog.Close>
            <div className="rich-document definition-body">
              <ReferenceHtml html={legacyToHtml(selected?.summary || "")} />
            </div>
            {selected && (
              <a
                className="btn definition-open"
                href={referenceHref(selected)}
                onClick={(event) => {
                  if (
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                  )
                    return;
                  event.preventDefault();
                  setSelected(null);
                  navigate(referenceHref(selected));
                }}
              >
                Open full Appendix entry
              </a>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ReferenceContext.Provider>
  );
}

export function ReferenceInline({ text }: { text: string }) {
  const context = useContext(ReferenceContext);
  if (!context) return <>{text}</>;
  return (
    <>
      {referenceParts(text, context.resolve).map((part, index) => {
        if (!part.entry) return <span key={index}>{part.text}</span>;
        const entry = part.entry;
        if (entry.category === "appendix")
          return (
            <button
              key={index}
              type="button"
              className="reference-token reference-definition"
              aria-haspopup="dialog"
              title={`Definition: ${entry.name}`}
              onClick={(event) => context.define(entry, event.currentTarget)}
            >
              {part.text}
            </button>
          );
        return (
          <a
            key={index}
            className="reference-token reference-entry"
            href={referenceHref(entry)}
            title={`Open ${entry.name}`}
            onClick={(event) => {
              if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              event.preventDefault();
              context.navigate(referenceHref(entry));
            }}
          >
            {part.text}
          </a>
        );
      })}
    </>
  );
}

/** Only decorate text, never HTML attributes, existing links, or literal code examples. */
export function ReferenceHtml({ html }: { html: string }) {
  return (
    <>
      {parse(html, {
        replace(node: DOMNode) {
          if ("name" in node && node.name === "img" && "attribs" in node) {
            let ancestor = node.parent;
            while (ancestor) {
              if ("name" in ancestor && ["a", "button"].includes(ancestor.name)) return;
              ancestor = ancestor.parent;
            }
            const src = node.attribs["src"] || "";
            const title = node.attribs["alt"] || "Summary image";
            const props = attributesToProps(node.attribs);
            // Keep floated images and surrounding text flowing as in the editor.
            return (
              <ImageViewerLink
                src={src}
                title={title}
                className={`summary-image-link float-${node.attribs["data-float"] || "none"}`}
              >
                <img {...props} alt={title} />
              </ImageViewerLink>
            );
          }
          if (!(node instanceof Text) || !node.data.includes("*")) return;
          let parent = node.parent;
          while (parent) {
            if ("name" in parent && ["a", "button", "code", "pre"].includes(parent.name)) return;
            parent = parent.parent;
          }
          return <ReferenceInline text={node.data} />;
        },
      })}
    </>
  );
}

export function useArchiveReferences() {
  return useContext(ReferenceContext);
}
