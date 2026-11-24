import { component } from "ironbean";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { UserRepository } from "../repositories/UserRepository";
import { MestoRepository } from "../repositories/MestoRepository";
import { users } from "@prisma/client";

export const BCRYPT_ROUNDS = 10;

const LEGACY_MD5 = /^[0-9a-f]{32}$/;

@component
export class UserService {
    constructor(
        private userRepository: UserRepository,
        private mestoRepository: MestoRepository
    ) {}

    async getUserWithCities(userId: number) {
        const user = await this.userRepository.getById(userId);
        if (!user) {
            throw new Error("Uživatel nenalezen");
        }

        const cities = await this.mestoRepository.getByUserId(userId);

        return {
            ...user,
            cities
        };
    }

    async getUserByUsername(username: string) {
        return this.userRepository.getByJmeno(username);
    }

    hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, BCRYPT_ROUNDS);
    }

    /**
     * User::login. Účty z armygame.sql mají md5 — po úspěšném ověření se rovnou přehashují na bcrypt.
     */
    async login(jmeno: string, password: string): Promise<users | null> {
        const user = await this.userRepository.getByJmeno(jmeno);
        if (!user) return null;

        if (LEGACY_MD5.test(user.heslo)) {
            if (createHash("md5").update(password).digest("hex") !== user.heslo) return null;
            await this.userRepository.update(user.id, { heslo: await this.hashPassword(password) });
            return user;
        }

        return (await bcrypt.compare(password, user.heslo)) ? user : null;
    }
}
