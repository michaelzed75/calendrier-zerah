-- Migration: Ajout de la colonne donnees_analysees pour stocker le résumé des tests
-- Date: 2025-02-05

-- Ajouter la colonne pour stocker les données analysées (résumé du test)
ALTER TABLE tests_comptables_executions
ADD COLUMN IF NOT EXISTS donnees_analysees JSONB;

-- Commentaire
COMMENT ON COLUMN tests_comptables_executions.donnees_analysees IS 'Résumé des données analysées (nb factures, nb fournisseurs, etc.)';
