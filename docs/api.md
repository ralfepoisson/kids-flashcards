# REST API

The development API listens at `http://127.0.0.1:8100`. JSON routes use the `/api` prefix. The frontend uses the same-origin Angular proxy for API calls and protected picture requests. Validation failures, including embedded NUL characters, return HTTP 422; database connection failures return HTTP 503 with an actionable message; missing or inaccessible sets/cards return HTTP 404. The frontend displays operation results through toastr.

## Authentication and access

Anonymous visitors can list, view, and practise public series. Signed-in visitors can also see their own private series. Only the owner can modify a series or its cards, including public series. All create/update/delete/reorder/upload requests require authentication; unsigned writes return HTTP 401. A signed-in non-owner's mutation of a public series returns HTTP 403; inaccessible private series return HTTP 404. Owner matching uses both the verified Life2 subject and account ID. Clients cannot assign or change ownership.

| Method | Path | Request / result |
| --- | --- | --- |
| GET | `/api/auth/config` | Public login configuration for the registered Life2 application and callback. |
| GET | `/api/auth/me` | Current authentication state and verified account identity. |
| POST | `/api/auth/exchange` | Exchange `{ "code": "<Life2 handoff code>" }` through the fixed Life2 Auth origin. |
| POST | `/api/auth/session` | Validate `{ "token": "<Life2 account JWT>" }` and establish an HttpOnly session cookie. |
| DELETE | `/api/auth/session` | Clear the local session cookie. |

The header login button opens Life2's application sign-in page with `applicationId` and the exact registered `redirect` URL. Life2 returns `handoff_code` to `/auth/callback`. The frontend removes that code from the URL immediately, exchanges it through same-origin `POST /api/auth/exchange` using `{ "code": "..." }`, and submits the returned token to the local session endpoint. The backend forwards the exchange only to its configured Life2 Auth origin's `/api/login/exchange`, with the allowed browser Origin so Auth can validate its origin-bound code. This avoids a global Auth CORS change. The token is not stored in browser storage.

The backend pins HS256 and validates the Life2 signature, `iss=life2.ralfe.me`, `aud=account`, `exp`, `iat`, `sub`, `accountId`, and its configured `applicationId`. Delegated tokens are rejected. Invalid/expired tokens return HTTP 401; missing Life2 verification configuration returns HTTP 503. Cookie-authenticated writes and session changes require an allowed Origin. The cookie is HttpOnly, SameSite=Lax, and Secure when `COOKIE_SECURE=true`. API clients may use a verified Life2 bearer token instead of a cookie. An expired browser session falls back to public-only browsing. Authentication, set, upload, and picture responses are private and `no-store` so a cached image cannot retain access after a visibility change or logout.

## Sets

| Method | Path | Request / result |
| --- | --- | --- |
| GET | `/api/sets` | List public sets and the signed-in user's own private sets. |
| POST | `/api/sets` | Create an owned set with `{ "name": "Multiplication", "description": "Times tables", "is_public": false }`. |
| GET | `/api/sets/{set_id}` | Visible set details including its cards ordered by `position`. |
| PUT | `/api/sets/{set_id}` | Owner only: replace `name`, `description`, and `is_public`. |
| DELETE | `/api/sets/{set_id}` | Owner only: delete the set and all its cards. |

Set IDs are UUIDs. A name is required and accepts at most 120 characters; the optional description accepts at most 2,000 characters. `is_public` defaults to false. Set records include `id`, `name`, `description`, `is_public`, `can_edit`, `created_at`, and `card_count`; details also include `cards`. `can_edit` is computed for the current caller and controls the owner UI. Owner identifiers remain server-side. All card mutation routes below require the parent set's owner.

## Cards

| Method | Path | Request / result |
| --- | --- | --- |
| POST | `/api/sets/{set_id}/cards` | Append a card to the end of the selected set. |
| PUT | `/api/sets/{set_id}/cards/{card_id}` | Update the content on both faces and their optional captions. |
| DELETE | `/api/sets/{set_id}/cards/{card_id}` | Delete the card. |
| PUT | `/api/sets/{set_id}/cards/reorder` | Set the complete order using `{ "card_ids": ["first-uuid", "second-uuid"] }`. |

