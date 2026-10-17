# Safety update: rollout and testing

## Apply the database migration first

Back up the project/database before deployment. In your **existing Supabase project's SQL Editor**, run the contents of:

`supabase/migrations/20261016090000_archive_safety.sql`

Run this migration once (or apply it with your existing Supabase migration workflow). **Do not rerun the older migrations** on an existing project. Deploy the updated frontend after the migration succeeds.

The migration adds permanent entry IDs, historical-name aliases, a transaction-based save function, and an admin-only storage delete policy. It preserves existing entries. The function verifies the signed-in user's admin role; public visitors cannot save entries. It does not add admins or change your account.

If the migration has not been applied, the frontend will show a saved-content warning and saves will not work. This is intentional: it must not silently fall back to unsafe writes.

No live Supabase data or policies were changed from this workspace. The live host could not be reached here.

## Checks run locally

```sh
npm install
npm test
npx tsc --noEmit
npm run build
```

Tests use mocked network responses for client failure paths and an isolated, in-memory PostgreSQL engine (PGlite) for the actual migrations, transactional renames, aliases, collisions, role checks, and storage row-level security. They do **not** connect to your live database or delete real files.

The repository-wide lint command currently reports existing formatting/type-rule issues. Type checking, tests and production build are separate checks.

## Browser acceptance checklist

Use disposable test entries/artwork, not valuable existing content.

1. **Admin save:** Create an entry, reload, and confirm it exists once. Edit it and confirm success is only reported after the server accepts the save.
2. **Rename:** Bookmark its URL, rename it, then reload. Confirm only one database row remains, its ID is unchanged, and the old URL opens the renamed dossier. Rename back to its original name too.
3. **Collision:** Try renaming onto another test entry's name (including another entry's historical name). Expect an explanatory error, both original entries unchanged, and your draft still in the editor.
4. **Failed save:** Block the Supabase domain in browser DevTools, then try saving a changed entry. Expect an error and an intact editor draft—not “Published.” Unblock the domain and retry. Cancel/Back, browser refresh and navigation should warn when dossier changes are unsaved. Rich-text changes must be applied before the parent dossier is published.
5. **Offline cache:** Load once online. Block the Supabase domain and reload. Expect a prominent warning and the last successful sync time. Unblock, click **Retry connection**, and confirm the warning disappears. A genuinely empty remote archive must not resurrect built-in entries or auto-seed cached entries.
6. **Artwork takedown:** As admin, remove disposable artwork uploaded by another account. Confirm both the `artworks` row and the object in the `community-art` bucket are gone. Check the bucket in Supabase rather than relying on a cached public image URL. A normal user should only get takedown controls for their own art.
7. **Partial deletion:** In a nonproduction environment, deny storage deletion and retry a takedown. Expect failure and an intact database row. If file deletion succeeds but record deletion fails, expect a message telling you to retry; retry should finish even though the image is already missing. Storage and database deletion are not a single transaction, so a failed second step can briefly leave a record pointing to a removed image.
8. **Search and metadata:** Search by name, feat or image tag, switch sector filters, and test an empty result. Visit Compare, a category, and two dossiers: each should have its own browser title, canonical link and social metadata. There should be no `@Lovable` social handle.
9. **Accessibility/mobile:** Tab through buttons and inputs, enable reduced motion, and check the editor and Compare on a narrow screen. The existing tactical design is preserved.

## Limits

This update prevents new rename duplicates and improves new upload/takedown failure handling. It does not automatically remove historical orphan files or deduplicate old records: that needs a reviewed inventory before deleting anything. Social previews use the existing GSN logo, not newly designed artwork. Historical-name URLs resolve in the client after the archive loads; they are not server-side HTTP redirects.

## Portraits, summary studio, and optional feats

These display/editor changes are stored in each entry's existing JSON data. They need **no additional SQL migration** beyond the earlier safety migration above.

