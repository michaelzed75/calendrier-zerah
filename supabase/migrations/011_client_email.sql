-- Migration: Ajout du champ email (contact Pennylane) sur la table clients
-- Date: 2026-02-24
-- L'email est extrait du premier élément de l'array emails[] du customer Pennylane

ALTER TABLE clients ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN clients.email IS 'Email de contact du client, synchronisé depuis Pennylane (premier email du customer)';
