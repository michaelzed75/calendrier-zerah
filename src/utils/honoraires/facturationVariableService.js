// @ts-check

/**
 * @file Service de facturation variable mensuelle (Phase 3)
 *
 * Génère les données de facturation mensuelle des produits VARIABLES
 * en combinant :
 *   - tarifs_reference (prix unitaires HT 2026)
 *   - silae_productions (quantités mensuelles automatiques)
 *   - produits_pennylane (mapping colonne_silae → produit)
 *
 * Le fichier produit :
 *   - Pour chaque client : lignes de produits avec quantités et montants
 *   - Les quantités Silae sont pré-remplies automatiquement
 *   - Les produits sans colonne_silae (ex: modification de bulletin) restent vides (saisie manuelle)
 */

/**
 * Mapping colonne_silae → clé dans silae_productions
 * Utilisé pour extraire la quantité automatique de chaque produit
 */
const SILAE_COLUMN_MAP = {
  bulletins: 'bulletins',
  coffre_fort: 'coffre_fort',
  editique: 'editique',
  entrees: 'entrees',
  sorties: 'sorties',
  declarations: 'declarations',
  attestations_pe: 'attestations_pe'
};

/**
 * Ordre d'affichage des produits variables dans l'export
 */
const PRODUCT_ORDER = [
  'bulletin_salaire',
  'bulletin_logiciel',
  'coffre_fort',
  'publipostage',
  'entree_salarie',
  'sortie_salarie',
  'modification_bulletin',
  'entree_sortie_extra',
  'vacation_extra'
];

/**
 * @typedef {Object} LigneFacturation
 * @property {string} label - Dénomination du produit Pennylane
 * @property {string} label_normalise - Label normalisé (bulletin_salaire, coffre_fort, etc.)
 * @property {string} pennylane_product_id - UUID du produit dans Pennylane
 * @property {string} denomination - Dénomination complète du produit PL (pour import)
 * @property {number} pu_ht - Prix unitaire HT (tarif 2026)
 * @property {number} pu_ttc - Prix unitaire TTC (pu_ht × 1.2)
 * @property {number|null} quantite - Quantité (null = saisie manuelle)
 * @property {number|null} montant_ht - Montant HT = pu_ht × quantite (null si quantite manuelle)
 * @property {string|null} colonne_silae - Nom de la colonne Silae source (null = manuel)
 * @property {string} source - 'silae' | 'manuel'
 * @property {string} tva_code - Code TVA Pennylane (ex: 'FR_200')
 * @property {number} tva_rate - Taux TVA (0.20)
 */

/**
 * @typedef {Object} ClientFacturation
 * @property {number} client_id
 * @property {string} client_nom
 * @property {string} cabinet
 * @property {string} siren
 * @property {string} pennylane_customer_id
 * @property {LigneFacturation[]} lignes
 * @property {number} total_ht_auto - Total HT des lignes automatiques (Silae)
 * @property {number} total_ht_estimable - Total HT estimable (auto + lignes manuelles non remplies = 0)
 * @property {boolean} has_silae - true si des données Silae existent pour cette période
 * @property {boolean} complet - true si toutes les lignes ont une quantité (pas de manuelle en attente)
 */

/**
 * @typedef {Object} ResultatFacturation
 * @property {string} periode - Format 'YYYY-MM'
 * @property {string} date_effet - Date des tarifs utilisés
 * @property {string} cabinet_filtre - Cabinet filtré ou 'tous'
 * @property {ClientFacturation[]} clients
 * @property {Object} stats
 * @property {number} stats.nb_clients - Nombre de clients avec produits variables
 * @property {number} stats.nb_avec_silae - Clients avec données Silae
 * @property {number} stats.nb_sans_silae - Clients sans données Silae
 * @property {number} stats.nb_complets - Clients avec toutes les quantités remplies
 * @property {number} stats.total_ht_auto - Total HT estimable (auto Silae)
 */

/**
 * Génère la facturation variable mensuelle pour tous les clients.
 *
 * @param {Object} params
 * @param {Object} params.supabase - Client Supabase
 * @param {string} params.periode - Période au format 'YYYY-MM' (ex: '2026-01')
 * @param {string} params.dateEffet - Date des tarifs (ex: '2026-01-01')
 * @param {string} [params.cabinet] - Filtre cabinet optionnel
 * @param {Function} [params.onProgress] - Callback de progression
 * @returns {Promise<ResultatFacturation>}
 */
