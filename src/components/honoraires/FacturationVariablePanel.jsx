// @ts-check
import React, { useState, useCallback, useEffect } from 'react';
import { Loader2, Download, Search, AlertTriangle, Check, FileSpreadsheet, Calculator, ChevronDown, ChevronRight, Calendar, Database } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import {
  genererFacturationVariable,
  genererFacturationClient,
  getPeriodesDisponibles,
  getDatesEffetVariables,
  syncProduitsPennylane
} from '../../utils/honoraires/facturationVariableService';
import { getAllProducts, setCompanyId } from '../../utils/honoraires/pennylaneCustomersApi';
import { exportFacturationVariableExcel } from '../../utils/honoraires/exportFacturationVariable';

/**
 * Panel Phase 3 : Facturation variable mensuelle.
 * Combine les quantités Silae + tarifs 2026 pour générer les brouillons
 * de factures variables à importer dans Pennylane.
 *
 * @param {Object} props
 * @param {Object[]} props.clients - Clients de la BDD
 * @param {Object} props.accent - Configuration couleur
 * @param {string} props.filterCabinet - Filtre cabinet actif
 * @param {Object} props.apiKeysMap - Clés API PL par cabinet { cabinet: { api_key, company_id } }
 */
export default function FacturationVariablePanel({ clients, accent, filterCabinet, apiKeysMap }) {
  // === State ===
  const [mode, setMode] = useState('single'); // 'single' | 'all'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  // Paramètres
  const [periode, setPeriode] = useState('');
  const [dateEffet, setDateEffet] = useState('');
  const [periodesDisponibles, setPeriodesDisponibles] = useState([]);
  const [datesEffetDisponibles, setDatesEffetDisponibles] = useState([]);

  // Résultats
  const [resultat, setResultat] = useState(null);
  const [clientResult, setClientResult] = useState(null);
  const [expandedClients, setExpandedClients] = useState(new Set());

  // Sync produits
  const [exporting, setExporting] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // { message, type: 'info'|'success'|'error' }

  // === Chargement initial des périodes et dates ===
  useEffect(() => {
    (async () => {
      try {
        const [periodes, dates] = await Promise.all([
          getPeriodesDisponibles(supabase),
          getDatesEffetVariables(supabase)
        ]);
        setPeriodesDisponibles(periodes);
        setDatesEffetDisponibles(dates);

        // Pré-sélectionner la plus récente
        if (periodes.length > 0) setPeriode(periodes[0]);
        if (dates.length > 0) setDateEffet(dates[0]);
      } catch (err) {
        setError(`Erreur chargement initial: ${err.message}`);
      }
    })();
  }, []);

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

  // === Générer pour un client ===
  const handleGenererClient = useCallback(async (clientId) => {
    if (!periode || !dateEffet) {
      setError('Veuillez sélectionner une période et une date de tarifs.');
      return;
    }
    setLoading(true);
    setError(null);
    setClientResult(null);
    try {
      const result = await genererFacturationClient({
        supabase,
        clientId,
        periode,
        dateEffet
      });
      if (!result) {
        setError('Aucun tarif variable trouvé pour ce client.');
      } else {
        setClientResult(result);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [periode, dateEffet]);

  // === Générer pour tous ===
  const handleGenererTous = useCallback(async () => {
    if (!periode || !dateEffet) {
      setError('Veuillez sélectionner une période et une date de tarifs.');
      return;
    }
    setLoading(true);
    setError(null);
    setResultat(null);
    try {
      const cabinet = filterCabinet !== 'tous' ? filterCabinet : undefined;
      const result = await genererFacturationVariable({
        supabase,
        periode,
        dateEffet,
        cabinet,
        onProgress: setProgress
      });
      setResultat(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [periode, dateEffet, filterCabinet]);

  /**
   * Sync produits PL → base locale, puis re-génère les données client et exporte.
   * @param {'single'|'batch'} exportMode
   */
  const handleSyncAndExport = useCallback(async (exportMode) => {
    setExporting(true);
    setSyncStatus({ message: 'Synchronisation des produits Pennylane…', type: 'info' });

    try {
      // Déterminer le(s) cabinet(s) à syncer
      const cabinets = exportMode === 'single' && clientResult
        ? [clientResult.cabinet]
        : [...new Set((resultat?.clients || []).map(c => c.cabinet))];

      // Sync produits pour chaque cabinet
      for (const cab of cabinets) {
        const keyInfo = apiKeysMap?.[cab];
        if (!keyInfo?.api_key) {
          console.warn(`[SyncExport] Pas de clé API pour ${cab}, skip sync`);
          continue;
        }

        setSyncStatus({ message: `Récupération des produits ${cab}…`, type: 'info' });
        if (keyInfo.company_id) setCompanyId(keyInfo.company_id);
        const plProducts = await getAllProducts(keyInfo.api_key);

        setSyncStatus({ message: `Mise à jour produits ${cab} (${plProducts.length})…`, type: 'info' });
        const syncResult = await syncProduitsPennylane({ supabase, cabinet: cab, plProducts });
        console.log(`[SyncExport] ${cab}: ${syncResult.created} créés, ${syncResult.updated} mis à jour`);
      }

      // Re-générer les données avec les produits à jour
      setSyncStatus({ message: 'Régénération de la facturation…', type: 'info' });

      if (exportMode === 'single' && selectedClientId) {
        const freshClient = await genererFacturationClient({
          supabase, clientId: selectedClientId, periode, dateEffet
        });
        if (freshClient) {
          setClientResult(freshClient);
          exportFacturationVariableExcel({ client: freshClient, periode });
        }
      } else if (exportMode === 'batch' && resultat) {
        const freshResultat = await genererFacturationVariable({
          supabase, periode, dateEffet, cabinet: filterCabinet
        });
        if (freshResultat) {
          setResultat(freshResultat);
          exportFacturationVariableExcel({ resultat: freshResultat, periode });
        }
      }

      setSyncStatus({ message: 'Export terminé ✓', type: 'success' });
      setTimeout(() => setSyncStatus(null), 3000);

    } catch (err) {
      console.error('[SyncExport] Erreur:', err);
      setSyncStatus({ message: `Erreur: ${err.message}`, type: 'error' });
    } finally {
      setExporting(false);
    }
  }, [clientResult, resultat, selectedClientId, periode, dateEffet, filterCabinet, apiKeysMap]);

  // === Toggle expand ===
  const toggleClient = (id) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ═══════════════════════ RENDER ═══════════════════════

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Facturation variable mensuelle</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setMode('single'); setResultat(null); }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                mode === 'single'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
            >
              <Search className="w-4 h-4 inline mr-1" />
              Un client
            </button>
            <button
              onClick={() => { setMode('all'); setClientResult(null); }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                mode === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700 text-white hover:bg-slate-600'
              }`}
            >
              <Database className="w-4 h-4 inline mr-1" />
              Tous les clients
            </button>
          </div>
        </div>

        {/* Sélecteurs période + date d'effet */}
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Période Silae
            </label>
            <select
              value={periode}
              onChange={e => setPeriode(e.target.value)}
              className="w-full bg-slate-700 text-white border border-slate-600 rounded px-3 py-2"
            >
              <option value="">Sélectionner...</option>
              {periodesDisponibles.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              <FileSpreadsheet className="w-4 h-4 inline mr-1" />
              Tarifs (date d'effet)
            </label>
            <select
              value={dateEffet}
              onChange={e => setDateEffet(e.target.value)}
              className="w-full bg-slate-700 text-white border border-slate-600 rounded px-3 py-2"
            >
              <option value="">Sélectionner...</option>
              {datesEffetDisponibles.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-sm text-white">
          Combine les quantités <strong>Silae</strong> avec les tarifs <strong>2026</strong> pour générer
          les brouillons de factures variables. Les colonnes manuelles (ex: modification de bulletin)
          restent vides avec l'étiquette.
        </p>
      </div>

      {/* Erreur */}
      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <span className="text-white text-sm">{error}</span>
        </div>
      )}

      {/* Mode single : recherche client */}
      {mode === 'single' && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-white" />
            <input
              type="text"
              placeholder="Rechercher un client (nom, SIREN, PL ID)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-700 text-white border border-slate-600 rounded pl-10 pr-3 py-2"
            />
          </div>

          {/* Résultats recherche */}
          {filteredClients.length > 0 && !clientResult && (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {filteredClients.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedClientId(c.id); setSearchQuery(c.nom); handleGenererClient(c.id); }}
                  className="w-full text-left px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm flex items-center justify-between"
                >
                  <span className="text-white font-medium">{c.nom}</span>
                  <span className="text-white text-xs">{c.cabinet} • {c.siren || '—'}</span>
                </button>
              ))}
            </div>
          )}

          {/* Résultat client unique */}
          {clientResult && (
            <>
              <div className="flex items-center justify-end gap-3 mb-2">
                {syncStatus && (
                  <span className={`text-xs ${syncStatus.type === 'error' ? 'text-red-400' : syncStatus.type === 'success' ? 'text-green-400' : 'text-white'}`}>
                    {syncStatus.message}
                  </span>
                )}
                <button
                  onClick={() => handleSyncAndExport('single')}
                  disabled={exporting}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white rounded font-medium transition text-sm"
                >
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {exporting ? 'Sync & Export…' : `Exporter ${periode} a importer dans PL.xlsx`}
                </button>
              </div>
              <ClientDetail client={clientResult} />
            </>
          )}
        </div>
      )}

      {/* Mode all : tous les clients */}
      {mode === 'all' && (
        <div className="space-y-3">
          {/* Boutons action */}
          <div className="flex gap-3">
            <button
              onClick={handleGenererTous}
              disabled={loading || !periode || !dateEffet}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white rounded font-medium transition"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
              {loading ? (progress || 'Chargement...') : 'Générer la facturation'}
            </button>

            {resultat && (
              <button
                onClick={() => handleSyncAndExport('batch')}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white rounded font-medium transition"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {exporting ? 'Sync & Export…' : 'Exporter Excel'}
              </button>
            )}
          </div>

          {/* Statistiques */}
          {resultat && (
            <div className="grid grid-cols-5 gap-3">
              <StatCard label="Clients variables" value={resultat.stats.nb_clients} color="purple" />
              <StatCard label="Avec Silae" value={resultat.stats.nb_avec_silae} color="emerald" />
              <StatCard label="Sans Silae" value={resultat.stats.nb_sans_silae} color="red" />
              <StatCard label="Complets" value={resultat.stats.nb_complets} color="blue" />
              <StatCard label="Total HT auto" value={`${resultat.stats.total_ht_auto.toFixed(2)} €`} color="amber" />
            </div>
          )}

          {/* Liste des clients */}
          {resultat && resultat.clients.length > 0 && (
            <div className="bg-slate-800 border border-slate-700 rounded-lg divide-y divide-slate-700">
              {resultat.clients.map(client => (
                <div key={client.client_id}>
                  {/* Header client */}
                  <button
                    onClick={() => toggleClient(client.client_id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/50 transition"
                  >
                    <div className="flex items-center gap-3">
                      {expandedClients.has(client.client_id)
                        ? <ChevronDown className="w-4 h-4 text-white" />
                        : <ChevronRight className="w-4 h-4 text-white" />
                      }
                      <span className="text-white font-medium">{client.client_nom}</span>
                      <span className="text-white text-xs bg-slate-700 px-2 py-0.5 rounded">{client.cabinet}</span>
                      {client.has_silae
                        ? <span className="text-white text-xs bg-emerald-900/50 px-2 py-0.5 rounded">Silae ✓</span>
                        : <span className="text-white text-xs bg-red-900/50 px-2 py-0.5 rounded">Pas de Silae</span>
                      }
                      {client.complet
                        ? <Check className="w-4 h-4 text-emerald-400" />
                        : <AlertTriangle className="w-4 h-4 text-amber-400" />
                      }
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-white text-sm">{client.lignes.length} produits</span>
                      <span className="text-white font-medium">{client.total_ht_auto.toFixed(2)} € HT</span>
                    </div>
                  </button>

                  {/* Détail lignes */}
                  {expandedClients.has(client.client_id) && (
                    <ClientDetail client={client} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
          <span className="ml-3 text-white">{progress || 'Chargement...'}</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════ Composants internes ═══════════════════════

function StatCard({ label, value, color }) {
  const colorMap = {
    purple: 'bg-purple-900/30 border-purple-800',
    emerald: 'bg-emerald-900/30 border-emerald-800',
    red: 'bg-red-900/30 border-red-800',
    blue: 'bg-blue-900/30 border-blue-800',
    amber: 'bg-amber-900/30 border-amber-800'
  };
  return (
    <div className={`${colorMap[color] || colorMap.purple} border rounded-lg p-3 text-center`}>
      <div className="text-white text-lg font-bold">{value}</div>
      <div className="text-white text-xs">{label}</div>
    </div>
  );
}

function ClientDetail({ client }) {
  return (
    <div className="px-4 pb-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-600">
            <th className="text-left py-2 text-white font-medium">Produit</th>
            <th className="text-center py-2 text-white font-medium w-20">Source</th>
            <th className="text-center py-2 text-white font-medium w-20">Quantité</th>
            <th className="text-right py-2 text-white font-medium w-24">PU HT</th>
            <th className="text-right py-2 text-white font-medium w-28">Montant HT</th>
          </tr>
        </thead>
        <tbody>
          {client.lignes.map((ligne, i) => (
            <tr key={i} className="border-b border-slate-700/50">
              <td className="py-2 text-white">{ligne.label}</td>
              <td className="py-2 text-center">
                {ligne.source === 'silae' ? (
                  <span className="text-white text-xs bg-emerald-900/50 px-2 py-0.5 rounded">Silae</span>
                ) : (
                  <span className="text-white text-xs bg-amber-900/50 px-2 py-0.5 rounded">Manuel</span>
                )}
              </td>
              <td className="py-2 text-center text-white font-medium">
                {ligne.quantite !== null ? ligne.quantite : (
                  <span className="text-amber-400 italic">à saisir</span>
                )}
              </td>
              <td className="py-2 text-right text-white">{ligne.pu_ht.toFixed(2)} €</td>
              <td className="py-2 text-right text-white font-medium">
                {ligne.montant_ht !== null
                  ? `${ligne.montant_ht.toFixed(2)} €`
                  : <span className="text-amber-400 italic">—</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-600">
            <td colSpan={4} className="py-2 text-right text-white font-bold">Total auto HT :</td>
            <td className="py-2 text-right text-white font-bold">{client.total_ht_auto.toFixed(2)} €</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
