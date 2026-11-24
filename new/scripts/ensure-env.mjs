// predev: dev proti DB bez ručních kroků — chybějící .env se založí z .env.example.
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = join(root, '.env');

if (!existsSync(env)) {
  copyFileSync(join(root, '.env.example'), env);
  console.info('.env založen z .env.example');
}
