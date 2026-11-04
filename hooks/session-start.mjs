#!/usr/bin/env node
// session-start.mjs: SessionStart hook for the /handoff plugin.
// If a handoff that has not been resumed yet (type: handoff, status not RESUMED) sits in $HANDOFF_PATH,
// the working directory, or the git top level, print a one-line notice for the user and a short note for
// the model. Silent otherwise. It never blocks a session: any error exits 0 with no output.
// Opt out with HANDOFF_NOTICE=off.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function readStdin() {
  try {
    if (process.stdin.isTTY) return {};
    const raw = readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function candidates(cwd) {
  const out = [];
  let env = process.env.HANDOFF_PATH;
  if (env) {
    if (env === '~' || env.startsWith('~/') || env.startsWith('~\\')) env = join(homedir(), env.slice(1));
    try {
      out.push(statSync(env).isDirectory() ? join(env, 'HANDOFF.md') : env);
    } catch { /* ignore a bad path */ }
  }
  out.push(join(cwd, 'HANDOFF.md'));
  const top = spawnSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', timeout: 2000 });
  if (top.status === 0 && top.stdout.trim()) out.push(join(top.stdout.trim(), 'HANDOFF.md'));
  return [...new Set(out.map((p) => resolve(p)))];
}

function field(fm, name) {
  const m = fm.match(new RegExp(`^${name}:\\s*["']?(.*?)["']?\\s*$`, 'm'));
  return m ? m[1].trim() : '';
}

function ago(ms) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 60) return `${Math.max(min, 0)} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

function pending(file) {
  const text = readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) return null; // not written by this skill
  const end = text.indexOf('\n---', 4);
  if (end < 0) return null;
  const fm = text.slice(4, end);
  if (!/^handoff$/i.test(field(fm, 'type'))) return null;
  const status = field(fm, 'status') || 'unknown';
  if (/^(RESUMED|RETOMADO|CLOSED|ARCHIVED)\b/i.test(status)) return null;
  const title = field(fm, 'title').replace(/^HANDOFF:\s*/i, '') || 'untitled';
  const written = text.match(/(?:Written|Escrito el|Escrito)\s+(?:on\s+)?(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/i);
  const when = written
    ? new Date(+written[1], +written[2] - 1, +written[3], +written[4], +written[5]).getTime()
    : statSync(file).mtimeMs;
  return { file, status, title, when };
}

try {
  if (String(process.env.HANDOFF_NOTICE || '').toLowerCase() === 'off') process.exit(0);
  const input = readStdin();
  const cwd = resolve(input.cwd || process.cwd());

  let found = null;
  for (const file of candidates(cwd)) {
    if (!existsSync(file)) continue;
    try { found = pending(file); } catch { found = null; }
    if (found) break;
  }
  if (!found) process.exit(0);

  const rel = relative(cwd, found.file);
  const shown = rel && !rel.startsWith('..') && !isAbsolute(rel) ? rel : found.file;
  const notice = `Handoff waiting: ${found.title} (${found.status}, ${ago(found.when)}). To pick it up, say: continue from ${shown}`;
  const context =
    `A session handoff file exists at ${found.file} (status: ${found.status}). ` +
    'Do not act on it unless the user asks to continue or resume. When they do, read it in full and follow ' +
    'the "Resuming from a handoff" section of the handoff skill: check git state against section 2, ' +
    're-read section 4 before touching code, start at step 1 of section 5, then set its status to RESUMED.';

  process.stdout.write(JSON.stringify({
    systemMessage: notice,
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context },
  }));
  process.exit(0);
} catch {
  process.exit(0);
}
