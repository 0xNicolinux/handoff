#!/usr/bin/env node
// check-handoff.mjs: lints a written HANDOFF.md so the next session can actually resume from it.
// Checks: frontmatter, 5 numbered sections in order with content, a commit SHA in section 2, a numbered
// list with real paths in section 5, no placeholders or template holes, no secrets, sane length, a resume
// phrase, and a header time that matches when the file was saved. Language-agnostic: only the section
// numbers 1-5 are required, not their titles.
//
// Usage:
//   node check-handoff.mjs [path to HANDOFF.md] [--minimal]
//     default path: ./HANDOFF.md
//     --minimal: the short handoff written near a usage limit (sections 1, 2 and 5 required; 15+ lines)
//
// Ends with "OK" (exit 0) or with the list of failures (exit 1). Warnings never block.

import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const argv = process.argv.slice(2);
const minimal = argv.includes('--minimal');
const path = resolve(argv.find((a) => !a.startsWith('--')) || 'HANDOFF.md');

const pad = (n) => String(n).padStart(2, '0');
const now = new Date();
const nowStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

if (!existsSync(path)) {
  console.log(`FAIL: ${path} does not exist`);
  process.exit(1);
}

const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const lines = text.split('\n');
const failures = [];
const warnings = [];

// --- Frontmatter -------------------------------------------------------------------------------
let fm = null;
let bodyStart = 0;
if (lines[0] === '---') {
  const end = lines.indexOf('---', 1);
  if (end > 0) { fm = lines.slice(1, end).join('\n'); bodyStart = end + 1; }
}
if (!fm) failures.push('no YAML frontmatter (a --- block at the very top)');
else {
  for (const field of ['type', 'title', 'project', 'created', 'updated', 'status']) {
    // "proyecto" is accepted as an alias for "project".
    const re = field === 'project' ? /^(project|proyecto):\s*\S/m : new RegExp(`^${field}:\\s*\\S`, 'm');
    if (!re.test(fm)) failures.push(`frontmatter is missing "${field}:"`);
  }
  if (!/^type:\s*["']?handoff["']?\s*$/m.test(fm)) failures.push('frontmatter: type must be "handoff"');
  const upd = fm.match(/^updated:\s*["']?(\d{4}-\d{2}-\d{2})/m);
  if (upd && upd[1] !== nowStr.slice(0, 10)) warnings.push(`updated=${upd[1]} but today is ${nowStr.slice(0, 10)} (was it updated?)`);
}

// --- Sections ----------------------------------------------------------------------------------
// Accepts "## 1. Goal", "## 1 - Goal", "## 1) ...", "## 4 Lo que falló". "## 2FA" or "## 10." are not sections.
const NAMES = { 1: 'Goal', 2: 'Where everything ended', 3: 'What changed', 4: 'What we tried that failed', 5: 'Exact next steps' };
const REQUIRED = minimal ? [1, 2, 5] : [1, 2, 3, 4, 5];
const headings = [];
const inFenceAt = new Array(lines.length).fill(false);
let fence = false;
lines.forEach((l, i) => {
  if (/^\s*(```|~~~)/.test(l)) { fence = !fence; inFenceAt[i] = true; return; }
  inFenceAt[i] = fence;
  if (fence || i < bodyStart || l.startsWith('###')) return;
  const m = l.match(/^##\s+(?:(\d)(?![\dA-Za-z])\s*[.):\-–—]?\s*)?(.*)$/);
  if (m) headings.push({ n: m[1] ? Number(m[1]) : null, title: (m[2] || '').trim(), line: i });
});
const bodyOf = (idx) => lines.slice(headings[idx].line + 1, headings[idx + 1] ? headings[idx + 1].line : lines.length);
const sections = {};
for (let n = 1; n <= 5; n++) {
  const idx = headings.findIndex((h) => h.n === n);
  if (idx < 0) {
    if (REQUIRED.includes(n)) failures.push(`missing section "## ${n}. ${NAMES[n]}" (any language, but numbered)`);
    continue;
  }
  const body = bodyOf(idx);
  const withText = body.filter((l) => l.trim() && !/^\s*[|#>*_-]*\s*$/.test(l) && !/^\|[-:| ]+\|$/.test(l.trim()));
  sections[n] = { body, withText };
  const min = minimal ? 1 : n === 4 ? 2 : 3;
  if (withText.length < min) failures.push(`section ${n} (${NAMES[n]}) is nearly empty: ${withText.length} lines with text (minimum ${min}); if it does not apply, say why`);
  const firstPara = [];
  for (const l of body) { if (!l.trim()) { if (firstPara.length) break; continue; } firstPara.push(l.trim()); }
  if (/^\*[^*][\s\S]*\*$/.test(firstPara.join(' '))) warnings.push(`section ${n} starts with an italic note: is the template guidance still there?`);
}
const order = headings.filter((h) => h.n >= 1 && h.n <= 5).map((h) => h.n);
if (order.join() !== [...order].sort((a, b) => a - b).join()) failures.push(`sections are not in order 1→5 (found ${order.join(', ')})`);
const dupes = order.filter((n, i) => order.indexOf(n) !== i);
if (dupes.length) failures.push(`section number(s) repeated: ${[...new Set(dupes)].join(', ')}`);

// --- Minimum content per section -----------------------------------------------------------------
const SHA = /\b(?=[0-9a-f]*[a-f])(?=[0-9a-f]*[0-9])[0-9a-f]{7,40}\b/;
if (sections[2]) {
  const t = sections[2].body.join('\n');
  if (!SHA.test(t) && !/no-repo|no (git )?repo|not a git repo|no repos? (were |was )?touched|sin repo|sin git|no se toc[oó] ning[uú]n repo/i.test(t)) {
    failures.push('section 2 mentions no commit SHA and does not say there was no repo (write "no-repo" if no git repo was involved)');
  }
  if (!/push|deploy|publish|desplieg|pushead|subid/i.test(t)) warnings.push('section 2 does not say whether anything was pushed or deployed (write "nothing pushed or deployed" if so)');
}
if (sections[4]) {
  const t = sections[4].body.join('\n');
  if (!/instead|rather|don'?t repeat|do not repeat|no failures|nothing failed|passed (on )?the first|en su lugar|en vez|no repetir|sin fallos|statt|au lieu|invece|em vez/i.test(t)) {
    warnings.push('section 4: each failure should say what to do "instead" (or state that nothing failed)');
  }
}
if (sections[5]) {
  const body = sections[5].body;
  const numbered = body.filter((l) => /^\s*\d+[.)]\s+\S/.test(l)).length;
  if (numbered < 2) failures.push(`section 5 must be a numbered list of steps (found ${numbered} numbered lines)`);
  const t5 = body.join('\n');
  if (!/[A-Za-z]:\\|(^|[\s`"'(])\/[A-Za-z0-9_.-]+\/|`[^`]+`|:\d+\b/m.test(t5)) warnings.push('section 5: no step carries a command, a path or a file:line');
  // Placeholders the next session cannot fill: <repo>, <your repo>, <absolute path>, <REPO_PATH>, /path/to/repo, $REPO.
  // Not placeholders: generics (Array<Project>), tags with a closing tag (<key>..</key>), components (<KeyboardView>).
  const KEYS = 'repo|path|ruta|folder|carpeta|dir|directory|directorio|branch|rama|sha|commit|id|worktree|site|sitio|token|url|key|llave|clave|project|proyecto';
  const holes = [
    ...(t5.match(new RegExp(`(?<![\\w$])<(?:[a-z]{1,12} ){0,3}(?:${KEYS})s?\\b[a-z0-9 _./-]{0,100}>(?![^\\n]*</)`, 'g')) || []),
    ...(t5.match(/(?<![\w$])<(?:REPO|PATH|BRANCH|SHA|TOKEN|URL|KEY|PROJECT|DIR)[A-Z_]*>/g) || []),
    ...(t5.match(/(?:^|[\s"'`(])(?:\/abs\/path\/|\/path\/to\/)[^\s"'`)]*|\$\{?(?:REPO|REPO_PATH|REPO_DIR|PROJECT_DIR)\}?\b|C:\\path\\to\\/gm) || []).map((s) => s.trim()),
  ];
  if (holes.length) failures.push(`section 5 has placeholders instead of real paths or values (${[...new Set(holes)].slice(0, 5).join(', ')}); the next session cannot know what "the repo" is`);
  if (!/\bOK\b|approv|authori|decid|ask|question|A\)|aprob|autoriz|pregunt/i.test(t5)) warnings.push('section 5 does not say what needs the user\'s OK or decision');
}

// --- Template holes ------------------------------------------------------------------------------
const holes = [];
lines.forEach((l, i) => {
  if (/(?<!\$)\{\{[^}]*\}\}/.test(l)) { holes.push(`${i + 1}: ${l.trim().slice(0, 80)}`); return; } // ${{ }} is CI syntax
  if (inFenceAt[i]) return;
  const prose = l.replace(/`[^`]*`/g, '');
  if (/^\s*(?:[-*]|\d+[.)]|\|)?\s*(TODO|TBD|FIXME)\s*:|\[(TODO|TBD|FIXME)\]|<(TODO|TBD|FIXME)>/.test(prose)) holes.push(`${i + 1}: ${l.trim().slice(0, 80)}`);
});
if (holes.length) failures.push(`unfilled template holes (${holes.length}):\n      ${holes.slice(0, 8).join('\n      ')}${holes.length > 8 ? '\n      ...' : ''}`);

// --- Secrets -------------------------------------------------------------------------------------
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
  [/(password|passwd|contrase[nñ]a|api[_-]?key|secret|token)["']?\s*[:=]\s*["']([^"'\s$]{8,})["']/i, 'quoted secret literal'],
  [/(?:^|[\s`'"|(>*-])(?:export\s+)?[A-Za-z0-9_]*(?:PASSWORD|SECRET|TOKEN|API_?KEY)[A-Za-z0-9_]*\s*=\s*(?![$"'`{])[^\s#"'`]{8,}/, 'env-style secret'],
];
lines.forEach((l, i) => {
  for (const [re, name] of SECRET) {
    if (re.test(l)) { failures.push(`possible secret (${name}) on line ${i + 1}: write where it lives instead of the value`); break; }
  }
  const card = l.match(/\b(?:\d[ -]?){13,19}\b/);
  if (card && /card|visa|mastercard|amex|tarjeta/i.test(l)) {
    const digits = card[0].replace(/\D/g, '');
    if (!/^(4242(4242){3}|4000\d{12}|5555555555554444|378282246310005)$/.test(digits)) warnings.push(`line ${i + 1} may contain a card number`);
  }
});

// --- Length --------------------------------------------------------------------------------------
const n = lines.length;
if (minimal) {
  if (n < 15) failures.push(`too short even for minimal mode (${n} lines)`);
} else if (n < 40) failures.push(`too short (${n} lines): a real handoff rarely fits in under 40 (use --minimal for the short one written at a usage limit)`);
else if (n < 90) warnings.push(`short (${n} lines): are failures (section 4) or steps (section 5) missing? Fine if nothing much happened; say so in the final message`);
if (n > 600) warnings.push(`very long (${n} lines): was the transcript pasted? Link documents instead of repeating them`);

// --- Resume phrase -------------------------------------------------------------------------------
if (!/continue from [^\n]*HANDOFF|claude --resume|resume from|contin[uú]a con [^\n]*handoff|retomar/i.test(text)) {
  warnings.push('no resume instruction ("continue from HANDOFF.md" or "claude --resume <id>")');
}

// --- Header time versus the real save time --------------------------------------------------------
const mh = text.match(/(?:Written|Escrito el|Escrito)\s+(?:on\s+)?(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/i);
if (!mh) {
  warnings.push(`the header has no "Written YYYY-MM-DD HH:MM" (now it is ${nowStr})`);
} else {
  const said = new Date(+mh[1], +mh[2] - 1, +mh[3], +mh[4], +mh[5]).getTime();
  const real = statSync(path).mtimeMs;
  const diffMin = Math.round(Math.abs(real - said) / 60000);
  if (diffMin > 3) warnings.push(`the header says ${mh[0].replace(/^\D+/, '')} but the file was saved ${diffMin} min ${real > said ? 'later' : 'earlier'} (now it is ${nowStr})`);
}

// --- Result --------------------------------------------------------------------------------------
console.log(`Handoff: ${path} (${n} lines${minimal ? ', minimal mode' : ''}) · now: ${nowStr}`);
for (const w of warnings) console.log(`  warning: ${w}`);
if (failures.length) {
  console.log(`\nFAIL (${failures.length}):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('\nOK');
process.exit(0);
