# DAPP — Digital Agricultural Procurement Platform

DAPP is a role-based platform for transparent crop procurement. Milestone 5 completes the operational loop from farmer request and physical procurement through transaction-linked payment, bank reconciliation, private notifications, grievance resolution, and filtered analytics.

The core domain boundary is deliberate:

```text
ProcurementRequest != ProcurementTransaction
```

A request records a farmer's intent to sell. Approval creates a capacity reservation and arrival token, but still does not count as procurement. A transaction is created only after physical arrival, a passed inspection, weighment, and a positive accepted quantity. A payment can reference only that committed transaction, and settlement proof can exist only after administrator reconciliation.

## Milestone 5 status

Implemented:

- React 19 and Tailwind CSS interface with responsive registration, sign-in, and live role-aware dashboards.
- Django 5.2 and Django REST Framework API backed by PostgreSQL.
- Email-based accounts with `FARMER`, `PROCUREMENT_OFFICER`, and `ADMIN` roles.
- Farmer-only public registration and JWT access/refresh tokens in HTTP-only cookies.
- CSRF token bootstrap and enforcement for every unsafe cookie-authenticated request.
- One-to-one farmer profiles with system-issued farmer codes, location, PIN code, and land area.
- Administrator-managed procurement centres with location, type, operating hours, capacity, and active status.
- Administrator-managed crop catalogue with English/Hindi names, categories, and archival controls.
- Farmer-owned crop records with season, harvest year/date, cultivated area, and estimated/available quantity.
- Officer-to-centre assignment API and assigned-centre-only visibility.
- Role-specific dashboard summaries calculated from persisted records.
- Queryset filtering, object permissions, uniqueness rules, quantity checks, and API tests for isolation boundaries.
- Clearly labelled development seed commands for users and reference data.
- Farmer-owned procurement requests with intended quantity, preferred date, centre, and lifecycle state.
- Officer/admin review actions for starting review, approving, rejecting, and rescheduling.
- Atomic centre/date capacity checks and farmer-crop reservation checks using database row locks.
- One active capacity reservation and one scheduled appointment per request, with history preserved when replaced.
- Daily queue numbers and unique digital arrival tokens generated only after approval.
- Farmer cancellation that releases reserved capacity and cancels the active token without deleting history.
- Role-scoped request and appointment APIs plus connected dashboard forms, queues, and token cards.
- Assigned-centre physical check-in with transport and vehicle details; early arrival is rejected.
- One immutable quality inspection per arrival, including grade and optional measured percentages.
- Gross/tare weighment with server-derived positive net weight and one immutable record per inspection.
- Full, partial, or rejected acceptance decisions constrained by net weight, reserved capacity, and current farmer-crop availability.
- Atomic positive procurement: transaction and receipt creation, reservation consumption, crop deduction, appointment completion, and status history commit together.
- Safe full rejection: reservation release with no crop deduction and no transaction or receipt.
- Role-scoped procurement ledger for farmer-owned, assigned-centre, and system-wide audit views.
- Downloadable PDF receipts with transaction verification codes and an explicit “not proof of payment” boundary.
- Dashboard totals derived exclusively from completed positive procurement transactions.
- One payment per committed procurement transaction, with the exact immutable payable amount copied server-side.
- Idempotency-key protection for initiation, processing, settlement, failure, and retry mutations.
- Append-only payment events covering every state transition and actor.
- Assigned-centre payment initiation/processing for officers and administrator-only bank reconciliation.
- Unique nonblank bank reference enforcement and settlement proof created only in the successful settlement transaction.
- Separate downloadable payment settlement PDF; the procurement receipt intentionally remains non-payment evidence.
- Private in-app notifications emitted by scheduling, quality, procurement, payment, and grievance workflows.
- Farmer-owned grievances optionally linked to requests, transactions, or payments, with cross-owner link rejection.
- Centre-scoped officer grievance queues and append-only review/resolution events.
- Administrator/officer procurement analytics with date, centre, and crop filters, daily trends, breakdowns, settlement rate, acceptance rate, and exception totals.

External government, treasury, SMS, and banking integrations remain future work. Milestone 5 models their internal control boundary without pretending that a live external transfer occurred.

## Role boundaries

