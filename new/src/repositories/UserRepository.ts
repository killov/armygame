import { component } from "ironbean";
import { DatabaseService } from "../db/DatabaseService";
import { users } from "@prisma/client";

@component
export class UserRepository {
    constructor(private db: DatabaseService) {}

    async getById(id: number): Promise<users | null> {
        return this.db.client.users.findUnique({ where: { id } });
    }

    async getByJmeno(jmeno: string): Promise<users | null> {
        return this.db.client.users.findFirst({ where: { jmeno } });
    }

    async create(data: Omit<users, "id">): Promise<users> {
        return this.db.client.users.create({ data });
    }

    async update(id: number, data: Partial<users>): Promise<users> {
        return this.db.client.users.update({ where: { id }, data });
    }
}
