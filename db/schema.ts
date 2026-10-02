import type { SQLiteDatabase } from 'expo-sqlite';

/** Migrations successives ; l'indice + 1 correspond à la version du schéma. */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS darets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    montant_part INTEGER NOT NULL CHECK (montant_part > 0),
    frequence TEXT NOT NULL CHECK (frequence IN ('hebdomadaire','bimensuelle','mensuelle')),
    date_debut TEXT NOT NULL,
    jour_echeance INTEGER NOT NULL CHECK (jour_echeance BETWEEN 1 AND 31),
    mode_ordre TEXT CHECK (mode_ordre IN ('manuel','tirage','inscription')),
    statut TEXT NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours','terminee','archivee')),
    notes TEXT,
    cree_le TEXT NOT NULL DEFAULT (datetime('now')),
    modifie_le TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS membres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    daret_id INTEGER NOT NULL REFERENCES darets(id) ON DELETE CASCADE,
    nom TEXT NOT NULL,
    telephone TEXT,
    nb_parts INTEGER NOT NULL DEFAULT 1 CHECK (nb_parts >= 1),
    rang_inscription INTEGER NOT NULL,
    notes TEXT,
    cree_le TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_membres_daret ON membres(daret_id);
  CREATE TABLE IF NOT EXISTS tours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    daret_id INTEGER NOT NULL REFERENCES darets(id) ON DELETE CASCADE,
    numero INTEGER NOT NULL,
    beneficiaire_id INTEGER NOT NULL REFERENCES membres(id) ON DELETE CASCADE,
    date_echeance TEXT NOT NULL,
    remis_le TEXT,
    UNIQUE (daret_id, numero)
  );
  CREATE INDEX IF NOT EXISTS idx_tours_daret ON tours(daret_id);
  CREATE TABLE IF NOT EXISTS paiements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tour_id INTEGER NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
    membre_id INTEGER NOT NULL REFERENCES membres(id) ON DELETE CASCADE,
    montant INTEGER NOT NULL CHECK (montant > 0),
    date_paiement TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('especes','virement','autre')),
    cree_le TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_paiements_tour ON paiements(tour_id);
  CREATE INDEX IF NOT EXISTS idx_paiements_membre ON paiements(membre_id);
  CREATE TABLE IF NOT EXISTS rappels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tour_id INTEGER NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('avant','jour_j')),
    notification_id TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS parametres (
    cle TEXT PRIMARY KEY,
    valeur TEXT NOT NULL
  );
  `,
];

export async function migrer(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const { user_version: version } = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version')) ?? { user_version: 0 };
  for (let v = version; v < MIGRATIONS.length; v++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[v]);
    });
    await db.execAsync(`PRAGMA user_version = ${v + 1}`);
  }
}

export const VERSION_SCHEMA = MIGRATIONS.length;
