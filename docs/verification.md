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
- All 22 backend tests passed against the isolated PostgreSQL test database, including auth, upload visibility, CSRF, subpath hosting, and existing API behavior.
- The local Life2 account mapping for `ralfepoisson@gmail.com` was verified. Only the requested existing series (`0d538496-4662-4f4c-bc23-7d3f36410aa0`) was assigned to its verified subject/account and renamed from **CM1 German** to **CM1 Allemand**. At the user's subsequent request it was made public; ownership and all 20 cards were preserved. Anyone may practise it, and only its owner may change it.
- Repeatable real guest acceptance is available in `scripts/auth-guest-acceptance.js`; it requires the signed-in disposable public fixture described in [local development](local-development.md). The migration and data readback do not by themselves verify a successful interactive Life2 login.

## Authentication running-service acceptance — 4 October 2026

- All 31 frontend tests passed across 5 files, including 10 auth/access tests and the 3 subpath deployment tests. The production build passed (621.43 kB initial output, 119.94 kB estimated transfer). Both PlantUML sources passed `plantuml -checkonly`.
- A genuine local Life2 Cognito session continued through the registered Kids Flashcards application. The handoff exchange and session establishment returned 200; the callback code disappeared and the owner returned to the requested CM1 Allemand Practice URL with editing controls. No token or code was printed or stored in browser storage.
- Signed-in UI checks created separate public and private disposable series and uploaded real pictures. The session, private series, images, and Edit deep link survived reload. The public checkbox reflected persisted state. Making a public fixture private immediately changed anonymous series and image requests to 404 while its owner still reloaded Edit successfully.
- The real guest browser check passed public library/practice/flip/image access, missing mutation controls, HTTP 401 on guest writes, private series/image HTTP 404, Edit-link fallback to Practice, uncached metadata/images, and 390px/320px layouts. Screenshots are under ignored `output/playwright/auth-guest-*.png`; the final CM1 view is `output/playwright/auth-cm1-public.png`.
- Logout cleared private selection, series, drafts and owner controls; reload after a complete local service restart retained guest state. The existing public CM1 Allemand remained visible with 20 cards. The owner view is open at `http://127.0.0.1:4200/set/0d538496-4662-4f4c-bc23-7d3f36410aa0/practice`.


## EC2 single-image release — 4 October 2026

- Public deployment: [Kids Flashcards](https://www.ralfepoisson.com/flashcards). One ARM64 application image serves Angular and FastAPI; the dedicated PostgreSQL database and persistent upload bind mount remain outside the image. Both bare and slash-prefixed entry URLs work. The existing website homepage still returns HTTP 200.
- Application source revision: `6961e2d87e67c7983e7bf453c7bf48da8655380d`. Running image ID: `sha256:8a865faf2d1c9aaaa776950d8e712e158111b66fb8001d885fa37ae5f1dea8f1`. The container is healthy, uses UID/GID10001, has a read-only filesystem, and publishes only host loopback 48100. Candidate 48101 is checked before activation; older images are retained. The release path and image restoration were exercised before final activation.
- Served HTML and the image's compiled index have matching SHA256 `afefcb608934d1015d6b27e77c7fbb77c2e274a423c7525444211717271b4b36`. Application source after this revision was unchanged; subsequent commits only record evidence and improve browser verification timing.
- Full backend suite: 22 passing tests with dedicated real PostgreSQL. Frontend suite: 31 passing tests across 5 files under Node 24 with threaded Vitest workers and `NODE_OPTIONS=--no-experimental-webstorage`. Final Angular production output: 621.94 kB. Shell syntax, Compose validation, and both PlantUML diagrams passed. Local development services were restarted; the compiled local preview also passed real subpath acceptance.
- Real production Life2 login completed using the registered application and active issuer key. The callback code was scrubbed; a Secure HttpOnly cookie established the session. A private disposable series and genuine image survived reload and an exact container restart. Guest series/image requests returned 404, guest writes returned 401, owner practice worked, and logout removed the session. Callback query codes are excluded from Apache access logging; Uvicorn access logging is disabled.
- `scripts/deployment-browser-acceptance.js` passed against production with the public CM1 series: API health/listing, uncached public images, deep links/reloads, real image rendering, flip/next/previous, guest Edit fallback, denied writes, actual API/upload 404s, callback-error feedback and URL scrubbing, unknown-route recovery, and no horizontal overflow at 320/390/1200 px. No JavaScript errors occurred. Unknown-route verification waits for Angular's actual URL normalization.

## Public CM1 Allemand production migration — 4 October 2026

- The user's explicit migration request retained public visibility. Source and destination UUID: `0d538496-4662-4f4c-bc23-7d3f36410aa0`; 20 cards and 20 referenced pictures. No unrelated development sets or orphan uploads were copied.
- A repeatable-read source export preserved IDs, order, content, instructions/explanations, creation time, and public visibility. The ACTIVE production account was verified independently; its account ID differs from development, so the import used the production mapping instead of copying the source account ID.
- Database/upload backups precede the import. Restore rehearsal, transaction/collision checks, and repeat idempotence passed in the scratch database and production. The source package SHA256 is `cf6dbe8e9b9a2d5932a0449f36520e9a4b863dce28b2d66e66f2f036338addde`. Recovery artifacts and the scoped importer remain under the protected host backup directory documented in [deployment](deployment.md).
- Independent anonymous HTTPS readback matched all 20 card fields and all 20 image byte lengths/SHA256 checksums to the source manifest. SQL readback separately verified the production owner, public visibility, dense positions 0–19, and all 20 picture owners. The same public equality checks passed after restarting the exact production container. Anonymous `can_edit` is false.
- Only our backed-up temporary private acceptance fixture, its card, and its unreferenced picture were deleted. The rehearsal database and temporary credential file were removed. The original development CM1 series remains intact. Production screenshot: ignored `output/playwright/cm1-production-public.png`.

## Git consolidation

All intended work is committed on local `main`; no Git push was requested. The only worktree is the original checkout, and there were no additional local branches to merge or remove. Ignored runtime data, credentials, backups, screenshots, and upload files remain outside Git.

Created commits:

- `ba6730d`: preserve the authenticated bilingual flashcards application and acceptance checks.
- `6280c7b`: preserve completed Life2 browser acceptance documentation and guest runner.
- `2136831`: add the single-image EC2 subpath deployment.
- `50c8ce9`: pin the Linux database runtime and verify restored releases.
- `b59cea1`: add ingress publishing and host reachability checks.
- `5e65ae4`: select an explicit unused ingress subnet on the shared host.
- `6961e2d`: exclude login callback codes from production access logs.
- Final closeout commit: record production/migration evidence and wait for browser URL recovery.

Final closeout uses Git status, unmerged-branch checks, worktree inventory, and the integration log. Deployment tests above are independent of the clean-up-git skill's Git-only consolidation checks.
