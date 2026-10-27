-- Migration: Identifiants de l'API Silae Paie dans le Vault, lisibles par l'admin seul
-- Date: 2026-10-27
-- Description: L'extension Claude « Silae Paie API » demandait les trois identifiants OAuth2 (client_id,
--   client_secret, subscription_key) à chaque appel. Ils sont désormais rangés chiffrés dans le Vault du
--   site, et l'extension les lit elle-même avec le compte du site de l'utilisateur.
--
--   Principe retenu (même logique que la clé d'écriture cabinet, migration 022) :
--   - Trois secrets du Vault aux noms fixes : silae_client_id, silae_client_secret, silae_subscription_key.
--     Aucune table de correspondance : rien n'est ajouté aux tables lisibles avec la clé anon.
--   - Saisie depuis le site (Honoraires → API Silae) par un collaborateur administrateur authentifié ;
--     le site n'en relit jamais la valeur, seulement l'état (configuré ou non, date).
--   - Lecture en clair réservée à un administrateur authentifié (garde est_admin_authentifie() de la
--     migration 020). Aucun droit à service_role : cette clé est distribuée sur les postes de l'extension
--     de lettrage, elle ne doit pas ouvrir l'accès à la paie.
--
-- À exécuter dans le SQL Editor de Supabase (après la migration 020).

-- ─────────────────────────────────────────────────────────────
-- 1) Nom du secret Vault d'un champ Silae (liste fermée)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION nom_secret_silae(p_champ TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_champ
    WHEN 'client_id' THEN 'silae_client_id'
    WHEN 'client_secret' THEN 'silae_client_secret'
    WHEN 'subscription_key' THEN 'silae_subscription_key'
  END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2) ÉTAT : chaque identifiant est-il rangé ? (aucun secret renvoyé)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION etat_identifiants_silae_admin()
RETURNS TABLE (
  champ TEXT,
  nom_secret TEXT,
  configure BOOLEAN,
  mis_a_jour_le TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  IF NOT est_admin_authentifie() THEN
    RAISE EXCEPTION 'acces_reserve_admin' USING ERRCODE = '42501',
      HINT = 'Seul un collaborateur administrateur connecté peut consulter les identifiants Silae.';
  END IF;

  RETURN QUERY
    SELECT c.champ,
           nom_secret_silae(c.champ),
           (s.id IS NOT NULL),
           s.updated_at
    FROM unnest(ARRAY['client_id', 'client_secret', 'subscription_key']) WITH ORDINALITY AS c(champ, rang)
    LEFT JOIN vault.secrets s ON s.name = nom_secret_silae(c.champ)
    ORDER BY c.rang;
END;
$$;

REVOKE EXECUTE ON FUNCTION etat_identifiants_silae_admin() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION etat_identifiants_silae_admin() TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3) SET : crée ou remplace les identifiants fournis (NULL ou vide = champ inchangé)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_identifiants_silae_admin(
  p_client_id TEXT DEFAULT NULL,
  p_client_secret TEXT DEFAULT NULL,
  p_subscription_key TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  r RECORD;
  v_valeur TEXT;
  v_secret_id UUID;
  v_nb INTEGER := 0;
BEGIN
  IF NOT est_admin_authentifie() THEN
    RAISE EXCEPTION 'acces_reserve_admin' USING ERRCODE = '42501',
      HINT = 'Seul un collaborateur administrateur connecté peut enregistrer les identifiants Silae.';
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      ('client_id', p_client_id),
      ('client_secret', p_client_secret),
      ('subscription_key', p_subscription_key)
    ) AS t(champ, valeur)
  LOOP
    v_valeur := btrim(regexp_replace(coalesce(r.valeur, ''), '[`\r\n]', '', 'g'));
    CONTINUE WHEN v_valeur = '';

    SELECT id INTO v_secret_id FROM vault.secrets WHERE name = nom_secret_silae(r.champ);

    IF v_secret_id IS NULL THEN
      PERFORM vault.create_secret(v_valeur, nom_secret_silae(r.champ), 'API Silae Paie : ' || r.champ);
    ELSE
      PERFORM vault.update_secret(v_secret_id, v_valeur);
    END IF;
    v_nb := v_nb + 1;
  END LOOP;

  RETURN v_nb; -- nombre d'identifiants enregistrés
END;
$$;

REVOKE EXECUTE ON FUNCTION set_identifiants_silae_admin(TEXT, TEXT, TEXT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION set_identifiants_silae_admin(TEXT, TEXT, TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4) GET : identifiants déchiffrés, pour un admin authentifié (extension Claude « Silae Paie API »)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_identifiants_silae_admin()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  IF NOT est_admin_authentifie() THEN
    RAISE EXCEPTION 'acces_reserve_admin' USING ERRCODE = '42501',
      HINT = 'Seul un collaborateur administrateur connecté peut lire les identifiants Silae.';
  END IF;

  RETURN jsonb_build_object(
    'client_id',        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = nom_secret_silae('client_id')),
    'client_secret',    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = nom_secret_silae('client_secret')),
    'subscription_key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = nom_secret_silae('subscription_key'))
  ); -- un champ vaut NULL tant que son secret n'est pas rangé
END;
$$;

REVOKE EXECUTE ON FUNCTION get_identifiants_silae_admin() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION get_identifiants_silae_admin() TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5) DELETE : retire les trois identifiants du Vault
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION delete_identifiants_silae_admin()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_nb INTEGER;
BEGIN
  IF NOT est_admin_authentifie() THEN
    RAISE EXCEPTION 'acces_reserve_admin' USING ERRCODE = '42501',
      HINT = 'Seul un collaborateur administrateur connecté peut supprimer les identifiants Silae.';
  END IF;

  DELETE FROM vault.secrets
  WHERE name IN (nom_secret_silae('client_id'), nom_secret_silae('client_secret'), nom_secret_silae('subscription_key'));
  GET DIAGNOSTICS v_nb = ROW_COUNT;
  RETURN v_nb;
END;
$$;

REVOKE EXECUTE ON FUNCTION delete_identifiants_silae_admin() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION delete_identifiants_silae_admin() TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 6) Vérification sans afficher de secret (SQL Editor, rôle postgres) :
--      SELECT name, created_at, updated_at FROM vault.secrets WHERE name LIKE 'silae_%' ORDER BY name;
--    On doit voir silae_client_id, silae_client_secret et silae_subscription_key.
--
--    Rotation : ressaisir l'identifiant dans le site (Honoraires → API Silae). Retrait : bouton Supprimer.
-- ─────────────────────────────────────────────────────────────
