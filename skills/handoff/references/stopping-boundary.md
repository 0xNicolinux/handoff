# Stopping boundary: what to do with each thing that may be running

"Finish what you were doing" means closing the **unit** in progress, not the list. A unit is something
already launched whose complete result the next session needs: a review that is about to deliver
findings, a workflow that is about to deliver diffs, a test suite that is about to deliver numbers, a fix
to one file that is already half-written. "The next round", "the next bug in the table" or "while I'm at
it, also..." are NOT the unit in progress.

Rule for anything the table does not cover: **would leaving it like this force the next session to redo or guess?** If yes, and it
can be finished in ~15 minutes with a real check, finish it. If not, document it precisely (file:line,
what is missing, how to test it) and stop.

If the user says "stop now", "now", "halt": wait for nothing. Stop everything alive and record each
interrupted item in section 2 with the stage it had reached.

| What is running | How to detect it | What to do | What goes in the handoff |
|---|---|---|---|
| **Multi-agent workflow** | Its completion notice has not arrived; the agent or task list shows its agents | Wait for the notice: it is a unit. If it is running more than ~30 min past its estimate, or the user says "now", stop the workflow and its agents. Don't launch its next phase, don't "resume" it with another workflow. | Workflow id, the phase it finished or was cut at, where its script or journal lives, what it delivered (commits, files in temp folders: copy them to `.handoff/artifacts/`). |
| **Code review in the background** (a review command, a forked reviewer, reviewer subagents) | The agent list shows the reviewer and its children; the report arrives as a notice | Wait for the final report. Findings get tabulated, not fixed. If the reviewer's transcript has not moved for more than ~15 min, stop it and read the tail of its transcript to rescue what it reached. | Table: id, verdict (confirmed / plausible / refuted), file:line, what, suggested fix. Which round it was and the `base..head` range reviewed. Raw verdicts copied to `.handoff/artifacts/` if they only lived in a temp folder. |
| **A half-written change, fix or feature** (file edited, no test, or test red) | `git diff` of the repo | If a test for it already exists and it fits in ~15 min: finish, run the test, normal commit. If not: an honest `WIP:` commit, documented. Never leave your own changes uncommitted and never revert the work. | Section 2: "half-done: `file:line`, X missing, test Y". Section 5, step 1: how to finish it. |
| **Recurring loop** (self-scheduled wakeups) | This turn arrived from a wakeup; a prompt keeps repeating | Finish the current iteration, then cancel future wakeups. Never schedule another. | How many iterations ran, the original stop condition, what was left. |
| **Scheduled job / cron** | Your scheduler's list command | Delete the job belonging to this task. | Id and prompt of the deleted job, in case the user wants it back. |
| **Subagents** | Agent list; pending notices | Wait for the ones about to finish (transcript still moving). Idle for more than ~15 min: stop it, read the tail, record. Don't message agents that belong to a workflow: in some harnesses that spawns a duplicate. | Which agent, which task, what it delivered or where it stopped. |
| **Long tests in the background** (unit, e2e, mutation) | Pending background-task notice | Wait: the numbers go into section 2. If it was a mutation run that edits real source files, restore them from their copies before committing. | Exact numbers, time, the command used, the environment variables it needed. |
| **Servers you started** (dev servers, static servers, watchers) | Background processes of this session; `netstat -ano` / `lsof -i :<port>` | At the end of Phase 1: kill ONLY this session's PIDs (never the user's), and confirm the port is free. | The exact command to start it again (ports, flags, variables). |
| **Browser automation** | Tabs or contexts opened by the session | Close them. | Nothing, unless a tab was evidence (save a screenshot to `.handoff/artifacts/`). |
| **Test mutations in real source files** | `.bak` copies or a copies folder; `git diff` with changes that are not part of the fix | Restore from the copies, confirm `git diff` is free of mutations, delete the copies. | If something could not be restored: which file, from which copy. |
| **Open question to the user / unanswered A/B** | Your last message contains it and they did not answer | Nothing to execute. | Top of section 5: the question with its options, and what each answer unblocks. |
| **Push or deploy "almost ready"** | You were about to ask for the OK | It does not happen. It is never part of the unit in progress. | Section 5: the exact command, the rollback id, and "only with the user's OK in that turn". |
| **Goal or stop-blocking hook** (a hook that rejects stopping until a condition holds) | The hook bounces your stop asking you to continue | You can't clear it. The goal, verbatim, goes into section 1 as "still active". In the final message, say it is still active and that the user clears it. If the hook bounces again, repeat only the final message; don't resume work. | The literal goal text and which part of it was met. |
| **Usage or context limit nearly reached** (a warning in the turn, a meter above ~90%) | The warning itself | Minimal mode: the local commit first (quick, and section 2 needs its HEAD), then a short handoff (sections 1, 2 with HEADs, 5 with three steps) saved and linted with `check-handoff.mjs --minimal` before anything else. A running unit still gets to finish if it reports within a few minutes; stop it only if the limit actually arrives. Expand the handoff if budget remains. | That it closed at the limit, the percentage and reset time if known, what got interrupted. |
| **Another session working on the same repo** (another account, machine or agent) | Dirty files you don't recognise; recent commits by another author; the agent list shows other local sessions | Don't touch their files or commits. Your commit carries only your files. | Section 2, "someone else's uncommitted work": the files, and which session probably left them. |
