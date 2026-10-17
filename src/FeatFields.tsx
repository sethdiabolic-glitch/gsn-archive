import { useState } from "react";
import { uploadArchiveImage } from "./lib/community";
import { featDefinitions, setFeatIncluded, type EntryFeats } from "./lib/entry-feats";

export function FeatFields({
  value,
  onChange,
  onBusyChange,
}: {
  value: EntryFeats;
  onChange: (patch: Partial<EntryFeats> | ((current: EntryFeats) => Partial<EntryFeats>)) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState("");
  return (
    <fieldset className="feat-settings field full">
      <legend>
        Feat measurements <span>Optional</span>
      </legend>
      <p className="note-guide">
        Choose which measurements appear in this dossier. Switch one off to hide it without losing
        its label or value. Leave all three off for a summary-only entry.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="feat-settings-grid">
        {featDefinitions.map(({ key, label }) => {
          const included = !value.hiddenFeats?.includes(key);
          return (
            <div key={key} className={`feat-setting ${included ? "" : "is-hidden"}`}>
              <label className="feat-toggle">
                <input
                  type="checkbox"
                  checked={included}
                  onChange={(event) =>
                    onChange({ hiddenFeats: setFeatIncluded(value, key, event.target.checked) })
                  }
                />
                <span>Include {label}</span>
              </label>
              <label htmlFor={`feat-${key}-label`}>Display label</label>
              <input
                id={`feat-${key}-label`}
                className="text-input"
                value={value.featLabels?.[key] ?? label}
                disabled={!included}
                onChange={(event) =>
                  onChange({ featLabels: { ...value.featLabels, [key]: event.target.value } })
                }
              />
              <label htmlFor={`feat-${key}-value`}>Measurement</label>
              <input
                id={`feat-${key}-value`}
                className="text-input"
                value={value[key] || ""}
                placeholder="Enter a feat or measurement"
                disabled={!included}
                onChange={(event) => onChange({ [key]: event.target.value })}
              />
              <details className="feat-source-editor">
                <summary>Source / evidence</summary>
                <label>
                  Source title
                  <input
                    className="text-input"
                    value={value.featSources?.[key]?.label || ""}
                    onChange={(event) =>
                      onChange({
                        featSources: {
                          ...value.featSources,
                          [key]: { ...value.featSources?.[key], label: event.target.value },
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Chapter or event
                  <input
                    className="text-input"
                    value={value.featSources?.[key]?.chapter || ""}
                    onChange={(event) =>
                      onChange({
                        featSources: {
                          ...value.featSources,
                          [key]: { ...value.featSources?.[key], chapter: event.target.value },
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Source URL
                  <input
                    type="url"
                    placeholder="https://…"
                    className="text-input"
                    value={value.featSources?.[key]?.url || ""}
                    onChange={(event) =>
                      onChange({
                        featSources: {
                          ...value.featSources,
                          [key]: { ...value.featSources?.[key], url: event.target.value },
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Evidence image URL
                  <input
                    type="url"
                    className="text-input"
                    value={value.featSources?.[key]?.image || ""}
                    onChange={(event) =>
                      onChange({
                        featSources: {
                          ...value.featSources,
                          [key]: { ...value.featSources?.[key], image: event.target.value },
                        },
                      })
                    }
                  />
                </label>
                <label>
                  Or upload evidence
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    disabled={uploading !== null}
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) return;
                      if (file.size > 12 * 1024 * 1024) {
                        setError("Keep evidence images under 12 MB.");
                        return;
                      }
                      setUploading(key);
                      onBusyChange?.(true);
                      setError("");
                      try {
                        const image = await uploadArchiveImage(file);
                        onChange((current) => ({
                          featSources: {
                            ...current.featSources,
                            [key]: { ...current.featSources?.[key], image },
                          },
                        }));
                      } catch (error) {
                        setError(
                          error instanceof Error ? error.message : "Evidence upload failed.",
                        );
                      } finally {
                        setUploading(null);
                        onBusyChange?.(false);
                      }
                    }}
                  />
                </label>
                {uploading === key && <p role="status">Uploading evidence…</p>}
              </details>
              <span className="feat-visibility">
                {included
                  ? "Shown when a measurement is entered"
                  : "Hidden from the published dossier"}
              </span>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
