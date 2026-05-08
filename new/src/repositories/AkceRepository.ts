import { component } from "ironbean";
import { DatabaseService } from "../db/DatabaseService";
import { akce } from "@prisma/client";

@component
export class AkceRepository {
  constructor(private db: DatabaseService) {}

  async getPendingByMesto(mestoId: number): Promise<akce[]> {
    return this.db.client.akce.findMany({
      where: { mesto: mestoId },
      orderBy: { dokonceni: 'asc' },
    });
  }

  async getCompletedByMesto(mestoId: number): Promise<akce[]> {
    const now = Math.floor(Date.now() / 1000);
    return this.db.client.akce.findMany({
      where: {
        mesto: mestoId,
        dokonceni: { lte: now },
      },
      orderBy: { dokonceni: 'asc' },
    });
  }

  async create(data: Omit<akce, 'id'>): Promise<akce> {
    return this.db.client.akce.create({ data });
  }

  async delete(id: number): Promise<void> {
    await this.db.client.akce.delete({ where: { id } });
  }
}
