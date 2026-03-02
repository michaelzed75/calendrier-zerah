# Honoraires 2026 — Progression

## Vue d'ensemble

| Phase | Description | Statut |
|-------|-------------|--------|
| Phase 1 | Augmentation tarifs 2026 (+2.5%) | Terminee |
| Phase 2 | Restructuration abonnements PL | Terminee (recree manuellement) |
| Phase 3 | Facturation variable mensuelle | Terminee |
| Nettoyage PL | Transition 2025 → 2026 | Terminee (ISO verifie 02/03/2026) |
| Phase 3b | Saisie manuelle + grille Silae | Terminee |
| Phase 4 | Correction factures Janvier 2026 | En attente (corrections manuelles PL) |
| **Phase 5** | **Dashboard Vue — Honoraires annuels estimes** | **Terminee (02/03/2026)** |

---

## Phase 1 — Augmentation tarifs 2026

**Objectif :** Appliquer +2.5% sur tous les tarifs pour 2026, avec possibilite d'ajustement manuel par client.

**Resultats :**
- 563 tarifs baseline 2025 (date_effet 2025-01-01) sauvegardes en BDD
- 563 tarifs augmentes 2026 (date_effet 2026-01-01) sauvegardes en BDD
- Repartition : Zerah 308 / Audit Up 818, fixe 656 / variable 470
- Ajustements manuels : SAINT JAMES, RELAIS CHRISTINE (prix corriges post-augmentation)
- AugmentationPanel : sauvegarde en 2 etapes avec progress bar

**Fichiers cles :**
- `tarifsReferenceService.js` — CRUD tarifs_reference (baseline + augmentation)
- `calculsAugmentation.js` — calculs augmentation par axe
- `exportAugmentation.js` — export Excel multi-feuilles
- `AugmentationPanel.jsx` — UI verrouillage + sauvegarde 2 etapes

---

## Phase 2 — Restructuration abonnements PL

**Objectif :** Separer les produits fixes (abonnements PL) des produits variables (import Excel mensuel).

**Analyse :**
- 136 clients avec abonnements actifs
- 51 clients mixtes (fixe + variable)
- Decisions par abonnement : `inchange`, `a_modifier`, `a_supprimer`

**Export restructuration :**
- 5 onglets : Resume, Import PL AUP, Import PL ZF, A SUPPRIMER, Detail croise
- Split par cabinet (1 onglet import par cabinet)
- Prix 2026 depuis tarifs_reference
- 220 abonnements fixes a recreer (235 - 15 clients inactifs)

**Fichiers cles :**
- `subscriptionRestructuration.js` — analyse clients, separation fixe/variable
- `exportRestructuration.js` — export Excel 5 onglets
- `RestructurationPanel.jsx` — UI mode single/batch

---

## Phase 3 — Facturation variable mensuelle

**Objectif :** Generer mensuellement les factures variables (bulletins, accessoires social) via import Excel dans PL.

**Workflow mensuel :**
1. Importer fichier Silae dans FacturationVariablePanel (selecteur mois/annee)
2. Generer la facturation variable (croisement Silae x tarifs x produits PL)
3. Exporter Excel format PL brouillons (1 fichier par cabinet)
4. Importer dans Pennylane

**Format Excel strict :**
- SIREN en nombre, TVA 0.00%, date serial m/d/yy
- Feuille "Feuil1", colonnes E/L absentes
- Periode dans le nom produit ("Etablissement de bulletin de salaire Janvier 26")
- Lignes manuelles (quantite null) exclues

**Fichiers cles :**
- `facturationVariableService.js` — croisement Silae x tarifs x produits PL
- `exportFacturationVariable.js` — export Excel format strict PL
- `FacturationVariablePanel.jsx` — UI upload Silae + generation + export
- `silaeService.js` — parseur Silae + import BDD

---

## Nettoyage PL — Transition 2025 → 2026

**Objectif :** Nettoyer Pennylane pour passer des tarifs 2025 aux tarifs 2026.

### Operations realisees

| Operation | Description | Statut | Details |
|-----------|-------------|--------|---------|
| Op 1 | Supprimer brouillons variables Jan 2026 | Fait | 40 brouillons supprimes (batch script) |
| Op 2 | MAJ prix brouillons fixes Jan 2026 | Fait | 72 prix mis a jour (batch script) |
| Op 3 | Supprimer abos variables dans PL | Fait | 42 abonnements supprimes (39 AUP + 3 ZF, manuel) |
| Op 4a | Supprimer abos fixes dans PL | Fait | 235 abonnements supprimes (146 AUP + 89 ZF, manuel) |
| Op 4b | Recreer nouveaux abos fixes 2026 | Fait | Recrees manuellement dans PL avant le 28/02 (import Excel non supporte par PL) |
| Op 5 | Analyse croisee prevu vs reel | Fait | 125 OK, 0 ecart, 323 lignes ISO |

