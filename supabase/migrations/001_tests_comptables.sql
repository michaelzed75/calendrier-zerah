-- Migration: Création des tables pour le module Tests Comptables
-- Date: 2025-01-19

-- 1. Ajouter le champ pennylane_client_api_key à la table clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pennylane_client_api_key TEXT;

-- 2. Table des définitions de tests disponibles
CREATE TABLE IF NOT EXISTS tests_comptables_definitions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  categorie VARCHAR(50),
  actif BOOLEAN DEFAULT true,
  ordre_affichage INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Données initiales des tests
INSERT INTO tests_comptables_definitions (code, nom, description, categorie, ordre_affichage) VALUES
('doublons_fournisseurs', 'Doublons fournisseurs', 'Détecte des comptes 401 similaires (ex: 401Forange vs 401005456 avec libellé Orange)', 'FEC', 1),
('double_saisie', 'Double saisie', 'Détecte les factures présentes dans le relevé bancaire ET saisies individuellement', 'rapprochement', 2)
ON CONFLICT (code) DO NOTHING;

-- 3. Table des exécutions de tests (historique)
CREATE TABLE IF NOT EXISTS tests_comptables_executions (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) NOT NULL,
  test_code VARCHAR(50) NOT NULL,
  collaborateur_id INTEGER REFERENCES collaborateurs(id) NOT NULL,
  millesime INTEGER NOT NULL,
  date_execution TIMESTAMP DEFAULT NOW(),
  statut VARCHAR(20) DEFAULT 'en_cours',
  duree_ms INTEGER,
  nombre_anomalies INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_tests_exec_client ON tests_comptables_executions(client_id);
CREATE INDEX IF NOT EXISTS idx_tests_exec_date ON tests_comptables_executions(date_execution DESC);
CREATE INDEX IF NOT EXISTS idx_tests_exec_collaborateur ON tests_comptables_executions(collaborateur_id);

-- 4. Table des résultats détaillés
CREATE TABLE IF NOT EXISTS tests_comptables_resultats (
  id SERIAL PRIMARY KEY,
  execution_id INTEGER REFERENCES tests_comptables_executions(id) ON DELETE CASCADE,
  type_anomalie VARCHAR(100),
  severite VARCHAR(20) DEFAULT 'warning',
  donnees JSONB NOT NULL,
  commentaire TEXT,
  traite BOOLEAN DEFAULT false,
  traite_par INTEGER REFERENCES collaborateurs(id),
  traite_le TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_tests_resultats_exec ON tests_comptables_resultats(execution_id);
CREATE INDEX IF NOT EXISTS idx_tests_resultats_severite ON tests_comptables_resultats(severite);

-- 5. Politiques RLS (Row Level Security) - optionnel si RLS activé
-- ALTER TABLE tests_comptables_definitions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tests_comptables_executions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tests_comptables_resultats ENABLE ROW LEVEL SECURITY;
