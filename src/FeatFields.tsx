import { featDefinitions, setFeatIncluded, type EntryFeats } from "./lib/entry-feats";

export function FeatFields({
  value,
  onChange,
}: {
  value: EntryFeats;
  onChange: (patch: Partial<EntryFeats>) => void;
}) {
  return (
    <fieldset className="feat-settings field full">
      <legend>
        Feat measurements <span>Optional</span>
      </legend>
      <p className="note-guide">
        Choose which measurements appear in this dossier. Switch one off to hide it without losing
        its label or value. Leave all three off for a summary-only entry.
      </p>
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
