-- Migration: Ajouter la colonne 'cabinet' aux tables temps_reels et journal_imports
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Ajouter la colonne cabinet à temps_reels
ALTER TABLE temps_reels ADD COLUMN IF NOT EXISTS cabinet TEXT CHECK(cabinet IN ('Zerah Fiduciaire', 'Audit Up'));

-- 2. Mettre à jour les données existantes (optionnel - à adapter selon vos données)
-- Par défaut, on peut les assigner à 'Zerah Fiduciaire' ou laisser NULL
-- UPDATE temps_reels SET cabinet = 'Zerah Fiduciaire' WHERE cabinet IS NULL;

-- 3. Ajouter la colonne cabinet à journal_imports
ALTER TABLE journal_imports ADD COLUMN IF NOT EXISTS cabinet TEXT CHECK(cabinet IN ('Zerah Fiduciaire', 'Audit Up'));

-- 4. Créer un index sur la colonne cabinet pour de meilleures performances
CREATE INDEX IF NOT EXISTS idx_temps_reels_cabinet ON temps_reels(cabinet);

-- 5. Modifier la contrainte d'unicité pour inclure le cabinet (optionnel)
-- ATTENTION: Cette opération va supprimer l'ancienne contrainte et en créer une nouvelle
-- Décommentez si vous souhaitez que la même combinaison collaborateur/client/date
-- puisse exister pour les deux cabinets séparément

-- DROP CONSTRAINT IF EXISTS unique_temps_reel;
-- ALTER TABLE temps_reels ADD CONSTRAINT unique_temps_reel UNIQUE(collaborateur_id, client_id, date, cabinet);
