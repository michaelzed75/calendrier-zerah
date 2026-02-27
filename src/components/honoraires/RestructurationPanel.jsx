// @ts-check
import React, { useState, useCallback } from 'react';
import { Loader2, Download, Search, AlertTriangle, Check, Scissors, Package, Trash2, RefreshCw, ChevronDown, ChevronRight, Key, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import {
  analyserClient,
  analyserTousLesClients,
  calculerStatistiques,
  exportRestructurationExcel,
  getAllProducts,
  syncProduitsPennylane
} from '../../utils/honoraires';

/**
 * Panel Phase 2 : Restructuration des abonnements Pennylane.
 * Permet d'analyser les abonnements d'un client ou de tous les clients,
 * de séparer les produits FIXES (restent en PL) des VARIABLES (à supprimer),
 * et d'exporter un Excel croisé pour validation/import.
 *
 * @param {Object} props
 * @param {Object[]} props.clients - Clients de la BDD
 * @param {Object} props.accent - Configuration couleur
 * @param {string} props.filterCabinet - Filtre cabinet actif
 * @param {Object} props.apiKeysMap - Clés API PL par cabinet (pour company_id)
 */
export default function RestructurationPanel({ clients, accent, filterCabinet, apiKeysMap }) {
  // === State ===
  const [mode, setMode] = useState('single'); // 'single' | 'all'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  // Résultats
  const [plans, setPlans] = useState(null); // PlanRestructurationClient[]
  const [stats, setStats] = useState(null); // Statistiques agrégées
  const [expandedClients, setExpandedClients] = useState(new Set());
  const [expandedAbos, setExpandedAbos] = useState(new Set());

  // Sync produits PL
  const [syncingProduits, setSyncingProduits] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  // Clés API write (sessionStorage — survivent au changement d'onglet et F5, disparaissent à la fermeture du navigateur)
  const [writeKeyAup, setWriteKeyAupState] = useState(() => sessionStorage.getItem('pl_write_key_aup') || '');
  const [writeKeyZf, setWriteKeyZfState] = useState(() => sessionStorage.getItem('pl_write_key_zf') || '');
  const [showWriteKeys, setShowWriteKeys] = useState(false);

  const setWriteKeyAup = (val) => { setWriteKeyAupState(val); sessionStorage.setItem('pl_write_key_aup', val); };
  const setWriteKeyZf = (val) => { setWriteKeyZfState(val); sessionStorage.setItem('pl_write_key_zf', val); };

  // === Recherche client ===
  const filteredClients = searchQuery.length >= 2
    ? clients.filter(c => {
        const q = searchQuery.toLowerCase();
        return (
          c.nom?.toLowerCase().includes(q) ||
          c.siren?.includes(q) ||
          c.pennylane_customer_id?.toLowerCase().includes(q)
        );
      }).slice(0, 15)
    : [];

  // === Analyse un seul client ===
  const handleAnalyseSingle = useCallback(async (clientId) => {
    setLoading(true);
    setError(null);
    setPlans(null);
    setStats(null);
    setSelectedClientId(clientId);

    try {
      const plan = await analyserClient({ clientId, supabase });
      const planArray = [plan];
      const st = calculerStatistiques(planArray);
      setPlans(planArray);
      setStats(st);
      // Auto-expand
      setExpandedClients(new Set([plan.client_id]));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // === Analyse tous les clients ===
  const handleAnalyseAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPlans(null);
    setStats(null);
    setSelectedClientId(null);

    try {
      const allPlans = await analyserTousLesClients({
        supabase,
        cabinet: filterCabinet,
        onProgress: setProgress
      });
      const st = calculerStatistiques(allPlans);
      setPlans(allPlans);
      setStats(st);
      setProgress(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [filterCabinet]);

  // === Export Excel ===
  const handleExport = useCallback(async () => {
    if (!plans || !stats) return;
    // Charger les produits PL pour les UUID (identifiant produit obligatoire)
    let produitsPennylane = [];
    try {
      const { data } = await supabase
        .from('produits_pennylane')
        .select('cabinet,pennylane_product_id,denomination,label_normalise')
        .eq('actif', true);
      produitsPennylane = data || [];
    } catch (err) {
      console.warn('Impossible de charger produits_pennylane:', err.message);
    }
    exportRestructurationExcel({
      plans,
      stats,
      singleClient: mode === 'single' && plans.length === 1,
      produitsPennylane
    });
  }, [plans, stats, mode]);

  // === Sync produits PL (clés lecture via apiKeysMap) ===
  const handleSyncProduits = useCallback(async () => {
    setSyncingProduits(true);
    setSyncResult(null);
    let totalCreated = 0;
    let totalUpdated = 0;
    const errors = [];

    for (const cabinetName of ['Audit Up', 'Zerah Fiduciaire']) {
      const keyInfo = apiKeysMap?.[cabinetName];
      if (!keyInfo?.api_key) {
        errors.push(`${cabinetName} : clé API non configurée`);
        continue;
      }
      try {
        const plProducts = await getAllProducts(keyInfo.api_key);
        const result = await syncProduitsPennylane({ supabase, cabinet: cabinetName, plProducts });
        totalCreated += result.created;
        totalUpdated += result.updated;
      } catch (err) {
        errors.push(`${cabinetName} : ${err.message}`);
      }
    }

    setSyncResult({
      created: totalCreated,
      updated: totalUpdated,
      errors
    });
    setSyncingProduits(false);
  }, [apiKeysMap]);

  // === Toggle expand ===
  const toggleClient = (clientId) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const toggleAbo = (aboId) => {
    setExpandedAbos(prev => {
      const next = new Set(prev);
      if (next.has(aboId)) next.delete(aboId);
      else next.add(aboId);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Scissors size={20} className="text-amber-400" />
            <h3 className="text-lg font-semibold text-white">Phase 2 — Restructuration des abonnements</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncProduits}
              disabled={syncingProduits}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white rounded-lg transition text-sm"
            >
              {syncingProduits ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              Sync produits PL
            </button>
            {plans && stats && (
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition"
              >
                <Download size={16} />
                Export Excel
              </button>
            )}
          </div>
        </div>
        <p className="text-white text-sm">
          Sépare les produits <span className="text-emerald-400 font-medium">FIXES</span> (restent en abonnement PL)
          des produits <span className="text-red-400 font-medium">VARIABLES</span> (bulletins, accessoires social)
          qui seront facturés via import mensuel.
        </p>
      </div>

      {/* Résultat sync produits */}
      {syncResult && (
        <div className={`border rounded-xl p-3 flex items-start gap-3 ${
          syncResult.errors.length > 0 ? 'bg-amber-900/30 border-amber-700' : 'bg-emerald-900/30 border-emerald-700'
        }`}>
          <Check size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="text-white">
              Sync produits : <span className="font-medium text-emerald-400">{syncResult.created} créés</span>, <span className="font-medium text-blue-400">{syncResult.updated} mis à jour</span>
            </p>
            {syncResult.errors.map((err, i) => (
              <p key={i} className="text-red-400 text-xs mt-1">{err}</p>
            ))}
          </div>
        </div>
      )}

      {/* Clés API write temporaires */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Key size={16} className="text-amber-400" />
          <h4 className="text-white text-sm font-semibold">Clés API Pennylane (écriture)</h4>
          <span className="text-white text-xs bg-red-900/50 px-2 py-0.5 rounded">Temporaire — non sauvegardées</span>
          <button
            onClick={() => setShowWriteKeys(v => !v)}
            className="ml-auto text-white hover:text-amber-400 transition"
            title={showWriteKeys ? 'Masquer' : 'Afficher'}
          >
            {showWriteKeys ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white mb-1">Audit Up</label>
            <div className="flex items-center gap-2">
              <input
                type={showWriteKeys ? 'text' : 'password'}
                value={writeKeyAup}
                onChange={e => setWriteKeyAup(e.target.value)}
                placeholder="Clé write AUP..."
                className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
              {writeKeyAup && <Check size={14} className="text-emerald-400 flex-shrink-0" />}
            </div>
          </div>
          <div>
            <label className="block text-xs text-white mb-1">Zerah Fiduciaire</label>
            <div className="flex items-center gap-2">
              <input
                type={showWriteKeys ? 'text' : 'password'}
                value={writeKeyZf}
                onChange={e => setWriteKeyZf(e.target.value)}
                placeholder="Clé write ZF..."
                className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
              {writeKeyZf && <Check size={14} className="text-emerald-400 flex-shrink-0" />}
            </div>
          </div>
        </div>
        <p className="text-white text-xs mt-2">
          Ces clés sont stockées en sessionStorage (survivent au changement d'onglet et au F5).
          Elles disparaissent à la fermeture du navigateur et seront supprimées avec cet onglet après le nettoyage.
        </p>
      </div>

      {/* Sélection du mode */}
      <div className="flex gap-4">
        <button
          onClick={() => { setMode('single'); setPlans(null); setStats(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition font-medium ${
            mode === 'single'
              ? 'bg-amber-600 text-white'
              : 'bg-slate-700 text-white hover:bg-slate-600'
          }`}
        >
          <Search size={16} />
          Un client (test)
        </button>
        <button
          onClick={() => { setMode('all'); setPlans(null); setStats(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition font-medium ${
            mode === 'all'
              ? 'bg-amber-600 text-white'
              : 'bg-slate-700 text-white hover:bg-slate-600'
          }`}
        >
          <RefreshCw size={16} />
          Tous les clients
        </button>
      </div>

      {/* Mode single : recherche client */}
      {mode === 'single' && (
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-5">
          <label className="text-white text-sm font-medium block mb-2">Rechercher un client :</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Nom, SIREN ou ID Pennylane..."
            className="w-full px-4 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg focus:border-amber-500 focus:outline-none"
          />
          {filteredClients.length > 0 && (
            <div className="mt-2 space-y-1 max-h-60 overflow-auto">
              {filteredClients.map(c => (
                <button
                  key={c.id}
                  onClick={() => { handleAnalyseSingle(c.id); setSearchQuery(c.nom); }}
                  className={`w-full text-left px-3 py-2 rounded-lg transition text-sm ${
                    selectedClientId === c.id
                      ? 'bg-amber-900/50 border border-amber-700 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-white'
                  }`}
                >
                  <span className="font-medium">{c.nom}</span>
                  <span className="text-white ml-2 text-xs">
                    {c.cabinet} {c.siren ? `• ${c.siren}` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mode all : bouton lancer */}
      {mode === 'all' && !plans && (
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-5 text-center">
          <p className="text-white text-sm mb-4">
            Analyse les abonnements de tous les clients
            {filterCabinet && filterCabinet !== 'tous' ? ` (${filterCabinet})` : ''} ayant des tarifs 2026.
          </p>
          <button
            onClick={handleAnalyseAll}
            disabled={loading}
            className="px-6 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 text-white rounded-lg transition font-medium"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                {progress ? `${progress.message}` : 'Analyse en cours...'}
              </span>
            ) : (
              'Lancer l\'analyse'
            )}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && mode === 'single' && (
        <div className="flex items-center gap-3 text-white p-4">
          <Loader2 size={20} className="animate-spin text-amber-400" />
          Analyse en cours...
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-400 mt-0.5" />
          <p className="text-white text-sm">{error}</p>
        </div>
      )}

      {/* Résultats : Stats globales */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Clients analysés"
            value={stats.totalClients}
            color="blue"
          />
          <StatCard
            label="Avec produits variables"
            value={stats.totalClientsAvecVariable}
            color="amber"
            subtitle={`${stats.totalLignesVariables} lignes à supprimer`}
          />
          <StatCard
            label="Lignes FIXES"
            value={stats.totalLignesFixes}
            color="emerald"
            subtitle={`${stats.totalHtFixe2026.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR/mois`}
          />
          <StatCard
            label="Abos à supprimer"
            value={stats.totalAbosASupprimer}
            color="red"
            subtitle={`+ ${stats.totalAbosAModifier} à modifier`}
          />
        </div>
      )}

      {/* Résultats : Liste des plans */}
      {plans && plans.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-white font-semibold text-sm">
            {plans.length === 1 ? 'Détail client' : `${plans.length} clients analysés`}
          </h4>

          {plans
            .filter(p => mode === 'all' ? p.nb_lignes_variables > 0 : true)
            .map(plan => (
            <div key={plan.client_id} className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden">
              {/* Header client */}
              <button
                onClick={() => toggleClient(plan.client_id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition"
              >
                <div className="flex items-center gap-3">
                  {expandedClients.has(plan.client_id) ? (
                    <ChevronDown size={16} className="text-white" />
                  ) : (
                    <ChevronRight size={16} className="text-white" />
                  )}
                  <span className="text-white font-medium">{plan.client_nom}</span>
                  <span className="text-white text-xs bg-slate-700 px-2 py-0.5 rounded">{plan.cabinet}</span>
                  {plan.siren && <span className="text-white text-xs">{plan.siren}</span>}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-emerald-400 font-medium">{plan.nb_lignes_fixes} fixes</span>
                  {plan.nb_lignes_variables > 0 && (
                    <span className="text-red-400 font-medium">{plan.nb_lignes_variables} variables</span>
                  )}
                </div>
              </button>

              {/* Détail abonnements */}
              {expandedClients.has(plan.client_id) && (
                <div className="border-t border-slate-700 px-4 py-3 space-y-3">
                  {plan.abonnements.map(abo => {
                    const aboKey = `${plan.client_id}-${abo.abonnement_id}`;
                    const isExpanded = expandedAbos.has(aboKey);

                    return (
                      <div key={abo.abonnement_id} className="bg-slate-800/50 rounded-lg overflow-hidden">
                        {/* Header abonnement */}
                        <button
                          onClick={() => toggleAbo(aboKey)}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-700/50 transition"
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronDown size={14} className="text-white" /> : <ChevronRight size={14} className="text-white" />}
                            <span className="text-white text-sm">{abo.label}</span>
                            <span className="text-white text-xs bg-slate-600 px-1.5 py-0.5 rounded">{abo.status}</span>
                            <span className="text-white text-xs">{abo.frequence}/{abo.intervalle}</span>
                          </div>
                          <DecisionBadge decision={abo.decision} />
                        </button>

                        {/* Lignes */}
                        {isExpanded && (
                          <div className="border-t border-slate-600 px-3 py-2 space-y-1">
                            {abo.lignes_fixes.map(l => (
                              <LigneRow key={l.ligne_id} ligne={l} action="garder" />
                            ))}
                            {abo.lignes_variables.map(l => (
                              <LigneRow key={l.ligne_id} ligne={l} action="supprimer" />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Clients fixe-only (collapsible) */}
          {mode === 'all' && plans.filter(p => p.nb_lignes_variables === 0).length > 0 && (
            <div className="bg-slate-900/30 border border-slate-700 rounded-xl p-4">
              <p className="text-white text-sm">
                <Check size={14} className="inline text-emerald-400 mr-1" />
                {plans.filter(p => p.nb_lignes_variables === 0).length} clients sans produit variable (aucune action requise)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// === Sous-composants ===

function StatCard({ label, value, color, subtitle }) {
  const colors = {
    blue: 'bg-blue-900/30 border-blue-800',
    amber: 'bg-amber-900/30 border-amber-800',
    emerald: 'bg-emerald-900/30 border-emerald-800',
    red: 'bg-red-900/30 border-red-800'
  };

  return (
    <div className={`${colors[color] || colors.blue} border rounded-xl p-4`}>
      <p className="text-white text-xs font-medium mb-1">{label}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
      {subtitle && <p className="text-white text-xs mt-1">{subtitle}</p>}
    </div>
  );
}

function DecisionBadge({ decision }) {
  if (decision === 'a_supprimer') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 bg-red-900/50 text-white text-xs rounded font-medium">
        <Trash2 size={12} />
        Supprimer abo
      </span>
    );
  }
  if (decision === 'a_modifier') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-900/50 text-white text-xs rounded font-medium">
        <Scissors size={12} />
        Retirer variable
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-900/50 text-white text-xs rounded font-medium">
      <Check size={12} />
      Inchangé
    </span>
  );
}

function LigneRow({ ligne, action }) {
  const isSupprimer = action === 'supprimer';

  return (
    <div className={`flex items-center justify-between py-1 px-2 rounded text-sm ${
      isSupprimer ? 'bg-red-900/20' : 'bg-emerald-900/20'
    }`}>
      <div className="flex items-center gap-2 min-w-0">
        {isSupprimer ? (
          <Trash2 size={12} className="text-red-400 flex-shrink-0" />
        ) : (
          <Package size={12} className="text-emerald-400 flex-shrink-0" />
        )}
        <span className="text-white truncate">{ligne.label}</span>
        <span className="text-white text-xs flex-shrink-0">{ligne.axe}</span>
      </div>
      <div className="flex items-center gap-4 text-xs flex-shrink-0 ml-2">
        <span className="text-white">x{ligne.quantite}</span>
        <span className="text-white">{ligne.ancien_pu_ht.toFixed(2)} EUR</span>
        {!isSupprimer && ligne.nouveau_pu_ht !== ligne.ancien_pu_ht && (
          <span className="text-emerald-400 font-medium">→ {ligne.nouveau_pu_ht.toFixed(2)} EUR</span>
        )}
      </div>
    </div>
  );
}
