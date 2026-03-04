import { component } from "ironbean";
import { UserRepository } from "../repositories/UserRepository";
import { MestoRepository } from "../repositories/MestoRepository";

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
}
