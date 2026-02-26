-- Migration: Tables pour tarifs de référence et mapping produits Pennylane
-- Date: 2026-02-26

-- ============================================================================
-- 1. TABLE PRODUITS_PENNYLANE (mapping UUID produits par cabinet)
-- ============================================================================

CREATE TABLE IF NOT EXISTS produits_pennylane (
  id SERIAL PRIMARY KEY,
  cabinet TEXT NOT NULL,
  pennylane_product_id TEXT NOT NULL,
  denomination TEXT NOT NULL,
  label_normalise TEXT NOT NULL,
  type_recurrence TEXT NOT NULL CHECK (type_recurrence IN ('fixe', 'variable', 'ponctuel')),
  famille TEXT CHECK (famille IN ('comptabilite', 'social', 'juridique', 'support')),
  colonne_silae TEXT,
  tva_rate NUMERIC DEFAULT 0.20,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(cabinet, pennylane_product_id)
);

CREATE INDEX IF NOT EXISTS idx_produits_pl_cabinet ON produits_pennylane(cabinet);
CREATE INDEX IF NOT EXISTS idx_produits_pl_type ON produits_pennylane(type_recurrence);
CREATE INDEX IF NOT EXISTS idx_produits_pl_label ON produits_pennylane(label_normalise);

-- ============================================================================
-- 2. TABLE TARIFS_REFERENCE (prix unitaire HT par client × produit)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tarifs_reference (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) NOT NULL,
  produit_pennylane_id INTEGER REFERENCES produits_pennylane(id),
  label TEXT NOT NULL,
  axe TEXT,
  type_recurrence TEXT NOT NULL CHECK (type_recurrence IN ('fixe', 'variable')),
  pu_ht NUMERIC NOT NULL,
  quantite NUMERIC DEFAULT 1,
  frequence TEXT CHECK (frequence IN ('monthly', 'yearly')),
  intervalle INTEGER DEFAULT 1,
  tva_rate NUMERIC DEFAULT 0.20,
  cabinet TEXT NOT NULL,
  date_effet DATE NOT NULL,
  source TEXT DEFAULT 'augmentation',
  abonnement_ligne_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, label, date_effet)
);

CREATE INDEX IF NOT EXISTS idx_tarifs_ref_client ON tarifs_reference(client_id);
CREATE INDEX IF NOT EXISTS idx_tarifs_ref_type ON tarifs_reference(type_recurrence);
CREATE INDEX IF NOT EXISTS idx_tarifs_ref_date ON tarifs_reference(date_effet DESC);
CREATE INDEX IF NOT EXISTS idx_tarifs_ref_cabinet ON tarifs_reference(cabinet);

-- ============================================================================
-- 3. DONNEES INITIALES : PRODUITS PENNYLANE ZERAH FIDUCIAIRE
-- ============================================================================

