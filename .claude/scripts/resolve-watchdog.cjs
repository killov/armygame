#!/usr/bin/env node
// Watchdog nad orchestrací `/resolve` a `/resolve-tasks`: rozhodne ZE SOUBORŮ, jestli
// běh Workflow žije, umřel bez verdiktu, nebo doběhl a jen se k orchestrátorovi
// nedostal výsledek. Dřív to model odhadoval z pocitu („fronta se nehýbe"), což
// znamenalo, že zabitý běh stál do rána a živý běh se restartoval.
//
// Na čem to stojí (změřeno na artefaktech session `fa7145ed`, ne odhad):
//   - `workflows/wf_<runId>.json` se zapíše AŽ v terminálním stavu — u všech 7 běhů
//     sedí mtime na konec běhu (`wf_401b952d-a8f`: 121 min běhu, jediný zápis).
//     Žádný soubor se `status: "running"` neexistuje, takže „běží?" z něj nezjistíš.
//   - Živost se čte z `subagents/workflows/<runId>/` — `agent-*.jsonl` a `journal.jsonl`
//     se tam appendují průběžně (zabitý `wf_4d6aa1e0-ad8` má poslední řádek agenta
//     07:05:55, kill v 07:06).
//   - `journal.jsonl` nemá timestampy, proto se čas bere z mtime souborů.
//
// Záměrně .cjs, ne .mjs: modul si bere node CLI i jest unit test
// (`tests/unit/resolve-watchdog.test.ts`), a ten jede v CJS. Stejný důvod jako
// u `scripts/gotchas-refs.cjs`, podle kterého je tenhle modul postavený.
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");

const MIN = 60_000;

/**
 * Jak dlouho smí živý agent mlčet, než ho prohlásíme za mrtvého. Měřeno přes všech
 * 391 agent transcriptů: cluster na 10,0 min (strop jednoho Bash tool callu),
 * `jest unit` 8,5–9,0 min a outlier 30,0 min (`mcp__playwright__browser_evaluate`
 * doběhl na MCP timeoutu). 45 min je nad outlierem s rezervou — falešné „mrtvý"
 * znamená druhý Workflow nad jedním working tree, což je nejdražší možná chyba.
 */
const STALE_MIN = 45;

/** Strop restartů na jeden `runId` — jinak běh, co umře hned po startu, točí smyčku. */
const MAX_RESTARTS = 2;

/** Session transcript má i stovky MB; limitní hlášku hledáme jen v ocasu. */
const TAIL_BYTES = 256 * 1024;

/**
 * Slug projektu v `~/.claude/projects/`. Pravidlo zkopírované z `claudeProjectSlug`
 * (`src/lib/docker/claude-hooks.ts`) — TS se odtud importovat nedá.
 */
function claudeProjectSlug(cwd) {
  return cwd.replace(/[^a-zA-Z0-9]/g, "-");
}

/** Cokoli nečitelného je `null`. Watchdog, co spadne, je horší než watchdog, co mlčí. */
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function statSafe(target) {
  try {
    return fs.statSync(target);
  } catch {
    return null;
  }
}

/** Stav běhu, který si orchestrátor zapsal po launchi Workflow. */
function readRunState(stateFile) {
  const state = readJson(stateFile);
  if (!state || typeof state !== "object" || Array.isArray(state)) return null;
  return state;
}

/** `wf_x` i `x` beru stejně — runId z odpovědi toolu prefix má, ručně psaný nemusí. */
function normalizeRunId(runId) {
  if (!runId) return null;
  const id = String(runId).trim();
  if (!id) return null;
  return id.startsWith("wf_") ? id : `wf_${id}`;
}

/**
 * Adresář s průběžnými artefakty běhu. Bez `runId` (stav ho nemá) padáme na nejnovější
 * adresář v session — to je ten, který se rozjel naposledy.
 */
function findRunDir(sessionDir, runId) {
  const base = path.join(sessionDir, "subagents", "workflows");
  const id = normalizeRunId(runId);
  if (id) {
    const dir = path.join(base, id);
    return statSafe(dir)?.isDirectory() ? dir : null;
  }
  let entries;
  try {
    entries = fs.readdirSync(base, { withFileTypes: true });
  } catch {
    return null;
  }
  let newest = null;
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("wf_")) continue;
    const dir = path.join(base, entry.name);
    const at = lastProgressAt(dir);
    if (at !== null && (newest === null || at > newest.at)) newest = { dir, at };
  }
  return newest?.dir ?? null;
}

/** Nejmladší zápis v adresáři běhu (mtime adresáře i souborů v něm), v ms. */
function lastProgressAt(runDir) {
  if (!runDir) return null;
  const dirStat = statSafe(runDir);
  if (!dirStat?.isDirectory()) return null;
  let newest = dirStat.mtimeMs;
  let names;
  try {
    names = fs.readdirSync(runDir);
  } catch {
    return newest;
  }
  for (const name of names) {
    const st = statSafe(path.join(runDir, name));
    if (st && st.mtimeMs > newest) newest = st.mtimeMs;
  }
  return newest;
}

