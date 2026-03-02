-- Migration 014 : Colonnes manuelles sur silae_productions
-- Permet la saisie de bulletins manuels (SAINT JAMES, RELAIS CHRISTINE),
-- bulletins refaits, temps passé et commentaires.

ALTER TABLE silae_productions ADD COLUMN IF NOT EXISTS bulletins_manuels integer DEFAULT 0;
ALTER TABLE silae_productions ADD COLUMN IF NOT EXISTS bulletins_refaits integer DEFAULT 0;
ALTER TABLE silae_productions ADD COLUMN IF NOT EXISTS temps_passe numeric DEFAULT 0;
ALTER TABLE silae_productions ADD COLUMN IF NOT EXISTS commentaires text DEFAULT '';

-- Lier le produit modification_bulletin à la colonne bulletins_refaits
-- pour que genererFacturationVariable() alimente automatiquement la quantité
UPDATE produits_pennylane SET colonne_silae = 'bulletins_refaits'
WHERE label_normalise = 'modification_bulletin';
