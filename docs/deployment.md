# Single-image EC2 deployment

Read [implementation guidelines](implementation-guidelines.md), [architecture](architecture.puml), and [ERD](erd.puml). The image combines the production Angular build and FastAPI under one non-root Uvicorn process. An existing PostgreSQL server and host upload directory retain data across image replacement. PostgreSQL is deliberately outside the application image.

## Runtime configuration

The current EC2 host is `personal-projects` (ARM64). Apache handles `www.ralfepoisson.com` behind the existing HTTPS ingress. The app binds only `127.0.0.1:48100`, with a candidate validation port at 48101. Production lives under `/srv/apps/kids-flashcards`. Secrets and uploads never enter Git or the Docker build context.

Run host configuration/deployment commands as the privileged account able to read the protected environment file (on this host, use `sudo -n`). Copy `deploy/.env.example` to `/srv/apps/kids-flashcards/.env`, replace placeholders, and restrict it to mode 0600. Set the dedicated database URL, existing PostgreSQL network, Life2 application ID, and signing-key file. Pre-create `/srv/apps/kids-flashcards/uploads` owned by UID/GID 10001. The key file must be readable by UID10001, preferably mode 0400; keep the parent secret directory restricted. Compose mounts it read-only. The app also joins an explicitly created external bridge ingress network: the shared PostgreSQL network is internal and cannot publish host ports on its own.

Register `https://www.ralfepoisson.com/flashcards/auth/callback` in production Life2 Auth and use `https://auth.life-sqrd.com` as its base URL. The verification key must match the **running issuer**; the historical standalone Auth signing-key file on this host was stale at initial setup. Derive the protected Flashcards file from the active Auth configuration entirely on the host, without exposing its value. Rotate this file whenever the issuer key rotates, then restart Flashcards.

Production uses Secure HttpOnly SameSite=Lax cookies scoped to `/flashcards`. Browser requests use the same-origin backend handoff exchange; no global Auth CORS change is needed. Angular's build base is `/flashcards/`, covering API calls, images, navigation, and callbacks. Stored picture references remain `/uploads/*`.

## Build

Commit intended changes first. This command archives only the selected Git commit and builds it on the target host, so local credentials, uploads, and ignored files cannot be accidentally included:

```bash
./scripts/build-image.sh personal-projects HEAD
```

The resulting image tag is `kids-flashcards:<full-commit-sha>` and the OCI revision label records that exact source commit. The final runtime uses image IDs during deployment, preserving older images for rollback. The Dockerfile also works with `docker build --build-arg VCS_REF=<sha> -t kids-flashcards:<sha> .` on an ordinary Docker host; build on ARM64 or explicitly choose the target platform.

## Ingress network preparation

The existing EC2 Docker default address pools are exhausted. Preserve existing networks and create the dedicated ingress bridge with a verified unused subnet instead of pruning anything. On this host `10.250.44.0/28` was checked against Docker network IPAM and host routes before creation:

```bash
sudo docker network create --driver bridge --subnet 10.250.44.0/28 kids-flashcards-ingress
```

Set `INGRESS_NETWORK=kids-flashcards-ingress`. Candidate and active containers share this small external network; candidate cleanup does not remove it. On another host select an unused subnet first.

## Initial database preparation

Create only the dedicated `kids_flashcards` PostgreSQL role/database; preserve unrelated databases. Use a generated password in the protected host environment file. Grant this role access only to its own database. Production startup sets `INITIALIZE_SCHEMA=false` and does not migrate tables.

Copy the committed `deploy/compose.yaml` and `scripts/deploy-image.sh` into the matching directories under `/srv/apps/kids-flashcards`. Set `KIDS_FLASHCARDS_IMAGE` in the protected environment file to the built revision image. Initialize the new empty schema explicitly:

```bash
cd /srv/apps/kids-flashcards
docker compose --env-file .env -f deploy/compose.yaml run --rm -T --interactive=false --no-deps \
  --entrypoint python kids-flashcards migrate_auth.py
```

For an existing database, back up rows and uploads before any schema migration and obtain approval for data reconciliation or ownership changes. A deployment does not implicitly copy development data or assign owners. Local and production Life2 identities may differ; verify production subject/account identifiers before an authorized import.

