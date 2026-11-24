// Port mapa_pocitej z bin/daemon.php: z měst spočítá vliv (dom), příslušnost polí ke státu (stat)
// a bitmasku hranic (hranice), kterou kreslí mapa. Bez DB, ať jde pokrýt unit testem.
import { MAP_MAX, MAP_MIN } from './mapGen';

/** Dominance pole s městem — žádné okolní město ho nepřebije. */
export const MESTO_DOM = 50000;

// Bity hranice podle předlohy: 4 západ, 1 východ, 8 sever, 2 jih.
const HRANICE_ZAPAD = 4;
const HRANICE_VYCHOD = 1;
const HRANICE_SEVER = 8;
const HRANICE_JIH = 2;

/** $okoli z předlohy: pole do vzdálenosti 5 kolem města s vahou 5 − vzdálenost. */
const OKOLI: readonly (readonly [number, number, number])[] = (() => {
  const okoli: [number, number, number][] = [];
  for (let dx = -5; dx <= 5; dx++) {
    for (let dy = -5; dy <= 5; dy++) {
      const vzdalenost = Math.sqrt(dx * dx + dy * dy);
      if ((dx !== 0 || dy !== 0) && vzdalenost <= 5) okoli.push([dx, dy, 5 - vzdalenost]);
    }
  }
  return okoli;
})();

const SIZE = MAP_MAX - MAP_MIN + 1;
const idx = (x: number, y: number) => (x - MAP_MIN) * SIZE + (y - MAP_MIN);
const naMape = (x: number, y: number) => x >= MAP_MIN && x <= MAP_MAX && y >= MAP_MIN && y <= MAP_MAX;

export interface MestoVliv {
  x: number;
  y: number;
  stat: number;
  populace: number;
}

export interface PoleStatu {
  stat: number;
  hranice: number;
  dom: number;
}

export interface MapaStatu {
  pole(x: number, y: number): PoleStatu;
}

/** Města musí přijít v pořadí podle id — při shodné dominanci vyhrává dřívější město jako v předloze. */
export function spocitejMapuStatu(mesta: readonly MestoVliv[]): MapaStatu {
  const n = SIZE * SIZE;
  const stat = new Int32Array(n);
  const hranice = new Int32Array(n);
  const dom = new Int32Array(n);
  const jeMesto = new Uint8Array(n);

  for (const m of mesta) {
    if (!naMape(m.x, m.y)) continue;
    const i = idx(m.x, m.y);
    stat[i] = m.stat;
    dom[i] = MESTO_DOM;
    jeMesto[i] = 1;
    for (const [dx, dy, vaha] of OKOLI) {
      const x = m.x + dx;
      const y = m.y + dy;
      if (!naMape(x, y)) continue;
      const j = idx(x, y);
      const d = Math.round(vaha * m.populace * 10000);
      if (!jeMesto[j] && dom[j] < d) {
        stat[j] = m.stat;
        dom[j] = d;
      }
    }
  }

  for (let y = MAP_MAX; y >= MAP_MIN; y--) {
    let pos = 0;
    for (let x = MAP_MIN; x <= MAP_MAX; x++) {
      const s = stat[idx(x, y)];
      if (s !== pos) {
        if (s !== 0) hranice[idx(x, y)] += HRANICE_ZAPAD;
        if (pos !== 0) hranice[idx(x - 1, y)] += HRANICE_VYCHOD;
      }
      pos = s;
    }
  }

  for (let x = MAP_MIN; x <= MAP_MAX; x++) {
    let pos = 0;
    for (let y = MAP_MAX; y >= MAP_MIN; y--) {
      const s = stat[idx(x, y)];
      if (s !== pos) {
        if (s !== 0) hranice[idx(x, y)] += HRANICE_SEVER;
        if (pos !== 0) hranice[idx(x, y + 1)] += HRANICE_JIH;
      }
      pos = s;
    }
  }

  return {
    pole(x, y) {
      const i = idx(x, y);
      return { stat: stat[i], hranice: hranice[i], dom: dom[i] };
    },
  };
}
