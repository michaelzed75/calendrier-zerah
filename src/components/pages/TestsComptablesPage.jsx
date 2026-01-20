// @ts-check
import { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  Play,
  Download,
  History,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  X,
  Settings
} from 'lucide-react';
import {
  runTest,
  getExecutionHistory,
  getExecutionResults,
  getAllTests,
  testConnection,
  exportTestResults,
  exportHistorique
} from '../../utils/testsComptables/index.js';
import { supabase } from '../../supabaseClient.js';

/**
 * @param {import('../../types').TestsComptablesPageProps} props
 */
export default function TestsComptablesPage({
  clients,
  collaborateurs,
  userCollaborateur,
  getAccessibleClients,
  accent
}) {
  // États principaux
  const [selectedClientId, setSelectedClientId] = useState(/** @type {number|null} */ (null));
  const [selectedMillesime, setSelectedMillesime] = useState(new Date().getFullYear());
  const [selectedTestCode, setSelectedTestCode] = useState('');

  // États UI
  const [isRunning, setIsRunning] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(/** @type {'idle'|'success'|'error'} */ ('idle'));
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  // Données
  const [testsDisponibles, setTestsDisponibles] = useState(/** @type {import('../../types').TestDefinition[]} */ ([]));
  const [historique, setHistorique] = useState(/** @type {import('../../types').TestComptableExecution[]} */ ([]));
  const [resultatsActuels, setResultatsActuels] = useState(/** @type {import('../../types').TestResultAnomalie[]} */ ([]));
  const [executionActuelle, setExecutionActuelle] = useState(/** @type {import('../../types').TestComptableExecution|null} */ (null));

  // Messages
  const [message, setMessage] = useState(/** @type {{type: 'success'|'error'|'info', text: string}|null} */ (null));

  // Clients accessibles (triés alphabétiquement)
  const accessibleClients = [...getAccessibleClients(userCollaborateur)].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const clientsAvecApi = accessibleClients.filter(c => c.pennylane_client_api_key);
  const filteredClients = accessibleClients.filter(c =>
    c.nom.toLowerCase().includes(clientSearch.toLowerCase())
  );

  // Handler pour sélection client
  const handleClientSelect = (client) => {
    setSelectedClientId(client.id);
    setClientSearch(client.nom + (client.pennylane_client_api_key ? ' ✓' : ' (pas d\'API)'));
    setShowClientDropdown(false);
  };

  // Client sélectionné
  const selectedClient = clients.find(c => c.id === selectedClientId);

  // Charger les tests disponibles
  useEffect(() => {
    const tests = getAllTests();
    setTestsDisponibles(tests);
    if (tests.length > 0 && !selectedTestCode) {
      setSelectedTestCode(tests[0].code);
    }
  }, []);

  // Charger l'historique quand le client change
  useEffect(() => {
    if (selectedClientId) {
      loadHistorique();
    } else {
      setHistorique([]);
    }
  }, [selectedClientId]);

  /**
   * Charge l'historique des tests pour le client sélectionné
   */
  async function loadHistorique() {
    if (!selectedClientId) return;
    const history = await getExecutionHistory(selectedClientId);
    setHistorique(history);
  }

  /**
   * Lance le test sélectionné
   */
  async function handleRunTest() {
    if (!selectedClientId || !selectedTestCode || !userCollaborateur) {
      setMessage({ type: 'error', text: 'Veuillez sélectionner un client et un test' });
      return;
    }

    const client = clients.find(c => c.id === selectedClientId);
    if (!client?.pennylane_client_api_key) {
      setMessage({ type: 'error', text: 'Ce client n\'a pas de clé API Pennylane configurée' });
      setShowApiKeyModal(true);
      return;
    }

    setIsRunning(true);
    setMessage(null);
    setResultatsActuels([]);
    setExecutionActuelle(null);

    try {
      const result = await runTest({
        clientId: selectedClientId,
        testCode: selectedTestCode,
        millesime: selectedMillesime,
        collaborateurId: userCollaborateur.id,
        pennylaneApiKey: client.pennylane_client_api_key
      });

      if (result.success) {
        setResultatsActuels(result.anomalies || []);
        if (result.executionId) {
          // Recharger l'exécution complète
          const { data } = await supabase
            .from('tests_comptables_executions')
            .select('*')
            .eq('id', result.executionId)
            .single();
          if (data) {
            setExecutionActuelle(data);
          }
        }
        setMessage({
          type: 'success',
          text: `Test terminé en ${result.dureeMs}ms - ${result.anomalies?.length || 0} anomalie(s) détectée(s)`
        });
        loadHistorique();
      } else {
        setMessage({ type: 'error', text: result.error || 'Erreur inconnue' });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erreur lors de l\'exécution du test'
      });
    } finally {
      setIsRunning(false);
    }
  }

  /**
   * Sauvegarde la clé API pour le client sélectionné
   */
  async function handleSaveApiKey() {
    if (!selectedClientId || !apiKeyInput.trim()) return;

    setTestingConnection(true);
    setConnectionStatus('idle');

    try {
      // Tester la connexion
      const testResult = await testConnection(apiKeyInput.trim());

      if (testResult.success) {
        // Sauvegarder en BDD
        const { error } = await supabase
          .from('clients')
          .update({ pennylane_client_api_key: apiKeyInput.trim() })
          .eq('id', selectedClientId);

        if (error) throw error;

        setConnectionStatus('success');
        setMessage({ type: 'success', text: 'Clé API sauvegardée avec succès' });

        // Rafraîchir les clients (on met à jour localement)
        // Note: dans l'idéal, on rechargerait depuis App.jsx
        setTimeout(() => {
          setShowApiKeyModal(false);
          setApiKeyInput('');
          setConnectionStatus('idle');
          // Force reload
          window.location.reload();
        }, 1500);
      } else {
        setConnectionStatus('error');
        setMessage({ type: 'error', text: testResult.error || 'Connexion échouée' });
      }
    } catch (error) {
      setConnectionStatus('error');
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erreur lors de la sauvegarde'
      });
    } finally {
      setTestingConnection(false);
    }
  }

  /**
   * Exporte les résultats actuels en Excel
   */
  function handleExportResults() {
    if (!executionActuelle || !selectedClient) return;

    const test = testsDisponibles.find(t => t.code === executionActuelle.test_code);
    if (!test) return;

    exportTestResults({
      execution: executionActuelle,
      resultats: resultatsActuels,
      client: selectedClient,
      test
    });
  }

  /**
   * Charge les résultats d'une exécution passée
   */
  async function handleLoadExecution(execution) {
    const results = await getExecutionResults(execution.id);
    setExecutionActuelle(execution);
    setResultatsActuels(results);
    setShowHistory(false);
  }

  /**
   * Rendu de l'icône de sévérité
   */
  function renderSeveriteIcon(severite) {
    switch (severite) {
      case 'critical':
        return <AlertCircle className="text-red-500" size={18} />;
      case 'error':
        return <AlertTriangle className="text-orange-500" size={18} />;
      case 'warning':
        return <AlertTriangle className="text-yellow-500" size={18} />;
      case 'info':
        return <Info className="text-blue-400" size={18} />;
      default:
        return <Info className="text-slate-400" size={18} />;
    }
  }

  /**
   * Rendu du badge de sévérité
   */
  function renderSeveriteBadge(severite) {
    const colors = {
      critical: 'bg-red-500/20 text-red-400 border-red-500/30',
      error: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      info: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    };
    const labels = {
      critical: 'Critique',
      error: 'Erreur',
      warning: 'Avertissement',
      info: 'Info'
    };

    return (
      <span className={`px-2 py-0.5 text-xs rounded border ${colors[severite] || colors.info}`}>
        {labels[severite] || severite}
      </span>
    );
  }

  // Années disponibles (5 dernières années)
  const anneesDisponibles = [];
  const anneeActuelle = new Date().getFullYear();
  for (let i = 0; i < 5; i++) {
    anneesDisponibles.push(anneeActuelle - i);
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center gap-3 mb-6">
        <ClipboardCheck size={28} className={accent.text} />
        <h1 className="text-2xl font-bold text-white">Tests Comptables</h1>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg border flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
          message.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
          'bg-blue-500/10 border-blue-500/30 text-blue-400'
        }`}>
          {message.type === 'success' && <CheckCircle size={20} />}
          {message.type === 'error' && <AlertCircle size={20} />}
          {message.type === 'info' && <Info size={20} />}
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-auto">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Sélecteurs */}
      <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-700 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Sélection client avec recherche */}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-300 mb-1">Client</label>
            <input
              type="text"
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value);
                setSelectedClientId(null);
                setShowClientDropdown(true);
              }}
              onFocus={() => setShowClientDropdown(true)}
              placeholder="Rechercher un client..."
              className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600"
            />
            {showClientDropdown && filteredClients.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-slate-700 border border-slate-600 rounded max-h-48 overflow-y-auto">
                {filteredClients.map(client => (
                  <div
                    key={client.id}
                    onClick={() => handleClientSelect(client)}
                    className="px-3 py-2 cursor-pointer hover:bg-slate-600 text-white flex justify-between items-center"
                  >
                    <span>{client.nom}</span>
                    <span className={client.pennylane_client_api_key ? 'text-green-400' : 'text-slate-500 text-sm'}>
                      {client.pennylane_client_api_key ? '✓' : '(pas d\'API)'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sélection millésime */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Millésime</label>
            <select
              value={selectedMillesime}
              onChange={(e) => setSelectedMillesime(Number(e.target.value))}
              className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600"
            >
              {anneesDisponibles.map(annee => (
                <option key={annee} value={annee}>{annee}</option>
              ))}
            </select>
          </div>

          {/* Sélection test */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Test</label>
            <select
              value={selectedTestCode}
              onChange={(e) => setSelectedTestCode(e.target.value)}
              className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600"
            >
              {testsDisponibles.map(test => (
                <option key={test.code} value={test.code}>{test.nom}</option>
              ))}
            </select>
          </div>

          {/* Boutons */}
          <div className="flex items-end gap-2">
            <button
              onClick={handleRunTest}
              disabled={isRunning || !selectedClientId || !selectedTestCode}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                isRunning || !selectedClientId || !selectedTestCode
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  : `${accent.color} text-white ${accent.hover}`
              }`}
            >
              {isRunning ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Exécution...
                </>
              ) : (
                <>
                  <Play size={18} />
                  Lancer
                </>
              )}
            </button>

            {selectedClientId && (
              <button
                onClick={() => setShowApiKeyModal(true)}
                className="p-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition"
                title="Configurer la clé API"
              >
                <Settings size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Description du test sélectionné */}
        {selectedTestCode && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <p className="text-sm text-slate-400">
              {testsDisponibles.find(t => t.code === selectedTestCode)?.description}
            </p>
          </div>
        )}
      </div>

      {/* Résultats */}
      {(resultatsActuels.length > 0 || executionActuelle) && (
        <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-700 p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <AlertTriangle size={20} className={accent.text} />
              Résultats du test
              {executionActuelle && (
                <span className="text-sm font-normal text-slate-400">
                  ({executionActuelle.nombre_anomalies} anomalie(s))
                </span>
              )}
            </h2>

            <div className="flex items-center gap-2">
              {resultatsActuels.length > 0 && (
                <button
                  onClick={handleExportResults}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition text-sm"
                >
                  <Download size={16} />
                  Export Excel
                </button>
              )}
            </div>
          </div>

          {resultatsActuels.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <CheckCircle size={48} className="mx-auto mb-3 text-green-500" />
              <p>Aucune anomalie détectée !</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {resultatsActuels.map((resultat, index) => (
                <div
                  key={index}
                  className="bg-slate-700/50 rounded-lg p-4 border border-slate-600"
                >
                  <div className="flex items-start gap-3">
                    {renderSeveriteIcon(resultat.severite)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {renderSeveriteBadge(resultat.severite)}
                        <span className="text-sm text-slate-400">{resultat.type_anomalie}</span>
                      </div>
                      <p className="text-slate-300 text-sm">{resultat.commentaire}</p>

                      {/* Détails spécifiques au type de test */}
                      {resultat.donnees && (
                        <div className="mt-3 pt-3 border-t border-slate-600">
                          {resultat.donnees.compte1 && resultat.donnees.compte2 && (
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-slate-400">Compte 1:</span>
                                <span className="ml-2 text-white">{resultat.donnees.compte1.numero}</span>
                                <span className="ml-2 text-slate-400">({resultat.donnees.compte1.libelle})</span>
                              </div>
                              <div>
                                <span className="text-slate-400">Compte 2:</span>
                                <span className="ml-2 text-white">{resultat.donnees.compte2.numero}</span>
                                <span className="ml-2 text-slate-400">({resultat.donnees.compte2.libelle})</span>
                              </div>
                            </div>
                          )}
                          {resultat.donnees.ecritureFacture && resultat.donnees.ecritureBanque && (
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-slate-400">Facture:</span>
                                <span className="ml-2 text-white">{resultat.donnees.ecritureFacture.montant}€</span>
                                <span className="ml-2 text-slate-400">({resultat.donnees.ecritureFacture.date})</span>
                              </div>
                              <div>
                                <span className="text-slate-400">Banque:</span>
                                <span className="ml-2 text-white">{resultat.donnees.ecritureBanque.montant}€</span>
                                <span className="ml-2 text-slate-400">({resultat.donnees.ecritureBanque.date})</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Historique */}
      {selectedClientId && (
        <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-700 p-4">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between text-white"
          >
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <History size={20} className={accent.text} />
              Historique des tests
              <span className="text-sm font-normal text-slate-400">({historique.length})</span>
            </h2>
            {showHistory ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {showHistory && (
            <div className="mt-4 space-y-2">
              {historique.length === 0 ? (
                <p className="text-slate-400 text-center py-4">Aucun test exécuté pour ce client</p>
              ) : (
                <>
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={() => exportHistorique({ executions: historique, client: selectedClient })}
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition text-sm"
                    >
                      <Download size={16} />
                      Export historique
                    </button>
                  </div>

                  {historique.map(exec => (
                    <div
                      key={exec.id}
                      onClick={() => handleLoadExecution(exec)}
                      className="bg-slate-700/50 rounded-lg p-3 border border-slate-600 cursor-pointer hover:bg-slate-700 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            exec.statut === 'termine' ? 'bg-green-500/20 text-green-400' :
                            exec.statut === 'erreur' ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {exec.statut}
                          </span>
                          <span className="text-white">{exec.test_code}</span>
                          <span className="text-slate-400">Millésime {exec.millesime}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                          <span>{exec.nombre_anomalies} anomalie(s)</span>
                          <span>{new Date(exec.date_execution).toLocaleDateString('fr-FR')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal configuration clé API */}
      {showApiKeyModal && selectedClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Configuration API Pennylane</h3>
              <button onClick={() => setShowApiKeyModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <p className="text-slate-400 text-sm mb-4">
              Configurez la clé API Pennylane pour le client <strong className="text-white">{selectedClient.nom}</strong>
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-1">Clé API Pennylane</label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="pk_..."
                className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600"
              />
            </div>

            {connectionStatus === 'success' && (
              <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-sm flex items-center gap-2">
                <CheckCircle size={16} />
                Connexion réussie !
              </div>
            )}

            {connectionStatus === 'error' && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                Connexion échouée
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveApiKey}
                disabled={testingConnection || !apiKeyInput.trim()}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded transition ${
                  testingConnection || !apiKeyInput.trim()
                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                    : `${accent.color} text-white ${accent.hover}`
                }`}
              >
                {testingConnection ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Test...
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    Tester & Sauvegarder
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
