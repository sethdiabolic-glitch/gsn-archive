import { useState, useId } from "react";
import { tagSuggestions, tagKey, uniqueTags } from "./lib/gallery";

export function TagSearch({
  tags,
  selected,
  onChange,
  count,
}: {
  tags: string[];
  selected: string[];
  onChange: (tags: string[]) => void;
  count?: (tag: string) => number;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const matches = tagSuggestions(tags, query, selected).slice(0, 12);
  const choose = (tag: string) => {
    onChange(uniqueTags([...selected, tag]));
    setQuery("");
    setActive(0);
  };
  return (
    <div className="tag-search">
      <div className="tag-picker" aria-label="Selected tags">
        {selected.map((tag) => (
          <button
            type="button"
            className="tag-chip on"
            key={tagKey(tag)}
            aria-label={`Remove tag ${tag}`}
            onClick={() => onChange(selected.filter((value) => tagKey(value) !== tagKey(tag)))}
          >
            #{tag} <span aria-hidden="true">×</span>
          </button>
        ))}
      </div>
      <label htmlFor={id}>Search tags</label>
      <input
        id={id}
        className="text-input"
        placeholder="Type a word or #tag…"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-activedescendant={open && matches[active] ? `${id}-${active}` : undefined}
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) setOpen(false);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive((value) =>
              Math.max(
                0,
                Math.min(matches.length - 1, value + (event.key === "ArrowDown" ? 1 : -1)),
              ),
            );
          }
          if (event.key === "Enter") {
            event.preventDefault();
            if (open && matches[active]) choose(matches[active]);
          }
        }}
      />
      {open && (
        <div
          id={`${id}-options`}
          role="listbox"
          aria-label="Matching tags"
          className="tag-suggestions"
        >
          {matches.length ? (
            matches.map((tag, index) => (
              <button
                type="button"
                role="option"
                aria-selected={active === index}
                id={`${id}-${index}`}
                key={tagKey(tag)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(tag)}
              >
                #{tag}
                {count && (
                  <span>
                    {count(tag)} artwork{count(tag) === 1 ? "" : "s"}
                  </span>
                )}
              </button>
            ))
          ) : (
            <p className="note-guide">No matching tags. Try a shorter word.</p>
          )}
        </div>
      )}
    </div>
  );
}
