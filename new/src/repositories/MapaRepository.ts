import { component } from "ironbean";
import { DatabaseService } from "../db/DatabaseService";
import { mapa } from "@prisma/client";

@component
export class MapaRepository {
  constructor(private db: DatabaseService) {}

  async getBlok(blokx: number, bloky: number): Promise<mapa[]> {
    return this.db.client.mapa.findMany({ where: { blokx, bloky } });
  }

  async getMesta(): Promise<mapa[]> {
    return this.db.client.mapa.findMany({ where: { typ: 1 } });
  }

  async getById(id: number): Promise<mapa | null> {
    return this.db.client.mapa.findUnique({ where: { id } });
  }
}
