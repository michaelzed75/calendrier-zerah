-- =============================================
-- MIGRATION : Chef de mission par client
-- À exécuter dans le SQL Editor de Supabase
-- =============================================

-- 1. Ajouter le champ chef_mission_id à la table clients
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS chef_mission_id INTEGER REFERENCES collaborateurs(id) ON DELETE SET NULL;

-- 2. Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_clients_chef_mission ON clients(chef_mission_id);

-- 3. Supprimer la table collaborateur_clients (plus utilisée)
DROP TABLE IF EXISTS collaborateur_clients;

-- 4. Vérification
SELECT 'Migration Chef Mission terminée avec succès!' AS status;
