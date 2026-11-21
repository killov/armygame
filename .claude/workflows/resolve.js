export const meta = {
  name: 'resolve-loop',
  description: 'Engine za /resolve: triáž (u těžkého tasku Zdena-ARCH naplánuje), pak deterministická smyčka DEV → GATE → CR → (až po APPROVE) QA v killov stylu, dokud CR: APPROVE && QA: PASS (max 20 kol)',
  phases: [
    { title: 'Plán', detail: 'deterministická triáž (lehký/těžký režim, nula tokenů) → u těžkého Zdena-ARCH přečte kód a vrátí implementační plán' },
    { title: 'Smyčka', detail: 'Zdena-DEV napíše kód → GATE (git+tsc+unit) → Zdena-CR review → až po APPROVE Zdena-QA (Playwright)' },
  ],
}

// --- vstup ---------------------------------------------------------------
// args: { task: string, base?: string }  nebo rovnou string se zadáním.
const TASK = (typeof args === 'string' ? args : args?.task)?.trim()
const BASE = typeof args === 'object' && args ? (args.base || '') : ''
// Patra modelů pro levné fáze. Mapa je PER PROVIDER, protože `resolve.js` jede
// na claude i na proxy session (codex/grok/openrouter) a jejich patra nejsou
// zaměnitelná — `sonnet`/`haiku` se u proxy překládají přes
// ANTHROPIC_DEFAULT_{SONNET,HAIKU}_MODEL na úplně jiné modely.
//
// Na CLAUDE session: hlavní model na DEV/CR/QA/ARCH, GATE na `haiku` — GATE jen
// pouští tři příkazy a čte ocas výstupu, žádný úsudek (proměřeno 15. 9. 2026 nad
// 20 běhy: GATE na sonnetu = 70 volání / 2,2 M tokenů, avg 32k — většina byl
// nezkrocený výstup test:unit, ne model; ocasy výstupu to řeší, haiku stačí).
//
// Na PROXY session je odchylka PROMĚŘENÁ (4. 9. 2026, Codex Plus, tentýž task
// dvakrát): ARCH bez pinu dědil hlavní model a byl nejdražší položka běhu
// (33 kol / 3,55 M tokenů), na prostředním patře odjel 8 kol / 0,80 M — a plán
// byl lepší, našel navíc bug, který dražší běh nezmínil. Ta kola nebyla práce,
// bylo to čtení repa.
//
// `args.provider` dodává `/resolve` (viz .claude/commands/resolve.md). Když
// chybí (starší volání), platí claude mapa — fail-safe k dosavadnímu chování.
const PROXY_SESSION = args?.provider === 'proxy'
const MODELS = {
  // undefined = bez pinu, tzn. dědí hlavní model session (na claude Opus).
  arch: PROXY_SESSION ? 'sonnet' : undefined,
  gate: 'haiku',
}
log(`patra modelů: ${PROXY_SESSION ? 'proxy' : 'claude'} — ARCH=${MODELS.arch ?? 'hlavní model'}, GATE=${MODELS.gate}`)

const MAX_ROUNDS = 20
// Kolikrát smí QA selhat (FAIL při schváleném CR), než to vzdáme automaticky a
// pošleme task k ručnímu otestování — místo mlácení do 20 kol na něčem, co se
// živě neověří (křehké/nesdrojitelné prostředí, flaky flow).
const MAX_QA_FAILS = 3
// FAIL kvůli PROSTŘEDÍ (server nenaběhl, dind nespojený, stale .next) není bug
// v kódu — točit kvůli němu celé kolo DEV → GATE → CR (~210k tokenů) je plýtvání.
// Místo toho se QA zopakuje rovnou (kód se nezměnil), max tolikrát:
const MAX_QA_ENV_RETRIES = 2
// Od tohoto kola dostane CR pokyn blokovat UŽ JEN skutečné blokery (korektnost,
// bezpečnost, ztráta dat). Stylové a konvenční věci od té chvíle patří do
// `followUps` — jinak se dlouhé běhy utopí v kosmetice.
//
// Proč 2, ne 4 (proměřeno 15. 9. 2026 nad 20 běhy): 13/20 běhů skončilo PŘESNĚ
// v kole, kdy strict nastoupil — kola 2–3 byla kosmetický ping-pong (1–4 drobné
// blockery/kolo), který strict režim stejně smetl do follow-upů. Kolo 1 zůstává
// plný režim (první pohled na diff má největší hodnotu), od kola 2 už jen
// skutečné blokery. Nálezy se neztrácí — jdou do `followUps` na board.
const STRICT_CR_FROM_ROUND = 2
// Kolikrát po sobě smí CR ukázat na úplně jinou sadu souborů než minule, než to
// vyhodnotíme jako rozlézání scopu (whack-a-mole) a smyčku zastavíme. Ne každý
// REQUEST_CHANGES je pokrok — když se cíl kolo co kolo stěhuje jinam, tenhle
// task potřebuje uzavřenou definici hotového od člověka, ne další kolo.
const MAX_CREEP_ROUNDS = 3
// Cesty bez pozorovatelného povrchu v běžící appce: dokumentace, konfigurace agentů
// a UNIT testy (ty už zeleně proběhly v GATE). Když se kolo dotklo JEN jich, bootovat
// kvůli tomu appku a prohlížeč je čistá režie. Playwright `*.spec.ts` sem schválně
// NEPATŘÍ — ten GATE nepouští, takže ho musí prohnat QA.
const NO_RUNTIME_SURFACE = [
  /(^|\/)docs?\//i,
  /\.mdx?$/i,
  /(^|\/)\.claude\//,
  /(^|\/)__tests__\//,
  /\.test\.[cm]?[jt]sx?$/,
]
const hasNoRuntimeSurface = (f) => NO_RUNTIME_SURFACE.some((re) => re.test(f))
// Cesty s LAYOUTEM — užší než „má runtime povrch": `src/lib/**` nebo API routa
// běží, ale na mobilu nemají co rozbít. U těchhle změn QA PASS bez mobilního
// průchodu (390×844) nepřijmeme — detail tasku na stagingu 2026-09-29 psal
// titulek po písmenkách a desktopové QA to nevidělo.
const UI_SURFACE = [
  /^src\/components\//,
  /^src\/app\/(?!api\/)/,
  /\.css$/i,
  /(^|\/)tailwind\.config\./,
]
const hasUiSurface = (f) => UI_SURFACE.some((re) => re.test(f))
// Kolik tokenů si necháváme na dojetí (poslední GATE + úklid), když uživatel
// zadal rozpočet přes "+Nk". Pod tuhle hranici další kolo nepouštíme.
const BUDGET_RESERVE = 80_000

