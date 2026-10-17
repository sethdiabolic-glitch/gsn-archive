import { useState } from "react";
import { supabase } from "./lib/community";
import { RichDocument } from "./RichDocument";

type Revision = {
  id: string;
  name: string;
  data: Record<string, unknown>;
  saved_at: string;
  saved_by: string | null;
};
export function RevisionHistory({
  entryId,
  onRestore,
}: {
  entryId?: string | undefined;
  onRestore: (data: Record<string, unknown>) => void;
}) {
  const [items, setItems] = useState<Revision[]>([]);
  const [selected, setSelected] = useState<Revision | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [limit, setLimit] = useState(20);
  const load = async (nextLimit = limit) => {
    if (!supabase || !entryId) return;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await supabase
        .from("archive_entry_revisions")
        .select("id,name,data,saved_at,saved_by")
        .eq("entry_id", entryId)
        .order("saved_at", { ascending: false })
        .limit(nextLimit);
      if (error) throw new Error(error.message);
      setItems((data || []) as Revision[]);
      setLoaded(true);
      setLimit(nextLimit);
    } catch (error) {
      setError(
        `History unavailable. Apply the entry-revisions migration and check admin access. ${error instanceof Error ? error.message : ""}`,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="revision-history">
      <p className="note-guide">
        Restoring loads an older version into your draft. Nothing changes publicly until you save.
        History starts when its migration is applied; deleting an entry also deletes its history.
      </p>
      {!entryId ? (
        <p className="note-guide">Save this new entry before viewing its history.</p>
      ) : (
        <button type="button" className="btn" disabled={busy} onClick={() => load()}>
          {busy ? "Loading history…" : loaded ? "Refresh history" : "Load history"}
        </button>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loaded && !items.length && <p>No revisions recorded yet.</p>}
      <div className="revision-list">
        {items.map((revision) => (
          <button
            type="button"
            className="search-result"
            key={revision.id}
            onClick={() => setSelected(revision)}
          >
            <strong>{revision.name}</strong>
            <span>
              {new Date(revision.saved_at).toLocaleString()} ·{" "}
              {revision.saved_by ? `Admin ${revision.saved_by.slice(0, 8)}` : "Baseline snapshot"}
            </span>
          </button>
        ))}
      </div>
      {items.length >= limit && (
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={() => load(limit + 20)}
        >
          Load older revisions
        </button>
      )}
      {selected && (
        <div className="revision-preview">
          <h3>{selected.name} — saved version</h3>
          <RichDocument
            value={typeof selected.data["summary"] === "string" ? selected.data["summary"] : ""}
          />
          <details>
            <summary>All saved fields</summary>
            <pre>{JSON.stringify(selected.data, null, 2)}</pre>
          </details>
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (
                window.confirm(
                  "Load this revision into your draft? Current unsaved fields will be replaced.",
                )
              )
                onRestore(selected.data);
            }}
          >
            Restore into draft
          </button>
        </div>
      )}
    </section>
  );
}
