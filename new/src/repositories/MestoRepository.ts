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
}
