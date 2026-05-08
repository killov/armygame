import 'reflect-metadata';
import { redirect, notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import { DatabaseService } from '@/db/DatabaseService';
import { MestoRepository } from '@/repositories/MestoRepository';
import { AkceRepository } from '@/repositories/AkceRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { CityService } from '@/services/CityService';
import { BUDOVY, getBuildingUpgradeCost, getBuildingTime, produkce, skladKapacita } from '@/lib/gameData';
import { JEDNOTKY } from '@/lib/armyData';
import { VYZKUMY, vyzkumCena, vyzkumCas } from '@/lib/vyzkumData';
import { startBuildingAction } from '@/app/actions/city';
import CountdownTimer from '@/app/game/CountdownTimer';
import MarketForm from './MarketForm';
import TrainForm from './TrainForm';
import ResearchForm from './ResearchForm';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'armygame-super-secret-jwt-key-2024-change-in-prod'
);

const BUDOVA_IKONY: Record<number, string> = {
  1: '🏛️', 2: '🧱', 3: '⚙️', 4: '🛢️', 5: '🌾',
  6: '📦', 7: '🔬', 8: '🏦', 9: '🏪', 10: '⚔️', 11: '🔧',
};

// Inline styles matching the dark military theme
const pageStyle: React.CSSProperties = { maxWidth: 900, margin: '0 auto' };
const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px',
  padding: '10px 14px', background: 'rgba(20,20,20,0.7)', border: '1px solid #555',
  borderRadius: '5px',
};
const titleStyle: React.CSSProperties = { fontSize: '1.2rem', fontWeight: 700, color: '#FF6600', margin: 0 };
const levelStyle: React.CSSProperties = { color: '#aaa', fontSize: '0.85rem' };
const iconStyle: React.CSSProperties = { fontSize: '2rem' };
const cardStyle: React.CSSProperties = {
  background: 'rgba(20,20,20,0.7)', border: '1px solid #555', borderRadius: '5px',
  padding: '12px 14px', color: '#ddd', marginBottom: '12px',
};
const sectionTitleStyle: React.CSSProperties = {
  fontSize: '0.95rem', fontWeight: 700, color: '#FF6600', marginBottom: '8px', marginTop: '4px',
};
const infoRowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#bbb', padding: '2px 0',
};
const upgradeBtnStyle: React.CSSProperties = {
  background: 'forestgreen', color: 'cornsilk', border: '1px solid #2a6e2a',
  padding: '5px 14px', borderRadius: '3px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
  marginTop: '8px',
};
const disabledBtnStyle: React.CSSProperties = {
  ...upgradeBtnStyle, background: '#555', color: '#888', cursor: 'not-allowed', borderColor: '#666',
};
const backLinkStyle: React.CSSProperties = {
  color: '#FF6600', textDecoration: 'none', fontSize: '0.85rem',
};

