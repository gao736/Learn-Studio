# Learning Studio Web MVP Implementation Plan

> For agentic workers: execute inline using superpowers:executing-plans, one task at a time, TDD and a whole-branch review at finish. Resume from docs/studio-mvp-progress.md; never reset prior progress.

**Goal:** Deliver a usable Chinese web MVP: saved course -> continuous lessons -> independent assessment/remediation -> FSRS review -> weekly test -> confirmed plan adjustment.
**Architecture:** Retain Next.js 16, Better Auth, pg/RLS, pg-boss, the existing Qwen gateway and ts-fsrs. Reuse approved assessment-pack skills as follow-up lessons after the existing introductory lesson. Add a small versioned study-plan and weekly-test feature; preserve course material and assessment histories.
**Tech Stack:** Existing locked React/TypeScript/Next/PostgreSQL/pg-boss/ts-fsrs, CSS and Node/Playwright.
**Spec:** User accepted the preceding MVP scope in chat on 2026-11-15: finish M03/M04 checks, continuous 3-5 lessons, minimal M05, dashboard integration, limited-pilot readiness. Existing M01-M04 rules remain binding.

## Global Constraints
- Keep original accounts, credentials, courses, material revisions, budget records, answers and FSRS dates. Back up the existing database before migrations; never mark personal learning evidence by automation.
- Reuse original registration/email and model configuration. No new model/provider, paid fallback, extra infrastructure or private-data transmission.
- Start with the existing sourced astronomy course. One introductory lesson plus two approved skill lessons forms the first three-lesson MVP. Other topics retain first-lesson creation and the existing assessment approval path; no claim of all-domain practical competence.
- Formal mastery remains five distinct question families, at least four independent correct, no help/reused evidence, prerequisites and required-practice guards. Weekly tests never manufacture formal mastery.
- Weekly tests use unseen choice questions from approved, already-studied skills. If fewer than five distinct families remain, report exhaustion and retain the existing plan. No recycled questions presented as fresh evidence.
- Only explicit confirmation changes future unstarted study tasks. Preserve prior plan versions and completed/started tasks; shared daily time may not grow beyond the learner budget.
- Independent fixture accounts and local mail only for automated UI checks; do not email real accounts automatically. Real user diagnosis remains a separately labelled acceptance item.
- Retain Swiss/minimal Chinese design and system fonts. Pending, empty, error, retry and persistence states are mandatory. No broad visual redesign.
- Do not publish externally or claim actual learning effect without real observations. Produce a reviewable local release and deployment/backup instructions.

## Review Focus
1. Another user's course/pack/weekly-session/plan IDs must not disclose contents or alter records.
2. Duplicate clicks, stale plan revisions and worker failures must not overwrite history or double-charge.
3. Expired dates, multiple goals and week/month boundaries must respect the daily total and preserve started work.
4. Answer/help exposure and disputed/unverified sources must not create independent mastery.
5. No candidate question answer keys in client state before submission; empty/exhausted banks are recoverable failures.

## Task 1: Baseline and existing learning/review acceptance
Files: existing assessment/review tests; docs/studio-mvp-progress.md.
- [ ] Back up the existing database; read-only fingerprint original personal records.
- [ ] Run baseline suite; isolate environmental failures and fix only meaningful brittle checks with RED/GREEN.
- [ ] Run M01-M04 browser checks against isolated local-mail fixtures; retain real-user acceptance as pending when unobserved.
- [ ] Record results and checkpoint; no feature advances before the functional baseline passes.

## Task 2: Continuous course directory and versioned study plan
Files: src/features/study/{domain,repository,actions,StudyForms}.ts[x], migration 008, course pages and tests.
Interfaces: getStudyPlan(user,course), createStudyPlan(user,course,startDate), startStudyTask(user,course,task,expectedRevision). Consume getCourse/getPack/getProgress/getStudy; reuse existing protected lesson routes and independent assessment.
- [ ] RED: three linked lessons, prerequisite locks, explicit creation/persistence, cross-owner rejection, duplicate create, budget and resume checks.
- [ ] GREEN: reuse approved pack skills; show generated/locked/unavailable states; preserve original first lesson and all prior versions.
- [ ] Run domain/database/browser checks and update ledger before next task.

## Task 3: Minimal weekly test and confirmed adaptation
Files: study domain/repository/actions/forms, weekly routes, migration and tests.
Interfaces: startWeekly(user,course), submitWeekly(user,session,answers), previewAdjustment(user,course,session), confirmAdjustment(user,course,session,expectedRevision).
- [ ] RED: day-seven guard, five unseen approved families, protected answer keys, server grading, duplicate submission, exhaustion, stale confirmations and owner isolation.
- [ ] GREEN: explicit suggestion preview; update only future unstarted tasks; prior version saved atomically and no extra daily minutes.
- [ ] Run affected regressions; verify persistence and failure recovery; checkpoint.

## Task 4: Today dashboard and coherent navigation
Files: today/course/assessment pages, AppShell, existing CSS, browser tests.
- [ ] RED: current course/next task/due review/result are reachable; source topic is dynamic; stale pending-verification wording absent.
- [ ] GREEN: five clear navigation entries; link continuous courses and weekly test; retain sample course access and support labels.
- [ ] Verify 375/768/1024/1440 widths, keyboard and 200% text; checkpoint.

## Task 5: Local release and limited-pilot readiness
Files: run/backup/restore scripts and deployment guide only where necessary; docs/handoff and MVP guide.
- [ ] Full core, database, browser, types and production build checks; compare original personal-record fingerprints.
- [ ] Review all changes with one fresh reviewer; address important findings with RED/GREEN and rerun affected suite.
- [ ] Reuse current real course for functional demonstration without submitting personal answers; preserve any user acceptance still needed.
- [ ] Leave a runnable local preview, verified backup and concrete deployment configuration. External hosting and real participant outcomes remain unclaimed until actually performed.
