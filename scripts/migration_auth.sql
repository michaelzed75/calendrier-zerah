-- =============================================
-- MIGRATION : Authentification et Préférences Utilisateur
-- À exécuter dans le SQL Editor de Supabase
-- =============================================

-- 1. Ajouter le champ email et is_admin à la table collaborateurs
ALTER TABLE collaborateurs
ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 2. Définir Michaël Z comme admin
UPDATE collaborateurs SET is_admin = true WHERE id = 1;

-- 3. Créer la table des préférences utilisateur
CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collaborateur_id INTEGER REFERENCES collaborateurs(id) ON DELETE SET NULL,
  selected_collaborateurs JSONB DEFAULT '[]',
  view_mode TEXT DEFAULT 'month',
  selected_day TEXT,
  expanded_equipes JSONB DEFAULT '{}',
  background_theme JSONB DEFAULT '{"type": "gradient", "value": "default"}',
  accent_color TEXT DEFAULT 'purple',
  current_user_collab INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 4. Activer RLS sur la table user_preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- 5. Politique : un utilisateur ne peut voir/modifier que ses propres préférences
CREATE POLICY "Users can view own preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- 6. Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 7. Trigger pour updated_at
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 8. Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_collaborateurs_email ON collaborateurs(email);

-- 9. Vérification
SELECT 'Migration Auth terminée avec succès!' AS status;
