# SocietyOps

**Society Maintenance & Operations** — a facility-operations and statutory-compliance tracker for Indian residential apartment associations (RWAs), delivered as a single installable, offline-capable PWA.

---

## Quick Start (Docker)

```bash
cp .env.example .env          # edit passwords if needed
make up                       # build & start all three containers
make migrate                  # run Alembic migrations
make seed                     # populate sample data
```

The app is now available at:
- **Frontend (PWA)**: http://localhost:5173
- **Backend API / Swagger**: http://localhost:8000/docs

---

## Login Credentials (after `make seed`)

| Role | Email | Password |
|---|---|---|
| Super Admin | admin@sunriseapts.in | admin123 |
| Committee | committee@sunriseapts.in | committee123 |
| Operator | operator@sunriseapts.in | operator123 |
| Resident | resident@sunriseapts.in | resident123 |

Committee/super_admin users land on the **dashboard**. Operators land on the **STP log form**.

---

## Local Dev (without Docker)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql+asyncpg://societyops:societyops_dev@localhost:5432/societyops
export DATABASE_URL_SYNC=postgresql://societyops:societyops_dev@localhost:5432/societyops
alembic upgrade head
python seed.py
uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev        # http://localhost:5173
```

---

## Production Instances

Each society gets its own GCP VM (Postgres + FastAPI + nginx + Caddy with automatic HTTPS). Instances are described by files in `scripts/targets/`:

| Target | VM | Purpose |
|---|---|---|
| `demo` | `societyops-vm` | Sunrise Apartments sample data |
| `opera` | `opera-vm` | Opera Apartments (production) |

```bash
./scripts/provision.sh <target>   # one-time: IP, VM, Docker, secrets, backups, deploy, bootstrap society + admin
./scripts/deploy.sh <target>      # ship the current commit (images are shared across targets, pinned by git SHA)
```

- Secrets (`POSTGRES_PASSWORD`, `SECRET_KEY`) are generated on the VM in `/opt/societyops/.env` and never leave it.
- Backups: nightly `pg_dump` to `/opt/societyops/backups` (14 days) + daily GCP disk snapshots (14 days).
- `seed.py` refuses to run in production (`APP_ENV=production`) because it wipes all data.

### Managing users on an instance

There is no user-management UI yet; use the CLI over SSH:

```bash
gcloud compute ssh opera-vm --zone us-central1-a --command \
  "cd /opt/societyops && sudo docker compose -f docker-compose.prod.yml exec -T societyops-backend python manage_users.py add --email ops@example.com --name 'Ravi' --role operator"
```

Commands: `list`, `add --email --name --role {super_admin,committee,operator,resident}`, `reset-password --email`, `deactivate --email`.

---

## QR Scan Flow

1. Go to **Assets** → click **QR** link for any asset → download the PNG
2. Print and attach the QR code to the physical asset
3. Scanning the QR code opens `/scan/{qr_token}` which immediately redirects to the asset's quick-log form
4. The quick-log form is pre-filtered to that asset — the operator just fills in readings and submits

---

## Multi-Tenancy

Every domain table carries a `society_id` foreign key. All API routes scope every query with `WHERE society_id = <current_user.society_id>`. JWT tokens embed the `society_id` claim; the `get_current_user` dependency enforces it on every request. A user from Society A physically cannot read or write Society B's data — there is no "bypass" path.

To add a second society later: create a new row in `society`, create users with `society_id = <new_id>`, and everything just works.

---

## PWA Installation

### Android (Chrome)
1. Open http://localhost:5173 in Chrome
2. Tap the **⋮** menu → **Add to Home screen**
3. The app installs as a standalone app with the SocietyOps icon

### iOS (Safari)
1. Open the URL in Safari
2. Tap the **Share** button → **Add to Home Screen**

### Desktop (Chrome/Edge)
1. Open the URL
2. Click the install icon (⊕) in the address bar
3. Click **Install**

---

## Offline Sync Behaviour

The four operator write flows (STP Log, Water Log, DG Log, PPM Completion) are **offline-first**:

1. **Online submit**: form data POSTed directly; entry is marked "Synced" immediately.
2. **Offline submit**: entry is written to IndexedDB (via Dexie). A yellow "Pending Sync" badge appears.
3. **On reconnect**: the `online` event fires; the sync engine reads all `pending` outbox entries, POSTs them to `POST /api/v1/sync/batch`, and updates badges to "Synced" (green) or "Failed" (red).
4. **Idempotency**: each entry carries a `client_uuid` (UUID v4 generated at form-open time). The backend upserts on `(society_id, client_uuid)` — submitting the same entry twice never creates a duplicate row.
5. **Offline photos**: captured blobs are stored in Dexie and uploaded separately before the log entry sync.

The **"Sync Now"** button in the header toolbar triggers an immediate retry of all pending and failed entries.

---

## Running Tests

```bash
make test
# or locally:
cd backend && pytest -v
```

Tests cover:
- `test_compliance.py` — BOD removal efficiency calculation and TNPCB/CPCB breach flagging
- `test_ppm.py` — PPM next-due calculation across all 7 frequency types including leap-year edge cases
- `test_scoping.py` — `society_id` isolation (Society A cannot see Society B's data)
- `test_sync.py` — Idempotent offline sync (same `client_uuid` twice → 1 row, same `server_id`)

---

## Makefile Targets

| Target | Description |
|---|---|
| `make up` | Build and start all containers |
| `make down` | Stop containers |
| `make migrate` | Run Alembic migrations |
| `make seed` | Populate sample data |
| `make test` | Run pytest suite |
| `make logs` | Stream all container logs |
| `make shell-backend` | Shell into backend container |
| `make shell-db` | psql into the database |

---

## Architecture

```
societyops/
├── backend/          FastAPI + SQLAlchemy 2.x + Alembic + reportlab
├── frontend/         React 18 + Vite + TypeScript + Tailwind + TanStack Query + Dexie PWA
├── infra/            nginx.conf (reference)
├── docker-compose.yml
└── Makefile
```

**Services**: `societyops-db` (PostgreSQL 16) · `societyops-backend` (FastAPI on port 8000) · `societyops-frontend` (nginx serving built Vite PWA on port 5173)