export default async function BuildingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const buildingId = Number(idStr);

  if (isNaN(buildingId) || buildingId < 1 || buildingId > 11) {
    notFound();
  }

  const budovaConfig = BUDOVY[buildingId];
  if (!budovaConfig) notFound();

  // Session
  const cookieStore = await cookies();
  const token = cookieStore.get('armygame_session')?.value;
  let session: { userId: number; jmeno: string } | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      session = payload as { userId: number; jmeno: string };
    } catch { session = null; }
  }
  if (!session) redirect('/login');

  // Services
  const db = new DatabaseService();
  const mestoRepo = new MestoRepository(db);
  const akceRepo = new AkceRepository(db);
  const userRepo = new UserRepository(db);
  const cityService = new CityService(mestoRepo, akceRepo, db);

  // City
  const cities = await mestoRepo.getByUserId(session.userId);
  const city = cities[0] ?? null;
  if (!city) return <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Nemáš žádné město...</div>;

  await cityService.processCompletedActions(city.id);
  const resources = await cityService.getResources(city.id);
  const updatedCityOrNull = await mestoRepo.getById(city.id);
  if (!updatedCityOrNull) return <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Chyba při načítání města</div>;
  const updatedCity = updatedCityOrNull;

  const user = await userRepo.getById(session.userId);
  const level = (updatedCity[`b${buildingId}` as keyof typeof updatedCity] as number) ?? 0;
  const isMax = level >= budovaConfig.maximum;
  const cost = !isMax ? getBuildingUpgradeCost(buildingId, level) : null;
  const buildTimeSec = !isMax ? getBuildingTime(buildingId, level) : null;

  const queue = await akceRepo.getPendingByMesto(city.id);

  // Upgrade action
  async function handleUpgrade(formData: FormData) {
    'use server';
    const bId = Number(formData.get('buildingId'));
    const mId = Number(formData.get('mestoId'));
    await startBuildingAction(mId, bId);
    revalidatePath('/game/budovy');
    revalidatePath('/game/mesto');
  }

  // Check upgrade requirements
  const reqs = Object.entries(budovaConfig.pozadavky);
  const reqsMet = reqs.every(([reqId, reqLevel]) => {
    const actualLevel = (updatedCity[`b${reqId}` as keyof typeof updatedCity] as number) ?? 0;
    return actualLevel >= (reqLevel as number);
  });
  const hasResources = cost != null && updatedCity.surovina1 >= cost.surovina1 && updatedCity.surovina2 >= cost.surovina2;
  const canUpgrade = !isMax && reqsMet && hasResources;

  // Upgrade section (shared by all buildings)
  function renderUpgradeSection() {
    if (level < 1 && buildingId !== 1) {
      return (
        <div style={cardStyle}>
          <p style={{ color: '#f85149', fontSize: '0.9rem' }}>Tato budova ještě není postavena. Nejprve ji postav na levelu Budovy.</p>
        </div>
      );
    }
    return null;
  }

  // Common upgrade card
  function renderUpgradeCard() {
    const buildTimeMin = buildTimeSec != null ? Math.floor(buildTimeSec / 60) : null;
    const buildTimeSecs = buildTimeSec != null ? buildTimeSec % 60 : null;

    return (
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Upgrade na level {level + 1}</div>
        {isMax ? (
          <span style={{ background: 'forestgreen', color: 'cornsilk', fontWeight: 700, padding: '2px 8px', borderRadius: '3px', fontSize: '0.85rem' }}>
            MAX LEVEL
          </span>
        ) : (
          <>
            <div style={infoRowStyle}>
              <span>Cena:</span>
              <span style={{ color: '#ddd' }}>{cost!.surovina1} mat, {cost!.surovina2} Fe</span>
            </div>
            <div style={infoRowStyle}>
              <span>Čas stavby:</span>
              <span style={{ color: '#ddd' }}>{buildTimeMin}m {buildTimeSecs}s</span>
            </div>
            {reqs.length > 0 && (
              <div style={{ marginTop: '4px' }}>
                <span style={{ color: '#999', fontSize: '0.82rem' }}>Požadavky:</span>
                {reqs.map(([reqId, reqLevel]) => {
                  const actualLevel = (updatedCity[`b${reqId}` as keyof typeof updatedCity] as number) ?? 0;
                  const met = actualLevel >= (reqLevel as number);
                  return (
                    <div key={reqId} style={{ fontSize: '0.78rem', color: met ? '#66bb6a' : '#f85149' }}>
                      {met ? '✓' : '✗'} {BUDOVY[Number(reqId)]?.nazev ?? `b${reqId}`} lv.{reqLevel as number} (máš {actualLevel})
                    </div>
                  );
                })}
              </div>
            )}
            <form action={handleUpgrade}>
              <input type="hidden" name="buildingId" value={buildingId} />
              <input type="hidden" name="mestoId" value={city.id} />
              <button type="submit" style={canUpgrade ? upgradeBtnStyle : disabledBtnStyle} disabled={!canUpgrade}>
                Vylepšit na level {level + 1}
              </button>
            </form>
          </>
        )}
      </div>
    );
  }

  // ===== Render building-specific content =====
  function renderContent() {
    switch (buildingId) {
      // === 1: Hlavní budova ===
      case 1: {
        const buildQueue = queue.filter(a => a.typ === 1);
        const trainQueue = queue.filter(a => a.typ === 5);
        const researchQueue = queue.filter(a => a.typ === 2);
        return (
          <>
            {/* Build queue */}
            <div style={cardStyle}>
              <div style={sectionTitleStyle}>Fronta staveb</div>
              {buildQueue.length === 0 ? (
                <p style={{ color: '#999', fontSize: '0.85rem', fontStyle: 'italic' }}>Fronta je prázdná</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {buildQueue.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', padding: '4px 8px', fontSize: '0.85rem' }}>
                      <span>🏗️</span>
                      <span style={{ flex: 1, fontWeight: 500, color: '#eee' }}>
                        {BUDOVY[a.budova ?? 0]?.nazev ?? 'Budova'} → lv. {((updatedCity[`b${a.budova}` as keyof typeof updatedCity] as number) ?? 0) + 1}
                      </span>
                      <CountdownTimer dokonceni={a.dokonceni} />
                    </div>
                  ))}
                </div>
              )}
              {trainQueue.length > 0 && (
                <>
                  <div style={{ ...sectionTitleStyle, marginTop: '12px' }}>Trénink jednotek</div>
                  {trainQueue.map(a => {
                    const unitName = JEDNOTKY[a.typ_jednotky]?.nazev ?? 'Jednotka';
                    const unitCount = [a.j1, a.j2, a.j3, a.j4, a.j5, a.j6, a.j7, a.j8].reduce((s, v) => s + v, 0);
                    return (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', padding: '4px 8px', fontSize: '0.85rem' }}>
                        <span>⚔️</span>
                        <span style={{ flex: 1, fontWeight: 500, color: '#eee' }}>{unitCount}x {unitName}</span>
                        <CountdownTimer dokonceni={a.dokonceni} />
                      </div>
                    );
                  })}
                </>
              )}
              {researchQueue.length > 0 && (
                <>
                  <div style={{ ...sectionTitleStyle, marginTop: '12px' }}>Výzkum</div>
                  {researchQueue.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', padding: '4px 8px', fontSize: '0.85rem' }}>
                      <span>🔬</span>
                      <span style={{ flex: 1, fontWeight: 500, color: '#eee' }}>{VYZKUMY[a.budova ?? 0]?.nazev ?? 'Výzkum'}</span>
                      <CountdownTimer dokonceni={a.dokonceni} />
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* All buildings list */}
            <div style={cardStyle}>
              <div style={sectionTitleStyle}>Přehled budov</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {Object.entries(BUDOVY).map(([idStr, b]) => {
                  const id = Number(idStr);
                  const bLevel = (updatedCity[`b${id}` as keyof typeof updatedCity] as number) ?? 0;
                  const bIsMax = bLevel >= b.maximum;
                  const bCost = !bIsMax ? getBuildingUpgradeCost(id, bLevel) : null;
                  const bHasRes = bCost != null && updatedCity.surovina1 >= bCost.surovina1 && updatedCity.surovina2 >= bCost.surovina2;
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', padding: '5px 8px', fontSize: '0.85rem' }}>
                      <span>{BUDOVA_IKONY[id] ?? '🏗️'}</span>
                      <Link href={`/game/budovy/${id}`} style={{ flex: 1, fontWeight: 500, color: '#FF6600', textDecoration: 'none' }}>
                        {b.nazev}
                      </Link>
                      <span style={{ color: '#aaa', fontSize: '0.8rem' }}>Lv. {bLevel}/{b.maximum}</span>
                      {bIsMax ? (
                        <span style={{ background: 'forestgreen', color: 'cornsilk', fontWeight: 700, padding: '1px 6px', borderRadius: '3px', fontSize: '0.75rem' }}>MAX</span>
                      ) : (
                        <form action={handleUpgrade} style={{ margin: 0 }}>
                          <input type="hidden" name="buildingId" value={id} />
                          <input type="hidden" name="mestoId" value={city.id} />
                          <button type="submit" style={bHasRes ? { ...upgradeBtnStyle, padding: '2px 8px', fontSize: '0.78rem', marginTop: 0 } : { ...disabledBtnStyle, padding: '2px 8px', fontSize: '0.78rem', marginTop: 0 }} disabled={!bHasRes}>
                            Vylepšit ({bCost!.surovina1} mat, {bCost!.surovina2} Fe)
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        );
      }

      // === 2-5: Resource buildings ===
      case 2: case 3: case 4: case 5: {
        const resourceMap: Record<number, { name: string; icon: string; resourceIndex: number }> = {
          2: { name: 'Stavební materiál', icon: '🧱', resourceIndex: 1 },
          3: { name: 'Železo', icon: '⚙️', resourceIndex: 2 },
          4: { name: 'Ropa', icon: '🛢️', resourceIndex: 3 },
          5: { name: 'Jídlo', icon: '🌾', resourceIndex: 4 },
        };
        const r = resourceMap[buildingId];
        const currentProd = produkce(level);
        const nextProd = !isMax ? produkce(level + 1) : null;
        const currentAmount = [resources.s1, resources.s2, resources.s3, resources.s4][r.resourceIndex - 1];

        return (
          <>
            <div style={cardStyle}>
              <div style={sectionTitleStyle}>{r.icon} Produkce: {r.name}</div>
              <div style={infoRowStyle}>
                <span>Aktuální zásoby:</span>
                <span style={{ color: '#ddd', fontWeight: 600 }}>{currentAmount.toLocaleString('cs-CZ')}</span>
              </div>
              <div style={infoRowStyle}>
                <span>Produkce/h (level {level}):</span>
                <span style={{ color: '#66bb6a', fontWeight: 600 }}>+{currentProd.toLocaleString('cs-CZ')}</span>
              </div>
              {nextProd != null && (
                <div style={infoRowStyle}>
                  <span>Produkce/h (level {level + 1}):</span>
                  <span style={{ color: '#4fc3f7', fontWeight: 600 }}>+{nextProd.toLocaleString('cs-CZ')}</span>
                </div>
              )}
              <div style={infoRowStyle}>
                <span>Kapacita skladu:</span>
                <span style={{ color: '#ddd' }}>{resources.sklad.toLocaleString('cs-CZ')}</span>
              </div>
              {buildingId === 5 && (
                <>
                  <div style={{ ...sectionTitleStyle, marginTop: '8px' }}>Populace</div>
                  <div style={infoRowStyle}>
                    <span>Populace:</span>
                    <span style={{ color: '#ddd' }}>{updatedCity.populace}</span>
                  </div>
                  <div style={{ color: '#999', fontSize: '0.78rem', marginTop: '4px' }}>
                    Jídlo živí populaci. Ujisti se, že produkce pokryje spotřebu.
                  </div>
                </>
              )}
            </div>
            {renderUpgradeCard()}
          </>
        );
      }

      // === 6: Sklad ===
      case 6: {
        const currentCap = skladKapacita(level);
        const nextCap = !isMax ? skladKapacita(level + 1) : null;
        return (
          <>
            <div style={cardStyle}>
              <div style={sectionTitleStyle}>📦 Kapacita skladu</div>
              <div style={infoRowStyle}>
                <span>Aktuální kapacita (level {level}):</span>
                <span style={{ color: '#ddd', fontWeight: 600 }}>{currentCap.toLocaleString('cs-CZ')}</span>
              </div>
              {nextCap != null && (
                <div style={infoRowStyle}>
                  <span>Kapacita (level {level + 1}):</span>
                  <span style={{ color: '#4fc3f7', fontWeight: 600 }}>{nextCap.toLocaleString('cs-CZ')}</span>
                </div>
              )}
              <div style={{ marginTop: '8px' }}>
                <div style={{ ...sectionTitleStyle, fontSize: '0.85rem' }}>Aktuální zásoby</div>
                <div style={infoRowStyle}><span>🧱 Stav. materiál:</span><span style={{ color: '#ddd' }}>{resources.s1.toLocaleString('cs-CZ')}</span></div>
                <div style={infoRowStyle}><span>⚙️ Železo:</span><span style={{ color: '#ddd' }}>{resources.s2.toLocaleString('cs-CZ')}</span></div>
                <div style={infoRowStyle}><span>🛢️ Ropa:</span><span style={{ color: '#ddd' }}>{resources.s3.toLocaleString('cs-CZ')}</span></div>
                <div style={infoRowStyle}><span>🌾 Jídlo:</span><span style={{ color: '#ddd' }}>{resources.s4.toLocaleString('cs-CZ')}</span></div>
              </div>
            </div>
            {renderUpgradeCard()}
          </>
        );
      }

      // === 7: Research Lab ===
      case 7: {
        if (level < 1) return renderUpgradeSection();
        const activeResearch = queue.some(a => a.typ === 2);
        const researchList = Object.entries(VYZKUMY).map(([idStr, v]) => {
          const vId = Number(idStr);
          const currentLevel = (user?.[`v${vId}` as keyof typeof user] as number) ?? 0;
          const cena = vyzkumCena(vId, currentLevel);
          const cas = vyzkumCas(vId, currentLevel);
          // Check requirements
          let canResearch = true;
          for (const [budovaIdStr, minLevel] of Object.entries(v.pozadavkyBudova)) {
            const bLvl = (updatedCity[`b${budovaIdStr}` as keyof typeof updatedCity] as number) ?? 0;
            if (bLvl < minLevel) canResearch = false;
          }
          for (const [reqIdStr, reqLevel] of Object.entries(v.pozadavkyVyzkum)) {
            const reqLvl = (user?.[`v${reqIdStr}` as keyof typeof user] as number) ?? 0;
            if (reqLvl < reqLevel) canResearch = false;
          }
          return { id: vId, nazev: v.nazev, emoji: v.emoji, popis: v.popis, currentLevel, maximum: v.maximum, cena, cas, canResearch };
        });

        return (
          <>
            <div style={cardStyle}>
              <div style={sectionTitleStyle}>🔬 Výzkumy</div>
              <ResearchForm
                mestoId={city.id}
                researches={researchList}
                penize={user?.penize ?? 0}
                activeResearch={activeResearch}
              />
            </div>
            {renderUpgradeCard()}
          </>
        );
      }

      // === 8: Banka ===
      case 8: {
        const vaultCapacity = level * 10000;
        return (
          <>
            <div style={cardStyle}>
              <div style={sectionTitleStyle}>🏦 Banka</div>
              <div style={infoRowStyle}>
                <span>Kapacita trezoru (level {level}):</span>
                <span style={{ color: '#FFD700', fontWeight: 600 }}>{vaultCapacity.toLocaleString('cs-CZ')}</span>
              </div>
              {!isMax && (
                <div style={infoRowStyle}>
                  <span>Kapacita (level {level + 1}):</span>
                  <span style={{ color: '#4fc3f7', fontWeight: 600 }}>{((level + 1) * 10000).toLocaleString('cs-CZ')}</span>
                </div>
              )}
              <div style={infoRowStyle}>
                <span>Tvoje peníze:</span>
                <span style={{ color: '#FFD700', fontWeight: 600 }}>{(user?.penize ?? 0).toLocaleString('cs-CZ')}</span>
              </div>
              <div style={{ color: '#999', fontSize: '0.78rem', marginTop: '6px' }}>
                Banka chrání tvoje peníze při útoku. Čím vyšší level, tím více peněz je v bezpečí.
              </div>
            </div>
            {renderUpgradeCard()}
          </>
        );
      }

      // === 9: Market ===
      case 9: {
        if (level < 1) return renderUpgradeSection();
        return (
          <>
            <div style={cardStyle}>
              <div style={sectionTitleStyle}>🏪 Tržiště</div>
              <MarketForm
                mestoId={city.id}
                penize={user?.penize ?? 0}
                surovina1={updatedCity.surovina1}
                surovina2={updatedCity.surovina2}
                surovina3={updatedCity.surovina3}
                surovina4={updatedCity.surovina4}
              />
            </div>
            {renderUpgradeCard()}
          </>
        );
      }

      // === 10: Kasárny (light units 1-4) ===
      case 10: {
        if (level < 1) return renderUpgradeSection();
        const lightUnits = [1, 2, 3, 4].map(id => ({
          id,
          nazev: JEDNOTKY[id].nazev,
          emoji: JEDNOTKY[id].emoji,
          surovina2: JEDNOTKY[id].surovina2,
          surovina3: JEDNOTKY[id].surovina3,
          surovina4: JEDNOTKY[id].surovina4,
          cas: JEDNOTKY[id].cas,
        }));
        const trainQueue = queue.filter(a => a.typ === 5 && a.typ_jednotky >= 1 && a.typ_jednotky <= 4);
        return (
          <>
            <div style={cardStyle}>
              <div style={sectionTitleStyle}>⚔️ Trénink pěchoty</div>
              <TrainForm mestoId={city.id} units={lightUnits} />
              {trainQueue.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ ...sectionTitleStyle, fontSize: '0.85rem' }}>Fronta tréninku</div>
                  {trainQueue.map(a => {
                    const unitCount = [a.j1, a.j2, a.j3, a.j4, a.j5, a.j6, a.j7, a.j8].reduce((s, v) => s + v, 0);
                    return (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', padding: '4px 8px', fontSize: '0.85rem', marginBottom: '4px' }}>
                        <span>{JEDNOTKY[a.typ_jednotky]?.emoji ?? '⚔️'}</span>
                        <span style={{ flex: 1, color: '#eee' }}>{unitCount}x {JEDNOTKY[a.typ_jednotky]?.nazev ?? 'Jednotka'}</span>
                        <CountdownTimer dokonceni={a.dokonceni} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {renderUpgradeCard()}
          </>
        );
      }

      // === 11: Dílna (heavy units 5-8) ===
      case 11: {
        if (level < 1) return renderUpgradeSection();
        const heavyUnits = [5, 6, 7, 8].map(id => ({
          id,
          nazev: JEDNOTKY[id].nazev,
          emoji: JEDNOTKY[id].emoji,
          surovina2: JEDNOTKY[id].surovina2,
          surovina3: JEDNOTKY[id].surovina3,
          surovina4: JEDNOTKY[id].surovina4,
          cas: JEDNOTKY[id].cas,
        }));
        const heavyTrainQueue = queue.filter(a => a.typ === 5 && a.typ_jednotky >= 5 && a.typ_jednotky <= 8);
        return (
          <>
            <div style={cardStyle}>
              <div style={sectionTitleStyle}>🔧 Trénink těžké techniky</div>
              <TrainForm mestoId={city.id} units={heavyUnits} />
              {heavyTrainQueue.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ ...sectionTitleStyle, fontSize: '0.85rem' }}>Fronta tréninku</div>
                  {heavyTrainQueue.map(a => {
                    const unitCount = [a.j1, a.j2, a.j3, a.j4, a.j5, a.j6, a.j7, a.j8].reduce((s, v) => s + v, 0);
                    return (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', padding: '4px 8px', fontSize: '0.85rem', marginBottom: '4px' }}>
                        <span>{JEDNOTKY[a.typ_jednotky]?.emoji ?? '🔧'}</span>
                        <span style={{ flex: 1, color: '#eee' }}>{unitCount}x {JEDNOTKY[a.typ_jednotky]?.nazev ?? 'Jednotka'}</span>
                        <CountdownTimer dokonceni={a.dokonceni} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {renderUpgradeCard()}
          </>
        );
      }

      default:
        return renderUpgradeCard();
    }
  }

  return (
    <div style={pageStyle}>
      <div style={{ marginBottom: '8px' }}>
        <Link href="/game/budovy" style={backLinkStyle}>← Zpět na budovy</Link>
      </div>

      <div style={headerStyle}>
        <span style={iconStyle}>{BUDOVA_IKONY[buildingId] ?? '🏗️'}</span>
        <div>
          <h1 style={titleStyle}>{budovaConfig.nazev}</h1>
          <div style={levelStyle}>Level {level} / {budovaConfig.maximum}</div>
        </div>
      </div>

      {renderContent()}
    </div>
  );
}
