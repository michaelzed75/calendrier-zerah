# Honoraires 2026 — Progression

## Vue d'ensemble

| Phase | Description | Statut |
|-------|-------------|--------|
| Phase 1 | Augmentation tarifs 2026 (+2.5%) | Terminee |
| Phase 2 | Restructuration abonnements PL | En cours (Op 4b restante) |
| Phase 3 | Facturation variable mensuelle | Terminee |
| Nettoyage PL | Transition 2025 → 2026 | En cours (import restant) |

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
| Op 4b | Importer nouveaux abos fixes 2026 | A faire | Export pret (Import PL AUP + Import PL ZF) |

### Verification post-nettoyage (a faire apres Op 4b)
- Sync Pennylane depuis l'app
- Reconciliation BDD ↔ PL (onglet Reconciliation)
- Verifier totaux HT
- Supprimer cles API write de .env

### Infrastructure API write
- `pennylane-proxy.js` : support GET/POST/PUT/DELETE/PATCH + 204 No Content
- `pennylaneCustomersApi.js` : callPennylaneWriteAPI + 5 fonctions (list/delete/update invoices, delete/create subscriptions)

### Notes
- L'API PL ne supporte PAS la modification de prix d'abonnements existants
- Les abonnements crees via Facturation > Abonnements ne peuvent pas etre modifies en masse
- Strategie : supprimer + recreer via import Excel
- Scripts nettoyage dans `scripts/nettoyage-pl/` (jetables, non commites)

---

## Tests

| Module | Tests | Fichier |
|--------|-------|---------|
| Augmentation | 71 | calculsAugmentation.test.js |
| Tarifs reference | 19 | tarifsReferenceService.test.js |
| Classification axes | 46 | classificationAxes.test.js |
| Restructuration (logique) | 12 | subscriptionRestructuration.test.js |
| Restructuration (export) | 24 | exportRestructuration.test.js |
| Facturation variable | 59 | facturationVariable.test.js |
| Sync honoraires | 35 | syncHonoraires.test.js |
| Sync preview | 47 | syncPreview.test.js |
| Reconciliation | 21 | reconciliation.test.js |
| **Total module honoraires** | **334** | |
| **Total projet** | **528** | |

---

## Anomalies connues

- **BHG GESTION** : client Zerah Fiduciaire cree dans le cabinet Audit Up — a voir avec collaboratrice
- **CalendarPage** : warning "Maximum update depth exceeded" pre-existant (non lie aux honoraires)
- **15 clients inactifs** : exclus de l'export restructuration (VP BATI, VEGI LA FLAMME, PFA ASSOCIES, MELSAJE, GP BATIGNOLLES, GOODPIZZE, GD GESTION, BARY, KAFEGILO)
