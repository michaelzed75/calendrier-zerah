-- Migration: Migrer les clés API cabinet vers Supabase Vault
-- Date: 2026-04-27
--
-- Objectif :
-- Stocker les clés API cabinet (Audit Up + Zerah Fiduciaire) de manière chiffrée
-- via Vault, en parallèle de la colonne api_key existante (rétrocompat).
--
-- Étape suivante (séparée) : refactor de sync-pennylane.js + HonorairesPage
-- pour qu'ils lisent depuis Vault, puis cleanup (vidage de api_key).

-- ─────────────────────────────────────────────────────────────
-- 1) Ajouter le lien vers vault.secrets
-- ─────────────────────────────────────────────────────────────
ALTER TABLE pennylane_api_keys ADD COLUMN IF NOT EXISTS vault_secret_id UUID;

COMMENT ON COLUMN pennylane_api_keys.vault_secret_id IS
  'UUID du secret Vault — la clé API en clair est dans vault.decrypted_secrets';

-- ─────────────────────────────────────────────────────────────
-- 2) SET : crée ou met à jour la clé d'un cabinet dans Vault
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_pennylane_cabinet_key(
  p_cabinet TEXT,
  p_api_key TEXT,
  p_company_id TEXT DEFAULT NULL
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
  v_secret_name := 'pl_cabinet_' || regexp_replace(lower(p_cabinet), '\s+', '_', 'g');

  -- Vérifier si une entrée existe déjà
  SELECT vault_secret_id INTO v_existing_secret_id
  FROM pennylane_api_keys
  WHERE cabinet = p_cabinet;

  IF v_existing_secret_id IS NOT NULL THEN
    -- Mise à jour : update du secret existant
    UPDATE vault.secrets
    SET secret = p_api_key, updated_at = NOW()
    WHERE id = v_existing_secret_id;

    UPDATE pennylane_api_keys
    SET company_id = COALESCE(p_company_id, company_id),
        updated_at = NOW()
    WHERE cabinet = p_cabinet;

    RETURN v_existing_secret_id;
  ELSE
    -- Création : nouveau secret + upsert ligne
    v_new_secret_id := vault.create_secret(
      p_api_key,
      v_secret_name,
      'Clé API cabinet ' || p_cabinet
    );

    INSERT INTO pennylane_api_keys (cabinet, api_key, company_id, vault_secret_id)
    VALUES (p_cabinet, '', p_company_id, v_new_secret_id)
    ON CONFLICT (cabinet) DO UPDATE
    SET vault_secret_id = v_new_secret_id,
        company_id = COALESCE(p_company_id, pennylane_api_keys.company_id),
        updated_at = NOW();

    RETURN v_new_secret_id;
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 3) GET : retourne la clé déchiffrée d'un cabinet
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_pennylane_cabinet_key(p_cabinet TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_key TEXT;
BEGIN
  SELECT ds.decrypted_secret INTO v_key
  FROM pennylane_api_keys pk
  JOIN vault.decrypted_secrets ds ON ds.id = pk.vault_secret_id
  WHERE pk.cabinet = p_cabinet;
  RETURN v_key;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4) DELETE : supprime la clé d'un cabinet (vault + reset row)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION delete_pennylane_cabinet_key(p_cabinet TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_id UUID;
BEGIN
  SELECT vault_secret_id INTO v_secret_id
  FROM pennylane_api_keys
  WHERE cabinet = p_cabinet;

  IF v_secret_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE pennylane_api_keys
  SET vault_secret_id = NULL, api_key = '', updated_at = NOW()
  WHERE cabinet = p_cabinet;

  DELETE FROM vault.secrets WHERE id = v_secret_id;
  RETURN TRUE;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5) MIGRATION ONE-SHOT : importer les clés api_key existantes dans Vault
--    (uniquement les lignes qui n'ont pas encore de vault_secret_id)
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
  v_secret_name TEXT;
  v_new_secret_id UUID;
BEGIN
  FOR r IN
    SELECT id, cabinet, api_key, company_id
    FROM pennylane_api_keys
    WHERE vault_secret_id IS NULL
      AND api_key IS NOT NULL
      AND api_key != ''
  LOOP
    v_secret_name := 'pl_cabinet_' || regexp_replace(lower(r.cabinet), '\s+', '_', 'g');

    v_new_secret_id := vault.create_secret(
      r.api_key,
      v_secret_name,
      'Clé API cabinet ' || r.cabinet || ' (importée depuis api_key)'
    );

    UPDATE pennylane_api_keys
    SET vault_secret_id = v_new_secret_id, updated_at = NOW()
    WHERE id = r.id;

    RAISE NOTICE 'Migré : cabinet=% → vault_secret_id=%', r.cabinet, v_new_secret_id;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 6) Permissions : seul service_role peut appeler ces fonctions
-- ─────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION set_pennylane_cabinet_key(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION get_pennylane_cabinet_key(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION delete_pennylane_cabinet_key(TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION set_pennylane_cabinet_key(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_pennylane_cabinet_key(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION delete_pennylane_cabinet_key(TEXT) TO service_role;
