// @ts-check
import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, AlertCircle, ChevronDown, ChevronUp, ChevronRight, Download, Search, TrendingUp, BarChart3, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../supabaseClient';
import {
  classifierLigne,
  detectModeFacturationSocial,
  getCoeffAnnualisation,
  getSilaePeriodes,
  genererFacturationVariable,
  getDatesEffetVariables
} from '../../utils/honoraires';

// ─── Structure de l'arbre ────────────────────────────────────────────────────

/**
 * Arbre hiérarchique des catégories d'honoraires.
 * Les branches avec `children` sont dépliables.
 * `childKeys` liste les clés enfant pour calculer le cumul parent.
 */
const TREE = [
  {
    key: 'compta', label: 'Comptabilité', color: 'blue', expandable: true,
    childKeys: ['compta_mensuelle', 'compta_periodique', 'qp_bilan_mensuel', 'bilan_annuel'],
    children: [
      { key: 'compta_mensuelle', label: 'Compta mensuelle', color: 'blue' },
      { key: 'compta_periodique', label: 'Compta ann./sem./trim.', color: 'cyan' },
      { key: 'qp_bilan_mensuel', label: 'QP Bilan mensuel', color: 'indigo' },
      { key: 'bilan_annuel', label: 'Bilan annuel', color: 'violet' },
    ],
  },
  {
    key: 'social', label: 'Social', color: 'green', expandable: true,
    childKeys: ['social_reel', 'social_forfait', 'social_periodique'],
    children: [
      { key: 'social_reel', label: 'Social au réel mensuel', color: 'emerald', async: true },
      { key: 'social_forfait', label: 'Social au forfait', color: 'green' },
      { key: 'social_periodique', label: 'Social ann./sem./trim.', color: 'teal' },
    ],
  },
  { key: 'juridique', label: 'Juridique', color: 'purple' },
  { key: 'logiciels', label: 'Logiciels', color: 'amber' },
  { key: 'autres', label: 'Autres', color: 'slate' },
];

/** Toutes les clés feuille (pour le filtre et le tableau) */
const ALL_LEAF_KEYS = TREE.flatMap(b => b.children ? b.children.map(c => c.key) : [b.key]);

/** Lookup rapide clé → définition (feuille ou branche) */
const LEAF_MAP = {};
for (const branch of TREE) {
  if (branch.children) {
    for (const child of branch.children) LEAF_MAP[child.key] = child;
  } else {
    LEAF_MAP[branch.key] = branch;
  }
}

// ─── Classes Tailwind par couleur ────────────────────────────────────────────

