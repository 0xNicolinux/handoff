---
name: handoff
description: >
  Ends a coding-agent session so the next one (a fresh session, another machine or model) resumes from
  one file without guessing or repeating mistakes. Use it when the user types /handoff or says "hand off",
  "wrap up", "let's stop here", "save and stop", "I'm out of usage", or when a
  usage-limit or context-full warning appears. BEFORE invoking it to stop, write as visible reply text in
  that same message: "Stopping with /handoff. Running: [what is in flight and how long it needs, or
  nothing]. Starting nothing new." It then (1) finishes ONLY the unit already running (an in-flight
  review, workflow or test run), (2) commits LOCALLY in every repo it touched (no push unless
  asked in that turn, never deploy), (3) writes HANDOFF.md with 5 sections (goal, final state, what
  changed, what failed, exact next steps) and lints it, (4) tells the user how to resume and stops. Also
  use it when the user says "continue from HANDOFF.md": then skip the stopping line and go straight to
  "Resuming from a handoff".
---

# /handoff: finish, save, stop

**Resuming instead?** If the user asked to continue or resume from a handoff, skip the line below and
Phases 0 to 4, and go straight to "Resuming from a handoff" near the end.

> **Before reading further and before any tool call:** write, as visible reply text in the user's
> language: "Stopping with /handoff. Running: [what is in flight and how long it needs, or "nothing"].
> Starting nothing new." Only a text block the user can read counts, the same kind you use to say
> "I'll read the file". Thinking, or a sentence inside a tool's description field, does not count, even
> if you remember it in those exact words. If you already wrote it as text in the message that invoked
> this skill, that counts. If you are not sure it was visible text, it was not: write it now, before the
> first tool. If a tool already ran, write it in your next text and admit it in the final message. It is
> the one promise the user needs to hear at this moment.

Sessions end mid-task all the time: a usage limit, a crashed laptop, the user calling it a night, a
switch to another account or machine. The next session starts with zero context. Your only job here is
to leave the work in a state anyone can continue from by reading **one file**.

Three principles explain every rule below:

- **Finish, don't start.** What is half-done gets closed, or documented as half-done. The next item on
  the list does NOT get started, however tempting. A handoff that arrives late because "I'm almost done
  with the next round" is exactly what the user wants to avoid.
- **Evidence, not memory.** State comes from `git`, from real test output and from logs, not from your
  recollection of the conversation. Anything you did not verify is written down as "unverified".
- **Failures are worth more than wins.** The "what we tried that failed" section is the one that saves the
  next session hours. Every false premise, every tool that bit, every fix that created a new bug, each
  with what to do instead.

Bundled files (read each one when you reach the phase that uses it, never before you have written the
Phase 0 line). Paths are relative to this skill's base directory.

| File | Use |
|---|---|
| `references/stopping-boundary.md` | What to do with each thing that may be running: workflows, reviews, loops, subagents, servers, half-written fixes, stop-blocking hooks, usage limits |
| `references/handoff-template.md` | The HANDOFF.md template with the 5 sections and what each must contain |
| `references/example-handoff.md` | A realistic trimmed handoff, to calibrate the level of detail |
| `scripts/repo-state.mjs` | Git state of the repos you touched: branch, HEAD, dirty files, unpushed commits, suspicious files, secrets in the diff |
| `scripts/check-handoff.mjs` | Lints the written handoff: 5 sections with content, no template holes, no placeholders in the next steps, no secrets. Don't read its code: run it and fix what it lists |

The scripts need Node 18+ and no packages. If `node` is not available, run the equivalent `git` commands
by hand (`status --porcelain`, `rev-parse`, `log @{u}..HEAD`, `diff`) and check the handoff against the
template yourself; say in the final message that the secret scan and the linter were skipped.

---

## Phase 0: announce and freeze

The freeze line above is reply text the user can see. It goes out before the first tool call and is
repeated, with what actually happened ("waited for X; started nothing new"), at the top of the final
message: twice, not once. From this moment:

