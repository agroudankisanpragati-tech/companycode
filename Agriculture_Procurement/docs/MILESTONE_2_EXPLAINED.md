# Milestone 2 explained

Milestone 2 turns the authenticated shell into a real, persisted domain foundation. It deliberately stops before procurement requests so identity, ownership, reference data, and centre scope can be tested in isolation.

## 1. The records introduced

| Record | Relationship | Why it exists |
| --- | --- | --- |
| `FarmerProfile` | One-to-one with a `FARMER` user | Stores the system farmer code, farm location, and land area without overloading the login account. |
| `CropCatalogue` | Administrator-controlled reference | Gives farmers a controlled crop choice and a canonical `kg` unit. |
| `FarmerCrop` | Many records owned by one farmer | Records season-specific cultivated area and estimated/available quantity. |
| `ProcurementCenter` | Administrator-controlled reference | Defines where procurement may happen, its hours, and daily capacity. |
| `OfficerAssignment` | One officer to one centre | Makes an officer's operational scope provable before later queue records exist. |

The separation matters. A catalogue crop such as Paddy is shared reference data; a farmer crop such as “Asha's Kharif 2026 Paddy” is private operational data.

## 2. Farmer codes and profile completion

Every farmer receives an immutable code in the form `FMR-XXXXXXXXXX`. A post-save signal creates a profile whenever a farmer account is created, including accounts created outside public registration.

The profile is complete only when village, district, state, six-digit PIN code, and a positive land area are present. The dashboard reads that computed state; it does not maintain a second boolean that could become stale.

## 3. Ownership is enforced on the server

Hiding another farmer's records in React is not a security boundary. The API applies two independent controls:

1. `FarmerCropViewSet.get_queryset()` filters farmer requests to `farmer=request.user`.
2. The object permission verifies the same ownership rule for detail writes.

The serializer marks `farmer` read-only, and `perform_create()` always supplies the authenticated user. If a malicious client posts another farmer's UUID, it is ignored rather than trusted.

Administrators can list crop records for audit, but cannot create or change them through this endpoint. Procurement officers have no direct access to farmer crop inventory. A future officer view must be introduced only through a request assigned to that officer's centre.

## 4. Centre visibility follows role scope

The same `/centres/` route produces different safe querysets:

- Farmers see active centres only.
- Procurement officers see only their actively assigned centre.
- Administrators see active and inactive centres and can maintain them.

`/officer/me/centre/` provides a focused projection for the signed-in officer. It returns no data when an active assignment cannot be proved.

## 5. Constraints live below the interface

The database and serializers enforce rules even if a request bypasses the frontend:

- One farmer cannot register the same crop, season, and harvest year twice.
- Available quantity cannot exceed estimated quantity.
- Crop area and estimated quantity must be positive.
- A farmer can select only an active catalogue crop.
- Centre codes, crop codes, and employee IDs are normalized to uppercase.
- Centre closing time must be later than opening time.
- PIN codes and optional Indian mobile numbers must match their required formats.

These checks are intentionally duplicated where useful: serializers provide readable API errors, while database constraints protect persisted integrity under concurrency.

## 6. What the dashboard now does

The dashboard loads `/auth/me/` first, then exposes only the working panels for that role.

Farmer panels:

- Complete the farmer profile.
- Add catalogue-backed crop records.
- Review active and archived crop history.
- Archive a crop without erasing it.
- Browse active procurement centres.

Procurement officer panels:

- See assignment state and active catalogue count.
- View only the assigned centre.

Administrator panels:

- Create, activate, or deactivate procurement centres.
- Create, activate, or archive catalogue crops.
- Review system foundation totals.

Transient success and validation feedback uses toasts. Destructive-looking crop archival requires confirmation. At this milestone, future workflow items remained locked and labelled Milestone 3.

## 7. Dashboard summaries are role-specific

`/dashboard/summary/` does not return one oversized analytics object and rely on the client to hide fields. Each role receives only the fields needed by its dashboard:

- Farmer: profile completion, own active crop count and quantity, active centre count.
- Officer: assignment and assigned centre, active catalogue count.
- Administrator: farmer, centre, catalogue, and active-assignment totals.

This reduces accidental disclosure and keeps frontend contracts explicit.

## 8. Cookie writes have explicit CSRF protection

HTTP-only JWT cookies prevent browser JavaScript from reading authentication tokens, but the browser still attaches those cookies automatically. DAPP therefore bootstraps a CSRF token from `/auth/csrf/` and requires the matching `X-CSRFToken` header on every unsafe cookie-authenticated request.

The rule also applies to registration, login, refresh, and logout. Bearer-token clients are not subject to the cookie CSRF check because a malicious page cannot automatically attach another application's authorization header.

## 9. Seed data is visibly non-production

Run `seed_demo_users` first, then `seed_reference_data`. The latter creates six crop references, a centre named `Demo Durg Procurement Centre`, completes the demo farmer profile, and assigns the demo officer. Commands are idempotent so repeated local setup updates the same records.

The `DEMO-` labels are intentional. Example data must never be mistaken for a real procurement location or record.

## 10. What remained deliberately absent

No current model represents intent to sell, capacity reservation, arrival, inspection, weighment, procurement, receipt, or payment. Therefore the dashboard does not display synthetic request or transaction totals.

The planned work was split into two boundaries:

1. Request and scheduling: farmer intent, centre/date choice, review, atomic capacity reservation, slot, and token.
2. Physical procurement: check-in, inspection, gross/tare/net weighment, accepted quantity, transaction, and receipt.

Milestone 3 now implements the first boundary. The second remains the scope of Milestone 4; payments and procurement analytics must reference that second boundary only. See `MILESTONE_3_EXPLAINED.md` for the completed request and scheduling design.

## 11. Suggested reading order

1. `backend/apps/accounts/models.py` — farmer profile and immutable code.
2. `backend/apps/procurement/models.py` — domain structure and constraints.
3. `backend/apps/procurement/permissions.py` — role and ownership rules.
4. `backend/apps/procurement/views.py` — role-filtered querysets and summaries.
5. `backend/apps/procurement/tests/test_procurement_foundation_api.py` — isolation checks.
6. `app/dashboard/dashboard-client.tsx` — role-aware navigation.
7. `app/dashboard/panels/` — connected forms and data views.
