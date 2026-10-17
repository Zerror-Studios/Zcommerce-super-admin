# PRD-NNN — <Feature name>

| Field | Value |
|---|---|
| Status | Draft · Approved · In progress · Implemented · Superseded |
| Owner | <name / role> |
| Repos affected | zcom-backend · zcom-frontend · zcom-super-admin · storefronts/<name> |
| Source-of-truth PRD | <this file, or path to the backend PRD if this is a pointer> |
| Created / Updated | YYYY-MM-DD / YYYY-MM-DD |
| Approved by / on | <name> / YYYY-MM-DD |

## 1. Problem and goal
What problem this solves, for whom, and how we'll know it worked.

## 2. Scope
**In scope:**
**Out of scope:**

## 3. Users and permissions
Which roles use it. The backend `PERMISSIONS.*` values it needs (new or existing).

## 4. Functional requirements
Numbered, testable statements (FR-1, FR-2, …).

## 5. API / data contract
- GraphQL operations added or changed (name, args, return shape, error codes).
- Models / collections / indexes added or changed (owning service).
- Events published or consumed (`EVENTS.*`), and their idempotency key.
- Breaking? If yes, the migration and rollout order across repos.

## 6. UX
Screens and routes, states (loading / empty / error / success), and copy. Link designs.

## 7. Non-functional
Tenant isolation, security, performance, observability, and accessibility.

## 8. Open questions
Each one has an owner. A PRD with open blocking questions can't move to Approved.

## 9. Rollout and verification
Feature flag or plan gating, how it's tested, and the definition of done.

## 10. Implementation log
Filled in during and after delivery: PRs and commits, docs updated, and deviations from this PRD.
