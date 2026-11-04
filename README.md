<p align="center">
  <img src="assets/banner.png" alt="/handoff: Stop mid-task. Lose nothing. A Claude Code skill that finishes what's running, commits locally, and leaves one file the next session can trust." width="100%">
</p>

<p align="center">
  <a href="#install"><img alt="Claude Code plugin" src="https://img.shields.io/badge/Claude_Code-plugin-138840?style=flat-square"></a>
  <a href="skills/handoff/SKILL.md"><img alt="Agent Skills: SKILL.md" src="https://img.shields.io/badge/Agent_Skills-SKILL.md-0b100c?style=flat-square"></a>
  <img alt="Zero dependencies" src="https://img.shields.io/badge/dependencies-0-138840?style=flat-square">
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-0b100c?style=flat-square"></a>
</p>

<p align="center">
  <b>English</b> · <a href="README.es.md">Español</a>
</p>

**`/handoff` is a Claude Code skill for when a session has to end mid-task.** It lets the work already running finish, commits locally, and writes one `HANDOFF.md` that a cold session can resume from without guessing. Then it stops. It runs in any agent that reads `SKILL.md`.

Without it, hitting the usage limit mid-task means tomorrow's session starts from zero: it re-reads the code, re-runs the tests and retries what already failed yesterday.

```
/plugin marketplace add asalazarvaldiviaocg/handoff
/plugin install handoff@handoff
```

<p align="center">
  <img src="assets/demo.svg" alt="Terminal demo: /handoff waits for a running review, checks repo state, makes a local WIP commit, writes and lints HANDOFF.md. Next morning a fresh session finds the handoff, checks git, reads what failed and asks the first question." width="100%">
</p>

## What happens when you run it

Type `/handoff`, or say *"wrap up"*, *"let's stop here"* or *"I'm out of usage"*.

| Phase | What it does | What it refuses to do |
|---|---|---|
| **0. Freeze** | Tells you in one line what is still running and how long it needs. Lets that unit finish: a code review delivers its findings, a workflow its diffs, a test suite its numbers. | Start the next bug, the next review round, or "one quick fix". |
| **1. Evidence** | Reads the real state: branch, HEAD, dirty files, unpushed commits, secrets in changes and commits, the latest test results. | Trust its memory of the conversation. |
| **2. Commit** | Commits the files it edited this session, by name, in every repo it touched. Red tests become an honest `WIP:` commit. | Deploy. Push, unless you asked in that turn. Touch files it didn't edit. Stage a `.env`. |
| **3. Write** | Writes `HANDOFF.md` with five sections and runs a linter on it. | Hand you a file with empty sections, `{{template}}` holes or `<repo>` placeholders. |
| **4. Stop** | Tells you where the file is, what you need to decide, and the exact phrase to resume. | Keep working after that message. |

## The five sections

Every handoff has the same shape, written in your language:

| # | Section | It answers |
|---|---|---|
| 1 | **Goal** | What you asked for, quoted, and the rules you set (no push, no deploy, review-round cap). |
| 2 | **Where everything ended** | Per repo: branch, HEAD, clean or not, pushed or not. Tests with numbers. What was verified versus what an agent only claimed. |
| 3 | **What changed** | File by file, with the commit. What was deliberately left alone. |
| 4 | **What we tried that failed** | Each dead end with its real cause and *what to do instead*. |
| 5 | **Exact next steps** | Numbered, with full commands and absolute paths. Your open decisions first, as A/B. |

Section 4 is why this exists. It lists each dead end with its cause so the next session doesn't retry it. From the [example handoff](skills/handoff/references/example-handoff.md):

> **False premise about the function timeout.** Took "10 s per request" from an old forum answer, so I cut the provider call timeout to 8 s → legitimate slow charges got retried → that caused F2. The official platform docs say 60 s. **Instead:** read the official limits page before designing around a limit.

## Pick up where you left off

Open a session in the same folder and say:

```
continue from HANDOFF.md
```

The agent checks the file against reality first (does HEAD still match section 2? is the tree clean?), reads section 4 before touching code, asks your pending A/B questions, then starts at step 1. With the plugin installed, a new session tells you a handoff is waiting before you ask:

```
Handoff waiting: ledgerline: idempotent payment webhook (STOPPED AT USAGE LIMIT, 9 h ago). To pick it up, say: continue from HANDOFF.md
```

