-- Migration: Table pour stocker les fournisseurs qui fonctionnent au relevé
-- Date: 2025-02-05

CREATE TABLE IF NOT EXISTS fournisseurs_releve (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) NOT NULL,
  supplier_id VARCHAR(50) NOT NULL,  -- ID Pennylane du fournisseur
  supplier_name VARCHAR(255),         -- Nom du fournisseur (pour affichage)
  created_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES collaborateurs(id),

  -- Un fournisseur ne peut être marqué qu'une fois par client
  UNIQUE(client_id, supplier_id)
);

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_fournisseurs_releve_client ON fournisseurs_releve(client_id);

-- Commentaire
COMMENT ON TABLE fournisseurs_releve IS 'Fournisseurs qui envoient des relevés mensuels (risque de double saisie)';
