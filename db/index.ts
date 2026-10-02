import { migrer } from './schema';
import { ouvrirBase, type BaseDonnees } from './moteur';

let instance: BaseDonnees | null = null;
let ouverture: Promise<BaseDonnees> | null = null;

/** Base unique de l'application (ouverte et migrée une seule fois). */
export function db(): Promise<BaseDonnees> {
  if (instance) return Promise.resolve(instance);
  if (!ouverture) {
    ouverture = (async () => {
      const d = await ouvrirBase('daret.db');
      await migrer(d);
      instance = d;
      return d;
    })();
  }
  return ouverture;
}

/* ---- Notification des écrans après une modification ---- */
type Ecouteur = () => void;
const ecouteurs = new Set<Ecouteur>();

export function surChangement(fn: Ecouteur): () => void {
  ecouteurs.add(fn);
  return () => ecouteurs.delete(fn);
}

export function signalerChangement(): void {
  ecouteurs.forEach(fn => fn());
}