- Open an entry with a tall, wide, or square primary image. The dossier's frame now follows the image's proportions (rather than cropping it into a circle), with sensible desktop/mobile size limits. Small list/Compare avatars remain circular.
- In the dossier editor, use **Feat measurements** to include or hide Speed, Power / Strength, and Durability independently. You can rename their display labels. Hidden values are retained for later reuse. Turn all three off to remove the feat-card section entirely. Existing entries remain included by default.
- Open either summary editor. The ribbon groups Text, Paragraph, Insert, and History. Choose a paragraph style, apply formatting/alignment, insert an image or a table, or paste an HTML table from a word processor.
- Select a table cell to reveal **Table layout** tools: add/remove rows and columns, toggle the header row, merge/split cells, or delete the table. Columns can be resized by dragging their borders. Tab navigates cells.
- **Preview** uses the same renderer and typography as the published dossier. **Continue editing** returns to the document without losing changes. **Apply to draft** transfers it to the parent entry editor; **Save file** publishes the entry.
- Check headings, lists, underlining, aligned paragraphs, floated images, and tables after saving and reopening. Long content/table widths should scroll within the document rather than stretch the mobile page.

Automated coverage now includes HTML-table paste, real TipTap table operations and save/reopen roundtrips, safe table sanitization, and feat visibility/label behaviour. A local Chromium check with mocked Supabase responses also exercised the admin editor end to end: portrait proportions, table insertion, preview/published HTML equality, feat toggles/renaming, and narrow-screen dossier overflow. This did not use real accounts or modify live content.

## Inline entry links and Appendix definitions

No new database migration is needed.

- Type `*Anis*` or `**Anis**` in a summary, hypothesis, note, or Terms text. If a uniquely named non-Appendix entry matches, it becomes an ordinary highlighted link to that dossier. Ctrl/Cmd-click and opening in a new tab still work.
- Type `*Goddessium*` when Goddessium is an Appendix term. It opens a styled definition dialog instead of navigating away. The dialog renders the term's formatted summary, can be dismissed with Escape or by tapping outside, and has an **Open full Appendix entry** link.
- Appendix definitions take priority when the same name also exists in another category. Matching ignores letter case and outer whitespace. Historical names resolve when saved rename aliases are available. Ambiguous names shared by two non-Appendix entries and unmatched names stay literal rather than linking to a potentially wrong destination.
- The published rich summaries and reading preview use the same reference renderer, including headings, lists, and table-cell text. Existing external links, image URLs/alt text, and code blocks are not rewritten. Keep each marked name within one formatting run (for example, bold the whole `*Anis*`, not just the name between the stars).
- The editor reserves asterisk markers for references rather than automatically turning them into Markdown bold/italic. Use the ribbon's Bold and Italic controls for formatting.
- Test with an entry and Appendix term that both exist in your actual archive. Preview a marked summary, follow its link, check the unsaved-changes prompt if appropriate, open a definition, then close it using Escape and check focus returns to the term.

Regression coverage includes matching/aliases, unknown and ambiguous names, rich HTML rendering, link/attribute/code exclusions, dossier navigation, and the accessible definition dialog. The full suite now contains 35 passing tests.

## Complete editor and gallery update — October 17

### New database step (history only)

If the earlier safety migration is already installed, **do not run it again**. Run only:

`supabase/migrations/20261017100000_entry_revisions.sql`

Copy that file into the existing project's Supabase SQL Editor and run it. It is transactional and safe to rerun. It adds admin-readable revision history and a trigger that snapshots successful saves in the same transaction. It records a baseline of existing entries, does not touch their content, and excludes settings. Failed/colliding saves create no revision. Users cannot insert, change or delete history directly; an entry deletion cascades to its history. This is not a backup system for deleted entries. History from before installation cannot be reconstructed.

The frontend does not require this new table for normal browsing or saving. Without the migration, **Load history** shows an explanatory error; the rest of the editor keeps working. No live database changes have been applied from Arena.

### Editing and references