### Verification post-nettoyage
- [x] Sync Pennylane depuis l'app (473 abonnements synchronises le 02/03/2026)
- [x] Analyse croisee : tarifs prevus (tarifs_reference 2026) vs abonnements reels dans PL
- [x] Identifier les ecarts (prix, produits manquants, doublons, erreurs de saisie manuelle)
- [x] Corriger les ecarts — Voir detail ci-dessous
- [ ] Supprimer cles API write de .env

### Corrections effectuees (analyse croisee 02/03/2026)

**Progression : 56 OK → 125 OK, 64 ecarts → 0 ecart**

| Correction | Detail |
|---|---|
| Fix SIRET multi-etablissements | SAINT JAMES + RELAIS CHRISTINE : SIREN 9 → SIRET 14 en BDD + matching syncHonoraires/reconciliation |
| Alignement tarifs v1 | 58 updates, 9 inserts, 5 suppressions via maj-tarifs-reference.js |
| Fix "Mission du social" | Bug detectAxe : classait social en variable → skippait. 25 lignes social corrigees |
| HOTELIERE DE L'ETOILE | 2 etablissements (hotel+restau) : labels differencies en BDD, 8 lignes alignees |
| SEVENSTREET | Suppression "Mission de surveillance" fantome (1015€), ajout compta+bilan+P&L depuis PL |
| PHM CONSULTING | Suppression juridique fantome 1.02€ |
| DELMAS INVESTISSEMENTS | Suppression juridique fantome 1.02€, ajout juridique 970€/an |
| MILEVA | Passage social forfait → reel (bulletin 27€), alignement compta/bilan/juridique sur PL |
| AUREL INVESTISSEMENTS | Passage social reel → forfait 300€/semestre, suppression compta fantome |
| LA TERRASSE MIRABEAU | Ajout bilan 5890€/an + compta 1435€/mois + social reel 21.50€/bulletin |
| ANFRED | Bilan 1.02€ → 3500€ |
| TARDIGRADA IT | Ajout compta 2400€/mois + bilan 1500€/an (nouveau client) |
| LAMAC CAPITAL | Ajout compta 300€/mois + bilan 1330€/an (nouveau client) |

### Clients absents PL (5) — pas d'abonnement actif
| Client | Raison |
|---|---|
| SCRAMBLE | Remise a negocier, abos stopped |
| LPM JUAN | Pas encore facture, abo stopped |
| LMK INVEST | Pas encore facture, abo stopped |
| SCI ZERAH | Anciens abos BHG/ZF tous stopped |
| AMITIES VINS | Abo placeholder 1€ not_started |

### Infrastructure API write
- `pennylane-proxy.js` : support GET/POST/PUT/DELETE/PATCH + 204 No Content
- `pennylaneCustomersApi.js` : callPennylaneWriteAPI + 5 fonctions (list/delete/update invoices, delete/create subscriptions)

### Analyse ecarts factures Janvier 2026 (02/03/2026)

**Objectif :** Les factures brouillons de Janvier 2026 ont ete generees avec les anciens abonnements 2025. Comparer avec Fevrier 2026 (correct, nouveaux abos 2026) pour identifier les corrections a apporter.

**Methode :** Analyse croisee Jan brouillons vs Fev (toutes) vs tarifs_reference, social au reel mis de cote

**Resultats :**
| Statut | Nb clients |
|---|---|
| OK (Jan = Fev) | 23 |
| Ecarts a corriger (prix differents) | 47 → 74 lignes de corrections |
| Inactifs (a supprimer en Jan) | 8 |
| Absents Fev (verifier si doivent etre factures) | 6 |
| Nouveaux Fev (facture Jan manquante) | 17 |
| Social au reel (ecarts PU) | 25 lignes |

**Scripts :**
- `scripts/compare-croisee-jan26.js` — analyse croisee 3 sources (Jan brouillons + Fev + tarifs_reference)
- `analyse-croisee-jan26-v2.xlsx` — fichier Excel 4 onglets (Resume, Corrections Jan, Social au reel, A investiguer)

**Statut : EN COURS** — corrections manuelles a faire dans PL par l'utilisateur