if (!TASK) {
  return { done: false, error: 'Prázdné zadání — Workflow resolve dostal `args.task` prázdné.' }
}

// --- schémata (nahrazují parsování textových markerů) --------------------
const ARCH_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    plan: { type: 'string', description: 'Implementační plán v odrážkách: co se mění, kam patří (vrstva/seam), co znovupoužít, postup, co má QA otestovat, rizika, co je mimo scope.' },
    files: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          path: { type: 'string', description: 'Cesta k souboru (repo-relativní).' },
          why: { type: 'string', description: 'Krátce co se v něm mění a proč.' },
        },
        required: ['path'],
      },
      description: 'Soubory, kde se pravděpodobně bude měnit — DEV má odkud začít. Ber to jako „začni tady", NE tvrdý whitelist (u cross-cutting změn můžou přibýt). Vyplň i řádky/kotvy do `why`, když je znáš.',
    },
    openQuestions: { type: 'array', items: { type: 'string' }, description: 'JEN zásadní nejasnosti v ZADÁNÍ, kde bys musel HÁDAT zamýšlené chování a špatný odhad = zahozený DEV/QA/CR cyklus (ne technikálie — ty řeš konvencemi). Když je pole neprázdné, smyčka se NEspustí a task jde k upřesnění — piš sem konkrétní otázky, ne obecné pochybnosti. Jinak prázdné.' },
  },
  required: ['plan'],
}
const DEV_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    summary: { type: 'string', description: 'Krátké česky shrnutí co a proč ses změnil (2–4 věty).' },
    changedFiles: { type: 'array', items: { type: 'string' }, description: 'Cesty souborů, které ses vědomě změnil (orientační — pravdu stejně změří GATE z gitu).' },
    dismissed: { type: 'array', items: { type: 'string' }, description: 'CR/QA body, na které ses vědomě rozhodl nereagovat, s důvodem (jinak prázdné).' },
  },
  required: ['summary', 'changedFiles'],
}
// GATE: samostatný levný agent — jediný zdroj pravdy o změněných souborech a zeleni
// typecheck/unit. DEV si to nereportuje sám (nemá důvod nelhat), tohle to změří z repa.
const GATE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    changedFiles: { type: 'array', items: { type: 'string' }, description: 'Reálný seznam změněných/přidaných souborů ve working tree (z `git status --porcelain`, včetně untracked).' },
    typecheckOk: { type: 'boolean', description: 'Skutečný exit `npm run typecheck:root` (plný root tsc se stropem haldy) == 0.' },
    unitOk: { type: 'boolean', description: 'Skutečný exit `npm run test:unit` == 0.' },
    details: { type: 'string', description: 'Když je typecheck NEBO unit červený: výtah z výstupu (ocas s chybami). Jinak prázdné.' },
  },
  required: ['changedFiles', 'typecheckOk', 'unitOk'],
}
const QA_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    verdict: { type: 'string', enum: ['PASS', 'FAIL'] },
    failKind: { type: 'string', enum: ['bug', 'env'], description: 'Jen u FAIL: `bug` = appka se chová špatně (flow doklikán, chování neodpovídá zadání). `env` = nedostal ses k ověření chování — server/dind nenaběhl, stale .next, port mrtvý, spec infra. Když sis flow proklikal a padlo chování, je to `bug` i kdyby prostředí zlobilo.' },
    report: { type: 'string', description: 'Co jsi v prohlížeči proklikal a jak to dopadlo; u FAIL konkrétně který krok a proč (co jsi čekal vs. co přišlo).' },
    spec: { type: 'string', description: 'Jaký Playwright *.spec.ts jsi přidal/rozšířil (tests/cloud/) a s jakým výsledkem (npx playwright test běh), nebo proč to nešlo.' },
    mobileChecked: { type: 'boolean', description: '`true` jen když jsi dotčený flow reálně prošel i v mobilním viewportu 390×844 (mobile + touch emulace) včetně kontroly přetečení. U změny bez UI povrchu `false`.' },
    mobileNotes: { type: 'string', description: 'Výsledek mobilního průchodu: `scrollWidth − clientWidth` na dotčených obrazovkách, pojmenovaní viníci přetečení / text zalomený po písmenech, cesta k mobilnímu screenshotu. U změny bez UI povrchu proč se mobil netestoval.' },
    envRecovery: { type: 'string', enum: ['recovered', 'failed', 'not_needed'], description: 'Recovery prostředí (Zdena-QA, „Když prostředí nenaběhne"): `recovered` = něco leželo (typicky exited `dind`) a nahodil(a) jsi to (`start_session_container` → `_ping` → `workmux:daemon`; běžící, ale rozbitý sidecar `session_container_logs` → `session_container_action` restart → `recreate_session_container` s `wipeVolumes: true`), `failed` = recovery postup jsi prošel(a) celý a prostředí pořád nežije, `not_needed` = prostředí běželo.' },
    envRecoveryNote: { type: 'string', description: 'Co přesně jsi při recovery zkoušel(a) a s jakým výsledkem (stav sidecarů, odpověď `start_session_container` / `session_container_action` / `recreate_session_container`, `_ping`, `✔ connected`).' },
  },
  // mobileChecked/mobileNotes/envRecovery záměrně ne v `required` — tolerance k agentům/běhům, co je ještě neznají.
  required: ['verdict', 'report'],
}
// CR vrací DVA seznamy, ne jeden. `blockers` drží verdikt, `followUps` ne —
// jinak review u „projdi celou oblast" tasků nikdy nedojde ke konci: každé kolo
// najde další hřích v sousedním souboru, DEV ho opraví, tím rozšíří diff a dá
// CR novou plochu ke kritice. Nález mimo změněné řádky je platný, ale patří na
// board jako follow-up, ne do další iterace.
const CR_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    verdict: { type: 'string', enum: ['APPROVE', 'REQUEST_CHANGES'] },
    blockers: { type: 'array', items: { type: 'string' }, description: 'JEN nálezy ve změněných řádcích diffu, formát `soubor:řádek — komentář` (killov styl, bez tečky, bez chvály). Tyhle drží REQUEST_CHANGES. U APPROVE prázdné.' },
    followUps: { type: 'array', items: { type: 'string' }, description: 'Nálezy MIMO změněné řádky (sousední komponenty, stejný hřích jinde, starší dluh). Stejný formát. NEBLOKUJÍ verdikt — propadnou do reportu jako námět na samostatný task. Klidně vyplň i u APPROVE.' },
  },
  required: ['verdict'],
}
// --- triáž: potřebuje tenhle task vůbec architekta? ----------------------
// ARCH přečte relevantní kód a vyrobí textový plán — a DEV pak čte ty samé soubory
// znovu, protože plán je text, ne kontext. U ohraničené změny s jasnou kotvou je to
// pochopení repa zaplacené dvakrát; jeden agent, co si to naplánuje a rovnou napíše,
// je tam levnější a ne horší.
//
// Triáž je DETERMINISTICKÁ, žádný agent: agentní brána (sonnet/low) rozhodla
// 17/20 běhů „heavy" za 23k tokenů/běh (proměřeno 15. 9. 2026) — nefiltrovala,
// jen stála. Kritéria jsou stejná, jen mechanická: `light` = krátké zadání
// s konkrétní kotvou (1–3 soubory) mimo sdílené seamy a mixed-version hranici.
// V pochybnostech (žádná kotva, seam keyword, dlouhé zadání) jede `heavy` —
// falešné `light` stojí zahozené kolo, falešné `heavy` jen jeden ARCH pass.
// Kromě sdílených seamů i trap-heavy zóny z gotchas, kde „malá" změna tiše
// rozbije invariant (okna/webview: append-only mount, jeden divák nad PTY;
// WS terminál data-plane) — tam light režim nepatří ani u krátkého zadání.
const SEAM_RE = /(src\/lib\/db|redis\/bus|getDockerClient|agent[- ]?mux|\bRLS\b|ownership|initDb|\bDDL\b|agent-relay|agent-hop|mixed-version|cache invalidac|pub[/-]?sub|window-slots|live-tabs|slot-window|slot-store|pane-content|webview|ws-server|terminal-hold)/i
const TASK_FILE_RE = /[\w./-]+\.(?:ts|tsx|mjs|cjs|js|jsx|css|md|sql|ya?ml)(?::\d+)?/g
const taskAnchorFiles = new Set((TASK.match(TASK_FILE_RE) || []).map((a) => a.split(':')[0]))
const lightMode = TASK.length < 2000 && taskAnchorFiles.size >= 1 && taskAnchorFiles.size <= 3 && !SEAM_RE.test(TASK)
log(lightMode
  ? `triáž (deterministická): lehký režim, ARCH se přeskakuje — krátké zadání s kotvou (${[...taskAnchorFiles].join(', ')}), mimo seamy`
  : `triáž (deterministická): těžký režim, jede ARCH — ${TASK.length >= 2000 ? 'dlouhé zadání' : SEAM_RE.test(TASK) ? 'sahá na sdílený seam / mixed-version' : taskAnchorFiles.size > 3 ? `${taskAnchorFiles.size} souborů v zadání` : 'žádná konkrétní kotva v zadání'}`)