| Capability | Farmer | Procurement officer | Administrator |
| --- | --- | --- | --- |
| Farmer profile | Own record only | No access | Django admin only |
| Farmer crop records | Own CRUD | No direct access | Read-only audit |
| Active crop catalogue | Read | Read | Full CRUD/archive |
| Procurement centres | Read active | Read assigned centre only | Full CRUD/activate |
| Officer assignments | No access | Own centre projection only | Full API management |
| Procurement requests | Create/list/cancel own | Review assigned-centre requests | Review/audit all |
| Capacity reservation | Indirect through approval | Assigned centre | System-wide |
| Arrival appointments/tokens | Own history | Assigned-centre schedule | System-wide schedule |
| Physical check-in/inspection/weighment/decision | Read own progress | Record once for assigned centre | Record once/system-wide audit |
| Procurement transactions | Read own history | Read assigned-centre ledger | Read system-wide ledger |
| PDF receipt | Download own | Download assigned centre | Download any |
| Payment initiation/processing | Read own | Assigned-centre transactions | Any transaction |
| Settlement/failure reconciliation | Read own outcome | Read assigned-centre outcome | Record with unique bank reference |
| Payment settlement proof | Download own settled proof | Download assigned-centre settled proof | Download any settled proof |
| Notifications | Own inbox only | Own inbox only | Own inbox only |
| Grievances | Lodge/list own | Review linked assigned-centre cases | Review all cases |
| Procurement analytics | No access | Assigned centre only | System-wide with filters |
| Dashboard totals | Own accepted transactions | Assigned-centre accepted transactions | System-wide accepted transactions |

## Project structure

```text
dapp/
├── app/
│   ├── page.tsx                         Sign-in and farmer registration
│   └── dashboard/
│       ├── dashboard-client.tsx         Role-aware shell and navigation
│       └── panels/                      Procurement, payments, inbox, grievances, and analytics
├── components/ui/                       Accessible interface primitives
├── lib/                                 API client, formatting, and TypeScript contracts
├── backend/
│   ├── apps/accounts/                   Users, farmer profiles, JWT auth, permissions, tests
│   ├── apps/core/                       Health endpoint
│   ├── apps/procurement/                Scheduling, physical procurement, settlement, support, analytics
│   ├── config/                          Django settings and URLs
│   ├── manage.py
│   └── requirements.txt
├── compose.yaml                         PostgreSQL, API, and frontend development stack
└── docs/                                Milestone design guides
```

## Option A — Run everything with Docker

From the project root:

```powershell
docker compose up --build
```

In another terminal, create the clearly labelled development accounts and reference data:

```powershell
docker compose exec api python manage.py seed_demo_users --password "Choose-A-Strong-Password"
docker compose exec api python manage.py seed_reference_data
```

The demo users are `farmer@dapp.local`, `officer@dapp.local`, and `admin@dapp.local`. They share only the password supplied to the command.

Open:

- Frontend: `http://localhost:3000`
- API health: `http://localhost:8000/api/v1/health/`
- Django admin: `http://localhost:8000/admin/`

Stop with `Ctrl+C`. `docker compose down` removes containers but preserves the PostgreSQL volume.

## Option B — Run manually on Windows

### 1. Start PostgreSQL

Create a database named `dapp` and user named `dapp_user`, or update `backend/.env` with your own connection values.

### 2. Start the Django API

```powershell
cd backend
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Optional development data:

```powershell
python manage.py seed_demo_users --password "Choose-A-Strong-Password"
python manage.py seed_reference_data
```

### 3. Start the frontend

Open another terminal in the project root:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev -- --host 0.0.0.0 --port 3000
```

Then open `http://localhost:3000`.

## API surface

All endpoints below are under `/api/v1`.

