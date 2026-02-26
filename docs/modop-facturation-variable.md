# Mode operatoire : Facturation variable mensuelle

## Objectif

Generer chaque mois les factures variables (bulletins de salaire, accessoires social)
a partir des donnees Silae et des tarifs 2026, puis les importer dans Pennylane
sous forme de brouillons de factures.

## Pre-requis

- Fichier Silae "Analyse production synthetique" du mois (export Excel depuis Silae)
- Tarifs 2026 sauvegardes en base (Phase 1 terminee, date_effet 2026-01-01)
- Produits Pennylane synchronises (sync automatique avant chaque export)
- Cles API PL configurees pour les 2 cabinets (Audit Up + Zerah Fiduciaire)

## Procedure mensuelle

### 1. Importer le fichier Silae

1. Aller dans **Honoraires > Facturation**
2. Dans la section "Importer un fichier Silae" :
   - Selectionner le **mois** (Janvier, Fevrier, etc.) et l'**annee** (2026)
   - Ou laisser "Auto" pour extraire la periode du nom du fichier
3. Cliquer **Choisir fichier Silae** et selectionner le `.xlsx` exporte depuis Silae
4. L'import sauvegarde les quantites en BDD (table `silae_productions`)
5. Si des dossiers Silae ne sont pas reconnus : la modal de mapping s'affiche
   - Associer chaque dossier non reconnu a un ou plusieurs clients
   - Le mapping est memorise pour les imports suivants

### 2. Generer la facturation

1. Selectionner le mode **Tous les clients** (ou un client pour test)
2. Verifier que la **Periode Silae** est correcte (auto-selectionnee apres import)
3. Verifier que la **Date d'effet tarifs** est `2026-01-01`
4. Cliquer **Generer la facturation**
5. Verifier les statistiques :
   - Clients avec Silae : quantites trouvees
   - Clients sans Silae : fichier Silae manquant ou non mappe
   - Complets : toutes les lignes ont une quantite
   - Total HT auto : montant calcule automatiquement

### 3. Exporter pour Pennylane

1. Cliquer **Exporter Excel** (ou "Sync & Export")
2. **Sync produits automatique** : avant l'export, l'app appelle l'API PL (`GET /products`)
   pour synchroniser les codes produits locaux avec ceux de Pennylane
3. **1 fichier par cabinet** est genere :
   - `AUP Janvier 26 a importer dans PL.xlsx` (Audit Up)
   - `ZF Janvier 26 a importer dans PL.xlsx` (Zerah Fiduciaire)
4. Format strict Pennylane brouillons :
   - SIREN en nombre, TVA 0.00%, date serial m/d/yy
   - Feuille nommee "Feuil1", colonnes E et L absentes
5. Importer dans PL : **Facturation > Importer des brouillons**

### 4. Completer les lignes manuelles

Les produits sans colonne Silae (ex: "Modification de bulletin de salaire")
restent avec quantite vide dans l'export. Deux options :
- Saisir manuellement dans PL apres import du brouillon
- Ajouter un fichier complementaire (workflow a definir)

## Correspondance periode ↔ export

La periode selectionnee (ex: mois=01, annee=2026 → "2026-01") determine :
- La **date d'emission** dans l'export : dernier jour du mois (31/01/2026)
- Le **suffixe produit** : "Etablissement de bulletin de salaire **Janvier 26**"

## Colonnes Silae utilisees

| Colonne Excel | Champ BDD | Usage |
|---------------|-----------|-------|
| F (Bulletins originaux) | bulletins | Bulletins de salaire |
| K (Coffre-Fort) | coffre_fort | Depot coffre-fort |
| L (Editique) | editique | Publi-postage |
| M (Total) | bulletins_total | Total general |
| O (Entrees) | entrees | Entrees salaries |
| P (Sorties) | sorties | Sorties salaries |
| Q (Declarations) | declarations | Declarations sociales |
| S (Attestations PE) | attestations_pe | Attestations Pole emploi |

## Fichier complementaire (~10%)

Environ 10% des produits ne viennent pas de Silae (extras, modifications).
Ce workflow reste a definir pour automatiser la saisie.
