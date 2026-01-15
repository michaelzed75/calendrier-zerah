-- Migration: Suppression du champ cabinet des temps_reels
-- Option 3 : Le cabinet se déduit du client, pas besoin de le stocker

-- ATTENTION: Exécuter ce script APRES avoir vérifié qu'il n'y a pas de doublons
-- Un doublon = même collaborateur_id + client_id + date avec des cabinets différents

-- 1. Vérifier les doublons potentiels AVANT migration
-- Si cette requête retourne des lignes, il faudra les fusionner manuellement
SELECT
  collaborateur_id,
  client_id,
  date,
  COUNT(*) as nb,
  SUM(heures) as total_heures,
  array_agg(cabinet) as cabinets,
  array_agg(heures) as heures_par_cabinet
FROM temps_reels
GROUP BY collaborateur_id, client_id, date
HAVING COUNT(*) > 1;

-- 2. Si pas de doublons, procéder à la migration:

-- 2a. Supprimer l'ancienne contrainte d'unicité (qui inclut cabinet)
ALTER TABLE temps_reels DROP CONSTRAINT IF EXISTS unique_temps_reel;

-- 2b. Supprimer la colonne cabinet
ALTER TABLE temps_reels DROP COLUMN IF EXISTS cabinet;

-- 2c. Créer la nouvelle contrainte d'unicité (sans cabinet)
ALTER TABLE temps_reels ADD CONSTRAINT unique_temps_reel UNIQUE(collaborateur_id, client_id, date);

-- 3. Optionnel: Nettoyer le journal_imports (garder cabinet pour historique mais pas obligatoire)
-- On garde la colonne cabinet dans journal_imports pour l'historique des anciens imports
-- ALTER TABLE journal_imports DROP COLUMN IF EXISTS cabinet;

-- 4. Vérification finale
SELECT COUNT(*) as total_temps_reels FROM temps_reels;
