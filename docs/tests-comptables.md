# Module Tests Comptables

## Vue d'ensemble

Le module Tests Comptables permet d'exécuter des contrôles automatisés sur les données comptables des clients via l'API Pennylane. Les résultats sont sauvegardés en base de données et peuvent être exportés en Excel.

## Tests disponibles

### 1. Doublons fournisseurs

**Code:** `doublons_fournisseurs`

**Objectif:** Détecter les comptes fournisseurs (401xxx) qui pourraient être des doublons.

**Fonctionnement:**
- Récupère tous les comptes 401 depuis le plan comptable Pennylane
- Compare les libellés avec un algorithme de similarité (Dice coefficient)
- Alerte si deux comptes ont un libellé similaire à plus de 70%

**Exemple d'anomalie:**
- `401DARTY` et `401100059 DARTY GRAND EST` → Similarité 85%

---

### 2. Relevé fournisseurs

**Code:** `double_saisie`

**Objectif:** Gérer les fournisseurs qui envoient des relevés mensuels et détecter les risques de double saisie.

**Concept "Au relevé":**
Certains fournisseurs envoient un relevé mensuel récapitulatif. Dans ce cas, le cabinet ne doit saisir qu'UNE seule facture par mois (le relevé). Si plusieurs factures sont saisies, c'est probablement une double saisie.

**Fonctionnement:**

