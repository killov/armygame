import 'reflect-metadata';
import { component } from 'ironbean';
import { DatabaseService } from '../db/DatabaseService';
import { MestoRepository } from '../repositories/MestoRepository';
import { AkceRepository } from '../repositories/AkceRepository';
import { mesto, akce } from '@prisma/client';

export interface BattleResult {
  winner: 'attacker' | 'defender';
  rounds: number;
  attackerLosses: Record<string, number>;
  defenderLosses: Record<string, number>;
  lootedResources: { s1: number; s2: number; s3: number; s4: number };
  log: string[];
}

@component
export class BattleService {
  constructor(
    private mestoRepo: MestoRepository,
    private akceRepo: AkceRepository,
    private db: DatabaseService,
  ) {}

  /** Zpracuje pohyb/útok který dorazil (typ=6) */
  async processArrival(akceId: number): Promise<void> {
    const akceRecord = await this.db.client.akce.findUnique({ where: { id: akceId } });
    if (!akceRecord || akceRecord.typ !== 6) return;

    const attackerMesto = await this.mestoRepo.getById(akceRecord.mesto!);
    const defenderMesto = await this.mestoRepo.getById(akceRecord.cil);
    if (!attackerMesto || !defenderMesto) return;

    // Útok na cizí město
    if (defenderMesto.user !== akceRecord.user) {
      const result = this.battle(akceRecord, defenderMesto);
      await this.applyBattleResult(akceRecord, attackerMesto, defenderMesto, result);
    } else {
      // Vlastní město — vrať jednotky
      await this.returnUnits(akceRecord, attackerMesto);
    }

    await this.db.client.akce.delete({ where: { id: akceId } });
    await this.db.client.pohyb.deleteMany({ where: { akce: akceId } });
  }

  private battle(attack: akce, defender: mesto): BattleResult {
    const log: string[] = [];
    let aUnits = this.countUnitsFromAkce(attack);
    let dUnits = this.countUnitsFromMesto(defender);
    let rounds = 0;
    const attackerLosses: Record<string, number> = {};
    const defenderLosses: Record<string, number> = {};

    while (aUnits > 0 && dUnits > 0 && rounds < 5) {
      rounds++;
      const luck = 0.85 + Math.random() * 0.3;
      const aStrength = aUnits * luck;
      const dStrength = dUnits / luck;

      if (aStrength > dStrength) {
        const loss = Math.max(1, Math.floor(dUnits * 0.2));
        dUnits -= loss;
        log.push(`Kolo ${rounds}: Útočník vítězí, obránce ztrácí ${loss} jednotek`);
      } else {
        const loss = Math.max(1, Math.floor(aUnits * 0.2));
        aUnits -= loss;
        log.push(`Kolo ${rounds}: Obránce vítězí, útočník ztrácí ${loss} jednotek`);
      }
    }

    const attackerWon = aUnits > 0 && dUnits <= 0;
    const loot = attackerWon
      ? {
          s1: Math.floor(defender.surovina1 * 0.3),
          s2: Math.floor(defender.surovina2 * 0.3),
          s3: Math.floor(defender.surovina3 * 0.3),
          s4: Math.floor(defender.surovina4 * 0.3),
        }
      : { s1: 0, s2: 0, s3: 0, s4: 0 };

    return {
      winner: attackerWon ? 'attacker' : 'defender',
      rounds,
      attackerLosses,
      defenderLosses,
      lootedResources: loot,
      log,
    };
  }

  private countUnitsFromAkce(source: akce): number {
    let total = 0;
    for (let i = 1; i <= 8; i++) {
      total += (source[`j${i}` as keyof akce] as number) ?? 0;
    }
    return total;
  }

  private countUnitsFromMesto(source: mesto): number {
    let total = 0;
    for (let i = 1; i <= 8; i++) {
      total += (source[`j${i}` as keyof mesto] as number) ?? 0;
    }
    return total;
  }

