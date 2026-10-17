import { htmlToDOM, type DOMNode } from "html-react-parser";
import { legacyToHtml } from "./entry-content";
import {
  referenceIndex,
  referenceParts,
  type ReferenceEntry,
  type ReferenceAlias,
} from "./entry-references";

export type LinkedEntry = ReferenceEntry & { hypothetical?: string; notes?: { text: string }[] };
export function referenceNames(value: string): string[] {
  const names: string[] = [];
  const walk = (node: DOMNode) => {
    if ("name" in node && ["a", "code", "pre", "button"].includes(node.name)) return;
    if (node.type === "text" && "data" in node) {
      referenceParts(node.data, (name) => ({ name, category: "", summary: "" })).forEach((part) => {
        if (part.entry) names.push(part.entry.name);
      });
    }
    if ("children" in node) node.children.forEach((child) => walk(child as DOMNode));
  };
  htmlToDOM(legacyToHtml(value)).forEach(walk);
  return [...new Set(names)];
}
export function referenceWarnings(
  values: string[],
  entries: ReferenceEntry[],
  aliases: ReferenceAlias[],
  current?: { name: string; category: string; id?: string },
) {
  const resolve = referenceIndex(entries, aliases);
  return [...new Set(values.flatMap(referenceNames))].flatMap((name) => {
    const target = resolve(name);
    if (!target) {
      const matches = entries.filter(
        (entry) => entry.name.trim().toLowerCase() === name.trim().toLowerCase(),
      );
      if (
        !matches.length &&
        current &&
        name.trim().toLowerCase() === current.name.trim().toLowerCase()
      )
        return [{ name, message: "This reference points back to this entry." }];
      return [
        {
          name,
          message:
            matches.length > 1
              ? "Ambiguous name — more than one entry matches."
              : "No matching entry or Appendix definition.",
        },
      ];
    }
    if (
      current &&
      ((current.id && current.id === target.id) ||
        (current.category === target.category &&
          current.name.trim().toLowerCase() === target.name.trim().toLowerCase()))
    )
      return [{ name, message: "This reference points back to this entry." }];
    return [];
  });
}
export function referencedBy(
  target: ReferenceEntry,
  entries: LinkedEntry[],
  aliases: ReferenceAlias[],
) {
  const resolve = referenceIndex(entries, aliases);
  return entries.filter((entry) => {
    if (entry === target || (entry.category === target.category && entry.name === target.name))
      return false;
    return [
      entry.summary,
      entry.hypothetical || "",
      ...(entry.notes || []).map((note) => note.text),
    ]
      .flatMap(referenceNames)
      .some((name) => {
        const match = resolve(name);
        return match?.category === target.category && match.name === target.name;
      });
  });
}
