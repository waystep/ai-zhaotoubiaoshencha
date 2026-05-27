---
name: tender-review-sdd
description: Use when evolving the AI tender pre-review platform with specification-driven development, including product rationale, business rules, AI review behavior, acceptance criteria, and release readiness.
---

# Tender Review SDD

Use this skill for feature planning, bug fixes, refactors, and release preparation in the intelligent tender pre-review platform.

## Core Rule

Start from specification before implementation. For each meaningful change, identify the product intent, user role, business rule, AI behavior, data model impact, acceptance criteria, and deployment impact.

## Workflow

1. Read `Why.md`, `DESIGN.md`, and the most relevant file under `docs/`.
2. If the request introduces a new capability, create or update `docs/specs/<feature>.md`.
3. Capture AI-specific rules when the feature touches extraction, review, scoring, report generation, or issue positioning.
4. Implement with existing stack conventions: Next.js App Router, TypeScript, Drizzle, Mastra, shadcn/ui style components, organization-scoped data access.
5. Verify with `npm run build`; add focused tests when permissions, state transitions, API contracts, or AI output schemas change.
6. Update `Why.md`, `DESIGN.md`, deployment docs, or acceptance docs when the change affects product positioning, architecture, operations, or release readiness.

## Required Spec Fields

For new features, ensure the spec includes:

- User and scenario
- Goal and non-goals
- Business rules
- Data and state transitions
- AI input/output contract if applicable
- Evidence and traceability requirements
- Permissions and organization isolation
- UI states and error states
- API/storage impact
- Acceptance criteria
- Risks and fallback behavior

## AI Review Guardrails

- Treat AI output as assisted review, not final legal or compliance judgment.
- Prefer structured output that can be stored and audited.
- Require evidence links to document page, block, bbox, or quoted source text when possible.
- Mark uncertain findings as needing manual review.
- Do not invent facts, clauses, scores, user counts, or production metrics.

## Done Criteria

A change is not complete until the relevant specification, implementation, verification result, and release/deployment notes are aligned.

