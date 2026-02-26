# Mode operatoire : Nettoyage Pennylane 2025 → 2026

## Objectif

Nettoyer les donnees Pennylane pour la transition vers les tarifs 2026 :
- Supprimer les brouillons de factures obsoletes (issus d'abonnements variables)
- Mettre a jour les prix des brouillons restants au tarif 2026
- Supprimer les abonnements recurrents contenant des produits variables
- Recreer les abonnements fixes avec les prix 2026 via import Excel

## Pre-requis

- Phase 1 (augmentation tarifs) terminee — tarifs 2025 + 2026 en BDD
- Phase 2 (restructuration) analysee — decisions `a_supprimer`, `a_modifier`, `inchange`
- Cles API Pennylane avec **droits d'ecriture** (POST/PUT/DELETE)
- Proxy etendu pour supporter PUT/DELETE/PATCH

## Infrastructure technique

### Proxy API (`api/pennylane-proxy.js`)
- Supporte GET, POST, PUT, DELETE, PATCH
- Gere le 204 No Content pour les DELETE

### Fonctions API write (`pennylaneCustomersApi.js`)
- `callPennylaneWriteAPI(method, endpoint, body, params)` — appel generique avec retry 429
- `listCustomerInvoices(apiKey, { status, date_from, date_to })` — liste les factures
- `deleteDraftInvoice(apiKey, invoiceId)` — supprime un brouillon
- `updateDraftInvoice(apiKey, invoiceId, data)` — met a jour un brouillon
- `deleteSubscription(apiKey, subscriptionId)` — supprime un abonnement
- `createSubscription(apiKey, data)` — cree un abonnement

## Operations (dans l'ordre)

### Operation 1 : Supprimer les brouillons inutiles Janvier 2026

**Pourquoi :** Les abonnements 100% variables (bulletins, accessoires social) ont genere
des brouillons automatiques en janvier. Ces brouillons sont inutiles car les produits
variables sont desormais factures via l'import Excel mensuel.

**Execution (26/02/2026) :**
- Script `batch-op1-op2.js` avec flag --execute
- 42 abonnements identifies comme 100% variable (axes: social_bulletin, accessoires_social)
- **40 brouillons supprimes** (2 abos sans brouillon)
- 0 erreurs

### Operation 2 : Mettre a jour les brouillons au tarif 2026

**Pourquoi :** Les brouillons restants (issus d'abonnements fixes) ont ete generes
avec les anciens prix 2025. Il faut les mettre a jour au tarif 2026.

**Execution (26/02/2026) :**
- Meme script `batch-op1-op2.js`, Op2 enchainee apres Op1
- Comparaison prix lignes vs tarifs_reference date_effet 2026-01-01
- **72 lignes mises a jour** (prix differents)
- 14 lignes inchangees (prix identiques)
- 0 erreurs
- Format PUT : `{ invoice_lines: { update: [{ id, raw_currency_unit_price: "string" }] } }`

### Operation 3 : Supprimer les abonnements recurrents variables

**Pourquoi :** Les abonnements qui contenaient des produits variables doivent etre
retires de Pennylane.

**Execution (26/02/2026) :**
- **42 abonnements supprimes manuellement dans PL** (39 AUP + 3 ZF)
- L'API PL ne supporte pas DELETE /billing_subscriptions
- Suppression manuelle dans Facturation > Abonnements > Stopper

### Operation 4a : Supprimer les abonnements fixes existants

**Pourquoi :** L'API PL ne permet pas de modifier les prix des abonnements existants.
Il faut les supprimer et les recreer via import Excel avec les prix 2026.

**Execution (26/02/2026) :**
- **235 abonnements supprimes manuellement dans PL** (146 AUP + 89 ZF)
- Verification : compare-suppression-vs-import.js confirme 235 suppressions = 235 recreations

### Operation 4b : Importer les nouveaux abonnements fixes prix 2026

**Statut : A FAIRE**

**Procedure :**
1. Aller dans Honoraires > Restructuration > Analyser tous les clients
2. Exporter le fichier Excel (5 onglets dont Import PL AUP + Import PL ZF)
3. Verifier les prix dans les onglets Import PL
4. Importer dans PL : onglet AUP dans cabinet Audit Up, onglet ZF dans Zerah Fiduciaire
5. Faire une sync Pennylane pour mettre a jour la BDD locale

**Attendu : 220 abonnements** (235 - 15 clients desactives)

## Verification post-nettoyage

1. **Sync PL** : lancer la synchronisation depuis l'app
2. **Reconciliation BDD ↔ PL** : onglet Reconciliation dans Honoraires
   - Verifier que les totaux HT correspondent
   - Verifier qu'il n'y a pas d'anomalies
3. **Verifier dans Pennylane** :
   - Les brouillons inutiles ont bien disparu
   - Les brouillons restants sont au tarif 2026
   - Les abonnements ne contiennent que des produits fixes
   - Les nouveaux abonnements sont en statut `not_started`
4. **Supprimer les cles API write** de .env (PL_WRITE_KEY_AUP, PL_WRITE_KEY_ZF)

## Notes importantes

- **L'API PL ne supporte PAS** la modification de prix d'abonnements existants
- **L'API PL ne supporte PAS** la suppression d'abonnements (billing_subscriptions)
- Les operations manuelles (Op 3, 4a) ont ete faites dans l'UI Pennylane
- Les operations automatisees (Op 1, 2) utilisent le proxy + fonctions API write
- Rate limiting : pause 200ms entre appels, retry exponentiel sur 429
- Ce nettoyage est fait **une seule fois** pour la transition 2025 → 2026