// --- plánování (jednou) --------------------------------------------------
// Zadání z brain boardu často UŽ nese hotovou analýzu — root cause, konkrétní
// `soubor:řádek` kotvy i navržený směr fixu (píše je tam člověk nebo předchozí
// QA). Nechat ARCH derivovat totéž od nuly je čistý odpad: přečte si půlku repa,
// aby došel k závěru, který má v zadání. Když analýzu poznáme, jede ARCH v
// ověřovacím režimu na nízký effort — má potvrdit, že sedí, a doplnit, co chybí.
// Detektor je schválně volnější, než býval: původní verze chtěla kotvu
// `soubor:řádek` A český nadpis z úzkého seznamu — vystřelila jen 3× ze 17 ARCH
// běhů, přestože série MCP 1–13 měla v zadáních hotové specy (jiné nadpisy).
// ARCH v plné derivaci stál avg 106k; ověřovací režim je výrazně levnější.
// Teď stačí dlouhé zadání + buď rozborový nadpis, nebo ≥3 kotvy `soubor:řádek`
// (kdo cituje tři konkrétní řádky, rozbor už udělal, ať ho nadepsal jakkoli).
const FILE_LINE_ANCHOR_RE = /[\w./-]+\.(?:ts|tsx|mjs|cjs|js|jsx|css|md|sql|ya?ml):\d+/g
const ANALYSIS_HEADING_RE = /^#{1,4} +(příčina|proč|návrh|kde hledat|řešení|symptom|root cause|implementace|plán|postup|co udělat|jak na to|api|endpoint|navazuje|už existuje|analýza|zjištění|repro)/im
const lineAnchorCount = (TASK.match(FILE_LINE_ANCHOR_RE) || []).length
const taskHasAnalysis = TASK.length > 1200 && lineAnchorCount >= 1 && (ANALYSIS_HEADING_RE.test(TASK) || lineAnchorCount >= 3)
if (taskHasAnalysis && !lightMode) log('zadání nese vlastní analýzu (kotvy soubor:řádek + rozbor) — ARCH jede ověřovací režim na low effort')

