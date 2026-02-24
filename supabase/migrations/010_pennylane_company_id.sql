-- Migration: Ajout du company_id dans pennylane_api_keys
-- Date: 2026-02-24
-- L'API Pennylane v2 exige le header X-Company-Id pour identifier la société

ALTER TABLE pennylane_api_keys ADD COLUMN IF NOT EXISTS company_id TEXT;

COMMENT ON COLUMN pennylane_api_keys.company_id IS 'Identifiant de la société Pennylane (requis en header X-Company-Id)';