#### Pour les fournisseurs marqués "Au relevé":
1. **Doublon relevé:** Alerte si 2+ factures sur le même mois (ne devrait y avoir qu'un relevé)
2. **Relevé manquant:** Alerte si aucune facture le mois précédent (relevé non reçu?)

#### Pour les autres fournisseurs:
1. **Doublon classique:** Alerte si une facture récente a un montant supérieur à une facture plus ancienne dans les 31 derniers jours (possible cumul avec relevé)

**Interface utilisateur:**
- Checkbox "Au relevé" pour marquer chaque fournisseur
- Le marquage est persisté en base de données (table `fournisseurs_releve`)
- Les fournisseurs avec alertes sont affichés en premier
- Boutons cliquables pour voir les PDFs des factures concernées

**Types d'alertes:**
| Type | Couleur | Description |
|------|---------|-------------|
| `doublon_releve` | Rouge | 2+ factures sur le même mois pour un fournisseur au relevé |
| `releve_manquant` | Orange | Pas de facture le mois précédent pour un fournisseur au relevé |
| `doublon_classique` | Jaune | Montant croissant entre 2 factures proches (fournisseur normal) |

---

### 3. Attestation achats fournisseurs

**Code:** `attestation_achats`

**Objectif:** Générer une attestation officielle des achats HT répartis par fournisseur et par catégorie (Boissons, Food), avec export Word au format AUDIT UP.

**Fonctionnement:**
- Récupère les écritures FEC filtrées par comptes d'achats (défaut: 60701, 60702)
- Utilise `getFECByAccounts()` pour filtrer côté API par `ledger_account_id` (performant)
- Regroupe les achats par fournisseur ET par catégorie
- Calcule le montant HT net (Débit - Crédit) par fournisseur
- Génère un tableau récapitulatif avec sous-totaux par catégorie

**Catégories par défaut:**
| Compte | Catégorie |
|--------|-----------|
| 60701  | Boissons  |
| 60702  | Food      |
| Autres | Autres    |

**Options:**
- `comptesAchats`: Préfixes de comptes à analyser (défaut: `['60701', '60702']`)

**Exports disponibles:**
1. **Excel "Données analysées"** (vert) : 3 feuilles
   - Résumé : statistiques globales
   - Attestation : récapitulatif par fournisseur (nom, nb écritures, débit, crédit, HT)
   - Vérification FEC : détail de chaque écriture (JournalCode, CompteNum, Produits, Débit, Crédit, Solde)

2. **Attestation Word** (bleu) : document .docx officiel
   - En-tête AUDIT UP
   - Coordonnées client (nom, adresse, CP+ville - stockés en localStorage)
   - Date en français
   - Tableau par catégorie avec sous-totaux et total général
   - Signature M MICHAEL ZERAH, EXPERT-COMPTABLE
   - **Sélection fournisseurs** : cochez/décochez les fournisseurs à inclure dans le document

3. **Export anomalies** (gris) : anomalies détectées (fournisseurs à montant négatif)

**Interface utilisateur:**
- Champ "Comptes d'achats à analyser" (modifiable, défaut: 60701, 60702)
- Champs adresse pour l'attestation Word (nom société, adresse, CP+ville)
- Tableau récapitulatif avec checkboxes par fournisseur
- Boutons "Tout cocher" / "Tout décocher" pour la sélection
- Compteur fournisseurs sélectionnés

---

## Architecture technique

### Fichiers principaux

```
src/utils/testsComptables/
├── index.js                 # Point d'entrée, exports
├── testRunner.js            # Orchestrateur d'exécution des tests
├── pennylaneClientApi.js    # Client API Pennylane (via proxy)
├── exportResults.js         # Export Excel des résultats
└── tests/
    ├── doublonsFournisseurs.js   # Test doublons comptes 401
    ├── doubleSaisie.js           # Test relevé fournisseurs
    ├── doubleSaisie.test.js      # Tests unitaires (14 tests)
    └── attestationAchats.js     # Attestation achats fournisseurs + export Word
```

### Tables Supabase

#### `tests_comptables_executions`
Historique des exécutions de tests.

| Colonne | Type | Description |
|---------|------|-------------|
| id | SERIAL | Identifiant unique |
| client_id | INTEGER | Référence au client |
| test_code | VARCHAR | Code du test exécuté |
| millesime | INTEGER | Année fiscale testée |
| statut | VARCHAR | 'en_cours', 'termine', 'erreur' |
| nombre_anomalies | INTEGER | Nombre d'anomalies détectées |
| duree_ms | INTEGER | Durée d'exécution en ms |
| donnees_analysees | JSONB | Statistiques du test |
| date_execution | TIMESTAMP | Date/heure d'exécution |
| execute_par | INTEGER | Référence au collaborateur |

#### `tests_comptables_resultats`
Détail des anomalies détectées.

| Colonne | Type | Description |
|---------|------|-------------|
| id | SERIAL | Identifiant unique |
| execution_id | INTEGER | Référence à l'exécution |
| type_anomalie | VARCHAR | Type de l'anomalie |
| severite | VARCHAR | 'critical', 'error', 'warning', 'info' |
| donnees | JSONB | Données spécifiques à l'anomalie |
| commentaire | TEXT | Description lisible |

#### `fournisseurs_releve`
Fournisseurs marqués "au relevé" par client.

| Colonne | Type | Description |
|---------|------|-------------|
| id | SERIAL | Identifiant unique |
| client_id | INTEGER | Référence au client |
| supplier_id | VARCHAR | ID Pennylane du fournisseur |
| supplier_name | VARCHAR | Nom du fournisseur (cache) |
| created_at | TIMESTAMP | Date de création |
| created_by | INTEGER | Collaborateur ayant marqué |

---

## Utilisation

### Prérequis
1. Le client doit avoir une clé API Pennylane configurée
2. L'utilisateur doit être connecté et avoir accès au client

### Exécuter un test
1. Aller dans l'onglet "Tests"
2. Sélectionner un client (avec l'icône ✓ = API configurée)
3. Choisir le millésime (année fiscale)
4. Sélectionner le test souhaité
5. Cliquer sur "Lancer"

### Marquer un fournisseur "Au relevé"
1. Exécuter le test "Relevé fournisseurs"
2. Dans la liste des fournisseurs, cocher la case "Au relevé"
3. Le marquage est sauvegardé automatiquement
4. Relancer le test pour voir les alertes spécifiques

### Exporter les résultats
- **Export données analysées:** Liste complète des éléments vérifiés
- **Export anomalies:** Uniquement les anomalies détectées
- **Export historique:** Toutes les exécutions passées

---

## API Pennylane

### Endpoints utilisés
- `GET /ledger_accounts` - Plan comptable
- `GET /supplier_invoices` - Factures fournisseurs
- `GET /me` - Test de connexion
- `GET /ledger_entry_lines` - Lignes d'écritures comptables (FEC) — filtrage par ledger_account_id et date
- `GET /ledger_entries` - En-têtes d'écritures (labels, pièces)
- `GET /journals` - Journaux comptables

### Proxy
Les appels passent par `/api/pennylane-proxy` (fonction serverless Vercel) pour éviter les problèmes CORS.

---

## Tests unitaires

Le fichier `doubleSaisie.test.js` contient 14 tests couvrant:
- Métadonnées du test
- Détection doublons classiques
- Détection doublons relevé
- Extraction du nom fournisseur
- Statistiques des données analysées
- Filtrage des factures invalides

Exécution: `npm test`