INSERT INTO produits_pennylane (cabinet, pennylane_product_id, denomination, label_normalise, type_recurrence, famille, colonne_silae) VALUES
  -- VARIABLE (quantité change chaque mois)
  ('Zerah Fiduciaire', 'baef77d6-02a3-44d9-bf2d-01b7441fe6a2', 'Etablissement de bulletin de salaire {{mois}}', 'bulletin_salaire', 'variable', 'social', 'bulletins'),
  ('Zerah Fiduciaire', 'b2c95019-a421-4521-884b-7992bd5f48b8', 'Etablissement de bulletin de salaire déposé dans votre coffre-fort {{mois}}', 'coffre_fort', 'variable', 'social', 'coffre_fort'),
  ('Zerah Fiduciaire', '7b07f09f-4001-47d5-a464-9283055d1ca2', 'Enregistrement d''entrée de salariés {{mois}}', 'entree_salarie', 'variable', 'social', 'entrees'),
  ('Zerah Fiduciaire', 'e9df4490-5b4b-4d7c-8af8-24013c87387b', 'Enregistrement de sortie de salariés {{mois}}', 'sortie_salarie', 'variable', 'social', 'sorties'),
  ('Zerah Fiduciaire', 'c055fa2d-fe1e-4b79-a52b-37c4e10e7302', 'Enregistrement de vacation d''extras {{mois}}', 'vacation_extra', 'variable', 'social', NULL),
  ('Zerah Fiduciaire', 'dd82b2d0-4e2d-4ddd-b13c-8ef6f5fbfd1e', 'Enregistrement d''entrée / sortie d''un extra {{mois}}', 'entree_sortie_extra', 'variable', 'social', NULL),
  ('Zerah Fiduciaire', '19da4cf2-49cd-41c9-857b-283c151fd8dc', 'Modification de bulletin de salaire sur votre demande {{mois}}', 'modification_bulletin', 'variable', 'social', NULL),
  ('Zerah Fiduciaire', '7f26d558-9b55-4482-a6b2-d8b16f857bd8', 'Etablissement des bulletins de salaire et mise à disposition du logiciel social {{mois}}', 'bulletin_logiciel', 'variable', 'social', 'bulletins'),
  -- FIXE (montant constant)
  ('Zerah Fiduciaire', '010bd076-54d5-4d2e-a639-cce921ec8b58', 'Honoraires relatifs à notre mission comptable {{mois}}', 'mission_comptable', 'fixe', 'comptabilite', NULL),
  ('Zerah Fiduciaire', '1aadfd9f-c8f8-479e-9566-2348bf3798b8', 'Honoraires relatifs à notre mission comptable trimestrielle', 'mission_comptable_trim', 'fixe', 'comptabilite', NULL),
  ('Zerah Fiduciaire', '1bff934e-609c-4186-973e-2321a4721733', 'Honoraires relatifs à notre mission comptable {{mois}} et mise à disposition de logiciel', 'mission_comptable_logiciel', 'fixe', 'comptabilite', NULL),
  ('Zerah Fiduciaire', 'b1538825-ff4f-4b91-b7a4-991fe2b0c469', 'Quote-part Bilan', 'quote_part_bilan', 'fixe', 'comptabilite', NULL),
  ('Zerah Fiduciaire', 'da27e441-0a07-436b-a460-6f62a0ab21d7', 'Mission de surveillance {{mois}}', 'mission_surveillance', 'fixe', 'comptabilite', NULL),
  ('Zerah Fiduciaire', '86aeecfc-6115-4f05-adb6-6dbedac8819b', 'Etablissement du P&L {{mois}}', 'pl', 'fixe', 'comptabilite', NULL),
  ('Zerah Fiduciaire', 'bde09a10-58ee-4064-8d5c-79f8e6cfca14', 'Rendez-vous mensuel d''analyse', 'rdv_analyse', 'fixe', 'comptabilite', NULL),
  ('Zerah Fiduciaire', 'b8c5b6c1-88c6-486f-8f99-e7c64eefc293', 'Mission du social {{mois}}', 'social_forfait', 'fixe', 'social', NULL),
  ('Zerah Fiduciaire', '63cec816-bc65-4bf8-b549-1fdc4fb0f31d', 'Mission du social trimestriel', 'social_forfait_trim', 'fixe', 'social', NULL),
  ('Zerah Fiduciaire', '220f19b8-3996-437b-b2bb-112457c9143e', 'Mise à disposition de logiciel {{mois}}', 'logiciel', 'fixe', 'support', NULL),
  ('Zerah Fiduciaire', '4d28991a-a2c6-4454-ae1b-8a5fe81dc8e1', 'Licences informatiques {{mois}}', 'licences_info', 'fixe', 'support', NULL),
  ('Zerah Fiduciaire', '20238168-de4b-4986-bf7a-188b0d464fdc', 'Honoraires relatifs à notre mission comptable {{mois}} - Hôtel', 'mission_comptable_hotel', 'fixe', 'comptabilite', NULL),
  ('Zerah Fiduciaire', '7c7359c3-9c5e-4d9a-9624-e8e906dbb0d1', 'Honoraires relatifs à notre mission comptable {{mois}} - Restaurant', 'mission_comptable_restaurant', 'fixe', 'comptabilite', NULL),
  ('Zerah Fiduciaire', '428b3434-f00c-4f57-8d90-7c5668744b39', 'Honoraires relatifs à notre mission comptable et du social {{mois}}', 'mission_comptable_social', 'fixe', 'comptabilite', NULL),
  ('Zerah Fiduciaire', 'bf1a9dad-70e7-44ee-9dfc-65570693ad5a', '{{mois}} : Redevance relative à la licence d''exploitation du logiciel de gestion hôtelière Audit UP', 'redevance_logiciel_hotel', 'fixe', 'support', NULL),
  -- PONCTUEL
  ('Zerah Fiduciaire', '3b144ffb-17d5-4a01-99d7-6c9b7f8d440d', 'Aide à la mise en place du dossier de prévoyance', 'prevoyance', 'ponctuel', 'social', NULL),
  ('Zerah Fiduciaire', '0827f8c5-babc-4648-8ab6-8be5acabad96', 'Aide à la rédaction du contrat de travail', 'contrat_travail', 'ponctuel', 'social', NULL),
  ('Zerah Fiduciaire', 'ed7cfd33-2060-43d7-86df-ad451e3e077a', 'Etablissement du STC', 'stc', 'ponctuel', 'social', NULL),
  ('Zerah Fiduciaire', 'd4ed3574-6705-42b8-9e72-411c9b981866', 'Aide à la rédaction de l''avenant au contrat de travail', 'avenant_contrat', 'ponctuel', 'social', NULL),
  ('Zerah Fiduciaire', '432ef56c-cd54-426c-93c1-8ab6d84b4b34', 'Rupture conventionnelle', 'rupture_conv', 'ponctuel', 'social', NULL),
  ('Zerah Fiduciaire', 'be054a66-7269-4880-bf5d-27175fddac84', 'Création de votre société', 'creation_societe', 'ponctuel', 'juridique', NULL)
