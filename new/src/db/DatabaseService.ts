import { component } from "ironbean";
import { PrismaClient } from "@prisma/client";

@component
export class DatabaseService {
    public readonly client: PrismaClient;

    constructor() {
        // V produkci je dobré držet jednu instanci PrismaClient,
        // v dev prostředí v Next.js by se měla cachovat kvůli hot-reloading.
        const globalForPrisma = global as unknown as { prisma: PrismaClient };
        this.client = globalForPrisma.prisma || new PrismaClient();
        if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = this.client;
    }
}
