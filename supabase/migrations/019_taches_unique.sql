-- Migration 019 : Corrige l'unicité de email_message_id sur taches
-- Un même email peut générer PLUSIEURS tâches (une par destinataire collaborateur,
-- assignation peer-to-peer). L'unicité doit donc être (email_message_id, collaborateur_id)
-- pour rester idempotent face aux renvois de webhook Brevo SANS bloquer le multi-destinataire.

ALTER TABLE taches DROP CONSTRAINT IF EXISTS taches_email_message_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_taches_message_collab
  ON taches(email_message_id, collaborateur_id)
  WHERE email_message_id IS NOT NULL;