const arch = lightMode ? null : await agent(
  taskHasAnalysis
    ? [
        `Zadání:\n${TASK}`,
        `Tohle zadání UŽ obsahuje rozbor včetně konkrétních \`soubor:řádek\` kotev. NEDERIVUJ ho znovu od nuly a nečti kvůli tomu půlku repa.`,
        `Tvoje práce je OVĚŘIT a DOPLNIT: (1) zkontroluj vzorkem, že citované kotvy v kódu reálně sedí (posunuté řádky, přejmenované symboly, mezitím opravená místa), (2) doplň, co rozbor nezmiňuje — kterým seamem to teče, co znovupoužít, co má QA ověřit, co je mimo scope, (3) když analýza NESEDÍ s kódem, řekni to natvrdo a naplánuj to správně.`,
        `Nekóduj. Když je ověřený rozbor v pořádku, klidně z něj plán poskládej rovnou — nemusíš přidávat vlastní.`,
      ].join('\n\n')
    : `Zadání:\n${TASK}\n\nPřečti relevantní kód repa a naplánuj, jak se to udělá (nekóduj). Aktivně hledej existující helpery/patterny/seamy k znovupoužití.`,
  {
    agentType: 'Zdena-ARCH', phase: 'Plán', schema: ARCH_SCHEMA, label: 'ARCH: plán',
    // Kód píše DEV a review dělá CR — ti zůstávají na hlavním modelu vždy.
    ...(MODELS.arch ? { model: MODELS.arch } : {}),
    ...(taskHasAnalysis ? { effort: 'low' } : {}),
  },
)
const plan = arch?.plan || (lightMode
  ? '(lehký režim — triáž vyhodnotila task jako ohraničený, samostatný plán se nedělal; naplánuj si to sám při psaní a drž WorkMux konvence)'
  : '(architekt nevrátil plán — DEV se řídí přímo zadáním a WorkMux konvencemi)')
const filesHint = arch?.files?.length
  ? arch.files.map((f) => `- ${f.path}${f.why ? ` — ${f.why}` : ''}`).join('\n')
  : (lightMode ? '(lehký režim — dotčená místa si najdi sám podle zadání)' : '(ARCH nevytipoval soubory — najdi si dotčená místa sám)')
if (arch?.files?.length) log(`ARCH vytipoval ${arch.files.length} souborů`)

// Zásadní nejasnost v zadání → nehádej, zeptej se. ARCH vrací blokující
// nejasnosti v `openQuestions`; když nějaké jsou, smyčku VŮBEC nepouštíme —
// slepý DEV → GATE → CR → QA cyklus na špatně pochopeném zadání je drahý omyl.
// Vrátíme `needsClarification` nahoru: interaktivní /resolve se zeptá uživatele,
// autonomní /resolve-tasks hodí task do stavu „Čeká na upřesnění" s otázkami
// v komentáři (viz .claude/commands/resolve*.md).
if (arch?.openQuestions?.length) {
  log(`ARCH: blokující nejasnosti (${arch.openQuestions.length}) — smyčka se nepouští, task potřebuje upřesnění`)
  return {
    done: false,
    needsClarification: true,
    questions: arch.openQuestions,
    plan,
    rounds: 0,
  }
}

// --- smyčka (kolo = 1 .. MAX_ROUNDS) -------------------------------------
// Sekvenční z principu: kolo N závisí na feedbacku z N-1.
// Pořadí bran uvnitř kola je levné → drahé: GATE (git+tsc+unit) → CR (čte diff) →
// až po CR:APPROVE se pustí QA (živý prohlížeč, nejdražší). Jen jedna brána
// selhává najednou → feedback je cílený na aktuální blocker.
phase('Smyčka')
let feedback = ''
let dev = null, gate = null, qa = null, cr = null
let changedFiles = []
let done = false
let round = 0
let deadDevRounds = 0
let qaFails = 0
let needsManualQa = false
// Prostředí je mrtvé i po recovery z QA (dind nejde nahodit zevnitř) — orchestrátor
// má zavolat člověka a nebrat další tasky, ne točit kola na mrtvém prostředí.
let envDead = false
let qaSkipped = false
let budgetStopped = false
let scopeCreep = false
let creepRounds = 0
let prevBlockerFiles = new Set()
// Blockery z minulého CR kola — ověřovací CR kolo je dostane do promptu, aby
// necouralo celý diff od nuly (CR stál ~100k/kolo bez ohledu na to, jestli
// ověřoval fix jednoho bodu, nebo dělal první review). Přežívá GATE-červená
// kola (blockery pořád platí), nuluje se na APPROVE.
let prevCrBlockers = []
const followUps = []
let qaEnvUp = false

