import { component } from "ironbean";
import { createHash } from "crypto";
import { UserRepository } from "../repositories/UserRepository";
import { MestoRepository } from "../repositories/MestoRepository";
import { users } from "@prisma/client";

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

    verifyPassword(user: users, password: string): boolean {
        const hashed = createHash('md5').update(password).digest('hex');
        return user.heslo === hashed;
    }
}
