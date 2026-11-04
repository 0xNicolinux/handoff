# HANDOFF.md template

Copy everything from the `---` line below to the end and replace every `{{...}}`. The linter rejects any
`{{...}}` left behind, and real markers such as `TODO:`, `[TBD]` or `<FIXME>`. The italic notes under
each heading say what belongs there; delete them as you fill it in. Write the handoff in the language the
user speaks to you; keep the five numbered headings (`## 1.` to `## 5.`) in that order.

---
type: handoff
title: "HANDOFF: {{project}}: {{task in one line}}"
project: {{project or repo name}}
created: {{YYYY-MM-DD}}
updated: {{YYYY-MM-DD}}
status: {{PAUSED | STOPPED BY USER | STOPPED AT USAGE LIMIT | DONE, WAITING ON USER}}
session: "{{session id, if your agent exposes one}}"
machine: "{{hostname}}"
tags: [handoff, {{project}}, {{topic}}]
---

# HANDOFF: {{project}}: {{task}} (RESUME HERE)

> Written {{YYYY-MM-DD HH:MM, the output of `date` right before saving}} on {{machine}}{{, session `id` if any}}.
> Resume: open a session in `{{absolute path}}` and say *continue from HANDOFF.md*{{; on this machine you can also run `claude --resume <id>`}}.
> Also read: {{repo docs that matter, runbook, the user's notes}}.
> Earlier handoffs still open: {{link to .handoff/archive/... or "none"}}.

## 1. Goal

*The user's literal request (the prompt or goal, in quotes). Below it, in bullets, what it turned into
concretely. At the end, the user's rules that still apply to this task (no push or deploy without OK,
review-round cap, forbidden names, untouchable folders, language and tone), each with its source. If a
goal or stop-blocking hook is active, say it is still active and that the user clears it.*

**Literal request:** {{...}}

**Concretely:**
- ...

**User rules still in force:**
- ...

## 2. Where everything ended

*First the repos table. Then tests with numbers and time. Then what I verified versus what agents claimed.
Then the result of whatever was running at shutdown (if it was a review: the findings table, unfixed).
Last, the user's pending decisions with A/B.*

| Repo / folder | Branch | HEAD | Tree | Pushed | Production (live deploy, rollback) |
|---|---|---|---|---|---|
| `{{absolute path}}` | `{{branch}}` | `{{7 hex}}` | {{clean / WIP: what / untracked left on purpose: files}} | {{no / yes @sha (only if the user asked)}} | {{deploy id, rollback id / n/a}} |

**Tests:** {{npm test N/N at HH:MM; e2e ...; not re-run at handoff: last known ...}}

**Verified by me:** ... · **Only according to agents:** ... · **Unverified:** ...

**What was running at shutdown and how it ended:** {{workflow / review / loop, and its result; or "nothing"}}

| Id | Verdict | Where | What | Suggested fix |
|---|---|---|---|---|
| ... | ... | `file:line` | ... | ... |

**Someone else's uncommitted work found (not touched):** {{files and probable session, or "none"}}

**Pending decisions for the user:**
1. {{question}}: A) ... (recommended) · B) ...

## 3. What changed

*Table per file or area. Docs updated. What was deliberately NOT touched, and why.*

| File / area | What changed | Commit |
|---|---|---|
| `{{path relative to the repo}}` | ... | `{{sha}}` |

**Docs up to date:** ...
**Deliberately not touched:** ...
**Memory and status files updated at handoff:** {{project memory, lessons, STATUS file, or "agent has no memory"}}

## 4. What we tried that failed (don't repeat)

*One bullet per failure, four parts: what was tried, what happened, why (the real cause), what to do
instead. False premises, tools that bit, fixes that created new bugs, commands that fail on this machine,
platform limits remembered wrong, and stumbles of the handoff itself.*

- **{{Short name of the failure}}.** Tried ... → got ... → because ... → **instead:** ...

## 5. Exact next steps

*Numbered list. Unblocking first (questions with A/B, missing approvals), then the work in order, optional
last. Every step with the full command (absolute path in EVERY step, never `<repo>`), the file:line or the
exact question, and how to check it worked. A/B only for what truly blocks; what the request already
authorises and is safe is a step, not a question. Things parked "for later" go in ONE line. Say what needs
the user's OK.*

1. **Read:** this handoff and {{docs}}. Confirm `git -C "{{absolute repo path}}" status` is clean at `{{sha}}` and, if the suite takes under 2 minutes, re-run it: `npm --prefix "{{absolute repo path}}" test`, expected {{N/N}}.
2. **Ask the user:** {{...}}: A) ... · B) ...
3. **If A:** ...
   ```
   {{exact command}}
   ```
   Check: ...
4. **Local commit** after each step; **no push or deploy** without the user's explicit OK in that turn.
5. **Update:** this handoff, the project memory, the status file.
6. **Ship (only with OK):** {{deploy command}} · rollback `{{id}}` · verify live: ...
