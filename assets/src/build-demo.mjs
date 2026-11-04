#!/usr/bin/env node
// build-demo.mjs: writes ../demo.svg, an animated terminal (CSS keyframes only, no script) that loops
// a /handoff shutdown and the next-morning resume. GitHub renders it inside <img>, so: system mono
// fonts only, no external resources, and a static final frame under prefers-reduced-motion.
//
//   node assets/src/build-demo.mjs

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// OKLCH → sRGB hex (same palette as banner.html).
function oklch(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const enc = (x) => {
    const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  };
  return '#' + lin.map(enc).join('');
}

const C = {
  bg: oklch(0.165, 0.012, 150),
  surface: oklch(0.205, 0.014, 150),
  line: oklch(0.3, 0.016, 150),
  ink: oklch(0.955, 0.008, 150),
  muted: oklch(0.74, 0.014, 150),
  dim: oklch(0.56, 0.014, 150),
  signal: oklch(0.82, 0.17, 150),
};

const T = 20; // loop length in seconds
const W = 960, H = 316, X = 34, Y0 = 92, LH = 27, FS = 14.5, CHAR = 0.62 * FS;

// Each line: [time it appears (s), act, segments[[text, color]], typed?]
const ACT1_END = 9.4, ACT2_END = 19.3;
const lines = [
  [0.3, 1, [['> ', 'dim'], ['/handoff', 'ink']], true],
  [1.3, 1, [['Stopping with /handoff. Running: review round 2 (~3 min). Starting nothing new.', 'ink']]],
  [2.5, 1, [['  ✓ ', 'signal'], ['waited for the review'.padEnd(25), 'ink'], ['4 findings tabulated, 0 fixed', 'dim']]],
  [3.4, 1, [['  ✓ ', 'signal'], ['repo-state'.padEnd(25), 'ink'], ['fix/webhook-idempotency @ 9f3c2a1 · no secrets', 'dim']]],
  [4.3, 1, [['  ✓ ', 'signal'], ['local commit'.padEnd(25), 'ink'], ['a41d7e0  WIP: e2e isolation per worker', 'dim']]],
  [5.2, 1, [['  ✓ ', 'signal'], ['HANDOFF.md'.padEnd(25), 'ink'], ['5 sections · check-handoff: OK', 'dim']]],
  [6.4, 1, [['Nothing pushed or deployed. Next session, say: ', 'muted'], ['continue from HANDOFF.md', 'signal']]],
  [9.9, 2, [['next morning, fresh session', 'dim']]],
  [10.4, 2, [['$ ', 'dim'], ['claude', 'ink']], true],
  [11.3, 2, [['  Handoff waiting: ledgerline: idempotent payment webhook (STOPPED AT USAGE LIMIT, 9 h ago)', 'muted']]],
  [12.2, 2, [['> ', 'dim'], ['continue from HANDOFF.md', 'ink']], true],
  [13.9, 2, [['  ✓ ', 'signal'], ['HEAD a41d7e0 matches section 2 · tree clean', 'ink']]],
  [14.8, 2, [['  ✓ ', 'signal'], ['read section 4: retry only 429/5xx; the limit is 60 s, not 10 s', 'ink']]],
  [15.8, 2, [['  → ', 'signal'], ['step 1 of 5: fix F1 and F2 now, or log them as known issues? (A/B)', 'ink']]],
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pct = (s) => `${Math.min(100, Math.max(0, (s / T) * 100)).toFixed(3)}%`;

let css = '';
let body = '';
const rowOf = { 1: 0, 2: 0 };

lines.forEach(([t, act, segs, typed], i) => {
  const row = rowOf[act]++;
  const y = Y0 + row * LH;
  const end = act === 1 ? ACT1_END : ACT2_END;
  const fadeIn = 0.22, fadeOut = 0.35;
  css += `@keyframes l${i}{0%,${pct(t)}{opacity:0;transform:translateY(3px)}${pct(t + fadeIn)},${pct(end)}{opacity:1;transform:translateY(0)}${pct(end + fadeOut)},100%{opacity:0;transform:translateY(0)}}\n`;
  css += `.l${i}{animation:l${i} ${T}s cubic-bezier(.23,1,.32,1) infinite}\n`;
  const tspans = segs.map(([txt, col]) => `<tspan fill="${C[col]}">${esc(txt)}</tspan>`).join('');
  let mask = '';
  if (typed) {
    // A block the colour of the window slides right, step by step, uncovering the command as if typed.
    const prefix = segs[0][0].length, cmd = segs.slice(1).map((s) => s[0]).join('').length;
    const mx = Math.floor(X + prefix * CHAR - 1), mw = cmd * CHAR + 14, dur = Math.max(0.35, cmd * 0.045);
    css += `@keyframes m${i}{0%,${pct(t + 0.15)}{transform:translateX(0);animation-timing-function:steps(${cmd},end)}${pct(t + 0.15 + dur)}{transform:translateX(${mw.toFixed(1)}px);opacity:1}${pct(t + 0.2 + dur)},100%{transform:translateX(${mw.toFixed(1)}px);opacity:0}}\n`;
    css += `.m${i}{animation:m${i} ${T}s linear infinite}\n`;
    mask = `<rect class="mask m${i}" x="${mx.toFixed(1)}" y="${Math.round(y - FS - 1)}" width="${Math.ceil(mw)}" height="${Math.round(FS + 8)}" fill="${C.surface}"/>`;
  }
  const isDivider = act === 2 && row === 0;
  const textEl = isDivider
    ? `<line x1="${X}" y1="${y - 5}" x2="${W / 2 - 130}" y2="${y - 5}" stroke="${C.line}"/><text x="${W / 2}" y="${y}" text-anchor="middle">${tspans}</text><line x1="${W / 2 + 130}" y1="${y - 5}" x2="${W - X}" y2="${y - 5}" stroke="${C.line}"/>`
    : `<text x="${X}" y="${y}" xml:space="preserve">${tspans}</text>`;
  body += `  <g class="a${act} l${i}">${textEl}${mask}</g>\n`;
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d">
<title id="t">/handoff demo</title>
<desc id="d">A terminal runs /handoff: it announces it is stopping, waits for a running review, checks repo state, makes a local WIP commit, writes and lints HANDOFF.md, and says nothing was pushed. Next morning, a fresh session shows the waiting handoff, checks the git state, reads what failed, and asks the first A/B question.</desc>
<style>
text{font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;font-size:${FS}px;white-space:pre}
.a1,.a2{opacity:0}
${css}@media (prefers-reduced-motion:reduce){.a1{animation:none!important;opacity:1;transform:none}.a2{display:none}.mask{display:none}}
</style>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="16" fill="${C.surface}" stroke="${C.line}"/>
<path d="M16.5 0.5H${W - 16.5}A16 16 0 0 1 ${W - 0.5} 16.5V44.5H0.5V16.5A16 16 0 0 1 16.5 0.5Z" fill="${C.bg}"/>
<line x1="0.5" y1="44.5" x2="${W - 0.5}" y2="44.5" stroke="${C.line}"/>
<circle cx="24" cy="22.5" r="5.5" fill="${C.line}"/><circle cx="43" cy="22.5" r="5.5" fill="${C.line}"/><circle cx="62" cy="22.5" r="5.5" fill="${C.line}"/>
<text x="${W / 2}" y="27" text-anchor="middle" fill="${C.dim}" style="font-size:13px">claude · ~/code/ledgerline</text>
${body}</svg>
`;

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'demo.svg');
writeFileSync(out, svg);
console.log(`wrote ${out} (${svg.length} bytes)`);
