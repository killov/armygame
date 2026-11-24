// Doháněcí zpracování při requestu hráče — stav je aktuální, i když worker zrovna neproběhl.
import { cache } from 'react';
import { DatabaseService } from '@/db/DatabaseService';
import { dohonStav } from '.';

/** cache() drží jeden průchod na render, ať layout a stránka nedohánějí každý zvlášť. */
export const dohonStavRequestu = cache(() => dohonStav(new DatabaseService().client));
