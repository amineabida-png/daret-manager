import * as SQLite from 'expo-sqlite';

/** Base SQLite native (Android / iOS). La version web est dans moteur.web.ts. */
export type BaseDonnees = SQLite.SQLiteDatabase;

export function ouvrirBase(nom: string): Promise<BaseDonnees> {
  return SQLite.openDatabaseAsync(nom);
}
