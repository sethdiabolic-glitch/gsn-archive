import sanitizeHtml from "sanitize-html";

const alignment = { "text-align": [/^(left|center|right|justify)$/] };
const widths = { width: [/^\d+(?:\.\d+)?(?:px|%)$/], "min-width": [/^\d+(?:\.\d+)?px$/] };

export function cleanEntryHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "h2",
      "h3",
      "ul",
      "ol",
      "li",
      "blockquote",
      "img",
      "a",
      "code",
      "pre",
      "hr",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
      "colgroup",
      "col",
    ],
    allowedAttributes: {
      img: ["src", "alt", "data-float"],
      a: ["href", "target", "rel"],
      p: ["style"],
      h2: ["style"],
      h3: ["style"],
      ol: ["start"],
      table: ["style"],
      col: ["style", "span"],
      td: ["colspan", "rowspan", "colwidth", "style"],
      th: ["colspan", "rowspan", "colwidth", "style"],
    },
    allowedStyles: {
      p: alignment,
      h2: alignment,
      h3: alignment,
      table: widths,
      col: widths,
      td: { ...alignment, ...widths },
      th: { ...alignment, ...widths },
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      img: (tag, attribs) => ({
        tagName: tag,
        attribs: {
          src: attribs["src"] || "",
          alt: attribs["alt"] || "",
          "data-float": ["left", "right"].includes(attribs["data-float"] || "")
            ? attribs["data-float"]!
            : "none",
        },
      }),
      a: (_tag, attribs) => ({
        tagName: "a",
        attribs: { href: attribs["href"] || "", target: "_blank", rel: "noopener noreferrer" },
      }),
      "*": (tag, attribs) => {
        // Keep pasted/resized table geometry, never arbitrary attribute contents.
        const safe = { ...attribs };
        for (const key of ["colspan", "rowspan", "span"]) {
          if (safe[key] && !/^[1-9]\d{0,2}$/.test(safe[key]!)) delete safe[key];
        }
        if (safe["colwidth"] && !/^\d{1,4}(,\d{1,4})*$/.test(safe["colwidth"]))
          delete safe["colwidth"];
        return { tagName: tag, attribs: safe };
      },
    },
  });
}

export function isEntryHtml(value: string): boolean {
  return /^\s*<(p|h[23]|ul|ol|blockquote|img|table|pre|hr)\b/i.test(value);
}

export function legacyToHtml(value: string): string {
  if (isEntryHtml(value)) return cleanEntryHtml(value);
  return value
    .split(/\n\n+/)
    .map(
      (paragraph) =>
        `<p>${paragraph.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\n", "<br>")}</p>`,
    )
    .join("");
}

export function plainEntryText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
