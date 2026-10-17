import { ReferenceHtml } from "./ArchiveReferences";
import { legacyToHtml } from "./lib/entry-content";

/** The preview and published dossier use exactly the same document surface. */
export function RichDocument({ value }: { value: string }) {
  return (
    <div className="rich-document entry-document">
      <ReferenceHtml html={legacyToHtml(value)} />
    </div>
  );
}
