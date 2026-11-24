import { component } from "ironbean";
import { DatabaseService } from "../db/DatabaseService";
import { MapaRepository } from "../repositories/MapaRepository";
import { MestoRepository } from "../repositories/MestoRepository";
import { BLOK_SIZE } from "../lib/game/mapGen";
import {
  HRANICE_SOUSEDE,
  Smer,
  banka,
  najdiVolnePole,
  noveMestoData,
} from "../lib/game/vytvorMesto";

/** Task::mapa_novejblok a Task::statistika_refresh (inc/classes/Task.php). */
const TASK_MAPA_NOVY_BLOK = 3;
const TASK_STATISTIKA = 2;

@component
export class CityFoundingService {
  constructor(
    private mestoRepo: MestoRepository,
    private mapaRepo: MapaRepository,
    private db: DatabaseService
  ) {}

  /**
   * Port Mesto::vytvor_mesto + pridel + User::refresh. Hledá se mimo transakci, ať interactive
   * tx nedrží dlouhou smyčku; souběh o stejné pole řeší podmíněný přepis typ 0 → 1.
   * Vrací id města; když už hráč nějaké má (double-submit), druhé nezakládá.
   */
  async zalozMesto(userId: number, userjmeno: string, jmeno: string, smer: Smer): Promise<number> {
    const [existujici] = await this.mestoRepo.getByUserId(userId);
    if (existujici) return existujici.id;

    const pocet = await this.mestoRepo.countVKvadrantu(smer);

    for (;;) {
      const { x, y, pole } = await najdiVolnePole(smer, pocet, (px, py) => this.mapaRepo.getFree(px, py));

      const zalozeno = await this.db.client.$transaction(async (tx) => {
        const obsazeno = await tx.mapa.updateMany({ where: { id: pole.id, typ: 0 }, data: { typ: 1 } });
        if (obsazeno.count === 0) return false;

        const sousede = pole.stat !== 0 ? HRANICE_SOUSEDE[pole.hranice] ?? [] : [];
        if (sousede.length > 0) {
          // Neexistující soused (okraj mapy) se přeskočí — PHP tam dělá UPDATE ... WHERE id = '' naprázdno.
          const sousedniPole = await tx.mapa.findMany({
            where: { OR: sousede.map((s) => ({ x: x + s.dx, y: y + s.dy })) },
            select: { id: true, x: true, y: true },
          });
          for (const s of sousede) {
            const soused = sousedniPole.find((p) => p.x === x + s.dx && p.y === y + s.dy);
            if (soused) {
              await tx.mapa.update({ where: { id: soused.id }, data: { hranice: { increment: s.add } } });
            }
          }
        }

        await tx.mesto.create({
          data: noveMestoData({
            poleId: pole.id,
            x,
            y,
            jmeno,
            userId,
            userjmeno,
            now: Math.floor(Date.now() / 1000),
          }),
        });

        // Nové město má b8 = 0, takže součet bank přes města z User::refresh je banka(0).
        const bankaHrace = banka(0);
        const user = await tx.users.findUniqueOrThrow({ where: { id: userId }, select: { penize: true } });
        await tx.users.update({
          where: { id: userId },
          data: { mesto: pole.id, banka: bankaHrace, penize: Math.min(user.penize, bankaHrace) },
        });

        await tx.tasks.createMany({
          data: [
            { pro: 1, typ: TASK_MAPA_NOVY_BLOK, x: Math.floor(x / BLOK_SIZE), y: Math.floor(y / BLOK_SIZE) },
            { pro: 1, typ: TASK_STATISTIKA, x: 0, y: 0 },
          ],
        });
        return true;
      });

      if (zalozeno) return pole.id;
    }
  }
}
