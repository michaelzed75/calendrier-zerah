# API Pennylane v2 — Guide de référence

## Vue d'ensemble

L'application utilise l'API Pennylane v2 (https://app.pennylane.com/api/external/v2) pour récupérer les données comptables des clients. Tous les appels passent par un proxy serverless Vercel (`/api/pennylane-proxy`) pour contourner les restrictions CORS.

## Authentification

- **Header:** `X-Pennylane-Api-Key: <clé_api_client>`
- Chaque client a sa propre clé API stockée en BDD (`clients.pennylane_client_api_key`)
- Test de connexion : `GET /me`

## Proxy API

```
Client React → /api/pennylane-proxy?endpoint=/ledger_accounts&per_page=100
                    ↓
Fonction serverless Vercel → https://app.pennylane.com/api/external/v2/ledger_accounts?per_page=100
```

Le proxy transfère le header `X-Pennylane-Api-Key` et tous les query params.

## Endpoints utilisés

### GET /me
- **Usage:** Test de connexion
- **Pagination:** Aucune
- **Retour:** Informations sur l'utilisateur authentifié

### GET /ledger_accounts
- **Usage:** Plan comptable (liste des comptes)
- **Pagination:** Par pages (`page=X`, `total_pages` dans la réponse)
- **Retour:** `{ items: [{id, number, label}], total_pages, current_page }`
- **Particularité:** Un même numéro de compte peut avoir PLUSIEURS IDs (ex: 60701 avec taux TVA différents)
- **Formats numéros:** L'API retourne les numéros courts (ex: `60701`), Pennylane UI montre les longs (ex: `607010000`)

### GET /ledger_entry_lines
- **Usage:** Lignes d'écritures comptables (FEC)
- **Pagination:** Par curseur (`has_more`, `next_cursor`)
- **per_page:** Maximum réel = 20 (même si on demande 100, l'API retourne max 20)
- **Filtres autorisés:** `id`, `date`, `journal_id`, `ledger_account_id`
- **Format filtre:** `filter=[{"field":"date","operator":"gteq","value":"2025-01-01"},...]`
- **Retour:** `{ items: [{id, date, debit, credit, ledger_account: {id, number}, ledger_entry: {id}, journal: {id}, label}], has_more, next_cursor }`
- **Important:** Les champs `debit` et `credit` sont des strings (ex: `"1234.56"`), à convertir avec `parseFloat()`

### GET /ledger_entries
- **Usage:** En-têtes d'écritures (enrichissement avec label fournisseur, n° pièce)
- **Pagination:** Par curseur (`has_more`, `next_cursor`)
- **Filtres autorisés:** `date`
- **Retour:** `{ items: [{id, label, piece_number, journal_id, date}], has_more, next_cursor }`
- **Label:** Contient souvent le nom du fournisseur au format : `"Facture FOURNISSEUR - 202504031 (label généré)"`

### GET /journals
- **Usage:** Journaux comptables (codes et libellés)
- **Pagination:** Par pages (`page=X`, `total_pages`)
- **Retour:** `{ items: [{id, code, label}], total_pages }`

### GET /supplier_invoices
- **Usage:** Factures fournisseurs
- **Pagination:** Par curseur
- **Filtres:** `date`
- **Retour:** Factures avec montant, date, fournisseur, URL PDF

### GET /customer_invoices
- **Usage:** Factures clients
- **Pagination:** Par curseur
- **Filtres:** `date`

### GET /suppliers
- **Usage:** Liste des fournisseurs
- **Pagination:** Par curseur

### GET /bank_transactions
- **Usage:** Opérations bancaires
- **Pagination:** Par curseur
- **Filtres:** `date`

## Pagination

L'API utilise deux systèmes de pagination selon les endpoints :

### Pagination par curseur (ledger_entry_lines, ledger_entries, supplier_invoices)
```json
{
  "items": [...],
  "has_more": true,
  "next_cursor": "abc123..."
}
```
- Passer `cursor=abc123...` à la requête suivante
- Continuer tant que `has_more === true`

### Pagination par pages (ledger_accounts, journals)
```json
{
  "items": [...],
  "total_pages": 5,
  "current_page": 1
}
```
- Passer `page=2`, `page=3`, etc.

### Fonction utilitaire : `getAllPaginated()`
La fonction `getAllPaginated()` dans `pennylaneClientApi.js` détecte automatiquement le type de pagination et gère les deux cas. Elle déduplique aussi par `id` (l'API peut retourner des doublons entre pages).

## Rate Limiting

- L'API retourne **HTTP 429** en cas de trop de requêtes
- **Gestion:** `callPennylaneAPI()` retente automatiquement jusqu'à 3 fois avec backoff exponentiel (1s, 2s, 4s)
- **Entre les pages:** Pause de 150ms (`sleep(150)`) entre chaque appel paginé

## Filtres

Format des filtres : tableau JSON d'objets `{field, operator, value}` passé en query param `filter`.

### Opérateurs disponibles
| Opérateur | Description |
|-----------|-------------|
| `eq`      | Égal        |
| `gteq`    | ≥           |
| `lteq`    | ≤           |

### Exemple : filtrer par date et compte
```javascript
const filter = JSON.stringify([
  { field: 'date', operator: 'gteq', value: '2025-01-01' },
  { field: 'date', operator: 'lteq', value: '2025-12-31' },
  { field: 'ledger_account_id', operator: 'eq', value: 12345 }
]);
```

## Stratégie de récupération des données FEC

### `getFEC()` — FEC complet
1. Récupère les référentiels (journals, ledger_accounts)
2. Récupère TOUTES les lignes d'écritures pour la période (filtre date uniquement)
3. Récupère les en-têtes d'écritures (labels fournisseurs, pièces)
4. Mappe vers le format FEC standard

### `getFECByAccounts()` — FEC filtré par comptes (optimisé)
1. Récupère les référentiels
2. Identifie les IDs de comptes qui matchent les préfixes demandés (matching bidirectionnel)
3. Pour chaque ID de compte, récupère les lignes via filtre `ledger_account_id`
4. Récupère les en-têtes d'écritures
5. Mappe vers le format FEC standard

**Performance:** `getFECByAccounts()` est beaucoup plus rapide car elle ne récupère que les lignes des comptes ciblés au lieu de tout le FEC.

## Extraction du nom fournisseur

L'API ne fournit pas directement le nom du fournisseur de manière propre. L'extraction suit cette priorité :

1. **CompAuxLib** (label du compte auxiliaire) — source la plus fiable
2. **EcritureLib** / Label écriture parente — nettoyage en multi-étapes :
   - Suppression de `(label généré)` en fin
   - Suppression du préfixe `Facture` / `Avoir`
   - Suppression du numéro après le dernier ` - `
   - Suppression de `n° XXXX`
   - Suppression des dates `MM/YYYY`
   - Suppression des numéros Pennylane `F1234567`
3. **CompAuxNum** (numéro compte auxiliaire) — dernier recours

## Matching numéros de comptes

Le matching entre les préfixes utilisateur et les comptes API est **bidirectionnel** :
- `60701` (API) matche le préfixe `607` (utilisateur)
- `607` (API) matche le préfixe `60701` (utilisateur)

Cela gère les cas où l'API retourne des numéros courts et l'utilisateur entre des numéros longs ou inversement.

```javascript
const matches = comptePrefixes.some(prefix =>
  accNum.startsWith(prefix) || prefix.startsWith(accNum)
);
```

## Pièges connus

1. **per_page max = 20** pour `/ledger_entry_lines` : même si on demande `per_page=100`, l'API ne retourne que 20 éléments. Il faut paginer avec les curseurs.

2. **Numéros de comptes multiples IDs** : Un numéro de compte (ex: `60701`) peut avoir plusieurs IDs dans le plan comptable (un par taux de TVA). Il faut récupérer les lignes pour CHAQUE ID.

3. **Debit/Credit en strings** : Les montants sont retournés comme strings (`"1234.56"`), il faut les convertir avec `parseFloat()`.

4. **Labels avec bruit** : Les labels d'écritures contiennent souvent `(label généré)`, des numéros de facture, des dates — nécessitent un nettoyage multi-étapes.

5. **Rate limiting agressif** : L'API renvoie des 429 facilement, surtout quand on fait beaucoup d'appels paginés. Les pauses de 150ms entre pages et le retry avec backoff sont essentiels.

6. **Pas de filtre par numéro de compte** : On ne peut filtrer que par `ledger_account_id` (l'ID interne), pas par le numéro de compte. Il faut d'abord récupérer le plan comptable, trouver les IDs qui matchent, puis filtrer.

7. **Import Sage 2025 — écritures aplaties** : Certains clients (ex: Goodbeer) ont eu leurs données 2025 importées depuis Sage. Lors de cet import, les écritures ont été "aplaties" : les lignes d'achats (6071/6072) ne sont PAS liées à un compte auxiliaire 401 dans la même écriture comptable. Conséquence : `CompAuxNum` est vide et `CompAuxLib` ne contient pas le nom du fournisseur → le nom est extrait de `EcritureLib` (ex: "OBD n° VTE20250153143") mais le nettoyage est imparfait.
   - **Workaround 2025** : Pour retrouver le vrai fournisseur, on cherche dans les lignes FEC du même exercice une écriture 401xxx avec le **même libellé** (`EcritureLib`). Le `CompAuxLib` de cette ligne 401 donne le nom fiable du fournisseur.
   - **2026+** : Ce problème ne se posera plus car les écritures sont natives Pennylane avec des liens 401 corrects dans chaque écriture.
   - **Détection** : Si les lignes d'achats n'ont pas de `CompAuxNum` commençant par 401, on est dans le cas Sage importé → activer le workaround par libellé.
