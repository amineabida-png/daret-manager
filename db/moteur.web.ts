/**
 * Base SQLite dans le navigateur : sql.js (SQLite compilé en WebAssembly),
 * sauvegardée automatiquement dans IndexedDB après chaque modification.
 * Expose le même sous-ensemble d'API qu'expo-sqlite (execAsync, runAsync, getAllAsync…).
 */
import type { SQLiteDatabase } from 'expo-sqlite';

export type BaseDonnees = SQLiteDatabase;

type Valeur = string | number | null | Uint8Array;
interface Instruction { bind(p: Valeur[]): void; step(): boolean; getAsObject(): Record<string, unknown>; free(): void }
interface BaseSqlJs {
  run(sql: string, p?: Valeur[]): void;
  exec(sql: string): { values: unknown[][] }[];
  prepare(sql: string): Instruction;
  getRowsModified(): number;
  export(): Uint8Array;
}
interface SqlJs { Database: new (donnees?: Uint8Array) => BaseSqlJs }
declare global { interface Window { initSqlJs?: (cfg: { locateFile: (f: string) => string }) => Promise<SqlJs> } }

const BASE_URL = `${process.env.EXPO_BASE_URL ?? ''}/`.replace(/\/+$/, '/');
const IDB = 'daret-manager';
const CLE = 'base';

function chargerScript(src: string): Promise<void> {
  return new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => ok();
    s.onerror = () => ko(new Error('Impossible de charger le moteur de base de données.'));
    document.head.appendChild(s);
  });
}

function idb(): Promise<IDBDatabase> {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(IDB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('fichiers');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

async function lireFichier(): Promise<Uint8Array | undefined> {
  try {
    const d = await idb();
    return await new Promise(ok => {
      const r = d.transaction('fichiers').objectStore('fichiers').get(CLE);
      r.onsuccess = () => ok(r.result as Uint8Array | undefined);
      r.onerror = () => ok(undefined);
    });
  } catch { return undefined; }
}

async function ecrireFichier(octets: Uint8Array): Promise<void> {
  const d = await idb();
  await new Promise<void>((ok, ko) => {
    const tx = d.transaction('fichiers', 'readwrite');
    tx.objectStore('fichiers').put(octets, CLE);
    tx.oncomplete = () => ok();
    tx.onerror = () => ko(tx.error);
  });
}

const parametres = (p: unknown[]): Valeur[] =>
  (p.length === 1 && Array.isArray(p[0]) ? (p[0] as unknown[]) : p).map(v => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : (v as Valeur)));

export async function ouvrirBase(_nom: string): Promise<BaseDonnees> {
  if (!window.initSqlJs) await chargerScript(`${BASE_URL}sql-wasm.js`);
  const SQL = await window.initSqlJs!({ locateFile: f => `${BASE_URL}${f}` });
  const base = new SQL.Database(await lireFichier());

  // Sauvegarde différée (regroupe les écritures) + sauvegarde immédiate quand l'onglet est masqué
  let minuterie: ReturnType<typeof setTimeout> | undefined;
  let enTransaction = false;
  const sauver = () => { clearTimeout(minuterie); ecrireFichier(base.export()).catch(() => {}); };
  const planifier = () => { if (enTransaction) return; clearTimeout(minuterie); minuterie = setTimeout(sauver, 250); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') sauver(); });
  window.addEventListener('pagehide', sauver);

  const tout = <T,>(sql: string, p: unknown[]): T[] => {
    const st = base.prepare(sql);
    try {
      st.bind(parametres(p));
      const lignes: T[] = [];
      while (st.step()) lignes.push(st.getAsObject() as T);
      return lignes;
    } finally { st.free(); }
  };

  const api = {
    async execAsync(sql: string) { base.exec(sql); planifier(); },
    async runAsync(sql: string, ...p: unknown[]) {
      base.run(sql, parametres(p));
      const changes = base.getRowsModified();
      const id = Number(base.exec('SELECT last_insert_rowid()')[0]?.values[0][0] ?? 0);
      planifier();
      return { lastInsertRowId: id, changes };
    },
    async getAllAsync<T>(sql: string, ...p: unknown[]) { return tout<T>(sql, p); },
    async getFirstAsync<T>(sql: string, ...p: unknown[]) { return tout<T>(sql, p)[0] ?? null; },
    async withTransactionAsync(fn: () => Promise<void>) {
      base.exec('BEGIN');
      enTransaction = true;
      try { await fn(); base.exec('COMMIT'); } catch (e) { base.exec('ROLLBACK'); throw e; } finally { enTransaction = false; planifier(); }
    },
  };
  return api as unknown as BaseDonnees;
}
