# Changelog

## 1.0.1 (2026-11-04)

- Start-of-session notice hardened against prompt injection from cloned repos: it ignores a HANDOFF.md that
  is tracked by git (the skill never commits one), passes only a known status word to the model, cleans and
  caps the title shown to you, and labels the file as data, not instructions.
- Resuming: the skill treats the handoff as a plan from an earlier session; anything in it that asks to push,
  deploy or send data needs your OK in the current session.
- 3 new regression probes for the above (57 in total).

## 1.0.0 (2026-11-04)

First public release.

- `/handoff` skill: freeze, evidence, local commit, HANDOFF.md with 5 sections, stop. Pushes only when the
  user asks in that turn ("/handoff and push"); never deploys. Also handles resuming ("continue from
  HANDOFF.md"): checks git against the handoff before acting.
- `scripts/repo-state.mjs`: branch, HEAD, worktree, dirty and suspicious files (and which were untouched
  since the session started), unpushed commits, commits since a time, secrets in changes, new files and
  unpushed commits, untracked secret files that are not git-ignored. Handles non-ASCII file names.
- `scripts/check-handoff.mjs`: language-agnostic linter for the handoff (sections, SHAs, numbered steps,
  placeholders, template holes, secrets, length, header time). `--minimal` for the short handoff written
  at a usage limit.
- Claude Code plugin with a SessionStart hook that announces a waiting handoff (`HANDOFF_NOTICE=off` to
  silence it, `HANDOFF_PATH` to point it elsewhere).
- `tests/run.mjs`: regression probes (`node tests/run.mjs`).
- English and Spanish READMEs.
