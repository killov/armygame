'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.scss';
import { fetchMapData, MapCity, MapData } from '@/app/actions/mapa';
import { sendAttackAction } from '@/app/actions/battle';

const CELL_SIZE = 30;
const MAP_SIZE = 1000;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 10;
const ZOOM_STEP = 1.15;
const DEFAULT_ZOOM = 3;
const GRASS_COLOR = '#63903D';

// Simple integer hash
function hash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = ((h ^ (h >> 13)) * 1274126177) >>> 0;
  return h;
}

// Perlin-like noise using grid interpolation for natural clusters
function noise2d(x: number, y: number): number {
  const gx = Math.floor(x / 8); // grid cell size = 8 tiles
  const gy = Math.floor(y / 8);
  const fx = (x / 8) - gx; // fractional position within cell
  const fy = (y / 8) - gy;
  // Smooth interpolation
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  // Corner values
  const n00 = (hash(gx, gy) % 1000) / 1000;
  const n10 = (hash(gx + 1, gy) % 1000) / 1000;
  const n01 = (hash(gx, gy + 1) % 1000) / 1000;
  const n11 = (hash(gx + 1, gy + 1) % 1000) / 1000;
  // Bilinear interpolation
  const nx0 = n00 + sx * (n10 - n00);
  const nx1 = n01 + sx * (n11 - n01);
  return nx0 + sy * (nx1 - nx0);
}

// Terrain type using layered noise for natural-looking clusters
// Returns: 'forest' | 'hills' | null (grass)
function terrainImage(x: number, y: number): 'forest' | 'hills' | null {
  const n1 = noise2d(x, y);       // large-scale biome
  const n2 = noise2d(x + 500, y + 500); // secondary layer for hills
  const detail = (hash(x, y) % 100) / 100; // small detail variation

  // Forest: continuous areas where noise > 0.45
  if (n1 > 0.45 && detail > 0.15) return 'forest';
  // Hills: where secondary noise is high and not forest
  if (n2 > 0.6 && detail > 0.25) return 'hills';
  // Grass: everything else
  return null;
}

