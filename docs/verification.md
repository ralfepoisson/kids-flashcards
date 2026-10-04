# Local verification

The initial, practice, animation, and language sections below record historical acceptance on 4 October 2026 before authentication was added. They establish the earlier card, practice, navigation, and language behavior; they do not establish the new Life2 login or visibility rules. Repeat write-oriented browser checks with a real signed-in Life2 account after the authentication migration.

Initial acceptance completed on 4 October 2026 against the running local app.

- Backend: 10 tests passed using the dedicated localhost PostgreSQL test database, including CRUD/cascade persistence, atomic reorder validation, concurrent card creation, real picture uploads, input limits, NUL validation, and an actual refused database connection.
- Frontend: 5 unit tests passed, covering the empty state, form validity, retry identity after a committed save with a failed refresh, shuffled membership, and navigation boundaries. HTTP fixtures are confined to these unit tests.
- Angular production build passed; initial output approximately 591 kB, estimated transfer 113 kB.
- npm audit reported zero known vulnerabilities. A patched Piscina build dependency is selected through the npm override in package.json.
- Real browser acceptance passed: set/card create/edit/delete, cancel delete, reorder and reload persistence, images on both faces, visible validation/success notifications, shuffled practice without duplicate cards, flip/captions, stable previous/next, keyboard navigation, and mobile layout.
- Both local services were restarted after implementation changes. API health and the proxied UI API were healthy at ports 8100 and 4200. The existing PostgreSQL service was used.
- Independent PostgreSQL readback confirmed no acceptance sets remained and all stored card positions were dense. Existing user-created sets were preserved.

Repeat the checks using the commands in [local development](local-development.md). Screenshots from browser acceptance are in ignored output/playwright; the repeatable check is scripts/browser-acceptance.js.

## Mobile practice controls — 4 October 2026

- Test-first browser acceptance reproduced the navigation-row failure at 320px before the CSS change.
- Mobile widths up to 760px now use two equal navigation columns with reshuffling centered on a separate row below. Desktop retains Previous / Shuffle / Next on one row.
- `scripts/mobile-controls-acceptance.js` passed against both the production build preview and the running development app with the real API: French/English at 320, 390, 400, and 760px, desktop at 1200px, no horizontal overflow, and functioning Previous/Next/Shuffle controls. The check reads existing cards without modifying persisted data and restores the original language preference.
- Production build passed (621.13 kB initial output). The development services were restarted and the final browser check used port 4200. Concurrent authentication changes temporarily interrupted compilation and restart availability; a set-summary parameter type was corrected to permit both summary and detail records.
- Architecture documentation records the responsive control layout. The database ERD was consulted; no schema or relationship changes were needed for this layout update. Screenshots: `output/playwright/mobile-controls-fr.png` and `mobile-controls-en.png`.
- The frontend unit runner compiled successfully but executed no tests: Vitest timed out starting its worker, including a Node 24 retry with one worker. The passing browser checks and production build are verified separately; no unit-suite pass is claimed for this change.

## Practice default and deep links (4 October 2026)

- Opening a set from the library or sidebar defaults to Practice. Explicit `/set/<UUID>/practice` and `/set/<UUID>/edit` links restore the set and mode on reload; `/set/<UUID>` resolves to Practice. New sets open in Edit for adding cards.
- The complete frontend suite passed: 18 tests under the installed Node 24 runtime, including set-opening defaults, both deep-link modes, URL updates, and recovery after a failed deep-link request. Angular production build passed (611.62 kB initial output).
- Full real-browser acceptance passed against the local API and PostgreSQL, including creation/editing/deletion, uploads, reorder persistence, flip animations, keyboard controls, and mobile layout. Reload checks now verify the explicit Edit URL before returning to the library to check the Practice default.
- The frontend was restarted. The dedicated navigation browser check then passed: mode paths, direct links, reloads, Back/Forward across sets/modes/library, empty sets, missing sets, and invalid paths. Proxied API health confirmed database OK. Temporary navigation sets were removed; existing data was preserved.
- Repeatable navigation check: `scripts/browser-navigation-acceptance.js`. Architecture and ERD sources document browser history and URL state. No backend or database schema change was required.

