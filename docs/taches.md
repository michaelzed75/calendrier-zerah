# Onglet Tâches — délégation par email

> Dernière mise à jour : juillet 2026. Fonctionnalité complète en production (création par email, kanban, notifications, digest hebdomadaire).

## Vue d'ensemble

Permet de déléguer une tâche à un collaborateur **sans ouvrir le site** : on écrit un mail au collègue et on met `taches@inbox.zerah.fr` en **Cc**. La tâche apparaît dans son onglet « Tâches ». Le suivi (échéances, relances, notifications au demandeur) est automatique.

```
Email (Cc taches@inbox.zerah.fr)
   → Brevo Inbound Parsing (MX inbox.zerah.fr)
   → POST /api/inbound-task?token=…   (webhook, id Brevo 2063192)
   → parseInboundEmail() → INSERT table taches
   → visible dans TachesPage (kanban)
```

## Règles de création par email

| Élément du mail | Devient |
|---|---|
| Objet | Titre de la tâche |
| Date `JJ/MM/AA` ou `JJ/MM/AAAA` dans l'objet (séparateurs `/ . -`) | `date_echeance` (retirée du titre) |
| `[URGENT]` ou `!` dans l'objet | `priorite = urgente` (retiré du titre) |
| Corps du mail | `detail` |
| Nom d'un client connu dans objet+corps | `client_id` (match le plus long, insensible casse/accents, min 4 caractères) |
| Destinataires To+Cc (hors adresse dédiée) | 1 tâche **par** collaborateur matché sur `collaborateurs.email` (actifs uniquement) |

**Garde-fou** : l'expéditeur (`From`) doit être un collaborateur connu et actif, sinon rejet (`unknown_sender`). Assignation **ouverte** : n'importe quel collaborateur peut assigner à n'importe quel autre (peer-to-peer).

**Idempotence** : unicité `(email_message_id, collaborateur_id)` (migration 019) — les renvois de webhook Brevo ne créent pas de doublons, et un même mail multi-destinataires crée bien N tâches.

## Modèle de données — table `taches` (migrations 018 + 019)

