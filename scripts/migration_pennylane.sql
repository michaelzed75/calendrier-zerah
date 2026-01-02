-- =============================================
-- MIGRATION : Intégration Pennylane
-- À exécuter dans le SQL Editor de Supabase
-- =============================================

-- 1. Ajouter les colonnes Pennylane à la table clients
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS pennylane_id INTEGER,
ADD COLUMN IF NOT EXISTS cabinet TEXT,
ADD COLUMN IF NOT EXISTS siren TEXT,
ADD COLUMN IF NOT EXISTS adresse TEXT,
ADD COLUMN IF NOT EXISTS ville TEXT,
ADD COLUMN IF NOT EXISTS code_postal TEXT;

-- 2. Créer un index unique sur pennylane_id + cabinet pour éviter les doublons
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_pennylane
ON clients(pennylane_id, cabinet)
WHERE pennylane_id IS NOT NULL;

-- 3. Créer la table de liaison collaborateur <-> client
CREATE TABLE IF NOT EXISTS collaborateur_clients (
  id SERIAL PRIMARY KEY,
  collaborateur_id INTEGER NOT NULL REFERENCES collaborateurs(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'membre', -- 'responsable' ou 'membre'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(collaborateur_id, client_id)
);

-- 4. Activer RLS sur la nouvelle table
ALTER TABLE collaborateur_clients ENABLE ROW LEVEL SECURITY;

-- 5. Politique pour permettre l'accès
CREATE POLICY "Allow all for collaborateur_clients" ON collaborateur_clients
  FOR ALL USING (true) WITH CHECK (true);

-- 6. Vérification
SELECT 'Migration terminée avec succès!' AS status;
