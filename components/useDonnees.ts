import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { surChangement } from '../db';

/**
 * Charge des données asynchrones et les recharge quand l'écran reprend le focus
 * ou quand la base est modifiée (ajout de paiement, etc.).
 */
export function useDonnees<T>(chargeur: () => Promise<T>, deps: unknown[] = []): { data: T | undefined; erreur: Error | null; recharger: () => void } {
  const [data, setData] = useState<T>();
  const [erreur, setErreur] = useState<Error | null>(null);
  const actif = useRef(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const charger = useCallback(() => {
    chargeur().then(d => { if (actif.current) { setData(d); setErreur(null); } })
      .catch(e => { if (actif.current) setErreur(e instanceof Error ? e : new Error(String(e))); });
  }, deps);

  useEffect(() => {
    actif.current = true;
    const desabonner = surChangement(charger);
    return () => { actif.current = false; desabonner(); };
  }, [charger]);

  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  return { data, erreur, recharger: charger };
}
