import type { ReactNode } from "react";

/** Native disclosure: keyboard/touch accessible, optional and closed on entry load. */
export function HypotheticalSummary({ children }: { children: ReactNode }) {
  return (
    <details className="hypothetical-summary">
      <summary>
        <span>Hypothetical Summary</span>
        <span className="disclosure-hint" aria-hidden="true">
          <span className="when-closed">Tap to expand</span>
          <span className="when-open">Tap to collapse</span>
        </span>
      </summary>
      <div className="hypothesis">{children}</div>
    </details>
  );
}
