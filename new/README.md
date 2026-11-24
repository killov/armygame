# armygame – Next.js přepis

Next 16 (App Router) + Prisma 5 (MySQL 8) + Ironbean DI + SCSS moduly.

## Dev

```bash
npm install      # postinstall spustí prisma generate
npm run dev      # predev: založí .env z .env.example, prisma migrate deploy, prisma db seed
```

Výchozí `.env.example` míří na `mysql://root:armygame@db:3306/armygame` (sourozenecká služba `db`
ve WorkMux session). Jinou DB nastav v `.env` nebo proměnnou `DATABASE_URL`; `JWT_SECRET` je povinný.

Migrace `1_users_heslo_bcrypt` rozšiřuje `users.heslo` na 60 znaků kvůli bcryptu; staré md5 hesla z `armygame.sql` se přehashují při prvním přihlášení.

Seed (`prisma/seed.ts`, port `install.php`) vygeneruje mapu 400×400 a 40×40 bloků; naplněné tabulky přeskočí.

## Lokálně přes compose

```bash
docker compose up    # db (mysql:8.0) + app na http://localhost:3000
```

## Skripty

| skript | co dělá |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (herní data a texty proti `inc/data.php` / `lang/cz.php`, generátor mapy) |
| `npm run build` | produkční build |
| `npm run db:reset` | smaže DB, pustí migrace a seed |
