-- Migration 006: Ajout type_personne (PP/PM) et siret_complement
-- PP = Personne Physique, PM = Personne Morale
-- Le SIREN est obligatoire pour les PM (contrôlé côté applicatif)
-- Le siret_complement (5 chiffres NIC) est toujours facultatif

ALTER TABLE clients ADD COLUMN IF NOT EXISTS type_personne TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS siret_complement TEXT;

-- Contrainte CHECK sur les valeurs autorisées
ALTER TABLE clients ADD CONSTRAINT chk_type_personne
  CHECK (type_personne IS NULL OR type_personne IN ('PM', 'PP'));

-- Contrainte : siret_complement doit être exactement 5 chiffres si renseigné
ALTER TABLE clients ADD CONSTRAINT chk_siret_complement
  CHECK (siret_complement IS NULL OR siret_complement ~ '^\d{5}$');

-- Contrainte : si PM, le SIREN doit être renseigné (9 chiffres)
-- NB: on ne bloque pas les anciens enregistrements, la contrainte est applicative
-- ALTER TABLE clients ADD CONSTRAINT chk_pm_siren
--   CHECK (type_personne != 'PM' OR (siren IS NOT NULL AND siren ~ '^\d{9}$'));

-- Index sur SIREN pour recherche rapide (clé universelle)
CREATE INDEX IF NOT EXISTS idx_clients_siren ON clients (siren) WHERE siren IS NOT NULL;

-- Commentaires
COMMENT ON COLUMN clients.type_personne IS 'PM = Personne Morale (SIREN obligatoire), PP = Personne Physique';
COMMENT ON COLUMN clients.siret_complement IS 'NIC : 5 chiffres complémentaires du SIRET (facultatif)';
COMMENT ON COLUMN clients.siren IS 'Numéro SIREN (9 chiffres). Clé universelle de matching Pennylane/Silae/ABMT';
