# Milestone 3 explained

Milestone 3 turns DAPP's identity and crop foundation into a controlled request-and-scheduling workflow. It stops before physical procurement so that sell intent, capacity, and arrival planning cannot be mistaken for accepted produce or payment.

## 1. The boundary remains explicit

```text
ProcurementRequest != ProcurementTransaction
```

A procurement request says what a farmer intends to bring. An approved request adds an arrival slot and reserves capacity. Neither action proves that produce arrived, passed inspection, was weighed, or was accepted.

Milestone 3 therefore creates no procurement transaction, receipt, or payment record. Those records belong after physical verification in Milestone 4.

## 2. Records introduced

| Record | Purpose | History rule |
| --- | --- | --- |
| `ProcurementRequest` | Farmer sell intent, requested centre/date/quantity, and current lifecycle state | Never deleted through the workflow API |
| `CapacityReservation` | Quantity held for one request at one centre on one date | Released or consumed; not overwritten |
| `ProcurementAppointment` | Arrival window, queue number, and digital token | Cancelled and replaced when rescheduled |
| `RequestStatusEvent` | Actor, transition, note, and timestamp | Append-only audit history |

The current request status is convenient for queries. Status events preserve how that state was reached.

## 3. Request lifecycle

Supported transitions are deliberately narrow:

| From | Action | To | Capacity effect |
| --- | --- | --- | --- |
| New | Farmer submits | `SUBMITTED` | None |
| `SUBMITTED` | Officer starts review | `UNDER_REVIEW` | None |
| `SUBMITTED` or `UNDER_REVIEW` | Officer approves | `APPROVED` | Create reservation and appointment |
| `SUBMITTED` or `UNDER_REVIEW` | Officer rejects with reason | `REJECTED` | None |
| `APPROVED` or `RESCHEDULED` | Officer reschedules | `RESCHEDULED` | Release old reservation; cancel old token; create replacements |
| Pending or scheduled | Farmer cancels with reason | `CANCELLED` | Release active reservation and cancel active token |

Terminal requests cannot be silently reopened by editing fields. A future policy can add a named transition without weakening the existing history.

## 4. Submission does not reserve capacity

The farmer submission serializer requires:

- a complete farmer profile;
- an active crop record owned by the signed-in farmer;
- an active catalogue crop and procurement centre;
- a date that is not in the past; and
- an intended quantity no greater than that crop record's available quantity.

The server supplies the farmer identity. A posted farmer UUID is never trusted. Submission creates the request and its first status event in one transaction, but no reservation or appointment.

This lets officers reject, negotiate, or schedule intent without inflating operational capacity figures.

## 5. Approval is atomic

Approval and rescheduling run inside `transaction.atomic()` and lock the relevant rows before checking or writing:

1. the procurement request;
2. the procurement centre;
3. the farmer crop; and
4. the officer assignment when the actor is not an administrator.

The centre lock serializes approvals competing for the same centre. The crop lock serializes reservations competing for the same farmer crop, even across different centres.

Within the transaction, DAPP checks that:

- the actor is an administrator or an actively assigned officer for that centre;
- the centre and crop remain active;
- the slot is inside centre operating hours;
- the scheduled date is not in the past;
- the scheduled quantity is positive and does not exceed the request intent;
- all active reservations for the centre/date plus the proposed quantity fit daily capacity; and
- all active reservations for the farmer crop plus the proposed quantity fit crop availability.

Only after every check passes does DAPP create the reservation, queue position, appointment, token, and status event. An error rolls back the whole operation.

PostgreSQL is the production concurrency boundary. SQLite is useful for isolated tests but does not reproduce PostgreSQL row-lock behaviour.

## 6. Queue numbers and tokens

Queue numbers are unique per centre and date. They are allocated while the centre row is locked, so two normal approval requests cannot receive the same position.

Tokens use a system-generated `DAPP-...` code and are unique. The frontend displays them as digital arrival passes with:

- request number;
- centre and date;
- arrival window;
- queue number;
- crop and reserved quantity; and
- active or cancelled state.

The token screen explicitly says that a token is not proof of procurement, accepted weight, price, payment, or receipt.

## 7. Rescheduling and cancellation preserve history

Rescheduling does not edit the previous appointment into a new one. It marks the active reservation `RELEASED`, marks the active appointment `CANCELLED`, and creates a new reservation and appointment with a new token.

Farmer cancellation uses the same release path. The request remains queryable in `CANCELLED` state, and its status event records the farmer's reason.

Partial unique constraints enforce at most one active reservation and at most one scheduled appointment per request. Historical released and cancelled records can coexist safely.

## 8. Crop availability remains protected

The approval service prevents aggregate active reservations from exceeding a crop record's available quantity. The crop update endpoint also locks the crop and prevents a farmer from:

- lowering available quantity below the amount already reserved; or
- archiving a crop that still backs an active token.

The farmer must cancel the relevant requests first, which releases their reservations through the auditable transition.

## 9. Role and object scope

| Surface | Farmer | Procurement officer | Administrator |
| --- | --- | --- | --- |
| Request list/detail | Own only | Active assigned centre only | All |
| Request create | Yes, as self | No | No |
| Start review/approve/reject/reschedule | No | Assigned centre only | All |
| Cancel | Own cancellable requests | No | No |
| Appointment list/detail | Own only | Active assigned centre only | All |
| Capacity snapshot | Active visible centres | Assigned active centre | All centres |

Scope is enforced by API querysets, not by React visibility. An out-of-scope detail or action resolves as not found, which avoids confirming another user's record identifiers.

## 10. Dashboard behaviour

Farmer workspace:

- submit a request from active owned crops and active centres;
- track status and the latest audit event;
- cancel a pending or scheduled request with a reason; and
- view active and historical token cards.

Officer workspace:

- see only requests for the assigned active centre;
- start review, approve, reject, or reschedule;
- inspect capacity before a new approval; and
- view the centre arrival schedule and queue.

Administrator workspace:

- audit and review requests across centres;
- view all arrival appointments; and
- monitor system-wide open requests and upcoming tokens.

## 11. Verification coverage

Backend tests cover:

- complete-profile and ownership requirements;
- submission without capacity side effects;
- farmer and officer visibility isolation;
- approval records and unique token creation;
- centre overbooking rollback;
- aggregate farmer-crop overcommit rejection;
- reservation-aware crop updates;
- rescheduling history;
- cancellation release;
- required rejection reasons;
- unavailable delete operations; and
- role-specific summary metrics.

Frontend verification covers production build, lint, TypeScript contracts, server rendering, loading states, shared primitives, and quantity formatting.

## 12. Milestone 4 extension (implemented)

Milestone 4 now begins physical procurement from a scheduled appointment and adds named records for check-in, inspection, weighment, acceptance, transaction creation, and receipt generation.

The implemented transaction:

1. lock the request, active reservation, and farmer crop;
2. verify physical inspection and gross/tare/net weight rules;
3. create the procurement transaction from accepted quantity only;
4. mark the capacity reservation `CONSUMED`;
5. reduce crop availability consistently; and
6. generate a receipt from the committed transaction.

Payments, procurement totals, and analytics must reference accepted transactions—not requests, reservations, appointments, or tokens. See `MILESTONE_4_EXPLAINED.md` for the completed design.

## 13. Suggested reading order

1. `backend/apps/procurement/models.py` — lifecycle records and constraints.
2. `backend/apps/procurement/services.py` — row locks and atomic transitions.
3. `backend/apps/procurement/serializers.py` — submission and action validation.
4. `backend/apps/procurement/views.py` — role-filtered APIs and summaries.
5. `backend/apps/procurement/tests/test_procurement_workflow_api.py` — invariant tests.
6. `app/dashboard/panels/procurement-requests-panel.tsx` — farmer and reviewer workflow.
7. `app/dashboard/panels/appointments-panel.tsx` — digital token and schedule view.
