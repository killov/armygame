---
description: Watchdog nad orchestrací /resolve a /resolve-tasks — ze souborů zjistí, jestli běh Workflow žije, umřel bez verdiktu, nebo doběhl a jen se k tobě nedostal výsledek, a podle toho ho dojede, restartuje, nebo mlčí.
---

## Tvůj úkol

Jsi **budík** nad rozdělaným během `/resolve` / `/resolve-tasks`. **Nehádej z pocitu,
jestli se fronta hýbe** — rozhodnutí přečti ze souborů, tedy nejdřív Bashem:

```bash
node .claude/scripts/resolve-watchdog.cjs
```

Skript vypíše jednu větu a JSON s verdiktem (`verdict`, `action`, `runId`, `rowId`,
`scope`, `restarts`, `result`, `lastAgent`, `limit`). **Řiď se jím**; vlastní úsudek
o tom, jestli běh žije, si nech — `wf_*.json` vzniká až v terminálním stavu a živost
se měří z mtime v `subagents/workflows/<runId>/`, což z konverzace nepoznáš.

## Co udělat podle `verdict`

- **`IDLE`** / **`FOREIGN`** / **`RUNNING`** → **NIC**. Odpověz jednou větou (`message`
  ze skriptu) a pokračuj v tom, co jsi dělal. U `RUNNING` nezakládej druhý Workflow —
  živý běh umí mlčet i 30 min (dlouhý Bash/MCP tool call).
- **`LIMIT`** → řekni, že session narazila na 5h limit (i `limit.resets`), jinak jako
  `IDLE`/`RUNNING`. Další okno **nepredikuj** — příští fírnutí přijde za ~15 min samo.
- **`VERDICT_READY`** → běh doběhl, jen se ti výsledek nedostal do tahu. Vezmi `result`
  z JSONu a **dojeď ho přesně podle `.claude/commands/resolve-tasks.md`, kroky 3–6**
  (mapování návratového objektu na stavy boardu je tam, nepřepisuj ho sem). Pak stav
  smaž: `rm -f .claude/state/resolve-run.json` a pokračuj frontou — **kromě
  `result.envDead: true`**: to je mrtvé prostředí (krok 5a), takový běh nerestartuj
  ani nezačínej další task, jen zavolej člověka.
- **`action: "resume"`** (`TERMINAL_NO_VERDICT` / `DEAD_RESUME`) → **dotoč běh, nezačínej
  od nuly** (dokončení agenti se berou z cache):

  ```
  Workflow({ scriptPath: ".claude/workflows/resolve.js", resumeFromRunId: "<runId z JSONu>" })
  ```

  Hned po launchi **přepiš stav** novým `runId` a zvýšeným `restarts` (viz níž).
- **`action: "cleanup"`** (restarty vyčerpané) → **uklid board**: když JSON má `rowId`,
  přehoď ten řádek zpět na `todo` (`update_table_row`, cells
  `{ "cmqja3u9q001mjw011c187dne": "todo" }`) a přidej komentář s `runId`, `runStatus`,
  `runError` a `lastAgent` (v kterém kole to umřelo). Pak `rm -f .claude/state/resolve-run.json`.
  **Bez `rowId` (běh z `/resolve`) na board nesahej** — jen to nahlas uživateli.

**Cizí claim je svatý.** Watchdog sahá na board **výhradně na `rowId` ze stavového
souboru**. Žádný jiný `in_progress` řádek nerecykluj, ani když vypadá zaseklý
(pravidlo „Souběh" bod 4 v `resolve-tasks.md`).

## Stavový soubor

`.claude/state/resolve-run.json` (negitovaný, jeden na repo) je jediné strojově čitelné
vlastnictví claimu. Zapisuje ho orchestrátor **hned po launchi Workflow** — `runId` je
v synchronní odpovědi toolu, čekat na výsledek netřeba:

```bash
mkdir -p .claude/state && cat > .claude/state/resolve-run.json <<EOF
{"status":"active","runId":"<runId z odpovědi Workflow>","sessionId":"$CLAUDE_CODE_SESSION_ID",
 "rowId":"<brain rowId, u /resolve vynech>","scope":"<rozsah běhu doslova>",
 "startedAt":$(date +%s)000,"restarts":0}
EOF
```

- Po **každém** přechodu stavu soubor aktualizuj: resume → nové `runId` + `restarts+1`;
  hotovo/úklid → `rm -f`; uživatel řekne „zastav" → `status: "stopped"` (v tomtéž tahu,
  kterým na stop odpovídáš) **a `CronDelete`**. Zabitý běh, který zabil člověk, se
  automaticky rozjet NESMÍ.
- `restarts` má strop 2 na `runId` (`MAX_RESTARTS` ve skriptu) — pak se místo resume
  uklízí board.
