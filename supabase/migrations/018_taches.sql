-- Migration: Table taches pour la délégation de tâches entre collaborateurs
-- Date: 2026-06-23
-- Description: Tâches assignées par email (CC adresse dédiée) ou à la main.
--   - Le destinataire (collaborateur_id) planifie la tâche en posant une date de réalisation.
--   - L'échéance (date_echeance) est imposée par le demandeur via une date JJ/MM/AA dans l'objet.
--   - source='email' : créée via le webhook inbound Brevo (api/inbound-task.js).
--   - email_message_id UNIQUE : idempotence (Brevo peut renvoyer le webhook).

CREATE TABLE IF NOT EXISTS taches (
  id SERIAL PRIMARY KEY,
  collaborateur_id INTEGER REFERENCES collaborateurs(id) NOT NULL,
  client_id INTEGER REFERENCES clients(id),
  titre TEXT NOT NULL,
  detail TEXT,
  statut TEXT NOT NULL DEFAULT 'a_faire' CHECK (statut IN ('a_faire', 'planifiee', 'faite')),
  priorite TEXT NOT NULL DEFAULT 'normale' CHECK (priorite IN ('normale', 'urgente')),
  date_echeance DATE,
  date_realisation DATE,
  source TEXT NOT NULL DEFAULT 'manuel' CHECK (source IN ('email', 'manuel')),
  email_message_id TEXT UNIQUE,
  email_from TEXT,
  created_by INTEGER REFERENCES collaborateurs(id),
  date_faite TIMESTAMP,
  relance_non_planifiee_le DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_taches_collaborateur ON taches(collaborateur_id);
CREATE INDEX IF NOT EXISTS idx_taches_statut ON taches(statut);
CREATE INDEX IF NOT EXISTS idx_taches_echeance ON taches(date_echeance);
CREATE INDEX IF NOT EXISTS idx_taches_realisation ON taches(date_realisation);
CREATE INDEX IF NOT EXISTS idx_taches_created_by ON taches(created_by);

COMMENT ON TABLE taches IS 'Tâches déléguées entre collaborateurs (par email en CC ou manuellement)';
COMMENT ON COLUMN taches.date_echeance IS 'Deadline imposée par le demandeur (date JJ/MM/AA dans l''objet du mail)';
COMMENT ON COLUMN taches.date_realisation IS 'Date choisie par le destinataire pour réaliser la tâche (planification)';
COMMENT ON COLUMN taches.email_message_id IS 'Message-Id de l''email source (idempotence webhook Brevo)';
COMMENT ON COLUMN taches.relance_non_planifiee_le IS 'Dernier lundi où une relance "non planifiée" a été envoyée (relance hebdomadaire, évite les doublons dans la semaine)';
