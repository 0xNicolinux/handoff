#!/usr/bin/env node
// repo-state.mjs: git state of the repos touched in a session, for Phase 1 of /handoff.
//
// Usage:
//   node repo-state.mjs "<repo path 1>" ["<repo path 2>" ...] [--since "YYYY-MM-DD HH:MM:SS"] [--json]
//
// For each path it prints: branch, HEAD, whether it is a worktree, dirty files (suspicious ones flagged,
// and files untouched since --since marked as probably not yours), unpushed commits, commits since
// --since, and secret patterns in everything that could be committed or pushed: unstaged and staged
// changes, new untracked files, and unpushed commits. Untracked secret files (.env and friends) are
// reported separately: never stage them. It modifies nothing. No dependencies.
// Exit code: 0 = fine, 1 = secrets in something that would be committed or pushed, 2 = bad usage.

import { spawnSync } from 'node:child_process';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const args = process.argv.slice(2);
const wantJson = args.includes('--json');
let since = null;
const paths = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--json') continue;
  if (a === '--since') { since = args[++i] ?? null; continue; }
  paths.push(a);
}

if (paths.length === 0) {
  console.error('Usage: node repo-state.mjs "<repo path>" [...] [--since "YYYY-MM-DD HH:MM:SS"] [--json]');
  process.exit(2);
}

const sinceMs = since ? new Date(since.trim().replace(' ', 'T')).getTime() : NaN;
if (since && Number.isNaN(sinceMs)) {
  console.error(`--since "${since}" is not a date: use "YYYY-MM-DD HH:MM:SS" (local time) or ISO with Z (UTC)`);
  process.exit(2);
}
const sinceNote = since
  ? `--since ${since} read as ${new Date(sinceMs).toLocaleString('sv-SE')} local time${sinceMs > Date.now() ? '  <-- IN THE FUTURE: was a UTC time written as local? Pass the log value with its Z' : ''}`
  : null;
const MAX_LISTED = 50;
const MAX_SCANNED = 500;
const MAX_COMMITS = 500;

// Files that must NOT go into a handoff commit, or that signal junk.
const SUSPICIOUS = [
  /(^|\/)\.env(\.|$)/i, /\.pem$/i, /\.key$/i, /\.p12$/i, /\.pfx$/i,
  /id_rsa|id_ed25519/i, /(^|\/)secrets?(\/|\.|$)/i, /credential/i,
  /(^|\/)node_modules\//, /(^|\/)\.?venv\//, /(^|\/)__pycache__\//, /(^|\/)target\//, /(^|\/)coverage\//,
  /(^|\/)\.(turbo|cache|parcel-cache|gradle|netlify|vercel|next)\//, /(^|\/)(dist|build)\//,
  /\.bak$/i, /\.orig$/i, /\.log$/i, /(^|\/)\.DS_Store$/i, /(^|\/)Thumbs\.db$/i, /\.zip$/i, /\.mp4$/i,
  /(^|\/)HANDOFF\.md$/, /(^|\/)\.handoff\//,
];
// Suspicious files whose CONTENT is still worth scanning (secret files), as opposed to junk folders.
const SECRET_FILE = [/(^|\/)\.env(\.|$)/i, /(^|\/)secrets?\.[a-z]+$/i, /credential[^/]*$/i, /\.pem$/i, /\.key$/i, /id_rsa|id_ed25519/i];