## Animated practice cards — 4 October 2026

- Test-first frontend regression checks failed before implementation, then all 7 frontend unit tests passed. The new checks cover mounted text/image faces, accessible face state, bidirectional toggling, and fresh front panels on navigation/reshuffle while retaining the button.
- Angular production build passed: 592.45 kB initial output, 112.97 kB estimated transfer.
- Real browser acceptance passed against the restarted local app and real PostgreSQL: 400 ms CSS transitions sampled at intermediate 3D angles and verified at both endpoints for text and picture cards, stable height, accessibility tree exposing only the active face, rapid toggles, instant reduced-motion flips in both directions, Space activation, navigation resets, captions, and mobile layout. Existing CRUD, uploads, reorder/persistence, error feedback, and deletion checks also passed.
- The browser harness waits for rendering frames before sampling state changed by an input event. Initial immediate samples ran before Angular rendered the update; the corrected checks verified the actual transition.
- Both local services were restarted; direct API and frontend-proxied API health returned database OK. Only temporary acceptance sets were deleted. No backend or database schema change was required.
- Final checks after concurrent language/navigation updates: all 18 frontend unit tests passed with a single Vitest worker and `NODE_OPTIONS=--no-experimental-webstorage` (Node 26's global storage otherwise overrides jsdom storage). Full real browser acceptance passed again, including the animation checks and no Angular collection recreation warnings. API readback confirmed the existing 20-card German set was preserved.
- The final combined production build passed: 611.62 kB initial output, 117.84 kB estimated transfer. Desktop and mobile screenshots confirmed the existing German card's back text is readable after the turn.
- Concurrent local development runs temporarily interrupted availability. The running UI returned HTTP 200 and its proxied API reported database OK after recovery; startup timing is unchanged.

## English / French interface (4 October 2026)

- The header flag immediately left of Kids Flashcards switches the interface between English and French. French is the default when localStorage contains no valid preference. Each switch saves `en` or `fr` under `kids-flashcards-language`; page loads restore the saved choice.
- The full frontend suite passed (18 tests), including seven focused language tests under the installed Node 24 runtime, covering default/restored language, unavailable storage, translated errors, header behavior, unchanged practice/drafts/content, and translated dialogs.
- Real browser language acceptance passed against the running API and PostgreSQL: French CRUD, rejected and successful picture uploads, localized notifications, complete set/card API equality across language switches, stable practice index/flip/shuffled order, keyboard flag activation, reload preference, and English/French 390px/320px layouts without horizontal overflow. Only the check's temporary set was removed; existing user data was preserved.
- Production build passed (approximately 612 kB initial output); all 10 backend tests passed. Node 26 test-worker startup timed out on this machine; Node 24 successfully ran the focused suite.
- Repeatable check: `scripts/language-acceptance.js`; screenshots: ignored `output/playwright/language-*.png`.
- After the frontend restarted, a fresh browser check passed for the French default and both saved language choices across reloads. The proxied API and PostgreSQL health were healthy, and independent API readback showed only the existing 20-card user set after acceptance cleanup.

## Authentication migration — 4 October 2026

- The dedicated development database was backed up to ignored `.runtime/pre-auth-backup.dump`. All 52 existing upload files were preserved and checksummed in `.runtime/pre-auth-uploads-manifest.json`.
- The explicit additive migration `src/backend/migrate_auth.py` added public/private visibility and immutable owner fields plus upload-owner metadata, preserving existing series and cards.
- All 19 backend tests passed after the final authentication backend changes, using the isolated PostgreSQL test database. This validates backend behavior; interactive Life2 login is a separate running-service check.
- The local Life2 account mapping for `ralfepoisson@gmail.com` was verified. Only the requested existing series (`0d538496-4662-4f4c-bc23-7d3f36410aa0`) was assigned to its verified subject/account and renamed from **CM1 German** to **CM1 Allemand**. At the user's subsequent request it was made public; ownership and all 20 cards were preserved. Anyone may practise it, and only its owner may change it.
- Repeatable real guest acceptance is available in `scripts/auth-guest-acceptance.js`; it requires the signed-in disposable public fixture described in [local development](local-development.md). The migration and data readback do not by themselves verify a successful interactive Life2 login.
