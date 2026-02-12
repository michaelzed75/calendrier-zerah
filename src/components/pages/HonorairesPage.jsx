// @ts-check
import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../supabaseClient';
import { syncCustomersAndSubscriptions, getHonorairesResume, testConnection } from '../../utils/honoraires';

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
    bgLight: `bg-${accent}-50`,
    text: `text-${accent}-600`,
    border: `border-${accent}-200`
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
          <h1 className="text-2xl font-bold text-gray-900">Honoraires</h1>
          <p className="text-gray-600">Gestion des abonnements et facturation - Vue par client</p>
        </div>

        <div className="flex gap-2">
          {/* Bouton configuration API */}
          <button
            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
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

      {/* Input clé API */}
      {showApiKeyInput && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cabinet
              </label>
              <select
                value={apiCabinet}
                onChange={(e) => setApiCabinet(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Sélectionner le cabinet...</option>
                <option value="Zerah Fiduciaire">Zerah Fiduciaire</option>
                <option value="Audit Up">Audit Up</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Les clients synchronisés seront associés à ce cabinet
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Clé API Pennylane v2
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Entrez votre clé API Pennylane..."
                  className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={handleTestConnection}
                  disabled={!apiKey || testingConnection}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                >
                  {testingConnection ? <Loader2 size={16} className="animate-spin" /> : 'Tester'}
                </button>
              </div>
              {connectionStatus === 'success' && (
                <p className="mt-2 text-green-600 text-sm flex items-center gap-1">
                  <CheckCircle size={14} /> Connexion réussie
                </p>
              )}
              {connectionStatus === 'error' && (
                <p className="mt-2 text-red-600 text-sm flex items-center gap-1">
                  <AlertCircle size={14} /> Connexion échouée
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Progression sync */}
      {syncing && syncProgress && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2">
            <Loader2 size={16} className="animate-spin text-blue-600" />
            <span className="text-blue-800">{syncProgress.message}</span>
          </div>
        </div>
      )}

      {/* Résultat sync */}
      {syncResult && (
        <div className={`mb-6 p-4 rounded-lg border ${syncResult.errors.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
          <h3 className="font-medium mb-2">Résultat de la synchronisation</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Customers matchés:</span>
              <span className="ml-2 font-medium">{syncResult.customersMatched}</span>
            </div>
            <div>
              <span className="text-gray-600">Non matchés:</span>
              <span className="ml-2 font-medium text-orange-600">{syncResult.customersNotMatched}</span>
            </div>
            <div>
              <span className="text-gray-600">Abonnements créés:</span>
              <span className="ml-2 font-medium text-green-600">{syncResult.abonnementsCreated}</span>
            </div>
            <div>
              <span className="text-gray-600">Abonnements MAJ:</span>
              <span className="ml-2 font-medium">{syncResult.abonnementsUpdated}</span>
            </div>
          </div>
          {syncResult.unmatchedCustomers.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-orange-600">
                {syncResult.unmatchedCustomers.length} customers non matchés (avec abonnements)
              </summary>
              <p className="mt-1 text-xs text-gray-500">Ces customers ont des abonnements mais ne correspondent à aucun client local</p>
              <ul className="mt-2 text-sm text-gray-600 max-h-40 overflow-y-auto">
                {syncResult.unmatchedCustomers.map(c => (
                  <li key={c.id}>{c.name} ({c.external_reference || 'pas de ref'})</li>
                ))}
              </ul>
            </details>
          )}
          {syncResult.customersNoSubscription?.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-gray-500">
                {syncResult.customersNoSubscription.length} customers ignorés (sans abonnement)
              </summary>
              <p className="mt-1 text-xs text-gray-500">Ces customers existent dans Pennylane mais n'ont pas d'abonnement actif</p>
              <ul className="mt-2 text-sm text-gray-400 max-h-40 overflow-y-auto">
                {syncResult.customersNoSubscription.map(c => (
                  <li key={c.id}>{c.name}</li>
                ))}
              </ul>
            </details>
          )}
          {syncResult.errors.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-red-600">
                {syncResult.errors.length} erreurs
              </summary>
              <ul className="mt-2 text-sm text-red-600 max-h-40 overflow-y-auto">
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
        <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200 text-red-800">
          <AlertCircle size={16} className="inline mr-2" />
          {error}
        </div>
      )}

      {/* Filtres */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Rechercher</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Nom du client..."
            className="px-3 py-2 border rounded-lg w-64"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Cabinet</label>
          <select
            value={filterCabinet}
            onChange={(e) => setFilterCabinet(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="tous">Tous</option>
            <option value="Zerah Fiduciaire">Zerah Fiduciaire</option>
            <option value="Audit Up">Audit Up</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Statut abonnements</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border rounded-lg"
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
        <div className="p-4 bg-white rounded-lg border shadow-sm">
          <p className="text-sm text-gray-600">Clients</p>
          <p className="text-2xl font-bold">{honorairesParClient.length}</p>
        </div>
        <div className="p-4 bg-white rounded-lg border shadow-sm">
          <p className="text-sm text-gray-600">Total HT</p>
          <p className="text-2xl font-bold">{totaux.total_ht.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</p>
        </div>
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-600">Comptabilité</p>
          <p className="text-xl font-bold text-blue-800">{totaux.comptabilite.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <p className="text-sm text-green-600">Social</p>
          <p className="text-xl font-bold text-green-800">{totaux.social.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</p>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
          <p className="text-sm text-purple-600">Juridique</p>
          <p className="text-xl font-bold text-purple-800">{totaux.juridique.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">Support</p>
          <p className="text-xl font-bold text-gray-800">{totaux.support.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</p>
        </div>
      </div>

      {/* Liste des honoraires par client */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={32} className="animate-spin text-gray-400" />
        </div>
      ) : honorairesParClient.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>Aucun client trouvé.</p>
          <p className="text-sm mt-2">Lancez une synchronisation Pennylane pour importer les données.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Client</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Cabinet</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Abon.</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Compta</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Social</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Juridique</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Total HT</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Mensuel</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {honorairesParClient.map(client => (
                <React.Fragment key={client.client_id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{client.client_nom}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">{client.client_cabinet}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-1 bg-gray-100 rounded text-sm">
                        {client.abonnements.length}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-blue-600">
                      {(client.totaux_par_famille?.comptabilite || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-green-600">
                      {(client.totaux_par_famille?.social || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-purple-600">
                      {(client.totaux_par_famille?.juridique || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {(client.total_ht || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500">
                      {(client.total_mensuel_ht || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €/mois
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setExpandedClient(expandedClient === client.client_id ? null : client.client_id)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        {expandedClient === client.client_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </td>
                  </tr>
                  {expandedClient === client.client_id && (
                    <tr>
                      <td colSpan={9} className="px-4 py-3 bg-gray-50">
                        <div className="text-sm">
                          <h4 className="font-medium mb-3">Détail des abonnements ({client.abonnements.length})</h4>
                          {client.abonnements.map(abo => (
                            <div key={abo.id} className="mb-4 p-3 bg-white rounded border">
                              <div className="flex justify-between items-center mb-2">
                                <div>
                                  <span className="font-medium">{abo.label}</span>
                                  <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                                    abo.status === 'in_progress' ? 'bg-green-100 text-green-800' :
                                    abo.status === 'not_started' ? 'bg-blue-100 text-blue-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {abo.status === 'in_progress' ? 'En cours' :
                                     abo.status === 'not_started' ? 'À venir' :
                                     abo.status === 'stopped' ? 'Arrêté' : abo.status}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="font-medium">{(abo.total_ht || 0).toLocaleString('fr-FR')} € HT</span>
                                  <span className="text-gray-500 ml-2">
                                    ({abo.frequence === 'monthly' ? 'Mensuel' : 'Annuel'}
                                    {abo.intervalle > 1 && ` x${abo.intervalle}`})
                                  </span>
                                </div>
                              </div>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-gray-500 text-xs">
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
                                          ligne.famille === 'comptabilite' ? 'bg-blue-100 text-blue-800' :
                                          ligne.famille === 'social' ? 'bg-green-100 text-green-800' :
                                          ligne.famille === 'juridique' ? 'bg-purple-100 text-purple-800' :
                                          'bg-gray-100 text-gray-800'
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
              <h2 className="text-lg font-semibold text-gray-900">
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
          <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
            <p className="text-sm text-orange-800 mb-4">
              Ces clients sont actifs dans la base mais n'ont pas d'abonnement Pennylane synchronisé.
              Vérifiez s'ils ont un abonnement dans Pennylane ou s'ils doivent être désactivés.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {clientsSansAbonnement.map(client => (
                <div
                  key={client.id}
                  className={`px-3 py-2 rounded border text-sm ${
                    client.pennylane_customer_id
                      ? 'bg-yellow-50 border-yellow-300'
                      : 'bg-white border-orange-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{client.nom}</span>
                    {client.pennylane_customer_id ? (
                      <span className="text-xs px-1.5 py-0.5 bg-yellow-200 text-yellow-800 rounded" title="Client lié à Pennylane mais sans abonnement">
                        PL sans abo
                      </span>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded" title="Client non lié à Pennylane">
                        Pas dans PL
                      </span>
                    )}
                  </div>
                  <span className="text-gray-500 text-xs">{client.cabinet || '-'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HonorairesPage;