- **Insert → Reference** opens a searchable picker; each result says whether it inserts a dossier link or an Appendix definition. Ambiguous names that cannot safely resolve are disabled. The picker inserts paired asterisks, never raw HTML.
- The entry editor has a live **Reference check** for missing, ambiguous and self references across both summaries and notes. On Save, warnings require confirmation; publishing anyway is allowed. Existing external links, HTML attributes, and code examples are ignored.
- **Referenced by** sections have been removed from dossiers and Appendix definition boxes. Inline references, the picker, and reference checks still work.
- **Draft recovery** stores field edits and unapplied summary edits in this browser, scoped by admin account, category and stable entry ID. Reload, reopen the editor, and explicitly choose **Recover draft** or **Discard stored draft**. If the published entry has changed, a warning asks you to review the recovered fields. Saves and explicit discard clear the draft. Local storage failures are visible. Drafts are not cloud-synced, encrypted, or guaranteed if browser storage is cleared.
- **Revision history** is an admin editor section. Load history, select a revision, review its summary/all saved fields, then **Restore into draft**. Confirming this does not publish it; use Save file afterwards. Restores are themselves captured when saved. Older revisions can be loaded in batches.
- **Feat measurements → Source / evidence** accepts a title, chapter/event, source URL, and optional evidence image URL or upload. Public feat cards show collapsible evidence. Hiding a measurement also hides its evidence without deleting it. Only HTTP/HTTPS evidence links are displayed.
- Identity, summaries/feats, images, voice lines, notes and history are grouped in collapsible sections. Save/Cancel controls stay reachable with an unpublished-change indicator.

### Portraits and gallery

- This update supersedes the earlier rectangular portrait frame: **portraits remain circular**. The whole image fits within an inscribed square so even square-image corners are not clipped. This adds some background space, especially for very tall/wide pictures. Entry/list/tier/Compare portraits use the same fitting rule. Tap the large dossier portrait to open its dedicated image page; use the return link or browser Back to return.
- Gallery tag search accepts words with or without `#`; suggestions rank exact, prefix, then contains matches, alphabetically within each group. Remove chips individually or Clear filters. All/Any matching combines with artist and rating filters, before sorting by newest, oldest, artist or title.
- Counts beside suggested tags show the result count **if that tag is added** to the current filters. URLs carry selected tags, matching mode, artist, sort and rating; **Share this view** copies the URL (or displays it if clipboard access is denied). Shared mature views still require acknowledgement before loading their image cards.
- New tag selections/settings/submissions deduplicate case and leading-`#` variants. Existing stored artwork tags are normalized for filtering without destructive database cleanup.
- Gallery cards use matching media wells and uncropped images. Loading, empty, no-match and refresh-failure states are differentiated. Check keyboard tag selection (arrows/Enter/Escape), mobile controls, Back/Forward URL restoration and filter reset.

### Verification

The suite includes gallery normalization/filtering/sorting/URL roundtrips, local draft serialization, reference auditing/backlinks, safe evidence URLs, and migration snapshots/rollback/admin history visibility. Local Chromium acceptance checks with mocked Supabase exercised the actual app: multi-tag filters and URLs, circular portraits/full-image viewing, backlinks, field and unapplied-document draft recovery after refresh, picker/checker, feat evidence, revision restore-to-draft, and mobile page width, without runtime errors or live-data changes.

## Crawlability and initial HTML

Public archive routes now load an anonymous Supabase snapshot on the server and render the actual dossier/category content into the initial HTML. The **Hypothetical Summary** stays closed visually, but its text is present in that HTML; expanding it does not make another request. This is the same public content served to ordinary readers, not bot-specific cloaking.

