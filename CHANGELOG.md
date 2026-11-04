# Changelog

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
- `tests/run.mjs`: 54 regression probes (`node tests/run.mjs`).
- English and Spanish READMEs.