/** Soubory, na které CR ukázal — `soubor:řádek — komentář` → `soubor`. */
// Odrážku a backtick kolem cesty setřást MUSÍME: `- src/foo.ts:12 — …` by jinak dalo
// `-` pro každý komentář, průnik by vyšel vždycky neprázdný a creep detektor by nikdy
// nevystřelil. Schéma sice formát předepisuje, ale spoléhat se na to nechci.
const filesOf = (comments) =>
  new Set(
    (comments || [])
      .map((c) => String(c).trim().replace(/^[-*•]\s*/, '').replace(/^`/, '').split(/[:\s]/)[0])
      .filter((f) => f && /[./]/.test(f)),
  )

for (round = 1; round <= MAX_ROUNDS; round++) {
  // Rozpočtová brzda: `MAX_ROUNDS` hlídá počet kol, ne cenu. Když uživatel zadal
  // token target, ať smyčka umře řízeně (s rozdělanou prací a blokerem), ne až
  // na tvrdém stropu uprostřed drahého QA běhu.
  if (round > 1 && budget.total && budget.remaining() < BUDGET_RESERVE) {
    log(`rozpočet došel (zbývá ~${Math.round(budget.remaining() / 1000)}k) — končím po ${round - 1} kolech`)
    budgetStopped = true
    break
  }
  dev = await agent(
    [
      `Zadání:\n${TASK}`,
      `PLÁN OD ARCH:\n${plan}`,
      `SOUBORY DLE ARCH (začni tady — NE tvrdý whitelist, u cross-cutting změn klidně přiber další):\n${filesHint}`,
      `FEEDBACK Z MINULÉHO KOLA:\n${feedback || '(první kolo — žádný feedback)'}`,
      // Každé kolo je nový DEV s prázdnou hlavou — bez tohohle si znovu přečte
      // soubory, které sám minule napsal. `git diff` je komprimovaná paměť té práce.
      round > 1
        ? [
            `TVOJE PRÁCE Z MINULÝCH KOL UŽ JE VE WORKING TREE — ale ty jsi nový kontext a nic si z ní nepamatuješ.`,
            `Začni \`git diff${BASE ? ` ${BASE}` : ''}\` (+ \`git status --porcelain\` na nové soubory): je to komprimovaná paměť toho, co tam už je. Dotčené soubory NEČTI celé znovu od nuly — dočítej jen to, co diff sám nevysvětlí.`,
            dev?.summary ? `Cos o minulém kole napsal(a): ${dev.summary}` : null,
          ].filter(Boolean).join(' ')
        : null,
      `Naimplementuj / oprav kód podle plánu a feedbacku. Feedback od CR a QA je závazný — projdi ho bod po bodu. Working tree je společný deliverable, needituj mimo scope.`,
      `LEVNÁ BRÁNA JDE PO TOBĚ: samostatný gate agent (levný model) hned po tobě spustí plný \`npm run typecheck:root\` a CELÝ \`npm run test:unit\`. Ty tu plnou sadu NEPOUŠTĚJ — trvá minuty a její výstup ti jen zaplaví kontext. Před vrácením výsledku spusť \`npm run typecheck:app\` (src/ + server/, polovina paměti plného; plný root nech na GATE) — nikdy souběžně s \`next dev\`/buildem ani druhým tsc, jen jeden tsc naráz (AGENTS.md, WOR-636) — a cíleně JEN testy, kterých ses dotkl (\`npx jest <cesta/vzor>\`). Zbytek dopočítá GATE; když něco chytí, přijde ti to jako feedback do dalšího kola.`,
    ].filter(Boolean).join('\n\n'),
    { agentType: 'Zdena-DEV', phase: 'Smyčka', schema: DEV_SCHEMA, label: `kolo ${round}: DEV` },
  )

  if (!dev) {
    // DEV umřel (terminal error / skip) — nemá smysl pouštět zbytek na nezměněném stromu.
    deadDevRounds++
    log(`kolo ${round}: DEV nevrátil výsledek (${deadDevRounds}×)`)
    if (deadDevRounds >= 2) { log('DEV opakovaně selhal — přerušuji smyčku.'); break }
    continue
  }
  deadDevRounds = 0
  if (dev.dismissed?.length) log(`kolo ${round}: DEV nereagoval na: ${dev.dismissed.join(' | ')}`)

  // BRÁNA 1 — GATE agent: pravda o změněných souborech + zeleni typecheck/unit z repa
  // (ne DEVův self-report). Levný, jednoúčelový, needituje kód.
  gate = await agent(
    [
      `Nejsi vývojář — kód NEEDITUJ. Jsi měřicí brána. Spusť přesně tyhle příkazy v repu a vrať PRAVDIVÝ výsledek:`,
      `1) \`git status --porcelain\` → do \`changedFiles\` dej všechny změněné/přidané/untracked cesty.`,
      // Výstupy schválně useknuté na ocas — plný test:unit výpis je desítky
      // kilobajtů v kontextu za jeden boolean. Exit code drž přes PIPESTATUS.
      `2) \`npm run typecheck:root 2>&1 | tail -40; echo "TSC_EXIT=\${PIPESTATUS[0]}"\` → \`typecheckOk\` = (TSC_EXIT == 0).`,
      `3) \`npm run test:unit -- --silent 2>&1 | tail -60; echo "UNIT_EXIT=\${PIPESTATUS[0]}"\` → \`unitOk\` = (UNIT_EXIT == 0).`,
      `Když je typecheck nebo unit červený, do \`details\` dej ten useknutý ocas s konkrétními chybami (soubor:řádek). Nic nefixuj, nic dalšího nečti, jen změř a nahlas.`,
    ].join('\n'),
    { agentType: 'general-purpose', phase: 'Smyčka', schema: GATE_SCHEMA, label: `kolo ${round}: GATE`, model: MODELS.gate, effort: 'low' },
  )
  changedFiles = gate?.changedFiles?.length ? gate.changedFiles : (dev.changedFiles ?? [])
  const changedList = changedFiles.length ? changedFiles.map((f) => `- ${f}`).join('\n') : '(GATE ani DEV neuvedl změněné soubory)'

  if (!gate || !gate.typecheckOk || !gate.unitOk) {
    log(`kolo ${round}: GATE červená (typecheck=${gate?.typecheckOk ?? 'ERR'}, unit=${gate?.unitOk ?? 'ERR'}) — CR/QA se nepouští`)
    feedback = `LEVNÁ BRÁNA ČERVENÁ (oprav, než půjde dál — CR ani živé QA se kvůli tomu nespustilo):\n${gate?.details || '(typecheck nebo unit je červený; GATE neuvedl detail — spusť `npm run typecheck:root` a `npm run test:unit` a oprav)'}`
    continue
  }

  // BRÁNA 2 — CR (levnější než QA, má přednost): čte diff, dokud není čistý, QA vůbec neběží.
  cr = await agent(
    [
      // CR MUSÍ znát zadání: bez něj neví, co je deliverable, a smoke test to
      // předvedl v praxi — „dočasný" soubor, který BYL celé zadání tasku,
      // vyhodnotil jako smetí a přes tři kola ho nechal smazat.
      `Zadání, které diff plní (nálezy měř vůči němu — co zadání výslovně chce, není blocker):\n${TASK}`,
      `Zreviewuj JEN diff aktuálního working tree${BASE ? ` (git diff ${BASE})` : ' (git diff)'}, ne celý repo.`,
      `Změněné soubory (z gitu):\n${changedList}`,
      `BRÁNA UŽ PROBĚHLA — \`npm run typecheck:root\` i \`npm run test:unit\` jsou ZELENÉ (změřil gate agent těsně před tebou, na ${changedFiles.length} změněných souborech). NESPOUŠTĚJ je znovu, ani eslint: je to minuty běhu a hromada výstupu v kontextu za informaci, kterou už máš. Tvoje přidaná hodnota je to, co build nechytí — seamy, statelessness, n+1, znovupoužití, pasti z gotchas.`,
      `ROZSAH VERDIKTU: \`blockers\` = jen nálezy ve ZMĚNĚNÝCH řádcích diffu, ty drží REQUEST_CHANGES. Cokoli mimo diff (stejný hřích v sousední komponentě, starší dluh, „chtělo by to projít celé") patří do \`followUps\` — je to platný nález, ale řeší se samostatným taskem, ne dalším kolem téhle smyčky. Nenuť DEVa rozšiřovat diff, tím si jen vyrobíš novou plochu ke kritice.`,
      // Ověřovací kolo: CR je nový kontext a bez tohohle znovu objevuje celý
      // diff (~100k/kolo). Když minulé kolo mělo blockery, primární práce je
      // ověřit jejich fix — ne nový full review už schválených řádků.
      prevCrBlockers.length
        ? [
            `OVĚŘOVACÍ KOLO — minulé CR kolo vrátilo tyhle blockery:\n${prevCrBlockers.map((b) => `- ${b}`).join('\n')}`,
            `DEV k opravě píše: ${dev.summary}`,
            `Primárně ověř, že KAŽDÝ z nich je vyřešený, a projdi řádky, které se od minula změnily. Zbytek diffu jsi (tvůj minulý kontext) už viděl — nerozebírej ho celý znovu a neotvírej nová témata na řádcích, cos minule nechal projít; nový blocker jen za skutečný problém, který oprava zanesla.`,
          ].join('\n\n')
        : null,
      round >= STRICT_CR_FROM_ROUND
        ? `KOLO ${round} — už jen SKUTEČNÉ blokery: korektnost, bezpečnost, ztráta dat, obejitý seam, rozbitá past z gotchas. Pojmenování, styl, hustota komentářů a podobné věci teď patří do \`followUps\`, ne do \`blockers\`. Tenhle běh se protahuje, potřebuje dojet.`
        : null,
      `Když v diffu blocker není, APPROVE (i kdyby \`followUps\` bylo plné).`,
    ].filter(Boolean).join('\n\n'),
    { agentType: 'Zdena-CR', phase: 'Smyčka', schema: CR_SCHEMA, label: `kolo ${round}: CR` },
  )
  if (cr?.followUps?.length) {
    followUps.push(...cr.followUps.filter((f) => !followUps.includes(f)))
    log(`kolo ${round}: CR odložil ${cr.followUps.length} nálezů mimo diff do follow-ups`)
  }
  const crApprove = cr?.verdict === 'APPROVE'
  if (!crApprove) {
    const blockers = cr?.blockers?.length ? cr.blockers : []
    log(`kolo ${round}: CR=${cr?.verdict ?? 'ERR'} (${blockers.length} blockerů) — QA se nepouští (šetřím drahý browser běh)`)

    // Whack-a-mole detektor: když CR kolo co kolo ukazuje na úplně jinou sadu
    // souborů, není to konvergence — je to rozlézání scopu a další kolo ho jen
    // posune jinam. Uzavřenou definici hotového musí dát člověk.
    const nowFiles = filesOf(blockers)
    if (nowFiles.size && prevBlockerFiles.size && ![...nowFiles].some((f) => prevBlockerFiles.has(f))) {
      creepRounds++
      log(`kolo ${round}: CR míří na jinou sadu souborů než minule (${creepRounds}/${MAX_CREEP_ROUNDS})`)
    } else {
      creepRounds = 0
    }
    prevBlockerFiles = nowFiles
    if (creepRounds >= MAX_CREEP_ROUNDS) {
      log('CR se stěhuje po repu místo konvergence — zastavuji, task potřebuje uzavřenou definici hotového')
      scopeCreep = true
      break
    }

    const crBody = blockers.length ? blockers.join('\n') : (cr ? '(CR nevrátil komentáře)' : '(CR agent selhal)')
    // Když CR agent úplně selhal (cr == null), minulé blockery NEpřepisujeme —
    // nikdo je neověřil a příští CR kolo je má dostat k ověření znovu.
    // Přepis jen neprázdným seznamem — REQUEST_CHANGES bez blockerů (anomálie)
    // by jinak dalšímu kolu sebral ověřovací režim a poslal ho na full review.
    if (blockers.length) prevCrBlockers = blockers
    feedback = `CR: REQUEST_CHANGES\n${crBody}`
    continue
  }
  prevBlockerFiles = new Set()
  prevCrBlockers = []
  creepRounds = 0

  // Kolo se dotklo JEN věcí bez povrchu v běžící appce (dokumentace, konfigurace,
  // unit testy — ty už GATE prohnal zeleně). Bootovat kvůli tomu appku a prohlížeč
  // je čistá režie. Verdikt ale NEHLÁSÍME jako PASS: je to SKIPPED s důvodem, ať je
  // nahoře vidět, že se to živě netestovalo.
  if (changedFiles.length && changedFiles.every(hasNoRuntimeSurface)) {
    log(`kolo ${round}: CR=APPROVE, QA se nepouští — nic ze změn nemá povrch v prohlížeči (${changedFiles.join(', ')})`)
    qa = {
      verdict: 'SKIPPED',
      report: `QA se záměrně nepouštěla: všech ${changedFiles.length} změněných souborů je mimo runtime povrch appky (dokumentace / konfigurace / unit testy zelené z GATE), v prohlížeči se to pozorovat nedá.`,
    }
    qaSkipped = true
    done = true
    break
  }
  const uiChanged = changedFiles.some(hasUiSurface)

  // BRÁNA 3 — QA (nejdražší, živý prohlížeč): až když CR schválil.
  // Vnitřní retry na `failKind: 'env'`: pád prostředí (server nenaběhl, dind,
  // stale .next) není bug v kódu — nové kolo DEV → GATE → CR by jelo na
  // NEZMĚNĚNÉM stromu (~210k tokenů za nic). Opakuje se jen QA s pokynem
  // prostředí dorazit; teprve vyčerpané retry padají do qaFails.
  for (let qaTry = 0; ; qaTry++) {
    qa = await agent(
      [
        `Zadání:\n${TASK}`,
        `V tomto kole se změnilo (z gitu):\n${changedList}`,
        `Rozjeď prostředí a otestuj dotčený flow REÁLNĚ v prohlížeči přes Playwright MCP (browser_* tooly načteš přes ToolSearch: "select:mcp__playwright__browser_navigate,mcp__playwright__browser_snapshot,mcp__playwright__browser_click,mcp__playwright__browser_type"). Bez běžícího prostředí nebo bez proklikání flow je verdikt FAIL, ne "přeskočeno". Po ověření zafixuj scénář jako Playwright *.spec.ts v tests/cloud/ a spusť ho.`,
        uiChanged
          ? `Změna má UI povrch → dotčený flow projdi POVINNĚ i na mobilu 390×844 (mobile + touch emulace, kontrola přetečení, mobilní screenshot — pravidlo „UI se testuje VŽDY i na mobilu" v tvé definici). Vyplň \`mobileChecked\` a \`mobileNotes\`; PASS bez \`mobileChecked: true\` smyčka nepřijme.`
          : null,
        `EKONOMIE (neoslabuj tím věrnost — fake PASS pořád neexistuje): (1) Reuse prostředí — pokud už \`dev:cloud\` (:8000) běží, POUŽIJ ho; rebuild (\`build:cloud\`) a restart jen když se změnil klientský bundle nebo je \`.next\` stale (bite #70), ne paušálně. (2) Cílené asserty místo obřích výpisů — preferuj \`browser_evaluate\` (getBoundingClientRect, textContent, WS/network spy) před plným \`browser_snapshot\`/screenshotem. (3) Testuj ÚMĚRNĚ změně — u čistě textové/CSS/kosmetické změny bez runtime chování stačí cílený spec + smoke (+ mobil, má-li změna UI povrch). Rozsah drž na dotčeném flow, nezkoumej celou appku.`,
        // Opakované kolo: prostředí z minulého QA běhu skoro jistě pořád stojí a
        // scénář je už zafixovaný ve specu. Znovu ho ručně proklikávat od nuly je
        // nejdražší způsob, jak zjistit totéž co `npx playwright test <spec>`.
        qaEnvUp
          ? [
              `TOHLE UŽ NENÍ PRVNÍ QA KOLO. Prostředí sis rozjel(a) minule a s velkou pravděpodobností pořád běží — než začneš cokoli stavět, ověř to jedním \`browser_navigate\` na :8000 a stav ber jako výchozí (restartuj jen když je fakt mrtvé nebo je potřeba rebuild kvůli změně klientského bundlu).`,
              qa?.spec ? `Z minulého kola existuje spec: ${qa.spec}` : null,
              `POSTUP: (1) pusť ten existující spec (\`npx playwright test <soubor>\`) — pokrývá přesně to, co minule padlo, (2) ručně v prohlížeči doklikej UŽ JEN to, co spec nepokrývá nebo co se od minula změnilo. Zelený spec je plnohodnotné ověření, nemusíš celý flow opakovat rukou. Když spec chybí nebo je irelevantní, testuj normálně.`,
            ].filter(Boolean).join('\n')
          : null,
        qaTry > 0
          ? `MINULÝ POKUS PADL NA PROSTŘEDÍ, ne na chování appky — kód se od té doby NEZMĚNIL:\n${qa?.report || '(bez reportu)'}\nTvoje práce v tomhle pokusu je prostředí dorazit (viz důvod výš) a flow reálně ověřit. Když prostředí nejde rozjet ani teď, vrať zase FAIL s failKind=env a konkrétním důvodem.`
          : null,
      ].filter(Boolean).join('\n\n'),
      { agentType: 'Zdena-QA', phase: 'Smyčka', schema: QA_SCHEMA, label: qaTry > 0 ? `kolo ${round}: QA (env retry ${qaTry})` : `kolo ${round}: QA` },
    )
    // I FAIL zpravidla znamená, že prostředí stálo. Env-FAIL flag naopak SHODÍ —
    // i po vyčerpaných retry, ať příští QA kolo nedostane „prostředí běží".
    // `failKind` se čte JEN u FAIL — omylem vyplněný u PASS flag shodit nesmí.
    if (qa) qaEnvUp = !(qa.verdict === 'FAIL' && qa.failKind === 'env')
    const envFail = qa?.verdict === 'FAIL' && qa?.failKind === 'env'
    // QA prošla recovery postup a prostředí pořád leží → další pokus by zkoušel
    // totéž (v noci 2026-10-04 9× marně). Chybějící pole (starý agent) = retry jako dřív.
    if (envFail && qa.envRecovery === 'failed') {
      envDead = true
      break
    }
    if (!envFail || qaTry >= MAX_QA_ENV_RETRIES) break
    log(`kolo ${round}: QA=FAIL kvůli prostředí — opakuju jen QA, bez nového DEV kola (retry ${qaTry + 1}/${MAX_QA_ENV_RETRIES})`)
    }
  // PASS bez mobilního průchodu u UI změny je nedoklikané QA, ne zelená. Přepis
  // na FAIL/bug záměrně jde přes qaFails níž — jinak by se QA točila donekonečna.
  if (qa?.verdict === 'PASS' && uiChanged && qa.mobileChecked !== true) {
    log(`kolo ${round}: QA vrátila PASS bez mobilní kontroly u UI změny — počítám jako FAIL`)
    qa = {
      ...qa,
      verdict: 'FAIL',
      failKind: 'bug',
      report: `PASS bez mobilní kontroly u UI změny — dotčený flow se musí projít i na 390×844 (kontrola přetečení + mobilní screenshot) a vyplnit mobileChecked/mobileNotes.\n\n${qa.report}`,
    }
  }
  const qaPass = qa?.verdict === 'PASS'
  log(`kolo ${round}: CR=APPROVE, QA=${qa?.verdict ?? 'ERR'}${qa?.verdict === 'FAIL' && qa?.failKind ? ` (${qa.failKind})` : ''}`)

  if (qaPass) { done = true; break }
  // Prostředí nešlo rozjet ani na env retry → další DEV kolo na NEZMĚNĚNÉM
  // stromu ho nerozjede taky. Rovnou k ručnímu otestování (kód má CR: APPROVE),
  // ne mlácení přes qaFails.
  if (envDead) {
    log(`prostředí je mrtvé i po recovery (${qa.envRecoveryNote || 'bez poznámky'}) — task jde k ručnímu otestování, potřeba zásah z hostu`)
    needsManualQa = true
    break
  }
  if (qa?.failKind === 'env') {
    log(`prostředí se nepodařilo rozjet ani na ${MAX_QA_ENV_RETRIES} env retry — task jde k ručnímu otestování`)
    needsManualQa = true
    break
  }
  qaFails++
  if (qaFails >= MAX_QA_FAILS) {
    // QA to nezvládla na 3 pokusy → dál se to automaticky nezkouší. Kód prošel
    // CR (APPROVE), jen se živě neověřil → task jde k RUČNÍMU otestování (ne fake
    // PASS, ne mlácení do 20 kol). Autonomní /resolve-tasks ho hodí do brain
    // stavu „K ručnímu otestování"; interaktivní /resolve to řekne uživateli.
    log(`QA selhala ${qaFails}× — task jde k ručnímu otestování (automaticky se dál nezkouší)`)
    needsManualQa = true
    break
  }
  feedback = `QA: FAIL (pokus ${qaFails}/${MAX_QA_FAILS})\n${qa?.report || '(QA nevrátila report — prostředí/agent selhal, zprovozni flow)'}`
}

