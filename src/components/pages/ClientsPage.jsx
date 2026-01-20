// @ts-check
import React, { useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, Check, Download, Key, X, Loader2, CheckCircle, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { ClientModal, MergeClientModal } from '../modals';
import { testConnection } from '../../utils/testsComptables/pennylaneClientApi.js';

/**
 * @typedef {import('../../types.js').Client} Client
 * @typedef {import('../../types.js').Charge} Charge
 * @typedef {import('../../types.js').Collaborateur} Collaborateur
 * @typedef {import('../../types.js').AccentColor} AccentColor
 * @typedef {import('../../types.js').ClientsPageProps} ClientsPageProps
 */

/**
 * Page de gestion des clients
 * @param {ClientsPageProps} props
 * @returns {JSX.Element}
 */
function ClientsPage({ clients, setClients, charges, setCharges, collaborateurs, accent, userCollaborateur }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [mergingClient, setMergingClient] = useState(null);
  const [filterCabinet, setFilterCabinet] = useState('tous');
  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

  // États pour la modal API Key
  const [apiKeyModalClient, setApiKeyModalClient] = useState(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [testingApiKey, setTestingApiKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState(/** @type {'idle'|'success'|'error'|'testing'} */ ('idle'));
  const [apiKeyError, setApiKeyError] = useState('');

  // Chefs de mission pour l'assignation
  const chefsMission = collaborateurs.filter(c => c.est_chef_mission && c.actif);

  // Peut synchroniser : admin ou chef de mission
  const canSync = userCollaborateur?.is_admin || userCollaborateur?.est_chef_mission;

  // Synchronisation Pennylane via API serverless
  const handleSyncPennylane = async () => {
    setSyncing(true);
    setSyncMessage(null);

    try {
      const response = await fetch('/api/sync-pennylane', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur de synchronisation');
      }

      // Recharger les clients
      const { data: newClients } = await supabase.from('clients').select('*').order('id');
      if (newClients) setClients(newClients);

      setSyncMessage({
        type: 'success',
        text: `Sync terminée ! ${result.total} dossiers Pennylane. ${result.imported} nouveaux, ${result.updated} mis à jour, ${result.deactivated} désactivés.`
      });
    } catch (err) {
      console.error('Erreur sync:', err);
      setSyncMessage({ type: 'error', text: err.message || 'Erreur lors de la synchronisation' });
    }

    setSyncing(false);
  };

  // Fusionner un client sans cabinet vers un client Pennylane
  const handleMergeClient = async (sourceId, targetId) => {
    try {
      // Transférer toutes les charges du client source vers le client cible
      const { error: chargesError } = await supabase
        .from('charges')
        .update({ client_id: targetId })
        .eq('client_id', sourceId);

      if (chargesError) throw chargesError;

      // Supprimer le client source (sans cabinet)
      const { error: deleteError } = await supabase
        .from('clients')
        .delete()
        .eq('id', sourceId);

      if (deleteError) throw deleteError;

      // Mettre à jour le state local
      setClients(prev => prev.filter(c => c.id !== sourceId));
      setCharges(prev => prev.map(c =>
        c.client_id === sourceId ? { ...c, client_id: targetId } : c
      ));

      alert('Fusion réussie ! Les charges ont été transférées.');
    } catch (err) {
      console.error('Erreur fusion:', err);
      alert('Erreur lors de la fusion');
    }
    setMergingClient(null);
  };

  // Assigner un chef de mission à un client
  const handleAssignChef = async (clientId, chefId) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({ chef_mission_id: chefId || null })
        .eq('id', clientId);

      if (error) throw error;

      setClients(prev => prev.map(c =>
        c.id === clientId ? { ...c, chef_mission_id: chefId || null } : c
      ));
    } catch (err) {
      console.error('Erreur assignation chef:', err);
      alert('Erreur lors de l\'assignation');
    }
  };

  const handleAddClient = async (nom, codePennylane) => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert([{ nom, code_pennylane: codePennylane, actif: true }])
        .select();

      if (error) throw error;

      setClients(prev => [...prev, data[0]]);
    } catch (err) {
      console.error('Erreur ajout client:', err);
      alert('Erreur lors de l\'ajout');
    }
    setShowAddModal(false);
  };

  const handleUpdateClient = async (id, nom, codePennylane) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({ nom, code_pennylane: codePennylane })
        .eq('id', id);

      if (error) throw error;

      setClients(prev => prev.map(c =>
        c.id === id ? { ...c, nom, code_pennylane: codePennylane } : c
      ));
    } catch (err) {
      console.error('Erreur mise à jour client:', err);
      alert('Erreur lors de la mise à jour');
    }
    setEditingClient(null);
  };

  const handleToggleActif = async (id) => {
    const client = clients.find(c => c.id === id);
    
    if (client.actif) {
      const hasCharges = charges.some(c => c.client_id === id);
      if (hasCharges) {
        if (!confirm('Ce client a des charges. Voulez-vous vraiment le désactiver ?')) {
          return;
        }
      }
    }
    
    try {
      const { error } = await supabase
        .from('clients')
        .update({ actif: !client.actif })
        .eq('id', id);
      
      if (error) throw error;
      
      setClients(prev => prev.map(c =>
        c.id === id ? { ...c, actif: !c.actif } : c
      ));
    } catch (err) {
      console.error('Erreur toggle actif:', err);
    }
  };


  const handleDeleteClient = async (id) => {
    const client = clients.find(c => c.id === id);
    
    const hasCharges = charges.some(c => c.client_id === id);
    if (hasCharges) {
      alert('Impossible de supprimer : ce client a des charges. Désactivez-le plutôt.');
      return;
    }
    
    if (confirm(`Supprimer définitivement ${client.nom} ?`)) {
      try {
        const { error } = await supabase
          .from('clients')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        
        setClients(prev => prev.filter(c => c.id !== id));
      } catch (err) {
        console.error('Erreur suppression:', err);
        alert('Erreur lors de la suppression');
      }
    }
  };

  const getChargesCount = (clientId) => {
    return charges.filter(c => c.client_id === clientId).length;
  };

  // Ouvrir la modal pour configurer la clé API
  const openApiKeyModal = (client) => {
    setApiKeyModalClient(client);
    setApiKeyInput(client.pennylane_client_api_key || '');
    setApiKeyStatus('idle');
    setApiKeyError('');
  };

  // Tester la clé API
  const handleTestApiKey = async () => {
    if (!apiKeyInput.trim()) {
      setApiKeyError('Veuillez entrer une clé API');
      return;
    }

    setTestingApiKey(true);
    setApiKeyStatus('testing');
    setApiKeyError('');

    try {
      const result = await testConnection(apiKeyInput.trim());

      if (result.success) {
        setApiKeyStatus('success');
        setApiKeyError('');
      } else {
        setApiKeyStatus('error');
        setApiKeyError(result.error || 'Connexion échouée');
      }
    } catch (err) {
      setApiKeyStatus('error');
      setApiKeyError(err instanceof Error ? err.message : 'Erreur de test');
    }

    setTestingApiKey(false);
  };

  // Sauvegarder la clé API (avec test préalable)
  const handleSaveApiKey = async () => {
    if (!apiKeyModalClient) return;

    // Si clé vide, on supprime directement
    if (!apiKeyInput.trim()) {
      setSavingApiKey(true);
      try {
        const { error } = await supabase
          .from('clients')
          .update({ pennylane_client_api_key: null })
          .eq('id', apiKeyModalClient.id);

        if (error) throw error;

        setClients(prev => prev.map(c =>
          c.id === apiKeyModalClient.id
            ? { ...c, pennylane_client_api_key: null }
            : c
        ));

        setApiKeyStatus('success');
        setTimeout(() => {
          setApiKeyModalClient(null);
          setApiKeyInput('');
          setApiKeyStatus('idle');
          setApiKeyError('');
        }, 1000);
      } catch (err) {
        console.error('Erreur suppression API key:', err);
        setApiKeyStatus('error');
        setApiKeyError('Erreur lors de la suppression');
      }
      setSavingApiKey(false);
      return;
    }

    // Tester d'abord si pas encore fait
    if (apiKeyStatus !== 'success') {
      setTestingApiKey(true);
      setApiKeyStatus('testing');
      setApiKeyError('');

      try {
        const result = await testConnection(apiKeyInput.trim());

        if (!result.success) {
          setApiKeyStatus('error');
          setApiKeyError(result.error || 'La clé API est invalide');
          setTestingApiKey(false);
          return;
        }
      } catch (err) {
        setApiKeyStatus('error');
        setApiKeyError(err instanceof Error ? err.message : 'Erreur de test');
        setTestingApiKey(false);
        return;
      }
      setTestingApiKey(false);
    }

    // Sauvegarder en BDD
    setSavingApiKey(true);

    try {
      const { error } = await supabase
        .from('clients')
        .update({ pennylane_client_api_key: apiKeyInput.trim() })
        .eq('id', apiKeyModalClient.id);

      if (error) throw error;

      setClients(prev => prev.map(c =>
        c.id === apiKeyModalClient.id
          ? { ...c, pennylane_client_api_key: apiKeyInput.trim() }
          : c
      ));

      setApiKeyStatus('success');
      setTimeout(() => {
        setApiKeyModalClient(null);
        setApiKeyInput('');
        setApiKeyStatus('idle');
        setApiKeyError('');
      }, 1500);
    } catch (err) {
      console.error('Erreur sauvegarde API key:', err);
      setApiKeyStatus('error');
      setApiKeyError('Erreur lors de la sauvegarde en base de données');
    }

    setSavingApiKey(false);
  };

  // Obtenir le nom du chef de mission
  const getChefName = (chefId) => {
    const chef = collaborateurs.find(c => c.id === chefId);
    return chef ? chef.nom : null;
  };

  // Obtenir les cabinets uniques
  const cabinets = [...new Set(clients.filter(c => c.cabinet).map(c => c.cabinet))];

  // Filtrer et trier les clients (tri alphabétique par défaut)
  const filteredClients = [...clients]
    .filter(client => {
      const matchesCabinet = filterCabinet === 'tous' || client.cabinet === filterCabinet || (filterCabinet === 'autres' && !client.cabinet);
      const matchesSearch = client.nom.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCabinet && matchesSearch;
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

  // Export Excel
  const handleExportExcel = () => {
    const dataToExport = filteredClients.map(client => ({
      'Nom': client.nom,
      'Code Pennylane': client.code_pennylane || '',
      'Cabinet': client.cabinet || '',
      'Chef de mission': getChefName(client.chef_mission_id) || 'Non assigné',
      'SIREN': client.siren || '',
      'Adresse': client.adresse || '',
      'Ville': client.ville || '',
      'Code postal': client.code_postal || '',
      'Charges': getChargesCount(client.id),
      'Actif': client.actif ? 'Oui' : 'Non'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');

    // Ajuster la largeur des colonnes
    ws['!cols'] = [
      { wch: 30 }, // Nom
      { wch: 15 }, // Code
      { wch: 15 }, // Cabinet
      { wch: 20 }, // Chef
      { wch: 12 }, // SIREN
      { wch: 30 }, // Adresse
      { wch: 20 }, // Ville
      { wch: 10 }, // CP
      { wch: 8 },  // Charges
      { wch: 6 }   // Actif
    ];

    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `clients_${date}.xlsx`);
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Gestion des Clients</h2>
            <p className="text-slate-400">Gérez vos clients et assignez un chef de mission</p>
          </div>
          <div className="flex gap-2">
            {canSync && (
              <button
                onClick={handleSyncPennylane}
                disabled={syncing}
                className={`${accent.color} ${accent.hover} text-white px-4 py-2 rounded-lg flex items-center gap-2 transition disabled:opacity-50`}
              >
                <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Sync...' : 'Sync Pennylane'}
              </button>
            )}
            <button
              onClick={handleExportExcel}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
            >
              <Download size={18} />
              Export Excel
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
            >
              <Plus size={18} />
              Ajouter
            </button>
          </div>
        </div>

        {/* Message de sync */}
        {syncMessage && (
          <div className={`mb-4 p-3 rounded-lg ${
            syncMessage.type === 'success' ? 'bg-green-500/20 border border-green-500 text-green-400' : 'bg-red-500/20 border border-red-500 text-red-400'
          }`}>
            {syncMessage.text}
          </div>
        )}

        {/* Filtres */}
        <div className="flex flex-wrap gap-4 mb-6">
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-white px-4 py-2 rounded-lg w-64"
          />
          <select
            value={filterCabinet}
            onChange={(e) => setFilterCabinet(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-white px-4 py-2 rounded-lg"
          >
            <option value="tous">Tous les cabinets</option>
            {cabinets.map(cab => (
              <option key={cab} value={cab}>{cab}</option>
            ))}
            <option value="autres">Sans cabinet</option>
          </select>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-700 text-slate-300">
                <th className="text-left py-3 px-4">Nom</th>
                <th className="text-left py-3 px-4">Cabinet</th>
                <th className="text-left py-3 px-4">Chef de mission</th>
                <th className="text-center py-3 px-4">Charges</th>
                <th className="text-center py-3 px-4">API</th>
                <th className="text-center py-3 px-4">Actif</th>
                <th className="text-center py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(client => {
                const chefName = getChefName(client.chef_mission_id);
                return (
                  <tr key={client.id} className={`border-t border-slate-700 ${!client.actif ? 'opacity-50' : ''}`}>
                    <td className="py-3 px-4">
                      <span className="text-white font-medium">{client.nom}</span>
                      {client.code_pennylane && (
                        <div className="text-slate-500 text-xs">{client.code_pennylane}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {client.cabinet ? (
                        <span className={`px-2 py-1 rounded text-xs ${
                          client.cabinet === 'Audit Up' ? 'bg-purple-600/30 text-purple-300' : 'bg-blue-600/30 text-blue-300'
                        }`}>
                          {client.cabinet}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-sm">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={client.chef_mission_id || ''}
                        onChange={(e) => handleAssignChef(client.id, e.target.value ? parseInt(e.target.value) : null)}
                        className="bg-slate-700 border border-slate-600 text-white px-2 py-1 rounded text-sm"
                      >
                        <option value="">Non assigné</option>
                        {chefsMission.map(chef => (
                          <option key={chef.id} value={chef.id}>{chef.nom}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {getChargesCount(client.id) > 0 ? (
                        <span className="bg-blue-600/30 text-blue-300 px-2 py-1 rounded text-sm">
                          {getChargesCount(client.id)}
                        </span>
                      ) : (
                        <span className="text-slate-500">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => openApiKeyModal(client)}
                        className={`p-1 rounded transition ${
                          client.pennylane_client_api_key
                            ? 'text-green-400 hover:bg-green-900/30'
                            : 'text-slate-500 hover:bg-slate-700'
                        }`}
                        title={client.pennylane_client_api_key ? 'Clé API configurée' : 'Configurer la clé API'}
                      >
                        <Key size={18} />
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleActif(client.id)}
                        className={`p-1 rounded transition ${client.actif ? 'text-green-400 hover:bg-green-900/30' : 'text-slate-500 hover:bg-slate-700'}`}
                      >
                        <Check size={18} />
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex justify-center gap-1">
                        {/* Bouton Fusionner - seulement pour clients sans cabinet */}
                        {!client.cabinet && (
                          <button
                            onClick={() => setMergingClient(client)}
                            className="text-orange-400 hover:text-orange-300 hover:bg-orange-900/30 p-1 rounded transition"
                            title="Fusionner avec un client Pennylane"
                          >
                            <Download size={16} className="rotate-90" />
                          </button>
                        )}
                        <button
                          onClick={() => setEditingClient(client)}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 p-1 rounded transition"
                          title="Modifier"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteClient(client.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-900/30 p-1 rounded transition"
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 mt-6">
          <p className="text-slate-400 text-sm">
            Affichés : {filteredClients.length} | Total : {clients.length} clients | Actifs : {clients.filter(c => c.actif).length}
          </p>
        </div>

        {showAddModal && (
          <ClientModal 
            onSave={handleAddClient}
            onClose={() => setShowAddModal(false)}
          />
        )}

        {editingClient && (
          <ClientModal
            client={editingClient}
            onSave={(nom, code, tva) => handleUpdateClient(editingClient.id, nom, code, tva)}
            onClose={() => setEditingClient(null)}
          />
        )}

        {/* Modal de fusion */}
        {mergingClient && (
          <MergeClientModal
            sourceClient={mergingClient}
            clients={clients}
            charges={charges}
            onMerge={handleMergeClient}
            onClose={() => setMergingClient(null)}
          />
        )}

        {/* Modal clé API Pennylane */}
        {apiKeyModalClient && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Key size={20} className="text-yellow-400" />
                  Clé API Pennylane
                </h3>
                <button
                  onClick={() => { setApiKeyModalClient(null); setApiKeyInput(''); setApiKeyStatus('idle'); setApiKeyError(''); }}
                  className="text-slate-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <p className="text-slate-400 text-sm mb-4">
                Configurez la clé API Pennylane pour le client <strong className="text-white">{apiKeyModalClient.nom}</strong>.
                Cette clé permet d'accéder aux données comptables (FEC, factures...) pour les tests.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-1">Clé API</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => { setApiKeyInput(e.target.value); setApiKeyStatus('idle'); setApiKeyError(''); }}
                    placeholder="pk_..."
                    className={`flex-1 bg-slate-700 text-white rounded px-3 py-2 border focus:outline-none ${
                      apiKeyStatus === 'success' ? 'border-green-500' :
                      apiKeyStatus === 'error' ? 'border-red-500' :
                      'border-slate-600 focus:border-blue-500'
                    }`}
                  />
                  <button
                    onClick={handleTestApiKey}
                    disabled={testingApiKey || !apiKeyInput.trim()}
                    className={`px-3 py-2 rounded flex items-center gap-2 transition ${
                      testingApiKey || !apiKeyInput.trim()
                        ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-600 text-white hover:bg-slate-500'
                    }`}
                    title="Tester la connexion"
                  >
                    {testingApiKey ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : apiKeyStatus === 'success' ? (
                      <Wifi size={18} className="text-green-400" />
                    ) : apiKeyStatus === 'error' ? (
                      <WifiOff size={18} className="text-red-400" />
                    ) : (
                      <Wifi size={18} />
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Laissez vide pour supprimer la clé. Cliquez sur l'icône wifi pour tester.
                </p>
              </div>

              {/* Statut du test */}
              {apiKeyStatus === 'testing' && (
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-blue-400 text-sm flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Test de la connexion en cours...
                </div>
              )}

              {apiKeyStatus === 'success' && (
                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-sm flex items-center gap-2">
                  <CheckCircle size={16} />
                  Connexion réussie ! Clé API valide.
                </div>
              )}

              {apiKeyStatus === 'error' && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle size={16} />
                    <span className="font-medium">Erreur de connexion</span>
                  </div>
                  {apiKeyError && (
                    <p className="text-xs ml-6 text-red-300">{apiKeyError}</p>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setApiKeyModalClient(null); setApiKeyInput(''); setApiKeyStatus('idle'); setApiKeyError(''); }}
                  className="flex-1 px-4 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSaveApiKey}
                  disabled={savingApiKey || testingApiKey}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded transition ${
                    savingApiKey || testingApiKey
                      ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {savingApiKey ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Sauvegarde...
                    </>
                  ) : testingApiKey ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Test...
                    </>
                  ) : (
                    'Tester & Sauvegarder'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================

export default ClientsPage;
