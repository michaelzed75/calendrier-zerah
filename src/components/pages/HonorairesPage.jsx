// @ts-check
import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp, Download, TrendingUp, BarChart3, ShieldCheck, XCircle, GitCompare, Search, FileSpreadsheet, Scissors, Calculator } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../supabaseClient';
import { getHonorairesResume, testConnection, setCompanyId, auditAbonnements, previewSync, commitSync, reconcilierDonnees } from '../../utils/honoraires';
import AugmentationPanel from '../honoraires/AugmentationPanel';
import RestructurationPanel from '../honoraires/RestructurationPanel';
import FacturationVariablePanel from '../honoraires/FacturationVariablePanel';
import SyncPreviewModal from '../honoraires/SyncPreviewModal';

/**
 * @typedef {import('../../types.js').Client} Client
 * @typedef {import('../../types.js').Collaborateur} Collaborateur
 * @typedef {import('../../types.js').AccentColor} AccentColor
 */

/**
 * @typedef {Object} HonorairesPageProps
 * @property {Client[]} clients - Liste des clients
 * @property {function} setClients - Setter des clients
 * @property {Collaborateur[]} collaborateurs - Liste des collaborateurs
 * @property {AccentColor} accent - Couleur d'accent
 * @property {Collaborateur} userCollaborateur - Collaborateur connecté
 */

/**
 * Page de gestion des honoraires
 * @param {HonorairesPageProps} props
 * @returns {JSX.Element}
 */
