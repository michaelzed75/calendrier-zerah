# Mode operatoire : Nettoyage Pennylane 2025 → 2026

## Objectif

Nettoyer les donnees Pennylane pour la transition vers les tarifs 2026 :
- Supprimer les brouillons de factures obsoletes (issus d'abonnements variables)
- Mettre a jour les prix des brouillons restants au tarif 2026
- Supprimer les abonnements recurrents contenant des produits variables
- Creer les nouveaux abonnements fixes avec les prix 2026

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
- `listCustomerInvoices(apiKey, { status, date_from, date_to })` — liste les factures
- `deleteDraftInvoice(apiKey, invoiceId)` — supprime un brouillon
- `updateDraftInvoice(apiKey, invoiceId, data)` — met a jour un brouillon
- `deleteSubscription(apiKey, subscriptionId)` — supprime un abonnement
- `createSubscription(apiKey, data)` — cree un abonnement

## Operations (dans l'ordre)

### Operation 1 : Supprimer les brouillons inutiles Janvier 2026

**Pourquoi :** Les abonnements qui contenaient uniquement des produits variables
(bulletins, accessoires social) ont genere des brouillons automatiques en janvier.
Ces brouillons sont inutiles car les produits variables sont desormais factures
via l'import Excel mensuel.

**Procedure :**
1. Lister tous les brouillons (`GET /customer_invoices`, status=draft, date Jan 2026)
2. Croiser avec l'analyse de restructuration :
   - Abonnements decision `a_supprimer` = 100% variable → brouillon inutile
3. Afficher la liste des brouillons a supprimer (client, montant, raison)
4. Confirmer puis supprimer un par un (`DELETE /customer_invoices/{id}`)

### Operation 2 : Mettre a jour les brouillons au tarif 2026

**Pourquoi :** Certains brouillons restants (issus d'abonnements fixes) ont ete
generes avec les anciens prix 2025. Il faut les mettre a jour au tarif 2026.

**Procedure :**
1. Lister les brouillons restants (apres Op 1)
2. Comparer les prix des lignes avec `tarifs_reference` date_effet 2026-01-01
3. Identifier les ecarts (ancien prix ≠ nouveau prix)
4. Afficher les modifications a faire (client, produit, ancien prix → nouveau prix)
5. Confirmer puis mettre a jour (`PUT /customer_invoices/{id}`)

### Operation 3 : Supprimer les abonnements recurrents non-fixes

**Pourquoi :** Les abonnements qui contenaient des produits variables doivent etre
supprimes de Pennylane. Les produits fixes seront recrees dans de nouveaux abonnements.

**Procedure :**
1. Utiliser l'analyse de restructuration (`analyserTousLesClients`)
2. Identifier les abonnements :
   - Decision `a_supprimer` : supprimer l'abonnement entier
   - Decision `a_modifier` : supprimer (on recree ensuite avec les lignes fixes seules)
3. Afficher la liste (client, abonnement, nb lignes, montant HT)
4. Confirmer puis supprimer (`DELETE /billing_subscriptions/{id}`)

### Operation 4 : Creer les nouveaux abonnements fixes prix 2026

**Pourquoi :** Pour les clients dont l'abonnement a ete supprime (Op 3),
il faut recreer un abonnement ne contenant que les lignes fixes au tarif 2026.

**Procedure :**
1. Construire les payloads a partir de l'analyse de restructuration :
   - Lignes fixes uniquement, prix 2026 (`tarifs_reference`)
   - Copier les parametres de l'ancien abonnement (frequence, paiement, etc.)
2. Afficher les abonnements a creer (client, nb lignes, total HT/mois)
3. Confirmer puis creer (`POST /billing_subscriptions`)

## Verification post-nettoyage

1. **Reconciliation BDD ↔ PL** : onglet Reconciliation dans Honoraires
   - Verifier que les totaux HT correspondent
   - Verifier qu'il n'y a pas d'anomalies

2. **Verifier dans Pennylane** :
   - Les brouillons inutiles ont bien disparu
   - Les brouillons restants sont au tarif 2026
   - Les abonnements ne contiennent que des produits fixes
   - Les nouveaux abonnements sont en statut `in_progress`

## Notes importantes

- **TOUJOURS analyser avant d'executer** — chaque operation a une phase de preview
- **JAMAIS de suppression sans confirmation** — l'utilisateur valide chaque liste
- Les operations sont irreversibles (pas de "undo" dans l'API Pennylane)
- Rate limiting : pause de 200ms entre chaque appel write, retry sur 429
- Ce nettoyage est fait **une seule fois** pour la transition 2025 → 2026
