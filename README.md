# Kids Flashcards

A local web app for children to practise school lessons with custom text and picture flashcards.

Public series can be viewed and practised without an account. Use **Log in** at the top right to sign in through Life2 Auth and create series. New series are private by default; their owner can mark them public. Private series are visible only to their owner, and only the owner can change a series or its cards.

## Project structure

- `src/frontend/`: Angular SPA with Bootstrap, Font Awesome, and toastr notifications.
- `src/backend/`: Python FastAPI REST API, SQLAlchemy persistence, and backend tests.
- `docs/`: setup, API, implementation guidelines, and PlantUML architecture/ERD diagrams.
- `scripts/`: local startup and verification helpers.

## Getting started

See [local development](docs/local-development.md) for installation and service commands. The backend uses the existing PostgreSQL service on `localhost`. It requires its own `kids_flashcards` database and never modifies other databases.

Prepare the explicit authentication schema migration and configure the Life2 application and signing-key file as described in [local development](docs/local-development.md), then start:

```bash
./scripts/start-dev.sh
```

Open [the local app](http://127.0.0.1:4200). The backend uses port 8100. Stop services with `./scripts/stop-dev.sh` and run backend/frontend checks with `./scripts/check.sh`.

## Features

Opening a flashcard set from the library or sidebar defaults to Practice Mode, including after using Edit Mode. Owners manage their series, public/private visibility, and ordered cards in Edit Mode. Each face supports text or an uploaded picture, with optional instructions on the front and explanations on the back. Practice Mode shuffles the selected set, animates a 3D card flip on click or Space, and preserves the shuffled order when moving forward or backward. Flips take 400 ms in either direction; reduced-motion preferences switch faces instantly. Navigation and reshuffling start on the front.

Authentication uses the registered Life2 application and a short-lived handoff code. The backend validates the Life2 token and keeps the session in an HttpOnly cookie; browser localStorage is used only for the interface language. See [REST API](docs/api.md) for server-side access rules.

The interface supports English and French. Click the French flag (🇫🇷) beside **Kids Flashcards** to switch to French, or the UK flag (🇬🇧) to return to English. French is the default when no preference is stored. The browser remembers your choice; flashcard contents, captions, set names, and descriptions stay exactly as entered.

## Development

Set and mode URLs support direct links and reloads: `/set/<UUID>/practice` and `/set/<UUID>/edit`. `/set/<UUID>` defaults to Practice, and `/` opens the library. Browser Back/Forward restores the selected view.

Read [implementation guidelines](docs/implementation-guidelines.md) before editing. Use tests first where feasible; verify changes against real PostgreSQL and run browser checks for UI features. Restart affected services after changes.

Consult the [architecture](docs/architecture.puml), [database ERD](docs/erd.puml), and [REST API](docs/api.md) when changing functionality or structure.

See [local verification](docs/verification.md) for the completed checks and [local development](docs/local-development.md) for repeatable browser acceptance.

## License

See [LICENSE](LICENSE).
