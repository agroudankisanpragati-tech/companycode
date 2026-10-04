# Milestone 1 explained

This guide explains why the first DAPP milestone is structured this way.

## 1. Why authentication comes first

Every later DAPP record has an owner or an operational scope. A crop belongs to a farmer. A procurement request belongs to that farmer and targets a centre. An officer can work only with their assigned centre. If identity and authorization are added late, data leaks become easy to introduce. Therefore, DAPP begins with the user model and permissions.

## 2. Authentication versus authorization

- **Authentication** answers: “Who is making this request?”
- **Authorization** answers: “Is this person allowed to perform this action on this record?”

JWT cookies authenticate the request. The `role` field and object-ownership permissions authorize it. A valid token alone must never grant access to every record.

## 3. Why DAPP uses a custom user model immediately

Django's default user assumes a username. DAPP uses a unique email address and needs a role, phone number, preferred language, and verification state. Replacing the user model after many migrations is difficult, so the custom model is created in the first migration.

The three stored role values are stable machine-readable constants:

```text
FARMER
PROCUREMENT_OFFICER
ADMIN
```

The public registration serializer never accepts `role`. It always creates `FARMER`, preventing a malicious client from registering as an administrator.

## 4. JWT cookie flow

1. The user sends email and password to `/auth/login/`.
2. Django validates the credentials and creates short-lived access and longer-lived refresh tokens.
3. Django sends both as HTTP-only cookies. Browser JavaScript cannot read them.
4. The frontend obtains a CSRF token from `/auth/csrf/` and sends it in the `X-CSRFToken` header for unsafe requests.
5. The browser includes the JWT cookies in requests to `/auth/me/` and later protected APIs; Django rejects unsafe cookie-authenticated requests without a valid CSRF token.
6. When the access token expires, the frontend calls `/auth/refresh/` once and retries the original request.
7. Logout blacklists the refresh token and removes both cookies.

Production should keep frontend and API on compatible HTTPS origins, set `JWT_COOKIE_SECURE=true`, and configure trusted origins and SameSite policy for the final deployment topology.

## 5. Why PostgreSQL is the main database

DAPP contains relational workflows: farmers, crops, centres, requests, slots, inspections, transactions, and payments. PostgreSQL gives reliable constraints, transactions, indexing, and reporting. A temporary SQLite database is permitted only for fast isolated tests.

## 6. The domain rule we must preserve

```text
ProcurementRequest != ProcurementTransaction
```

A request may be pending, approved, rescheduled, rejected, cancelled, or expired. None of those states proves that crop was procured. The transaction is created only after physical arrival, quality inspection, weighment, and accepted quantity are recorded. Dashboard totals and payments must aggregate transactions—not requests.

## 7. What to study in the code

Read these files in order:

1. `backend/apps/accounts/models.py` — custom user and roles.
2. `backend/apps/accounts/serializers.py` — input validation and safe public registration.
3. `backend/apps/accounts/views.py` — login, refresh, logout, and current-user flows.
4. `backend/apps/accounts/authentication.py` — how the API reads JWT cookies.
5. `backend/apps/accounts/permissions.py` — role, ownership, and assigned-centre foundations.
6. `lib/api.ts` — frontend request, refresh, and error handling.
7. `app/login-experience.tsx` — registration and sign-in interface.
8. `app/dashboard/dashboard-client.tsx` — session loading and role-aware navigation.

## 8. Milestone 2 learning goals (now implemented)

Milestone 2 introduces foreign keys, one-to-one profiles, query filtering, object permissions, serializers for nested relationships, and database constraints. See `MILESTONE_2_EXPLAINED.md` for the completed design and its safe extension points.
