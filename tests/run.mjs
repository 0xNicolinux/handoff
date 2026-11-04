// Regression probes for the /handoff scripts and hook. Each one comes from a bug found while testing the
// skill end to end before release. Needs Node 18+ and git; creates throwaway repos in the OS temp dir.
//
//   node tests/run.mjs
//
// The fake keys below are split in two so secret scanners don't mistake this file for a leak.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RS = `${REPO}/skills/handoff/scripts/repo-state.mjs`;
const CH = `${REPO}/skills/handoff/scripts/check-handoff.mjs`;
const HK = `${REPO}/hooks/session-start.mjs`;
const EX = `${REPO}/skills/handoff/references/example-handoff.md`;
const T = realpathSync.native(mkdtempSync(join(tmpdir(), 'handoff-tests-')));
process.on('exit', () => { try { rmSync(T, { recursive: true, force: true }); } catch { /* best effort */ } });
// Isolate from the developer's global git config (default branch, hooks, signing).
process.env.GIT_CONFIG_GLOBAL = join(T, 'gitconfig');
writeFileSync(process.env.GIT_CONFIG_GLOBAL, '[user]\n\tname = Test\n\temail = test@example.com\n[commit]\n\tgpgsign = false\n[init]\n\tdefaultBranch = main\n');

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${!cond && extra ? `\n      ${extra.split('\n').slice(0, 12).join('\n      ')}` : ''}`); };
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts });
const g = (cwd, ...a) => { const r = run('git', a, { cwd }); if (r.status !== 0) throw new Error(`git ${a.join(' ')}: ${r.stderr}`); return r.stdout; };
const fakeKey = 'sk_test_' + 'Ab3dEf6hIj9kLm2nOp5qRs8t';
const fakeGh = 'ghp_' + 'abcdefghijklmnopqrstuvwxyz0123';

// ---------- repo-state ----------
const remote = join(T, 'remote.git');
g(T, 'init', '--bare', '-q', remote);
const r1 = join(T, 'r1');
mkdirSync(r1);
g(r1, 'init', '-q', '-b', 'main'); g(r1, 'config', 'user.email', 't@e.st'); g(r1, 'config', 'user.name', 'T');
writeFileSync(join(r1, 'a.js'), 'export const a = 1;\n');
g(r1, 'add', '.'); g(r1, 'commit', '-qm', 'init'); g(r1, 'remote', 'add', 'origin', remote); g(r1, 'push', '-qu', 'origin', 'main');
writeFileSync(join(r1, 'config.js'), `export const key = "${fakeKey}";\n`);
g(r1, 'add', 'config.js'); g(r1, 'commit', '-qm', 'add config with a key (unpushed)');
let out = run('node', [RS, r1]);
ok('secret inside an UNPUSHED commit is reported', /unpushed commit: config\.js/.test(out.stdout) && out.status === 1, out.stdout);
ok('secret sample is masked', !out.stdout.includes(fakeKey), out.stdout);

// secret added then removed in two unpushed commits: the net diff is clean, history is not
writeFileSync(join(r1, 'config.js'), 'export const key = process.env.K;\n');
g(r1, 'commit', '-qam', 'move key to env (unpushed)');
out = run('node', [RS, r1]);
ok('secret added then removed in unpushed commits is still reported', /unpushed commit: config\.js/.test(out.stdout) && out.status === 1, out.stdout);
// branch with no upstream: an OLD local commit with a secret, --since = today
g(r1, 'checkout', '-qb', 'feat/x', '--no-track', 'origin/main');
writeFileSync(join(r1, 'old.js'), 'const AWS = "' + 'AKIA' + 'ABCDEFGHIJKLMNOP";\n');
g(r1, 'add', 'old.js'); { const r = run('git', ['commit', '-qm', 'old commit'], { cwd: r1, env: { ...process.env, GIT_AUTHOR_DATE: '2026-11-01T10:00:00', GIT_COMMITTER_DATE: '2026-11-01T10:00:00' } }); if (r.status) throw new Error(r.stderr); }
writeFileSync(join(r1, 'new.js'), 'export const n = 2;\n');
g(r1, 'add', 'new.js'); g(r1, 'commit', '-qm', 'today');
out = run('node', [RS, r1, '--since', '2026-11-04 00:00:00']);
ok('no-upstream branch: old unpushed commit with a secret is scanned despite --since', /unpushed commit: old\.js/.test(out.stdout) && out.status === 1, out.stdout);
ok('no-upstream branch: counts commits on no remote', /upstream: NONE \(no upstream for this branch; 2 commits are on no remote\)/.test(out.stdout), out.stdout);
const future = new Date(Date.now() + 5 * 3600e3);
const p2 = (n) => String(n).padStart(2, '0');
const futureLocal = `${future.getFullYear()}-${p2(future.getMonth() + 1)}-${p2(future.getDate())} ${p2(future.getHours())}:${p2(future.getMinutes())}:00`;
out = run('node', [RS, r1, '--since', futureLocal]);
ok('--since in the future is warned about', /IN THE FUTURE/.test(out.stdout), out.stdout.split('\n')[0]);
out = run('node', [RS, r1, '--since', new Date(Date.now() - 3600e3).toISOString()]);
ok('--since as ISO UTC with Z is read correctly', /read as .* local time/.test(out.stdout) && !/IN THE FUTURE/.test(out.stdout), out.stdout.split('\n')[0]);
out = run('node', [RS, r1, '--since', 'yesterday-ish']);
ok('--since garbage is rejected', out.status === 2);
mkdirSync(join(r1, 'sub'));
writeFileSync(join(r1, 'sub', 'x.txt'), 'x\n');
out = run('node', [RS, join(r1, 'sub')]);
ok('subdirectory: exclude file points inside the repo', out.stdout.replace(/\\/g, '/').toLowerCase().includes((r1.replace(/\\/g, '/') + '/.git/info/exclude').toLowerCase()), out.stdout.split('\n').find((l) => l.includes('exclude')) || out.stdout);

const r2 = join(T, 'r2');
mkdirSync(r2);
g(r2, 'init', '-q', '-b', 'main'); g(r2, 'config', 'user.email', 't@e.st'); g(r2, 'config', 'user.name', 'T');
writeFileSync(join(r2, 'app.js'), 'x\n'); g(r2, 'add', '.'); g(r2, 'commit', '-qm', 'init');
writeFileSync(join(r2, 'app.js'), 'const token = getToken();\nconst csrfToken = req.csrfToken();\nconst db = { password: process.env.DB_PASSWORD };\nconst branch = "feat/task-queue-retry-and-dead-letter-handling-and-more-stuff";\nrun: echo ${{ secrets.NPM_TOKEN }}\n');
out = run('node', [RS, r2]);
ok('ordinary code is NOT flagged as a secret', /none detected/.test(out.stdout) && out.status === 0, out.stdout);
writeFileSync(join(r2, 'año-config.yml'), `secret: "${fakeGh}"\n`);
out = run('node', [RS, r2]);
ok('untracked file with an accent: listed readably', /\?\? año-config\.yml/.test(out.stdout), out.stdout);
ok('untracked file with an accent: secret found', /new: año-config\.yml/.test(out.stdout) && out.status === 1, out.stdout);
rmSync(join(r2, 'año-config.yml'));
writeFileSync(join(r2, '.env'), `STRIPE_KEY=${fakeKey}\n`);
out = run('node', [RS, r2]);
ok('.env with a key: reported as untracked secret file, exit 0', /untracked secret files, NOT git-ignored/.test(out.stdout) && /\[\.env\] Stripe key/.test(out.stdout) && out.status === 0, out.stdout);
g(r2, 'config', 'diff.external', 'echo EXTERNAL');
writeFileSync(join(r2, 'app.js'), `const k = "${fakeKey}";\n`);
out = run('node', [RS, r2]);
ok('diff.external does not hide secrets', /unstaged: app\.js/.test(out.stdout), out.stdout);
const r3 = join(T, 'r3'); mkdirSync(r3); g(r3, 'init', '-q', '-b', 'main');
out = run('node', [RS, r3]);
ok('repo with no commits: branch name shown', /branch: main\s+HEAD: \(no commits yet\)/.test(out.stdout), out.stdout);

// ---------- check-handoff ----------
const H = (name, content) => { const p = join(T, name); writeFileSync(p, content); return p; };
const ex = readFileSync(EX, 'utf8');
const withStep = (s) => ex.replace('7. Parked for later', `7. ${s}\n8. Parked for later`);
const lint = (p, ...a) => run('node', [CH, p, ...a]);
ok('example passes', lint(EX).status === 0, lint(EX).stdout);
for (const [label, step] of [
  ['generic Record<Key, number>', 'Type it as `Record<Key, number>` in `src/types.ts:4`.'],
  ['useState<Project | null>', 'Change `useState<Project | null>` at `src/App.tsx:12`.'],
  ['plist <key> tag', 'Add `<key>NSCameraUsageDescription</key>` to `ios/App/Info.plist`.'],
  ['<KeyboardAvoidingView>', 'Wrap the form in `<KeyboardAvoidingView>` (`src/Form.tsx:30`).'],
  ['<sitemap>', 'Regenerate `<sitemap>` entries in `public/sitemap.xml`.'],
  ['TODO quoted in inline code', 'Resolve the `// TODO: retry` comment at `src/webhooks/payments.ts:130`.'],
  ['FIXME in prose', 'Resolve the FIXME (src/webhooks/payments.ts:140) after step 4.'],
  ['env var name as where it lives', 'The webhook secret=STRIPE_WEBHOOK_SECRET_PROD lives in the CI store; DB password: `DB_PASSWORD` in `.env`.'],
  ['Stripe test card', 'e2e uses the Stripe test card 4242 4242 4242 4242 (visa).'],
  ['kebab branch name', 'Branch `feat/task-queue-retry-and-dead-letter-handling` stays local.'],
]) ok(`no false positive: ${label}`, lint(H('fp.md', withStep(step))).status === 0, lint(H('fp.md', withStep(step))).stdout);
ok('no false positive: ${{ github.sha }} in a fence', lint(H('gha.md', ex.replace('7. Parked for later', '7. CI step:\n   ```\n   run: npm test -- --sha=${{ github.sha }}\n   ```\n8. Parked for later'))).status === 0);
for (const ph of ['<repo>', '<your repo>', '<absolute path>', '<abs path to repo>', '/abs/path/repo', '/path/to/repo', '$REPO', '<REPO_PATH>', '<branch-name>'])
  ok(`placeholder caught: ${ph}`, lint(H('ph.md', withStep(`Run \`git -C "${ph}" status\`.`))).status === 1);
