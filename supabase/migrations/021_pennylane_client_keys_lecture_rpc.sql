-- Migration: Lecture des clés API Pennylane READ des dossiers clients par un COLLABORATEUR AUTHENTIFIÉ
-- Date: 2026-10-06
-- Description: L'extension Claude Desktop « Pennylane 511 — Lecture seule », distribuée
--   aux collaborateurs, lit la clé READ d'un dossier client dans le Vault du site.
--   Elle ne reçoit PAS la clé service_role : quiconque la détient peut appeler
--   get_pennylane_client_key(..., 'write') et lire toute la base. Ici, l'extension
--   se connecte avec le compte du collaborateur sur le site (email + mot de passe →
--   JWT « authenticated »), et la fonction ne rend que la clé de portée 'read',
--   à un collaborateur actif. La portée 'write' n'est accessible par aucun chemin.
--
--   Les fonctions existantes (016) ne sont pas modifiées : l'extension complète de
--   lettrage continue d'utiliser get_pennylane_client_key sous service_role.
--
--   Retirer l'accès à un collaborateur : passer collaborateurs.actif à false
--   (ou supprimer son compte auth). Effet au plus tard 5 min après (cache du MCP).
--
-- À exécuter dans le SQL Editor de Supabase.

-- ─────────────────────────────────────────────────────────────
-- 1) Garde : l'appelant est-il un collaborateur actif authentifié ?
--    L'email est lu dans le JWT Supabase (claim `email`), jamais passé en paramètre.
--    Comparaison insensible à la casse : Supabase Auth met les emails en minuscules,
--    la table collaborateurs non.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION est_collaborateur_authentifie()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM collaborateurs c
    WHERE COALESCE(c.actif, true) = true
      AND c.email IS NOT NULL
      AND lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

REVOKE EXECUTE ON FUNCTION est_collaborateur_authentifie() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION est_collaborateur_authentifie() TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- 2) CLÉ READ : clé déchiffrée de portée 'read' d'un dossier client
--    La portée est FIGÉE dans le corps : aucun paramètre ne permet d'obtenir 'write'.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_pennylane_client_key_lecture(p_client_id INT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF NOT est_collaborateur_authentifie() THEN
    RAISE EXCEPTION 'acces_reserve_collaborateur' USING ERRCODE = '42501',
      HINT = 'Seul un collaborateur actif connecté peut lire une clé Pennylane de lecture.';
  END IF;

  SELECT ds.decrypted_secret INTO v_key
  FROM pennylane_client_keys pck
  JOIN vault.decrypted_secrets ds ON ds.id = pck.vault_secret_id
  WHERE pck.client_id = p_client_id
    AND pck.scope = 'read';

  RETURN v_key; -- NULL si le dossier n'a pas de clé READ dans le Vault
END;
$$;

REVOKE EXECUTE ON FUNCTION get_pennylane_client_key_lecture(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_pennylane_client_key_lecture(INT) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- 3) Vérification (le SQL Editor n'a pas de JWT : la fonction y refuse l'accès,
--    c'est attendu ; le vrai test se fait depuis l'extension)
-- ─────────────────────────────────────────────────────────────
-- SELECT proname FROM pg_proc WHERE proname IN ('est_collaborateur_authentifie', 'get_pennylane_client_key_lecture');
