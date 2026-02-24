-- Migration: Table pennylane_api_keys pour stocker les clés API par cabinet
-- Date: 2026-02-24

CREATE TABLE IF NOT EXISTS pennylane_api_keys (
  id SERIAL PRIMARY KEY,
  cabinet TEXT UNIQUE NOT NULL,
  api_key TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE pennylane_api_keys IS 'Clés API Pennylane v2 par cabinet (billing subscriptions)';