export async function genererFacturationVariable({ supabase, periode, dateEffet, cabinet, onProgress }) {
  const progress = onProgress || (() => {});

  // 1. Charger les produits Pennylane (mapping colonne_silae)
  progress('Chargement des produits Pennylane...');
  const produits = await chargerProduitsPennylane(supabase, cabinet);

  // 2. Charger les tarifs variables pour la date_effet
  progress('Chargement des tarifs variables 2026...');
  const tarifs = await chargerTarifsVariables(supabase, dateEffet, cabinet);

  // 3. Charger les productions Silae pour la période
  progress('Chargement des données Silae...');
  const silaeData = await chargerSilae(supabase, periode);

  // 4. Charger les clients (pour les infos PL)
  progress('Chargement des clients...');
  const clients = await chargerClients(supabase, cabinet);

  // 5. Grouper les tarifs par client
  const tarifsByClient = new Map();
  for (const t of tarifs) {
    if (!tarifsByClient.has(t.client_id)) {
      tarifsByClient.set(t.client_id, []);
    }
    tarifsByClient.get(t.client_id).push(t);
  }

  // 6. Indexer les produits par label_normalise + cabinet
  const produitsByLabel = new Map();
  for (const p of produits) {
    const key = `${p.label_normalise}_${p.cabinet}`;
    produitsByLabel.set(key, p);
  }

  // 7. Indexer Silae par client_id
  const silaeByClient = new Map();
  for (const s of silaeData) {
    silaeByClient.set(s.client_id, s);
  }

  // 8. Indexer clients par id
  const clientsById = new Map();
  for (const c of clients) {
    clientsById.set(c.id, c);
  }

  // 9. Construire la facturation pour chaque client
  progress('Calcul de la facturation...');
  const resultats = [];

  for (const [clientId, clientTarifs] of tarifsByClient) {
    const client = clientsById.get(clientId);
    if (!client) continue;

    const silae = silaeByClient.get(clientId) || null;
    const hasSilae = silae !== null;

    // Trier les tarifs selon l'ordre des produits
    const tarifsTriees = trierTarifs(clientTarifs, produitsByLabel, client.cabinet);

    const lignes = [];
    let totalHtAuto = 0;

    for (const tarif of tarifsTriees) {
      // Trouver le produit PL correspondant
      const produit = trouverProduit(tarif, produitsByLabel, client.cabinet);
      const colonneSilae = produit?.colonne_silae || null;

      // Déterminer la quantité
      let quantite = null;
      let source = 'manuel';

      if (colonneSilae && SILAE_COLUMN_MAP[colonneSilae] && hasSilae) {
        const silaeKey = SILAE_COLUMN_MAP[colonneSilae];
        const val = silae[silaeKey];
        if (val !== null && val !== undefined) {
          quantite = val;
          source = 'silae';
        }
      }

      const puHt = tarif.pu_ht;
      const tvaRate = tarif.tva_rate || 0.20;
      const puTtc = Math.round(puHt * (1 + tvaRate) * 100) / 100;
      const montantHt = quantite !== null ? Math.round(puHt * quantite * 100) / 100 : null;

      if (source === 'silae' && montantHt !== null) {
        totalHtAuto += montantHt;
      }

      lignes.push({
        label: tarif.label,
        label_normalise: produit?.label_normalise || '',
        pennylane_product_id: produit?.pennylane_product_id || '',
        denomination: produit?.denomination || tarif.label,
        pu_ht: puHt,
        pu_ttc: puTtc,
        quantite,
        montant_ht: montantHt,
        colonne_silae: colonneSilae,
        source,
        tva_code: tvaRate === 0.20 ? 'FR_200' : `FR_${Math.round(tvaRate * 1000)}`,
        tva_rate: tvaRate
      });
    }

    // Filtrer : ne garder que les clients qui ont au moins une ligne
    if (lignes.length === 0) continue;

    const complet = lignes.every(l => l.quantite !== null);
    const totalEstimable = lignes.reduce((sum, l) => sum + (l.montant_ht || 0), 0);

    resultats.push({
      client_id: clientId,
      client_nom: client.nom,
      cabinet: client.cabinet,
      siren: client.siren || '',
      pennylane_customer_id: client.pennylane_customer_id || '',
      lignes,
      total_ht_auto: Math.round(totalHtAuto * 100) / 100,
      total_ht_estimable: Math.round(totalEstimable * 100) / 100,
      has_silae: hasSilae,
      complet
    });
  }

  // Trier par cabinet puis par nom
  resultats.sort((a, b) => {
    if (a.cabinet !== b.cabinet) return a.cabinet.localeCompare(b.cabinet, 'fr');
    return a.client_nom.localeCompare(b.client_nom, 'fr');
  });

  // 10. Statistiques
  const stats = {
    nb_clients: resultats.length,
    nb_avec_silae: resultats.filter(c => c.has_silae).length,
    nb_sans_silae: resultats.filter(c => !c.has_silae).length,
    nb_complets: resultats.filter(c => c.complet).length,
    total_ht_auto: Math.round(resultats.reduce((s, c) => s + c.total_ht_auto, 0) * 100) / 100
  };

  progress('Terminé !');

  return {
    periode,
    date_effet: dateEffet,
    cabinet_filtre: cabinet || 'tous',
    clients: resultats,
    stats
  };
}

