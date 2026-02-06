-- Ajout du champ type pour distinguer les fournisseurs "au relevé" vs "ignorés"
-- Valeurs possibles : 'releve' (défaut), 'ignore'
ALTER TABLE fournisseurs_releve ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'releve';