## Activate

```bash
cd /srv/apps/kids-flashcards
./scripts/deploy-image.sh .env
```

The script acquires a deployment lock, validates Compose without printing secrets, resolves the image ID, and starts a candidate at 48101. It checks host loopback health as well as Docker health, real PostgreSQL-backed series listing, and the compiled UI base path. Only a passing candidate replaces the active image at 48100. Failed activation restores the previous image; uploads and database remain intact. Initial deployment failure stops the unsuccessful app without deleting persistent data.

For first routing setup, include the contents of `deploy/apache-flashcards.conf` **inside only** the existing `www.ralfepoisson.com` VirtualHost in `/etc/apache2/sites-available/personal-websites.conf`. Add `env=!flashcards_auth_callback` to that vhost's existing `CustomLog` line so one-use callback codes are excluded from access logs. The image disables Uvicorn access logging for the same reason. Keep a copy of the prior vhost config. Run `sudo apachectl configtest` before `sudo systemctl reload apache2`. Existing site routes and DNS remain intact. Both `/flashcards` and `/flashcards/` open the application; the proxy preserves the prefix. API, upload, and missing asset requests must return their real errors rather than SPA HTML.

Verify the public HTTPS library, API health/listing, real Life2 login/callback/cookie, direct set links and reloads, images, and mobile practice. Compare the public index to the running container's built index and inspect the running OCI revision/image ID. Also check the website homepage still responds successfully.

## Backup and rollback

Back up the dedicated database and uploads together before migrations or imports. Store backups outside publicly served directories with mode 0600. Restore rehearsals belong in a separate disposable database. Replacing the image does not restore data; preserve the schema compatibility and upload directory for older releases.

To roll back an image, set `KIDS_FLASHCARDS_IMAGE` in `.env` to the previously recorded immutable image ID/tag and rerun `scripts/deploy-image.sh .env`. The candidate checks run before activation. To remove the initial Apache route, restore the saved vhost configuration, run `apachectl configtest`, and reload Apache. Do not delete databases, uploads, keys, or previous images as part of rollback.

Image delivery currently uses SSH builds on EC2; no registry or Git push is required. A registry can be added later without changing the image/runtime contract.

Repeat the real guest subpath browser check with `npx --yes @playwright/cli --session <session> run-code --filename scripts/deployment-browser-acceptance.js` after opening either the local production preview or public deployment URL. It reads existing public series, preserves data, and covers practice/images when such a series exists.

## Authorized CM1 Allemand import — 4 October 2026

The explicitly authorized series is public in production at [CM1 Allemand Practice](https://www.ralfepoisson.com/flashcards/set/0d538496-4662-4f4c-bc23-7d3f36410aa0/practice). Its 20 cards and 20 referenced pictures retain their IDs, order, text, captions, and image bytes. The development series remains intact.

The import mapped the source owner to the independently verified ACTIVE production Life2 identity. The subject matches across environments, while the account IDs differ; production uses its own verified account ID. Visibility remains public and modifications require the owner session. No other development data was copied.

The protected host directory `/srv/apps/kids-flashcards/backups/cm1-migration` retains `before.dump`, `uploads-before.tar`, the incoming payload/manifest, and the one-off importer. The database backup was restored into a separate rehearsal database before importing. Both rehearsal and production imports were run twice: the first imported the exact series; the second verified the existing import without duplicate rows. Collision checks reject differing IDs, rows, image bytes, names, or ownership rather than overwrite them. Rows use a transaction and advisory lock; image writes use atomic links after checksum checks.

Independent public HTTPS readback compared every card field and all 20 image SHA256 checksums to the source export, both before and after restarting the production container. SQL readback separately checked public visibility, verified ownership, dense positions 0–19, and picture ownership. Real guest browser practice, image rendering, flip/navigation, reloads, and mobile layouts passed. Only the disposable acceptance fixture was removed after backing it up. The rehearsal database and its temporary environment file were removed; recovery artifacts remain protected outside public routes.

The retained importer is deliberately scoped to this exact authorized set and verified production identity. Future imports need their own reviewed source manifest, identity mapping, backups, and authorization; do not use it as a general synchronization command.
