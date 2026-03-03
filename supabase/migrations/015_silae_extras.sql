-- Migration 015 : Colonnes extras sur silae_productions
-- Support des produits "entree_sortie_extra" et "vacation_extra" dans la facturation variable

-- 1. Ajout des colonnes extras
ALTER TABLE silae_productions ADD COLUMN IF NOT EXISTS extras integer DEFAULT 0;
ALTER TABLE silae_productions ADD COLUMN IF NOT EXISTS vacation_extra integer DEFAULT 0;

COMMENT ON COLUMN silae_productions.extras IS 'Nombre d''entrées/sorties d''extras (CDD, intérimaires)';
COMMENT ON COLUMN silae_productions.vacation_extra IS 'Nombre de vacations d''extras';

-- 2. Mapper les produits PL aux colonnes Silae
UPDATE produits_pennylane
SET colonne_silae = 'extras'
WHERE label_normalise = 'entree_sortie_extra'
  AND colonne_silae IS NULL;

UPDATE produits_pennylane
SET colonne_silae = 'vacation_extra'
WHERE label_normalise = 'vacation_extra'
  AND colonne_silae IS NULL;