### Notes
- L'API PL ne supporte PAS la modification de prix d'abonnements existants
- L'import Excel d'abonnements dans PL n'a pas fonctionne — recreation manuelle obligatoire
- Strategie finale : suppression batch (API/manuel) + recreation manuelle dans PL
- Scripts nettoyage dans `scripts/nettoyage-pl/` (jetables, non commites)
- Brouillons de factures Fevrier 2026 generes a temps par PL apres recreation manuelle

---

## Phase 3b — Saisie manuelle + Grille Silae annuelle

**Objectif :** Completer la facturation variable avec les donnees absentes du fichier Silae (bulletins manuels SAINT JAMES/RELAIS CHRISTINE, bulletins refaits, coffre-fort forfait) et fournir une vue annuelle du suivi Silae.

### Grille Silae 12 mois

- **Table 1** : 52 clients au reel — bulletins mensuels + infobulle enrichie (coffre-fort, editique, entrees, sorties, declarations, attestations PE, donnees manuelles)
- **Table 2** : clients au forfait avec coffre-fort/editique (ACF CONSEILS, IB PARIS, RELAIS CHRISTINE ZF)
- Selecteur annee (2025-2030) + filtre cabinet
- Ligne TOTAL par colonne et total general

### Saisie manuelle

**Popover (clic sur cellule)** :
- Bulletins manuels (pour SAINT JAMES, RELAIS CHRISTINE — pas de detail Silae)
- Bulletins refaits (info absente du fichier Silae)
- Temps passe (heures, info interne)
- Commentaires (info interne)
- Sauvegarde directe dans `silae_productions` (colonnes manuelles)

**Import/Export Excel** :
- Bouton "Exporter modele" : template pre-rempli (clients actifs, R/F, SIREN, cabinet)
- Bouton "Importer Excel" : parse fichier rempli, matching par SIREN, upsert en BDD
- Selecteur mois pour choisir la periode d'import

### Chaine complete vers export PL

| Source | Colonne silae_productions | Produit PL | Export PL |
|---|---|---|---|
| Bulletins Silae auto | bulletins | bulletin_salaire | Oui (quantite > 0) |
| Bulletins manuels | bulletins_manuels | bulletin_salaire (fallback) | Oui |
| Bulletins refaits | bulletins_refaits | modification_bulletin | Oui |
| Coffre-fort (reel) | coffre_fort | coffre_fort | Oui |
| Coffre-fort (forfait) | coffre_fort | coffre_fort (2e passe) | Oui |
| Editique (forfait) | editique | publipostage (2e passe) | Oui |
| Temps passe | temps_passe | — | Non (interne) |
| Commentaires | commentaires | — | Non (interne) |

### Securite re-import Silae

Les colonnes manuelles (`bulletins_manuels`, `bulletins_refaits`, `temps_passe`, `commentaires`) ne sont PAS mentionnees dans l'upsert `importSilaeData` → elles sont preservees lors d'un re-import Silae.

### Migration BDD

`014_silae_manuels.sql` : 4 colonnes + liaison `modification_bulletin.colonne_silae = 'bulletins_refaits'`

### Fichiers cles
- `facturationVariableService.js` — SILAE_COLUMN_MAP + fallback bulletins_manuels + sauverDonneesManuelles() + 2e passe forfait
- `facturationManuelleService.js` — exportModeleManuel() + parseManuelExcel() + importManuelData()
- `FacturationGrid.jsx` — grille 12 mois + popover + import/export Excel
- `exportFacturationVariable.js` — filtre quantite 0 (lignes vides exclues)
- `014_silae_manuels.sql` — migration colonnes manuelles

---

## Phase 5 — Dashboard Vue (Honoraires annuels estimes)

**Objectif :** Tableau de bord temps reel pour evaluer les honoraires annuels ajustes — savoir instantanement l'impact d'un gain ou d'une perte de client. Croise les abonnements PL (fixe) avec les donnees Silae reelles (social variable).

**Composant :** `DashboardHonorairesPanel.jsx` (~600 lignes)

### Structure arbre

```
TOTAL HONORAIRES (2 299 128 EUR)
+-- Comptabilite (75.6%)
|   +-- Compta mensuelle (46.1%)
|   +-- Compta ann./sem./trim. (5.5%)
|   +-- QP Bilan mensuel (3.3%)
|   +-- Bilan annuel (20.7%)
+-- Social (17.9%)
|   +-- Social au reel mensuel (Silae cumul + projection)
|   +-- Social au forfait
|   +-- Social ann./sem./trim.
+-- Juridique (1.4%)
+-- Logiciels (2.5%)
+-- Autres (2.5%)
```

### Fonctionnement

