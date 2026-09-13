-- Migration: Lecture des clés API cabinet par un ADMINISTRATEUR AUTHENTIFIÉ
-- Date: 2026-09-13
-- Description: Le serveur MCP « Pennylane Cabinet — Honoraires » lit les clés
--   cabinet (Zerah Fiduciaire, Audit Up) depuis le Vault du site calendrier.
--   Il ne doit PAS passer par la clé service_role : cette clé est distribuée sur
--   tous les postes qui utilisent l'extension de lettrage, et quiconque la détient
--   peut déjà appeler get_pennylane_cabinet_key. Ici, l'appelant se connecte avec
--   SON compte du site (email + mot de passe → JWT « authenticated »), et la
--   fonction vérifie que ce compte est un collaborateur is_admin. Aujourd'hui,
--   un seul collaborateur est admin (id 1).
--
--   Les fonctions existantes (017) ne sont pas modifiées : le proxy Vercel et la
--   synchro continuent d'utiliser get_pennylane_cabinet_key sous service_role.
--
-- À exécuter dans le SQL Editor de Supabase.

-- ─────────────────────────────────────────────────────────────
-- 1) Garde : l'appelant est-il un collaborateur admin authentifié ?
--    L'email est lu dans le JWT Supabase (claim `email`), jamais passé en paramètre.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION est_admin_authentifie()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM collaborateurs c
    WHERE c.is_admin = true
      AND c.email IS NOT NULL
      AND lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

REVOKE EXECUTE ON FUNCTION est_admin_authentifie() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION est_admin_authentifie() TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- 2) LISTE : cabinets connus, sans aucun secret (pour choisir un dossier)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION list_pennylane_cabinets_admin()
RETURNS TABLE (
  cabinet TEXT,
  company_id TEXT,
  cle_configuree BOOLEAN,
  updated_at TIMESTAMP
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT est_admin_authentifie() THEN
    RAISE EXCEPTION 'acces_reserve_admin' USING ERRCODE = '42501',
      HINT = 'Seul un collaborateur administrateur connecté peut lister les clés cabinet.';
  END IF;

  RETURN QUERY
    SELECT pk.cabinet, pk.company_id, (pk.vault_secret_id IS NOT NULL), pk.updated_at
    FROM pennylane_api_keys pk
    ORDER BY pk.cabinet;
END;
$$;

REVOKE EXECUTE ON FUNCTION list_pennylane_cabinets_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION list_pennylane_cabinets_admin() TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- 3) CLÉ : clé déchiffrée + company_id d'un cabinet, pour un admin authentifié
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_pennylane_cabinet_key_admin(p_cabinet TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT est_admin_authentifie() THEN
    RAISE EXCEPTION 'acces_reserve_admin' USING ERRCODE = '42501',
      HINT = 'Seul un collaborateur administrateur connecté peut lire une clé cabinet.';
  END IF;

  SELECT jsonb_build_object(
           'cabinet', pk.cabinet,
           'company_id', pk.company_id,
           'api_key', ds.decrypted_secret
         )
  INTO v_result
  FROM pennylane_api_keys pk
  JOIN vault.decrypted_secrets ds ON ds.id = pk.vault_secret_id
  WHERE pk.cabinet = p_cabinet;

  RETURN v_result; -- NULL si cabinet inconnu ou clé non migrée dans Vault
END;
$$;

REVOKE EXECUTE ON FUNCTION get_pennylane_cabinet_key_admin(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_pennylane_cabinet_key_admin(TEXT) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- 4) Vérification (à lancer connecté en admin dans le SQL Editor, le résultat
--    est vide si la session n'a pas de JWT : c'est attendu)
-- ─────────────────────────────────────────────────────────────
-- SELECT * FROM list_pennylane_cabinets_admin();

-- ─────────────────────────────────────────────────────────────
-- Note (hors périmètre de cette migration) : la table pennylane_api_keys n'a
-- pas de RLS et garde la colonne historique api_key, que HonorairesPage lit
-- encore en clair avec la clé anon. Tant que cette colonne n'est pas vidée et
-- la table protégée, le Vault n'apporte pas de confidentialité réelle aux clés
-- cabinet vis-à-vis des utilisateurs connectés du site.
-- ─────────────────────────────────────────────────────────────
