-- Migration: Tables pour la gestion des honoraires et abonnements Pennylane
-- Date: 2026-01-23

-- ============================================================================
-- 1. MODIFICATION TABLE CLIENTS
-- ============================================================================

-- Ajout des colonnes pour lier aux données Pennylane et Silae
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pennylane_customer_id INTEGER;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS external_reference TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS code_silae TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS mode_facturation_social TEXT CHECK (mode_facturation_social IN ('forfait', 'reel'));

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_clients_pennylane_customer_id ON clients(pennylane_customer_id);
CREATE INDEX IF NOT EXISTS idx_clients_external_reference ON clients(external_reference);
CREATE INDEX IF NOT EXISTS idx_clients_code_silae ON clients(code_silae);

-- ============================================================================
-- 2. TABLE TYPES_MISSION (référentiel)
-- ============================================================================

CREATE TABLE IF NOT EXISTS types_mission (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  libelle TEXT NOT NULL,
  famille TEXT NOT NULL CHECK (famille IN ('comptabilite', 'social', 'juridique', 'support')),
  inclus_calcul_rentabilite BOOLEAN DEFAULT true,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Données initiales
INSERT INTO types_mission (code, libelle, famille, inclus_calcul_rentabilite) VALUES
  ('COMPTABILITE', 'Comptabilité', 'comptabilite', true),
  ('FISCAL', 'Fiscal', 'comptabilite', true),
  ('CAC', 'CAC', 'comptabilite', true),
  ('CONSEIL', 'Conseil', 'comptabilite', true),
  ('SUIVI_CLIENT', 'Suivi Client', 'comptabilite', true),
  ('SOCIAL', 'Social', 'social', true),
  ('JURIDIQUE', 'Juridique', 'juridique', false),
  ('ADMIN_CAB', 'Admin Cab', 'support', false),
  ('AUTRES', 'Autres', 'support', false)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 3. TABLE MAPPINGS_ACTIVITES (correspondance activités non reconnues)
-- ============================================================================

CREATE TABLE IF NOT EXISTS mappings_activites (
  id SERIAL PRIMARY KEY,
  activite_source TEXT UNIQUE NOT NULL,
  type_mission_id INTEGER REFERENCES types_mission(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mappings_activites_source ON mappings_activites(activite_source);

-- ============================================================================
-- 4. TABLE PRODUITS_FACTURATION (référentiel produits Pennylane)
-- ============================================================================

CREATE TABLE IF NOT EXISTS produits_facturation (
  id SERIAL PRIMARY KEY,
  label TEXT UNIQUE NOT NULL,
  famille TEXT NOT NULL CHECK (famille IN ('comptabilite', 'social', 'juridique', 'support')),
  inclus_calcul_temps BOOLEAN DEFAULT true,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Données initiales - Comptabilité
INSERT INTO produits_facturation (label, famille, inclus_calcul_temps) VALUES
  ('Mission comptable', 'comptabilite', true),
  ('Mission de surveillance', 'comptabilite', true),
  ('Etablissement du P&L', 'comptabilite', true),
  ('Etablissement du Bilan', 'comptabilite', true)
ON CONFLICT (label) DO NOTHING;

-- Données initiales - Social
INSERT INTO produits_facturation (label, famille, inclus_calcul_temps) VALUES
  ('Mission du social', 'social', true),
  ('Etablissement du bulletin de salaire', 'social', true),
  ('Enregistrement d''entrée de salariés', 'social', true),
  ('Enregistrement de sortie de salariés', 'social', true),
  ('Enregistrement d''entrée / sortie d''un extra', 'social', true),
  ('Modification de bulletin de salaires sur votre demande', 'social', true),
  ('Bulletins envoyés par publi-postage', 'social', true),
  ('Dépôt coffre-fort numérique', 'social', true)
ON CONFLICT (label) DO NOTHING;

-- Données initiales - Juridique
INSERT INTO produits_facturation (label, famille, inclus_calcul_temps) VALUES
  ('Etablissement du secrétariat juridique', 'juridique', false)
ON CONFLICT (label) DO NOTHING;

-- Données initiales - Support
INSERT INTO produits_facturation (label, famille, inclus_calcul_temps) VALUES
  ('Mise à disposition de logiciel', 'support', false),
  ('Facturation de coût de dossier', 'support', false),
  ('REFACTURATION', 'support', false)
ON CONFLICT (label) DO NOTHING;

-- ============================================================================
-- 5. TABLE ABONNEMENTS (subscriptions Pennylane)
-- ============================================================================

CREATE TABLE IF NOT EXISTS abonnements (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) NOT NULL,
  pennylane_subscription_id INTEGER UNIQUE NOT NULL,
  label TEXT,
  status TEXT CHECK (status IN ('in_progress', 'not_started', 'stopped', 'finished')),
  frequence TEXT CHECK (frequence IN ('monthly', 'yearly')),
  intervalle INTEGER DEFAULT 1,
  jour_facturation INTEGER,
  date_debut DATE,
  date_fin DATE,
  mode_finalisation TEXT,
  conditions_paiement TEXT,
  moyen_paiement TEXT,
  total_ttc DECIMAL(12,2),
  total_ht DECIMAL(12,2),
  total_tva DECIMAL(12,2),
  synced_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_abonnements_client ON abonnements(client_id);
CREATE INDEX IF NOT EXISTS idx_abonnements_status ON abonnements(status);
CREATE INDEX IF NOT EXISTS idx_abonnements_pennylane_id ON abonnements(pennylane_subscription_id);

-- ============================================================================
-- 6. TABLE ABONNEMENTS_LIGNES (détail des lignes de facturation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS abonnements_lignes (
  id SERIAL PRIMARY KEY,
  abonnement_id INTEGER REFERENCES abonnements(id) ON DELETE CASCADE NOT NULL,
  pennylane_line_id INTEGER,
  label TEXT NOT NULL,
  famille TEXT CHECK (famille IN ('comptabilite', 'social', 'juridique', 'support')),
  quantite DECIMAL(10,2) DEFAULT 1,
  montant_ttc DECIMAL(12,2),
  montant_ht DECIMAL(12,2),
  montant_tva DECIMAL(12,2),
  taux_tva TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_abonnements_lignes_abonnement ON abonnements_lignes(abonnement_id);
CREATE INDEX IF NOT EXISTS idx_abonnements_lignes_famille ON abonnements_lignes(famille);

-- ============================================================================
-- 7. TABLE EFFECTIFS_SILAE (import annuel Silae)
-- ============================================================================

CREATE TABLE IF NOT EXISTS effectifs_silae (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) NOT NULL,
  annee INTEGER NOT NULL,
  effectif_moyen DECIMAL(10,2),
  imported_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, annee)
);

CREATE INDEX IF NOT EXISTS idx_effectifs_silae_client ON effectifs_silae(client_id);
CREATE INDEX IF NOT EXISTS idx_effectifs_silae_annee ON effectifs_silae(annee);

-- ============================================================================
-- 8. TABLE HONORAIRES_HISTORIQUE (historique des modifications)
-- ============================================================================

CREATE TABLE IF NOT EXISTS honoraires_historique (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) NOT NULL,
  abonnement_id INTEGER REFERENCES abonnements(id),
  date_modification TIMESTAMP DEFAULT NOW(),
  type_modification TEXT CHECK (type_modification IN ('creation', 'augmentation', 'diminution', 'modification', 'arret')),
  ancien_total_ttc DECIMAL(12,2),
  nouveau_total_ttc DECIMAL(12,2),
  pourcentage_variation DECIMAL(5,2),
  motif TEXT,
  details JSONB,
  modifie_par INTEGER REFERENCES collaborateurs(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_honoraires_hist_client ON honoraires_historique(client_id);
CREATE INDEX IF NOT EXISTS idx_honoraires_hist_date ON honoraires_historique(date_modification DESC);
CREATE INDEX IF NOT EXISTS idx_honoraires_hist_type ON honoraires_historique(type_modification);

-- ============================================================================
-- 9. TABLE SETTINGS (configuration application)
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_settings (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by INTEGER REFERENCES collaborateurs(id)
);

-- Clés API Pennylane (à remplir via l'interface admin)
INSERT INTO app_settings (key, description) VALUES
  ('PENNYLANE_API_KEY_ZF', 'Clé API Pennylane v2 pour Zerah Fiduciaire'),
  ('PENNYLANE_API_KEY_AUP', 'Clé API Pennylane v2 pour Audit Up')
ON CONFLICT (key) DO NOTHING;
