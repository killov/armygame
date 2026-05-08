'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.scss';
import { fetchMapData, MapCity, MapData } from '@/app/actions/mapa';
import { sendAttackAction } from '@/app/actions/battle';

const GRID_SIZE = 20;
const MAP_MAX = 999;

export default function MapaPage() {
  const router = useRouter();
  const [data, setData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewX, setViewX] = useState(0);
  const [viewY, setViewY] = useState(0);
  const [hoveredCity, setHoveredCity] = useState<MapCity | null>(null);
  const [attackTarget, setAttackTarget] = useState<MapCity | null>(null);
  const [attackUnits, setAttackUnits] = useState<Record<number, number>>({});
  const [attackMsg, setAttackMsg] = useState('');

  useEffect(() => {
    fetchMapData().then((result) => {
      if (!result) {
        router.push('/login');
        return;
      }
      setData(result);
      if (result.myCity) {
        setViewX(Math.max(0, Math.min(MAP_MAX - GRID_SIZE + 1, result.myCity.x - Math.floor(GRID_SIZE / 2))));
        setViewY(Math.max(0, Math.min(MAP_MAX - GRID_SIZE + 1, result.myCity.y - Math.floor(GRID_SIZE / 2))));
      }
      setLoading(false);
    });
  }, [router]);

  const move = useCallback((dx: number, dy: number) => {
    setViewX((prev) => Math.max(0, Math.min(MAP_MAX - GRID_SIZE + 1, prev + dx)));
    setViewY((prev) => Math.max(0, Math.min(MAP_MAX - GRID_SIZE + 1, prev + dy)));
  }, []);

  if (loading) {
    return <div className={styles.page}><p style={{ color: '#8b949e' }}>Nacitam mapu...</p></div>;
  }

  if (!data) return null;

  const { cities, myCity, userId } = data;

  // Build lookup for cities in current viewport
  const cityGrid = new Map<string, MapCity>();
  const visibleCities: MapCity[] = [];
  for (const city of cities) {
    const gx = city.x - viewX;
    const gy = city.y - viewY;
    if (gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE) {
      cityGrid.set(`${gy}-${gx}`, city);
      visibleCities.push(city);
    }
  }

  const handleAttackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myCity || !attackTarget) return;
    setAttackMsg('');
    const result = await sendAttackAction(myCity.id, attackTarget.id, attackUnits);
    if (result.success) {
      setAttackMsg('Utok vyslán!');
      setAttackTarget(null);
      setAttackUnits({});
    } else {
      setAttackMsg(result.error || 'Chyba pri utoky');
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Mapa sveta</h1>

      <div className={styles.mapContainer}>
        <div>
          {/* Navigation buttons */}
          <div className={styles.navButtons}>
            <button className={styles.navBtn} onClick={() => move(0, -10)}>N</button>
          </div>
          <div className={styles.navRow}>
            <button className={styles.navBtn} onClick={() => move(-10, 0)}>W</button>
            <div className={styles.grid}>
              {Array.from({ length: GRID_SIZE }, (_, row) =>
                Array.from({ length: GRID_SIZE }, (_, col) => {
                  const key = `${row}-${col}`;
                  const city = cityGrid.get(key);
                  const isOwn = city ? city.userId === userId : false;

                  let cellClass = styles.cell;
                  if (city) cellClass += ` ${isOwn ? styles.myCity : styles.cityCell}`;

                  return (
                    <div
                      key={key}
                      className={cellClass}
                      onMouseEnter={() => city && setHoveredCity(city)}
                      onMouseLeave={() => setHoveredCity(null)}
                      onClick={() => city && !isOwn && setAttackTarget(city)}
                      title={
                        city
                          ? `${city.jmeno} (${city.x},${city.y}) - ${city.userjmeno}`
                          : `(${viewX + col},${viewY + row})`
                      }
                    >
                      {city && <span className={`${styles.cityDot} ${isOwn ? styles.ownDot : styles.enemyDot}`} />}
                    </div>
                  );
                })
              )}
            </div>
            <button className={styles.navBtn} onClick={() => move(10, 0)}>E</button>
          </div>
          <div className={styles.navButtons}>
            <button className={styles.navBtn} onClick={() => move(0, 10)}>S</button>
          </div>
          <div className={styles.coordInfo}>
            Zobrazeno: ({viewX},{viewY}) - ({viewX + GRID_SIZE - 1},{viewY + GRID_SIZE - 1})
          </div>
          <div className={styles.legend}>
            <div><span className={`${styles.dot} ${styles.myDotLegend}`} /> Moje mesto</div>
            <div><span className={`${styles.dot} ${styles.cityDotLegend}`} /> Cizi mesto</div>
            <div><span className={`${styles.dot} ${styles.emptyDot}`} /> Prazdne</div>
          </div>
        </div>

        <div className={styles.infoPanel}>
          {hoveredCity ? (
            <div className={styles.myInfo}>
              <h3>{hoveredCity.jmeno}</h3>
              <p>Hrac: <strong>{hoveredCity.userjmeno}</strong></p>
              <p>Pozice: ({hoveredCity.x}, {hoveredCity.y})</p>
              <p>Stat: {hoveredCity.statjmeno || '—'}</p>
              <p>Populace: {hoveredCity.populace.toLocaleString('cs-CZ')}</p>
              {hoveredCity.userId !== userId && (
                <button
                  className={styles.attackBtn}
                  style={{ marginTop: '0.5rem' }}
                  onClick={() => setAttackTarget(hoveredCity)}
                >
                  Zautocit
                </button>
              )}
            </div>
          ) : (
            <p className={styles.infoPanelHint}>Najed mysi na mesto pro detail.</p>
          )}
          {myCity && (
            <div className={styles.myInfo} style={{ marginTop: '1rem' }}>
              <h3>Moje mesto</h3>
              <p><strong>{myCity.jmeno}</strong></p>
              <p>Pozice: ({myCity.x}, {myCity.y})</p>
              <p>Stat: {myCity.statjmeno || '—'}</p>
              <button
                className={styles.navBtn}
                style={{ marginTop: '0.5rem' }}
                onClick={() => {
                  setViewX(Math.max(0, Math.min(MAP_MAX - GRID_SIZE + 1, myCity.x - Math.floor(GRID_SIZE / 2))));
                  setViewY(Math.max(0, Math.min(MAP_MAX - GRID_SIZE + 1, myCity.y - Math.floor(GRID_SIZE / 2))));
                }}
              >
                Centrovat na me mesto
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Visible cities table */}
      <div className={styles.cityList}>
        <h2 className={styles.sectionTitle}>Mesta v zobrazeni ({visibleCities.length})</h2>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nazev</th>
                <th>Vlastnik</th>
                <th>Pozice</th>
                <th>Stat</th>
                <th>Populace</th>
                <th>Akce</th>
              </tr>
            </thead>
            <tbody>
              {visibleCities.map((city) => {
                const isOwn = city.userId === userId;
                return (
                  <tr key={city.id} className={isOwn ? styles.ownRow : undefined}>
                    <td>{city.jmeno}</td>
                    <td>{city.userjmeno}</td>
                    <td>({city.x}, {city.y})</td>
                    <td>{city.statjmeno || '—'}</td>
                    <td>{city.populace.toLocaleString('cs-CZ')}</td>
                    <td>
                      {!isOwn && (
                        <button
                          className={styles.attackBtnSmall}
                          onClick={() => setAttackTarget(city)}
                        >
                          Zautocit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attack form */}
      {attackTarget && myCity && (
        <div className={styles.attackSection}>
          <h2>Utok na: {attackTarget.jmeno} ({attackTarget.userjmeno})</h2>
          <p style={{ color: '#8b949e', marginBottom: '1rem' }}>
            Pozice: ({attackTarget.x}, {attackTarget.y})
          </p>
          <form onSubmit={handleAttackSubmit}>
            <div className={styles.unitsGrid}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
                const available = (myCity as unknown as Record<string, number>)[`j${i}`] ?? 0;
                return (
                  <div key={i} className={styles.unitInput}>
                    <label>j{i}:</label>
                    <input
                      type="number"
                      min="0"
                      max={available}
                      value={attackUnits[i] || 0}
                      onChange={(e) =>
                        setAttackUnits((prev) => ({ ...prev, [i]: Number(e.target.value) || 0 }))
                      }
                      className={styles.smallInput}
                    />
                    <span>/{available}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button type="submit" className={styles.attackBtn}>Zautocit</button>
              <button
                type="button"
                className={styles.navBtn}
                onClick={() => { setAttackTarget(null); setAttackMsg(''); }}
              >
                Zrusit
              </button>
              {attackMsg && <span style={{ color: attackMsg.includes('Chyba') ? '#f85149' : '#3fb950' }}>{attackMsg}</span>}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