- `collaborateur_id` (destinataire), `client_id` (nullable), `titre`, `detail`
- `statut` : `a_faire` | `faite` (l'UI traite tout ≠ `faite` comme « À faire » ; `planifiee` est un statut legacy)
- `priorite` : `normale` | `urgente`
- **Une seule date métier** : `date_echeance` (décision : pas de « date de réalisation » séparée)
- `source` : `email` | `manuel` ; `email_message_id`, `email_from` (traçabilité)
- `created_by` (le demandeur), `date_faite`, `relance_non_planifiee_le`

## UI — `TachesPage.jsx` (~800 lignes)

- **Kanban 2 colonnes** : À faire / Fait. Tri : urgentes d'abord, puis échéance croissante (sans date en dernier).
- **Carte compacte 2 lignes** :
  - L1 : drapeau urgent (cliquable, bascule la priorité) · titre (clic → modale détail) · coche verte « Fait » (ou ↺ Rouvrir)
  - L2 : badge société **cyan** cliquable (ou « SOCIÉTÉ » en pointillé si non reconnue) → `ClientPicker` avec recherche · `DateChip` échéance cliquable (rouge=retard, orange=proche ≤2j) · source (✉ email / ✎ manuel + prénom du demandeur) · **pastille d'initiales** du destinataire → menu de réaffectation
- **Réaffectation** : clic pastille → liste des collègues du périmètre → update `collaborateur_id` + notification mail au nouveau destinataire.
- **Vue patron** : sélecteur « Mes tâches / Toute l'équipe / par collaborateur ». Périmètre via `getVisibleCollaborateurIds` : collab = lui seul, chef = lui + équipe (`getEquipeOf`), admin = tous. Le filtre est **persisté** (`usePersistedState('taches_filtreCollab')`).
- **Création manuelle** : modale (titre, détail, assigné, client, date, urgente).
- Drag & drop natif entre colonnes (déposer dans « Fait » clôture).

## Module `src/utils/taches/`

| Fichier | Rôle |
|---|---|
| `tachesInbound.js` | Parsing email → tâche(s) : `parseInboundEmail`, `parseSubject`, `detectClient`, `matchCollaborateurByEmail` — pur, testé (32 tests) |
| `tachesStatus.js` | Classification : `classifyTache` → `en_retard` / `echeance_proche` (≤2j) / `non_planifiee` / `a_jour` ; `diffJours`, `tachesASignaler` (13 tests) |
| `tachesService.js` | CRUD Supabase : `getTaches`, `createTache`, `marquerFaite`, `updateTache`, `deleteTache`, `getVisibleCollaborateurIds` |

## Endpoints serverless (Vercel)

| Endpoint | Rôle |
|---|---|
| `api/inbound-task.js` | Webhook Brevo Inbound (POST, `?token=INBOUND_TASK_TOKEN`). Parse les items Brevo, filtre doublons, insère. Répond toujours 200 (évite les renvois en boucle). |
| `api/notify-task.js` | Notifications au demandeur : `tache_faite`, `date_modifiee`, `tache_reassignee`, `tache_supprimee` (si non faite et supprimée par un autre). Jamais de mail si on agit sur sa propre tâche. |
| `api/relance-taches.js` | **Digest hebdo** (lundi 10h Paris via `.github/workflows/relance-taches.yml`). Design épuré « iOS » (carte blanche, sections colorées, accent gauche). Testable : `GET ?onlyEmail=xxx@zerah.fr`. |

### Sections du digest (1 mail par personne, seulement si contenu)

1. **En retard** (rouge) — échéance dépassée
2. **À venir ≤ 2 jours** (orange)
3. **Sans date — à planifier** (gris)
4. **Tâches que vous avez confiées (à suivre)** (violet) — toutes les tâches **créées par moi** pour un autre, non faites, avec destinataire + échéance. Basé sur `created_by`, **indépendant de l'équipe** (Sophie ne voit que ce qu'elle a envoyé).
5. **Équipe — en retard** (chefs/admin) — exclut mes propres délégations (déjà en 4)

## Infrastructure email (voir aussi mémoire `taches-feature.md`)

- **Envoi** : API Brevo (`BREVO_API_KEY` en var Vercel), expéditeur `michael@zerah.fr`. ⚠️ La restriction « IP autorisées » Brevo doit rester **désactivée** (IPs Vercel dynamiques).
- **Réception** : sous-domaine `inbox.zerah.fr` (DNS chez **IONOS**) : MX → `inbound1/2.sendinblue.com`, TXT brevo-code, 2 CNAME DKIM, TXT DMARC. Domaine authentifié dans Brevo + webhook Inbound → `/api/inbound-task`.
- **Auth Supabase** (reset mot de passe, invitations) : Custom SMTP branché sur Brevo (`smtp-relay.brevo.com:587`, user `9f4822001@smtp-brevo.com`), rate limit 50/h. Un « mot de passe oublié » ne marche que si le **compte auth existe** (sinon aucune erreur ni mail).
- Vars Vercel : `BREVO_API_KEY`, `INBOUND_TASK_TOKEN` (+ `TASK_INBOX_ADDRESS` optionnel, défaut `taches@inbox.zerah.fr`).
- Plan Brevo **gratuit : 300 mails/jour** — à surveiller.
- L'ancien rappel hebdo « planifier la charge » (`send-reminder.yml`) a été **supprimé** ; l'endpoint `api/send-reminder.js` et le bouton manuel (CollaborateursPage) restent.

## Tests

`tachesInbound.test.js` (32) + `tachesStatus.test.js` (13) = 45 tests dédiés. Lancer : `npx vitest run src/utils/taches`.

## Pistes évoquées non réalisées

- Fiabiliser le cron du lundi (fenêtre horaire GitHub Actions parfois ratée)
- Badge « nouvelles tâches » sur le menu
- Détection client plus tolérante (ignorer SARL/SAS)
- Report des tâches sur le calendrier (Étape C, jamais faite)
- Carnet de bord / événements par dossier client (CRM léger, couches 1-3 discutées)
