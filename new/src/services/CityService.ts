import { component } from "ironbean";
import { MestoRepository } from "../repositories/MestoRepository";
import { AkceRepository } from "../repositories/AkceRepository";
import { UserRepository } from "../repositories/UserRepository";
import { DatabaseService } from "../db/DatabaseService";
import { mesto } from "@prisma/client";
import {
  BUDOVY,
  getBuildingUpgradeCost,
  getBuildingTime,
  produkce,
  skladKapacita,
} from "../lib/gameData";

export interface Resources {
  s1: number;
  s2: number;
  s3: number;
  s4: number;
  sklad: number;
  populace: number;
}

@component
export class CityService {
  constructor(
    private mestoRepo: MestoRepository,
    private akceRepo: AkceRepository,
    private db: DatabaseService
  ) {}

  /** Vypočítá aktuální suroviny s akumulací od suroviny_time a uloží do DB */
  async getResources(mestoId: number): Promise<Resources> {
    const mesto = await this.mestoRepo.getById(mestoId);
    if (!mesto) throw new Error(`Město ${mestoId} nenalezeno`);

    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - mesto.suroviny_time;

    const cap = skladKapacita(mesto.b6);

    const s1 = Math.min(
      Math.floor(mesto.surovina1 + (mesto.surovina1_produkce / 3600) * elapsed),
      cap
    );
    const s2 = Math.min(
      Math.floor(mesto.surovina2 + (mesto.surovina2_produkce / 3600) * elapsed),
      cap
    );
    const s3 = Math.min(
      Math.floor(mesto.surovina3 + (mesto.surovina3_produkce / 3600) * elapsed),
      cap
    );
    const s4 = Math.min(
      Math.floor(mesto.surovina4 + (mesto.surovina4_produkce / 3600) * elapsed),
      cap
    );

    // Ulož aktualizované suroviny
    await this.mestoRepo.update(mestoId, {
      surovina1: s1,
      surovina2: s2,
      surovina3: s3,
      surovina4: s4,
      suroviny_time: now,
    });

    return { s1, s2, s3, s4, sklad: cap, populace: mesto.populace };
  }

  /** Vypočítá cenu upgradu budovy */
  getBuildingUpgradeCost(
    buildingId: number,
    currentLevel: number
  ): { surovina1: number; surovina2: number } {
    return getBuildingUpgradeCost(buildingId, currentLevel);
  }

  /** Vypočítá čas stavby v sekundách */
  getBuildingTime(buildingId: number, currentLevel: number): number {
    return getBuildingTime(buildingId, currentLevel);
  }

  /** Zkontroluje zda lze upgradovat budovu */
  canUpgrade(
    m: mesto,
    buildingId: number
  ): { ok: boolean; reason?: string } {
    const bConfig = BUDOVY[buildingId];
    if (!bConfig) return { ok: false, reason: 'Neznámá budova' };

    const currentLevel = this.getBuildingLevel(m, buildingId);

    if (currentLevel >= bConfig.maximum) {
      return { ok: false, reason: `Budova je na maximálním levelu (${bConfig.maximum})` };
    }

    // Zkontroluj požadavky na jiné budovy
    for (const [reqBuildingId, reqLevel] of Object.entries(bConfig.pozadavky)) {
      const reqLevel_num = reqLevel as number;
      const actualLevel = this.getBuildingLevel(m, Number(reqBuildingId));
      if (actualLevel < reqLevel_num) {
        const reqName = BUDOVY[Number(reqBuildingId)]?.nazev ?? `b${reqBuildingId}`;
        return {
          ok: false,
          reason: `Vyžaduje ${reqName} level ${reqLevel_num} (máš ${actualLevel})`,
        };
      }
    }

    // Zkontroluj suroviny
    const cost = getBuildingUpgradeCost(buildingId, currentLevel);
    if (m.surovina1 < cost.surovina1) {
      return {
        ok: false,
        reason: `Nedostatek stavebního materiálu (${m.surovina1}/${cost.surovina1})`,
      };
    }
    if (m.surovina2 < cost.surovina2) {
      return {
        ok: false,
        reason: `Nedostatek železa (${m.surovina2}/${cost.surovina2})`,
      };
    }

    return { ok: true };
  }

  /** Získá level budovy z objektu město */
  getBuildingLevel(m: mesto, buildingId: number): number {
    const key = `b${buildingId}` as keyof mesto;
    return (m[key] as number) ?? 0;
  }