| Method | Endpoint | Purpose | Access |
| --- | --- | --- | --- |
| `GET` | `/health/` | API health check | Public |
| `GET` | `/auth/csrf/` | Establish the CSRF cookie/header token pair | Public |
| `POST` | `/auth/register/` | Create a farmer account | Public |
| `POST` | `/auth/login/` | Set access and refresh cookies | Public |
| `POST` | `/auth/refresh/` | Rotate/refresh the session | Refresh cookie |
| `POST` | `/auth/logout/` | Revoke refresh token and clear cookies | Public/safe |
| `GET`, `PATCH` | `/auth/me/` | Read/update safe account fields | Authenticated user |
| `GET`, `PATCH` | `/auth/farmer-profile/` | Read/update the signed-in farmer profile | Farmer only |
| `GET`, `POST` | `/farmer-crops/` | List own or create own crop records | Farmer; admin list-only |
| `GET`, `PUT`, `PATCH` | `/farmer-crops/{id}/` | Manage one owned crop record | Owner farmer; admin read-only |
| `GET` | `/centres/` | Role-filtered centre list | Authenticated user |
| `POST`, `PUT`, `PATCH` | `/centres/...` | Manage centre reference data | Administrator only |
| `GET` | `/crop-catalogue/` | Active crops, or all crops for admin | Authenticated user |
| `POST`, `PUT`, `PATCH` | `/crop-catalogue/...` | Manage catalogue data | Administrator only |
| `GET`, `POST`, `PUT`, `PATCH` | `/officer-assignments/` | Manage officer-centre assignments | Administrator only |
| `GET` | `/officer/me/centre/` | Read the officer's assigned centre | Procurement officer only |
| `GET` | `/centres/{id}/capacity/?date=YYYY-MM-DD` | Read available/reserved capacity | Role-filtered centre access |
| `GET`, `POST` | `/procurement-requests/` | List scoped requests or submit farmer intent | Authenticated; create farmer only |
| `GET` | `/procurement-requests/{id}/` | Read one scoped request with status history | Owner/assigned centre/admin |
| `POST` | `/procurement-requests/{id}/review/` | Start review, approve, reschedule, or reject | Assigned officer/admin |
| `POST` | `/procurement-requests/{id}/cancel/` | Cancel own request and release its slot | Owner farmer |
| `GET` | `/appointments/` | List scoped arrival tokens and history | Owner/assigned centre/admin |
| `POST` | `/appointments/{id}/check-in/` | Record a due physical arrival | Assigned officer/admin |
| `POST` | `/appointments/{id}/inspect/` | Record one quality result | Assigned officer/admin |
| `POST` | `/appointments/{id}/weigh/` | Record gross/tare and derived net weight | Assigned officer/admin |
| `POST` | `/appointments/{id}/decide/` | Accept/reject quantity and atomically finalize | Assigned officer/admin |
| `GET` | `/procurement-transactions/` | List immutable role-scoped procurement records | Owner/assigned centre/admin |
| `GET` | `/procurement-transactions/{id}/receipt/` | Download the PDF procurement receipt | Owner/assigned centre/admin |
| `GET`, `POST` | `/payments/` | List scoped payments or initiate from a transaction | Authenticated; initiate officer/admin |
| `POST` | `/payments/{id}/transition/` | Process/retry or reconcile settlement/failure | Officer/admin; reconcile admin only |
| `GET` | `/payments/{id}/receipt/` | Download verified settlement proof | Scoped; settled payments only |
| `GET` | `/notifications/` | List the signed-in user's private inbox | Owner only |
| `POST` | `/notifications/{id}/mark-read/` | Mark one private notification read | Owner only |
| `POST` | `/notifications/mark-all-read/` | Mark the private inbox read | Owner only |
| `GET`, `POST` | `/grievances/` | List scoped grievances or lodge a farmer case | Authenticated; create farmer only |
| `POST` | `/grievances/{id}/transition/` | Start review, resolve, or reject with history | Assigned officer/admin |
| `GET` | `/analytics/summary/` | Filtered procurement and settlement analytics | Assigned officer/admin |
| `GET` | `/dashboard/summary/` | Role-specific persisted totals | Authenticated user |

## Verification

Frontend build, lint, and component tests:

```powershell
npm run build
npm run lint
npm run typecheck
npm test
```

Backend checks and tests can use an isolated SQLite test database:

```powershell
cd backend
$env:DJANGO_USE_SQLITE="true"
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

PostgreSQL remains the application source of truth. SQLite is used only for isolated automated testing.

## Milestone documentation

See `docs/MILESTONE_5_EXPLAINED.md` for payment invariants, reconciliation states, idempotency, role scoping, grievance linkage, analytics formulas, API examples, and verification results. `docs/MILESTONE_4_EXPLAINED.md` remains the reference for the preserved physical-procurement transaction boundary.
