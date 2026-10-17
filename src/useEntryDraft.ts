import { useState, useEffect, useCallback } from "react";
import { readDraft, writeDraft } from "./lib/drafts";

export function useEntryDraft<T>(key: string, base: T, form: T, dirty: boolean) {
  const signature = JSON.stringify(base);
  const [candidate, setCandidate] = useState(() => {
    try {
      return readDraft<T>(localStorage, key);
    } catch {
      return null;
    }
  });
  const [status, setStatus] = useState("");
  const save = useCallback(
    (value: T) => {
      try {
        const draft = writeDraft(localStorage, key, value, signature);
        setStatus(
          `Local draft saved ${new Date(draft.updatedAt).toLocaleTimeString()}. Not published.`,
        );
      } catch {
        setStatus("Local draft recovery unavailable: browser storage is full or disabled.");
      }
    },
    [key, signature],
  );
  useEffect(() => {
    if (!dirty || candidate) return;
    save(form);
  }, [form, dirty, candidate, save]);
  const clear = () => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* Storage is optional. */
    }
    setCandidate(null);
    setStatus("");
  };
  return {
    candidate,
    accept: () => {
      setCandidate(null);
      setStatus("Draft recovered. Review it before publishing.");
    },
    clear,
    save,
    status,
    conflict: candidate && candidate.base !== signature,
  };
}
