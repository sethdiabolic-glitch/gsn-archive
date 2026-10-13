# GSN Archive — Read-only audit report

No files were changed. Checks run: reading the database rules (both migration files), the data loading/saving code, the text cleaner, page head tags, and the latest build/runtime logs (no build errors or runtime errors recorded). No live sign-in test, no live database query and no security scanner run were done.

## Confirmed findings

1. **Medium — Storage accepts any file, any size (Community Art / archive uploads)**
   - Evidence: the `community-art` bucket is public with no file-type or size limit; the upload rule only checks the folder is the user's own. Only audio has a 10 MB check, and only in the browser. Image pickers use `accept="image/*"`, which is a hint, not a block.
   - Impact: any signed-in account can store large or non-image files (e.g. HTML) at a public link, using up the free storage quota.
   - Fix: set bucket limits (images/audio only, e.g. 10 MB) and add matching browser checks.

2. **Medium — Emptying a category brings back the built-in entries**
   - Evidence: on load, saved data is merged over the built-in defaults per category. If a category has no saved rows, the built-in list shows again.
   - Repro: as admin, delete every entry in one category, refresh — the original entries reappear.
   - Fix: once the shared archive has any rows, treat it as the only source and never fall back to defaults per category.

3. **Low — Artwork submitters can set any image link**
   - Evidence: the submit rule checks owner and "pending" only; `image_url` is free text. A crafted request could point to an outside image. Admin review limits the impact.
   - Fix: require the link to be inside the site's own storage folder for that user.

4. **Low — Deleted artwork may leave its file behind**
   - Evidence: takedown deletes the row, then removes the file only if it is in the remover's own folder. When an admin removes someone else's art, the file stays (storage delete rule is owner-only).
   - Fix: allow admins to delete files in the bucket, or remove files from the server side.

5. **Low — Old browser cache can show stale content**
   - Evidence: the archive, terms and tags are cached in the browser and shown first; if the shared load fails, the cached copy stays on screen silently.
   - Fix: show a small "offline copy" notice when the shared load fails.

6. **Low — Leftover share tag**
   - Evidence: the site-wide head still says `twitter:site = @Lovable`.
   - Fix: remove it or use your own handle.

## Checked and OK
- Archive edits, deletes and Terms writes are blocked in the database for non-admins (admin check runs on the server side).
- Admin list is not readable by visitors; the admin check only answers "am I admin".
- Unapproved artwork is visible only to its uploader and admins.
- Rich summaries are cleaned before display (only safe tags, http/https links).
- Edit buttons appear only after the database confirms admin.

## Suspected risks (not confirmed)
- **Renaming an entry** may create a second copy, because entries are saved by name; the old name may not be deleted.
- **First-load seeding**: if the shared archive is empty when an admin signs in, the built-in data is written automatically, which could restore deleted defaults.
- **Large single page file** (about 85 KB of code) makes the first load heavier on slow phones.
- **Pages share one generic title**, so search engines and link previews show the same text for every dossier.
- **Email sign-up**: whether email confirmation and leaked-password protection are on could not be checked.

## Could not verify
- Real signed-in flows: Terms saving after refresh, tag saving, voice line upload/playback, admin moderation, artwork takedown.
- Live database settings: whether both migrations are actually applied, bucket limits, auth settings.
- Real phone devices (only code was read this time; earlier screen tests passed on phone-sized screens).

## Recommended fix order
1. Storage limits (finding 1)
2. Category fallback and rename copies (finding 2, rename risk)
3. Artwork link and admin file removal (findings 3, 4)
4. Small polish (findings 5, 6, page titles)
