# Local development

Read [implementation guidelines](implementation-guidelines.md), [architecture](architecture.puml), [ERD](erd.puml), and [API](api.md) before changing behavior or structure. The project uses real PostgreSQL and persisted uploads; application runtime responses are never mocked.

## Prerequisites

- Node.js and npm compatible with the Angular version in `src/frontend/package.json`.
- Python 3.10 or later, with `venv` support.
- The existing PostgreSQL service listening on `localhost:5432`.
- A PostgreSQL role able to create the dedicated development/test databases, or pre-created databases owned by the chosen role.

All commands below run from the repository root. Paths containing spaces must stay quoted.

## Install and prepare the backend

```bash
cd src/backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python init_database.py
.venv/bin/python init_database.py --test
.venv/bin/python migrate_auth.py
cd ../..
```

By default, the backend connects as the current OS user to `postgresql+psycopg://<user>@localhost:5432/kids_flashcards`. Tests use the separate `kids_flashcards_test` database. The initialization helper creates only the requested dedicated database when it is absent. Run `migrate_auth.py` explicitly to prepare the schema; startup does not migrate existing tables. On an existing installation, back up the database and upload directory before running that migration. It adds ownership and public/private visibility fields and the upload metadata table, preserving existing series/cards and marking existing series private and unowned until an authorized identity assignment is made.

For installations requiring a different PostgreSQL role or password, configure `DATABASE_URL` and `TEST_DATABASE_URL` in the shell used to initialize, test, and start the app, or in an ignored `src/backend/.env` file. The backend loads that file; shell variables take precedence. Keep secrets outside Git.

| Variable | Default / purpose |
| --- | --- |
| `DATABASE_URL` | Local `kids_flashcards` database using the current OS user. |
| `TEST_DATABASE_URL` | Local `kids_flashcards_test` database; tests must use this isolated database. |
| `UPLOAD_DIR` | `src/backend/data/uploads/`; local persistent picture storage. |
| `CORS_ORIGINS` | `http://localhost:4200,http://127.0.0.1:4200`. |
| `LIFE2_AUTH_URL` | `http://auth-service.localhost:46138`; Life2 Auth application login and exchange origin. |
| `LIFE2_APPLICATION_ID` | Required registered Life2 application ID, returned by Auth registration. |
| `LIFE2_CALLBACK_URL` | `http://127.0.0.1:4200/auth/callback`; must exactly match the registered redirect. |
| `LIFE2_JWT_SIGNING_KEY_FILE` | File containing the base64-encoded Life2 HS256 signing key; preferred over an inline secret. |
| `LIFE2_JWT_SIGNING_KEY_BASE64` | Alternative inline base64 signing key; takes precedence over the key file. |
| `COOKIE_SECURE` | `false` for local HTTP; set `true` when serving over HTTPS. |

## Life2 Auth setup

Register Kids Flashcards as an application in the existing Life2 Auth service, using the callback `http://127.0.0.1:4200/auth/callback`. Configure its application ID in the backend's ignored `.env` and point `LIFE2_JWT_SIGNING_KEY_FILE` at the existing local Life2 signing-key file. For this machine the file is `/Users/ralfe/.life2-local/docker-secrets/life2-jwt-key-base64`; keep its contents private and out of Git, logs, and browser storage. The app reads the file server-side to validate Life2 account tokens.

Use `http://127.0.0.1:4200` for login. `localhost:4200` is a different browser origin and is not the registered callback. Changes to the origin require coordinated Life2 registration and backend callback/origin configuration. Auth must be running and reachable at `LIFE2_AUTH_URL`. Anonymous public browsing works without a Life2 session; login configuration errors must be shown to the user instead of pretending to authenticate.

Login returns a handoff code. The frontend scrubs it from the URL and calls the local exchange proxy, which forwards only to the configured Auth service and preserves the Origin required for origin-bound handoff verification. After signature and claim validation, the backend sets an HttpOnly SameSite=Lax cookie. The interface language remains the only localStorage preference.

## Install the frontend

```bash
cd src/frontend
npm install
cd ../..
```

## Run the app

```bash
./scripts/start-dev.sh
```

Open `http://127.0.0.1:4200` for the Angular UI. The API runs at `http://127.0.0.1:8100`; its interactive documentation is at `/docs`. Startup waits for both services to respond and writes logs and process ownership records under the ignored `.runtime/` directory.

```bash
./scripts/stop-dev.sh
```

The stop helper stops only processes started by this project's helper and verifies their recorded start time and process group before signalling them. It does not stop an unrelated service that occupies either port.

After editing, restart the affected services to verify the served app. A full local restart is:

```bash
./scripts/stop-dev.sh
./scripts/start-dev.sh
```

For foreground debugging, run these commands in separate terminals:

```bash
cd src/backend
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8100 --reload
```

```bash
cd src/frontend
npm start -- --host 127.0.0.1 --port 4200
```

## Verify changes

Run the backend suite after significant backend edits. It uses the dedicated test database, so never point `TEST_DATABASE_URL` at development or other application data.

```bash
cd src/backend
.venv/bin/python -m pytest
cd ../frontend
npm test -- --watch=false
npm run build
cd ../..
```

Run available frontend unit and browser test commands from `src/frontend/package.json`. Browser acceptance must exercise the served frontend against real Life2 Auth, the API, and PostgreSQL: log in, create/edit/delete owned sets and cards, switch public/private visibility, reorder, upload a picture, reload to confirm persistence, then practice flipping and navigating a shuffled set. Check anonymous public browsing/practice, private-series and private-picture denial, unsigned write denial, and another owner's inability to edit a public series. Confirm success and error notifications are visible. Avoid using production or unrelated application databases for these checks.