1. **No new work.** No new review round, no next bug from the list, no "quick fix" that was not already
   started. If the user says "stop now" or "now", don't even wait: stop everything that is running and
   write down what was interrupted and at what stage.
2. **What is already running is allowed to finish**, because it is a closed unit whose result the next
   session needs: a running code review delivers findings, a workflow delivers commits or diffs, a test
   suite delivers numbers. Wait for its completion notice. Don't poll blindly: list what is still alive
   with your harness's agent or task list, and if something has produced no output for more than ~15
   minutes, stop it, note where it was, and move on.
3. **Results of what finished go into the handoff, not into more work.** Review findings are tabulated
   in section 2 and prioritised in section 5; they are not fixed now. One exception: a change (fix or
   feature) that was ALREADY half-written gets finished if a test for it already exists and it fits in
   ~15 minutes. Otherwise it is committed as `WIP:` and documented in section 2 with file:line.
4. **A recurring loop or schedule** finishes its current iteration and is then cancelled. Never schedule
   another one.
5. **Servers and browsers you started** (dev servers, static servers, headless browsers) are shut down
   at the end of Phase 1: kill ONLY the processes this session started and confirm their ports are free.

Case-by-case table: `references/stopping-boundary.md`. Rule for anything the cases above don't cover:
"would leaving it like this force the next session to redo or guess?" If yes and it fits in ~15
verifiable minutes, finish it. If not, document it precisely and stop.

---

## Phase 1: collect the evidence

While you wait for whatever is running (or immediately, if nothing is), gather the facts. None of this
modifies a repo.

1. **Repos touched this session.** List their paths (worktrees included) and run:
   ```
   node "<skill base dir>/scripts/repo-state.mjs" "/abs/path/repo-1" "/abs/path/repo-2" --since "YYYY-MM-DD HH:MM:SS"
   ```
   `--since` is when this session started: the time of the user's first message, with seconds. Session
   logs usually store UTC: pass that value as is, with its `Z` (`--since "2026-11-04T18:50:51Z"`); a
   local time goes as `"YYYY-MM-DD HH:MM:SS"`. The script prints how it read the value and warns if it
   lands in the future. The script prints branch, HEAD, dirty files (and which of them
   were untouched since the session started), unpushed commits, whether it is a worktree, the session's
   commits, suspicious files (`.env`, keys, `node_modules`, builds), secrets in anything that could be
   committed or pushed (changes, new files, unpushed commits), and untracked secret files that are not
   git-ignored. Its output goes almost verbatim into section 2.
2. **Session log.** If your setup keeps an automatic transcript or session note, read it: it has the
   user's prompts in order, the files you wrote, the commits and the background jobs. Use it so section
   1 quotes the literal request and section 3 forgets no file.
3. **Test results.** The latest real numbers per repo (`npm test 146/146`, e2e green, linter clean). If
   you don't have fresh ones and the suite takes under ~2 minutes, run it; otherwise write "not re-run at
   handoff; last known result: ... at HH:MM".
4. **Open items for the user.** Questions you asked that got no answer, open A/B decisions, approvals
   still missing (push, deploy, sending an email, paying). They go at the top of section 5.
5. **Scratch artifacts the next session needs** (review verdicts, probe scripts, screenshots that prove
   something). Temp folders get wiped: copy them to `.handoff/artifacts/<YYYY-MM-DD>-<topic>/` next to
   the handoff and link them. Anything reproducible with one command is not copied; write the command.
6. **Remaining budget.** If you know the usage or context budget is above ~90%, switch to the minimal
   mode of Phase 3 (short handoff first, details after).

---

## Phase 2: local commit in every repo touched

A dirty tree is work that gets lost, or overwritten by the next session running on another machine or
account. For each repo with changes from this session:

