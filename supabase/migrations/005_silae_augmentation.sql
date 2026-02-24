-- Migration: Tables pour import Silae et outil d'augmentation des honoraires
-- Date: 2026-02-22

-- ============================================================================
-- 1. TABLE SILAE_MAPPING (lien code Silae <-> client local)
-- ============================================================================

CREATE TABLE IF NOT EXISTS silae_mapping (
  id SERIAL PRIMARY KEY,
  code_silae TEXT NOT NULL,
  nom_silae TEXT,
  siren TEXT,
  client_id INTEGER REFERENCES clients(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(code_silae, client_id)
);

CREATE INDEX IF NOT EXISTS idx_silae_mapping_code ON silae_mapping(code_silae);
CREATE INDEX IF NOT EXISTS idx_silae_mapping_client ON silae_mapping(client_id);

-- ============================================================================
-- 2. TABLE SILAE_PRODUCTIONS (données bulletins par client et période)
-- ============================================================================

CREATE TABLE IF NOT EXISTS silae_productions (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) NOT NULL,
  periode TEXT NOT NULL,
  bulletins INTEGER DEFAULT 0,
  bulletins_total INTEGER DEFAULT 0,
  coffre_fort INTEGER DEFAULT 0,
  entrees INTEGER DEFAULT 0,
  sorties INTEGER DEFAULT 0,
  declarations INTEGER DEFAULT 0,
  attestations_pe INTEGER DEFAULT 0,
  imported_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, periode)
);

CREATE INDEX IF NOT EXISTS idx_silae_productions_client ON silae_productions(client_id);
CREATE INDEX IF NOT EXISTS idx_silae_productions_periode ON silae_productions(periode);