/** Terminální artefakt běhu, nebo `null`, když běh ještě neskončil. */
function readTerminalRun(sessionDir, runId) {
  const id = normalizeRunId(runId);
  if (!id) return null;
  return readJson(path.join(sessionDir, "workflows", `${id}.json`));
}

/** Popis pro komentář na boardu: v kterém kole to umřelo a na čem. */
function describeTerminalRun(run) {
  const progress = Array.isArray(run?.workflowProgress) ? run.workflowProgress : [];
  const last = progress[progress.length - 1];
  if (!last) return null;
  return {
    label: last.label ?? null,
    state: last.state ?? null,
    lastToolName: last.lastToolName ?? null,
  };
}

function readTail(file, maxBytes) {
  const st = statSafe(file);
  if (!st?.isFile()) return "";
  let fd;
  try {
    fd = fs.openSync(file, "r");
    const length = Math.min(st.size, maxBytes);
    const buf = Buffer.alloc(length);
    fs.readSync(fd, buf, 0, length, st.size - length);
    return buf.toString("utf8");
  } catch {
    return "";
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        /* zavření nečteme */
      }
    }
  }
}

/**
 * Poslední odpověď v session transcriptu je hláška o 5h limitu? Ta je strojově čitelná:
 * `type: "assistant"`, `message.model: "<synthetic>"`, text
 * `You've hit your session limit · resets 3am (UTC)`. Vrací i čas resetu — dál ho ale
 * NEpredikujeme, jen hlásíme (odhad „reset + 5 h" je hádání).
 */
function detectSessionLimit(transcriptFile) {
  if (!transcriptFile) return null;
  const lines = readTail(transcriptFile, TAIL_BYTES).split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith("{")) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue; // uříznutý první řádek ocasu
    }
    if (entry?.type !== "assistant") continue;
    const message = entry.message ?? {};
    const text = Array.isArray(message.content)
      ? message.content.map((part) => (part?.type === "text" ? part.text : "")).join("")
      : "";
    if (message.model !== "<synthetic>" || !/hit your session limit/i.test(text)) return null;
    const resets = /resets\s+(.+?)\s*$/i.exec(text);
    return { at: entry.timestamp ?? null, resets: resets ? resets[1] : null, text: text.trim() };
  }
  return null;
}

const ageMin = (now, at) => (at === null || at === undefined ? null : (now - at) / MIN);
const round1 = (value) => (value === null ? null : Math.round(value * 10) / 10);

/**
 * Rozhodovací tabulka watchdogu. Čistá v tom smyslu, že všechno čte z předaných cest —
 * test jí podstrčí falešný strom v `os.tmpdir()`.
 *
 * Pořadí podmínek je pojistka sama o sobě: živý běh vyhrává nad vším ostatním
 * (fail-open na `RUNNING`, vzor bite #169 — ticho je trigger kontroly, ne verdikt).
 */