**Switching machines?** Keep handoffs in a folder that syncs (see [Configuration](#configuration)) and say *"/handoff and push"*: it pushes the current branch after the secret check, never with `--force`, and asks first if it is the default branch.

## Install

**Claude Code plugin** (includes the start-of-session notice):

```
/plugin marketplace add asalazarvaldiviaocg/handoff
/plugin install handoff@handoff
```

**Any agent that reads `SKILL.md`** (Claude Code, Codex, Cursor, Gemini CLI and others), with the [skills CLI](https://skills.sh):

```
npx skills add asalazarvaldiviaocg/handoff
```

**Manual:** copy one folder.

```bash
git clone https://github.com/asalazarvaldiviaocg/handoff
mkdir -p ~/.claude/skills && cp -r handoff/skills/handoff ~/.claude/skills/
```

```powershell
# Windows PowerShell
git clone https://github.com/asalazarvaldiviaocg/handoff
New-Item -ItemType Directory -Force "$HOME\.claude\skills" | Out-Null
Copy-Item -Recurse handoff\skills\handoff "$HOME\.claude\skills\"
```

The helper scripts, the secret scan and the start-of-session notice need **Node 18+** on your PATH. Without Node, the skill falls back to plain `git` commands and tells you the secret scan and the linter were skipped.

## Why not just `/compact` or `claude --resume`?

They solve different problems. Use them too.

| | `/compact` | `claude --resume` | `/handoff` |
|---|---|---|---|
| A teammate or another agent can pick it up | No | No, it's your transcript | **Yes, it's a plain file: share it, or keep handoffs in a synced folder** |
| Another machine can pick it up | No | Only if you copy the transcript | **With a synced folder and `/handoff and push`** |
| Waits for in-flight reviews, workflows, tests | No | No | **Yes** |
| Leaves your work committed | No | No | **Yes, locally** |
| Keeps a dedicated record of what failed | Sometimes, inside a summary | Buried in the transcript | **Section 4** |
| Cost to pick it up the next day | n/a | Reloads the whole conversation | **Reads one file of a few KB** |
| Checked for gaps before you rely on it | No | No | **Linter** |

**Other handoff skills** mostly write a summary file. This one also waits for work in flight, commits WIP per repo, leaves other people's files alone, lints its own output and announces itself to the next session. It does not trigger on its own at a usage percentage; if you want that, have your status line or a hook tell the agent to run `/handoff` at around 90%.

## What it never does

- **Deploy.** Ever. It writes the exact command and the rollback into section 5 instead.
- **Push without being asked.** Only *"/handoff and push"* (or your OK in that turn) does it, and a secret found in an unpushed commit blocks it.
- **Touch files it didn't edit.** It commits its own files by name, never `git add -A`. Every other dirty file is listed and left alone; files untouched since the session started are flagged as probably someone else's.
- **Let a secret slip quietly.** It scans the changes, the new files and every commit not yet on the remote (one by one, so a key added and later deleted still counts) before committing, flags `.env` files that aren't git-ignored, and scans `HANDOFF.md` before handing it to you.
- **Put `HANDOFF.md` in your history.** It goes into `.git/info/exclude`, which is local and changes no tracked file.

## Configuration

**Where the handoff goes.** By default, `HANDOFF.md` at the root of the repo you were working in. To keep handoffs somewhere that syncs between machines (an Obsidian vault, a shared drive), add one line to your `CLAUDE.md` or `AGENTS.md`:

```
Handoffs go to: /Users/you/notes/handoffs/HANDOFF.md
```

For the start-of-session notice to look there too, set `HANDOFF_PATH` to that absolute path, in your shell profile or in the `env` block of `~/.claude/settings.json`.

**Turning the notice off.** Set `HANDOFF_NOTICE=off` the same way.

## What's in the box

```
skills/handoff/
├── SKILL.md                         the procedure the agent follows
├── references/
│   ├── stopping-boundary.md         what to do with each kind of running work
│   ├── handoff-template.md          the 5-section template
│   └── example-handoff.md           a realistic filled-in handoff
└── scripts/
    ├── repo-state.mjs               branch, HEAD, dirty files, unpushed commits, secrets
    └── check-handoff.mjs            the handoff linter (--minimal for the short version)
hooks/session-start.mjs              "Handoff waiting" notice when a session starts
tests/run.mjs                        54 regression probes (node tests/run.mjs)
```

## FAQ

**Does it work outside Claude Code?** The skill is a standard `SKILL.md`, so any agent that supports Agent Skills can run it. The start-of-session notice is a Claude Code hook; elsewhere, just say "continue from HANDOFF.md".

**Will it commit `HANDOFF.md` into my repo?** No. It is excluded locally. If you *want* it versioned, say so in your `CLAUDE.md`.

**What if something is still running when I call it?** It waits for that one unit to finish and starts nothing new. Say *"stop now"* and it won't wait at all: it stops everything and records what was interrupted.

**I'm at 99% usage. Is there time?** Minimal mode: the local commit, then a 20 to 40 line handoff with the goal, the HEADs and three next steps, saved and linted (`--minimal`) first. Sections 3 and 4 come after, if there is budget left.

**How many tokens does it cost?** Loading the skill is about 5.5k tokens. The three reference files it reads along the way add about 4.4k. On top of that: a few `git` commands, the test run if it is fast, and writing the handoff itself, usually a few thousand tokens. Minimal mode skips most of it.

## Where it came from

It started as a private skill for a setup that breaks sessions constantly: two machines, one shared notes vault, and usage limits that land mid-task. Most rules in it come from something that went wrong:

- **"Wait for the running review"**: a multi-agent code review got cut off when only its final report was missing.
- **"Read the official docs before designing around a limit"** (the kind of line section 4 is for): a ten-second timeout remembered from a forum answer caused four bugs. The real limit was sixty.
- **"Write the handoff with the file tool, not a shell heredoc"**: twenty kilobytes of markdown with quotes and backslashes broke the heredoc twice.
- **"Announce before the first tool call"**: in testing, the agent kept skipping the one line the user needs to hear, until the instruction moved into the skill's description.

In my own side-by-side test on two shutdown scenarios, the same model with the original version of the skill met all 69 rubric checks; without it, 55. I didn't keep that harness, so read it as an anecdote, not a benchmark. Before this release, the public version was run end to end in throwaway repos, twice, and its scripts pass the 54 regression probes in [`tests/`](tests/run.mjs), each one built from a bug those runs found.

## Contributing

Issues and pull requests are welcome, especially new rows for the [stopping boundary](skills/handoff/references/stopping-boundary.md) from setups it hasn't met yet. See [CONTRIBUTING.md](CONTRIBUTING.md).

Got a section 4 that saved you an afternoon? Share it in [Discussions](https://github.com/asalazarvaldiviaocg/handoff/discussions), with the secrets removed.

---

<p align="center">
  If <code>/handoff</code> saved you a session, a ⭐ helps the next person find it.<br>
  <sub>MIT licensed. Built with Claude Code.</sub>
</p>
