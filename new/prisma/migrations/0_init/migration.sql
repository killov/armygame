-- CreateTable
CREATE TABLE `akce` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user` INTEGER NULL,
    `mesto` INTEGER NULL,
    `cil` INTEGER NOT NULL,
    `budova` INTEGER NULL,
    `delka` INTEGER NULL,
    `cas` INTEGER NULL,
    `dokonceni` INTEGER NOT NULL,
    `typ` INTEGER NULL,
    `typ_jednotky` INTEGER NOT NULL,
    `obchodniku` INTEGER NULL,
    `surovina1` INTEGER NULL,
    `surovina2` INTEGER NULL,
    `surovina3` INTEGER NULL,
    `surovina4` INTEGER NULL,
    `j1` INTEGER NOT NULL,
    `j2` INTEGER NOT NULL,
    `j3` INTEGER NOT NULL,
    `j4` INTEGER NOT NULL,
    `j5` INTEGER NOT NULL,
    `j6` INTEGER NOT NULL,
    `j7` INTEGER NOT NULL,
    `j8` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cesta` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `start_x` INTEGER NOT NULL,
    `start_y` INTEGER NOT NULL,
    `target_x` INTEGER NOT NULL,
    `target_y` INTEGER NOT NULL,
    `cesta` TEXT NOT NULL,

    INDEX `start_x`(`start_x`),
    INDEX `start_y`(`start_y`),
    INDEX `target_x`(`target_x`),
    INDEX `target_y`(`target_y`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `u1` INTEGER NOT NULL,
    `u2` INTEGER NOT NULL,
    `time` INTEGER NOT NULL,
    `text` VARCHAR(1000) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mapa` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `x` INTEGER NOT NULL,
    `y` INTEGER NOT NULL,
    `blokx` INTEGER NOT NULL,
    `bloky` INTEGER NOT NULL,
    `typ` INTEGER NOT NULL,
    `hrana` INTEGER NOT NULL,
    `stat` INTEGER NOT NULL,
    `hranice` INTEGER NOT NULL,
    `dom` INTEGER NOT NULL,

    INDEX `blokx`(`blokx`),
    INDEX `bloky`(`bloky`),
    INDEX `typ`(`typ`),
    INDEX `x`(`x`),
    INDEX `y`(`y`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mapa_bloky` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `x` INTEGER NOT NULL,
    `y` INTEGER NOT NULL,
    `verze` INTEGER NOT NULL,

    INDEX `x`(`x`),
    INDEX `y`(`y`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mesto` (
    `id` INTEGER NOT NULL DEFAULT 0,
    `x` INTEGER NOT NULL,
    `y` INTEGER NOT NULL,
    `typ` INTEGER NOT NULL,
    `stat` INTEGER NOT NULL,
    `statjmeno` VARCHAR(20) NOT NULL,
    `user` INTEGER NOT NULL,
    `userjmeno` VARCHAR(20) NOT NULL,
    `jmeno` VARCHAR(20) NOT NULL,
    `surovina1` INTEGER NOT NULL,
    `surovina1_produkce` INTEGER NOT NULL,
    `surovina2` INTEGER NOT NULL,
    `surovina2_produkce` INTEGER NOT NULL,
    `surovina3` INTEGER NOT NULL,
    `surovina3_produkce` INTEGER NOT NULL,
    `surovina4` INTEGER NOT NULL,
    `surovina4_produkce` INTEGER NOT NULL,
    `suroviny_time` INTEGER NOT NULL,
    `sklad` INTEGER NOT NULL,
    `populace` INTEGER NOT NULL,
    `b1` INTEGER NOT NULL,
    `b2` INTEGER NOT NULL,
    `b3` INTEGER NOT NULL,
    `b4` INTEGER NOT NULL,
    `b5` INTEGER NOT NULL,
    `b6` INTEGER NOT NULL,
    `b7` INTEGER NOT NULL,
    `b8` INTEGER NOT NULL,
    `b9` INTEGER NOT NULL,
    `b10` INTEGER NOT NULL,
    `b11` INTEGER NOT NULL,
    `v1` INTEGER NOT NULL,
    `v2` INTEGER NOT NULL,
    `v3` INTEGER NOT NULL,
    `v4` INTEGER NOT NULL,
    `v5` INTEGER NOT NULL,
    `v6` INTEGER NOT NULL,
    `v7` INTEGER NOT NULL,
    `v8` INTEGER NOT NULL,
    `j1` INTEGER NOT NULL,
    `j2` INTEGER NOT NULL,
    `j3` INTEGER NOT NULL,
    `j4` INTEGER NOT NULL,
    `j5` INTEGER NOT NULL,
    `j6` INTEGER NOT NULL,
    `j7` INTEGER NOT NULL,
    `j8` INTEGER NOT NULL,
    `smrt` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `podpory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mesto` INTEGER NOT NULL,
    `kde` INTEGER NOT NULL,
    `j1` INTEGER NOT NULL,
    `j2` INTEGER NOT NULL,
    `j3` INTEGER NOT NULL,
    `j4` INTEGER NOT NULL,
    `j5` INTEGER NOT NULL,
    `j6` INTEGER NOT NULL,
    `j7` INTEGER NOT NULL,
    `j8` INTEGER NOT NULL,
    `surovina1` INTEGER NOT NULL,
    `surovina2` INTEGER NOT NULL,
    `surovina3` INTEGER NOT NULL,
    `surovina4` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pohyb` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `akce` INTEGER NOT NULL,
    `x` INTEGER NOT NULL,
    `y` INTEGER NOT NULL,
    `cas` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `jmeno` VARCHAR(20) NOT NULL,
    `clenu` INTEGER NOT NULL,
    `pop` INTEGER NOT NULL,
    `poradi` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stat_pozvanky` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stat` INTEGER NOT NULL,
    `statjmeno` VARCHAR(20) NOT NULL,
    `user` INTEGER NOT NULL,
    `userjmeno` VARCHAR(20) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tasks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pro` INTEGER NOT NULL,
    `typ` INTEGER NOT NULL,
    `x` INTEGER NOT NULL,
    `y` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `jmeno` VARCHAR(20) NOT NULL,
    `heslo` VARCHAR(32) NOT NULL,
    `email` VARCHAR(30) NOT NULL,
    `mesto` INTEGER NOT NULL,
    `pop` INTEGER NOT NULL,
    `mest` INTEGER NOT NULL,
    `poradi` INTEGER NOT NULL,
    `zprava` INTEGER NOT NULL,
    `stat` INTEGER NOT NULL,
    `statjmeno` VARCHAR(20) NOT NULL,
    `sp_all` INTEGER NOT NULL,
    `penize` INTEGER NOT NULL,
    `v1` INTEGER NOT NULL,
    `v2` INTEGER NOT NULL,
    `v3` INTEGER NOT NULL,
    `v4` INTEGER NOT NULL,
    `v5` INTEGER NOT NULL,
    `banka` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ws_auth` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user` INTEGER NOT NULL,
    `hash` VARCHAR(32) NOT NULL,
    `time` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

