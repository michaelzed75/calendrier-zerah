-- ===========================================
-- TABLES SALAIRES COLLABORATEURS
-- Cabinet Audit Up / Zerah Fiduciaire
-- ===========================================
-- IMPORTANT: Exécuter ce script dans Supabase SQL Editor
-- Ces tables sont protégées par RLS - SEULS les admins peuvent y accéder

-- ===========================================
-- TABLE PRINCIPALE : SALAIRES COLLABORATEURS
-- ===========================================
-- Stocke le salaire de base annuel et son évolution dans le temps
CREATE TABLE IF NOT EXISTS salaires_collaborateurs (
  id SERIAL PRIMARY KEY,
  collaborateur_id INTEGER NOT NULL REFERENCES collaborateurs(id) ON DELETE CASCADE,

  -- Période
  annee INTEGER NOT NULL,
  date_effet DATE NOT NULL,  -- Date d'effet du salaire (pour historique évolution)

  -- Montants annuels
  salaire_brut_annuel DECIMAL(12,2) NOT NULL,
  charges_patronales_annuel DECIMAL(12,2) DEFAULT 0,

  -- Heures annuelles pour calcul taux horaire (défaut: 1607h légal)
  heures_annuelles INTEGER DEFAULT 1607,

  -- Métadonnées
  motif_modification TEXT,  -- "Embauche", "Augmentation annuelle", "Promotion", etc.
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by INTEGER REFERENCES collaborateurs(id),

  -- Contrainte unicité : un seul salaire par collaborateur/date_effet
  UNIQUE(collaborateur_id, date_effet)
);

-- ===========================================
-- TABLE : PRIMES ET EXCEPTIONNELS
-- ===========================================
CREATE TABLE IF NOT EXISTS salaires_primes (
  id SERIAL PRIMARY KEY,
  collaborateur_id INTEGER NOT NULL REFERENCES collaborateurs(id) ON DELETE CASCADE,

  -- Période
  annee INTEGER NOT NULL,
  mois INTEGER CHECK (mois IS NULL OR mois BETWEEN 1 AND 12),  -- NULL = prime annuelle
  date_versement DATE,

  -- Montant
  type_prime TEXT NOT NULL CHECK (type_prime IN (
    'prime_exceptionnelle',
    'prime_objectifs',
    '13eme_mois',
    'participation',
    'interessement',
    'prime_anciennete',
    'prime_vacances',
    'autre'
  )),
  libelle TEXT NOT NULL,     -- Description libre
  montant_brut DECIMAL(10,2) NOT NULL,
  charges_patronales DECIMAL(10,2) DEFAULT 0,

  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by INTEGER REFERENCES collaborateurs(id)
);

-- ===========================================
-- TABLE : SIMULATIONS AUGMENTATIONS
-- ===========================================
-- Pour planifier et évaluer le coût des augmentations futures
CREATE TABLE IF NOT EXISTS salaires_simulations (
  id SERIAL PRIMARY KEY,
  nom_simulation TEXT NOT NULL,  -- "Budget 2026", "Scénario augmentation 3%"

  -- Période cible
  annee_cible INTEGER NOT NULL,
  date_effet_prevue DATE,

  -- Statut
  statut TEXT DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'valide', 'applique')),

  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by INTEGER REFERENCES collaborateurs(id),
  validated_at TIMESTAMP WITH TIME ZONE,
  validated_by INTEGER REFERENCES collaborateurs(id)
);

-- ===========================================
-- TABLE : LIGNES DE SIMULATION
-- ===========================================
CREATE TABLE IF NOT EXISTS salaires_simulations_lignes (
  id SERIAL PRIMARY KEY,
  simulation_id INTEGER NOT NULL REFERENCES salaires_simulations(id) ON DELETE CASCADE,
  collaborateur_id INTEGER NOT NULL REFERENCES collaborateurs(id),

  -- Salaire actuel (snapshot au moment de la simulation)
  salaire_actuel_brut DECIMAL(12,2),
  charges_actuelles DECIMAL(12,2),

  -- Augmentation prévue
  type_augmentation TEXT DEFAULT 'montant' CHECK (type_augmentation IN ('montant', 'pourcentage')),
  valeur_augmentation DECIMAL(10,2),  -- Montant en € ou %

  -- Nouveau salaire calculé
  nouveau_salaire_brut DECIMAL(12,2),
  nouvelles_charges DECIMAL(12,2),

  notes TEXT,

  UNIQUE(simulation_id, collaborateur_id)
);