ON CONFLICT (cabinet, pennylane_product_id) DO NOTHING;

-- ============================================================================
-- 4. DONNEES INITIALES : PRODUITS PENNYLANE AUDIT UP
-- ============================================================================

INSERT INTO produits_pennylane (cabinet, pennylane_product_id, denomination, label_normalise, type_recurrence, famille, colonne_silae) VALUES
  -- VARIABLE
  ('Audit Up', '1fff12a8-f1a2-43a8-99f9-ad58d9fd944d', 'Etablissement de bulletin de salaire {{mois}}', 'bulletin_salaire', 'variable', 'social', 'bulletins'),
  ('Audit Up', 'fdf01c89-f5d6-4a34-863b-50936c762d89', 'Dépôt Coffre-Fort Numérique', 'coffre_fort', 'variable', 'social', 'coffre_fort'),
  ('Audit Up', '3928a286-f19e-4cdf-b1fc-50fde2c1a896', 'Enregistrement d''entrée de salariés', 'entree_salarie', 'variable', 'social', 'entrees'),
  ('Audit Up', '9170b3e2-21a1-44b9-88a2-4eb3fb190b38', 'Enregistrement de sortie de salariés', 'sortie_salarie', 'variable', 'social', 'sorties'),
  ('Audit Up', '9b0dbfc7-25fa-4c14-b17f-f5e477f95c36', 'Enregistrement de vacation d''extras', 'vacation_extra', 'variable', 'social', NULL),
  ('Audit Up', '9b1ed203-4d9a-4f2d-bdcc-d729182c7a5e', 'Enregistrement d''entrée / sortie d''un extra', 'entree_sortie_extra', 'variable', 'social', NULL),
  ('Audit Up', '4c0a0b2b-763d-4330-909a-7ab81a070b28', 'Modification de bulletin de salaire sur votre demande', 'modification_bulletin', 'variable', 'social', NULL),
  ('Audit Up', '5c92c765-3f99-40a9-9f6c-76f1b70e7f77', 'Bulletins de salaire envoyés par publi-postage', 'publipostage', 'variable', 'social', 'editique'),
  -- FIXE
  ('Audit Up', '019c23f7-b8c9-77cc-bb8b-50139afb9d50', 'Mission comptable {{mois}}', 'mission_comptable', 'fixe', 'comptabilite', NULL),
  ('Audit Up', '4b8591d8-2310-4daa-a478-1c6d8eb6616c', 'Quote-part Bilan', 'quote_part_bilan', 'fixe', 'comptabilite', NULL),
  ('Audit Up', '03554d09-b3f1-4817-a83b-02ddc25c0eae', 'Mission de surveillance {{mois}}', 'mission_surveillance', 'fixe', 'comptabilite', NULL),
  ('Audit Up', 'ea044b4b-66c7-48c8-aa8c-fea3a0895fe6', 'Etablissement du P&L', 'pl', 'fixe', 'comptabilite', NULL),
  ('Audit Up', '33835c61-7a7e-44c7-9a41-acfe60ed7878', 'Rendez-vous mensuel d''analyse', 'rdv_analyse', 'fixe', 'comptabilite', NULL),
  ('Audit Up', '9db67a2d-080b-4cd5-9b43-8add7cfbe033', 'Mission du social {{mois}}', 'social_forfait', 'fixe', 'social', NULL),
  ('Audit Up', '2170501b-21ab-4dc6-b20a-6bfab07903de', 'Mise à disposition de logiciel', 'logiciel', 'fixe', 'support', NULL),
  ('Audit Up', 'ac0f2f2b-7aad-4212-bb7c-007d03eed4d2', '{{mois}} : Redevance relative à la licence d''exploitation du logiciel de gestion hôtelière Audit UP', 'redevance_logiciel_hotel', 'fixe', 'support', NULL),
  -- PONCTUEL
  ('Audit Up', '70268326-b3d0-4d1b-b509-d21aa0ae5226', 'HONORAIRES', 'honoraires_generique', 'ponctuel', 'comptabilite', NULL),
  ('Audit Up', '0e196ce3-c73d-49e1-b471-063dba1f3fc8', 'Remise exceptionnelle', 'remise_exceptionnelle', 'ponctuel', 'comptabilite', NULL),
  ('Audit Up', '8a5b3d66-d2dd-4d7b-befe-4d3015f8a47f', 'Travaux de secrétariat juridique pour le dossier n°', 'juridique_dossier', 'ponctuel', 'juridique', NULL),
  ('Audit Up', '1a97f3ac-f9bb-46c9-b44c-e5422e82ccb6', 'Formalités juridiques relatives au dossier n°', 'formalites_juridique', 'ponctuel', 'juridique', NULL),
  ('Audit Up', '019ba3c0-8667-721a-8844-ab202dfbc126', 'EXTRAIT KBIS', 'kbis', 'ponctuel', 'juridique', NULL),
  ('Audit Up', '019ba3c1-6e9c-735f-ae0a-477b3f8957d4', 'ANNONCE LEGALE', 'annonce_legale', 'ponctuel', 'juridique', NULL),
  ('Audit Up', '019ba3c4-ec69-7a57-a22e-edb59162301c', 'REMISE SUR HONORAIRE', 'remise', 'ponctuel', 'comptabilite', NULL),
  ('Audit Up', '019bbbca-fdb4-723d-af49-67f3829090f0', 'FRAIS DE REGISTRE', 'frais_registre', 'ponctuel', 'juridique', NULL),
  ('Audit Up', '019bbc13-a26d-725e-8464-c2b5adeb8dc4', 'REMISE SUR HONORAIRES - 25%', 'remise_25', 'ponctuel', 'comptabilite', NULL),
  ('Audit Up', '019bbc30-7f36-79c4-a90e-2f27e947f0c1', 'REMISE SUR HONORAIRES - 20%', 'remise_20', 'ponctuel', 'comptabilite', NULL),
  ('Audit Up', '019c284f-57e5-70ff-b8ce-4bc0d80b036b', 'REMISE SUR HONORAIRES - 5%', 'remise_5', 'ponctuel', 'comptabilite', NULL),
  ('Audit Up', '019c2809-56ae-7484-b798-aa9e04f88f7f', 'PUBLICATION AU BALO', 'balo', 'ponctuel', 'juridique', NULL),
  ('Audit Up', '019c2831-9c9e-709b-94aa-22a72fe67051', 'FRAIS DE GREFFE', 'frais_greffe', 'ponctuel', 'juridique', NULL),
  ('Audit Up', '019c6737-3ee3-7c07-a8cc-a3de5192b912', 'Etablissement de la situation de votre société en date du', 'situation', 'ponctuel', 'comptabilite', NULL),
  ('Audit Up', '019c6801-09b1-723c-97fa-2b2d48a21017', 'Travaux supplémentaires du social relatifs', 'travaux_supp_social', 'ponctuel', 'social', NULL),
  ('Audit Up', '019c680b-99d1-7025-8249-601148b71b0b', 'Etablissement du Bilan clos au', 'bilan', 'fixe', 'comptabilite', NULL),
  ('Audit Up', '019c680d-7c23-7099-bc5d-acd4160540c4', 'Réalisation du secrétariat juridique d''approbation des comptes clos au', 'juridique_approbation', 'fixe', 'juridique', NULL),
  ('Audit Up', '019c7639-74ba-73f3-bf90-75adfa3dc6b1', 'DEPOT DES COMPTES ANNUELS', 'depot_comptes', 'ponctuel', 'juridique', NULL),
  ('Audit Up', '019c763a-2c46-7c7b-9835-7f6bb8fba895', 'POURSUITE D''ACTIVITE', 'poursuite_activite', 'ponctuel', 'juridique', NULL)
ON CONFLICT (cabinet, pennylane_product_id) DO NOTHING;
