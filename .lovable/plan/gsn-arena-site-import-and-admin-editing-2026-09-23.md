# GSN Arena site import and admin editing

## Build
- Port the complete GSN Arena application from the uploaded ZIP into the current TanStack Start project, preserving its visual design, content, archive sectors, tier list, dossier views, search, terms, and community artwork experience.
- Replace the ZIP's current comparison screen with the richer GSN-Arena-v6 flow: separate combatant selection screen, five-profile rows by category, confirmation step, two-sided arena, random winner result, reroll, Tier List link, and suggestion link.
- Remove the third home-page doctrine item, “Local means yours,” and update nearby copy that incorrectly describes the shared site as local-only.
- Keep the site mobile-friendly, including the existing sidebar drawer and responsive comparison layout.

## Admin access
- Use Google sign-in; do not create a profiles table.
- Store admin access in a separate `user_roles` table with an `admin` role, never in browser storage or profile data.
- Show editing, deletion, moderation, and Terms controls only after the signed-in account passes a server-backed admin check.
- Enforce every archive and moderation write with row-level database policies, so hiding buttons is not the security boundary.
- Keep public reads available without login and preserve signed-in community artwork submission.

## Data and setup
- Adapt the provided database schema into a safe migration with explicit grants, role-checking function, archive tables, artwork table, storage policies, and initial archive records.
- Use the supplied public project URL and publishable key only through the generated connection once the project is connected.
- After the project is connected in Project Settings → Connectors → Supabase, enable Google authentication, apply the migration, and verify the real signed-in admin experience.
- Grant the first admin role after your Google sign-in creates its account record; this requires the account UUID or access to the connected project.

## Verification
- Check the home page, comparison selection/result flow, archive browsing, and mobile layout.
- Verify that a signed-out visitor sees no edit controls, a signed-in non-admin cannot write, and the designated admin can edit and save shared content.
