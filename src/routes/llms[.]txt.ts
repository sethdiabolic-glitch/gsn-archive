import { createFileRoute } from '@tanstack/react-router';
import { BASE_URL, SECTIONS, fetchEntries, summaryOf } from '../lib/crawler.server';

export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: async () => {
        const rows = await fetchEntries();
        let out = `# GSN Arena — Intelligence Archive\n\n> Community-maintained archive for GODDESS OF VICTORY: NIKKE — dossiers, feats, theories, tier lists, comparisons and fan art.\n\n## Sections\n`;
        for (const [slug, label] of SECTIONS) out += `- [${label}](${BASE_URL}/${slug})\n`;
        const byCat: Record<string, typeof rows> = {};
        for (const r of rows) (byCat[r.category] ??= []).push(r);
        for (const [cat, list] of Object.entries(byCat)) {
          out += `\n## ${cat}\n`;
          for (const r of list) {
            const s = summaryOf(r.data);
            out += `- **${r.name}**${s ? `: ${s}` : ''}\n`;
          }
        }
        return new Response(out, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
      },
    },
  },
});