  private async applyBattleResult(
    attack: akce,
    attacker: mesto,
    defender: mesto,
    result: BattleResult,
  ) {
    if (result.winner === 'attacker') {
      // Útočník získá lupu
      await this.mestoRepo.update(attacker.id, {
        surovina1: attacker.surovina1 + result.lootedResources.s1,
        surovina2: attacker.surovina2 + result.lootedResources.s2,
        surovina3: attacker.surovina3 + result.lootedResources.s3,
        surovina4: attacker.surovina4 + result.lootedResources.s4,
      });
      await this.mestoRepo.update(defender.id, {
        surovina1: Math.max(0, defender.surovina1 - result.lootedResources.s1),
        surovina2: Math.max(0, defender.surovina2 - result.lootedResources.s2),
        surovina3: Math.max(0, defender.surovina3 - result.lootedResources.s3),
        surovina4: Math.max(0, defender.surovina4 - result.lootedResources.s4),
      });
    }
    console.log('Battle result:', result.log.join('\n'));
  }

  private async returnUnits(attack: akce, home: mesto) {
    const updates: Partial<mesto> = {};
    for (let i = 1; i <= 8; i++) {
      const key = `j${i}` as keyof mesto;
      const inAttack = (attack[`j${i}` as keyof akce] as number) ?? 0;
      const inHome = (home[key] as number) ?? 0;
      if (inAttack > 0) (updates as Record<string, number>)[key] = inHome + inAttack;
    }
    if (Object.keys(updates).length > 0) await this.mestoRepo.update(home.id, updates);
  }

  /** Spustí útok - odečte jednotky z města, vytvoří akci typ=6 */
  async sendAttack(
    userId: number,
    fromMestoId: number,
    toMestoId: number,
    units: Record<number, number>,
  ): Promise<{ success: boolean; error?: string }> {
    const from = await this.mestoRepo.getById(fromMestoId);
    const to = await this.mestoRepo.getById(toMestoId);
    if (!from || !to) return { success: false, error: 'Město nenalezeno' };
    if (from.user !== userId) return { success: false, error: 'Nemáš přístup' };
    if (to.user === userId) return { success: false, error: 'Nemůžeš útočit na vlastní město' };

    // Zkontroluj dostatek jednotek
    for (const [id, count] of Object.entries(units)) {
      const key = `j${id}` as keyof mesto;
      if (((from[key] as number) ?? 0) < count) {
        return { success: false, error: `Nedostatek jednotky j${id}` };
      }
    }

    // Vypočítej čas pohybu
    const dist = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));
    const speed = 5;
    const travelTime = Math.max(10, Math.floor(dist / speed));
    const now = Math.floor(Date.now() / 1000);

    // Odečti jednotky z města
    const updates: Partial<mesto> = {};
    const akceData: Record<string, number> = {};
    for (let i = 1; i <= 8; i++) {
      const count = units[i] ?? 0;
      const key = `j${i}` as keyof mesto;
      const current = (from[key] as number) ?? 0;
      (updates as Record<string, number>)[key] = current - count;
      akceData[`j${i}`] = count;
    }
    await this.mestoRepo.update(fromMestoId, updates);

    // Vytvoř akci
    await this.akceRepo.create({
      user: userId,
      mesto: fromMestoId,
      cil: toMestoId,
      budova: 0,
      delka: travelTime,
      cas: now,
      dokonceni: now + travelTime,
      typ: 6,
      typ_jednotky: 0,
      obchodniku: 0,
      surovina1: 0,
      surovina2: 0,
      surovina3: 0,
      surovina4: 0,
      j1: akceData.j1,
      j2: akceData.j2,
      j3: akceData.j3,
      j4: akceData.j4,
      j5: akceData.j5,
      j6: akceData.j6,
      j7: akceData.j7,
      j8: akceData.j8,
    });

    return { success: true };
  }

  /** Zpracuje všechny příchozí útoky na město */
  async processArrivals(mestoId: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const arrivals = await this.db.client.akce.findMany({
      where: { cil: mestoId, typ: 6, dokonceni: { lte: now } },
    });
    for (const a of arrivals) await this.processArrival(a.id);
  }
}