function classify({ projectDir, sessionId, stateFile, now = Date.now() }) {
  const limit = detectSessionLimit(sessionId ? path.join(projectDir, `${sessionId}.jsonl`) : null);
  const withLimit = (verdict) => (limit ? { ...verdict, limit } : verdict);

  const state = readRunState(stateFile);
  if (!state || state.status !== "active") {
    const verdict = limit
      ? {
          verdict: "LIMIT",
          action: "none",
          message: `watchdog: žádný běh nevisí, ale session narazila na limit (${limit.resets ?? "reset neznámý"}).`,
        }
      : {
          verdict: "IDLE",
          action: "none",
          message: "watchdog: žádný rozdělaný běh (stav chybí nebo je stopped), nedělám nic.",
        };
    return withLimit(verdict);
  }

  const ownerSession = state.sessionId || sessionId || null;
  if (!ownerSession) {
    return withLimit({
      verdict: "IDLE",
      action: "none",
      message: "watchdog: stav běhu nemá sessionId, nemám co číst — nedělám nic.",
    });
  }

  const sessionDir = path.join(projectDir, ownerSession);
  const runDir = findRunDir(sessionDir, state.runId);
  // Bez `runId` ve stavu bereme nejnovější běh session — jeho jméno je zároveň runId.
  const runId = normalizeRunId(state.runId) ?? (runDir ? path.basename(runDir) : null);
  const base = {
    runId,
    rowId: state.rowId ?? null,
    scope: state.scope ?? null,
    restarts: Number.isFinite(state.restarts) ? state.restarts : 0,
  };
  const progressAt = lastProgressAt(runDir) ?? state.startedAt ?? null;
  const progressAge = ageMin(now, progressAt);
  const canResume = base.restarts < MAX_RESTARTS;

  // Cizí orchestrátor: stav si nad stejnou cestou přepsala jiná session. Když ještě
  // žije, je to JEHO běh a jeho úklid — nesaháme na něj (§Souběh v resolve-tasks.md).
  //
  // Čerstvý transcript vlastníka umí akci jen ZAKÁZAT, nikdy povolit: orchestrátor
  // s rozjetým Workflow do transcriptu desítky minut nezapíše nic (bite #579), takže
  // „transcript mlčí" neznamená „session umřela". Proto se pod tímhle `if` na cizí běh
  // dál vztahuje stejný strop ticha jako na vlastní — restart nad cizím ŽIVÝM během by
  // znamenal dva Workflow nad jedním working tree.
  const foreign = Boolean(sessionId) && ownerSession !== sessionId;
  const ownerAge = foreign
    ? ageMin(now, statSafe(path.join(projectDir, `${ownerSession}.jsonl`))?.mtimeMs ?? null)
    : null;
  if (foreign && ownerAge !== null && ownerAge < STALE_MIN) {
    return withLimit({
      ...base,
      verdict: "FOREIGN",
      action: "none",
      message: `watchdog: běh ${runId ?? "?"} patří jiné živé session (${ownerSession}), nedělám nic.`,
    });
  }

  const run = readTerminalRun(sessionDir, runId);
  if (run) {
    const status = run.status ?? null;
    const lastAgent = describeTerminalRun(run);
    if (status === "completed" && run.result !== null && run.result !== undefined) {
      return withLimit({
        ...base,
        verdict: "VERDICT_READY",
        action: "finish",
        runStatus: status,
        result: run.result,
        lastAgent,
        message: `watchdog: běh ${runId} doběhl (status ${status}), ale verdikt se nedojel — doděl ho podle resolve-tasks.md.`,
      });
    }
    return withLimit({
      ...base,
      verdict: "TERMINAL_NO_VERDICT",
      action: canResume ? "resume" : "cleanup",
      runStatus: status,
      runError: typeof run.error === "string" ? run.error.split("\n")[0] : null,
      lastAgent,
      message: canResume
        ? `watchdog: běh ${runId} skončil bez verdiktu (status ${status}), pouštím resumeFromRunId (restart ${base.restarts + 1}/${MAX_RESTARTS}).`
        : `watchdog: běh ${runId} skončil bez verdiktu (status ${status}) a restarty jsou vyčerpané (${base.restarts}/${MAX_RESTARTS}) — uklízím board.`,
    });
  }

  // Bez `wf_*.json` běh buď žije, nebo umřel i s Claude Code (restart) — artefakt by
  // se jinak zapsal. Rozhoduje mtime v adresáři běhu, ne ticho v session; mrtvý běh po
  // restartu Claude Code se chytne nejpozději na stropu ticha.
  if (progressAge === null || progressAge >= STALE_MIN) {
    return withLimit({
      ...base,
      verdict: "DEAD_RESUME",
      action: canResume ? "resume" : "cleanup",
      progressAgeMin: round1(progressAge),
      message: canResume
        ? `watchdog: běh ${runId ?? "?"} je mrtvý (bez zápisu ${round1(progressAge) ?? "?"} min), pouštím resumeFromRunId (restart ${base.restarts + 1}/${MAX_RESTARTS}).`
        : `watchdog: běh ${runId ?? "?"} je mrtvý a restarty jsou vyčerpané (${base.restarts}/${MAX_RESTARTS}) — uklízím board.`,
    });
  }

  const running = {
    ...base,
    verdict: "RUNNING",
    action: "none",
    progressAgeMin: round1(progressAge),
    message: `watchdog: běžím (běh ${runId ?? "?"}, poslední progres před ${round1(progressAge)} min).`,
  };
  if (!limit) return running;
  return {
    ...running,
    verdict: "LIMIT",
    limit,
    message: `${running.message} Session mezitím narazila na limit (${limit.resets ?? "reset neznámý"}).`,
  };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split(/=(.*)/s);
    const value = inline !== undefined ? inline : argv[i + 1];
    if (flag === "--state") out.stateFile = value;
    else if (flag === "--session") out.sessionId = value;
    else if (flag === "--project-dir") out.projectDir = value;
    else continue;
    if (inline === undefined) i++;
  }
  return out;
}

/** Cesty, na kterých watchdog jede v tomhle repu — sdílí je CLI i `SessionStart` hook. */
function defaultOptions(overrides = {}) {
  return {
    projectDir:
      overrides.projectDir ||
      path.join(os.homedir(), ".claude", "projects", claudeProjectSlug(ROOT)),
    sessionId: overrides.sessionId || process.env.CLAUDE_CODE_SESSION_ID || null,
    stateFile: overrides.stateFile || path.join(ROOT, ".claude", "state", "resolve-run.json"),
  };
}

function main(argv) {
  const args = parseArgs(argv);
  const result = classify(defaultOptions(args));
  process.stdout.write(`${result.message}\n${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    // Watchdog nesmí spadnout: nerozhodnutí je mlčení, ne stack trace do tahu.
    process.stdout.write(
      `watchdog: nepodařilo se rozhodnout (${err instanceof Error ? err.message : String(err)}), nedělám nic.\n`
    );
  }
}

module.exports = {
  STALE_MIN,
  MAX_RESTARTS,
  defaultOptions,
  readRunState,
  findRunDir,
  lastProgressAt,
  readTerminalRun,
  detectSessionLimit,
  classify,
};
