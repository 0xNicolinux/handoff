# Contributing

Thanks for helping. This skill is small on purpose, so the bar for adding things is "does it stop a real
session from losing work or repeating a mistake?"

## Good contributions

- **A new row for the stopping boundary** (`skills/handoff/references/stopping-boundary.md`): a kind of
  running work the skill doesn't know how to stop cleanly yet. Say how to detect it, what to do, and what
  goes into the handoff.
- **A linter rule** (`skills/handoff/scripts/check-handoff.mjs`) for a gap you have seen in a real handoff.
  Keep it language-agnostic: section headings in any language must keep working.
- **A secret pattern** both scripts should catch.
- **Bug reports** with the command you ran, your OS, and the output.

## Ground rules

- No runtime dependencies. Node 18+ standard library only.
- The skill never deploys, never pushes unless the user asks in that turn, and never touches work it
  didn't make. Changes that weaken that won't be merged.
- Before a pull request, run `node tests/run.mjs` (it must end with 0 failed) and add a probe for the bug
  you fixed.
- Keep `SKILL.md` around 300 lines; detail belongs in `references/`.
- Bump `version` in `.claude-plugin/plugin.json` and add a CHANGELOG entry with every release, or installed users won't get the update.
- If you change the template, update `example-handoff.md` and make sure it still passes:
  `node skills/handoff/scripts/check-handoff.mjs skills/handoff/references/example-handoff.md`
- If you change the demo, edit `assets/src/build-demo.mjs` and regenerate `assets/demo.svg` with
  `node assets/src/build-demo.mjs`. The banner and social card come from `assets/src/*.html`; regenerate
  them with `assets/src/render.mjs` (instructions at its top; it needs Playwright, a dev-only tool).

## Sharing a handoff

Real handoffs make the best examples. If you share one in an issue or discussion, remove secrets, internal
hostnames and anything personal first.
