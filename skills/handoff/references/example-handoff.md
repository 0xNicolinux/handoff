---
type: handoff
title: "HANDOFF: ledgerline: idempotent payment webhook"
project: ledgerline
created: 2026-11-03
updated: 2026-11-03
status: STOPPED AT USAGE LIMIT
session: "8c1f4e2a-5b7d-4c11-9e0a-3f2d6b9a7c40"
machine: "mara-mbp"
tags: [handoff, ledgerline, payments, webhooks]
---

# HANDOFF: ledgerline: idempotent payment webhook (RESUME HERE)

> **Note from the skill:** this is a realistic, trimmed, fictional example to calibrate the level of
> detail. Notice the literal request in quotes, the commits table with SHAs, test numbers with who ran
> them, the unfixed findings table, failures with a cause and an "instead", and steps with full commands
> and the "only with the user's OK" condition. The rules and gotchas below belong to this fictional
> project: don't copy them into yours.

> Written 2026-11-03 23:41 on mara-mbp, session `8c1f4e2a-5b7d-4c11-9e0a-3f2d6b9a7c40`. Stopped at the usage limit (94%).
> Resume: open a session in `/Users/mara/code/ledgerline` and say *continue from HANDOFF.md*; on this machine you can also run `claude --resume 8c1f4e2a-5b7d-4c11-9e0a-3f2d6b9a7c40`.
> Also read: `docs/payments.md` (webhook flow) and `.handoff/artifacts/2026-11-03-review-round-2/verdicts.txt`.
> Earlier handoffs still open: none.

## 1. Goal

**Literal request:** "the payment webhook double-charges when the provider retries. Make it idempotent and
fix the flaky checkout e2e. Don't push anything, I'll review tomorrow."

**Concretely:**
- `POST /webhooks/payments` must process each provider event id exactly once, even under concurrent retries.
- The checkout e2e (`tests/e2e/checkout.spec.ts`) fails about 1 run in 4; find the cause, don't just add retries.

**User rules still in force:**
- No push, no deploy (said in the first prompt of this session).
- Review rounds: fix only serious findings, at most 2 rounds (said after round 1).

## 2. Where everything ended

| Repo / folder | Branch | HEAD | Tree | Pushed | Production |
|---|---|---|---|---|---|
| `/Users/mara/code/ledgerline` | `fix/webhook-idempotency` | `a41d7e0` | clean | no (never pushed; no upstream) | untouched, `v2.14.1` live |

| Commit | What |
|---|---|
| `5c09b13` | Unique index on `payment_events.provider_event_id` + insert-or-skip in the handler |
| `9f3c2a1` | Review round 1 fixes (3 serious) |
| `a41d7e0` | `WIP: e2e isolation per worker [handoff 2026-11-03]`: 2 e2e still red |

**Tests at `a41d7e0`:** `npm test` **212/214** at 23:30 (run by me). The 2 failures are
`checkout.spec.ts › applies coupon` and `› refunds partial`, both from the half-done isolation change.

**Verified by me:** the double-charge reproduces on `main` with `scripts/replay-event.sh 3` and does not
reproduce on `a41d7e0`. **Only according to the review agents:** F3 below. **Unverified:** behaviour with
the provider's live sandbox (no credentials in this session).

**Running at shutdown:** review round 2 (`9f3c2a1..a41d7e0`) finished at 23:22. Nothing is fixed:

| Id | Verdict | Where | What | Suggested fix |
|---|---|---|---|---|
| F1 | CONFIRMED | `src/webhooks/payments.ts:88` | Event marked processed before the charge commits; a crash in between loses the event | Mark processed inside the same transaction |
| F2 | PLAUSIBLE | `src/webhooks/payments.ts:121` | Retry wrapper swallows the provider's 409 | Retry only 429 and 5xx |
| F3 | PLAUSIBLE | `tests/e2e/fixtures/db.ts:14` | Per-worker schema name collides when `TEST_WORKERS` is above 9 | Zero-pad the worker index |
| F4 | REFUTED | `src/lib/money.ts:40` | Rounding | n/a |

**Someone else's uncommitted work found:** none.

**Pending decisions for the user:**
1. Round 2 found F1 (serious). A) fix F1 and F2 now, then stop reviewing (recommended, ~40 min) · B) stop here and log both as known issues.

## 3. What changed

| File / area | What changed | Commit |
|---|---|---|
| `migrations/0042_payment_events_unique.sql` | Unique index on `provider_event_id` | `5c09b13` |
| `src/webhooks/payments.ts` | Insert-or-skip, retry wrapper, structured logs | `5c09b13`, `9f3c2a1` |
| `tests/e2e/fixtures/db.ts` | One schema per worker (half-done) | `a41d7e0` |

**Docs up to date:** `docs/payments.md` §3 describes the idempotency key.
**Deliberately not touched:** `main`, the deploy pipeline, the provider dashboard settings.
**Memory and status files updated at handoff:** project memory `ledgerline-webhook-idempotency`; lesson memory on platform limits.

## 4. What we tried that failed (don't repeat)

- **False premise about the function timeout.** Took "10 s per request" from an old forum answer, so I
  cut the provider call timeout to 8 s → legitimate slow charges got retried → that caused F2. The official
  platform docs say 60 s. **Instead:** read the official limits page before designing around a limit.
- **Retrying every error.** The first retry wrapper caught everything, including the provider's 409
  "already processed" → duplicate log noise and hidden conflicts. **Instead:** retry only 429 and 5xx.
- **Making the flaky e2e "pass" with retries.** `retries: 2` hid the failure → the real cause is that all
  workers share one test database. **Instead:** isolation per worker (the half-done `a41d7e0`).
- **`sed -i` on macOS.** `sed -i 's/a/b/' file` fails on BSD sed → needs `sed -i '' ...`. **Instead:** edit
  files with the file tool.
- **The handoff linter** flagged `<repo>` in step 3; replaced it with the absolute path and re-ran: OK.

## 5. Exact next steps

1. **Read** this handoff and `docs/payments.md`. Confirm `git -C "/Users/mara/code/ledgerline" status` is clean at `a41d7e0`, then run `npm --prefix "/Users/mara/code/ledgerline" test`: expected 212/214 (the 2 e2e above).
2. **Ask the user** decision 1 from section 2: A) fix F1 and F2 now · B) log them as known issues.
3. **Finish the e2e isolation:** zero-pad the worker index in `tests/e2e/fixtures/db.ts:14` (also closes F3), then `npm --prefix "/Users/mara/code/ledgerline" run e2e -- --workers=4` three times: expected 3 green runs.
4. **If A:** F1 at `src/webhooks/payments.ts:88` (mark processed inside the charge transaction) and F2 at `src/webhooks/payments.ts:121` (retry only 429/5xx), each with a failing test first. Check: `scripts/replay-event.sh 3` charges once.
5. **Local commit** per step; **no push, no deploy** without the user's OK in that turn.
6. **Ship (only with OK):** `git -C "/Users/mara/code/ledgerline" push -u origin fix/webhook-idempotency` and open a PR against `main`; the migration runs on deploy. Rollback: redeploy `v2.14.1` and drop index `payment_events_provider_event_id_key`.
7. Parked for later: currency formatting in receipts. Not requested yet; don't start.