Create/update card bodies have this shape:

```json
{
  "front_type": "text",
  "front_content": "7 × 8",
  "front_instruction": "Say the answer aloud.",
  "back_type": "text",
  "back_content": "56",
  "back_explanation": "Seven groups of eight make fifty-six."
}
```

Each face uses either `text` or `image` as its type. Content is required for each face and accepts at most 10,000 characters. Instructions and explanations each accept at most 2,000 characters and default to empty strings. String input is trimmed and blank required values are rejected. For an image face, use the URL returned by the upload endpoint as the corresponding content; external image URLs are rejected. Card records also include `id`, `set_id`, and their zero-based `position`.

Reorder requests must contain every card in the set exactly once, with no foreign, unknown, or duplicate IDs. The API validates and applies the order in a database transaction. Practice shuffling is frontend session state and does not change this saved order.

## Pictures

Authenticated `POST /api/uploads` accepts multipart form data with a `file` field and returns HTTP 201 with `{ "url": "/uploads/<generated-filename>" }`. Uploads support PNG, JPEG, WebP, and GIF images up to 10 MiB (10,485,760 bytes). Invalid image content returns HTTP 422; oversized files return HTTP 413. Files are given generated names and stored in `src/backend/data/uploads/` by default; upload metadata records their verified owner.

`GET /uploads/<generated-filename>` serves a picture only when a visible set references it or the authenticated caller owns the upload. Thus public series pictures can be practised anonymously, private series pictures follow their series visibility, and an owner can preview a new upload before saving a card. Unknown or inaccessible pictures return HTTP 404. There is no unrestricted static upload route. Image references on writes must be allowed for the caller.

Uploaded files are local persistent data and are ignored by Git. Back up this directory together with the database. Deleting a card or set does not imply deleting its picture file.

## Health and interactive documentation

`GET /api/health` checks the running backend and database connection, returning `{ "status": "ok", "database": "ok" }` when healthy. FastAPI publishes interactive API documentation at `http://127.0.0.1:8100/docs` and the OpenAPI schema at `/openapi.json`.

## Frontend modes

Frontend page paths are `/` for the library, `/set/<set_id>/practice`, `/set/<set_id>/edit`, and `/auth/callback` for Life2 login. Set IDs are the UUIDs returned by the API. Opening a set from the library or sidebar defaults to Practice; an authorized explicit deep link restores its mode on reload. `/set/<set_id>` resolves to Practice. Browser Back/Forward restores the selected set and mode. New sets open in Edit so cards can be added. Edit links for visible series that the caller cannot change resolve to Practice. Unknown page paths return to the library; unavailable sets retain their URL and show a failure notification. These are browser paths, separate from `/api` endpoints. Web servers hosting the SPA must serve its index page for these paths.

Edit Mode supports set/card creation, editing, deletion, and explicit saved reordering. Practice Mode loads the selected set and shuffles the cards for a session. Clicking the card toggles its visible face; the instruction appears under the front and the explanation under the back. Previous and Next preserve the session's shuffled order and start each card on its front face. Empty sets display an actionable empty state.

## Interface language

English/French selection is local UI state, persisted under `kids-flashcards-language` in browser localStorage. Page loads restore `en` or `fr`; absent, invalid, or inaccessible storage defaults to French. It does not change API requests, set names/descriptions, card faces, image URLs, instructions, explanations, or stored order. No database migration is required. Known API error messages are translated by the frontend; unfamiliar French errors use a localized failure message, with validation failures prompting users to check their inputs.

## Production subpath

Production serves the UI at `/flashcards/`, JSON routes at `/flashcards/api/*`, and protected pictures at `/flashcards/uploads/*`. Card records retain canonical `/uploads/<filename>` references; the frontend prefixes the deployment base only when rendering or fetching. The cookie uses `/flashcards`, Secure, HttpOnly, and SameSite=Lax. Life2's registered callback is `https://www.ralfepoisson.com/flashcards/auth/callback`. Deep page URLs reload through the compiled index; missing API routes, uploads, and assets return 404.
