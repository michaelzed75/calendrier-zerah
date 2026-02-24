// @ts-check
import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp, Download, TrendingUp, BarChart3, ShieldCheck, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../supabaseClient';
import { syncCustomersAndSubscriptions, getHonorairesResume, testConnection, auditAbonnements } from '../../utils/honoraires';
import AugmentationPanel from '../honoraires/AugmentationPanel';

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
  const [activeTab, setActiveTab] = useState('vue'); // 'vue' | 'augmentation' | 'audit'

  // Filtres
  const [filterCabinet, setFilterCabinet] = useState('tous');
  const [filterStatus, setFilterStatus] = useState('tous');
  const [expandedClient, setExpandedClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Clé API (temporaire pour test - à déplacer vers settings)
  const [apiKey, setApiKey] = useState('');
  const [apiCabinet, setApiCabinet] = useState(''); // Cabinet associé à la clé API
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);

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
    if (!apiKey) return;

    setTestingConnection(true);
    setConnectionStatus(null);

    const result = await testConnection(apiKey);
    setConnectionStatus(result.success ? 'success' : 'error');

    if (!result.success) {
      setError(result.error);
    }

    setTestingConnection(false);
  };

  /**
   * Lance la synchronisation Pennylane
   */
  const handleSync = async () => {
    if (!apiKey || !apiCabinet) {
      setShowApiKeyInput(true);
      if (!apiCabinet) {
        setError('Veuillez sélectionner le cabinet associé à cette clé API');
      }
      return;
    }

    setSyncing(true);
    setSyncProgress(null);
    setSyncResult(null);
    setError(null);

    try {
      const result = await syncCustomersAndSubscriptions(
        supabase,
        apiKey,
        apiCabinet,
        (progress) => {
          setSyncProgress(progress);
        }
      );

      setSyncResult(result);

      // Recharger les clients et honoraires
      const { data: newClients } = await supabase.from('clients').select('*').order('nom');
      if (newClients) setClients(newClients);

      await loadHonoraires();

    } catch (err) {
      console.error('Erreur sync:', err);
      setError(err.message);
    }

    setSyncing(false);
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
    // Filtrer d'abord par statut
    const filtered = honoraires.filter(h => {
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
  }, [honoraires, filterCabinet, filterStatus, searchTerm]);

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
      </div>

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
              <span className="text-sm text-white">
                Dernier audit : {new Date(auditResult.timestamp).toLocaleString('fr-FR')}
              </span>
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
            </div>
          )}
        </div>
      )}

      {/* Contenu onglet Vue (existant) */}
      {activeTab === 'vue' && (<>

      {/* Input clé API */}
      {showApiKeyInput && (
        <div className="mb-6 p-4 bg-slate-700 rounded-lg border border-slate-600">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Cabinet
              </label>
              <select
                value={apiCabinet}
                onChange={(e) => setApiCabinet(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Sélectionner le cabinet...</option>
                <option value="Zerah Fiduciaire">Zerah Fiduciaire</option>
                <option value="Audit Up">Audit Up</option>
              </select>
              <p className="mt-1 text-xs text-white">
                Les clients synchronisés seront associés à ce cabinet
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Clé API Pennylane v2
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Entrez votre clé API Pennylane..."
                  className="flex-1 px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={handleTestConnection}
                  disabled={!apiKey || testingConnection}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 disabled:opacity-50"
                >
                  {testingConnection ? <Loader2 size={16} className="animate-spin" /> : 'Tester'}
                </button>
              </div>
              {connectionStatus === 'success' && (
                <p className="mt-2 text-white text-sm flex items-center gap-1">
                  <CheckCircle size={14} /> Connexion réussie
                </p>
              )}
              {connectionStatus === 'error' && (
                <p className="mt-2 text-white text-sm flex items-center gap-1">
                  <AlertCircle size={14} /> Connexion échouée
                </p>
              )}
            </div>
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
          <h3 className="font-medium mb-2">Résultat de la synchronisation</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-white">Customers matchés:</span>
              <span className="ml-2 font-medium">{syncResult.customersMatched}</span>
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
              <span className="ml-2 font-medium">{syncResult.abonnementsUpdated}</span>
            </div>
          </div>
          {syncResult.unmatchedCustomers.length > 0 && (
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
          {syncResult.errors.length > 0 && (
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
    </div>
  );
}

export default HonorairesPage;