export default function MapaPage() {
  const router = useRouter();
  const [data, setData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(true);

  // Pan & zoom state
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  // Drag state (refs for performance - no re-render during drag)
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetAtDragStart = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);

  // UI state
  const [selectedCity, setSelectedCity] = useState<MapCity | null>(null);
  const [attackTarget, setAttackTarget] = useState<MapCity | null>(null);
  const [attackUnits, setAttackUnits] = useState<Record<number, number>>({});
  const [attackMsg, setAttackMsg] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Terrain image refs (cached)
  const imagesLoaded = useRef(false);
  const [imagesReady, setImagesReady] = useState(false);
  const imgCityMini = useRef<HTMLImageElement | null>(null);
  const imgCityMed = useRef<HTMLImageElement | null>(null);
  const imgForestMini = useRef<HTMLImageElement | null>(null);
  const imgForestMed = useRef<HTMLImageElement | null>(null);
  const imgHillsMini = useRef<HTMLImageElement | null>(null);
  const imgHillsMed = useRef<HTMLImageElement | null>(null);

  // Load terrain images
  useEffect(() => {
    if (imagesLoaded.current) return;
    const sources: [string, React.MutableRefObject<HTMLImageElement | null>][] = [
      ['/mapa/city_mini.png', imgCityMini],
      ['/mapa/city_med.png', imgCityMed],
      ['/mapa/forest_mini.png', imgForestMini],
      ['/mapa/forest_med.png', imgForestMed],
      ['/mapa/hills_mini.png', imgHillsMini],
      ['/mapa/hills_med.png', imgHillsMed],
    ];
    let loaded = 0;
    for (const [src, ref] of sources) {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        ref.current = img;
        loaded++;
        if (loaded === sources.length) {
          imagesLoaded.current = true;
          setImagesReady(true);
        }
      };
    }
  }, []);

  // Load data
  useEffect(() => {
    fetchMapData().then((result) => {
      if (!result) {
        router.push('/login');
        return;
      }
      setData(result);
      setLoading(false);
    });
  }, [router]);

  // Center on own city once data loads
  useEffect(() => {
    if (!data?.myCity || !containerRef.current) return;
    const container = containerRef.current;
    const cx = data.myCity.x * CELL_SIZE + CELL_SIZE / 2;
    const cy = data.myCity.y * CELL_SIZE + CELL_SIZE / 2;
    setOffset({
      x: container.clientWidth / 2 - cx,
      y: container.clientHeight / 2 - cy,
    });
  }, [data]);

  // Draw canvas
  const drawMap = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !data) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Background - grass green
    ctx.fillStyle = GRASS_COLOR;
    ctx.fillRect(0, 0, w, h);

    // Compute visible cell range
    const cellPx = CELL_SIZE * zoom;
    const startCol = Math.max(0, Math.floor(-offset.x / cellPx));
    const startRow = Math.max(0, Math.floor(-offset.y / cellPx));
    const endCol = Math.min(MAP_SIZE, Math.ceil((w - offset.x) / cellPx));
    const endRow = Math.min(MAP_SIZE, Math.ceil((h - offset.y) / cellPx));

    // Choose mini vs med images based on zoom
    const useMed = zoom >= 1.5;
    const imgForest = useMed ? imgForestMed.current : imgForestMini.current;
    const imgHills = useMed ? imgHillsMed.current : imgHillsMini.current;
    const imgCity = useMed ? imgCityMed.current : imgCityMini.current;

    // Build a set of city coordinates for quick lookup
    const { cities, userId } = data;
    const cityMap = new Map<string, MapCity>();
    for (const city of cities) {
      cityMap.set(`${city.x},${city.y}`, city);
    }

    // Draw terrain tiles for visible cells
    // At very low zoom, skip some cells for performance
    let tileStep = 1;
    if (zoom < 0.4) tileStep = 4;
    else if (zoom < 0.6) tileStep = 3;
    else if (zoom < 0.8) tileStep = 2;

    if (imagesLoaded.current) {
      for (let row = startRow; row < endRow; row += tileStep) {
        for (let col = startCol; col < endCol; col += tileStep) {
          const px = offset.x + col * cellPx;
          const py = offset.y + row * cellPx;
          const tileSize = cellPx * tileStep;

          // Check if this cell has a city
          const cityHere = cityMap.get(`${col},${row}`);
          let img: HTMLImageElement | null = null;

          if (cityHere) {
            img = imgCity;
          } else {
            const terrain = terrainImage(col, row);
            if (terrain === 'forest') img = imgForest;
            else if (terrain === 'hills') img = imgHills;
            // null = plain grass, no image needed
          }

          if (img) {
            ctx.drawImage(img, px, py, tileSize, tileSize);
          }
        }
      }
    }

    // Grid lines (only when zoomed in enough) - semi-transparent over terrain
    if (zoom >= 0.5) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();

      // Determine grid spacing - skip lines at low zoom
      let step = 1;
      if (zoom < 0.8) step = 5;
      if (zoom < 0.5) step = 10;

      const gridStartCol = Math.ceil(startCol / step) * step;
      const gridStartRow = Math.ceil(startRow / step) * step;

      for (let col = gridStartCol; col <= endCol; col += step) {
        const x = offset.x + col * cellPx;
        ctx.moveTo(x, Math.max(0, offset.y + startRow * cellPx));
        ctx.lineTo(x, Math.min(h, offset.y + endRow * cellPx));
      }
      for (let row = gridStartRow; row <= endRow; row += step) {
        const y = offset.y + row * cellPx;
        ctx.moveTo(Math.max(0, offset.x + startCol * cellPx), y);
        ctx.lineTo(Math.min(w, offset.x + endCol * cellPx), y);
      }
      ctx.stroke();
    }

    // Coordinate labels on axes (when zoomed in enough)
    if (zoom >= 1.5) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = `${Math.max(8, 10 * zoom)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      let labelStep = 1;
      if (zoom < 2) labelStep = 5;

      const labelStartCol = Math.ceil(startCol / labelStep) * labelStep;
      for (let col = labelStartCol; col <= endCol; col += labelStep) {
        const x = offset.x + col * cellPx + cellPx / 2;
        const y = Math.max(2, offset.y);
        if (x > 0 && x < w) {
          ctx.fillText(String(col), x, y);
        }
      }

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const labelStartRow = Math.ceil(startRow / labelStep) * labelStep;
      for (let row = labelStartRow; row <= endRow; row += labelStep) {
        const x = Math.max(2, offset.x);
        const y = offset.y + row * cellPx + cellPx / 2;
        if (y > 0 && y < h) {
          ctx.fillText(String(row), x, y);
        }
      }
    }

    // Cities overlay - colored border glow and labels
    for (const city of cities) {
      if (city.x < startCol - 1 || city.x > endCol || city.y < startRow - 1 || city.y > endRow) continue;

      const cx = offset.x + city.x * cellPx + cellPx / 2;
      const cy = offset.y + city.y * cellPx + cellPx / 2;

      const isOwn = city.userId === userId;
      const isSelected = selectedCity?.id === city.id;
      const isAttackTarget = attackTarget?.id === city.id;

      // Border glow ring around city tile
      const glowRadius = cellPx * 0.55;
      const gradient = ctx.createRadialGradient(cx, cy, glowRadius * 0.6, cx, cy, glowRadius * 1.3);
      if (isOwn) {
        gradient.addColorStop(0, 'rgba(35, 180, 54, 0.0)');
        gradient.addColorStop(0.6, 'rgba(35, 180, 54, 0.35)');
        gradient.addColorStop(1, 'rgba(35, 180, 54, 0)');
      } else {
        gradient.addColorStop(0, 'rgba(31, 111, 235, 0.0)');
        gradient.addColorStop(0.6, 'rgba(31, 111, 235, 0.35)');
        gradient.addColorStop(1, 'rgba(31, 111, 235, 0)');
      }
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // Colored border ring
      ctx.strokeStyle = isOwn ? 'rgba(63, 185, 80, 0.8)' : 'rgba(88, 166, 255, 0.8)';
      ctx.lineWidth = Math.max(1.5, 2 * zoom);
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Selection / attack ring
      if (isSelected || isAttackTarget) {
        ctx.strokeStyle = isAttackTarget ? '#f85149' : '#ffa657';
        ctx.lineWidth = Math.max(2, 3 * zoom);
        ctx.beginPath();
        ctx.arc(cx, cy, glowRadius + 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // City name label
      if (zoom >= 0.8) {
        const fontSize = Math.max(9, 11 * zoom);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Text shadow for readability
        const labelY = cy + glowRadius + 2;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillText(city.jmeno, cx + 1, labelY + 1);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(city.jmeno, cx, labelY);
      }
    }

    // Map border
    const mapW = MAP_SIZE * cellPx;
    const mapH = MAP_SIZE * cellPx;
    ctx.strokeStyle = 'rgba(88, 166, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(offset.x, offset.y, mapW, mapH);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, offset, zoom, selectedCity, attackTarget, imagesReady]);

  // Redraw on any relevant change
  useEffect(() => {
    drawMap();
  }, [drawMap]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => drawMap());
    observer.observe(container);
    return () => observer.disconnect();
  }, [drawMap]);

  // --- Mouse event handlers ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    hasDragged.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetAtDragStart.current = { ...offset };
    e.preventDefault();
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasDragged.current = true;
    }
    setOffset({
      x: offsetAtDragStart.current.x + dx,
      y: offsetAtDragStart.current.y + dy,
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const handleMouseLeave = useCallback(() => {
    dragging.current = false;
  }, []);

  // Click to select city
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (hasDragged.current) return;
    if (!data || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const cellPx = CELL_SIZE * zoom;
    const mapX = (mx - offset.x) / cellPx;
    const mapY = (my - offset.y) / cellPx;

    // Find closest city within click tolerance
    const tolerance = Math.max(10, 8 / zoom);
    let closest: MapCity | null = null;
    let closestDist = Infinity;

    for (const city of data.cities) {
      const cx = city.x + 0.5;
      const cy = city.y + 0.5;
      const dist = Math.sqrt((mapX - cx) ** 2 + (mapY - cy) ** 2);
      if (dist < tolerance && dist < closestDist) {
        closest = city;
        closestDist = dist;
      }
    }

    if (closest) {
      setSelectedCity(closest);
    } else {
      setSelectedCity(null);
      setAttackTarget(null);
    }
  }, [data, zoom, offset]);

  // Wheel zoom refs (to avoid stale closures in native listener)
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const offsetRef = useRef(offset);
  offsetRef.current = offset;

  // Attach native wheel listener with { passive: false } to allow preventDefault
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const currentZoom = zoomRef.current;
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom * factor));

      // Zoom towards cursor
      const scale = newZoom / currentZoom;
      const prev = offsetRef.current;
      setOffset({
        x: mx - (mx - prev.x) * scale,
        y: my - (my - prev.y) * scale,
      });
      setZoom(newZoom);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    // Disable scroll on ALL parent elements while map is mounted
    // so wheel events reach our handler instead of being consumed by scroll
    const savedOverflows: [HTMLElement, string][] = [];
    let el: HTMLElement | null = container.parentElement;
    while (el) {
      savedOverflows.push([el, el.style.overflow]);
      el.style.overflow = 'hidden';
      el = el.parentElement;
    }

    return () => {
      container.removeEventListener('wheel', handleWheel);
      // Restore original overflow values
      for (const [elem, orig] of savedOverflows) {
        elem.style.overflow = orig;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Touch event handlers ---
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const touchPinchDist = useRef<number | null>(null);
  const touchZoomStart = useRef<number>(1);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      dragging.current = true;
      hasDragged.current = false;
      const t = e.touches[0];
      dragStart.current = { x: t.clientX, y: t.clientY };
      offsetAtDragStart.current = { ...offset };
      touchStart.current = { x: t.clientX, y: t.clientY };
    } else if (e.touches.length === 2) {
      dragging.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchPinchDist.current = Math.sqrt(dx * dx + dy * dy);
      touchZoomStart.current = zoom;
    }
  }, [offset, zoom]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && dragging.current) {
      const t = e.touches[0];
      const dx = t.clientX - dragStart.current.x;
      const dy = t.clientY - dragStart.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasDragged.current = true;
      }
      setOffset({
        x: offsetAtDragStart.current.x + dx,
        y: offsetAtDragStart.current.y + dy,
      });
    } else if (e.touches.length === 2 && touchPinchDist.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = dist / touchPinchDist.current;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, touchZoomStart.current * scale));
      setZoom(newZoom);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    dragging.current = false;
    touchPinchDist.current = null;
  }, []);

  // Center on my city
  const centerOnMyCity = useCallback(() => {
    if (!data?.myCity || !containerRef.current) return;
    const container = containerRef.current;
    const cellPx = CELL_SIZE * zoom;
    const cx = data.myCity.x * cellPx + cellPx / 2;
    const cy = data.myCity.y * cellPx + cellPx / 2;
    setOffset({
      x: container.clientWidth / 2 - cx,
      y: container.clientHeight / 2 - cy,
    });
  }, [data, zoom]);

  // Current center coordinates
  const getCenterCoords = useCallback(() => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const container = containerRef.current;
    const cellPx = CELL_SIZE * zoom;
    return {
      x: Math.round((container.clientWidth / 2 - offset.x) / cellPx),
      y: Math.round((container.clientHeight / 2 - offset.y) / cellPx),
    };
  }, [offset, zoom]);

  // Attack form submit
  const handleAttackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.myCity || !attackTarget) return;
    setAttackMsg('');
    const result = await sendAttackAction(data.myCity.id, attackTarget.id, attackUnits);
    if (result.success) {
      setAttackMsg('Utok vyslan!');
      setAttackTarget(null);
      setAttackUnits({});
    } else {
      setAttackMsg(result.error || 'Chyba pri utoku');
    }
  };

  if (loading) {
    return <div className={styles.page}><p style={{ color: '#8b949e' }}>Nacitam mapu...</p></div>;
  }

  if (!data) return null;

  const center = getCenterCoords();

  return (
    <div className={styles.page}>
      {/* Map viewport */}
      <div
        ref={containerRef}
        className={styles.mapViewport}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleCanvasClick}

        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <canvas ref={canvasRef} className={styles.mapCanvas} />

        {/* HUD overlay */}
        <div className={styles.hud}>
          <div className={styles.hudCoords}>
            Stred: ({center.x}, {center.y}) | Zoom: {zoom.toFixed(1)}x
          </div>
          <div className={styles.hudButtons}>
            {data.myCity && (
              <button className={styles.hudBtn} onClick={(e) => { e.stopPropagation(); centerOnMyCity(); }}>
                Moje mesto
              </button>
            )}
            <button className={styles.hudBtn} onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.min(MAX_ZOOM, z * ZOOM_STEP)); }}>+</button>
            <button className={styles.hudBtn} onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.max(MIN_ZOOM, z / ZOOM_STEP)); }}>-</button>
          </div>
          <div className={styles.hudLegend}>
            <span><span className={styles.legendDotOwn} /> Moje</span>
            <span><span className={styles.legendDotEnemy} /> Cizi</span>
          </div>
        </div>
      </div>

      {/* Info panel - floating on the right */}
      {(selectedCity || attackTarget) && (
        <div className={styles.infoPanel}>
          {selectedCity && !attackTarget && (
            <div className={styles.cityInfo}>
              <div className={styles.infoPanelHeader}>
                <h3>{selectedCity.jmeno}</h3>
                <button className={styles.closeBtn} onClick={() => setSelectedCity(null)}>&times;</button>
              </div>
              <p>Hrac: <strong>{selectedCity.userjmeno}</strong></p>
              <p>Pozice: ({selectedCity.x}, {selectedCity.y})</p>
              <p>Stat: {selectedCity.statjmeno || '\u2014'}</p>
              <p>Populace: {selectedCity.populace.toLocaleString('cs-CZ')}</p>
              {selectedCity.userId !== data.userId && (
                <button
                  className={styles.attackBtn}
                  onClick={() => setAttackTarget(selectedCity)}
                >
                  Zautocit
                </button>
              )}
            </div>
          )}

          {attackTarget && data.myCity && (
            <div className={styles.cityInfo}>
              <div className={styles.infoPanelHeader}>
                <h3>Utok: {attackTarget.jmeno}</h3>
                <button className={styles.closeBtn} onClick={() => { setAttackTarget(null); setAttackMsg(''); }}>&times;</button>
              </div>
              <p style={{ color: '#8b949e', marginBottom: '0.75rem' }}>
                {attackTarget.userjmeno} ({attackTarget.x}, {attackTarget.y})
              </p>
              <form onSubmit={handleAttackSubmit}>
                <div className={styles.unitsGrid}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
                    const available = (data.myCity as unknown as Record<string, number>)[`j${i}`] ?? 0;
                    return (
                      <div key={i} className={styles.unitInput}>
                        <label>j{i}:</label>
                        <input
                          type="number"
                          min="0"
                          max={available}
                          value={attackUnits[i] || 0}
                          onChange={(ev) =>
                            setAttackUnits((prev) => ({ ...prev, [i]: Number(ev.target.value) || 0 }))
                          }
                          className={styles.smallInput}
                        />
                        <span>/{available}</span>
                      </div>
                    );
                  })}
                </div>
                <div className={styles.attackActions}>
                  <button type="submit" className={styles.attackBtn}>Zautocit</button>
                  {attackMsg && (
                    <span style={{ color: attackMsg.includes('Chyba') ? '#f85149' : '#3fb950', fontSize: '0.85rem' }}>
                      {attackMsg}
                    </span>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
