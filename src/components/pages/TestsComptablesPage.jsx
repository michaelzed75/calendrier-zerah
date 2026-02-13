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
  Settings,
  EyeOff,
  Eye,
  Lightbulb,
  FileText
} from 'lucide-react';
import {
  runTest,
  getExecutionHistory,
  getExecutionResults,
  getAllTests,
  testConnection,
  exportTestResults,
  exportHistorique,
  exportDonneesAnalysees,
  exportAttestationWord
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
  const [selectedClientId, setSelectedClientId] = useState(/** @type {number|null} */ (() => {
    const saved = localStorage.getItem('testsComptables_selectedClientId');
    return saved ? Number(saved) : null;
  }));
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
  const [showIgnored, setShowIgnored] = useState(false);
  const [comptesBoissonsInput, setComptesBoissonsInput] = useState('60701');
  const [comptesFoodInput, setComptesFoodInput] = useState('60702');
  // Champs adresse client pour attestation Word (stockés en localStorage par client)
  const [attestationNomSociete, setAttestationNomSociete] = useState('');
  const [attestationAdresse, setAttestationAdresse] = useState('');
  const [attestationCpVille, setAttestationCpVille] = useState('');

  // Données
  const [testsDisponibles, setTestsDisponibles] = useState(/** @type {import('../../types').TestDefinition[]} */ ([]));
  const [historique, setHistorique] = useState(/** @type {import('../../types').TestComptableExecution[]} */ ([]));
  const [resultatsActuels, setResultatsActuels] = useState(/** @type {import('../../types').TestResultAnomalie[]} */ ([]));
  const [executionActuelle, setExecutionActuelle] = useState(/** @type {import('../../types').TestComptableExecution|null} */ (null));
  const [donneesAnalysees, setDonneesAnalysees] = useState(/** @type {Object|null} */ (null));
  const [fournisseursReleve, setFournisseursReleve] = useState(/** @type {Set<string>} */ (new Set()));
  const [fournisseursIgnores, setFournisseursIgnores] = useState(/** @type {Set<string>} */ (new Set()));
  const [selectedFournisseursAttestation, setSelectedFournisseursAttestation] = useState(/** @type {Set<string>} */ (new Set()));

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
    localStorage.setItem('testsComptables_selectedClientId', String(client.id));
    setClientSearch(client.nom + (client.pennylane_client_api_key ? ' ✓' : ' (pas d\'API)'));
    setShowClientDropdown(false);
  };

  // Client sélectionné
  const selectedClient = clients.find(c => c.id === selectedClientId);

  // Restaurer le nom du client dans le champ de recherche au chargement
  useEffect(() => {
    if (selectedClientId && clients.length > 0 && clientSearch === '') {
      const client = clients.find(c => c.id === selectedClientId);
      if (client) {
        setClientSearch(client.nom + (client.pennylane_client_api_key ? ' ✓' : ' (pas d\'API)'));
      }
    }
  }, [clients.length]);

  // Charger les tests disponibles
  useEffect(() => {
    const tests = getAllTests();
    setTestsDisponibles(tests);
    if (tests.length > 0 && !selectedTestCode) {
      setSelectedTestCode(tests[0].code);
    }
  }, []);

  // Charger l'historique et les fournisseurs au relevé quand le client change
  useEffect(() => {
    if (selectedClientId) {
      loadHistoriqueEtDernierTest();
      loadFournisseursReleve();
      // Charger les champs adresse depuis localStorage
      const saved = localStorage.getItem(`attestation_addr_${selectedClientId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setAttestationNomSociete(parsed.nomSociete || '');
          setAttestationAdresse(parsed.adresse || '');
          setAttestationCpVille(parsed.cpVille || '');
        } catch { /* ignore */ }
      } else {
        // Pré-remplir avec le nom du client
        const c = clients.find(cl => cl.id === selectedClientId);
        setAttestationNomSociete(c?.nom || '');
        setAttestationAdresse('');
        setAttestationCpVille('');
      }
    } else {
      setHistorique([]);
      setResultatsActuels([]);
      setExecutionActuelle(null);
      setDonneesAnalysees(null);
      setFournisseursReleve(new Set());
      setFournisseursIgnores(new Set());
      setAttestationNomSociete('');
      setAttestationAdresse('');
      setAttestationCpVille('');
    }
  }, [selectedClientId]);

  /**
   * Charge les fournisseurs marqués "au relevé" et "ignorés" pour ce client
   */
  async function loadFournisseursReleve() {
    if (!selectedClientId) return;
    const { data } = await supabase
      .from('fournisseurs_releve')
      .select('supplier_id, type')
      .eq('client_id', selectedClientId);
    if (data) {
      setFournisseursReleve(new Set(data.filter(d => (d.type || 'releve') !== 'ignore').map(d => d.supplier_id)));
      setFournisseursIgnores(new Set(data.filter(d => d.type === 'ignore').map(d => d.supplier_id)));
    }
  }

  /**
   * Ajoute ou supprime un flag fournisseur ('releve' ou 'ignore')
   */
  async function toggleFournisseurFlag(supplierId, supplierName, flagType, checked) {
    if (!selectedClientId || !userCollaborateur) return;
    const sid = String(supplierId);

    if (checked) {
      await supabase.from('fournisseurs_releve').upsert({
        client_id: selectedClientId,
        supplier_id: sid,
        supplier_name: supplierName,
        created_by: userCollaborateur.id,
        type: flagType
      }, { onConflict: 'client_id,supplier_id' });

      if (flagType === 'releve') {
        setFournisseursReleve(prev => new Set([...prev, sid]));
        setFournisseursIgnores(prev => { const next = new Set(prev); next.delete(sid); return next; });
      } else {
        setFournisseursIgnores(prev => new Set([...prev, sid]));
        setFournisseursReleve(prev => { const next = new Set(prev); next.delete(sid); return next; });
      }
    } else {
      await supabase.from('fournisseurs_releve')
        .delete()
        .eq('client_id', selectedClientId)
        .eq('supplier_id', sid);

      if (flagType === 'releve') {
        setFournisseursReleve(prev => { const next = new Set(prev); next.delete(sid); return next; });
      } else {
        setFournisseursIgnores(prev => { const next = new Set(prev); next.delete(sid); return next; });
      }
    }
  }

  /**
   * Charge l'historique des tests pour le client sélectionné
   * et affiche automatiquement le dernier test exécuté
   */
  async function loadHistoriqueEtDernierTest() {
    if (!selectedClientId) return;
    const history = await getExecutionHistory(selectedClientId);
    setHistorique(history);

    // Charger automatiquement le dernier test terminé
    if (history.length > 0) {
      const dernierTest = history.find(h => h.statut === 'termine');
      if (dernierTest) {
        const results = await getExecutionResults(dernierTest.id);
        setExecutionActuelle(dernierTest);
        setResultatsActuels(results);
        setSelectedTestCode(dernierTest.test_code);
        setSelectedMillesime(dernierTest.millesime);
        // Charger les données analysées si disponibles
        if (dernierTest.donnees_analysees) {
          setDonneesAnalysees(dernierTest.donnees_analysees);
          // Initialiser la sélection fournisseurs attestation
          if (dernierTest.donnees_analysees.fournisseurs) {
            setSelectedFournisseursAttestation(new Set(
              dernierTest.donnees_analysees.fournisseurs.map(f => f.nomNormalise || f.nom.toUpperCase().replace(/\s+/g, ' ').trim())
            ));
          }
        }
      }
    }
  }

  /**
   * Charge l'historique uniquement (sans charger le dernier test)
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
    setDonneesAnalysees(null);

    try {
      const result = await runTest({
        clientId: selectedClientId,
        testCode: selectedTestCode,
        millesime: selectedMillesime,
        collaborateurId: userCollaborateur.id,
        pennylaneApiKey: client.pennylane_client_api_key,
        options: {
          fournisseursReleve: Array.from(fournisseursReleve),
          fournisseursIgnores: Array.from(fournisseursIgnores),
          millesime: selectedMillesime,
          // Options attestation achats : comptes Boissons et Food séparés
          ...(selectedTestCode === 'attestation_achats' ? {
            comptesBoissons: comptesBoissonsInput.split(',').map(c => c.trim()).filter(c => c.length > 0),
            comptesFood: comptesFoodInput.split(',').map(c => c.trim()).filter(c => c.length > 0)
          } : {})
        }
      });

      if (result.success) {
        setResultatsActuels(result.anomalies || []);
        setDonneesAnalysees(result.donneesAnalysees || null);
        // Initialiser la sélection fournisseurs pour attestation avec tous les fournisseurs
        if (result.donneesAnalysees?.fournisseurs) {
          setSelectedFournisseursAttestation(new Set(
            result.donneesAnalysees.fournisseurs.map(f => f.nomNormalise || f.nom.toUpperCase().replace(/\s+/g, ' ').trim())
          ));
        }
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
        setTimeout(() => {
          setShowApiKeyModal(false);
          setApiKeyInput('');
          setConnectionStatus('idle');
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
   * Exporte les données analysées en Excel (même sans anomalies)
   */
  function handleExportDonneesAnalysees() {
    if (!donneesAnalysees || !selectedClient) return;

    const test = testsDisponibles.find(t => t.code === selectedTestCode);
    if (!test) return;

    exportDonneesAnalysees({
      donneesAnalysees,
      client: selectedClient,
      test,
      millesime: selectedMillesime
    });
  }

  /**
   * Sauvegarde les champs adresse en localStorage
   */
  function saveAttestationAddr(field, value) {
    const setters = { nomSociete: setAttestationNomSociete, adresse: setAttestationAdresse, cpVille: setAttestationCpVille };
    setters[field](value);
    if (selectedClientId) {
      const saved = localStorage.getItem(`attestation_addr_${selectedClientId}`);
      const current = saved ? JSON.parse(saved) : {};
      current[field] = value;
      localStorage.setItem(`attestation_addr_${selectedClientId}`, JSON.stringify(current));
    }
  }

  /**
   * Exporte l'attestation au format Word
   */
  async function handleExportAttestationWord() {
    if (!donneesAnalysees || !selectedClient) return;
    await exportAttestationWord({
      donneesAnalysees,
      client: selectedClient,
      millesime: selectedMillesime,
      nomSociete: attestationNomSociete || selectedClient.nom,
      adresse: attestationAdresse,
      cpVille: attestationCpVille,
      selectedFournisseurs: selectedFournisseursAttestation.size > 0 ? selectedFournisseursAttestation : null
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
                localStorage.removeItem('testsComptables_selectedClientId');
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

            {/* Options spécifiques au test Attestation achats */}
            {selectedTestCode === 'attestation_achats' && (
              <div className="mt-3 p-3 bg-slate-700/30 rounded-lg border border-slate-600">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-green-400 mb-1">
                      🍷 Comptes Boissons
                    </label>
                    <input
                      type="text"
                      value={comptesBoissonsInput}
                      onChange={(e) => setComptesBoissonsInput(e.target.value)}
                      placeholder="Ex: 60701"
                      className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-orange-400 mb-1">
                      🍔 Comptes Food
                    </label>
                    <input
                      type="text"
                      value={comptesFoodInput}
                      onChange={(e) => setComptesFoodInput(e.target.value)}
                      placeholder="Ex: 60702"
                      className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 text-sm"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Séparez les préfixes de comptes par des virgules. Ex: PPF = 60701 / 60702, Goodbeer = 6071 / 6072
                </p>

                {/* Champs adresse pour l'attestation Word */}
                <div className="mt-3 pt-3 border-t border-slate-600">
                  <p className="text-xs text-slate-400 mb-2">Coordonnées pour l'attestation Word :</p>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={attestationNomSociete}
                      onChange={(e) => saveAttestationAddr('nomSociete', e.target.value)}
                      placeholder="Nom société"
                      className="bg-slate-700 text-white rounded px-3 py-1.5 border border-slate-600 text-sm"
                    />
                    <input
                      type="text"
                      value={attestationAdresse}
                      onChange={(e) => saveAttestationAddr('adresse', e.target.value)}
                      placeholder="Adresse"
                      className="bg-slate-700 text-white rounded px-3 py-1.5 border border-slate-600 text-sm"
                    />
                    <input
                      type="text"
                      value={attestationCpVille}
                      onChange={(e) => saveAttestationAddr('cpVille', e.target.value)}
                      placeholder="CP + Ville"
                      className="bg-slate-700 text-white rounded px-3 py-1.5 border border-slate-600 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Résultats */}
      {(resultatsActuels.length > 0 || executionActuelle || donneesAnalysees) && (
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
              {donneesAnalysees && donneesAnalysees.type === 'attestation_achats' && donneesAnalysees.parCategorie && (
                <button
                  onClick={handleExportAttestationWord}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-700 text-white rounded hover:bg-blue-600 transition text-sm"
                >
                  <FileText size={16} />
                  Attestation Word
                </button>
              )}
              {donneesAnalysees && (
                <button
                  onClick={handleExportDonneesAnalysees}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-700 text-white rounded hover:bg-green-600 transition text-sm"
                >
                  <Download size={16} />
                  Export données analysées
                </button>
              )}
              {resultatsActuels.length > 0 && (
                <button
                  onClick={handleExportResults}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition text-sm"
                >
                  <Download size={16} />
                  Export anomalies
                </button>
              )}
            </div>
          </div>

          {/* Résumé des données analysées */}
          {donneesAnalysees && (
            <div className="bg-slate-700/30 rounded-lg p-4 mb-4 border border-slate-600">
              <h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                <Info size={16} />
                Données analysées
              </h3>
              {donneesAnalysees.type === 'fournisseurs' && (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Fournisseurs analysés:</span>
                    <span className="ml-2 text-white font-medium">{donneesAnalysees.nbFournisseurs}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Comparaisons effectuées:</span>
                    <span className="ml-2 text-white font-medium">{donneesAnalysees.nbComparaisons}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Seuil similarité:</span>
                    <span className="ml-2 text-white font-medium">{donneesAnalysees.seuilSimilarite}%</span>
                  </div>
                </div>
              )}
              {donneesAnalysees.type === 'attestation_achats' && (
                <div className="grid grid-cols-5 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Écritures analysées:</span>
                    <span className="ml-2 text-white font-medium">{donneesAnalysees.nbEcrituresAnalysees}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Fournisseurs:</span>
                    <span className="ml-2 text-white font-medium">{donneesAnalysees.nbFournisseurs}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Total Débit:</span>
                    <span className="ml-2 text-white font-medium">{donneesAnalysees.totalDebit?.toFixed(2)}€</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Total Crédit:</span>
                    <span className="ml-2 text-white font-medium">{donneesAnalysees.totalCredit?.toFixed(2)}€</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Total HT (solde):</span>
                    <span className="ml-2 text-white font-medium">{donneesAnalysees.totalHT?.toFixed(2)}€</span>
                  </div>
                </div>
              )}
              {donneesAnalysees.type === 'double_saisie' && (
                <div className="grid grid-cols-6 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Factures:</span>
                    <span className="ml-2 text-white font-medium">{donneesAnalysees.nbFactures}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Fournisseurs:</span>
                    <span className="ml-2 text-white font-medium">{donneesAnalysees.nbFournisseurs}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Au relevé:</span>
                    <span className="ml-2 text-white font-medium">{donneesAnalysees.nbMarquesReleve || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Alertes:</span>
                    <span className="ml-2 text-white font-medium">{donneesAnalysees.nbAvecAlertes || donneesAnalysees.nbAvecDoublons || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Ignorés:</span>
                    <span className="ml-2 text-white font-medium">{donneesAnalysees.nbIgnores || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Période:</span>
                    <span className="ml-2 text-white font-medium">{donneesAnalysees.toleranceJours}j</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {resultatsActuels.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <CheckCircle size={48} className="mx-auto mb-3 text-green-500" />
              <p>Aucune anomalie détectée !</p>
              {donneesAnalysees && (
                <p className="text-sm mt-2">Cliquez sur "Export données analysées" pour voir la liste complète des éléments vérifiés.</p>
              )}
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
                          {/* Doublons fournisseurs */}
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
                          {/* Attestation achats - tableau récapitulatif */}
                          {resultat.type_anomalie === 'attestation_achats_resume' && resultat.donnees?.fournisseurs && (
                            <div className="space-y-2 text-sm">
                              {/* Boutons sélection */}
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-400">Sélection attestation Word :</span>
                                <button
                                  onClick={() => setSelectedFournisseursAttestation(new Set(
                                    resultat.donnees.fournisseurs.map(f => f.nomNormalise || f.nom.toUpperCase().replace(/\s+/g, ' ').trim())
                                  ))}
                                  className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition"
                                >
                                  Tout cocher
                                </button>
                                <button
                                  onClick={() => setSelectedFournisseursAttestation(new Set())}
                                  className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition"
                                >
                                  Tout décocher
                                </button>
                                <span className="text-slate-500 ml-2">
                                  {selectedFournisseursAttestation.size}/{resultat.donnees.fournisseurs.length} sélectionné(s)
                                </span>
                              </div>
                              <div className="border border-slate-600 rounded">
                                {/* En-tête colonnes */}
                                <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-slate-700/50 text-xs text-slate-400 font-medium">
                                  <div className="col-span-1 text-center">✓</div>
                                  <div className="col-span-3">Fournisseur</div>
                                  <div className="col-span-2 text-right">Nb écritures</div>
                                  <div className="col-span-2 text-right">Débit</div>
                                  <div className="col-span-2 text-right">Crédit</div>
                                  <div className="col-span-2 text-right">Montant HT</div>
                                </div>
                                {/* Lignes fournisseurs */}
                                <div className="max-h-[400px] overflow-y-auto">
                                  {resultat.donnees.fournisseurs.map((f, idx) => {
                                    const normKey = f.nomNormalise || f.nom.toUpperCase().replace(/\s+/g, ' ').trim();
                                    const isChecked = selectedFournisseursAttestation.has(normKey);
                                    return (
                                      <div
                                        key={idx}
                                        onClick={() => {
                                          setSelectedFournisseursAttestation(prev => {
                                            const next = new Set(prev);
                                            if (next.has(normKey)) next.delete(normKey);
                                            else next.add(normKey);
                                            return next;
                                          });
                                        }}
                                        className={`grid grid-cols-12 gap-2 px-3 py-1.5 border-t border-slate-700 hover:bg-slate-700/30 cursor-pointer ${f.montantHT < 0 ? 'bg-red-500/5' : ''} ${!isChecked ? 'opacity-50' : ''}`}
                                      >
                                        <div className="col-span-1 flex justify-center items-center">
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {}}
                                            className="h-3.5 w-3.5 rounded border-slate-500 bg-slate-700 text-blue-500 cursor-pointer"
                                          />
                                        </div>
                                        <div className="col-span-3 text-white truncate" title={f.nom}>{f.nom}</div>
                                        <div className="col-span-2 text-right text-slate-400">{f.nbEcritures}</div>
                                        <div className="col-span-2 text-right text-slate-400">{f.totalDebit?.toFixed(2)}€</div>
                                        <div className="col-span-2 text-right text-slate-400">{f.totalCredit?.toFixed(2)}€</div>
                                        <div className={`col-span-2 text-right font-medium ${f.montantHT < 0 ? 'text-red-400' : 'text-white'}`}>{f.montantHT?.toFixed(2)}€</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              {/* Total général */}
                              {resultat.donnees.totalGeneral && (
                                <div className="bg-slate-600/70 rounded px-3 py-2 flex justify-between items-center font-bold">
                                  <span className="text-white">TOTAL GÉNÉRAL ({resultat.donnees.totalGeneral.nbFournisseurs} fournisseurs)</span>
                                  <div className="flex gap-6">
                                    <span className="text-slate-300">Débit: {resultat.donnees.totalGeneral.totalDebit?.toFixed(2)}€</span>
                                    <span className="text-slate-300">Crédit: {resultat.donnees.totalGeneral.totalCredit?.toFixed(2)}€</span>
                                    <span className="text-white">HT: {resultat.donnees.totalGeneral.totalHT?.toFixed(2)}€</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          {/* Liste fournisseurs - Relevé fournisseurs */}
                          {resultat.type_anomalie !== 'attestation_achats_resume' && resultat.donnees.fournisseurs && (
                            <div className="space-y-1 text-sm">
                              {/* En-tête */}
                              <div className="flex items-center gap-3 p-2 bg-slate-700/50 rounded text-xs text-slate-400 font-medium">
                                <div className="w-14 text-center">Relevé</div>
                                <div className="w-10 text-center">Masq.</div>
                                <div className="w-48">Fournisseur</div>
                                <div className="flex-1 text-center">Calendrier / Alertes</div>
                              </div>

                              {/* Liste des fournisseurs actifs (excluant ignorés) */}
                              <div className="max-h-[450px] overflow-y-auto space-y-1">
                                {resultat.donnees.fournisseurs
                                  .filter(f => !f.isIgnore && !fournisseursIgnores.has(String(f.supplierId)))
                                  .map((fournisseur) => {
                                  const isReleve = fournisseursReleve.has(String(fournisseur.supplierId));
                                  const hasDoublonsClassiques = !isReleve && fournisseur.alertes && fournisseur.alertes.some(a => a.type === 'doublon_classique');

                                  return (
                                  <div key={fournisseur.supplierId} data-fournisseur-wrapper>
                                  <div className={`flex items-center gap-3 p-2 rounded hover:bg-slate-600/30 ${fournisseur.hasAlertes ? 'bg-red-500/10 border border-red-500/30' : ''}`}>
                                    {/* Checkbox fournisseur au relevé */}
                                    <div className="w-14 flex justify-center">
                                      <input
                                        type="checkbox"
                                        checked={isReleve}
                                        onChange={(e) => toggleFournisseurFlag(fournisseur.supplierId, fournisseur.nom, 'releve', e.target.checked)}
                                        className="h-4 w-4 rounded border-slate-500 bg-slate-700 text-blue-500 cursor-pointer"
                                      />
                                    </div>

                                    {/* Bouton ignorer */}
                                    <div className="w-10 flex justify-center">
                                      <button
                                        onClick={() => toggleFournisseurFlag(fournisseur.supplierId, fournisseur.nom, 'ignore', true)}
                                        className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-600 rounded transition"
                                        title="Masquer ce fournisseur de l'analyse"
                                      >
                                        <EyeOff size={14} />
                                      </button>
                                    </div>

                                    {/* Nom fournisseur */}
                                    <div className="w-48 min-w-0">
                                      <div className="flex items-center gap-1">
                                        <span className={`font-medium truncate ${isReleve ? 'text-blue-400' : 'text-white'}`}>
                                          {fournisseur.nom}
                                        </span>
                                        {hasDoublonsClassiques && (
                                          <Lightbulb size={14} className="text-yellow-400 flex-shrink-0" title="Doublons détectés - envisagez de marquer ce fournisseur au relevé" />
                                        )}
                                      </div>
                                      <span className="text-slate-500 text-xs">{fournisseur.nbFactures} facture(s)</span>
                                    </div>

                                    {/* Calendrier ou Alertes */}
                                    <div className="flex-1 flex justify-end">
                                      {/* Fournisseur au relevé : afficher calendrier des 12 mois */}
                                      {fournisseur.calendrierMois ? (
                                        <div className="flex gap-0.5">
                                          {fournisseur.calendrierMois.map((moisInfo) => {
                                            const moisNom = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][parseInt(moisInfo.mois.split('-')[1]) - 1];
                                            let bgColor = 'bg-slate-600/50 text-slate-500'; // Futur = grisé
                                            let title = `${moisInfo.mois} - Futur`;
                                            let isClickable = false;

                                            if (moisInfo.estMoisActuel) {
                                              bgColor = moisInfo.nbFactures > 0 ? 'bg-blue-500 text-white' : 'bg-slate-500 text-slate-300';
                                              title = `${moisInfo.mois} - Mois en cours (${moisInfo.nbFactures} fact.)`;
                                              if (moisInfo.nbFactures > 0) isClickable = true;
                                            } else if (moisInfo.estPasse) {
                                              if (moisInfo.nbFactures === 0) {
                                                bgColor = 'bg-orange-500 text-white'; // Manquant = orange
                                                title = `${moisInfo.mois} - RELEVÉ MANQUANT - Cliquez pour détails`;
                                                isClickable = true;
                                              } else if (moisInfo.nbFactures === 1) {
                                                bgColor = 'bg-green-500 text-white'; // OK = vert
                                                title = `${moisInfo.mois} - OK (${moisInfo.montantTotal.toFixed(2)}€) - Cliquez pour détails`;
                                                isClickable = true;
                                              } else {
                                                bgColor = 'bg-red-500 text-white'; // Doublon = rouge
                                                title = `${moisInfo.mois} - DOUBLON (${moisInfo.nbFactures} factures) - Cliquez pour détails`;
                                                isClickable = true;
                                              }
                                            }

                                            return (
                                              <div
                                                key={moisInfo.mois}
                                                className={`w-6 h-6 flex items-center justify-center text-xs font-medium rounded ${bgColor} ${isClickable ? 'cursor-pointer hover:ring-2 hover:ring-white/50' : ''}`}
                                                title={title}
                                                onClick={isClickable ? (e) => {
                                                  e.stopPropagation();
                                                  // Toggle panneau via DOM pur (pas de setState = pas de re-render)
                                                  const panelId = `detail-${fournisseur.supplierId}-${moisInfo.mois}`;
                                                  const existing = document.getElementById(panelId);
                                                  // Fermer tous les panneaux ouverts
                                                  document.querySelectorAll('[data-mois-detail]').forEach(el => el.remove());
                                                  // Si on cliquait sur le même mois, juste fermer
                                                  if (existing) return;
                                                  // Créer le panneau de détails
                                                  const panel = document.createElement('div');
                                                  panel.id = panelId;
                                                  panel.setAttribute('data-mois-detail', 'true');
                                                  panel.className = 'ml-24 mr-2 mb-2 p-3 rounded-lg border';
                                                  panel.style.cssText = 'background:rgba(51,65,85,0.6);border-color:rgb(71,85,105);';
                                                  let statusHtml = '';
                                                  if (moisInfo.nbFactures === 0) statusHtml = '<span style="color:rgb(251,146,60)">Aucune facture (relevé manquant)</span>';
                                                  else if (moisInfo.nbFactures === 1) statusHtml = '<span style="color:rgb(74,222,128)">1 facture — OK</span>';
                                                  else statusHtml = '<span style="color:rgb(248,113,113)">' + moisInfo.nbFactures + ' factures — DOUBLON</span>';
                                                  let facturesHtml = '';
                                                  if (moisInfo.factures && moisInfo.factures.length > 0) {
                                                    facturesHtml = moisInfo.factures.map((f, i) =>
                                                      '<div style="display:flex;align-items:center;gap:12px;margin-top:4px">' +
                                                        '<button data-pdf-url="' + (f.pdfUrl || '') + '" style="padding:4px 12px;background:rgb(71,85,105);border:none;border-radius:4px;color:white;font-size:12px;cursor:pointer">' +
                                                          '📄 ' + (f.numero || 'N/A') +
                                                        '</button>' +
                                                        '<span style="color:rgb(148,163,184);font-size:13px">' + (f.date || '') + '</span>' +
                                                        '<span style="color:white;font-weight:500;font-size:13px">' + (f.montant || '') + '€</span>' +
                                                      '</div>'
                                                    ).join('');
                                                    if (moisInfo.montantTotal != null) {
                                                      facturesHtml += '<div style="padding-top:4px;margin-top:4px;border-top:1px solid rgb(71,85,105);font-size:12px;color:rgb(148,163,184)">Total : <span style="color:white">' + moisInfo.montantTotal.toFixed(2) + '€</span></div>';
                                                    }
                                                  } else {
                                                    facturesHtml = '<p style="font-size:13px;color:rgb(100,116,139);font-style:italic">Aucune facture pour ce mois</p>';
                                                  }
                                                  panel.innerHTML =
                                                    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
                                                      '<span style="font-size:13px;font-weight:500;color:rgb(203,213,225)">' + fournisseur.nom + ' — ' + moisInfo.mois + ' ' + statusHtml + '</span>' +
                                                      '<button data-close-panel style="color:rgb(148,163,184);background:none;border:none;cursor:pointer;font-size:16px">✕</button>' +
                                                    '</div>' +
                                                    facturesHtml;
                                                  // Event listeners
                                                  panel.addEventListener('click', (ev) => {
                                                    const btn = ev.target.closest('[data-pdf-url]');
                                                    if (btn) { ev.stopPropagation(); window.open(btn.getAttribute('data-pdf-url'), '_blank'); return; }
                                                    const closeBtn = ev.target.closest('[data-close-panel]');
                                                    if (closeBtn) { panel.remove(); return; }
                                                  });
                                                  // Insérer après le div wrapper du fournisseur
                                                  const wrapper = e.target.closest('[data-fournisseur-wrapper]');
                                                  if (wrapper) wrapper.appendChild(panel);
                                                } : undefined}
                                              >
                                                {moisNom}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        /* Fournisseur normal : afficher alertes doublons */
                                        fournisseur.alertes && fournisseur.alertes.length > 0 ? (
                                          <div className="flex flex-col gap-1 items-end">
                                            {fournisseur.alertes.map((alerte, idx) => (
                                              <div key={idx} className="flex items-center gap-2">
                                                {alerte.type === 'doublon_classique' && alerte.factures && (
                                                  <div className="flex gap-1 items-center bg-slate-700/50 rounded px-2 py-1">
                                                    <button
                                                      onClick={(e) => { e.stopPropagation(); window.open(alerte.factures[0]?.pdfUrl, '_blank'); }}
                                                      className="px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-xs text-white"
                                                      title={`📄 ${alerte.factures[0]?.numero || 'N/A'}\n📅 ${alerte.factures[0]?.date}\n💰 ${alerte.factures[0]?.montant}€\n\nCliquez pour ouvrir le PDF`}
                                                    >
                                                      {alerte.factures[0]?.date?.substring(5)} : {alerte.factures[0]?.montant}€
                                                    </button>
                                                    <span className="text-yellow-500 font-bold">⚠</span>
                                                    <button
                                                      onClick={(e) => { e.stopPropagation(); window.open(alerte.factures[1]?.pdfUrl, '_blank'); }}
                                                      className="px-2 py-1 bg-yellow-600 hover:bg-yellow-500 text-white rounded text-xs"
                                                      title={`📄 ${alerte.factures[1]?.numero || 'N/A'}\n📅 ${alerte.factures[1]?.date}\n💰 ${alerte.factures[1]?.montant}€\n⏱ Écart: ${alerte.ecartJours || '?'}j\n\nCliquez pour ouvrir le PDF`}
                                                    >
                                                      {alerte.factures[1]?.date?.substring(5)} : {alerte.factures[1]?.montant}€
                                                    </button>
                                                    {alerte.ecartJours && (
                                                      <span className="text-slate-400 text-xs ml-1">({alerte.ecartJours}j)</span>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <span className="text-green-500 text-xs">✓ OK</span>
                                        )
                                      )}
                                    </div>
                                  </div>
                                  </div>
                                  );
                                })}
                              </div>

                              {/* Légende pour le calendrier */}
                              <div className="flex gap-4 pt-3 mt-2 border-t border-slate-700 text-xs text-slate-400">
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500"></span> OK</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500"></span> Manquant</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500"></span> Doublon</span>
                                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-600"></span> Futur</span>
                                <span className="flex items-center gap-1"><Lightbulb size={12} className="text-yellow-400" /> Suggestion relevé</span>
                              </div>

                              {/* Section fournisseurs ignorés */}
                              {resultat.donnees.fournisseurs.filter(f => f.isIgnore || fournisseursIgnores.has(String(f.supplierId))).length > 0 && (
                                <div className="mt-4 pt-3 border-t border-slate-700">
                                  <button
                                    onClick={() => setShowIgnored(!showIgnored)}
                                    className="flex items-center gap-2 text-slate-400 hover:text-slate-300 transition text-xs"
                                  >
                                    {showIgnored ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    <EyeOff size={14} />
                                    <span>Fournisseurs masqués ({resultat.donnees.fournisseurs.filter(f => f.isIgnore || fournisseursIgnores.has(String(f.supplierId))).length})</span>
                                  </button>

                                  {showIgnored && (
                                    <div className="mt-2 space-y-1">
                                      {resultat.donnees.fournisseurs
                                        .filter(f => f.isIgnore || fournisseursIgnores.has(String(f.supplierId)))
                                        .map((fournisseur) => (
                                        <div key={fournisseur.supplierId} className="flex items-center gap-3 p-2 rounded bg-slate-700/20 text-slate-500">
                                          <EyeOff size={14} className="flex-shrink-0" />
                                          <span className="flex-1 truncate">{fournisseur.nom}</span>
                                          <span className="text-xs">{fournisseur.nbFactures} fact.</span>
                                          <button
                                            onClick={() => toggleFournisseurFlag(fournisseur.supplierId, fournisseur.nom, 'ignore', false)}
                                            className="flex items-center gap-1 px-2 py-1 bg-slate-600 hover:bg-slate-500 text-slate-300 rounded text-xs transition"
                                            title="Restaurer ce fournisseur dans l'analyse"
                                          >
                                            <Eye size={12} />
                                            Restaurer
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
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
