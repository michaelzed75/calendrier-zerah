# Persistance de l'état UI

Mis en place le 09/07/2026. Objectif : ne plus perdre les filtres, onglets et saisies en cours quand on change de page ou qu'on rafraîchit le navigateur.

## Problème d'origine

L'application n'a pas de routeur : la navigation est un état `currentPage` dans `App.jsx`. Chaque page n'était rendue que si elle était active :

```jsx
{currentPage === 'clients' && <ClientsPage ... />}
```

En quittant une page, React la démontait — tous ses `useState` (filtres, onglets, recherches…) repartaient de zéro au retour.

## Solution — 2 mécanismes complémentaires

### 1. Keep-alive des pages (`App.jsx`)

Les pages visitées restent montées et sont simplement cachées en `display:none` :

- `renderPage(name, element)` — monte une page à sa première visite, puis la cache quand une autre est active. Ses états sont donc conservés pendant toute la session.
- `visitedPages` — liste des pages déjà visitées (montage paresseux : rien n'est monté avant la première visite).
- `isPageAllowed(page)` — centralise les droits d'accès (`impots` : chef ou admin ; `tva`, `temps-reels` : chef ; `honoraires`, `salaires` : admin).
- `activePage` — page réellement affichée ; retombe sur `calendar` si la page persistée n'est pas autorisée pour l'utilisateur connecté. Le surlignage des boutons de navigation suit `activePage`.

Effet de bord assumé : les pages cachées restent montées, leurs effets et intervalles continuent de tourner (ex. rafraîchissement des temps réels du calendrier).

### 2. Hook `usePersistedState` (`src/hooks/usePersistedState.js`)

Remplaçant de `useState` qui sauvegarde la valeur en `localStorage` (JSON) et la restaure au montage suivant — survit au F5 et à la fermeture du navigateur.

```jsx
const [filterCabinet, setFilterCabinet] = usePersistedState('clients_filterCabinet', 'tous');
```

- Convention de clés : `<page>_<etat>` (ex. `clients_filterCabinet`, `honoraires_activeTab`).
- Ne pas utiliser pour des valeurs non sérialisables en JSON (`Date`, `Set`, `Map`).
- Testé dans `src/hooks/usePersistedState.test.js`.

## États persistés (survivent au F5)

| Page | États |
|------|-------|
| App | `app_currentPage` (page courante) |
| Tâches | `taches_filtreCollab` |
| Clients | `clients_filterCabinet`, `clients_filterChef`, `clients_sortField`, `clients_sortDirection`, `clients_searchTerm` |
| Honoraires | `honoraires_activeTab`, `honoraires_filterCabinet`, `honoraires_filterStatus`, `honoraires_reconSearch` |
| Impôts et Taxes | `impotsTaxes_anneeFiscale`, `impotsTaxes_filtreChefMission`, `impotsTaxes_recherche` (+ `impotsTaxes_tri`, préexistant) |
| Temps Réels | `tempsReels_activeTab`, `tempsReels_filtrePeriode`, `tempsReels_sortEcarts`, `tempsReels_searchEcarts` |
| Salaires | `salaires_activeTab`, `salaires_filterAnnee`, `salaires_showInactifs`, `salaires_searchTerm` |
| Tests Comptables | `testsComptables_selectedMillesime` (+ `testsComptables_selectedClientId`, préexistant) |

## Cas particuliers

- **CalendarPage** : non modifiée — elle a son propre système `userPreferences` en localStorage (restaure `selectedCollaborateurs` / `expandedEquipes`, force `viewMode='month'` au montage). Ne pas y introduire `usePersistedState` sans démonter ce mécanisme.
- **Champs de recherche des listes principales** : persistés depuis le 09/07/2026 (demande utilisateur — la recherche client se perdait en quittant le site). Les modales et formulaires non validés restent volontairement non persistés après F5 (mais conservés au changement de page grâce au keep-alive).
- **Réconciliation honoraires** : `reconData` reste en `sessionStorage` (données volumineuses, durée de vie session voulue).

## Ajouter un nouvel état persistant

Remplacer `useState` par `usePersistedState('<page>_<nom>', valeurParDefaut)` — une ligne, rien d'autre à faire.
