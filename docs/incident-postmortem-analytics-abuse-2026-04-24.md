# Materio Incident Postmortem: Analytics Leaderboard Abuse

## Incident Details
- Incident ID: INC-2026-04-24-ANALYTICS-ABUSE
- Date Detected: 2026-04-24
- Severity: High
- Status: Investigation complete, remediation in progress
- Affected System: Analytics ingestion and leaderboard ranking via `features?action=analytics`

## Executive Summary
Materio experienced a leaderboard integrity incident caused by forged analytics submissions. A malicious actor appears to have discovered the public analytics ingestion endpoint and sent manipulated payloads using non-browser clients, resulting in impossible reading metrics and leaderboard takeover behavior.

The abuse did not present as a broad outage. The primary impact was trust and fairness degradation in ranking outputs.

## What Triggered Investigation
The incident was flagged through behavioral anomalies:
- A new account (approximately 4 days old) showed extreme reading durations.
- Reported reading reached impossible values for the elapsed day (for example, 44 hours by around 10 AM local time).
- Internal metric consistency violations were observed (for example, impossible relationships between total and unique counters).
- Peer user data looked normal, isolating the anomaly to suspicious identities.

## Verification and Technical Findings
Code-path verification confirmed a plausible abuse path:
- The ingestion handler accepts client-submitted analytics payloads and forwards them upstream:
  - `api/v2/features.js` (`handleAnalytics`)
- Payload is proxied to Supabase RPC (`merge_daily_stats`) without anti-forgery enforcement in this handler layer.
- Browser client code exposes request shape that can be replayed externally:
  - `assets/scripts/sync.js` posts to `/api/v2/features?action=analytics`
- Leaderboard computation consumes accumulated stored aggregates:
  - `api/v2/features.js` (`handleAnalyticsLeaderboard`)

Conclusion: The observed anomalies are consistent with intentional API abuse using forged submissions.

## Impact Assessment
- User-facing impact:
  - Leaderboard results became unreliable and unfair.
  - Legitimate users were displaced by manipulated rankings.
- System impact:
  - Analytics data quality was polluted for ranking use cases.
- Business/reputation impact:
  - Reduced trust in competitive and engagement metrics.

## Root Cause
Primary root cause:
- The system trusted client-supplied aggregate analytics values for write operations that influence rankings.

Contributing causes:
- Missing strong request authenticity for analytics submissions.
- Missing robust rate limiting and burst controls for analytics ingestion.
- Missing strict server-side clamping/invariant checks for impossible values.
- Missing fraud quarantine gate before leaderboard inclusion.

## Timeline (UTC)
- 2026-04-24 04:30 to 05:00: Suspicious user overtakes historical top user unexpectedly.
- 2026-04-24 05:00 to 06:00: Manual review identifies impossible reading-time growth and counter inconsistencies.
- 2026-04-24 06:00 to 07:00: API path review validates abuse feasibility from external clients.
- 2026-04-24 07:00 onward: Immediate containment and remediation planning initiated.

## Immediate Containment Actions
1. Exclude suspicious identities from leaderboard rendering pending verification.
2. Add emergency per-request and per-day caps for analytics increments.
3. Reject malformed and impossible payload relations.
4. Apply temporary ingestion throttling by IP and identity keys.
5. Prepare data cleanup/rollback for poisoned incident-window records.

## Corrective and Preventive Actions

### 1) Trust Model Hardening
- Stop accepting client aggregate counters as authoritative input.
- Shift to server-computed totals from low-level events (open, heartbeat, close).

### 2) Identity and Authenticity Controls
- For authenticated users, derive identity from verified token only.
- Ignore user identity fields supplied in request body.
- For guest mode, issue signed server-generated anon session identifiers.

### 3) Replay and Abuse Protection
- Introduce nonce/sequence validation per identity/session.
- Reject duplicate or out-of-order submissions.

### 4) Ingestion Validation
- Enforce strict JSON schema with type and range checks.
- Reject unknown fields and invalid nested structures.
- Clamp numerical increments at API boundary and DB/RPC boundary.

### 5) Rate Limiting and Quarantine
- Add layered limits by IP, anon ID, and user ID.
- Introduce velocity-based fraud scoring.
- Quarantine suspicious profiles from leaderboard eligibility automatically.

### 6) Data Integrity Rules
- Enforce invariant checks at write time, including:
  - Daily reading cap.
  - No negative increments.
  - Unique metrics cannot violate total metrics.
  - Impossible growth based on elapsed day-time is rejected or flagged.

### 7) Monitoring and Alerting
- Alert on impossible velocity and integrity rule violations.
- Alert on high-rate submissions from young/new identities.
- Maintain tamper/audit logs for rejected and suspicious writes.

## Validation Plan
1. Recompute leaderboard from cleaned and validated data.
2. Verify suspicious accounts no longer influence rankings post-remediation.
3. Run enhanced monitoring for 7 days with daily review.
4. Confirm no recurrence before relaxing temporary strict caps.

## Ownership
- API hardening: Backend API owner
- Database constraints and RPC guardrails: Supabase/DB owner
- Monitoring and alerting: Analytics operations owner
- Data cleanup and recomputation: Analytics pipeline owner

## Lessons Learned
- Public endpoints that influence competitive metrics must be designed under adversarial assumptions.
- Client-side telemetry is useful for UX insights but must not be trusted as ranking truth without server-side controls.
- Integrity checks and fraud gates should be first-class components, not post-incident additions.

## Current Status
- Abuse pattern confirmed.
- Postmortem documented.
- Remediation items prioritized and ready for phased implementation.