// --- výsledek ------------------------------------------------------------
// Rozpočtová brzda se láme na ZAČÁTKU kola, ještě než se cokoli udělá — to kolo
// se tedy nepočítá. Ostatní důvody konce (creep, QA cap, konvergence) přijdou až
// po odpracovaném kole.
const roundsUsed = Math.min(budgetStopped ? round - 1 : round, MAX_ROUNDS)
return {
  done,
  converged: done,
  rounds: roundsUsed,
  exhausted: !done && !needsManualQa && !budgetStopped && !scopeCreep && round > MAX_ROUNDS,
  needsManualQa,
  // Prostředí nešlo nahodit ani recovery postupem QA. Orchestrátor nebere další
  // tasky a volá člověka (resolve-tasks.md), watchdog takový běh nerestartuje.
  envDead,
  envDeadReason: envDead ? (qa?.envRecoveryNote || qa?.report || null) : null,
  // `done: true` se `qa: 'SKIPPED'` — konvergovalo to na CR: APPROVE a živé QA se
  // vědomě nepouštělo, protože změna nemá v prohlížeči co ukázat. Není to fake PASS
  // ani needsManualQa (není co ručně proklikat), ale v reportu to má zaznít.
  qaSkipped,
  // Smyčka skončila řízeně, ne konvergencí: došel token rozpočet / CR se místo
  // konvergence stěhoval po repu. Obojí = rozdělaná práce ve stromu + task zpět
  // do Todo s blokerem, ne fake „hotovo".
  budgetStopped,
  scopeCreep,
  qa: qa?.verdict ?? null,
  cr: cr?.verdict ?? null,
  changedFiles,
  plan,
  lastQaReport: qa?.report ?? null,
  lastQaSpec: qa?.spec ?? null,
  lastQaMobileNotes: qa?.mobileNotes ?? null,
  lastCrComments: cr?.blockers ?? [],
  // Platné nálezy MIMO diff — nepatří do téhle smyčky, ale ať se neztratí:
  // orchestrátor je vysype do komentáře na boardu jako námět na samostatný task.
  followUps,
}
