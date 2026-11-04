type Line = { url: string; text: string };
const positions = new Map<string, { signature: string; next: number }>();
/** Session-local order, independently keyed per dossier/event. Edits restart that sequence. */
export function nextVoice<T extends Line>(lines: T[], key: string): T | undefined {
  if (!lines.length) {
    positions.delete(key);
    return undefined;
  }
  const signature = JSON.stringify(lines);
  const prior = positions.get(key);
  const index = prior?.signature === signature ? prior.next % lines.length : 0;
  positions.set(key, { signature, next: (index + 1) % lines.length });
  if (positions.size > 500) positions.delete(positions.keys().next().value!);
  return lines[index];
}