-- ===========================================
-- ROW LEVEL SECURITY (RLS) - PROTECTION CRITIQUE
-- ===========================================
-- Ces politiques garantissent que SEULS les admins peuvent accéder aux données
-- Même en manipulant le frontend, un non-admin ne peut pas lire les salaires

-- Activer RLS sur toutes les tables sensibles
ALTER TABLE salaires_collaborateurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE salaires_primes ENABLE ROW LEVEL SECURITY;
ALTER TABLE salaires_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE salaires_simulations_lignes ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "admin_full_access_salaires" ON salaires_collaborateurs;
DROP POLICY IF EXISTS "admin_full_access_primes" ON salaires_primes;
DROP POLICY IF EXISTS "admin_full_access_simulations" ON salaires_simulations;
DROP POLICY IF EXISTS "admin_full_access_simulations_lignes" ON salaires_simulations_lignes;

-- Fonction helper pour vérifier si l'utilisateur est admin
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM collaborateurs
    WHERE email = auth.jwt() ->> 'email'
    AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Politique : SEULS les admins peuvent tout faire sur salaires_collaborateurs
CREATE POLICY "admin_full_access_salaires" ON salaires_collaborateurs
  FOR ALL
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

-- Politique : SEULS les admins peuvent tout faire sur salaires_primes
CREATE POLICY "admin_full_access_primes" ON salaires_primes
  FOR ALL
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

-- Politique : SEULS les admins peuvent tout faire sur salaires_simulations
CREATE POLICY "admin_full_access_simulations" ON salaires_simulations
  FOR ALL
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

-- Politique : SEULS les admins peuvent tout faire sur salaires_simulations_lignes
CREATE POLICY "admin_full_access_simulations_lignes" ON salaires_simulations_lignes
  FOR ALL
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

-- ===========================================
-- INDEX POUR PERFORMANCES
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_salaires_collaborateur ON salaires_collaborateurs(collaborateur_id);
CREATE INDEX IF NOT EXISTS idx_salaires_annee ON salaires_collaborateurs(annee);
CREATE INDEX IF NOT EXISTS idx_salaires_date_effet ON salaires_collaborateurs(date_effet DESC);
CREATE INDEX IF NOT EXISTS idx_primes_collaborateur ON salaires_primes(collaborateur_id);
CREATE INDEX IF NOT EXISTS idx_primes_annee ON salaires_primes(annee);
CREATE INDEX IF NOT EXISTS idx_simulations_statut ON salaires_simulations(statut);
CREATE INDEX IF NOT EXISTS idx_simulations_lignes_simulation ON salaires_simulations_lignes(simulation_id);

-- ===========================================
-- TRIGGER : MISE À JOUR AUTOMATIQUE updated_at
-- ===========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_salaires_collaborateurs_updated_at ON salaires_collaborateurs;
CREATE TRIGGER update_salaires_collaborateurs_updated_at
  BEFORE UPDATE ON salaires_collaborateurs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_salaires_primes_updated_at ON salaires_primes;
CREATE TRIGGER update_salaires_primes_updated_at
  BEFORE UPDATE ON salaires_primes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_salaires_simulations_updated_at ON salaires_simulations;
CREATE TRIGGER update_salaires_simulations_updated_at
  BEFORE UPDATE ON salaires_simulations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- COMMENTAIRES TABLES (documentation)
-- ===========================================
COMMENT ON TABLE salaires_collaborateurs IS 'Historique des salaires - ACCES ADMIN UNIQUEMENT via RLS';
COMMENT ON TABLE salaires_primes IS 'Primes et éléments exceptionnels - ACCES ADMIN UNIQUEMENT via RLS';
COMMENT ON TABLE salaires_simulations IS 'Simulations budgétaires augmentations - ACCES ADMIN UNIQUEMENT via RLS';
COMMENT ON TABLE salaires_simulations_lignes IS 'Détail des simulations par collaborateur - ACCES ADMIN UNIQUEMENT via RLS';
COMMENT ON FUNCTION is_current_user_admin() IS 'Vérifie si l utilisateur connecté est admin - utilisé par RLS';