  /** Aplikuje dokončené akce (typ=1) na město */
  async processCompletedActions(mestoId: number): Promise<void> {
    const completed = await this.akceRepo.getCompletedByMesto(mestoId);

    for (const akce of completed) {
      if (akce.typ === 1 && akce.budova != null) {
        // Upgrade budovy - zvýš level o 1
        const m = await this.mestoRepo.getById(mestoId);
        if (!m) continue;

        const key = `b${akce.budova}` as keyof typeof m;
        const currentLevel = (m[key] as number) ?? 0;
        await this.mestoRepo.update(mestoId, { [key]: currentLevel + 1 } as Partial<mesto>);

        // Přepočítej produkci po upgradu
        await this.recalculateProduction(mestoId);
      }
      // Smaž akci po zpracování
      await this.akceRepo.delete(akce.id);
    }
  }

  /** Aplikuje dokončené akce (typ=5) - přidá jednotky do města */
  async processUnitActions(mestoId: number): Promise<void> {
    const completed = await this.akceRepo.getCompletedByMesto(mestoId);
    const m = await this.mestoRepo.getById(mestoId);
    if (!m) return;

    for (const akce of completed) {
      if (akce.typ === 5) {
        const key = `j${akce.typ_jednotky}` as keyof typeof m;
        const current = (m[key] as number) ?? 0;
        const count = (akce[`j${akce.typ_jednotky}` as keyof typeof akce] as number) ?? 0;
        await this.mestoRepo.update(mestoId, { [key]: current + count } as Partial<mesto>);
        await this.akceRepo.delete(akce.id);
      }
    }
  }

  /** Přepočítá produkci surovin podle aktuálních levelů budov */
  private async recalculateProduction(mestoId: number): Promise<void> {
    const m = await this.mestoRepo.getById(mestoId);
    if (!m) return;

    await this.mestoRepo.update(mestoId, {
      surovina1_produkce: produkce(m.b2),
      surovina2_produkce: produkce(m.b3),
      surovina3_produkce: produkce(m.b4),
      surovina4_produkce: produkce(m.b5),
    });
  }

  /** Aplikuje dokončené výzkumné akce (typ=2) */
  async processResearchActions(userId: number, mestoId: number): Promise<void> {
    const completed = await this.akceRepo.getCompletedByMesto(mestoId);
    for (const akce of completed) {
      if (akce.typ === 2 && akce.budova != null) {
        const userRepo = new UserRepository(this.db);
        const user = await userRepo.getById(userId);
        if (!user) continue;
        const key = `v${akce.budova}` as keyof typeof user;
        const current = (user[key] as number) ?? 0;
        await this.db.client.users.update({
          where: { id: userId },
          data: { [key]: current + 1 },
        });
        await this.akceRepo.delete(akce.id);
      }
    }
  }

  /** Spustí stavbu budovy */
  async startBuilding(
    userId: number,
    mestoId: number,
    buildingId: number
  ): Promise<{ success: boolean; error?: string }> {
    // Načti aktuální stav po akumulaci surovin
    await this.getResources(mestoId);

    const m = await this.mestoRepo.getById(mestoId);
    if (!m) return { success: false, error: 'Město nenalezeno' };
    if (m.user !== userId) return { success: false, error: 'Nemáš přístup k tomuto městu' };

    // Zkontroluj frontu (max 3 stavby)
    const pending = await this.akceRepo.getPendingByMesto(mestoId);
    const buildQueue = pending.filter((a) => a.typ === 1);
    if (buildQueue.length >= 3) {
      return { success: false, error: 'Fronta staveb je plná (max 3)' };
    }

    // Zkontroluj podmínky
    const check = this.canUpgrade(m, buildingId);
    if (!check.ok) {
      return { success: false, error: check.reason };
    }

    const currentLevel = this.getBuildingLevel(m, buildingId);
    const cost = getBuildingUpgradeCost(buildingId, currentLevel);

    // Spočítej čas stavby (b1 urychluje stavbu)
    let buildTime = getBuildingTime(buildingId, currentLevel);
    if (m.b1 > 0) {
      buildTime = Math.max(1, Math.floor(buildTime / (1 + m.b1 * 0.05)));
    }

    const now = Math.floor(Date.now() / 1000);
    // Chain from last pending building's completion time
    const lastCompletion = buildQueue.length > 0
      ? Math.max(...buildQueue.map(p => p.dokonceni))
      : now;
    const dokonceni = lastCompletion + buildTime;

    // Odečti suroviny
    await this.mestoRepo.update(mestoId, {
      surovina1: m.surovina1 - cost.surovina1,
      surovina2: m.surovina2 - cost.surovina2,
    });

    // Vytvoř akci
    await this.akceRepo.create({
      user: userId,
      mesto: mestoId,
      cil: mestoId,
      budova: buildingId,
      delka: buildTime,
      cas: now,
      dokonceni,
      typ: 1,
      typ_jednotky: 0,
      obchodniku: 0,
      surovina1: 0,
      surovina2: 0,
      surovina3: 0,
      surovina4: 0,
      j1: 0,
      j2: 0,
      j3: 0,
      j4: 0,
      j5: 0,
      j6: 0,
      j7: 0,
      j8: 0,
    });

    return { success: true };
  }
}