ok('BOM file still lints', lint(H('bom.md', '\uFEFF' + ex)).status === 0);
ok('"## 2FA notes" heading is not a section', lint(H('2fa.md', ex + '\n## 2FA rollout notes\nnothing\n')).status === 0, lint(H('2fa.md', ex + '\n## 2FA rollout notes\nnothing\n')).stdout);
const noSha = ex.replace(/`[0-9a-f]{7}`/g, '`main`').replace(/a41d7e0|5c09b13|9f3c2a1/g, 'HEAD');
ok('phone number does not count as a SHA', lint(H('nosha.md', noSha.replace('## 3. What changed', 'Support line: 5550001234.\n\n## 3. What changed'))).status === 1);
const minimalDoc = `---
type: handoff
title: "HANDOFF: ledgerline: webhook (minimal)"
project: ledgerline
created: 2026-11-04
updated: 2026-11-04
status: STOPPED AT USAGE LIMIT
---

# HANDOFF: ledgerline (RESUME HERE)

> Written 2026-11-04 10:00. Resume: say *continue from HANDOFF.md*.

## 1. Goal

**Literal request:** "make the webhook idempotent; don't push".

## 2. Where everything ended

| Repo | Branch | HEAD | Tree | Pushed |
|---|---|---|---|---|
| \`/Users/mara/code/ledgerline\` | \`fix/webhook\` | \`a41d7e0\` | WIP | nothing pushed or deployed |

## 5. Exact next steps

1. Run \`npm --prefix "/Users/mara/code/ledgerline" test\`: expected 212/214.
2. Ask the user: A) fix F1 now · B) log it.
3. Expand sections 3 and 4 of this handoff.
`;
ok('minimal handoff FAILS without --minimal', lint(H('min.md', minimalDoc)).status === 1);
ok('minimal handoff PASSES with --minimal', lint(H('min.md', minimalDoc), '--minimal').status === 0, lint(H('min.md', minimalDoc), '--minimal').stdout);
for (const [label, line] of [
  ['bullet', '- `.env` holds `DB_PASSWORD=Pr0dPassw0rd2026`'],
  ['table cell', '| `.env` | `ADMIN_TOKEN=a8f3k2m9q7x1z5w4` |'],
  ['prose', 'The billing API token is BILLING_API_TOKEN=a8f3k2m9q7x1z5w4 (from .env).'],
  ['inline export', '- `export API_KEY=a8f3k2m9q7x1z5w4b6`'],
]) ok(`env-style secret caught in a ${label}`, lint(H('envsec.md', ex.replace('## 3. What changed', `${line}\n\n## 3. What changed`))).status === 1);
ok('env var NAME without a value is fine', lint(H('envok.md', ex.replace('## 3. What changed', '- `DB_PASSWORD` lives in `.env`; `STRIPE_SECRET=$STRIPE_SECRET` in CI.\n\n## 3. What changed'))).status === 0, lint(H('envok.md', ex.replace('## 3. What changed', '- `DB_PASSWORD` lives in `.env`; `STRIPE_SECRET=$STRIPE_SECRET` in CI.\n\n## 3. What changed'))).stdout);
ok('real secret still caught', lint(H('sec.md', withStep(`Key is ${fakeKey}.`))).status === 1);
ok('quoted secret literal caught', lint(H('sec2.md', withStep('Set password: "hunter2hunter2" in prod.'))).status === 1);

