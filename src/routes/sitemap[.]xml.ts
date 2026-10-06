import { createFileRoute } from '@tanstack/react-router';
import { BASE_URL, SECTIONS } from '../lib/crawler.server';

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const urls = ['', ...SECTIONS.map(([s]) => s), 'llms.txt'].map(p => `<url><loc>${BASE_URL}/${p}</loc></url>`).join('');
        return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, { headers: { 'content-type': 'application/xml', 'cache-control': 'public, max-age=3600' } });
      },
    },
  },
});
