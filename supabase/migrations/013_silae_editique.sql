-- Migration 013: Ajout colonne editique dans silae_productions
-- Colonne L du fichier Silae "...dont éditique" (publi-postage)

ALTER TABLE silae_productions ADD COLUMN IF NOT EXISTS editique integer DEFAULT 0;

COMMENT ON COLUMN silae_productions.editique IS 'Nombre de bulletins envoyés par éditique/publi-postage (colonne L Silae)';
