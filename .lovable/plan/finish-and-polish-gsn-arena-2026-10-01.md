# Finish and polish GSN Arena

## Build
- Add visible category-colored glow rings to profile images across archive cards, dossiers, tier placements, and the comparison arena.
- Refine the full-page dossier editor so its sections are easier to scan, summary buttons are clearer, and save/back actions remain easy to reach.
- Polish the word editor with grouped formatting controls, clearer selected states, a readable document canvas, improved image-wrap controls, and a mobile-friendly toolbar.
- Refresh the shared button styling with the existing angular red-and-gold GSN treatment, preserving every current action and layout.

## Technical details
- Keep category colors and visual effects in the shared style tokens and reuse the existing category assignment already attached to each profile.
- Keep all editor content, image upload, sanitization, and save behavior unchanged.
- Verify the public archive and comparison screens on desktop and mobile; verify signed-in-only screens as far as the available session permits.
