-- Table pour stocker les temps réels importés depuis Pennylane
CREATE TABLE IF NOT EXISTS temps_reels (
  id SERIAL PRIMARY KEY,
  collaborateur_id INTEGER NOT NULL REFERENCES collaborateurs(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  date DATE NOT NULL,
  heures DECIMAL(10,2) NOT NULL DEFAULT 0,
  commentaire TEXT,
  activite TEXT,
  type_mission TEXT,
  millesime TEXT,
  cabinet TEXT CHECK(cabinet IN ('Zerah Fiduciaire', 'Audit Up')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Index pour les recherches fréquentes (maintenant par cabinet aussi)
  CONSTRAINT unique_temps_reel UNIQUE(collaborateur_id, client_id, date, cabinet)
);

-- Migration: Ajouter la colonne cabinet si elle n'existe pas
-- ALTER TABLE temps_reels ADD COLUMN IF NOT EXISTS cabinet TEXT CHECK(cabinet IN ('Zerah Fiduciaire', 'Audit Up'));
-- UPDATE temps_reels SET cabinet = 'Zerah Fiduciaire' WHERE cabinet IS NULL;

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_temps_reels_date ON temps_reels(date);
CREATE INDEX IF NOT EXISTS idx_temps_reels_collaborateur ON temps_reels(collaborateur_id);
CREATE INDEX IF NOT EXISTS idx_temps_reels_client ON temps_reels(client_id);

-- Table pour stocker les mappings Pennylane <-> Site
CREATE TABLE IF NOT EXISTS mappings_pennylane (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('collaborateur', 'client')),
  nom_pennylane TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Un seul mapping par nom Pennylane et type
  CONSTRAINT unique_mapping UNIQUE(type, nom_pennylane)
);

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_mappings_type ON mappings_pennylane(type);

-- Table pour le journal des modifications d'import
CREATE TABLE IF NOT EXISTS journal_imports (
  id SERIAL PRIMARY KEY,
  date_import TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  periode_debut DATE,
  periode_fin DATE,
  cabinet TEXT CHECK(cabinet IN ('Zerah Fiduciaire', 'Audit Up')),
  nb_ajouts INTEGER DEFAULT 0,
  nb_modifications INTEGER DEFAULT 0,
  nb_suppressions INTEGER DEFAULT 0,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migration: Ajouter la colonne cabinet à journal_imports si elle n'existe pas
-- ALTER TABLE journal_imports ADD COLUMN IF NOT EXISTS cabinet TEXT CHECK(cabinet IN ('Zerah Fiduciaire', 'Audit Up'));

-- Activer RLS (Row Level Security) si nécessaire
ALTER TABLE temps_reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE mappings_pennylane ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_imports ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre toutes les opérations (à ajuster selon vos besoins de sécurité)
CREATE POLICY "Allow all operations on temps_reels" ON temps_reels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on mappings_pennylane" ON mappings_pennylane FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on journal_imports" ON journal_imports FOR ALL USING (true) WITH CHECK (true);