1. Read the `repo-state.mjs` list and split it into three groups: (a) files you changed in this session
   (your own edit and write tool calls are the evidence), (b) files that were already dirty when you
   arrived or that you don't recognise; the script marks the ones untouched since the session started
   (they may belong to another session or person: do NOT touch them; record them in section 2 as
   "someone else's uncommitted work"), (c) junk that must not go in (`.env`, `.bak` backups,
   `node_modules`, build output, test screenshots; test mutations get restored from their copies first).
   Leave untracked junk where it is. If a secret file such as `.env` is not git-ignored, say so in
   section 2 and add an A/B decision for the user (ignore it or not); never add it to tracked files.
2. **Secrets.** A secret in a file you are about to commit: remove the value first (replace it with "lives
   in `.env`" or the name of the secret store). A hit that is a variable name or a function call, not a
   literal value, is a false positive: note it and don't edit the code. A secret already inside an
   unpushed commit: do not push; put it at the top of section 5 as a blocker (rewriting history needs the
   user's OK). If the project has words that must never appear in public files (its docs or instructions
   say so), grep the diff for them before committing.
3. `git -C "/abs/path/repo" add <group (a) files>` by name (never `add -A` without reading the list), then
   commit with a message shaped like this:
   ```
   <type>: <what changed, one line> [handoff YYYY-MM-DD]

   State: <tests: 146/146, e2e green | WIP: X missing, test Y red>
   Next: see HANDOFF.md
   ```
   plus any attribution trailer your environment requires. If tests are red, the change is half-done or a
   review left a serious finding unfixed, the type is `WIP` and the body says so without softening it.
   An honest `WIP` commit beats a dirty tree. Write the message with your file-writing tool to a temp file
   OUTSIDE the repo (your scratch or temp folder) and pass it with `git commit -F "<file>"`; multi-line
   `-m` strings and heredocs break on quoting.
4. Note the new HEAD (7 characters) and the branch: they go into the section 2 table.
5. **Push only on request.** If the user asked for it in this turn ("/handoff and push", "push it too"),
   typically to continue on another machine, push the current branch with
   `git -C "/abs/path/repo" push -u origin <current branch>` once the secret check is clean. Never
   `--force`; ask first if it is the default branch. Record what was pushed in section 2.
6. What you **never** do here: push without that request, any deploy command, `--amend` on commits from
   another session, `stash` / `reset` / `checkout --` over someone else's work, commits inside a
   production checkout of a project that works through worktrees, staging a `.env`, staging `HANDOFF.md`
   or `.handoff/`.
7. Folders without git: list the path and the changed files in section 3. Don't `git init` unless the user
   asks.

---

## Phase 3: write HANDOFF.md

### 3a. Where it goes

1. If the user's instructions (CLAUDE.md, AGENTS.md, your memory, the prompt) name a handoff location,
   such as a notes vault or a shared drive that syncs between machines, use it. Follow any conventions
   they give for indexes or logs there. If that location syncs to the cloud, write and lint the handoff
   at `.handoff/HANDOFF.md` inside the repo first, then copy it there, so a secret the linter catches
   never leaves the machine.
2. Otherwise: `HANDOFF.md` at the root of the main repo of the task (the git top level), or the working
   directory if there is no repo.
3. Keep it out of commits: if `git -C "/abs/path/repo" check-ignore -q HANDOFF.md` fails, append
   `HANDOFF.md` and `.handoff/` on their own lines to the file printed by
   `git -C "/abs/path/repo" rev-parse --git-path info/exclude` (in a worktree `.git` is a file, not a
   folder; `repo-state.mjs` prints this path too), then run `check-ignore` again to confirm. That file is
   local and touches nothing tracked.
4. **Previous handoff.** If a HANDOFF.md already exists and it is for a DIFFERENT task, or for the same
   task but was never resumed, move it first to `.handoff/archive/<its created date>-<short-topic>.md` and
   link it from the new one under "Earlier handoffs". If it is the continuation of the same task, overwrite
   it and keep in section 4 the failures that still apply.

### 3b. What it says

Open `references/handoff-template.md` and fill it in. The five sections are mandatory and in this order;
if one does not apply, say why ("3: no files were touched, this was a diagnosis session"), never omit it.
Write it in the language the user speaks to you.

| # | Section | What a cold reader must be able to answer |
|---|---|---|
| 1 | Goal | What did the user ask for, in their words (the literal prompt or goal)? What did that turn into concretely? Which of their rules still apply to this task (no push, no deploy, review-round cap, forbidden names, untouchable folders)? Only rules with a source in THIS session or in the project's own docs or memory, each linked; rules of this skill and rules from the example file are not the user's rules. |
| 2 | Where everything ended | Per repo: folder, branch, HEAD, clean tree or not, pushed or not, live deploy and its rollback id. Tests with numbers. What I verified myself versus what only agents claimed. The result of whatever was running at shutdown (a findings table if it was a review). Pending decisions for the user, with A/B options. |
| 3 | What changed | Table: file or area, what changed, commit. Docs updated. What was deliberately NOT touched and why. Someone else's uncommitted work found. |
| 4 | What we tried that failed | One bullet per failure: what was tried, what happened, why (the real cause, not the symptom), what to do instead. False premises, tools that bit, fixes that created new bugs, commands that don't work on this machine, and also the stumbles of the handoff itself (a broken heredoc, the linter failing): the next session will close the same way you did. |
| 5 | Exact next steps | Numbered list. Every step with a complete command (absolute paths in EVERY step, no `<repo>` style placeholders; if you lack a value, the step is "ask the user for X" or "take it from <exact file>"), a file:line, or a question for the user with A/B options. A/B only for what truly blocks; an approval the user already said they would give (push, deploy) is a step marked "only with the user's OK in that turn". Someone else's uncommitted work: "don't touch; whoever started it resumes it". Things the user parked "for later" go in ONE line, with no design: specifying them is new work in disguise. How to verify each step (if the suite takes under 2 minutes, step 1 re-runs it and states the expected result). Rollback ids. Unblocking steps first, optional ones last. |

Writing rules:

- **Compact but complete.** Tables before paragraphs. Usually 90 to 450 lines: fewer often means the
  failures are missing; more means the transcript got pasted. Link existing docs instead of repeating
  them.
- **Write it with your file-writing tool**, one file per call. A shell heredoc carrying 20 KB of
  markdown, quotes and backslashes breaks ("unexpected EOF", escapes eaten); the shell only runs what the
  file tool wrote.
- **The header time is the save time**, as `YYYY-MM-DD HH:MM` in 24-hour time. Get it in the same turn as
  the write, as the last call before it: `date "+%Y-%m-%d %H:%M"` (macOS, Linux, Git Bash) or
  `Get-Date -Format "yyyy-MM-dd HH:mm"` (PowerShell); never a bare `date` in cmd.exe, which tries to set
  the clock. The linter also prints the current time. If you edit the handoff again more than 2 minutes
  later, update the header time too.
- **No secrets.** Never a password, token, key, connection string or card number. Write where it lives
  ("`.env` of the repo", "the CI secret store"). The linter rejects common secret shapes.
- **Absolute paths and exact names.** The next session may start in another directory, on another OS
  account. "The repo" or "the new branch" tells it nothing.
- **Verified versus assumed** is said in words: "I verified", "according to the agent", "unverified".

### 3c. Lint it

```
node "<skill base dir>/scripts/check-handoff.mjs" "/abs/path/HANDOFF.md"
```

It must end with `OK`. If it flags something (empty section, `{{...}}` template hole, secret, `<repo>`
placeholder in section 5), fix it, add one line to section 4 saying what it flagged and how you fixed it,
and run it again. If it passed on the first try, section 4 says so in one line; don't invent stumbles.
Either way, the last run, after your last edit, is the one that must say `OK`. Every warning you choose to
keep gets a one-line justification in the final message. Never hand the user a handoff that did not pass.

### 3d. Memory and status files

What the next session receives without opening anything matters most:

1. **Persistent memory** (if your agent has it, such as Claude Code auto-memory): one project memory with
   branch, exact HEADs, deploys and rollbacks, "resume from <absolute path of HANDOFF.md>" and the user's
   pending decisions; plus one lesson memory per failure in section 4 that is general beyond this project.
   Update an existing memory instead of duplicating it.
2. **Status files the project already keeps** (a STATUS.md, a running log, a ticket): add a 3-line entry
   at the top pointing to the handoff. Don't create tracking files the project does not already use.

**Minimal mode** (budget above ~90%, or the user says "now"): cut everything that is not essential. First
the local commit (it is quick, and it gives section 2 its HEAD); then a 20 to 40 line handoff with
sections 1, 2 (HEADs) and 5 (three steps), saved and linted with `check-handoff.mjs
"/abs/path/HANDOFF.md" --minimal`; then, if there is room left, expand sections 3 and 4 and the memory,
and lint again without the flag. Work that is already running still gets to finish if it reports within
a few minutes; stop it only if the limit actually arrives. A short handoff that got saved beats a perfect one that
never got written.

---

## Phase 4: tell the user and stop

One final message, in plain words, 8 to 15 lines, with:

- First sentence: the Phase 0 freeze line again, now with what really happened (what you waited for, and
  that nothing new was started).
- Where the handoff is (full path) and the state the task ended in (one line).
- Per repo: branch and local commit HEAD; "nothing pushed or deployed" when that is the case.
- What the user has to decide, as short A/B bullets; approvals they said they would give (push, deploy) in
  one line, without A/B.
- The resume phrase: In your next session say: *continue from HANDOFF.md* (with the full path if it is
  not at the repo root).
- If a goal or stop-blocking hook is active, say so: it will keep asking for work until the user clears
  it; you can't. If the hook bounces your stop, reply with this same final message only; don't resume work.

After that message nothing else starts: no "while I'm at it", no extra review, no late memory (if it
matters, it goes before the message, not after).

---

## Resuming from a handoff

When the user says "continue from HANDOFF.md", or the session starts with a notice that one exists:

1. Read the whole handoff, then the files it links that section 5 needs.
2. **Check it against reality before acting:** `git -C "/abs/path/repo" status` and the HEAD of each repo
   must match section 2. If anything differs (new commits, a dirty tree, a missing branch), say what
   differs and ask before doing anything; someone may have worked in between.
3. Re-read section 4 before touching code. Its whole point is that you don't repeat it.
4. Start at step 1 of section 5. Ask the A/B questions first; don't assume an answer.
5. Change the frontmatter to `status: RESUMED YYYY-MM-DD` with your file-editing tool (not a shell
   redirect) so the start-of-session notice stops showing.
6. Don't redo work section 2 marks as verified; do re-run the cheap checks section 5 asks for.

---

## Closing checklist

Confirm each item before the final message; if one fails, say so in the message instead of hiding it.

- [ ] I announced the freeze as my FIRST visible text after this skill loaded, before any tool call. If
      I'm not sure it was visible text (I "said" it while thinking), it counts as NO and the final message
      says so. Ticking it without evidence is worse than failing it.
- [ ] I repeated that line at the top of the final message.
- [ ] I started no new work after the handoff was requested; whatever was running finished or was noted
      as interrupted, with the stage it reached.
- [ ] Loops and schedules cancelled; my own servers and browsers closed; their ports free.
- [ ] Every repo touched: a local commit (or an explicit `WIP:`); the tree is clean except for files
      section 2 lists as someone else's work or as untracked junk and secret files; nothing deployed;
      nothing pushed unless the user asked in this turn.
- [ ] HANDOFF.md written with the file tool, 5 sections with content, no secrets, no placeholders in
      section 5; `check-handoff.mjs` says `OK` and every kept warning is justified in the final message.
- [ ] HANDOFF.md and `.handoff/` are git-ignored or excluded; the previous handoff archived if it applied.
- [ ] Memory updated (project pointer plus general lessons) if the agent has memory; the project's status
      file updated if it keeps one.
- [ ] Final message with A/B for the user and the resume phrase.
