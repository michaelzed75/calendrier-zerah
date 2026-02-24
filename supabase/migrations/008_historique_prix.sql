-- Migration: Table historique_prix pour tracking des variations de prix
-- Date: 2026-02-24
-- Description: Stocke l'historique des changements de prix détectés lors de chaque synchronisation Pennylane

CREATE TABLE IF NOT EXISTS historique_prix (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) NOT NULL,
  abonnement_id INTEGER REFERENCES abonnements(id),
  pennylane_line_id INTEGER,
  label TEXT NOT NULL,
  famille TEXT CHECK (famille IN ('comptabilite', 'social', 'juridique', 'support')),
  ancien_montant_ht DECIMAL(12,2),
  nouveau_montant_ht DECIMAL(12,2),
  ancienne_quantite DECIMAL(10,2),
  nouvelle_quantite DECIMAL(10,2),
  delta_ht DECIMAL(12,2),
  delta_pourcentage DECIMAL(8,2),
  date_detection TIMESTAMP DEFAULT NOW(),
  sync_cabinet TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_historique_prix_client ON historique_prix(client_id);
CREATE INDEX IF NOT EXISTS idx_historique_prix_abonnement ON historique_prix(abonnement_id);
CREATE INDEX IF NOT EXISTS idx_historique_prix_date ON historique_prix(date_detection DESC);
CREATE INDEX IF NOT EXISTS idx_historique_prix_cabinet ON historique_prix(sync_cabinet);

COMMENT ON TABLE historique_prix IS 'Historique des variations de prix détectées lors de la synchronisation Pennylane';
