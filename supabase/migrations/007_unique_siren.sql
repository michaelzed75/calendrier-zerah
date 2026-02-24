-- =============================================
-- MIGRATION 007 : Contrainte UNIQUE sur SIREN
-- Empêche la création de doublons SIREN
-- À exécuter dans le SQL Editor de Supabase
-- =============================================

-- Contrainte : un seul client actif par SIREN + NIC
-- Permet les cas légitimes comme RELAIS CHRISTINE / SAINT JAMES
-- (même SIREN 387571789 mais NIC différents : 00016 vs 00024)
-- COALESCE(siret_complement, '') traite les NIC NULL comme identiques
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_unique_siren_nic
ON clients(siren, COALESCE(siret_complement, ''))
WHERE siren IS NOT NULL AND actif = true;