const COLOR_CLASSES = {
  blue:    { bg: 'bg-blue-900/30',    border: 'border-blue-800',    left: 'border-l-blue-500' },
  cyan:    { bg: 'bg-cyan-900/30',    border: 'border-cyan-800',    left: 'border-l-cyan-500' },
  indigo:  { bg: 'bg-indigo-900/30',  border: 'border-indigo-800',  left: 'border-l-indigo-500' },
  violet:  { bg: 'bg-violet-900/30',  border: 'border-violet-800',  left: 'border-l-violet-500' },
  green:   { bg: 'bg-green-900/30',   border: 'border-green-800',   left: 'border-l-green-500' },
  teal:    { bg: 'bg-teal-900/30',    border: 'border-teal-800',    left: 'border-l-teal-500' },
  emerald: { bg: 'bg-emerald-900/30', border: 'border-emerald-800', left: 'border-l-emerald-500' },
  amber:   { bg: 'bg-amber-900/30',   border: 'border-amber-800',   left: 'border-l-amber-500' },
  purple:  { bg: 'bg-purple-900/30',  border: 'border-purple-800',  left: 'border-l-purple-500' },
  slate:   { bg: 'bg-slate-700',      border: 'border-slate-600',   left: 'border-l-slate-400' },
  sky:     { bg: 'bg-sky-900/30',     border: 'border-sky-800',     left: 'border-l-sky-500' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n) => n !== null && n !== undefined
  ? Math.round(n).toLocaleString('fr-FR') + ' €'
  : '...';

const fmtPct = (n) => n !== null && n !== undefined && n > 0
  ? n.toFixed(1) + '%'
  : '';

/**
 * Route une ligne d'abonnement vers sa catégorie feuille.
 */
function getCategorieFromAxe(axe, frequence, intervalle) {
  const isMonthly = frequence === 'monthly' && (intervalle || 1) === 1;

  if (axe === 'compta_mensuelle') return isMonthly ? 'compta_mensuelle' : 'compta_periodique';
  if (axe === 'bilan') return frequence === 'monthly' ? 'qp_bilan_mensuel' : 'bilan_annuel';
  if (axe === 'social_forfait') return isMonthly ? 'social_forfait' : 'social_periodique';
  if (axe === 'social_bulletin' || axe === 'accessoires_social') return 'social_abo'; // corroboration uniquement
  if (axe === 'support') return 'logiciels';
  if (axe === 'juridique') return 'juridique';
  return 'autres';
}

const fmtFreq = (freq, inter) => {
  if (freq === 'yearly') return inter > 1 ? `${inter} ans` : 'Annuel';
  if (inter === 1) return 'Mensuel';
  if (inter === 3) return 'Trimestriel';
  if (inter === 6) return 'Semestriel';
  return `${inter} mois`;
};

// ─── Composant principal ─────────────────────────────────────────────────────

export default function DashboardHonorairesPanel({ honoraires, clients, filterCabinet, filterStatus, loading }) {
  // ── État local ──────────────────────────────────────────────────────────────
  const [expandedBranches, setExpandedBranches] = useState({ compta: true, social: true });
  const [activeFilter, setActiveFilter] = useState(null); // clé feuille ou branche
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedClient, setExpandedClient] = useState(null);
  const [socialReel, setSocialReel] = useState({
    loading: true, total: null, periodes: [], dernierMois: null,
    cumulReel: 0, projection: 0, detail: [], error: null,
    clientsDetail: [], // détail par client depuis Silae (lignes du dernier mois connu)
  });

  // ── Calcul synchrone : catégories depuis abonnements ────────────────────────

  const dashboardData = useMemo(() => {
    const clientsActifsSet = new Set(clients.filter(c => c.actif).map(c => c.id));

    const categories = {
      compta_mensuelle: 0, compta_periodique: 0,
      qp_bilan_mensuel: 0, bilan_annuel: 0,
      social_forfait: 0, social_periodique: 0, social_abo: 0,
      logiciels: 0, juridique: 0, autres: 0,
    };

    const parCabinet = {
      'Audit Up': { ...categories },
      'Zerah Fiduciaire': { ...categories },
    };

    const lignesDetail = [];
    const clientsVus = new Set();

    const filtered = honoraires.filter(h => {
      if (!clientsActifsSet.has(h.client_id)) return false;
      if (filterStatus !== 'tous' && h.status !== filterStatus) return false;
      if (filterCabinet !== 'tous' && h.clients?.cabinet !== filterCabinet) return false;
      return true;
    });

    for (const abo of filtered) {
      const coeff = getCoeffAnnualisation(abo.frequence, abo.intervalle);
      const modeSocial = detectModeFacturationSocial(abo.abonnements_lignes || []);
      const cabinet = abo.clients?.cabinet || '-';
      clientsVus.add(abo.client_id);

      for (const ligne of (abo.abonnements_lignes || [])) {
        const axe = classifierLigne(ligne, modeSocial);
        const montantAnnuel = (ligne.montant_ht || 0) * coeff;
        const categorie = getCategorieFromAxe(axe, abo.frequence, abo.intervalle || 1);

        categories[categorie] += montantAnnuel;
        if (parCabinet[cabinet]) parCabinet[cabinet][categorie] += montantAnnuel;

        lignesDetail.push({
          client_id: abo.client_id,
          client_nom: abo.clients?.nom || abo.label,
          client_cabinet: cabinet,
          label: ligne.label,
          famille: ligne.famille,
          axe,
          categorie,
          frequence: abo.frequence,
          intervalle: abo.intervalle || 1,
          montant_ht: ligne.montant_ht || 0,
          montant_annuel: montantAnnuel,
          quantite: ligne.quantite || 1,
        });
      }
    }

    return { categories, lignesDetail, parCabinet, nbClients: clientsVus.size };
  }, [honoraires, clients, filterCabinet, filterStatus]);

  // ── Clients sans abonnement ─────────────────────────────────────────────────

  const clientsSansAbonnement = useMemo(() => {
    const avecAbo = new Set(honoraires.map(h => h.client_id));
    let result = clients.filter(c => c.actif && !avecAbo.has(c.id));
    if (filterCabinet !== 'tous') result = result.filter(c => c.cabinet === filterCabinet);
    result.sort((a, b) => a.nom.localeCompare(b.nom));
    return result;
  }, [clients, honoraires, filterCabinet]);

  // ── Lignes "Social au réel" converties depuis le détail Silae ───────────────

  const socialReelLignes = useMemo(() => {
    if (socialReel.loading || socialReel.clientsDetail.length === 0) return [];

    const result = [];
    for (const client of socialReel.clientsDetail) {
      for (const ligne of client.lignes) {
        const montantMois = ligne.montant_ht || 0;
        // Répartition proportionnelle du total annuel client sur chaque ligne
        const ratioLigne = client.dernierMois > 0 ? montantMois / client.dernierMois : 0;
        const montantAnnuel = client.totalAnnuel * ratioLigne;

        result.push({
          client_id: client.client_id,
          client_nom: client.client_nom,
          client_cabinet: client.cabinet,
          label: ligne.denomination || ligne.label,
          famille: 'social',
          axe: 'social_bulletin',
          categorie: 'social_reel',
          frequence: 'monthly',
          intervalle: 1,
          montant_ht: montantMois,
          montant_annuel: montantAnnuel,
          quantite: ligne.quantite || 0,
          pu_ht: ligne.pu_ht || 0,
          source: 'silae',
        });
      }
    }
    return result;
  }, [socialReel]);

  // ── Calcul async : Social au réel (Silae + tarifs_reference) ────────────────

  useEffect(() => {
    let cancelled = false;

    async function loadSocialReel() {
      setSocialReel(prev => ({ ...prev, loading: true, error: null }));
      try {
        const allPeriodes = await getSilaePeriodes(supabase);
        const annee = new Date().getFullYear().toString();
        const periodesAnnee = allPeriodes.filter(p => p.startsWith(annee + '-')).sort();

        if (periodesAnnee.length === 0) {
          if (!cancelled) setSocialReel({ loading: false, total: 0, periodes: [], dernierMois: 0, cumulReel: 0, projection: 0, detail: [], error: null });
          return;
        }

        const datesEffet = await getDatesEffetVariables(supabase);
        if (datesEffet.length === 0) {
          if (!cancelled) setSocialReel({ loading: false, total: 0, periodes: [], dernierMois: 0, cumulReel: 0, projection: 0, detail: [], error: 'Aucun tarif variable configuré' });
          return;
        }
        const dateEffet = datesEffet[0];

        let cumulReel = 0;
        let dernierMoisMontant = 0;
        const detail = [];

        // Agrégation par client : cumul réel + détail du dernier mois
        const clientMap = new Map(); // client_id → { client_nom, cabinet, cumulReel, dernierMois, lignes }

        for (const periode of periodesAnnee) {
          const result = await genererFacturationVariable({
            supabase,
            periode,
            dateEffet,
            cabinet: filterCabinet !== 'tous' ? filterCabinet : undefined,
          });
          const moisTotal = result.stats?.total_ht_auto || 0;
          cumulReel += moisTotal;
          dernierMoisMontant = moisTotal;
          detail.push({ periode, montant: moisTotal, nbClients: result.stats?.nb_avec_silae || 0 });

          // Collecter le détail par client
          for (const client of (result.clients || [])) {
            if (!client.has_silae || client.total_ht_auto === 0) continue;
            if (!clientMap.has(client.client_id)) {
              clientMap.set(client.client_id, {
                client_id: client.client_id,
                client_nom: client.client_nom,
                cabinet: client.cabinet,
                cumulReel: 0,
                dernierMois: 0,
                lignes: [],
              });
            }
            const entry = clientMap.get(client.client_id);
            entry.cumulReel += client.total_ht_auto;
            entry.dernierMois = client.total_ht_auto;
            // Garder les lignes du dernier mois (source silae, quantité > 0)
            entry.lignes = client.lignes.filter(l => l.source === 'silae' && l.quantite > 0);
          }
        }

        const moisRestants = 12 - periodesAnnee.length;
        const projection = dernierMoisMontant * moisRestants;
        const totalAnnuel = cumulReel + projection;

        // Calculer le total annuel par client
        const clientsDetail = [];
        for (const [, entry] of clientMap) {
          entry.totalAnnuel = entry.cumulReel + entry.dernierMois * moisRestants;
          clientsDetail.push(entry);
        }

        if (!cancelled) {
          setSocialReel({
            loading: false, total: totalAnnuel, periodes: periodesAnnee,
            dernierMois: dernierMoisMontant, cumulReel, projection, detail, error: null,
            clientsDetail,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setSocialReel({ loading: false, total: null, periodes: [], dernierMois: null, cumulReel: 0, projection: 0, detail: [], error: err.message });
        }
      }
    }

    loadSocialReel();
    return () => { cancelled = true; };
  }, [filterCabinet]);

  // ── Montants par catégorie (sync + async merge) ─────────────────────────────

  /** Résidu social_abo : montant PL des clients NON couverts par Silae */
  const socialAboResiduel = useMemo(() => {
    if (socialReel.loading || socialReel.clientsDetail.length === 0) {
      return dashboardData.categories.social_abo || 0;
    }
    const silaeClientIds = new Set(socialReel.clientsDetail.map(c => c.client_id));
    return dashboardData.lignesDetail
      .filter(l => l.categorie === 'social_abo' && !silaeClientIds.has(l.client_id))
      .reduce((s, l) => s + l.montant_annuel, 0);
  }, [dashboardData, socialReel]);

  /** Retourne le montant d'une clé feuille */
  const getAmount = (key) => {
    // social_reel = Silae total + résidu PL des clients sans Silae
    if (key === 'social_reel') return socialReel.loading ? null : (socialReel.total + socialAboResiduel);
    return dashboardData.categories[key] ?? 0;
  };

  /** Retourne le cumul d'une branche parent */
  const getBranchTotal = (branch) => {
    if (!branch.childKeys) return getAmount(branch.key);
    let sum = 0;
    for (const k of branch.childKeys) {
      const v = getAmount(k);
      if (v === null) return null; // en cours de chargement
      sum += v;
    }
    return sum;
  };

  // ── Totaux ──────────────────────────────────────────────────────────────────

  const totalAnnuel = useMemo(() => {
    if (socialReel.loading) return null;
    let sum = 0;
    for (const branch of TREE) {
      const v = getBranchTotal(branch);
      if (v === null) return null;
      sum += v;
    }
    return sum;
  }, [dashboardData, socialReel]);

  const totalAbonnements = useMemo(() => {
    const c = dashboardData.categories;
    return c.compta_mensuelle + c.compta_periodique + c.qp_bilan_mensuel + c.bilan_annuel
      + c.social_forfait + c.social_periodique + c.social_abo + c.logiciels + c.juridique + c.autres;
  }, [dashboardData]);

  const deltaSocial = socialReel.total !== null
    ? (socialReel.total - dashboardData.categories.social_abo)
    : null;

  // ── Fusion PL + Silae pour le tableau détail ────────────────────────────────

  /** Lignes de base : PL sauf social_abo remplacé par Silae quand disponible */
  const lignesBase = useMemo(() => {
    const hasSilae = !socialReel.loading && socialReelLignes.length > 0;
    if (!hasSilae) return dashboardData.lignesDetail;

    // Clients couverts par Silae → on remplace leurs lignes social_abo
    const silaeClientIds = new Set(socialReelLignes.map(l => l.client_id));
    const plSansSocialAboSilae = dashboardData.lignesDetail.filter(
      l => !(l.categorie === 'social_abo' && silaeClientIds.has(l.client_id))
    );
    return [...plSansSocialAboSilae, ...socialReelLignes];
  }, [dashboardData.lignesDetail, socialReel.loading, socialReelLignes]);

  // ── Filtrage du tableau détail ──────────────────────────────────────────────

  const lignesFiltrees = useMemo(() => {
    let lignes = lignesBase;

    if (activeFilter) {
      const branch = TREE.find(b => b.key === activeFilter);
      if (branch?.childKeys) {
        const keys = new Set(branch.childKeys);
        // social_reel est dans les données fusionnées ; garder aussi social_abo (clients sans Silae)
        if (keys.has('social_reel')) keys.add('social_abo');
        lignes = lignes.filter(l => keys.has(l.categorie));
      } else if (activeFilter === 'social_reel') {
        // Montrer les lignes social_reel (Silae) + social_abo résiduel (sans Silae)
        lignes = lignes.filter(l => l.categorie === 'social_reel' || l.categorie === 'social_abo');
      } else {
        lignes = lignes.filter(l => l.categorie === activeFilter);
      }
    }

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      lignes = lignes.filter(l => l.client_nom.toLowerCase().includes(s));
    }

    return lignes;
  }, [lignesBase, activeFilter, searchTerm]);

  const lignesParClient = useMemo(() => {
    const grouped = {};
    for (const l of lignesFiltrees) {
      if (!grouped[l.client_id]) {
        grouped[l.client_id] = {
          client_id: l.client_id, client_nom: l.client_nom,
          client_cabinet: l.client_cabinet, lignes: [], total_annuel: 0,
        };
      }
      grouped[l.client_id].lignes.push(l);
      grouped[l.client_id].total_annuel += l.montant_annuel;
    }
    return Object.values(grouped).sort((a, b) => a.client_nom.localeCompare(b.client_nom, 'fr'));
  }, [lignesFiltrees]);

  const totalTableau = lignesFiltrees.reduce((s, l) => s + l.montant_annuel, 0);

  // ── Interactions ────────────────────────────────────────────────────────────

  const toggleBranch = (key) => {
    setExpandedBranches(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRowClick = (key) => {
    setActiveFilter(activeFilter === key ? null : key);
    setExpandedClient(null);
  };

  // ── Export Excel ────────────────────────────────────────────────────────────

  const handleExport = () => {
    const wb = XLSX.utils.book_new();

    const resumeData = [];
    for (const branch of TREE) {
      resumeData.push({ 'Catégorie': branch.label, 'Montant annuel HT': Math.round(getBranchTotal(branch) || 0) });
      if (branch.children) {
        for (const child of branch.children) {
          resumeData.push({ 'Catégorie': `  ${child.label}`, 'Montant annuel HT': Math.round(getAmount(child.key) || 0) });
        }
      }
    }
    resumeData.push({ 'Catégorie': 'TOTAL', 'Montant annuel HT': Math.round(totalAnnuel || totalAbonnements) });
    const wsResume = XLSX.utils.json_to_sheet(resumeData);
    wsResume['!cols'] = [{ wch: 30 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsResume, 'Résumé');

    const detailData = dashboardData.lignesDetail
      .sort((a, b) => a.client_nom.localeCompare(b.client_nom, 'fr'))
      .map(l => ({
        'Client': l.client_nom, 'Cabinet': l.client_cabinet,
        'Produit': l.label, 'Axe': l.axe || 'non classifié',
        'Catégorie': l.categorie,
        'Fréquence': l.frequence === 'yearly' ? 'Annuel' : `${l.intervalle}m`,
        'HT/période': Math.round(l.montant_ht * 100) / 100,
        'HT/annuel': Math.round(l.montant_annuel * 100) / 100,
      }));
    const wsDetail = XLSX.utils.json_to_sheet(detailData);
    wsDetail['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 40 }, { wch: 20 }, { wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Détail');

    XLSX.writeFile(wb, `dashboard_honoraires_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportClientsSansAbo = () => {
    const data = clientsSansAbonnement.map(c => ({
      'Nom': c.nom, 'Cabinet': c.cabinet || '-',
      'Statut PL': c.pennylane_customer_id ? 'Lié à PL sans abonnement' : 'Non lié à Pennylane',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    ws['!cols'] = [{ wch: 35 }, { wch: 18 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Clients sans abonnement');
    XLSX.writeFile(wb, `clients_sans_abonnement_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ── Rendu ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={32} className="animate-spin text-white" />
      </div>
    );
  }

  const grandTotal = totalAnnuel || totalAbonnements || 1;

  /** Ligne d'une feuille dans l'arbre */
  const renderLeafRow = (node, indent = false) => {
    const amount = getAmount(node.key);
    const cc = COLOR_CLASSES[node.color] || COLOR_CLASSES.slate;
    const isActive = activeFilter === node.key;
    const pct = amount !== null ? (amount / grandTotal) * 100 : null;
    const isLoading = node.async && socialReel.loading;

    // Sous-titre pour social au réel
    let subtitle = null;
    if (node.key === 'social_reel' && socialReel.periodes.length > 0 && !socialReel.loading) {
      subtitle = `Réel ${fmt(socialReel.cumulReel)} + proj. ${fmt(socialReel.projection)}`;
    }

    return (
      <button
        key={node.key}
        onClick={() => handleRowClick(node.key)}
        className={`w-full flex items-center gap-3 px-4 py-3 border-l-4 ${cc.left} transition-all text-left
          ${indent ? 'pl-12 bg-slate-800/50' : `${cc.bg}`}
          ${isActive ? 'ring-1 ring-white bg-slate-600' : 'hover:bg-slate-600'}
        `}
      >
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-white">{node.label}</span>
          {subtitle && <span className="text-xs text-white ml-2">({subtitle})</span>}
        </div>
        {isLoading && <Loader2 size={14} className="animate-spin text-white flex-shrink-0" />}
        <span className="text-xs text-white w-14 text-right flex-shrink-0">{fmtPct(pct)}</span>
        <span className="text-base font-bold text-white w-32 text-right flex-shrink-0">{fmt(amount)}</span>
      </button>
    );
  };

  /** Ligne d'une branche parent (dépliable) dans l'arbre */
  const renderBranchRow = (branch) => {
    const amount = getBranchTotal(branch);
    const cc = COLOR_CLASSES[branch.color] || COLOR_CLASSES.slate;
    const isExpanded = expandedBranches[branch.key];
    const isActive = activeFilter === branch.key;
    const pct = amount !== null ? (amount / grandTotal) * 100 : null;

    return (
      <div key={branch.key}>
        <div className={`flex items-center border-l-4 ${cc.left} ${cc.bg} ${isActive ? 'ring-1 ring-white' : ''}`}>
          <button
            onClick={() => toggleBranch(branch.key)}
            className="p-3 hover:bg-slate-600 rounded-r transition-all"
            aria-label={isExpanded ? 'Replier' : 'Déplier'}
          >
            {isExpanded
              ? <ChevronDown size={18} className="text-white" />
              : <ChevronRight size={18} className="text-white" />
            }
          </button>
          <button
            onClick={() => handleRowClick(branch.key)}
            className="flex-1 flex items-center gap-3 px-2 py-3 text-left hover:bg-slate-600 transition-all"
          >
            <span className="text-sm font-bold text-white flex-1">{branch.label}</span>
            <span className="text-xs text-white w-14 text-right flex-shrink-0">{fmtPct(pct)}</span>
            <span className="text-base font-bold text-white w-32 text-right flex-shrink-0">{fmt(amount)}</span>
          </button>
        </div>
        {isExpanded && branch.children && (
          <div>
            {branch.children.map(child => renderLeafRow(child, true))}
          </div>
        )}
      </div>
    );
  };

  // Trouver le label du filtre actif
  const activeFilterLabel = (() => {
    if (!activeFilter) return null;
    const branch = TREE.find(b => b.key === activeFilter);
    if (branch) return branch.label;
    return LEAF_MAP[activeFilter]?.label || activeFilter;
  })();

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 size={22} />
            Honoraires annuels estimés {new Date().getFullYear()}
          </h2>
          <p className="text-sm text-white mt-1">
            {dashboardData.nbClients} clients actifs avec abonnements
            {filterCabinet !== 'tous' && ` — ${filterCabinet}`}
            {socialReel.periodes.length > 0 && (
              <span className="ml-2">
                — Silae : {socialReel.periodes.length} mois ({socialReel.periodes[0]} → {socialReel.periodes[socialReel.periodes.length - 1]})
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleExport}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 flex items-center gap-2 text-sm"
        >
          <Download size={14} />
          Export Excel
        </button>
      </div>

      {/* ── Arbre des honoraires ───────────────────────────────────────────── */}
      <div className="mb-6 bg-slate-800 rounded-lg border border-slate-700 overflow-hidden divide-y divide-slate-700">
        {/* Ligne TOTAL en tête */}
        <button
          onClick={() => handleRowClick(null)}
          className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-all bg-sky-900/30 border-l-4 border-l-sky-500 ${activeFilter === null ? 'ring-1 ring-white' : 'hover:bg-slate-600'}`}
        >
          <TrendingUp size={18} className="text-white flex-shrink-0" />
          <span className="text-sm font-bold text-white flex-1">TOTAL HONORAIRES</span>
          <span className="text-xl font-bold text-white w-32 text-right flex-shrink-0">{fmt(totalAnnuel)}</span>
        </button>

        {/* Branches */}
        {TREE.map(branch =>
          branch.expandable
            ? renderBranchRow(branch)
            : renderLeafRow(branch)
        )}
      </div>

      {/* ── Corroboration ──────────────────────────────────────────────────── */}
      <div className="mb-6 p-4 bg-slate-700 rounded-lg border border-slate-600">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Calendar size={16} />
          Corroboration
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-white">Total abonnements annualisés</p>
            <p className="text-lg font-bold text-white">{fmt(totalAbonnements)}</p>
          </div>
          <div>
            <p className="text-white">Total avec social réel</p>
            <p className="text-lg font-bold text-white">{fmt(totalAnnuel)}</p>
          </div>
          <div>
            <p className="text-white">Delta social (réel - abo PL)</p>
            <p className={`text-lg font-bold ${deltaSocial !== null && deltaSocial >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {deltaSocial !== null ? `${deltaSocial >= 0 ? '+' : ''}${fmt(deltaSocial)}` : '...'}
            </p>
            {socialReel.error && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {socialReel.error}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Recherche + filtre actif ───────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-white" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher un client..."
            className="pl-9 pr-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg w-64"
          />
        </div>
        {activeFilter && (
          <span className="px-3 py-1.5 bg-slate-600 text-white rounded-lg text-sm flex items-center gap-2">
            Filtre : {activeFilterLabel}
            <button onClick={() => setActiveFilter(null)} className="hover:text-red-400 font-bold">×</button>
          </span>
        )}
        <span className="text-sm text-white ml-auto">
          {lignesParClient.length} clients — {lignesFiltrees.length} lignes — {fmt(totalTableau)}/an
        </span>
      </div>

      {/* ── Tableau détail ──────────────────────────────────────────────────── */}
      {lignesParClient.length === 0 ? (
        <div className="text-center py-12 text-white">
          <p>Aucune ligne trouvée.</p>
          {!activeFilter && <p className="text-sm mt-2">Lancez une synchronisation Pennylane pour importer les données.</p>}
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden mb-8">
          <table className="min-w-full">
            <thead className="bg-slate-700 border-b border-slate-600">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-white">Client</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-white">Cabinet</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-white">Lignes</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-white">HT/annuel</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-white">HT/mois</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-white w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {lignesParClient.map(group => (
                <React.Fragment key={group.client_id}>
                  <tr className="hover:bg-slate-600 cursor-pointer" onClick={() => setExpandedClient(expandedClient === group.client_id ? null : group.client_id)}>
                    <td className="px-4 py-3 font-medium text-white">{group.client_nom}</td>
                    <td className="px-4 py-3 text-sm text-white">{group.client_cabinet}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 bg-slate-600 rounded text-sm text-white">{group.lignes.length}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-white">{fmt(group.total_annuel)}</td>
                    <td className="px-4 py-3 text-right text-sm text-white">{fmt(group.total_annuel / 12)}</td>
                    <td className="px-4 py-3 text-center">
                      {expandedClient === group.client_id ? <ChevronUp size={16} className="text-white" /> : <ChevronDown size={16} className="text-white" />}
                    </td>
                  </tr>

                  {expandedClient === group.client_id && (
                    <tr>
                      <td colSpan={6} className="px-4 py-3 bg-slate-700">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-white text-xs">
                              <th className="text-left py-1">Produit</th>
                              <th className="text-left py-1">Catégorie</th>
                              <th className="text-center py-1">Fréquence</th>
                              <th className="text-right py-1">Qté</th>
                              <th className="text-right py-1">HT/mois</th>
                              <th className="text-right py-1">HT/annuel</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.lignes.map((l, i) => {
                              const leafDef = LEAF_MAP[l.categorie];
                              const cc = leafDef ? COLOR_CLASSES[leafDef.color] : COLOR_CLASSES.slate;
                              const isSilae = l.source === 'silae';
                              return (
                                <tr key={i} className="border-t border-slate-600">
                                  <td className="py-1.5 text-white">
                                    {l.label}
                                    {isSilae && <span className="ml-1 text-xs text-emerald-400">(Silae)</span>}
                                  </td>
                                  <td className="py-1.5">
                                    <span className={`px-2 py-0.5 rounded text-xs text-white ${cc.bg}`}>
                                      {leafDef?.label || l.categorie}
                                    </span>
                                  </td>
                                  <td className="py-1.5 text-center text-white">{fmtFreq(l.frequence, l.intervalle)}</td>
                                  <td className="py-1.5 text-right text-white">{l.quantite}</td>
                                  <td className="py-1.5 text-right text-white">
                                    {isSilae
                                      ? <span>{l.quantite} × {l.pu_ht?.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} = {(l.montant_ht || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €</span>
                                      : <span>{(l.montant_ht || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €</span>
                                    }
                                  </td>
                                  <td className="py-1.5 text-right font-medium text-white">{fmt(l.montant_annuel)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
            <tfoot className="bg-slate-700 border-t border-slate-600">
              <tr>
                <td className="px-4 py-3 font-bold text-white" colSpan={3}>TOTAL</td>
                <td className="px-4 py-3 text-right font-bold text-white">{fmt(totalTableau)}</td>
                <td className="px-4 py-3 text-right font-bold text-white">{fmt(totalTableau / 12)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Clients sans abonnement ────────────────────────────────────────── */}
      {clientsSansAbonnement.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle size={20} className="text-orange-500" />
              <h2 className="text-lg font-semibold text-white">
                Clients actifs sans abonnement ({clientsSansAbonnement.length})
              </h2>
            </div>
            <button
              onClick={handleExportClientsSansAbo}
              className="px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2 text-sm"
            >
              <Download size={14} />
              Export Excel
            </button>
          </div>
          <div className="bg-orange-900/30 rounded-lg border border-orange-800 p-4">
            <p className="text-sm text-white mb-4">
              Ces clients sont actifs dans la base mais n'ont pas d'abonnement Pennylane synchronisé.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {clientsSansAbonnement.map(client => (
                <div
                  key={client.id}
                  className={`px-3 py-2 rounded border text-sm ${
                    client.pennylane_customer_id
                      ? 'bg-yellow-900/30 border-yellow-700'
                      : 'bg-slate-800 border-orange-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">{client.nom}</span>
                    {client.pennylane_customer_id ? (
                      <span className="text-xs px-1.5 py-0.5 bg-yellow-900/50 text-white rounded">PL sans abo</span>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 bg-slate-600 text-white rounded">Pas dans PL</span>
                    )}
                  </div>
                  <span className="text-white text-xs">{client.cabinet || '-'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
