-- Migration : Ajouter les colonnes manquantes à temps_reels
-- (code, facturable, produit, quantite_pl, statut_facturation)
-- À exécuter dans Supabase SQL Editor

ALTER TABLE temps_reels ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE temps_reels ADD COLUMN IF NOT EXISTS facturable TEXT;
ALTER TABLE temps_reels ADD COLUMN IF NOT EXISTS produit TEXT;
ALTER TABLE temps_reels ADD COLUMN IF NOT EXISTS quantite_pl DECIMAL(10,2);
ALTER TABLE temps_reels ADD COLUMN IF NOT EXISTS statut_facturation TEXT;

-- Index sur les colonnes de filtre les plus utilisées
CREATE INDEX IF NOT EXISTS idx_temps_reels_type_mission ON temps_reels(type_mission);
CREATE INDEX IF NOT EXISTS idx_temps_reels_code ON temps_reels(code);
CREATE INDEX IF NOT EXISTS idx_temps_reels_facturable ON temps_reels(facturable);
