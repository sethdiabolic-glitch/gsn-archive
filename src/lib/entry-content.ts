import sanitizeHtml from 'sanitize-html';

export function cleanEntryHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'img'],
    allowedAttributes: { img: ['src', 'alt', 'data-float'], p: ['style'], h2: ['style'], h3: ['style'] },
    allowedStyles: { p: { 'text-align': [/^(left|center|right)$/] }, h2: { 'text-align': [/^(left|center|right)$/] }, h3: { 'text-align': [/^(left|center|right)$/] } },
    allowedSchemes: ['http', 'https'],
    transformTags: { img: (tag, attribs) => ({ tagName: tag, attribs: { src: attribs['src'] || '', alt: attribs['alt'] || '', 'data-float': ['left', 'right'].includes(attribs['data-float'] || '') ? (attribs['data-float'] as string) : 'none' } }) },
  });
}
export function legacyToHtml(value: string): string {
  if (/^\s*<(p|h[23]|ul|ol|blockquote|img)\b/i.test(value)) return cleanEntryHtml(value);
  return value.split(/\n\n+/).map(paragraph => `<p>${paragraph.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\n', '<br>')}</p>`).join('');
}
export function plainEntryText(value: string): string { return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