/**
 * Génère la facturation pour UN SEUL client (pour le panneau de test).
 *
 * @param {Object} params
 * @param {Object} params.supabase
 * @param {number} params.clientId
 * @param {string} params.periode
 * @param {string} params.dateEffet
 * @returns {Promise<ClientFacturation|null>}
 */
export async function genererFacturationClient({ supabase, clientId, periode, dateEffet }) {
  // Client
  const { data: client } = await supabase
    .from('clients')
    .select('id, nom, cabinet, siren, pennylane_customer_id')
    .eq('id', clientId)
    .single();

  if (!client) return null;

  // Tarifs variables
  const { data: tarifs } = await supabase
    .from('tarifs_reference')
    .select('*')
    .eq('client_id', clientId)
    .eq('type_recurrence', 'variable')
    .eq('date_effet', dateEffet);

  if (!tarifs || tarifs.length === 0) return null;

  // Produits PL
  const { data: produits } = await supabase
    .from('produits_pennylane')
    .select('*')
    .eq('cabinet', client.cabinet)
    .eq('type_recurrence', 'variable');

  // Silae
  const { data: silaeRows } = await supabase
    .from('silae_productions')
    .select('*')
    .eq('client_id', clientId)
    .eq('periode', periode);

  const silae = silaeRows && silaeRows.length > 0 ? silaeRows[0] : null;
  const hasSilae = silae !== null;

  // Indexer produits
  const produitsByLabel = new Map();
  for (const p of (produits || [])) {
    const key = `${p.label_normalise}_${p.cabinet}`;
    produitsByLabel.set(key, p);
  }

  // Trier et construire les lignes
  const tarifsTriees = trierTarifs(tarifs, produitsByLabel, client.cabinet);
  const lignes = [];
  let totalHtAuto = 0;

  for (const tarif of tarifsTriees) {
    const produit = trouverProduit(tarif, produitsByLabel, client.cabinet);
    const colonneSilae = produit?.colonne_silae || null;

    let quantite = null;
    let source = 'manuel';

    if (colonneSilae && SILAE_COLUMN_MAP[colonneSilae] && hasSilae) {
      const silaeKey = SILAE_COLUMN_MAP[colonneSilae];
      const val = silae[silaeKey];
      if (val !== null && val !== undefined) {
        quantite = val;
        source = 'silae';
      }
    }

    const puHt = tarif.pu_ht;
    const tvaRate = tarif.tva_rate || 0.20;
    const puTtc = Math.round(puHt * (1 + tvaRate) * 100) / 100;
    const montantHt = quantite !== null ? Math.round(puHt * quantite * 100) / 100 : null;

    if (source === 'silae' && montantHt !== null) {
      totalHtAuto += montantHt;
    }

    lignes.push({
      label: tarif.label,
      label_normalise: produit?.label_normalise || '',
      pennylane_product_id: produit?.pennylane_product_id || '',
      denomination: produit?.denomination || tarif.label,
      pu_ht: puHt,
      pu_ttc: puTtc,
      quantite,
      montant_ht: montantHt,
      colonne_silae: colonneSilae,
      source,
      tva_code: tvaRate === 0.20 ? 'FR_200' : `FR_${Math.round(tvaRate * 1000)}`,
      tva_rate: tvaRate
    });
  }

  if (lignes.length === 0) return null;

  const complet = lignes.every(l => l.quantite !== null);
  const totalEstimable = lignes.reduce((sum, l) => sum + (l.montant_ht || 0), 0);

  return {
    client_id: clientId,
    client_nom: client.nom,
    cabinet: client.cabinet,
    siren: client.siren || '',
    pennylane_customer_id: client.pennylane_customer_id || '',
    lignes,
    total_ht_auto: Math.round(totalHtAuto * 100) / 100,
    total_ht_estimable: Math.round(totalEstimable * 100) / 100,
    has_silae: hasSilae,
    complet
  };
}

