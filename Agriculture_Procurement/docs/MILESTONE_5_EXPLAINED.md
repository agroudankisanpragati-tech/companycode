# Milestone 5 explained

Milestone 5 completes DAPP's internal operational loop while preserving the distinction established in earlier milestones:

```text
ProcurementRequest != ProcurementTransaction != PaymentRecord
```

- `ProcurementRequest` is the farmer's intent to sell.
- `ProcurementTransaction` is the immutable result of physical inspection, weighment, and positive acceptance.
- `PaymentRecord` is the controlled settlement workflow for exactly one committed transaction.

The three records are connected, but none can be substituted for another. In particular, the procurement receipt remains evidence of accepted produce and payable value. Only a settled payment can produce a settlement proof.

## 1. Delivered scope

Milestone 5 adds:

1. A transaction-linked payment ledger.
2. Idempotent payment mutations and append-only payment events.
3. Officer initiation/processing and administrator reconciliation.
4. A distinct PDF settlement proof issued only after settlement.
5. Persistent, private in-app notifications.
6. Farmer grievances with optional operational links.
7. Append-only grievance review and resolution events.
8. Date-, centre-, and crop-filtered procurement analytics.
9. Role-specific dashboard navigation and operational totals.

No external bank or government API is simulated. `SETTLED` means an authorised DAPP administrator recorded and matched a bank reference; a real deployment must connect this boundary to an approved payment rail and verification source.

## 2. Payment data model

### `PaymentRecord`

Each record has a one-to-one `transaction` relation. The server copies `transaction.total_amount`; clients cannot choose or alter the amount.

Important fields:

| Field | Purpose |
| --- | --- |
| `payment_number` | System-issued `DAPP-PY-...` public reference |
| `transaction` | Exactly one committed procurement transaction |
| `amount` | Must equal the transaction total |
| `method` | DBT, NEFT, RTGS, or other controlled method |
| `beneficiary_reference` | Non-sensitive beneficiary label; no account number is stored |
| `status` | Initiated, processing, settled, or failed |
| `attempt_count` | Preserves retry count |
| `bank_reference` | Unique nonblank UTR/reference for settled records |
| timestamps | Initiation, processing, settlement, and last failure times |

Database constraints require a positive amount, at least one attempt, and a unique nonblank bank reference. Service validation additionally enforces exact amount equality and settled-record completeness.

### `PaymentEvent`

Every mutation creates an append-only event containing:

- action;
- previous and next status;
- actor;
- note;
- external reference snapshot where applicable;
- idempotency key;
- SHA-256 fingerprint of the canonical request payload;
- creation time.

The API exposes events read-only. There is no update or delete route.

### `PaymentReceipt`

The settlement receipt is one-to-one with a payment and stores a public receipt number, verification code, issuing administrator, and issue time. It is created atomically with the successful `SETTLE` transition. Model validation and the download endpoint both reject non-settled payment proof.

## 3. Payment lifecycle

```text
UNINITIATED
    |
    v
INITIATED -----> FAILED
    |              |
    v              | retry
PROCESSING ------> INITIATED
    |  \
    |   -> FAILED
    v
SETTLED
```

Rules:

- An assigned procurement officer or administrator can initiate a payment.
- Initiation is allowed only for a transaction in the actor's scope and only when no payment exists.
- An officer or administrator can move `INITIATED` to `PROCESSING`.
- Only an administrator can record `SETTLED` or `FAILED`.
- Settlement is allowed only from `PROCESSING` and requires a bank reference.
- Failure is allowed from `INITIATED` or `PROCESSING` and requires a reason.
- An assigned officer or administrator can retry `FAILED`; retry increments the attempt counter without erasing failure history.
- `SETTLED` is terminal.

The service obtains row locks around each transition so concurrent workers cannot legally apply conflicting state changes.

## 4. Idempotency

Every payment mutation requires an `Idempotency-Key` request header with at most 64 characters.

The server hashes the canonical operation payload. Repeating the same action, target, payload, and key returns the existing payment without creating another event. Reusing the key for a different action, target, or payload returns `400 Bad Request`.

This is essential for payment operations because a browser or network intermediary may retry a request after a timeout. Idempotency prevents the retry from creating a second logical attempt.

## 5. Settlement proof

The separate settlement PDF contains:

- `SETTLED - VERIFIED` state;
- settlement receipt and payment numbers;
- unique bank reference/UTR;
- verification code;
- settlement and issue timestamps;
- farmer and non-sensitive beneficiary references;
- procurement transaction and procurement receipt numbers;
- request, centre, and crop references;
- accepted quantity, method, and exact settled amount.

`GET /api/v1/payments/{id}/receipt/` returns `409 Conflict` until the payment is settled. This prevents an initiated or processing payment from being presented as paid.

## 6. Notifications

`Notification` is a persistent user-owned inbox record. Categories cover appointments, quality, procurement, payments, grievances, and system messages.

