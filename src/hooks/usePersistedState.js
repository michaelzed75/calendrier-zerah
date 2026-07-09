// @ts-check
import { useState, useEffect } from 'react';

/**
 * Comme useState, mais la valeur est sauvegardée dans localStorage
 * et restaurée au prochain montage (survit au changement de page et au F5).
 *
 * Ne pas utiliser pour des valeurs non sérialisables en JSON (Date, Set, Map, fonctions).
 *
 * @template T
 * @param {string} key - Clé localStorage (unique dans toute l'app, ex: 'clients_filterCabinet')
 * @param {T} defaultValue - Valeur par défaut si rien n'est sauvegardé
 * @returns {[T, function(T|function(T):T):void]}
 */
export default function usePersistedState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved !== null ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // quota dépassé ou localStorage indisponible — on continue sans persister
    }
  }, [key, value]);

  return [value, setValue];
}
