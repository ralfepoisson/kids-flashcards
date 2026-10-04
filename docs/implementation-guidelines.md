# Implementation guidelines

Read README.md first. Prefer test-driven development. Run the backend suite after significant backend changes and verify frontend features in a real browser. Integration checks must use real services, without mocked runtime responses.

Use the PostgreSQL service on localhost and a dedicated kids_flashcards database. Do not change other applications' databases. Keep database credentials in environment configuration; never commit them.

Maintain architecture.puml, erd.puml, API documentation, and local setup instructions as behavior changes. Restart or rebuild affected local services and verify served behavior after edits.

Validate inputs in the backend, preserve explicit card order, use transactions for reorder operations, and surface errors through toastr in the UI. Store uploaded pictures in an ignored local data directory.

Enforce visibility and ownership in the backend on every set, card, reorder, and picture route. A public series is readable by anyone; a private series is readable only by the matching Life2 subject and account. Only its owner may modify a series, regardless of public visibility. New series are private by default. Assign immutable ownership from verified Life2 claims, never from request JSON or an email entered by a caller.

Use the registered Life2 application login flow. Validate the JWT algorithm, signature, issuer, audience, expiration, issued-at time, subject, account, and application identity. Keep the browser session in an HttpOnly SameSite=Lax cookie, check the Origin on cookie-authenticated writes, and never store tokens in localStorage. Remove handoff codes from browser URLs immediately. Uploaded pictures must be served through visibility checks, never through an unrestricted static mount.

Schema updates are explicit additive migrations; application startup must not silently alter existing tables or assign ownership. Back up the dedicated database and picture directory before migration, preserve existing cards and uploads, and independently verify any authorized ownership assignment.
