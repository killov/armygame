#!/usr/bin/env node
// SessionStart hook: když po restartu Claude Code visí nedokončený běh `/resolve`
// (`.claude/state/resolve-run.json` se `status: "active"`), řekne to nové session.
//
// Proč hook: budík watchdogu je `CronCreate`, který je **session-only** — `durable`
// je podle popisu toolu no-op („nothing is written to disk, and the job is gone when
// Claude exits"). Restartem Claude Code tedy zmizí jediné, co by běh rozjelo, a
// rozdělaný task zůstane viset v `in_progress`. Stavový soubor restart přežije,
// jen o něm nové session nikdo neřekne — od toho je tenhle hook.
//
// Rozhodnutí si hook NEDĚLÁ sám: pustí `classify()` z `.claude/scripts/resolve-watchdog.cjs`
// se svým `session_id`. Bez toho by nová session v témže repu poslala na
// `/resolve-watchdog` i tehdy, když stará session s aktivním během pořád jede — a to je
// přesně ten vstup, ze kterého vznikne druhý Workflow nad jedním working tree.
//
// Registrace: .claude/settings.json → hooks.SessionStart.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

let payload = {};
try {
  payload = JSON.parse(readStdin() || '{}');
} catch {
  process.exit(0); // nečitelný vstup není důvod cokoli hlásit
}

let verdict;
try {
  const { classify, defaultOptions } = require('../scripts/resolve-watchdog.cjs');
  verdict = classify(defaultOptions({ sessionId: payload?.session_id || null }));
} catch {
  process.exit(0); // watchdog, co spadne, je horší než watchdog, co mlčí
}

// Mlčíme na všechno, co nemá akci: `IDLE` (žádný běh), `RUNNING` (běh žije, jen dlouho
// mlčí) i `FOREIGN` (běh patří jiné, pořád živé session).
if (!verdict || verdict.action === 'none') process.exit(0);

const reminder = [
  `Visí nedokončený resolve běh \`${verdict.runId || '?'}\``,
  verdict.scope ? ` (rozsah: ${verdict.scope})` : '',
  verdict.rowId ? `, claimnutý task \`${verdict.rowId}\`` : '',
  `. ${verdict.message}`,
  ' Spusť `/resolve-watchdog` — dotočí ho (`resumeFromRunId`), nebo uklidí board.',
].join('');

process.stdout.write(
  `${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: reminder,
    },
  })}\n`
);
