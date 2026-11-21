---
description: Naprogramuje/opraví kód (Zdena-DEV), nekompromisně zreviewuje (Zdena-CR) a až po APPROVE otestuje přes Playwright (Zdena-QA) v deterministické smyčce přes Workflow engine, dokud CR i QA nejsou spokojení (max 20 kol).
argument-hint: <popis úkolu / odkaz na issue>
---

## Tvůj úkol

Vyřeš zadání spuštěním **Workflow** `resolve` (`.claude/workflows/resolve.js`).
Ten deterministicky odjede orchestraci: levná **triáž** (potřebuje to architekta?) →
u těžkého tasku **Zdena-ARCH** naplánuje → smyčka
**Zdena-DEV** (napíše/opraví kód) → **GATE** (git diff + `typecheck:root` + `test:unit`) →
**Zdena-CR** (nekompromisní review) → až po **CR: APPROVE** se pustí **Zdena-QA**
(otestuje přes Playwright), dokud není **CR: APPROVE i QA: PASS** (max 20 kol).
Brány jedou levné → drahé sekvenčně: na červeném GATE se CR/QA nepustí, na
REQUEST_CHANGES se drahé živé QA nepustí. Rozhodování o markerech, feedback loop
i pořadí bran řeší skript — ty ho jen spustíš se správným zadáním a nakonec
česky shrneš výsledek.

Sám kód **needituješ, netestuješ ani nereviewuješ** — to dělají agenti uvnitř
workflow. S uživatelem mluv česky, stručně.

Zadání: $ARGUMENTS

### Setup

1. Když je `$ARGUMENTS` prázdné a z konverzace není jasné, co se má vyřešit — zeptej se.
2. Zjisti výchozí stav pro pozdější diff (a jako `base` pro CR ve workflow):
   - Branch: !`git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "no-git"`
   - Stav: !`git status --short 2>/dev/null`
   - Provider: !`case "${ANTHROPIC_BASE_URL:-}" in *workmux-*-proxy*) echo proxy;; *) echo claude;; esac`
3. Pokud jsi na `main`/`master` a hrozí commit, **nepouštěj commit bez dotazu** —
   `/resolve` jen připraví rozpracovaný working tree, commit nechává na uživateli.

### Spuštění workflow

Zavolej **Workflow** tool:

```
Workflow({
  scriptPath: ".claude/workflows/resolve.js",
  args: { task: "<celé zadání jako text>", base: "<volitelně diff base, např. HEAD nebo origin/master>", provider: "<proxy|claude ze Setupu>" }
})
```

- `args.task` = kompletní zadání (to, co bys jinak řešil ručně — popis + relevantní kontext z konverzace).
- `args.base` je volitelný; nech prázdné, když CR má reviewovat `git diff` proti aktuálnímu indexu.
- `args.provider` = hodnota řádku „Provider" ze Setupu. Vybírá patro modelu pro ARCH:
  `claude` = ARCH na hlavním modelu, `proxy` = ARCH na prostředním patře (proměřeno
  na Codexu: ARCH 33 kol → 8 kol při lepším plánu). GATE jede vždy na nejlevnějším
  patře (`haiku`) a triáž je deterministická (žádný agent). Když provider nepředáš,
  platí `claude`.
- Workflow běží na pozadí; až doběhne, dostaneš jeho návratový objekt jako výsledek tasku.

### Watchdog

Běh umí skončit v terminálním stavu bez verdiktu (`killed`, `result: null`) a
notifikace o dokončení se k tobě nemusí dostat — pak bys jen stál. Proto **hned po
launchi**:

1. zapiš stav do `.claude/state/resolve-run.json` (`runId` je v synchronní odpovědi
   `Workflow`; tvar má `/resolve-watchdog`, sekce „Stavový soubor" — `rowId` u
   `/resolve` vynech, žádný board tu není),
2. založ budík `CronCreate({ cron: "8,23,38,53 * * * *", recurring: true, prompt: "/resolve-watchdog" })`
   a ID jobu si pamatuj,