// ─────────────────────── Helpers privés ───────────────────────

/**
 * Charge les produits Pennylane variables
 */
async function chargerProduitsPennylane(supabase, cabinet) {
  let query = supabase
    .from('produits_pennylane')
    .select('*')
    .eq('type_recurrence', 'variable')
    .eq('actif', true);

  if (cabinet) {
    query = query.eq('cabinet', cabinet);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Erreur chargement produits: ${error.message}`);
  return data || [];
}

/**
 * Charge les tarifs variables pour une date_effet
 */
async function chargerTarifsVariables(supabase, dateEffet, cabinet) {
  let query = supabase
    .from('tarifs_reference')
    .select('*')
    .eq('type_recurrence', 'variable')
    .eq('date_effet', dateEffet);

  if (cabinet) {
    query = query.eq('cabinet', cabinet);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Erreur chargement tarifs variables: ${error.message}`);
  return data || [];
}

/**
 * Charge les productions Silae pour une période
 */
async function chargerSilae(supabase, periode) {
  const { data, error } = await supabase
    .from('silae_productions')
    .select('*')
    .eq('periode', periode);

  if (error) throw new Error(`Erreur chargement Silae: ${error.message}`);
  return data || [];
}

/**
 * Charge les clients avec infos PL
 */
async function chargerClients(supabase, cabinet) {
  let query = supabase
    .from('clients')
    .select('id, nom, cabinet, siren, pennylane_customer_id')
    .eq('actif', true);

  if (cabinet) {
    query = query.eq('cabinet', cabinet);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Erreur chargement clients: ${error.message}`);
  return data || [];
}

/**
 * Trouve le produit PL correspondant à un tarif
 * Matching par label_normalise du tarif → label_normalise du produit PL
 */
function trouverProduit(tarif, produitsByLabel, cabinet) {
  // Essai 1 : par produit_pennylane_id si disponible
  if (tarif.produit_pennylane_id) {
    for (const [, p] of produitsByLabel) {
      if (p.id === tarif.produit_pennylane_id) return p;
    }
  }

  // Essai 2 : par label normalisé
  // Normaliser le label du tarif pour matcher le label_normalise du produit
  const labelNorm = normaliserLabelTarif(tarif.label);
  const key = `${labelNorm}_${cabinet}`;
  if (produitsByLabel.has(key)) {
    return produitsByLabel.get(key);
  }

  // Essai 3 : matching par sous-chaîne du label
  const labelLower = tarif.label.toLowerCase();
  for (const [, p] of produitsByLabel) {
    if (p.cabinet !== cabinet) continue;
    if (matchLabel(labelLower, p.label_normalise)) return p;
  }

  return null;
}

/**
 * Normalise un label de tarif pour matcher un label_normalise de produit PL
 */
function normaliserLabelTarif(label) {
  const l = label.toLowerCase();
  if (l.includes('bulletin') && l.includes('salaire') && !l.includes('modif') && !l.includes('coffre')) {
    if (l.includes('logiciel') || l.includes('mise à disposition')) return 'bulletin_logiciel';
    return 'bulletin_salaire';
  }
  if (l.includes('coffre') && l.includes('fort')) return 'coffre_fort';
  if (l.includes('publi') || l.includes('éditique') || l.includes('editique')) return 'publipostage';
  if (l.includes('sortie') && l.includes('salarié')) return 'sortie_salarie';
  if (l.includes('entrée') && l.includes('salarié')) return 'entree_salarie';
  if (l.includes('modif') && l.includes('bulletin')) return 'modification_bulletin';
  if (l.includes('extra') && (l.includes('entrée') || l.includes('sortie'))) return 'entree_sortie_extra';
  if (l.includes('vacation') && l.includes('extra')) return 'vacation_extra';
  return '';
}

/**
 * Match un label de tarif (lowercase) avec un label_normalise de produit
 */
function matchLabel(labelLower, labelNormalise) {
  switch (labelNormalise) {
    case 'bulletin_salaire':
      return labelLower.includes('bulletin') && labelLower.includes('salaire')
        && !labelLower.includes('modif') && !labelLower.includes('coffre') && !labelLower.includes('logiciel');
    case 'bulletin_logiciel':
      return labelLower.includes('bulletin') && labelLower.includes('logiciel');
    case 'coffre_fort':
      return labelLower.includes('coffre') && labelLower.includes('fort');
    case 'publipostage':
      return labelLower.includes('publi') || labelLower.includes('éditique') || labelLower.includes('editique');
    case 'entree_salarie':
      return labelLower.includes('entrée') && labelLower.includes('salarié') && !labelLower.includes('extra');
    case 'sortie_salarie':
      return labelLower.includes('sortie') && labelLower.includes('salarié') && !labelLower.includes('extra');
    case 'modification_bulletin':
      return labelLower.includes('modif') && labelLower.includes('bulletin');
    case 'entree_sortie_extra':
      return labelLower.includes('extra') && (labelLower.includes('entrée') || labelLower.includes('sortie'));
    case 'vacation_extra':
      return labelLower.includes('vacation') && labelLower.includes('extra');
    default:
      return false;
  }
}

/**
 * Trie les tarifs selon l'ordre de PRODUCT_ORDER
 */
function trierTarifs(tarifs, produitsByLabel, cabinet) {
  return [...tarifs].sort((a, b) => {
    const pA = trouverProduit(a, produitsByLabel, cabinet);
    const pB = trouverProduit(b, produitsByLabel, cabinet);
    const idxA = pA ? PRODUCT_ORDER.indexOf(pA.label_normalise) : 99;
    const idxB = pB ? PRODUCT_ORDER.indexOf(pB.label_normalise) : 99;
    return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
  });
}

/**
 * Retourne les périodes Silae disponibles.
 */
export async function getPeriodesDisponibles(supabase) {
  const { data, error } = await supabase
    .from('silae_productions')
    .select('periode')
    .order('periode', { ascending: false });

  if (error) throw new Error(`Erreur récupération périodes: ${error.message}`);

  const periodes = [...new Set((data || []).map(d => d.periode))];
  return periodes;
}

/**
 * Retourne les dates d'effet disponibles pour les tarifs variables.
 */
export async function getDatesEffetVariables(supabase) {
  const { data, error } = await supabase
    .from('tarifs_reference')
    .select('date_effet')
    .eq('type_recurrence', 'variable');

  if (error) throw new Error(`Erreur récupération dates: ${error.message}`);

  const dates = [...new Set((data || []).map(d => d.date_effet))].sort().reverse();
  return dates;
}

// ═══════════════════════════ Sync produits PL ═══════════════════════════

/**
 * Synchronise les produits depuis l'API Pennylane vers la table produits_pennylane.
 * Met à jour la denomination et le label si modifiés côté PL.
 * Ajoute les nouveaux produits (non archivés) sans écraser le colonne_silae local.
 *
 * @param {Object} params
 * @param {Object} params.supabase - Client Supabase
 * @param {string} params.cabinet - Nom du cabinet
 * @param {Object[]} params.plProducts - Produits retournés par l'API PL (/products)
 * @returns {Promise<{updated: number, created: number, total: number}>}
 */
export async function syncProduitsPennylane({ supabase, cabinet, plProducts }) {
  if (!plProducts || plProducts.length === 0) return { updated: 0, created: 0, total: 0 };

  // Charger les produits existants en base pour ce cabinet
  const { data: existing } = await supabase
    .from('produits_pennylane')
    .select('id, pennylane_product_id, denomination, label_normalise')
    .eq('cabinet', cabinet);

  const existingByRef = new Map();
  for (const p of (existing || [])) {
    existingByRef.set(p.pennylane_product_id, p);
  }

  let updated = 0;
  let created = 0;

  for (const plProd of plProducts) {
    // Ignorer les produits archivés
    if (plProd.archived_at) continue;

    const extRef = plProd.external_reference;
    if (!extRef) continue; // Pas d'external_reference = on ne peut pas matcher

    const localProd = existingByRef.get(extRef);

    if (localProd) {
      // Produit existant → mettre à jour la denomination si changée
      if (localProd.denomination !== plProd.label) {
        await supabase
          .from('produits_pennylane')
          .update({ denomination: plProd.label })
          .eq('id', localProd.id);
        updated++;
      }
    } else {
      // Nouveau produit → insérer (sans colonne_silae, à configurer manuellement)
      const { error } = await supabase
        .from('produits_pennylane')
        .insert({
          cabinet,
          pennylane_product_id: extRef,
          denomination: plProd.label,
          label_normalise: plProd.label.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 50),
          type_recurrence: 'ponctuel', // Par défaut ponctuel, à reconfigurer si variable
          tva_rate: plProd.vat_rate === 'FR_200' ? 0.20 : 0.10,
          actif: true
        });
      if (!error) created++;
    }
  }

  return { updated, created, total: plProducts.length };
}