Notifications are emitted for:

- appointment approval/rescheduling;
- request rejection;
- quality pass/rejection;
- final procurement completion/rejection;
- every payment state change;
- grievance submission and review status changes.

Only the recipient can list or retrieve a notification. Content is not editable; the only mutation is setting `read_at` through one-record or mark-all actions.

## 7. Grievances

A farmer can lodge a grievance in scheduling, quality, procurement, payment, or other categories. A case can optionally reference a request, transaction, and/or payment.

The service verifies all links belong to the signed-in farmer and agree with each other. A farmer therefore cannot discover or attach another farmer's identifier even if it is guessed.

`GrievanceEvent` preserves creation, review, resolution, and rejection history. Officers see and operate only grievances linked to their active centre. General grievances with no centre link remain visible to administrators. Closing a case requires a recorded resolution.

## 8. Analytics

`GET /api/v1/analytics/summary/` accepts:

- `date_from=YYYY-MM-DD`;
- `date_to=YYYY-MM-DD`;
- optional `center=<uuid>`;
- optional `crop=<uuid>`.

The default window is the last 30 days and the maximum inclusive window is 366 days. A procurement officer is always restricted to the assigned active centre; supplying another centre filter cannot expand that base queryset. Farmers receive `403 Forbidden`.

The response includes totals, daily trends, crop breakdown, centre breakdown, payment-status distribution, and grievance-status distribution.

Formulas:

```text
outstanding amount = payable amount - settled amount
settlement rate = settled amount / payable amount * 100
acceptance rate = accepted quantity / physical net quantity * 100
```

Zero denominators safely produce `0.00%`.

## 9. API examples

Initiate the exact transaction amount:

```http
POST /api/v1/payments/
Idempotency-Key: initiate-7c89f7f0
Content-Type: application/json

{
  "transaction": "<transaction-uuid>",
  "method": "DBT",
  "beneficiary_reference": "Verified farmer account",
  "note": "Initiated after procurement verification."
}
```

Move to processing:

```http
POST /api/v1/payments/<payment-uuid>/transition/
Idempotency-Key: process-639c2d42
Content-Type: application/json

{
  "action": "START_PROCESSING",
  "note": "Submitted to payment rail."
}
```

Administrator settlement:

```http
POST /api/v1/payments/<payment-uuid>/transition/
Idempotency-Key: settle-f519f160
Content-Type: application/json

{
  "action": "SETTLE",
  "bank_reference": "UTR-UNIQUE-REFERENCE",
  "note": "Bank confirmation matched."
}
```

Lodge a linked grievance:

```http
POST /api/v1/grievances/
Content-Type: application/json

{
  "category": "PAYMENT",
  "subject": "Settlement status query",
  "description": "Please review this payment record.",
  "priority": "NORMAL",
  "payment": "<owned-payment-uuid>"
}
```

## 10. Dashboard experience

### Farmer

- Own procurement records and procurement receipts.
- Own payment status, event timeline, and settled proof.
- Private workflow inbox with read controls.
- Grievance submission and complete case timeline.
- Overview totals for payable, settled, outstanding, unread updates, and open grievances.

### Procurement officer

- Assigned-centre transactions ready for initiation.
- Payment processing and failed-payment retry controls.
- Assigned-centre grievance queue and resolution controls.
- Assigned-centre analytics.
- Private operational inbox.

### Administrator

- System-wide payment ledger.
- Administrator-only settlement/failure controls.
- System-wide grievance handling.
- System-wide analytics with centre/crop/date filters.

## 11. Main implementation files

Backend:

- `apps/procurement/models.py`
- `apps/procurement/milestone5_services.py`
- `apps/procurement/milestone5_serializers.py`
- `apps/procurement/milestone5_views.py`
- `apps/procurement/analytics.py`
- `apps/procurement/payment_receipts.py`
- `apps/procurement/migrations/0004_*.py`
- `apps/procurement/tests/test_milestone5_operations_api.py`

Frontend:

- `app/dashboard/panels/payments-panel.tsx`
- `app/dashboard/panels/notifications-panel.tsx`
- `app/dashboard/panels/grievances-panel.tsx`
- `app/dashboard/panels/analytics-panel.tsx`
- `app/dashboard/dashboard-client.tsx`
- `lib/types.ts`

## 12. Verification result

The Milestone 5 checkpoint passes:

- Django system check;
- migration drift check;
- all 48 backend tests, including 12 new payment/notification/grievance/analytics tests;
- TypeScript type-check;
- ESLint;
- production frontend build;
- all 10 rendered frontend tests;
- settlement PDF text, metadata, and rendered-page inspection.

The test suite explicitly covers role isolation, exact amounts, idempotent replay, key-conflict rejection, administrator-only reconciliation, failed-payment retry, settled-only proof, notification privacy, cross-farmer grievance rejection, centre-scoped case handling, and analytics access/totals.