// Secret patterns, tested on one line at a time (diff lines without their leading "+").
const SECRET = [
  [/sk_(live|test)_[0-9A-Za-z]{10,}/, 'Stripe key'],
  [/rk_(live|test)_[0-9A-Za-z]{10,}/, 'Stripe restricted key'],
  [/whsec_[0-9A-Za-z]{10,}/, 'Stripe webhook secret'],
  [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/gh[pousr]_[0-9A-Za-z]{20,}/, 'GitHub token'],
  [/github_pat_[0-9A-Za-z_]{20,}/, 'GitHub fine-grained token'],
  [/xox[baprs]-[0-9A-Za-z-]{10,}/, 'Slack token'],
  [/sk-ant-[0-9A-Za-z_-]{20,}/, 'Anthropic API key'],
  [/(?<![A-Za-z0-9_-])sk-(?:proj-|svcacct-|admin-)?(?=[A-Za-z0-9_-]*[0-9])(?=[A-Za-z0-9_-]*[A-Z])[A-Za-z0-9_-]{32,}/, 'OpenAI-style API key'],
  [/\bre_[0-9A-Za-z]{20,}\b/, 'Resend key'],
  [/nfp_[0-9A-Za-z]{20,}/, 'Netlify token'],
  [/AIza[0-9A-Za-z_-]{30,}/, 'Google API key'],
  [/eyJ[0-9A-Za-z_-]{20,}\.[0-9A-Za-z_-]{20,}\.[0-9A-Za-z_-]{10,}/, 'JWT'],
  [/(postgres(ql)?|mysql|mongodb(\+srv)?|redis|amqp):\/\/[^\s:/@]+:[^\s@]+@/i, 'connection string with password'],
  // A quoted literal assigned to a secret-looking name: password: "hunter2hunter2", apiKey = 'abc...'.
  [/(password|passwd|api[_-]?key|secret|token)["']?\s*[:=]\s*["']([^"'\s$]{8,})["']/i, 'quoted secret literal'],
  // Env-file style: STRIPE_SECRET=..., export API_TOKEN=... (not a $VAR reference).
  [/(?:^|[\s`'"|(>*-])(?:export\s+)?[A-Za-z0-9_]*(?:PASSWORD|SECRET|TOKEN|API_?KEY)[A-Za-z0-9_]*\s*=\s*(?![$"'`{])[^\s#"'`]{8,}/, 'env-style secret'],
];

function git(path, argv) {
  const r = spawnSync('git', ['-C', path, '-c', 'core.quotePath=false', ...argv], {
    encoding: 'utf8',
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' },
    maxBuffer: 64 * 1024 * 1024,
  });
  return { ok: r.status === 0, out: (r.stdout || '').replace(/\r\n/g, '\n').replace(/\n+$/, ''), err: (r.stderr || '').trim() };
}

// Show the type and where, never the value: keep the name, hide what follows "=", ":" or "user:".
function mask(line) {
  return line.trim().slice(0, 70)
    .replace(/(:\/\/[^:\s/@]+:)[^\s@]+@/g, '$1***@')
    .replace(/([:=]\s*["']?)[^\s"',;]{4,}/g, '$1***')
    .replace(/[0-9A-Za-z_-]{16,}/g, (m) => m.slice(0, 4) + '…');
}

function scanText(text, origin, hits, { onlyAdded }) {
  let file = null;
  for (const raw of text.split('\n')) {
    if (onlyAdded) {
      if (raw.startsWith('+++ ')) { file = raw.slice(4).replace(/^b\//, ''); continue; }
      if (!raw.startsWith('+') || raw.startsWith('+++')) continue;
    }
    const line = onlyAdded ? raw.slice(1) : raw;
    for (const [re, name] of SECRET) {
      if (re.test(line)) { hits.push({ origin: file ? `${origin}: ${file}` : origin, type: name, sample: mask(line) }); break; }
    }
  }
}

const DIFF = ['--no-ext-diff', '--no-textconv', '--no-color', '-U0'];

function analyse(rawPath) {
  const path = resolve(rawPath);
  const res = { path, exists: existsSync(path), isRepo: false };
  if (!res.exists) return res;
  const inside = git(path, ['rev-parse', '--is-inside-work-tree']);
  if (!inside.ok || inside.out !== 'true') return res;
  res.isRepo = true;

  const headOk = git(path, ['rev-parse', '--verify', '-q', 'HEAD']).ok;
  res.branch = git(path, ['symbolic-ref', '--short', '-q', 'HEAD']).out || '(detached HEAD)';
  res.head = headOk ? git(path, ['rev-parse', '--short=7', 'HEAD']).out : '(no commits yet)';
  res.headSubject = headOk ? git(path, ['log', '-1', '--format=%s']).out : '';
  res.headDate = headOk ? git(path, ['log', '-1', '--format=%ci']).out : '';

  const gitDir = git(path, ['rev-parse', '--git-dir']).out;
  const commonDir = git(path, ['rev-parse', '--git-common-dir']).out;
  res.isWorktree = Boolean(gitDir && commonDir && resolve(path, gitDir) !== resolve(path, commonDir));
  res.topLevel = git(path, ['rev-parse', '--show-toplevel']).out;
  res.mainRepo = res.isWorktree ? dirname(resolve(path, commonDir)) : res.topLevel;
  const abs = git(path, ['rev-parse', '--path-format=absolute', '--git-path', 'info/exclude']);
  res.excludeFile = abs.ok && abs.out ? resolve(abs.out) : resolve(path, git(path, ['rev-parse', '--git-path', 'info/exclude']).out);

  // Dirty files, NUL-separated so names with spaces or accents survive.
  res.dirty = [];
  const fields = git(path, ['status', '--porcelain=v1', '-z', '-uall']).out.split('\0');
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (!f || f.length < 4) continue;
    const state = f.slice(0, 2);
    const file = f.slice(3);
    if (/[RC]/.test(state)) i++; // a rename or copy is followed by its source path
    const suspicious = SUSPICIOUS.some((re) => re.test(file));
    let olderThanSince = false;
    if (!Number.isNaN(sinceMs)) {
      try { olderThanSince = statSync(resolve(res.topLevel || path, file)).mtimeMs < sinceMs; } catch { /* deleted */ }
    }
    res.dirty.push({ state, file, suspicious, olderThanSince });
  }

  // Upstream and unpushed commits.
  const up = git(path, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  if (up.ok) {
    res.upstream = up.out;
    const lr = git(path, ['rev-list', '--left-right', '--count', '@{u}...HEAD']).out.split(/\s+/);
    res.behind = Number(lr[0] || 0);
    res.unpushed = Number(lr[1] || 0);
    res.unpushedCommits = res.unpushed ? git(path, ['log', '--format=%h %s', '@{u}..HEAD']).out.split('\n').filter(Boolean) : [];
  } else {
    res.upstream = null;
    res.hasRemote = Boolean(git(path, ['remote']).out.trim());
    // No upstream: count commits that are on no remote at all (all of them if there is no remote).
    res.unpushed = headOk ? Number(git(path, ['rev-list', '--count', 'HEAD', ...(res.hasRemote ? ['--not', '--remotes'] : [])]).out || 0) : 0;
    res.unpushedCommits = [];
  }

  if (since && headOk) {
    res.since = since;
    res.commitsSince = git(path, ['log', `--since=${since}`, '--format=%h %ci %s']).out.split('\n').filter(Boolean).map((c) => {
      const sha = c.split(' ')[0];
      const pushed = Boolean(git(path, ['branch', '-r', '--contains', sha]).out.trim());
      return pushed ? `${c}  (already pushed)` : c;
    });
  }

  // Secrets in anything that could be committed or pushed.
  res.secrets = [];
  scanText(git(path, ['diff', ...DIFF]).out, 'unstaged', res.secrets, { onlyAdded: true });
  scanText(git(path, ['diff', '--cached', ...DIFF]).out, 'staged', res.secrets, { onlyAdded: true });
  // Every commit a push would send, one by one (a secret added and later removed still counts).
  if (headOk && res.unpushed) {
    const range = res.upstream ? ['@{u}..HEAD'] : res.hasRemote ? ['HEAD', '--not', '--remotes'] : ['HEAD'];
    const cap = res.unpushed > MAX_COMMITS ? ['-n', String(MAX_COMMITS)] : [];
    if (cap.length) res.scannedLocalCommits = `newest ${MAX_COMMITS} of ${res.unpushed} unpushed commits`;
    scanText(git(path, ['log', '-p', ...DIFF, '--format=', ...cap, ...range]).out, 'unpushed commit', res.secrets, { onlyAdded: true });
  }
  // New untracked files: normal ones count as "would be committed"; secret files are reported apart.
  res.secretFiles = [];
  let scanned = 0;
  for (const d of res.dirty) {
    if (d.state !== '??') continue;
    const isSecretFile = SECRET_FILE.some((re) => re.test(d.file));
    if (d.suspicious && !isSecretFile) continue;
    if (++scanned > MAX_SCANNED) { res.scanTruncated = true; break; }
    const abs = resolve(res.topLevel || path, d.file);
    try {
      if (statSync(abs).size > 2 * 1024 * 1024) continue; // skip large binaries
      const hits = [];
      scanText(readFileSync(abs, 'utf8').replace(/\r\n/g, '\n'), `new: ${d.file}`, hits, { onlyAdded: false });
      (isSecretFile ? res.secretFiles : res.secrets).push(...hits.map((h) => ({ ...h, origin: isSecretFile ? d.file : h.origin })));
    } catch { /* unreadable: skip */ }
  }

  res.recent = headOk ? git(path, ['log', '-5', '--format=%h %ci %an: %s']).out.split('\n').filter(Boolean) : [];
  return res;
}

const results = paths.map(analyse);
if (sinceNote && !wantJson) console.log(sinceNote);
const exitCode = results.some((r) => r.secrets?.length) ? 1 : 0;

if (wantJson) {
  console.log(JSON.stringify(results, null, 1));
  process.exit(exitCode);
}

for (const r of results) {
  console.log(`\n=== ${r.path}`);
  if (!r.exists) { console.log('  folder does NOT exist'); continue; }
  if (!r.isRepo) { console.log('  not a git repo (list the changed files by hand in section 3)'); continue; }
  console.log(`  branch: ${r.branch}   HEAD: ${r.head}${r.headDate ? `  (${r.headDate})  ${r.headSubject}` : ''}`);
  if (r.isWorktree) console.log(`  worktree of: ${r.mainRepo}  (don't commit in the main folder if it is the production checkout)`);
  console.log(`  exclude file: ${r.excludeFile}`);
  if (r.upstream) {
    console.log(`  upstream: ${r.upstream}   unpushed: ${r.unpushed}   behind: ${r.behind}`);
    for (const c of r.unpushedCommits) console.log(`    · ${c}`);
  } else {
    console.log(`  upstream: NONE (no upstream for this branch; ${r.unpushed} commits are on no remote${r.hasRemote ? '' : ', and the repo has no remote'})`);
  }
  if (r.dirty.length === 0) console.log('  tree: CLEAN');
  else {
    console.log(`  tree: DIRTY (${r.dirty.length} files)`);
    for (const d of r.dirty.slice(0, MAX_LISTED)) {
      const tags = [d.suspicious && 'SUSPICIOUS: do not commit without looking', d.olderThanSince && 'untouched since before --since: probably not yours'].filter(Boolean);
      console.log(`    ${d.state} ${d.file}${tags.length ? `   <-- ${tags.join('; ')}` : ''}`);
    }
    if (r.dirty.length > MAX_LISTED) console.log(`    ... and ${r.dirty.length - MAX_LISTED} more (run git status)`);
  }
  if (r.commitsSince) {
    console.log(`  commits since ${r.since}: ${r.commitsSince.length}`);
    for (const c of r.commitsSince) console.log(`    · ${c}`);
  }
  if (r.secrets.length) {
    console.log(`  SECRETS in what would be committed or pushed (${r.secrets.length}): remove them before committing; if one is inside a commit, do not push`);
    for (const s of r.secrets) console.log(`    [${s.origin}] ${s.type}: ${s.sample}`);
  } else {
    console.log(`  secrets in changes and unpushed commits: none detected${r.scannedLocalCommits ? ` (scanned: ${r.scannedLocalCommits})` : ''}`);
  }
  if (r.secretFiles.length) {
    console.log(`  untracked secret files, NOT git-ignored (${r.secretFiles.length} hits): never stage them; leave them in place and record them`);
    for (const s of r.secretFiles) console.log(`    [${s.origin}] ${s.type}`);
  }
  if (r.scanTruncated) console.log(`  note: secret scan stopped after ${MAX_SCANNED} untracked files`);
  if (r.recent.length) {
    console.log('  last 5 commits:');
    for (const c of r.recent) console.log(`    ${c}`);
  }
}

const withSecrets = results.filter((r) => r.secrets?.length).length;
const withDirt = results.filter((r) => r.dirty?.length).length;
const withSecretFiles = results.filter((r) => r.secretFiles?.length).length;
console.log(`\nSummary: ${results.length} paths · ${withDirt} with a dirty tree · ${withSecrets} with secrets in changes or commits · ${withSecretFiles} with untracked secret files`);
process.exit(exitCode);
