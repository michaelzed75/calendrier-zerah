-- Migration: Clé Pennylane d'ÉCRITURE des cabinets (Audit Up, Zerah Fiduciaire), lisible par l'admin seul
-- Date: 2026-10-11
-- Description: L'extension « Pennylane Cabinet — Honoraires » lit aujourd'hui une clé de LECTURE par
--   cabinet (migrations 017 et 020). Pour ses futurs outils d'écriture (corrections de révision, sous
--   simulation et avec l'accord de Michael), elle aura besoin d'une clé distincte, de portée écriture.
--
--   Principe retenu :
--   - La clé d'écriture n'est JAMAIS tapée dans du SQL ni dans une conversation. Michael la crée lui-même
--     dans le Vault du tableau de bord Supabase (Integrations → Vault → Secrets → Add new secret), sous le
--     nom pl_cabinet_<cabinet>_ecriture, par exemple pl_cabinet_audit_up_ecriture.
--   - Elle ne passe pas par la table pennylane_api_keys (lisible avec la clé anon) : on ne stocke rien de
--     plus dans cette table.
--   - Elle n'est lisible que par un collaborateur administrateur authentifié (JWT de son compte du site,
--     garde est_admin_authentifie() de la migration 020). Aucun droit n'est donné à service_role : cette clé
--     est distribuée sur les postes de l'extension de lettrage, elle ne doit pas ouvrir l'écriture cabinet.
--
-- À exécuter dans le SQL Editor de Supabase (après la migration 020).

-- ─────────────────────────────────────────────────────────────
-- 1) Nom du secret d'écriture d'un cabinet (même règle que pl_cabinet_<cabinet> de la migration 017)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION nom_secret_cabinet_ecriture(p_cabinet TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'pl_cabinet_' || regexp_replace(lower(trim(p_cabinet)), '\s+', '_', 'g') || '_ecriture';
$$;

-- ─────────────────────────────────────────────────────────────
-- 2) ÉTAT : pour chaque cabinet, la clé d'écriture est-elle rangée ? (aucun secret renvoyé)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION etat_cles_ecriture_cabinets_admin()
RETURNS TABLE (
  cabinet TEXT,
  nom_secret TEXT,
  cle_ecriture_configuree BOOLEAN,
  cle_ecriture_mise_a_jour_le TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  IF NOT est_admin_authentifie() THEN
    RAISE EXCEPTION 'acces_reserve_admin' USING ERRCODE = '42501',
      HINT = 'Seul un collaborateur administrateur connecté peut consulter les clés d''écriture cabinet.';
  END IF;

  RETURN QUERY
    SELECT pk.cabinet,
           nom_secret_cabinet_ecriture(pk.cabinet),
           (s.id IS NOT NULL),
           s.updated_at
    FROM pennylane_api_keys pk
    LEFT JOIN vault.secrets s ON s.name = nom_secret_cabinet_ecriture(pk.cabinet)
    ORDER BY pk.cabinet;
END;
$$;

REVOKE EXECUTE ON FUNCTION etat_cles_ecriture_cabinets_admin() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION etat_cles_ecriture_cabinets_admin() TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3) CLÉ D'ÉCRITURE : clé déchiffrée + company_id d'un cabinet, pour un admin authentifié
--    Le cabinet doit exister dans pennylane_api_keys (on ne lit pas un secret arbitraire du Vault).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_pennylane_cabinet_key_ecriture_admin(p_cabinet TEXT)
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
      HINT = 'Seul un collaborateur administrateur connecté peut lire une clé d''écriture cabinet.';
  END IF;

  SELECT jsonb_build_object(
           'cabinet', pk.cabinet,
           'company_id', pk.company_id,
           'portee', 'ecriture',
           'api_key', ds.decrypted_secret
         )
  INTO v_result
  FROM pennylane_api_keys pk
  JOIN vault.decrypted_secrets ds ON ds.name = nom_secret_cabinet_ecriture(pk.cabinet)
  WHERE pk.cabinet = p_cabinet;

  RETURN v_result; -- NULL si le cabinet est inconnu ou si le secret d'écriture n'a pas été créé
END;
$$;

REVOKE EXECUTE ON FUNCTION get_pennylane_cabinet_key_ecriture_admin(TEXT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION get_pennylane_cabinet_key_ecriture_admin(TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4) Vérification sans afficher de secret (SQL Editor, rôle postgres) :
--      SELECT name, created_at, updated_at FROM vault.secrets WHERE name LIKE 'pl_cabinet_%' ORDER BY name;
--    On doit voir pl_cabinet_audit_up (lecture) et pl_cabinet_audit_up_ecriture (écriture).
--
--    Rotation : modifier la valeur du secret dans le Vault (même nom). Retrait : supprimer le secret.
-- ─────────────────────────────────────────────────────────────
