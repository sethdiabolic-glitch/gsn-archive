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