1. **Calcul synchrone** (useMemo) : classifie chaque ligne d'abonnement PL via `classifierLigne()`, annualise via `getCoeffAnnualisation()`, route vers la bonne categorie
2. **Calcul async** (useEffect) : charge les periodes Silae, appelle `genererFacturationVariable()` par periode, calcule cumul reel + projection (dernierMois x moisRestants)
3. **Fusion PL + Silae** : pour les clients avec Silae, remplace `social_abo` par `social_reel` (vraies quantites bulletins). Clients sans Silae gardent le montant PL en fallback (`socialAboResiduel`)
4. **Interactivite** : clic sur branche = filtre tableau detail, recherche client, export Excel

### Corrections sync apportees

| Correction | Fichier | Description |
|---|---|---|
| Sync SIREN | `syncPreview.js` (commitSync) | `customer.reg_no` de PL persiste dans `clients.siren` a chaque sync |
| Nettoyage orphelins | `HonorairesPage.jsx` (handleSync) | Supprime auto les abonnements locaux dont le PL ID n'existe plus (39 orphelins nettoyes) |

### Donnees qualite identifiees et resolues

| Client | Probleme | Resolution |
|---|---|---|
| SAINT JAMES / RELAIS CHRISTINE | Silae sous "SNC CHRISTINE" (entite parente) | Compte via socialAboResiduel |
| SEVENTEASE | Client parti | Passe en inactif |
| RC ARTOIS / AUREL INVESTISSEMENTS | SIREN manquant dans PL | Ajoute par user + sync SIREN fix |
| MIA CONCEPT PARIS | 0 bulletins Silae | Normal, compte via socialAboResiduel |

### Fichiers cles
- `DashboardHonorairesPanel.jsx` — composant principal dashboard
- `HonorairesPage.jsx` — integration + nettoyage orphelins dans handleSync
- `syncPreview.js` — sync SIREN dans commitSync
- `classificationAxes.js` — classification des lignes en 8 axes
- `facturationVariableService.js` — donnees Silae pour social au reel

---

## Tests

| Module | Tests | Fichier |
|--------|-------|---------|
| Augmentation | 71 | calculsAugmentation.test.js |
| Tarifs reference | 19 | tarifsReferenceService.test.js |
| Classification axes | 46 | classificationAxes.test.js |
| Restructuration (logique) | 12 | subscriptionRestructuration.test.js |
| Restructuration (export) | 32 | exportRestructuration.test.js |
| Facturation variable | 59 | facturationVariable.test.js |
| Facturation manuelle | 22 | facturationManuelle.test.js |
| Sync honoraires | 35 | syncHonoraires.test.js |
| Sync preview | 47 | syncPreview.test.js |
| Reconciliation | 21 | reconciliation.test.js |
| **Total module honoraires** | **364** | |
| **Total projet** | **558** | |

---

## Anomalies connues

- **BHG GESTION** : client Zerah Fiduciaire cree dans le cabinet Audit Up — a voir avec collaboratrice
- **CalendarPage** : warning "Maximum update depth exceeded" pre-existant (non lie aux honoraires)
- **15 clients inactifs** : exclus de l'export restructuration (VP BATI, VEGI LA FLAMME, PFA ASSOCIES, MELSAJE, GP BATIGNOLLES, GOODPIZZE, GD GESTION, BARY, KAFEGILO)
- **SNC CHRISTINE** : regroupe SAINT JAMES + RELAIS CHRISTINE dans Silae — pas de detail par etablissement. Resolution : saisie manuelle via popover ou import Excel (Phase 3b)

## Lecons apprises

### Flux sync Pennylane
- Le bouton "Synchroniser Pennylane" utilise `previewSync()` → modal → `commitSync()` (dans syncPreview.js)
- `syncCustomersAndSubscriptions()` dans syncHonoraires.js est un LEGACY non appele par l'UI
- Toute modification de la logique sync doit aller dans `syncPreview.js`

### HMR Vite
- Les modules utilitaires (non-composants React) ne sont PAS toujours recharges par HMR
- Apres modification d'un fichier utils (syncPreview.js, etc.), **hard refresh (Ctrl+F5) obligatoire**
- Les composants React (.jsx) sont generalement recharges correctement par HMR

### Abonnements orphelins
- Quand un abo est supprime/remplace dans PL (nouvel ID), l'ancien reste en BDD locale
- La sync ne supprimait PAS les orphelins → comptage en double dans les totaux
- Fix : nettoyage auto dans `handleSync()` AVANT l'affichage du modal (pas dans commitSync qui necessite confirmation)
