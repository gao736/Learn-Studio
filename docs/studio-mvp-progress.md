# Studio MVP progress — plan: docs/superpowers/plans/2026-11-15-studio-mvp.md

Baseline: a4a32e5d6ce176f03421a04fbf264c94c56601f7; branch codex/studio-mvp.
Workspace: C:/Users/gaofe/.codex/worktrees/learning-studio-mvp/learning-platform. Source and original data remain C:/Users/gaofe/Documents/New project/learning-platform.

Task 1: in progress. Existing database backup: .runtime/before-studio-mvp.dump. Baseline 31/32; the one failure is assessment-ai.test.ts comparing all budget rows across a new calendar month: new zero-valued periods differ, net cost is unchanged. No product failure has been inferred from this assertion.
Ruling: Native worktree creation could not verify the source checkout and attachment rejected the manual checkout; use a registered Git worktree with explicit paths and escalated filesystem commands. Source tree is untouched. Cost if wrong: tools need explicit workspace paths; no data migration is involved.
Ruling: Reuse approved assessment-pack skills as follow-up lessons rather than adding a second content/assessment engine. The existing real course has one introductory lesson plus two sourced skill lessons. Cost: MVP scope is a validated small curriculum; arbitrary-topic later lessons still require the existing approval workflow.
Ruling: Original-person diagnosis/review acceptance is not a proxy for code completion. Preserve it as pending and use isolated accounts to verify product behavior; never submit answers as the person. Cost: real learning outcomes and that person's completion remain unverified.
Pre-flight: study plans consume existing course schedules and approved skill IDs; weekly tests consume the same pack version and must preserve the assessment question-use ledger. All new tables require owner RLS. Existing personal materials and budgets cannot be regenerated or reset.

Next: fix the baseline's new-month zero-budget assertion, rerun the whole suite, then baseline browser acceptance. Continue from Task 1; no feature implementation has started.

Task 1: complete. Database backup verified by pg_dump exit 0. Node 33/33, types and production webpack build passed. Existing browser scenarios all passed in grouped runs: six M01/M04 checks in the full run, then all three affected M02/M03 checks in .runtime/studio-baseline-affected.log (34.3s). Original user's diagnosis/review completion remains unclaimed.
Task 1 fixes: zero-valued new calendar-budget periods are excluded from cost comparison; development reload refuses ended pools (observed RED, then GREEN); browser DB cleanup is worker-scoped; registration fixtures honor 429 Retry-After; logout tests await the real redirect instead of racing page.goto.
Ruling: Use Next's built-in webpack flag because Turbopack rejects the external node_modules junction. Cost: dev/build use webpack rather than Turbopack; no runtime capability or dependency change.
Ruling: Public prebuilt astronomy is also eligible for a study plan so new testers can try the MVP without generating and approving their own private bank. Use owner+course-key study plans (public key astronomy or an owned course UUID), with explicit policy checks. Default remains 30 days/30 minutes; the trial can cover week one. Cost: only a small sourced astronomy curriculum is prebuilt; no claim of 30 distinct new lessons.
Next: Task 2, continuous directory, explicit study-plan creation and owner-isolated persistence. Protect original personal records with .runtime/studio-records.mjs.
