# Visit Trust Loop Design

## Goal

Implement the proposal's core proof loop: a user records what happened after visiting a place, the service stores that signal, and the next response exposes a rule-based trust score that can show how trust changes.

## Scope

P0 only:
- Add a `visit_signal` table.
- Add `POST /visit-signals`.
- Add `trust_score`, `score_breakdown`, and `check_required` to pack items.
- Add a visit feedback/update simulation UI to the packing dashboard.

Out of scope for this pass:
- GPS authentication, login, real-time weather scoring, and a full trust history dashboard.

## Data Flow

`PackingDashboard` visit feedback -> `/visit-signals` -> `visit_signal` table.

`/pack` -> `trust.badge_item` -> rule-based `trust_score`:
- public data match
- user-condition fit
- movement feasibility
- operation/freshness signal
- visit signal
- recency

The score never creates a place or a fact. It only grades known DB fields and stored visit signals.

## Failure Behavior

If the database is unavailable, `/visit-signals` returns a clear unavailable response instead of breaking the demo. Local UI state remains available.

## Testing

- Unit tests for score calculation.
- API test for `/visit-signals` request validation and unavailable-safe behavior.
- Existing web `npm run lint` and `npm run build`.