- `/sitemap.xml` lists all public dossiers with encoded URLs and valid modification dates, plus actual section routes. Removed the old non-existent `/structures` section (`/infra` is the real route). Database reads paginate rather than silently stopping at Supabase's row cap.
- `/llms.txt` lists public entry links and summaries. It is a discovery aid, not a guarantee that an AI service will retrieve or use the site.
- Sidebar and category-entry links have real `href` values and work without JavaScript. Interactive editing, reference definition dialogs, artwork filtering, and the live community-art feed still require JavaScript; the server-rendered archive itself does not.
- Dossier metadata uses its actual summary/profile image when available. Editor routes and missing entries are `noindex`. On a temporary server-side archive failure, archive HTML returns **503 + Retry-After** with `noindex`; sitemap/text feeds also return 503 rather than publishing a misleading empty result. Readers can still retry client-side.
- Server reads use only the public API key, without visitor cookies/credentials. Public feeds exclude settings and unknown/private categories. The hydration snapshot allows only legal text and image-tag values from settings, never arbitrary setting fields. Drafts, accounts, moderation queues and revision history are not queried for crawling.
- Existing `robots.txt` allows crawlers and advertises the sitemap. No new SQL migration is needed for crawlability (the existing archive safety migration must already be installed).

Run `npm run test:ssr` for a raw-HTTP check of actual server rendering, including collapsed hypothetical text, entry links, sitemap/text feeds, private-field exclusion, and outage status codes. The check uses an in-process fixture, not live Supabase. `npm test` also covers public projection, XML escaping, pagination and metadata. The full unit/database suite now has 58 passing tests.

After merging and publishing the production site, verify **View Page Source**, `/robots.txt`, `/sitemap.xml` and `/llms.txt` on the real domain. Submit `https://gsn-archive.lovable.app/sitemap.xml` in Google Search Console and optionally Bing Webmaster Tools. Crawling/indexing, ranking and AI citations are controlled by those services and cannot be guaranteed. If changing domains, update `SITE_URL` in `src/lib/public-archive.ts` and the sitemap URL in `public/robots.txt`.


## Dedicated image pages

- Tapping gallery artwork, large dossier portraits, dossier image collections, summary images, or feat evidence opens `/image` with an uncropped image. Images already inside explicit links/buttons keep those destinations; navigation avatars still navigate to dossiers.
- **Download**, **Share**, **Copy link**, and **Open original** sit below the image. Share uses the native share sheet where supported, otherwise clipboard; clipboard denial exposes a selectable link. Shared links exclude the return-navigation context. The return link preserves the originating gallery filters on normal taps.
- Downloads use browser-side fetch (no server proxy), with time/size/type checks and safe filenames. Hosts that disallow cross-origin downloads show a message directing readers to open the original and save manually. Browser/OS download behavior can vary.
- Mature artwork requires acknowledgement on its viewer page, including direct links. The image is not rendered before acknowledgement. This notice is not access control. Viewer routes are `noindex` and work independently of archive database availability; only absolute HTTP(S) image URLs are supported.
- Unit tests cover URL/query validation, filenames, thumbnail links, actions and mature/invalid states. `npm run test:ssr` checks the viewer during a database outage and verifies mature images are absent from initial HTML. Local Chromium checks with mocked data passed actual gallery navigation, filter-aware return links, refresh, native-share/clipboard stubs and denial fallback, a real download event/filename, mature acknowledgement, portrait/summary/image-collection destinations, and mobile width, with no runtime errors. No live records were changed.
- No new SQL is needed for image viewing. Publish the application changes before testing them on the production domain.


## Pinned formatting ribbon

The summary editor ribbon sticks below the site headers while scrolling within the document. It remains in normal flow before pinning (no layout jump), and releases at the editor boundary. Mobile controls use a horizontally scrollable row instead of a tall stack; table/image contextual controls stay in the pinned ribbon. Short viewports cap ribbon height with internal scrolling. Check keyboard focus, long documents, Preview/Continue editing, and mobile/desktop scrolling. Quote toggles blockquote formatting on the current/selected paragraphs; it does not add a citation.

Verified this update with 58 passing tests, TypeScript, production build, and isolated Chromium checks using the real summary editor at 1440×1000, 390×844, and 844×390: pinned ribbon position after repeated scrolling, no horizontal page overflow, compact toolbar on narrow/short screens, keyboard focus into offscreen controls, Quote on/off, and Preview/Continue editing. No live archive edits were made.
