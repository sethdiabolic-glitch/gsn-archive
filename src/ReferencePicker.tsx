import { useState } from "react";
import { useArchiveReferences } from "./ArchiveReferences";

export function ReferencePicker({
  onInsert,
  onClose,
}: {
  onInsert: (text: string) => void;
  onClose: () => void;
}) {
  const context = useArchiveReferences();
  const [query, setQuery] = useState("");
  const matches = (context?.entries || [])
    .filter((entry) => entry.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 30);
  return (
    <section className="reference-picker" aria-label="Insert archive reference">
      <div className="editor-section-head">
        <label htmlFor="reference-search">Find an entry or Appendix definition</label>
        <button type="button" className="btn ghost" onClick={onClose}>
          Close picker
        </button>
      </div>
      <input
        id="reference-search"
        className="text-input"
        autoFocus
        value={query}
        placeholder="Search names…"
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="reference-options">
        {matches.length ? (
          matches.map((entry) => {
            const resolved = context?.resolve(entry.name);
            const available =
              resolved?.category === entry.category &&
              resolved.name === entry.name &&
              !entry.name.includes("*");
            return (
              <button
                type="button"
                className="search-result"
                key={`${entry.category}/${entry.name}`}
                disabled={!available}
                onClick={() => {
                  onInsert(`*${entry.name}*`);
                  onClose();
                }}
              >
                <strong>{entry.name}</strong>
                <span>
                  {entry.category === "appendix" ? "Definition box" : "Dossier link"} ·{" "}
                  {entry.category}
                  {!available ? " · name not uniquely linkable" : ""}
                </span>
              </button>
            );
          })
        ) : (
          <p className="note-guide">
            No matching entries. Create the entry first, or try a shorter name.
          </p>
        )}
      </div>
    </section>
  );
}
