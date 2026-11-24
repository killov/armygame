-- bcrypt hash má 60 znaků, md5 z armygame.sql se vejde taky (legacy login ho přehashuje).
ALTER TABLE `users` MODIFY `heslo` VARCHAR(60) NOT NULL;
