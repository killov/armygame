import { component } from "ironbean";
import { mesto, users } from "@prisma/client";
import { MestoRepository } from "../repositories/MestoRepository";
import { UserRepository } from "../repositories/UserRepository";
import { validujPrejmenovani } from "../lib/game/suroviny";

export interface AktualniMesto {
  user: users;
  mesto: mesto;
  mesta: mesto[];
}

/** Mesto::jednotky — vlastní jednotky j1..j8 plus součet podpor (index 0 = j1). */
export function jednotkyMesta(m: mesto, podpory: readonly number[]): number[] {
  return [m.j1, m.j2, m.j3, m.j4, m.j5, m.j6, m.j7, m.j8].map((j, i) => j + (podpory[i] ?? 0));
}

/** Aktuální město hráče (users.mesto) pro herní rám: výběr, přejmenování a přepnutí s kontrolou vlastnictví. */
@component
export class MestoRamService {
  constructor(
    private mestoRepo: MestoRepository,
    private userRepo: UserRepository
  ) {}

  /**
   * www/index.php: nacti(users.mesto), a když město hráči nepatří (dobyté, smazané), Mesto::pridel
   * přidělí jeho první město a zapíše ho do users.mesto. Bez města vrací null.
   */
  async aktualniMesto(user: users): Promise<AktualniMesto | null> {
    const mesta = await this.mestoRepo.getByUserId(user.id);
    const vlastni = mesta.find((m) => m.id === user.mesto);
    if (vlastni) return { user, mesto: vlastni, mesta };

    const [prvni] = mesta;
    if (!prvni) return null;
    await this.userRepo.update(user.id, { mesto: prvni.id });
    return { user: { ...user, mesto: prvni.id }, mesto: prvni, mesta };
  }

  /** inc/hra/post/rename.php — přejmenuje jen aktuální město hráče; id od klienta se nepřijímá. */
  async prejmenuj(user: users, vstup: string): Promise<{ chyba: number; jmeno: string }> {
    const vysledek = validujPrejmenovani(vstup);
    if (vysledek.chyba !== 0) return vysledek;

    const aktualni = await this.aktualniMesto(user);
    if (!aktualni) return { chyba: 1, jmeno: vysledek.jmeno };
    await this.mestoRepo.update(aktualni.mesto.id, { jmeno: vysledek.jmeno });
    return vysledek;
  }

  /** Přepnutí aktuálního města; cizí nebo neexistující id nic nezapíše a vrátí null. */
  async prepni(user: users, mestoId: number): Promise<mesto | null> {
    if (!Number.isInteger(mestoId)) return null;
    const cil = await this.mestoRepo.getById(mestoId);
    if (!cil || cil.user !== user.id) return null;
    await this.userRepo.update(user.id, { mesto: cil.id });
    return cil;
  }
}
