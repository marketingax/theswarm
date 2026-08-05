# Schema Drift Audit — 2026-08-05

Live Supabase project: `mmdmqhftpesjnynyhsyv` ("theswarm").
Triggered by the 08-03 buzz-brief audit flag: application code references
`peer_reviews`, `disputes`, `stake_held`, `reviews_for`/`reviews_against`,
`missions.verification_method`, and a `sweep_expired()` function called by a
live hourly cron — none of which had a committed migration.

Method: read-only `information_schema` / `pg_catalog` queries against the live
DB via the Supabase MCP (`list_tables`, `execute_sql`), diffed against every
`.sql` file in the repo root and `migrations/`, plus a grep of all application
code (`src/`, `packages/`) for every live table/column/function name. No
writes were made to the database.

## Verdict on the original flag

**Confirmed, not a false alarm.** Every one of the flagged objects exists on
the live database but has no matching file anywhere in this repo. They were
applied by hand or via an MCP session directly against Postgres. The live
`supabase_migrations.schema_migrations` history table even has three entries
with no corresponding file in this repo at all:

| live migration version | live migration name        | matching repo file |
|---|---|---|
| 20260624143611 | `verification_engine` | none |
| 20260624144135 | `deadline_sweeper` | none |
| 20260624155127 | `peer_review` | none |

(The other four live-tracked migrations — `add_usd_balance_to_agents`,
`crew_economy_team_lift`, `trust_history_and_admin_flag`,
`used_signatures_replay_protection` — do match committed content: see
`DATABASE.sql`, `CREW_ECONOMY.sql`, `migrations/004_trust_history.sql`,
`migrations/005_used_signatures.sql` respectively.)

## Category (a): live DB, not in any committed file — REPAIRED

Captured verbatim (via `pg_get_functiondef`, `pg_indexes`, `pg_constraint`,
`pg_policies`) into `migrations/20260805_baseline_live_drift.sql`, committed
in this same change. This file is a **baseline capture, not a schema
change** — every statement is idempotent and is a no-op if run again against
the live DB.

- `missions.acceptance_criteria` (jsonb, default `{}`), `missions.verification_method` (text, default `'auto'`)
- `claims.stake_held`, `claims.reviews_for`, `claims.reviews_against` (int4, default 0)
- `crew_subtasks.acceptance_criteria`, `.verification_method`, `.verification_score`, `.verification_notes`, `.stake_required`, `.stake_held`, `.reviews_for`, `.reviews_against`
- Table `public.disputes` (full DDL, indexes, RLS policy)
- Table `public.peer_reviews` (full DDL, indexes, RLS policy)
- Function `public.sweep_expired()` — invoked by the hourly Vercel cron: `vercel.json` → `"crons": [{"path": "/api/cron/sweep", "schedule": "0 * * * *"}]` → `packages/dashboard/src/app/api/cron/sweep/route.ts:18` (`db.rpc('sweep_expired')`). Note: there is **no pg_cron job** in the database (`cron.job` doesn't exist / pg_cron isn't installed) — the hourly schedule lives entirely in Vercel's cron config, not in Postgres.

## Category (b): referenced by code, missing from live DB — SILENTLY BROKEN

Not created (product decision, out of scope for this repair). These are real,
currently-broken code paths in the **deployed** app (`packages/dashboard`,
the only workspace actually built/deployed per root `package.json` and
`vercel.json`). The whole "outreach missions" feature reads/writes columns on
`missions` and a table `outreach_proofs` that were only ever added in
`migrations/add_outreach_missions.sql` — a file that is committed but was
**never applied** to the live database (see Category (c)). Any request to
these routes will fail at the PostgREST/Supabase layer (400 — unknown column,
or relation does not exist):

- `packages/dashboard/src/app/api/missions/outreach/route.ts:28,35,58,60` — selects `target_platform, proof_type, success_criteria, requires_disclosure, target_list` from `missions`; joins non-existent table `outreach_proofs`
- `packages/dashboard/src/app/api/missions/outreach/create/route.ts:32-196` — inserts `outreach_template, target_platform, target_list, success_criteria, proof_type, requires_disclosure` into `missions`
- `packages/dashboard/src/app/api/missions/outreach/[id]/claim/route.ts:122-216` — reads `target_list, outreach_template, success_criteria, proof_type, target_platform, requires_disclosure` off a mission row
- `packages/dashboard/src/app/api/missions/outreach/submit-proof/route.ts:93,126,145` — inserts/updates the non-existent `outreach_proofs` table
- `packages/dashboard/src/app/api/admin/outreach/proofs/[id]/approve/route.ts:42,67` — reads/updates `outreach_proofs`
- `packages/dashboard/src/app/api/admin/outreach/proofs/[id]/reject/route.ts:42,60` — reads/updates `outreach_proofs`
- `packages/dashboard/src/lib/outreach-utils.ts:16-144`, `packages/dashboard/src/components/OutreachMissionCard.tsx`, `packages/dashboard/src/app/create-mission/outreach/page.tsx:123-130` — frontend types/UI built against the same missing columns

**Fix (not applied, needs a product decision):** apply
`migrations/add_outreach_missions.sql` to the live DB, or formally retire the
outreach-missions feature and delete this dead code path.

### Secondary, lower-confidence finding — orphaned legacy tree

`src/app/api/agents/withdraw-usd/route.ts:99,185` reads/writes a
`pending_withdrawals` table. That table is committed in
`migrations/003_paid_missions_system.sql` but also never applied live (see
Category (c)). However, this route lives in the **top-level `src/` tree**,
which is not built or deployed — root `package.json`'s `build`/`dev` scripts
and `vercel.json`'s `buildCommand` only run `packages/dashboard`. This route
appears to be leftover from an earlier repo layout (`packages/dashboard`
instead has `withdraw-sol`, no USD withdrawal / `pending_withdrawals` code at
all). Flagging for cleanup, not treating as a live production break.

## Category (c): committed, never applied to live DB

- `migrations/add_outreach_missions.sql` — none of its columns (`outreach_template`, `target_platform`, `target_list`, `success_criteria`, `proof_type`, `requires_disclosure`, `outreach_verified_count`, `outreach_rejected_count`) or its `outreach_proofs` table exist live. Root cause of Category (b) above.
- `migrations/003_paid_missions_system.sql`'s `pending_withdrawals` table — not present live.
- `DATABASE.sql`'s later `ALTER TABLE agents ADD COLUMN wallet_signature / trust_score / probation_ends_at` (lines ~249-259) — not present live under those names; the live DB instead has `trust_tier`, `audit_rate`, `probation_until` (from `migrations/002_trust_system.sql`), which superseded this earlier draft. No action needed — this looks like dead draft SQL from before the trust-system migration landed, not a pending change.

## What was NOT done

No objects were created on the live database. No existing repo migration was
edited. This audit only added `migrations/20260805_baseline_live_drift.sql`
(a captured-from-live baseline) and this file.