3. po výsledku (nebo na „zastav") stav smaž (`rm -f .claude/state/resolve-run.json`)
   a budík zruš (`CronDelete`).

### Návratový objekt workflow

```
{ done, converged, rounds, exhausted, needsClarification, questions, needsManualQa,
  qaSkipped, budgetStopped, scopeCreep, qa, cr, changedFiles, plan, lastQaReport,
  lastQaSpec, lastQaMobileNotes, lastCrComments, followUps }
```

- `done: true` → smyčka zkonvergovala (`qa: "PASS"`, `cr: "APPROVE"`).
- **`qaSkipped: true`** (chodí spolu s `done: true` a `qa: "SKIPPED"`) → CR dal APPROVE
  a živé QA se **vědomě nepouštělo**, protože se kolo dotklo jen souborů bez povrchu
  v prohlížeči (dokumentace, `.claude/`, unit testy — ty už zeleně prohnal GATE).
  Není to fake PASS ani `needsManualQa` (není co proklikat). Rozhoduje o tom skript
  podle cest, ne úsudek agenta; Playwright `*.spec.ts` mezi ně **nepatří**. V shrnutí
  to zmiň jednou větou, ať je vidět, že prohlížeč neběžel.
- **`needsManualQa: true`** → QA to nezvládla ověřit na 3 pokusy (kód prošel **CR:
  APPROVE**, jen se živě nepotvrdil — křehké/nesestavitelné prostředí, flaky flow).
  **NENÍ to fake fail ani úspěch** — potřebuje **ruční otestování**. Řekni to
  uživateli fakticky, přilož `lastQaReport` (co poslední QA zkoušela a proč padla)
  + `changedFiles` (co má člověk otestovat). Protějšek brain stavu „K ručnímu
  otestování", který používá `/resolve-tasks`.
- **`needsClarification: true`** → Zdena-ARCH narazil na zásadní nejasnost v zadání a
  smyčka se **záměrně nespustila** (nehádá se). Rozsah navázaného tasku (blocks /
  blocked by) mezi otázky nepatří — patří tomu tasku, neptej se na něj. **NENÍ to selhání.** Polož uživateli
  otázky z `questions` (přes **AskUserQuestion**), a jakmile odpoví, **spusť Workflow
  znovu** s doplněným zadáním (`args.task` = původní zadání + odpovědi). Tenhle stav
  je protějšek brain stavu „Čeká na upřesnění", který používá `/resolve-tasks` v
  autonomním běhu, kde se uživatele zeptat nejde.
- `exhausted: true` → vyčerpáno 20 kol bez konvergence → vypiš zbývající blokery
  (`lastQaReport` + `lastCrComments`) k ručnímu rozhodnutí, faktickým tónem.
- **`scopeCreep: true`** → CR třikrát po sobě ukázal na úplně jinou sadu souborů než
  minule. To není konvergence, ale rozlézání scopu (typicky „projdi celou oblast"
  task bez uzavřené definice hotového) — smyčka se zastavila schválně, aby to
  nemlátila donekonečna. Rozdělaná práce je ve stromu. Řekni uživateli, že task
  potřebuje ohraničit („hotovo = kdy?"), a přilož `lastCrComments`.
- **`budgetStopped: true`** → došel token rozpočet zadaný uživatelem („+500k"),
  smyčka skončila řízeně po posledním dokončeném kole. Rozdělaná práce je ve
  stromu; napiš, kde to stojí (`cr` / `qa` / `lastCrComments`).
- `done: false` bez `exhausted`/`needsClarification`/`needsManualQa`/`scopeCreep`/
  `budgetStopped` → smyčka se přerušila (DEV opakovaně selhal / prázdné zadání
  `error`) → řekni proč a co dál.
- **`followUps`** → platné nálezy CR **mimo** změněné řádky (stejný hřích jinde,
  starší dluh). Verdikt neblokovaly. Když je pole neprázdné, nabídni je uživateli
  jako námět na samostatný task — nezahazuj je a nezačínej je řešit v tomhle běhu.

### Pravidla (garantuje je workflow, nepřekresluj je)

- **Triáž na začátku je deterministická** (heuristika ve skriptu, žádný agent —
  agentní triáž rozhodla 17/20 běhů „heavy" a jen stála tokeny). `light` = krátké
  zadání s konkrétní kotvou (1–3 soubory) mimo sdílené seamy → ARCH se přeskočí a
  DEV si to naplánuje při psaní (jinak platíš pochopení repa dvakrát: ARCH ho
  přečte, plán předá textem a DEV čte ty samé soubory znovu). V pochybnostech
  jede `heavy`.
- **`QA: PASS` bez reálného proklikání v prohlížeči neexistuje.** Zdena-QA testuje
  živou aplikaci přes Playwright MCP; nerozjeté prostředí / neproklikatelný flow =
  legitimní `QA: FAIL`, který smyčka nesmí uzavřít jako úspěch. FAIL čistě kvůli
  prostředí (`failKind: env`) ale neroztáčí nové kolo DEV → GATE → CR — skript
  zopakuje jen QA (max 2 env retry); když prostředí nejde rozjet ani pak, jde
  task rovnou do `needsManualQa` (další DEV kolo na nezměněném stromu by ho
  nerozjelo taky). Než QA vrátí `failKind: env`, musí projít recovery postup
  (spadlý sidecar → `start_session_container`; běžící, ale rozbitý sidecar →
  `session_container_logs` → `session_container_action` restart →
  `recreate_session_container` s `wipeVolumes: true`; `_ping`, `workmux:daemon`) a vyplnit
  `envRecovery`. `envRecovery: failed` = recovery nepomohlo → skript už žádný env
  retry nedělá a vrátí `envDead: true` (+ `envDeadReason`): řekni uživateli, že
  prostředí potřebuje zásah z hostu (dind nejde nahodit zevnitř).
- **Mobil / iPad / touch / diktování se DÁ ověřit** (Zdena-QA přes CDP: device
  metrics, `Input.dispatchTouchEvent`, `synthesizePinchGesture`, composition eventy) —
  neber takové zadání předem jako neověřitelné.
- Brány jsou sekvenční s prioritou levné → drahé: **GATE** (typecheck+unit) →
  **CR** → **QA**. Stačí, že kterákoli řekne ne, a jede další kolo; CR má přednost
  před QA (na REQUEST_CHANGES se drahé živé QA vůbec nespustí). Konvergence =
  **CR: APPROVE i QA: PASS** ve stejném kole.
- Změněné soubory i zeleň typecheck/unit měří samostatný **GATE** agent z gitu, ne
  DEVův self-report — DEV si výsledek buildu nevymyslí. GATE jede na levném modelu
  a je jediný, kdo pouští plnou unit sadu: DEV i CR mají zakázáno ji pouštět znovu
  (DEV si dá `tsc` + zasažené testy, CR dostane výsledek brány v promptu).
- **CR blokuje jen nálezy ve změněných řádcích** (`blockers`). Co najde mimo diff,
  jde do `followUps` a smyčku nezdržuje — jinak se sweep tasky točí donekonečna.

### Výstup uživateli (po skončení)

Česky, stručně: počet kol (`rounds`), finální verdikty (`qa` / `cr`), seznam
změněných souborů (`changedFiles`). Při `exhausted` přidej zbývající blokery.
Žádné marketing fráze, žádné emoji.
