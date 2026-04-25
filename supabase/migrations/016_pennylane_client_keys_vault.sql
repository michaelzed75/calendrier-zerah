-- Migration: Stockage sécurisé des clés API Pennylane par client (read + write)
-- Date: 2026-04-25
--
-- Objectif :
-- Stocker 2 clés Pennylane par client (lecture seule + lecture/écriture)
-- de manière chiffrée via Supabase Vault, avec accès limité au service_role.
--
-- Architecture :
--   pennylane_client_keys (mapping)  →  vault.secrets (chiffré)
--                                       ↓
--                                       vault.decrypted_secrets (vue déchiffrée)
--
-- Sécurité :
-- - RLS active, aucune policy = aucune lecture côté frontend
-- - Fonctions SECURITY DEFINER avec EXECUTE révoqué pour anon/authenticated
-- - Seuls les endpoints serverless (service_role) peuvent lire/écrire les clés

-- ─────────────────────────────────────────────────────────────
-- Table de mapping
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pennylane_client_keys (
  id SERIAL PRIMARY KEY,
  client_id INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('read', 'write')),
  vault_secret_id UUID NOT NULL,
  pennylane_key_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (client_id, scope)
);

COMMENT ON TABLE pennylane_client_keys IS
  'Mapping clients → secrets Vault contenant les clés API Pennylane (read/write)';
COMMENT ON COLUMN pennylane_client_keys.scope IS
  'read = lecture seule, write = lecture + écriture';
COMMENT ON COLUMN pennylane_client_keys.vault_secret_id IS
  'UUID du secret dans vault.secrets — la clé API en clair est dans vault.decrypted_secrets';

ALTER TABLE pennylane_client_keys ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 1) SET : crée ou met à jour une clé pour un client + scope
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_pennylane_client_key(
  p_client_id INT,
  p_scope TEXT,
  p_api_key TEXT,
  p_label TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_existing_secret_id UUID;
  v_new_secret_id UUID;
  v_secret_name TEXT;
BEGIN
  IF p_scope NOT IN ('read', 'write') THEN
    RAISE EXCEPTION 'scope doit être "read" ou "write"';
  END IF;

  SELECT vault_secret_id INTO v_existing_secret_id
  FROM pennylane_client_keys
  WHERE client_id = p_client_id AND scope = p_scope;

  v_secret_name := 'pl_client_' || p_client_id || '_' || p_scope;

  IF v_existing_secret_id IS NOT NULL THEN
    UPDATE vault.secrets
    SET secret = p_api_key, updated_at = NOW()
    WHERE id = v_existing_secret_id;

    UPDATE pennylane_client_keys
    SET pennylane_key_label = COALESCE(p_label, pennylane_key_label),
        updated_at = NOW()
    WHERE client_id = p_client_id AND scope = p_scope;

    RETURN v_existing_secret_id;
  ELSE
    v_new_secret_id := vault.create_secret(
      p_api_key,
      v_secret_name,
      'Clé Pennylane ' || p_scope || ' du client ' || p_client_id
    );

    INSERT INTO pennylane_client_keys (client_id, scope, vault_secret_id, pennylane_key_label)
    VALUES (p_client_id, p_scope, v_new_secret_id, p_label);

    RETURN v_new_secret_id;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2) GET : retourne la clé déchiffrée
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_pennylane_client_key(
  p_client_id INT,
  p_scope TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF p_scope NOT IN ('read', 'write') THEN
    RAISE EXCEPTION 'scope doit être "read" ou "write"';
  END IF;

  SELECT ds.decrypted_secret INTO v_key
  FROM pennylane_client_keys pck
  JOIN vault.decrypted_secrets ds ON ds.id = pck.vault_secret_id
  WHERE pck.client_id = p_client_id AND pck.scope = p_scope;

  RETURN v_key;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3) DELETE : supprime la clé (vault + mapping)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION delete_pennylane_client_key(
  p_client_id INT,
  p_scope TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id UUID;
BEGIN
  SELECT vault_secret_id INTO v_secret_id
  FROM pennylane_client_keys
  WHERE client_id = p_client_id AND scope = p_scope;

  IF v_secret_id IS NULL THEN
    RETURN FALSE;
  END IF;

  DELETE FROM pennylane_client_keys
  WHERE client_id = p_client_id AND scope = p_scope;

  DELETE FROM vault.secrets WHERE id = v_secret_id;

  RETURN TRUE;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Permissions : seul service_role (serverless) peut appeler ces fonctions
-- ─────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION set_pennylane_client_key(INT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION get_pennylane_client_key(INT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION delete_pennylane_client_key(INT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION set_pennylane_client_key(INT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_pennylane_client_key(INT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION delete_pennylane_client_key(INT, TEXT) TO service_role;