On Node 26, run frontend tests with `NODE_OPTIONS=--no-experimental-webstorage npm test -- --watch=false` so jsdom supplies browser storage instead of Node's global storage. This does not affect the served application.

## Persistence and maintenance

Back up `kids_flashcards` together with `src/backend/data/uploads/` (or the configured `UPLOAD_DIR`). Database rows contain references to those local picture files and upload ownership metadata. Keep both when restarting or upgrading. Changes to existing tables require an explicit migration, such as `migrate_auth.py`, rather than assuming SQLAlchemy table creation alters them. Existing series ownership must be assigned from the verified Life2 user/account identifiers; email is used to resolve that identity administratively and is not an authorization key.

The `.puml` files in this directory are the diagram sources. Render them with a PlantUML viewer when reviewing structural changes and update both diagrams and API documentation when changing relationships or behavior.

## Repeatable browser acceptance

The CRUD, navigation, and language checks below now require a real Life2 session in the selected browser context. Log in using the header button before running them; anonymous contexts cannot create their temporary series. A rejected write is expected when the session expires. Do not bypass this requirement with a locally fabricated token or mocked login response.

Start the app, then run from the repository root:

```bash
npx --yes @playwright/cli --session kids-flashcards open http://127.0.0.1:4200 --headed
npx --yes @playwright/cli --session kids-flashcards run-code --filename scripts/browser-acceptance.js
npx --yes @playwright/cli --session kids-flashcards run-code --filename scripts/browser-navigation-acceptance.js
```

The script uses the running API and real PostgreSQL. It creates a uniquely named temporary set, checks set/card CRUD and reorder persistence after reload, uploads both picture faces, verifies a real rejected upload notification, and checks shuffled practice, captions, previous/next, keyboard navigation, and the mobile layout. Flip checks verify an actual 400 ms 3D transition in both directions for text and images, stable card height, hidden inactive faces in the accessibility tree, rapid toggles, instant switching under reduced motion, Space activation, and a front-face reset on navigation. It deletes only its own temporary set. Small unreferenced acceptance upload files remain in the upload directory; other sets and pictures are preserved. Screenshots go into ignored `output/playwright/`.

Run all backend/frontend unit checks and the production build with `./scripts/check.sh`. Frontend HTTP fixtures are confined to unit tests.

The navigation check creates and removes two temporary sets against the real API. It verifies default Practice, URL updates, direct Practice/Edit links, reloads, browser Back/Forward across modes and sets, library navigation, empty and missing sets, and invalid paths. The Angular development server serves the SPA for deep paths; other web servers must provide the same index-page fallback.

## Interface language verification

Check the practice button layout against an existing real set with at least two cards:

```bash
npx --yes @playwright/cli --session mobile-controls open http://127.0.0.1:4200 --headed
npx --yes @playwright/cli --session mobile-controls run-code --filename scripts/mobile-controls-acceptance.js
```

This read-only acceptance check covers French/English at 320, 390, 400, and 760px:
Previous and Next share a horizontal row, and Shuffle is centered below. It also
checks the desktop arrangement, horizontal overflow, and navigation/reshuffling.
It preserves stored cards and restores the original browser language preference.

French is used when no browser preference is saved. The header UK flag selects English, and the French flag returns to French. Each switch stores `en` or `fr` under `kids-flashcards-language` in localStorage; page loads restore that choice. The switch leaves practice state and stored set/card content unchanged.

Run the dedicated real-service check after starting the app:

```bash
npx --yes @playwright/cli --session kids-language open http://127.0.0.1:4200 --headed
npx --yes @playwright/cli --session kids-language run-code --filename scripts/language-acceptance.js
```

This checks the default language, saved preference on reload, both flags and their placement, translated forms/dialogs/notifications, unchanged API text/captions/images, practice state, keyboard activation, and 390/320px layouts. It cleans up only its temporary set and restores the browser's original language preference. Screenshots are in ignored `output/playwright/`.

## Authentication browser acceptance

Use a genuine Life2 login at `http://127.0.0.1:4200`. Confirm the code is removed from the callback URL, login succeeds, **CM1 Allemand** has owner controls for `ralfepoisson@gmail.com`, and authenticated state survives reload. CM1 Allemand is public at the user's request, so guests may practise it. The session cookie must be HttpOnly; browser localStorage must contain no token. Create a disposable series named `Auth browser acceptance <unique suffix>` with a text card and an uploaded picture card, mark it public, and confirm that its owner can still edit it. Use a separate disposable private series to verify private access denial.

Then run the guest check in a separate disposable browser session. It clears that session's cookies:

```bash
npx --yes @playwright/cli --session kids-auth-guest open http://127.0.0.1:4200 --headed
npx --yes @playwright/cli --session kids-auth-guest run-code --filename scripts/auth-guest-acceptance.js
```

The check uses the real public fixture, verifies anonymous library/practice/pictures, private-series denial, denial of all unsigned mutations, Edit deep-link fallback to Practice, uncached image responses, and 390/320px layouts. Screenshots are saved under ignored `output/playwright/auth-guest-*.png`. Return to the signed-in owner session, make the disposable series private, and verify that the guest can no longer fetch the series or its pictures. Test a second real account's read-only access to the public fixture before deleting only the disposable series. Preserve the user's original series and uploads.
