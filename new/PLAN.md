# Plán vývoje: Přepis ArmyGame do Next.js

Tento dokument slouží ke sledování postupu migrace původní PHP aplikace do moderního stacku (Next.js App Router, TypeScript, Prisma, Ironbean, SCSS moduly). Místo REST API endpointů využíváme pro mutace Next.js Server Actions a pro načítání Server Components.

## Fáze 1: Autentizace a Session
- [ ] Přihlašovací a registrační obrazovka (Server Components).
- [ ] Autentizační logika přes Next.js Server Actions.
- [ ] Správa stavu přihlášení (JWT / zabezpečené httpOnly cookies).
- [ ] Zabezpečení rout (Next.js Middleware).

## Fáze 2: Core Architektura (Ironbean & Prisma)
- [x] Generování Prisma klienta ze stávající DB.
- [x] Nastavení Ironbean DI kontejneru (`src/di`).
- [x] Základní vrstva repozitářů (`UserRepository`, `MestoRepository`).
- [ ] Tvorba aplikačních služeb (`UserService`, `CityService`, `ArmyService`, `MapService`).

## Fáze 3: UI a Herní Layoutcal
- [x] Zprovoznění a konfigurace SCSS modulů.
- [ ] Hlavní herní layout (globální navigace, panel s přehledem surovin a populace).
- [ ] Typizované a znovupoužitelné UI komponenty (tlačítka, dialogy, tabulky).

## Fáze 4: Město a Budovy
- [ ] Obrazovka s přehledem města (Dashboard).
- [ ] Vykreslení úrovní budov a možností vylepšení.
- [ ] Logika produkce surovin a kapacity skladů (on-demand kalkulace).
- [ ] Server Actions pro zadávání staveb do fronty a jejich dokončování.

## Fáze 5: Mapa a WebGL rozhraní
- [ ] Přenos původních kódů ze složek `mapa` a `webgl` do klientských React komponent (Client Components).
- [ ] Získávání dat o mapě pomocí Server Actions.
- [ ] Interakce na mapě: posílání útoků, podpor a přesuny surovin.

## Fáze 6: Herní Loop a Události
- [ ] Zpracování časově závislotestujých událostí (pohyb jednotek, konec staveb).
- [ ] Vyhodnocování bitev a updaty databáze.
- [ ] Automatické přepočty (CRON joby nebo evaluace při přihlášení/akci hráče).
