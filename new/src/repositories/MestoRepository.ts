import { component } from "ironbean";
import { DatabaseService } from "../db/DatabaseService";
import { mesto } from "@prisma/client";
import { Smer, kvadrantWhere } from "../lib/game/vytvorMesto";

@component
export class MestoRepository {
    constructor(private db: DatabaseService) {}

    async getById(id: number): Promise<mesto | null> {
        return this.db.client.mesto.findUnique({ where: { id } });
    }

    async getByUserId(userId: number): Promise<mesto[]> {
        return this.db.client.mesto.findMany({ where: { user: userId } });
    }

    async countVKvadrantu(smer: Smer): Promise<number> {
        return this.db.client.mesto.count({ where: kvadrantWhere(smer) });
    }

    async create(data: Omit<mesto, "id">): Promise<mesto> {
        return this.db.client.mesto.create({ data });
    }

    async update(id: number, data: Partial<mesto>): Promise<mesto> {
        return this.db.client.mesto.update({ where: { id }, data });
    }

    /** Mesto::jednotky_podpory_soucet — cizí jednotky podporující město `kde`, sečtené po typech. */
    async soucetPodpor(kde: number): Promise<number[]> {
        const { _sum } = await this.db.client.podpory.aggregate({
            where: { kde },
            _sum: { j1: true, j2: true, j3: true, j4: true, j5: true, j6: true, j7: true, j8: true },
        });
        return [_sum.j1, _sum.j2, _sum.j3, _sum.j4, _sum.j5, _sum.j6, _sum.j7, _sum.j8].map((j) => j ?? 0);
    }

    /**
     * Čas (unix s) nejbližší budoucí akce města, podklad pro Mesto::refresh_time. Akce s `cas` v minulosti
     * zpracovává daemon; počítat s nimi by z odpočtu udělalo okamžitý refresh ve smyčce.
     */
    async nejblizsiAkceCas(mesto: number, now: number): Promise<number | null> {
        const { _min } = await this.db.client.akce.aggregate({ where: { mesto, cas: { gt: now } }, _min: { cas: true } });
        return _min.cas;
    }
}