// ---------- hook ----------
const hook = (cwd, env = {}) => run('node', [HK], { input: JSON.stringify({ cwd }), env: { ...process.env, ...env } }).stdout;
const hd = join(T, 'hk'); mkdirSync(join(hd, 'a'), { recursive: true });
writeFileSync(join(hd, 'a', 'HANDOFF.md'), ex);
ok('hook announces a pending handoff', /Handoff waiting: ledgerline/.test(hook(join(hd, 'a'))));
writeFileSync(join(hd, 'a', 'HANDOFF.md'), '\uFEFF' + ex.replace(/^status: .*$/m, 'status: RESUMED 2026-11-04'));
ok('hook silent for RESUMED even with a BOM', hook(join(hd, 'a')) === '');
mkdirSync(join(hd, 'b'));
writeFileSync(join(hd, 'b', 'HANDOFF.md'), '# Team handoff notes\nnot ours\n');
ok('hook silent for a HANDOFF.md not written by the skill', hook(join(hd, 'b')) === '');
mkdirSync(join(hd, 'vault')); mkdirSync(join(hd, 'repo2'));
writeFileSync(join(hd, 'vault', 'HANDOFF.md'), ex.replace(/^status: .*$/m, 'status: RESUMED 2026-11-04'));
writeFileSync(join(hd, 'repo2', 'HANDOFF.md'), ex);
ok('resumed vault handoff does not hide a pending repo handoff', /Handoff waiting/.test(hook(join(hd, 'repo2'), { HANDOFF_PATH: join(hd, 'vault') })));
mkdirSync(join(hd, 'proj')); mkdirSync(join(hd, 'project-notes'));
writeFileSync(join(hd, 'project-notes', 'HANDOFF.md'), ex);
const pfx = hook(join(hd, 'proj'), { HANDOFF_PATH: join(hd, 'project-notes') });
ok('prefix-sharing folder gives an absolute path', pfx.includes('project-notes') && !/continue from ct-notes/.test(pfx), pfx);
ok('HANDOFF_NOTICE=off silences it', hook(join(hd, 'repo2'), { HANDOFF_NOTICE: 'off' }) === '');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