function HonorairesPage({ clients, setClients, collaborateurs, accent, userCollaborateur }) {
  // États
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [honoraires, setHonoraires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Audit
  const [auditResult, setAuditResult] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);

  // Onglets
  const [activeTab, setActiveTab] = useState('vue'); // 'vue' | 'augmentation' | 'restructuration' | 'facturation' | 'audit' | 'reconciliation'

  // Réconciliation (persisté en sessionStorage)
  const [reconData, setReconDataRaw] = useState(() => {
    try {
      const saved = sessionStorage.getItem('reconData');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const setReconData = (data) => {
    setReconDataRaw(data);
    try {
      if (data) sessionStorage.setItem('reconData', JSON.stringify(data));
      else sessionStorage.removeItem('reconData');
    } catch { /* quota exceeded */ }
  };
  const [reconLoading, setReconLoading] = useState(false);
  const [reconProgress, setReconProgress] = useState(null);
  const [reconFilter, setReconFilter] = useState('tous');
  const [reconSearch, setReconSearch] = useState('');
  const [reconExpanded, setReconExpanded] = useState(null);
  const [reconSort, setReconSort] = useState({ column: 'statut', direction: 'asc' });

  // Filtres
  const [filterCabinet, setFilterCabinet] = useState('tous');
  const [filterStatus, setFilterStatus] = useState('tous');
  const [expandedClient, setExpandedClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Clés API Pennylane (persistées en base Supabase)
  const [apiKey, setApiKey] = useState('');
  const [apiCompanyId, setApiCompanyId] = useState('');
  const [apiCabinet, setApiCabinet] = useState('');
  const [apiKeysMap, setApiKeysMap] = useState({}); // { cabinet: { api_key, company_id } }
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [savingApiKey, setSavingApiKey] = useState(false);

  // Charger les clés API depuis Supabase au montage
  useEffect(() => {
    const loadApiKeys = async () => {
      try {
        const { data, error: loadErr } = await supabase.from('pennylane_api_keys').select('cabinet, api_key, company_id');
        if (loadErr) {
          console.error('Erreur chargement clés API (RLS?):', loadErr);
          return;
        }
        if (data && data.length > 0) {
          const map = {};
          for (const row of data) {
            map[row.cabinet] = { api_key: row.api_key, company_id: row.company_id || '' };
          }
          setApiKeysMap(map);
          // Auto-sélectionner le premier cabinet trouvé
          const firstCabinet = data[0].cabinet;
          setApiCabinet(firstCabinet);
          setApiKey(map[firstCabinet].api_key);
          setApiCompanyId(map[firstCabinet].company_id || '');
          // Configurer le company_id pour les appels API
          if (map[firstCabinet].company_id) {
            setCompanyId(map[firstCabinet].company_id);
          }
          console.log(`[HonorairesPage] ${data.length} clé(s) API chargée(s) depuis Supabase`);
        } else {
          console.log('[HonorairesPage] Aucune clé API enregistrée');
        }
      } catch (err) {
        console.error('Erreur chargement clés API:', err);
      }
    };
    loadApiKeys();
  }, []);

  // Quand on change de cabinet, charger la clé et company_id associés
  useEffect(() => {
    if (apiCabinet && apiKeysMap[apiCabinet]) {
      setApiKey(apiKeysMap[apiCabinet].api_key);
      setApiCompanyId(apiKeysMap[apiCabinet].company_id || '');
      if (apiKeysMap[apiCabinet].company_id) {
        setCompanyId(apiKeysMap[apiCabinet].company_id);
      }
    } else if (apiCabinet && !apiKeysMap[apiCabinet]) {
      setApiKey('');
      setApiCompanyId('');
    }
  }, [apiCabinet, apiKeysMap]);

  // Sauvegarder la clé API en base
  const saveApiKey = async () => {
    if (!apiKey || !apiCabinet || !apiCompanyId) {
      setError('Veuillez remplir le cabinet, la clé API et le Company ID');
      return;
    }
    setSavingApiKey(true);
    try {
      const { error } = await supabase
        .from('pennylane_api_keys')
        .upsert({
          cabinet: apiCabinet,
          api_key: apiKey,
          company_id: apiCompanyId,
          updated_at: new Date().toISOString()
        }, { onConflict: 'cabinet' });
      if (error) throw error;
      setApiKeysMap(prev => ({ ...prev, [apiCabinet]: { api_key: apiKey, company_id: apiCompanyId } }));
      // Configurer le company_id pour les appels API
      setCompanyId(apiCompanyId);
    } catch (err) {
      console.error('Erreur sauvegarde clé API:', err);
      setError('Erreur sauvegarde clé API: ' + err.message);
    }
    setSavingApiKey(false);
  };

  // Preview sync
  const [previewReport, setPreviewReport] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [committing, setCommitting] = useState(false);

  // Droits
  const canSync = userCollaborateur?.is_admin || userCollaborateur?.est_chef_mission;

  // Charger les honoraires au montage
  useEffect(() => {
    loadHonoraires();
  }, []);

  /**
   * Charge les honoraires depuis Supabase
   */
  const loadHonoraires = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getHonorairesResume(supabase);
      setHonoraires(data);
    } catch (err) {
      console.error('Erreur chargement honoraires:', err);
      setError(err.message);
    }

    setLoading(false);
  };

  /**
   * Teste la connexion API
   */
  const handleTestConnection = async () => {
    const trimmedKey = apiKey?.trim();
    const trimmedCompanyId = apiCompanyId?.trim();
    if (!trimmedKey) {
      setError('Veuillez entrer une clé API valide');
      return;
    }
    if (!trimmedCompanyId) {
      setError('Veuillez entrer le Company ID Pennylane');
      return;
    }

    // Configurer le company_id pour l'appel test
    setCompanyId(trimmedCompanyId);

    setTestingConnection(true);
    setConnectionStatus(null);
    setError(null);

    try {
      console.log('[HonorairesPage] Test connexion API Pennylane (company_id:', trimmedCompanyId, ')...');
      const result = await testConnection(trimmedKey);
      setConnectionStatus(result.success ? 'success' : 'error');

      if (!result.success) {
        console.error('[HonorairesPage] Test échoué:', result.error);
        setError('Test API échoué : ' + result.error);
      } else {
        console.log('[HonorairesPage] Test réussi');
      }
    } catch (err) {
      console.error('[HonorairesPage] Erreur inattendue test connexion:', err);
      setConnectionStatus('error');
      setError('Erreur inattendue : ' + err.message);
    }

    setTestingConnection(false);
  };

  /**
   * Fusionne les rapports de preview de plusieurs cabinets en un seul rapport.
   * Le modal SyncPreviewModal reçoit un rapport unique, identique en structure.
   * Les rapports individuels sont conservés dans _rawReports pour le commit.
   */
  const mergePreviewReports = (reports) => {
    const merged = {
      clientsMatches: [], clientsNew: [], clientsMissing: [], clientsNoSubscription: [],
      abonnementsNew: [], abonnementsUpdated: [], abonnementsDisappeared: [], abonnementsStatusChanged: [],
      lignesModified: [], lignesNew: [], lignesRemoved: [], anomalies: [],
      summary: {
        totalCustomers: 0, customersWithSub: 0, matched: 0, unmatched: 0,
        noSubscription: 0, clientsMissing: 0,
        newSubs: 0, updatedSubs: 0, disappearedSubs: 0, statusChanges: 0,
        priceChanges: 0, newLines: 0, removedLines: 0,
        totalDeltaHT: 0, anomaliesCount: 0
      },
      _rawReports: reports
    };

    const arrayKeys = [
      'clientsMatches', 'clientsNew', 'clientsMissing', 'clientsNoSubscription',
      'abonnementsNew', 'abonnementsUpdated', 'abonnementsDisappeared', 'abonnementsStatusChanged',
      'lignesModified', 'lignesNew', 'lignesRemoved', 'anomalies'
    ];

    for (const { report } of reports) {
      for (const key of arrayKeys) merged[key].push(...(report[key] || []));
      const s = report.summary || {};
      for (const key of Object.keys(merged.summary)) {
        if (key !== '_rawReports') merged.summary[key] += s[key] || 0;
      }
    }
    merged.summary.totalDeltaHT = Math.round(merged.summary.totalDeltaHT * 100) / 100;
    return merged;
  };

  /**
   * Lance la synchronisation Pennylane (tous cabinets configurés)
   */
  const handleSync = async () => {
    const cabinetsList = Object.entries(apiKeysMap).map(([cab, info]) => ({
      cabinet: cab,
      apiKey: info.api_key,
      companyId: info.company_id || ''
    }));

    if (cabinetsList.length === 0) {
      setShowApiKeyInput(true);
      return;
    }

    setSyncing(true);
    setSyncProgress(null);
    setSyncResult(null);
    setError(null);

    try {
      const reports = [];
      for (const cab of cabinetsList) {
        if (cab.companyId) setCompanyId(cab.companyId);
        const report = await previewSync(
          supabase,
          cab.apiKey,
          cab.cabinet,
          (progress) => {
            setSyncProgress({ ...progress, message: `[${cab.cabinet}] ${progress.message}` });
          }
        );
        reports.push({ cabinet: cab.cabinet, report });
      }

      setPreviewReport(mergePreviewReports(reports));
      setShowPreviewModal(true);

    } catch (err) {
      console.error('Erreur preview sync:', err);
      setError(err.message);
    }

    setSyncing(false);
  };

  const handleCommitSync = async () => {
    if (!previewReport) return;

    setCommitting(true);
    setError(null);

    try {
      // Commit chaque cabinet séparément puis agréger les résultats
      const rawReports = previewReport._rawReports || [{ cabinet: apiCabinet, report: previewReport }];
      const aggregated = {
        customersMatched: 0, customersNotMatched: 0,
        abonnementsCreated: 0, abonnementsUpdated: 0,
        lignesCreated: 0, historiquePrixCreated: 0,
        unmatchedCustomers: [], customersNoSubscription: [], errors: []
      };

      for (const { cabinet, report } of rawReports) {
        if (apiKeysMap[cabinet]?.company_id) setCompanyId(apiKeysMap[cabinet].company_id);
        const result = await commitSync(
          supabase,
          report,
          cabinet,
          (progress) => setSyncProgress({ ...progress, message: `[${cabinet}] ${progress.message}` })
        );
        aggregated.customersMatched += result.customersMatched || 0;
        aggregated.customersNotMatched += result.customersNotMatched || 0;
        aggregated.abonnementsCreated += result.abonnementsCreated || 0;
        aggregated.abonnementsUpdated += result.abonnementsUpdated || 0;
        aggregated.lignesCreated += result.lignesCreated || 0;
        aggregated.historiquePrixCreated += result.historiquePrixCreated || 0;
        aggregated.unmatchedCustomers.push(...(result.unmatchedCustomers || []));
        aggregated.customersNoSubscription.push(...(result.customersNoSubscription || []));
        aggregated.errors.push(...(result.errors || []));
      }

      setSyncResult(aggregated);
      setShowPreviewModal(false);
      setPreviewReport(null);

      // Recharger les clients et honoraires
      const { data: newClients } = await supabase.from('clients').select('*').order('nom');
      if (newClients) setClients(newClients);

      await loadHonoraires();

    } catch (err) {
      console.error('Erreur commit sync:', err);
      setError(err.message);
    }

    setCommitting(false);
  };

  const handleCancelSync = () => {
    setShowPreviewModal(false);
    setPreviewReport(null);
  };

  /**
   * Lance l'audit des abonnements
   */
  const handleAudit = async () => {
    setAuditLoading(true);
    setError(null);
    try {
      const result = await auditAbonnements(supabase);
      setAuditResult(result);
    } catch (err) {
      console.error('Erreur audit:', err);
      setError(err.message);
    }
    setAuditLoading(false);
  };

  /**
   * Regroupe les honoraires par client
   */
  const honorairesParClient = useMemo(() => {
    // Exclure les clients inactifs de la facturation
    const clientsActifsSet = new Set(clients.filter(c => c.actif).map(c => c.id));

    // Filtrer par statut et par client actif
    const filtered = honoraires.filter(h => {
      // Exclure les abonnements de clients inactifs
      if (!clientsActifsSet.has(h.client_id)) return false;
      if (filterStatus !== 'tous' && h.status !== filterStatus) return false;
      return true;
    });

    // Regrouper par client_id
    const grouped = {};
    filtered.forEach(h => {
      const clientId = h.client_id;
      const clientNom = h.clients?.nom || h.label;
      const clientCabinet = h.clients?.cabinet || '-';

      if (!grouped[clientId]) {
        grouped[clientId] = {
          client_id: clientId,
          client_nom: clientNom,
          client_cabinet: clientCabinet,
          abonnements: [],
          total_ttc: 0,
          total_ht: 0,
          totaux_par_famille: {
            comptabilite: 0,
            social: 0,
            juridique: 0,
            support: 0
          },
          // Pour le calcul mensuel
          total_mensuel_ht: 0
        };
      }

      grouped[clientId].abonnements.push(h);
      grouped[clientId].total_ttc += h.total_ttc || 0;
      grouped[clientId].total_ht += h.total_ht || 0;

      // Ajouter les totaux par famille
      if (h.totaux_par_famille) {
        grouped[clientId].totaux_par_famille.comptabilite += h.totaux_par_famille.comptabilite || 0;
        grouped[clientId].totaux_par_famille.social += h.totaux_par_famille.social || 0;
        grouped[clientId].totaux_par_famille.juridique += h.totaux_par_famille.juridique || 0;
        grouped[clientId].totaux_par_famille.support += h.totaux_par_famille.support || 0;
      }

      // Calcul mensuel : si annuel diviser par 12
      const mensuel = h.frequence === 'yearly'
        ? (h.total_ht || 0) / 12
        : (h.total_ht || 0) / (h.intervalle || 1);
      grouped[clientId].total_mensuel_ht += mensuel;
    });

    // Convertir en array et filtrer par cabinet et recherche
    let result = Object.values(grouped);

    if (filterCabinet !== 'tous') {
      result = result.filter(c => c.client_cabinet === filterCabinet);
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(c => c.client_nom.toLowerCase().includes(search));
    }

    // Trier par nom
    result.sort((a, b) => a.client_nom.localeCompare(b.client_nom));

    return result;
  }, [honoraires, clients, filterCabinet, filterStatus, searchTerm]);

  // Calculer les totaux
  const totaux = useMemo(() => {
    return honorairesParClient.reduce((acc, c) => {
      acc.total_ht += c.total_ht || 0;
      acc.total_mensuel += c.total_mensuel_ht || 0;
      acc.comptabilite += c.totaux_par_famille?.comptabilite || 0;
      acc.social += c.totaux_par_famille?.social || 0;
      acc.juridique += c.totaux_par_famille?.juridique || 0;
      acc.support += c.totaux_par_famille?.support || 0;
      return acc;
    }, { total_ht: 0, total_mensuel: 0, comptabilite: 0, social: 0, juridique: 0, support: 0 });
  }, [honorairesParClient]);

  // Clients actifs sans abonnement
  const clientsSansAbonnement = useMemo(() => {
    // IDs des clients qui ont au moins un abonnement
    const clientsAvecAbonnement = new Set(honoraires.map(h => h.client_id));

    // Filtrer les clients actifs qui n'ont pas d'abonnement
    let result = clients.filter(c =>
      c.actif && !clientsAvecAbonnement.has(c.id)
    );

    // Appliquer le filtre cabinet si sélectionné
    if (filterCabinet !== 'tous') {
      result = result.filter(c => c.cabinet === filterCabinet);
    }

    // Trier par nom
    result.sort((a, b) => a.nom.localeCompare(b.nom));

    return result;
  }, [clients, honoraires, filterCabinet]);

  // Couleurs d'accent
  const accentClasses = {
    bg: `bg-${accent}-600`,
    bgHover: `hover:bg-${accent}-700`,
    bgLight: `bg-${accent}-900/30`,
    text: `text-${accent}-400`,
    border: `border-${accent}-800`
  };

  /**
   * Export Excel des clients sans abonnement
   */
  const handleExportClientsSansAbo = () => {
    const dataToExport = clientsSansAbonnement.map(client => ({
      'Nom': client.nom,
      'Cabinet': client.cabinet || '-',
      'Statut Pennylane': client.pennylane_customer_id ? 'Lié à PL sans abonnement' : 'Non lié à Pennylane',
      'Pennylane Customer ID': client.pennylane_customer_id || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients sans abonnement');

    // Ajuster la largeur des colonnes
    ws['!cols'] = [
      { wch: 35 }, // Nom
      { wch: 18 }, // Cabinet
      { wch: 25 }, // Statut Pennylane
      { wch: 40 }  // Pennylane Customer ID
    ];

    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `clients_sans_abonnement_${date}.xlsx`);
  };

  /**
   * Export Excel complet de la vue par client (tous les clients avec détails)
   */
  const handleExportVueClient = () => {
    const wb = XLSX.utils.book_new();

    // Onglet 1 : Résumé par client
    const resumeData = honorairesParClient.map(c => ({
      'Client': c.client_nom,
      'Cabinet': c.client_cabinet,
      'Nb Abon.': c.abonnements.length,
      'Compta HT': Math.round((c.totaux_par_famille?.comptabilite || 0) * 100) / 100,
      'Social HT': Math.round((c.totaux_par_famille?.social || 0) * 100) / 100,
      'Juridique HT': Math.round((c.totaux_par_famille?.juridique || 0) * 100) / 100,
      'Support HT': Math.round((c.totaux_par_famille?.support || 0) * 100) / 100,
      'Total HT': Math.round((c.total_ht || 0) * 100) / 100,
      'Total TTC': Math.round((c.total_ttc || 0) * 100) / 100,
      'Mensuel HT': Math.round((c.total_mensuel_ht || 0) * 100) / 100
    }));
    // Ligne de total
    resumeData.push({
      'Client': 'TOTAL',
      'Cabinet': '',
      'Nb Abon.': honorairesParClient.reduce((s, c) => s + c.abonnements.length, 0),
      'Compta HT': Math.round(totaux.comptabilite * 100) / 100,
      'Social HT': Math.round(totaux.social * 100) / 100,
      'Juridique HT': Math.round(totaux.juridique * 100) / 100,
      'Support HT': Math.round(totaux.support * 100) / 100,
      'Total HT': Math.round(totaux.total_ht * 100) / 100,
      'Total TTC': '',
      'Mensuel HT': Math.round(totaux.total_mensuel * 100) / 100
    });

    const wsResume = XLSX.utils.json_to_sheet(resumeData);
    wsResume['!cols'] = [
      { wch: 35 }, { wch: 18 }, { wch: 8 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }
    ];
    XLSX.utils.book_append_sheet(wb, wsResume, 'Résumé par client');

    // Onglet 2 : Détail des lignes
    const lignesData = [];
    for (const c of honorairesParClient) {
      for (const abo of c.abonnements) {
        for (const ligne of (abo.abonnements_lignes || [])) {
          lignesData.push({
            'Client': c.client_nom,
            'Cabinet': c.client_cabinet,
            'Abonnement': abo.label || '-',
            'Statut': abo.status,
            'Fréquence': abo.frequence === 'yearly' ? 'Annuel' : `${abo.intervalle || 1}m`,
            'Produit': ligne.label,
            'Famille': ligne.famille || '-',
            'Quantité': ligne.quantite || 1,
            'Montant HT': Math.round((ligne.montant_ht || 0) * 100) / 100,
            'Montant TTC': Math.round((ligne.montant_ttc || 0) * 100) / 100,
            'TVA': ligne.taux_tva || '20%'
          });
        }
      }
    }
    const wsLignes = XLSX.utils.json_to_sheet(lignesData);
    wsLignes['!cols'] = [
      { wch: 35 }, { wch: 18 }, { wch: 20 }, { wch: 12 }, { wch: 10 },
      { wch: 40 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 8 }
    ];
    XLSX.utils.book_append_sheet(wb, wsLignes, 'Détail lignes');

    const date = new Date().toISOString().split('T')[0];
    const suffix = filterCabinet !== 'tous' ? `_${filterCabinet.replace(/\s+/g, '_')}` : '';
    XLSX.writeFile(wb, `honoraires_vue_client${suffix}_${date}.xlsx`);
  };

  /**
   * Export Excel du rapport d'audit
   */
  const handleExportAudit = () => {
    if (!auditResult) return;
    const wb = XLSX.utils.book_new();

    // Onglet 1 : Cohérence CA
    const caData = [{
      'CA Annualisé HT': auditResult.coherenceCA?.caAnnualise || 0,
      'Total HT': auditResult.coherenceCA?.totalHT || 0,
      'Mensuel HT': auditResult.coherenceCA?.totalMensuelHT || 0,
      'Nb Abonnements actifs': auditResult.coherenceCA?.nbAbonnements || 0,
      'Nb Abonnements arrêtés': auditResult.coherenceCA?.nbAbonnementsStopped || 0,
      'Nb Clients': auditResult.coherenceCA?.nbClients || 0
    }];
    const wsCa = XLSX.utils.json_to_sheet(caData);
    XLSX.utils.book_append_sheet(wb, wsCa, 'Cohérence CA');

    // Onglet 2 : Orphelins
    if (auditResult.orphelins?.details?.length > 0) {
      const orphData = auditResult.orphelins.details.map(o => ({
        'Abonnement ID': o.abonnement_id,
        'Label': o.label,
        'Client ID': o.client_id,
        'Statut': o.status,
        'Total HT': o.total_ht
      }));
      const wsOrph = XLSX.utils.json_to_sheet(orphData);
      XLSX.utils.book_append_sheet(wb, wsOrph, 'Orphelins');
    }

    // Onglet 3 : Clients sans abo
    if (auditResult.clientsSansAbo?.details?.length > 0) {
      const sansData = auditResult.clientsSansAbo.details.map(d => ({
        'Nom': d.nom,
        'Cabinet': d.cabinet,
        'SIREN': d.siren || '-',
        'Statut': d.statut
      }));
      const wsSans = XLSX.utils.json_to_sheet(sansData);
      XLSX.utils.book_append_sheet(wb, wsSans, 'Clients sans abo');
    }

    // Onglet 4 : Clients inactifs avec abo
    if (auditResult.matching?.clientsInactifsAvecAbo?.length > 0) {
      const inactifsData = auditResult.matching.clientsInactifsAvecAbo.map(d => ({
        'Client': d.client_nom,
        'Cabinet': d.client_cabinet,
        'Label Abo': d.label,
        'Statut Abo': d.status
      }));
      const wsInactifs = XLSX.utils.json_to_sheet(inactifsData);
      XLSX.utils.book_append_sheet(wb, wsInactifs, 'Inactifs avec abo');
    }

    // Onglet 5 : Prix social suspects
    if (auditResult.prixSuspects?.details?.length > 0) {
      const prixData = auditResult.prixSuspects.details.map(d => ({
        'Sévérité': d.severity === 'error' ? 'ERREUR' : 'Avertissement',
        'Client': d.client_nom,
        'Cabinet': d.client_cabinet,
        'Ligne': d.label,
        'Axe': d.axe,
        'Quantité': d.quantite,
        'Montant HT': d.montant_ht,
        'Prix Unitaire': d.prix_unitaire,
        'Message': d.message
      }));
      const wsPrix = XLSX.utils.json_to_sheet(prixData);
      XLSX.utils.book_append_sheet(wb, wsPrix, 'Prix suspects');
    }

    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `audit_honoraires_${date}.xlsx`);
  };

  /**
   * Export Excel de la réconciliation PL ↔ DB
   */
  const handleExportReconciliation = (data) => {
    if (!data || data.length === 0) return;
    const wb = XLSX.utils.book_new();

    const statutLabels = { iso: 'ISO', ecart: 'Écart', pl_only: 'PL seul', db_only: 'DB seul', no_sub: 'Sans abo' };
    const exportData = data.map(r => ({
      'Statut': statutLabels[r.statut] || r.statut,
      'Client (DB)': r.clientNom,
      'SIREN': r.clientSiren || '-',
      'Customer (PL)': r.customerPLName,
      'Cabinet': r.cabinet || '-',
      'HT DB': Math.round((r.totalHTDB || 0) * 100) / 100,
      'HT PL': Math.round((r.totalHTPL || 0) * 100) / 100,
      'Écart HT': Math.round((r.ecartHT || 0) * 100) / 100,
      'Écart %': r.totalHTPL > 0 ? Math.round(((r.ecartHT || 0) / r.totalHTPL) * 10000) / 100 : 0,
      'Match': r.matchType || '-'
    }));

    // Ligne de total
    const totalPL = data.reduce((s, r) => s + (r.totalHTPL || 0), 0);
    const totalDB = data.reduce((s, r) => s + (r.totalHTDB || 0), 0);
    exportData.push({
      'Statut': 'TOTAL',
      'Client (DB)': `${data.length} lignes`,
      'SIREN': '',
      'Customer (PL)': '',
      'Cabinet': '',
      'HT DB': Math.round(totalDB * 100) / 100,
      'HT PL': Math.round(totalPL * 100) / 100,
      'Écart HT': Math.round((totalDB - totalPL) * 100) / 100,
      'Écart %': '',
      'Match': ''
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [
      { wch: 10 }, { wch: 35 }, { wch: 12 }, { wch: 35 },
      { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Réconciliation');

    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `reconciliation_PL_DB_${date}.xlsx`);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Honoraires</h1>
          <p className="text-white">Gestion des abonnements et facturation - Vue par client</p>
        </div>

        <div className="flex gap-2">
          {/* Bouton configuration API */}
          <button
            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            className="px-4 py-2 border border-slate-600 rounded-lg hover:bg-slate-600 flex items-center gap-2 text-white"
          >
            {connectionStatus === 'success' ? (
              <CheckCircle size={16} className="text-green-500" />
            ) : connectionStatus === 'error' ? (
              <AlertCircle size={16} className="text-red-500" />
            ) : null}
            API Pennylane
          </button>

          {/* Bouton sync */}
          {canSync && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className={`px-4 py-2 ${accentClasses.bg} text-white rounded-lg ${accentClasses.bgHover} flex items-center gap-2 disabled:opacity-50`}
            >
              {syncing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              Synchroniser Pennylane
            </button>
          )}
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 border-b border-slate-700 mb-6">
        <button
          onClick={() => setActiveTab('vue')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition text-sm font-medium ${
            activeTab === 'vue'
              ? 'bg-slate-800 border border-b-transparent border-slate-700 text-white -mb-px'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BarChart3 size={16} />
          Vue par client
        </button>
        <button
          onClick={() => setActiveTab('augmentation')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition text-sm font-medium ${
            activeTab === 'augmentation'
              ? 'bg-slate-800 border border-b-transparent border-slate-700 text-white -mb-px'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <TrendingUp size={16} />
          Augmentation
        </button>
        <button
          onClick={() => setActiveTab('restructuration')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition text-sm font-medium ${
            activeTab === 'restructuration'
              ? 'bg-slate-800 border border-b-transparent border-slate-700 text-white -mb-px'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Scissors size={16} />
          Restructuration
        </button>
        <button
          onClick={() => setActiveTab('facturation')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition text-sm font-medium ${
            activeTab === 'facturation'
              ? 'bg-slate-800 border border-b-transparent border-slate-700 text-white -mb-px'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Calculator size={16} />
          Facturation
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition text-sm font-medium ${
            activeTab === 'audit'
              ? 'bg-slate-800 border border-b-transparent border-slate-700 text-white -mb-px'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShieldCheck size={16} />
          Audit
        </button>
        <button
          onClick={() => setActiveTab('reconciliation')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition text-sm font-medium ${
            activeTab === 'reconciliation'
              ? 'bg-slate-800 border border-b-transparent border-slate-700 text-white -mb-px'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <GitCompare size={16} />
          Réconciliation
        </button>
      </div>

      {/* === Sync feedback UI (visible sur TOUS les onglets) === */}

      {/* Input clé API */}
      {showApiKeyInput && (
        <div className="mb-6 p-4 bg-slate-700 rounded-lg border border-slate-600">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Cabinet
              </label>
              <select
                value={apiCabinet}
                onChange={(e) => setApiCabinet(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Sélectionner...</option>
                <option value="Zerah Fiduciaire">Zerah Fiduciaire</option>
                <option value="Audit Up">Audit Up</option>
              </select>
              <p className="mt-1 text-xs text-white">
                Cabinet associé à la clé
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Company ID Pennylane
              </label>
              <input
                type="text"
                value={apiCompanyId}
                onChange={(e) => setApiCompanyId(e.target.value)}
                placeholder="Ex: 12345"
                className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-white">
                Visible dans Pennylane → Paramètres → API
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Clé API Pennylane v2
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Entrez votre clé API..."
                className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={handleTestConnection}
              disabled={!apiKey || !apiCompanyId || testingConnection}
              className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 disabled:opacity-50"
            >
              {testingConnection ? <Loader2 size={16} className="animate-spin" /> : 'Tester'}
            </button>
            <button
              onClick={saveApiKey}
              disabled={!apiKey || !apiCabinet || !apiCompanyId || savingApiKey}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50 flex items-center gap-1"
            >
              {savingApiKey ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Enregistrer
            </button>
            {connectionStatus === 'success' && (
              <span className="text-white text-sm flex items-center gap-1">
                <CheckCircle size={14} className="text-green-400" /> Connexion réussie
              </span>
            )}
            {connectionStatus === 'error' && (
              <span className="text-white text-sm flex items-center gap-1">
                <AlertCircle size={14} className="text-red-400" /> Connexion échouée
              </span>
            )}
            {apiCabinet && apiKeysMap[apiCabinet] && (
              <span className="text-white text-sm flex items-center gap-1">
                <CheckCircle size={14} className="text-green-400" /> Config enregistrée pour {apiCabinet}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Progression sync */}
      {syncing && syncProgress && (
        <div className="mb-6 p-4 bg-blue-900/30 rounded-lg border border-blue-800">
          <div className="flex items-center gap-2">
            <Loader2 size={16} className="animate-spin text-white" />
            <span className="text-white">{syncProgress.message}</span>
          </div>
        </div>
      )}

      {/* Résultat sync */}
      {syncResult && (
        <div className={`mb-6 p-4 rounded-lg border ${syncResult.errors.length > 0 ? 'bg-yellow-900/30 border-yellow-800' : 'bg-green-900/30 border-green-800'}`}>
          <h3 className="font-medium mb-2 text-white">Résultat de la synchronisation</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-white">Customers matchés:</span>
              <span className="ml-2 font-medium text-white">{syncResult.customersMatched}</span>
            </div>
            <div>
              <span className="text-white">Non matchés:</span>
              <span className="ml-2 font-medium text-white">{syncResult.customersNotMatched}</span>
            </div>
            <div>
              <span className="text-white">Abonnements créés:</span>
              <span className="ml-2 font-medium text-white">{syncResult.abonnementsCreated}</span>
            </div>
            <div>
              <span className="text-white">Abonnements MAJ:</span>
              <span className="ml-2 font-medium text-white">{syncResult.abonnementsUpdated}</span>
            </div>
          </div>
          {syncResult.historiquePrixCreated > 0 && (
            <p className="mt-2 text-xs text-white">
              {syncResult.historiquePrixCreated} variation(s) de prix enregistrée(s) dans l'historique
            </p>
          )}
          {syncResult.unmatchedCustomers?.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-white">
                {syncResult.unmatchedCustomers.length} customers non matchés (avec abonnements)
              </summary>
              <p className="mt-1 text-xs text-white">Ces customers ont des abonnements mais ne correspondent à aucun client local</p>
              <ul className="mt-2 text-sm text-white max-h-40 overflow-y-auto">
                {syncResult.unmatchedCustomers.map(c => (
                  <li key={c.id}>{c.name} ({c.external_reference || 'pas de ref'})</li>
                ))}
              </ul>
            </details>
          )}
          {syncResult.customersNoSubscription?.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-white">
                {syncResult.customersNoSubscription.length} customers ignorés (sans abonnement)
              </summary>
              <p className="mt-1 text-xs text-white">Ces customers existent dans Pennylane mais n'ont pas d'abonnement actif</p>
              <ul className="mt-2 text-sm text-white max-h-40 overflow-y-auto">
                {syncResult.customersNoSubscription.map(c => (
                  <li key={c.id}>{c.name}</li>
                ))}
              </ul>
            </details>
          )}
          {syncResult.errors?.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-white">
                {syncResult.errors.length} erreurs
              </summary>
              <ul className="mt-2 text-sm text-white max-h-40 overflow-y-auto">
                {syncResult.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/30 rounded-lg border border-red-800 text-white">
          <AlertCircle size={16} className="inline mr-2" />
          {error}
        </div>
      )}

      {/* === Fin sync feedback UI === */}

      {/* Contenu onglet Augmentation */}
      {activeTab === 'augmentation' && (
        <AugmentationPanel
          honoraires={honoraires}
          clients={clients}
          accent={accent}
          filterCabinet={filterCabinet}
          filterStatus={filterStatus}
        />
      )}

      {/* Contenu onglet Restructuration (Phase 2) */}
      {activeTab === 'restructuration' && (
        <RestructurationPanel
          clients={clients}
          accent={accent}
          filterCabinet={filterCabinet}
        />
      )}

      {/* Contenu onglet Facturation variable (Phase 3) */}
      {activeTab === 'facturation' && (
        <FacturationVariablePanel
          clients={clients}
          accent={accent}
          filterCabinet={filterCabinet}
          apiKeysMap={apiKeysMap}
        />
      )}

      {/* Contenu onglet Audit */}
      {activeTab === 'audit' && (
        <div>
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={handleAudit}
              disabled={auditLoading}
              className={`px-4 py-2 ${accentClasses.bg} text-white rounded-lg ${accentClasses.bgHover} flex items-center gap-2 disabled:opacity-50`}
            >
              {auditLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ShieldCheck size={16} />
              )}
              Lancer l'audit
            </button>
            {auditResult && (
              <>
                <span className="text-sm text-white">
                  Dernier audit : {new Date(auditResult.timestamp).toLocaleString('fr-FR')}
                </span>
                <button
                  onClick={() => handleExportAudit()}
                  className="px-3 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 flex items-center gap-2 text-sm ml-auto"
                >
                  <FileSpreadsheet size={16} />
                  Export Excel
                </button>
              </>
            )}
          </div>

          {auditLoading && (
            <div className="flex justify-center py-12">
              <Loader2 size={32} className="animate-spin text-white" />
            </div>
          )}

          {auditResult && !auditLoading && (
            <div className="space-y-6">
              {/* 1. Abonnements orphelins */}
              <div className={`p-4 rounded-lg border ${
                auditResult.orphelins.count === 0 && auditResult.orphelins.countInactifs === 0
                  ? 'bg-green-900/30 border-green-800'
                  : 'bg-red-900/30 border-red-800'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {auditResult.orphelins.count === 0 && auditResult.orphelins.countInactifs === 0 ? (
                    <CheckCircle size={20} className="text-white" />
                  ) : (
                    <XCircle size={20} className="text-white" />
                  )}
                  <h3 className="font-semibold">1. Abonnements orphelins</h3>
                </div>
                {auditResult.orphelins.count === 0 && auditResult.orphelins.countInactifs === 0 ? (
                  <p className="text-sm text-white">Aucun abonnement orphelin. Tous les abonnements pointent vers des clients actifs.</p>
                ) : (
                  <div className="text-sm">
                    {auditResult.orphelins.count > 0 && (
                      <div className="mb-2">
                        <p className="text-white font-medium">{auditResult.orphelins.count} abonnement(s) pointant vers un client inexistant :</p>
                        <ul className="mt-1 ml-4 list-disc text-white">
                          {auditResult.orphelins.details.map(o => (
                            <li key={o.abonnement_id}>
                              {o.label} (client_id={o.client_id}, {o.status}, {(o.total_ht || 0).toLocaleString('fr-FR')} € HT)
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {auditResult.orphelins.countInactifs > 0 && (
                      <div>
                        <p className="text-white font-medium">{auditResult.orphelins.countInactifs} abonnement(s) sur des clients inactifs :</p>
                        <ul className="mt-1 ml-4 list-disc text-white">
                          {auditResult.orphelins.detailsInactifs.map(o => (
                            <li key={o.abonnement_id}>
                              {o.label} → {o.client_nom} (client_id={o.client_id}, {o.status})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Clients sans abonnement */}
              <div className="p-4 rounded-lg border bg-blue-900/30 border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={20} className="text-white" />
                  <h3 className="font-semibold">2. Clients actifs sans abonnement actif ({auditResult.clientsSansAbo.total})</h3>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                  <div className="p-2 bg-slate-800 rounded border border-slate-600">
                    <span className="text-white">PL sans abo :</span>
                    <span className="ml-2 font-bold text-white">{auditResult.clientsSansAbo.plSansAbo}</span>
                  </div>
                  <div className="p-2 bg-slate-800 rounded border border-slate-600">
                    <span className="text-white">Pas dans PL :</span>
                    <span className="ml-2 font-bold text-white">{auditResult.clientsSansAbo.pasDansPl}</span>
                  </div>
                  <div className="p-2 bg-slate-800 rounded border border-slate-600">
                    <span className="text-white">Abo tous arrêtés :</span>
                    <span className="ml-2 font-bold text-white">{auditResult.clientsSansAbo.aboStoppes}</span>
                  </div>
                </div>
                {auditResult.clientsSansAbo.details.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-sm text-white font-medium">
                      Voir la liste détaillée ({auditResult.clientsSansAbo.details.length} clients)
                    </summary>
                    <div className="mt-2 max-h-60 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="text-xs text-white bg-slate-800">
                          <tr>
                            <th className="text-left p-1">Nom</th>
                            <th className="text-left p-1">Cabinet</th>
                            <th className="text-left p-1">SIREN</th>
                            <th className="text-left p-1">Statut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditResult.clientsSansAbo.details.map(c => (
                            <tr key={c.id} className="border-t border-slate-600">
                              <td className="p-1 font-medium">{c.nom}</td>
                              <td className="p-1 text-white">{c.cabinet || '-'}</td>
                              <td className="p-1 font-mono text-xs">{c.siren || '-'}</td>
                              <td className="p-1">
                                <span className={`px-1.5 py-0.5 rounded text-xs ${
                                  c.statut === 'PL sans abo' ? 'bg-yellow-900/50 text-white' :
                                  c.statut === 'Pas dans PL' ? 'bg-slate-600 text-white' :
                                  'bg-orange-900/50 text-white'
                                }`}>
                                  {c.statut}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
              </div>

              {/* 3. Cohérence CA */}
              <div className={`p-4 rounded-lg border ${
                auditResult.coherenceCA.dansPlage
                  ? 'bg-green-900/30 border-green-800'
                  : 'bg-orange-900/30 border-orange-800'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {auditResult.coherenceCA.dansPlage ? (
                    <CheckCircle size={20} className="text-white" />
                  ) : (
                    <AlertCircle size={20} className="text-white" />
                  )}
                  <h3 className="font-semibold">3. Cohérence CA</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="p-3 bg-slate-800 rounded border border-slate-600">
                    <p className="text-white text-xs">CA annualisé</p>
                    <p className="text-xl font-bold">{auditResult.coherenceCA.caAnnualise.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</p>
                    <p className="text-xs text-white">Plage attendue : 2M – 2.5M€</p>
                  </div>
                  <div className="p-3 bg-slate-800 rounded border border-slate-600">
                    <p className="text-white text-xs">Total HT facturé</p>
                    <p className="text-lg font-bold">{auditResult.coherenceCA.totalHT.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</p>
                    <p className="text-xs text-white">(somme brute des abonnements)</p>
                  </div>
                  <div className="p-3 bg-slate-800 rounded border border-slate-600">
                    <p className="text-white text-xs">Mensuel HT</p>
                    <p className="text-lg font-bold">{auditResult.coherenceCA.totalMensuelHT.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €/mois</p>
                  </div>
                  <div className="p-3 bg-slate-800 rounded border border-slate-600">
                    <p className="text-white text-xs">Abonnements</p>
                    <p className="text-lg font-bold">{auditResult.coherenceCA.nbAbonnements} actifs</p>
                    <p className="text-xs text-white">{auditResult.coherenceCA.nbAbonnementsStopped} arrêtés, {auditResult.coherenceCA.nbClients} clients</p>
                  </div>
                </div>
                {auditResult.coherenceCA.parCabinet && (
                  <div className="mt-3 text-sm">
                    <p className="font-medium text-white mb-1">Répartition par cabinet :</p>
                    <div className="flex gap-4">
                      {Object.entries(auditResult.coherenceCA.parCabinet).map(([cab, montant]) => (
                        <span key={cab} className="px-2 py-1 bg-slate-800 rounded border text-xs">
                          {cab} : <strong>{montant.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Matching complet */}
              <div className={`p-4 rounded-lg border ${
                auditResult.matching.abonnementsSansClient === 0 && auditResult.matching.clientsInactifsAvecAbo.length === 0 && auditResult.matching.doublonsSubscriptionId.length === 0
                  ? 'bg-green-900/30 border-green-800'
                  : 'bg-orange-900/30 border-orange-800'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {auditResult.matching.abonnementsSansClient === 0 && auditResult.matching.doublonsSubscriptionId.length === 0 ? (
                    <CheckCircle size={20} className="text-white" />
                  ) : (
                    <AlertCircle size={20} className="text-white" />
                  )}
                  <h3 className="font-semibold">4. Matching abonnements ↔ clients</h3>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                  <div className="p-2 bg-slate-800 rounded border border-slate-600">
                    <span className="text-white">Abonnements total :</span>
                    <span className="ml-2 font-bold">{auditResult.matching.abonnementsTotal}</span>
                  </div>
                  <div className="p-2 bg-slate-800 rounded border border-slate-600">
                    <span className="text-white">Avec client :</span>
                    <span className="ml-2 font-bold text-white">{auditResult.matching.abonnementsAvecClient}</span>
                  </div>
                  <div className="p-2 bg-slate-800 rounded border border-slate-600">
                    <span className="text-white">Sans client :</span>
                    <span className={`ml-2 font-bold ${auditResult.matching.abonnementsSansClient > 0 ? 'text-white' : 'text-white'}`}>
                      {auditResult.matching.abonnementsSansClient}
                    </span>
                  </div>
                </div>
                {auditResult.matching.clientsInactifsAvecAbo.length > 0 && (
                  <details className="mb-2">
                    <summary className="cursor-pointer text-sm text-white font-medium">
                      {auditResult.matching.clientsInactifsAvecAbo.length} abonnement(s) sur clients inactifs
                    </summary>
                    <ul className="mt-1 ml-4 list-disc text-sm text-white">
                      {auditResult.matching.clientsInactifsAvecAbo.map(a => (
                        <li key={a.abonnement_id}>
                          {a.label} → {a.client_nom} ({a.client_cabinet}, {a.status})
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {auditResult.matching.doublonsSubscriptionId.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-sm text-white font-medium">
                      {auditResult.matching.doublonsSubscriptionId.length} doublons pennylane_subscription_id
                    </summary>
                    <ul className="mt-1 ml-4 list-disc text-sm text-white">
                      {auditResult.matching.doublonsSubscriptionId.map(d => (
                        <li key={`${d.abonnement_id}-${d.pennylane_subscription_id}`}>
                          PL#{d.pennylane_subscription_id} : {d.label} → {d.client_nom} ({d.status})
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {auditResult.matching.abonnementsSansClient === 0 && auditResult.matching.doublonsSubscriptionId.length === 0 && auditResult.matching.clientsInactifsAvecAbo.length === 0 && (
                  <p className="text-sm text-white">Tous les abonnements sont correctement rattachés à des clients actifs. Aucun doublon détecté.</p>
                )}
              </div>

              {/* 5. Prix social suspects */}
              {auditResult.prixSuspects && (
                <div className={`p-4 rounded-lg border ${
                  auditResult.prixSuspects.count === 0
                    ? 'bg-green-900/30 border-green-800'
                    : auditResult.prixSuspects.errors > 0
                      ? 'bg-red-900/30 border-red-800'
                      : 'bg-orange-900/30 border-orange-800'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {auditResult.prixSuspects.count === 0 ? (
                      <CheckCircle size={20} className="text-white" />
                    ) : (
                      <AlertCircle size={20} className="text-white" />
                    )}
                    <h3 className="font-semibold">5. Prix social suspects ({auditResult.prixSuspects.count})</h3>
                  </div>
                  {auditResult.prixSuspects.count === 0 ? (
                    <p className="text-sm text-white">Aucun prix social suspect détecté. Classification bulletin/forfait cohérente.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div className="p-2 bg-slate-800 rounded border border-slate-600">
                          <span className="text-white">Erreurs :</span>
                          <span className={`ml-2 font-bold ${auditResult.prixSuspects.errors > 0 ? 'text-white' : 'text-white'}`}>
                            {auditResult.prixSuspects.errors}
                          </span>
                        </div>
                        <div className="p-2 bg-slate-800 rounded border border-slate-600">
                          <span className="text-white">Avertissements :</span>
                          <span className="ml-2 font-bold text-white">{auditResult.prixSuspects.warnings}</span>
                        </div>
                      </div>
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {auditResult.prixSuspects.details.map((a, i) => (
                          <div key={i} className={`p-2 rounded border text-sm ${
                            a.severity === 'error'
                              ? 'bg-red-900/20 border-red-800'
                              : 'bg-orange-900/20 border-orange-800'
                          }`}>
                            <div className="flex items-center gap-2">
                              <span className={`inline-block w-2 h-2 rounded-full ${
                                a.severity === 'error' ? 'bg-red-500' : 'bg-orange-500'
                              }`} />
                              <span className="font-medium text-white">{a.client_nom}</span>
                              <span className="text-white">({a.client_cabinet})</span>
                            </div>
                            <div className="ml-4 text-white">
                              {a.message}
                            </div>
                            <div className="ml-4 text-white text-xs">
                              Ligne : {a.label} | Qté : {a.quantite} | Mt HT : {a.montant_ht?.toFixed(2)}€ | PU : {a.prix_unitaire?.toFixed(2)}€ | Axe : {a.axe}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Contenu onglet Réconciliation */}
      {activeTab === 'reconciliation' && (
        <div>
          {/* Bouton lancer */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={async () => {
                const cabinetsList = Object.entries(apiKeysMap).map(([cab, info]) => ({
                  cabinet: cab,
                  apiKey: info.api_key,
                  companyId: info.company_id || ''
                }));
                if (cabinetsList.length === 0) {
                  setError('Aucune clé API Pennylane configurée');
                  return;
                }
                setReconLoading(true);
                setReconData(null);
                try {
                  const data = await reconcilierDonnees(supabase, cabinetsList, setReconProgress);
                  setReconData(data);
                } catch (err) {
                  setError('Erreur réconciliation : ' + err.message);
                }
                setReconLoading(false);
              }}
              disabled={reconLoading || Object.keys(apiKeysMap).length === 0}
              className={`px-4 py-2 ${accentClasses.bg} text-white rounded-lg ${accentClasses.bgHover} flex items-center gap-2 disabled:opacity-50`}
            >
              {reconLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <GitCompare size={16} />
              )}
              Lancer la réconciliation (tous cabinets)
            </button>
            {reconLoading && reconProgress && (
              <span className="text-sm text-white">{reconProgress.message}</span>
            )}
            {reconData && !reconLoading && (
              <button
                onClick={() => handleExportReconciliation(reconData)}
                className="px-3 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 flex items-center gap-2 text-sm ml-auto"
              >
                <FileSpreadsheet size={16} />
                Export Excel
              </button>
            )}
          </div>

          {/* Résultats */}
          {reconData && !reconLoading && (() => {
            const stats = {
              iso: reconData.filter(r => r.statut === 'iso').length,
              ecart: reconData.filter(r => r.statut === 'ecart').length,
              pl_only: reconData.filter(r => r.statut === 'pl_only').length,
              db_only: reconData.filter(r => r.statut === 'db_only').length,
              no_sub: reconData.filter(r => r.statut === 'no_sub').length
            };
            const totalPL = reconData.reduce((s, r) => s + r.totalHTPL, 0);
            const totalDB = reconData.reduce((s, r) => s + r.totalHTDB, 0);
            const ecartTotal = Math.round((totalDB - totalPL) * 100) / 100;

            // Filtrage
            let filtered = reconData;
            if (reconFilter !== 'tous') {
              filtered = filtered.filter(r => r.statut === reconFilter);
            }
            if (reconSearch) {
              const s = reconSearch.toLowerCase();
              filtered = filtered.filter(r =>
                r.clientNom.toLowerCase().includes(s) ||
                r.customerPLName.toLowerCase().includes(s) ||
                (r.clientSiren && r.clientSiren.includes(s))
              );
            }

            // Tri
            const sorted = [...filtered].sort((a, b) => {
              const col = reconSort.column;
              const dir = reconSort.direction === 'asc' ? 1 : -1;
              if (col === 'statut') {
                const order = { pl_only: 0, db_only: 1, ecart: 2, no_sub: 3, iso: 4 };
                return ((order[a.statut] ?? 5) - (order[b.statut] ?? 5)) * dir;
              }
              if (col === 'clientNom') return a.clientNom.localeCompare(b.clientNom) * dir;
              if (col === 'customerPLName') return a.customerPLName.localeCompare(b.customerPLName) * dir;
              if (col === 'totalHTPL') return (a.totalHTPL - b.totalHTPL) * dir;
              if (col === 'totalHTDB') return (a.totalHTDB - b.totalHTDB) * dir;
              if (col === 'ecartHT') return (Math.abs(a.ecartHT) - Math.abs(b.ecartHT)) * dir;
              return 0;
            });

            const handleReconSort = (column) => {
              setReconSort(prev =>
                prev.column === column
                  ? { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                  : { column, direction: 'asc' }
              );
            };

            const SortIcon = ({ col }) => {
              if (reconSort.column !== col) return null;
              return reconSort.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
            };

            const statutLabel = { iso: 'ISO', ecart: 'Écart', pl_only: 'PL seul', db_only: 'DB seul', no_sub: 'Sans abo' };
            const statutBg = {
              iso: 'bg-green-900/30 text-green-400',
              ecart: 'bg-orange-900/30 text-orange-400',
              pl_only: 'bg-red-900/30 text-red-400',
              db_only: 'bg-purple-900/30 text-purple-400',
              no_sub: 'bg-slate-600/30 text-white'
            };

            return (
              <div className="space-y-6">
                {/* Cartes résumé */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <div className="bg-green-900/30 border border-green-800 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-400">{stats.iso}</div>
                    <div className="text-xs text-white">ISO</div>
                  </div>
                  <div className="bg-orange-900/30 border border-orange-800 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-orange-400">{stats.ecart}</div>
                    <div className="text-xs text-white">Écarts</div>
                  </div>
                  <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-red-400">{stats.pl_only}</div>
                    <div className="text-xs text-white">PL seul</div>
                  </div>
                  <div className="bg-purple-900/30 border border-purple-800 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-purple-400">{stats.db_only}</div>
                    <div className="text-xs text-white">DB seul</div>
                  </div>
                  <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-white">{Math.round(totalPL).toLocaleString('fr-FR')}€</div>
                    <div className="text-xs text-white">Total PL HT</div>
                  </div>
                  <div className={`border rounded-lg p-3 text-center ${Math.abs(ecartTotal) < 1 ? 'bg-green-900/30 border-green-800' : 'bg-orange-900/30 border-orange-800'}`}>
                    <div className={`text-lg font-bold ${Math.abs(ecartTotal) < 1 ? 'text-green-400' : 'text-orange-400'}`}>
                      {ecartTotal > 0 ? '+' : ''}{Math.round(ecartTotal).toLocaleString('fr-FR')}€
                    </div>
                    <div className="text-xs text-white">Écart DB-PL</div>
                  </div>
                </div>

                {/* Filtres */}
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={reconFilter}
                    onChange={(e) => setReconFilter(e.target.value)}
                    className="bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm"
                  >
                    <option value="tous">Tous ({reconData.length})</option>
                    <option value="iso">ISO ({stats.iso})</option>
                    <option value="ecart">Écarts ({stats.ecart})</option>
                    <option value="pl_only">PL seul ({stats.pl_only})</option>
                    <option value="db_only">DB seul ({stats.db_only})</option>
                    <option value="no_sub">Sans abo ({stats.no_sub})</option>
                  </select>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white" />
                    <input
                      type="text"
                      placeholder="Rechercher..."
                      value={reconSearch}
                      onChange={(e) => setReconSearch(e.target.value)}
                      className="bg-slate-700 border border-slate-600 text-white pl-9 pr-3 py-2 rounded-lg text-sm w-64"
                    />
                  </div>
                  <span className="text-sm text-white">{sorted.length} résultat(s)</span>
                </div>

                {/* Tableau */}
                <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-700/50">
                        <tr>
                          <th className="px-3 py-3 text-left text-white font-medium cursor-pointer hover:bg-slate-600/50 select-none" onClick={() => handleReconSort('statut')}>
                            <span className="flex items-center gap-1">Statut <SortIcon col="statut" /></span>
                          </th>
                          <th className="px-3 py-3 text-left text-white font-medium cursor-pointer hover:bg-slate-600/50 select-none" onClick={() => handleReconSort('clientNom')}>
                            <span className="flex items-center gap-1">Client (DB) <SortIcon col="clientNom" /></span>
                          </th>
                          <th className="px-3 py-3 text-left text-white font-medium cursor-pointer hover:bg-slate-600/50 select-none" onClick={() => handleReconSort('customerPLName')}>
                            <span className="flex items-center gap-1">Customer (PL) <SortIcon col="customerPLName" /></span>
                          </th>
                          <th className="px-3 py-3 text-center text-white font-medium">Match</th>
                          <th className="px-3 py-3 text-right text-white font-medium cursor-pointer hover:bg-slate-600/50 select-none" onClick={() => handleReconSort('totalHTDB')}>
                            <span className="flex items-center justify-end gap-1">HT DB <SortIcon col="totalHTDB" /></span>
                          </th>
                          <th className="px-3 py-3 text-right text-white font-medium cursor-pointer hover:bg-slate-600/50 select-none" onClick={() => handleReconSort('totalHTPL')}>
                            <span className="flex items-center justify-end gap-1">HT PL <SortIcon col="totalHTPL" /></span>
                          </th>
                          <th className="px-3 py-3 text-right text-white font-medium cursor-pointer hover:bg-slate-600/50 select-none" onClick={() => handleReconSort('ecartHT')}>
                            <span className="flex items-center justify-end gap-1">Écart <SortIcon col="ecartHT" /></span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((r, idx) => (
                          <React.Fragment key={idx}>
                            <tr
                              className="border-t border-slate-700 hover:bg-slate-700/30 cursor-pointer transition"
                              onClick={() => setReconExpanded(reconExpanded === idx ? null : idx)}
                            >
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statutBg[r.statut]}`}>
                                  {statutLabel[r.statut]}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-white font-medium">{r.clientNom}</td>
                              <td className="px-3 py-2 text-white">{r.customerPLName}</td>
                              <td className="px-3 py-2 text-center">
                                {r.matchLevelLabel ? (
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    r.matchLevel === 'uuid' || r.matchLevel === 'siren' ? 'bg-blue-900/30 text-blue-400' :
                                    r.matchLevel === 'name_exact' || r.matchLevel === 'name_clean' ? 'bg-green-900/30 text-green-400' :
                                    'bg-orange-900/30 text-orange-400'
                                  }`}>
                                    {r.matchLevelLabel}
                                  </span>
                                ) : (
                                  <span className="text-white">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right text-white">{r.totalHTDB.toLocaleString('fr-FR')}€</td>
                              <td className="px-3 py-2 text-right text-white">{r.totalHTPL.toLocaleString('fr-FR')}€</td>
                              <td className={`px-3 py-2 text-right font-medium ${
                                Math.abs(r.ecartHT) < 1 ? 'text-green-400' :
                                r.ecartHT > 0 ? 'text-orange-400' : 'text-red-400'
                              }`}>
                                {r.ecartHT > 0 ? '+' : ''}{r.ecartHT.toLocaleString('fr-FR')}€
                              </td>
                            </tr>
                            {/* Détail expandable */}
                            {reconExpanded === idx && (
                              <tr>
                                <td colSpan={7} className="bg-slate-900/50 px-4 py-3 border-t border-slate-600">
                                  <div className="grid grid-cols-2 gap-6">
                                    {/* DB */}
                                    <div>
                                      <h4 className="text-white font-medium mb-2">Base locale ({r.nbAbosDB} abo{r.nbAbosDB > 1 ? 's' : ''})</h4>
                                      {r.abosDB.length === 0 ? (
                                        <p className="text-white text-sm">Aucun abonnement</p>
                                      ) : (
                                        <div className="space-y-1">
                                          {r.abosDB.map((a, i) => (
                                            <div key={i} className="flex justify-between text-sm bg-slate-800/50 px-3 py-1.5 rounded">
                                              <span className="text-white">{a.label || '(sans label)'}</span>
                                              <span className="text-white font-medium">{a.totalHT.toLocaleString('fr-FR')}€ <span className="text-white text-xs">({a.status})</span></span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    {/* PL */}
                                    <div>
                                      <h4 className="text-white font-medium mb-2">Pennylane ({r.nbAbosPL} abo{r.nbAbosPL > 1 ? 's' : ''})</h4>
                                      {r.abosPL.length === 0 ? (
                                        <p className="text-white text-sm">Aucun abonnement</p>
                                      ) : (
                                        <div className="space-y-1">
                                          {r.abosPL.map((a, i) => (
                                            <div key={i} className="flex justify-between text-sm bg-slate-800/50 px-3 py-1.5 rounded">
                                              <span className="text-white">{a.label || '(sans label)'}</span>
                                              <span className="text-white font-medium">{a.totalHT.toLocaleString('fr-FR')}€ <span className="text-white text-xs">({a.status})</span></span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {r.reassignedPL?.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-slate-600">
                                          <h5 className="text-white text-xs mb-1">Réassignés en local (exclus du calcul) :</h5>
                                          {r.reassignedPL.map((a, i) => (
                                            <div key={i} className="flex justify-between text-xs bg-slate-700/30 px-3 py-1 rounded text-white">
                                              <span>{a.label}</span>
                                              <span>{a.totalHT.toLocaleString('fr-FR')}€</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Contenu onglet Vue (existant) */}
      {activeTab === 'vue' && (<>

      {/* Badge en construction */}
      <div className="mb-6 p-4 bg-orange-900/30 rounded-lg border border-orange-800 flex items-center gap-3">
        <span className="text-2xl">🚧</span>
        <div>
          <p className="font-medium text-white">Page en construction</p>
          <p className="text-sm text-white">
            Utilisez l'onglet <span className="font-semibold">Augmentation</span> pour l'analyse complète des honoraires.
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div>
          <label className="block text-sm text-white mb-1">Rechercher</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Nom du client..."
            className="px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg w-64"
          />
        </div>
        <div>
          <label className="block text-sm text-white mb-1">Cabinet</label>
          <select
            value={filterCabinet}
            onChange={(e) => setFilterCabinet(e.target.value)}
            className="px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg"
          >
            <option value="tous">Tous</option>
            <option value="Zerah Fiduciaire">Zerah Fiduciaire</option>
            <option value="Audit Up">Audit Up</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-white mb-1">Statut abonnements</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg"
          >
            <option value="tous">Tous</option>
            <option value="in_progress">En cours</option>
            <option value="not_started">À venir</option>
            <option value="stopped">Arrêté</option>
          </select>
        </div>
        <div className="ml-auto self-end">
          <button
            onClick={handleExportVueClient}
            disabled={honorairesParClient.length === 0}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
          >
            <Download size={14} />
            Export Excel
          </button>
        </div>
      </div>

      {/* Totaux */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
          <p className="text-sm text-white">Clients</p>
          <p className="text-2xl font-bold">{honorairesParClient.length}</p>
        </div>
        <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
          <p className="text-sm text-white">Total HT</p>
          <p className="text-2xl font-bold">{totaux.total_ht.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</p>
        </div>
        <div className="p-4 bg-blue-900/30 rounded-lg border border-blue-800">
          <p className="text-sm text-white">Comptabilité</p>
          <p className="text-xl font-bold text-white">{totaux.comptabilite.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</p>
        </div>
        <div className="p-4 bg-green-900/30 rounded-lg border border-green-800">
          <p className="text-sm text-white">Social</p>
          <p className="text-xl font-bold text-white">{totaux.social.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</p>
        </div>
        <div className="p-4 bg-purple-900/30 rounded-lg border border-purple-800">
          <p className="text-sm text-white">Juridique</p>
          <p className="text-xl font-bold text-white">{totaux.juridique.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</p>
        </div>
        <div className="p-4 bg-slate-700 rounded-lg border border-slate-700">
          <p className="text-sm text-white">Support</p>
          <p className="text-xl font-bold text-white">{totaux.support.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</p>
        </div>
      </div>

      {/* Liste des honoraires par client */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={32} className="animate-spin text-white" />
        </div>
      ) : honorairesParClient.length === 0 ? (
        <div className="text-center py-12 text-white">
          <p>Aucun client trouvé.</p>
          <p className="text-sm mt-2">Lancez une synchronisation Pennylane pour importer les données.</p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-slate-700 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-white">Client</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-white">Cabinet</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-white">Abon.</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-white">Compta</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-white">Social</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-white">Juridique</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-white">Total HT</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-white">Mensuel</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-white"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {honorairesParClient.map(client => (
                <React.Fragment key={client.client_id}>
                  <tr className="hover:bg-slate-600">
                    <td className="px-4 py-3">
                      <div className="font-medium">{client.client_nom}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">{client.client_cabinet}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 bg-slate-600 rounded text-sm">
                        {client.abonnements.length}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-white">
                      {(client.totaux_par_famille?.comptabilite || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-white">
                      {(client.totaux_par_famille?.social || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-white">
                      {(client.totaux_par_famille?.juridique || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {(client.total_ht || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-white">
                      {(client.total_mensuel_ht || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €/mois
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setExpandedClient(expandedClient === client.client_id ? null : client.client_id)}
                        className="p-1 hover:bg-slate-600 rounded"
                      >
                        {expandedClient === client.client_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </td>
                  </tr>
                  {expandedClient === client.client_id && (
                    <tr>
                      <td colSpan={9} className="px-4 py-3 bg-slate-700">
                        <div className="text-sm">
                          <h4 className="font-medium mb-3">Détail des abonnements ({client.abonnements.length})</h4>
                          {client.abonnements.map(abo => (
                            <div key={abo.id} className="mb-4 p-3 bg-slate-800 rounded border border-slate-600">
                              <div className="flex justify-between items-center mb-2">
                                <div>
                                  <span className="font-medium">{abo.label}</span>
                                  <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                                    abo.status === 'in_progress' ? 'bg-green-900/50 text-white' :
                                    abo.status === 'not_started' ? 'bg-blue-900/50 text-white' :
                                    'bg-slate-600 text-white'
                                  }`}>
                                    {abo.status === 'in_progress' ? 'En cours' :
                                     abo.status === 'not_started' ? 'À venir' :
                                     abo.status === 'stopped' ? 'Arrêté' : abo.status}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="font-medium">{(abo.total_ht || 0).toLocaleString('fr-FR')} € HT</span>
                                  <span className="text-white ml-2">
                                    ({abo.frequence === 'monthly' ? 'Mensuel' : 'Annuel'}
                                    {abo.intervalle > 1 && ` x${abo.intervalle}`})
                                  </span>
                                </div>
                              </div>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-white text-xs">
                                    <th className="text-left py-1">Produit</th>
                                    <th className="text-left py-1">Famille</th>
                                    <th className="text-right py-1">Qté</th>
                                    <th className="text-right py-1">HT</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(abo.abonnements_lignes || []).map(ligne => (
                                    <tr key={ligne.id}>
                                      <td className="py-1">{ligne.label}</td>
                                      <td className="py-1">
                                        <span className={`px-2 py-0.5 rounded text-xs ${
                                          ligne.famille === 'comptabilite' ? 'bg-blue-900/50 text-white' :
                                          ligne.famille === 'social' ? 'bg-green-900/50 text-white' :
                                          ligne.famille === 'juridique' ? 'bg-purple-900/50 text-white' :
                                          'bg-slate-600 text-white'
                                        }`}>
                                          {ligne.famille}
                                        </span>
                                      </td>
                                      <td className="py-1 text-right">{ligne.quantite}</td>
                                      <td className="py-1 text-right">{(ligne.montant_ht || 0).toLocaleString('fr-FR')} €</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Clients sans abonnement */}
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
              Vérifiez s'ils ont un abonnement dans Pennylane ou s'ils doivent être désactivés.
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
                    <span className="font-medium">{client.nom}</span>
                    {client.pennylane_customer_id ? (
                      <span className="text-xs px-1.5 py-0.5 bg-yellow-900/50 text-white rounded" title="Client lié à Pennylane mais sans abonnement">
                        PL sans abo
                      </span>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 bg-slate-600 text-white rounded" title="Client non lié à Pennylane">
                        Pas dans PL
                      </span>
                    )}
                  </div>
                  <span className="text-white text-xs">{client.cabinet || '-'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      </>)}

      {/* Modal de prévisualisation sync */}
      {showPreviewModal && previewReport && (
        <SyncPreviewModal
          report={previewReport}
          onAccept={handleCommitSync}
          onCancel={handleCancelSync}
          accepting={committing}
        />
      )}
    </div>
  );
}

export default HonorairesPage;
