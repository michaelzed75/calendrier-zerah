// @ts-check
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Loader2, Download, AlertTriangle, Check, FileSpreadsheet, Calculator, Calendar, Database, Upload, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import {
  genererFacturationVariable,
  getDatesEffetVariables,
  syncProduitsPennylane
} from '../../utils/honoraires/facturationVariableService';
import { getAllProducts, setCompanyId } from '../../utils/honoraires/pennylaneCustomersApi';
import { exportFacturationVariableExcel, exportManquantsExcel } from '../../utils/honoraires/exportFacturationVariable';
import { parseSilaeExcel, importSilaeData, updateSilaeMapping } from '../../utils/honoraires/silaeService';
import { exportModeleManuel, parseManuelExcel, importManuelData } from '../../utils/honoraires/facturationManuelleService';
import SilaeMappingModal from './SilaeMappingModal';
import FacturationGrid from './FacturationGrid';

const MOIS_OPTIONS = [
  { value: '01', label: 'Janvier' },
  { value: '02', label: 'Février' },
  { value: '03', label: 'Mars' },
  { value: '04', label: 'Avril' },
  { value: '05', label: 'Mai' },
  { value: '06', label: 'Juin' },
  { value: '07', label: 'Juillet' },
  { value: '08', label: 'Août' },
  { value: '09', label: 'Septembre' },
  { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' },
  { value: '12', label: 'Décembre' }
];

/**
 * Panel Phase 3 : Facturation variable mensuelle.
 * Workflow linéaire vertical en 5 sections :
 * 1. Période + Tarifs
 * 2. Import Silae
 * 3. Saisie hors Silae (export modèle / import Excel)
 * 4. Export Pennylane (bouton unifié)
 * 5. Grille Silae annuelle
 *
 * @param {Object} props
 * @param {Object[]} props.clients - Clients de la BDD
 * @param {Object} props.accent - Configuration couleur
 * @param {string} props.filterCabinet - Filtre cabinet actif
 * @param {Object} props.apiKeysMap - Clés API PL par cabinet { cabinet: { api_key, company_id } }
 */
export default function FacturationVariablePanel({ clients, accent, filterCabinet, apiKeysMap }) {
  // === State ===
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  // Paramètres période + tarifs
  const [periodeMois, setPeriodeMois] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [periodeAnnee, setPeriodeAnnee] = useState(String(new Date().getFullYear()));
  const periode = `${periodeAnnee}-${periodeMois}`;
  const [dateEffet, setDateEffet] = useState('');
  const [datesEffetDisponibles, setDatesEffetDisponibles] = useState([]);

  // Résultats export PL
  const [resultat, setResultat] = useState(null);

  // Sync produits + export
  const [exporting, setExporting] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);

  // Import Silae
  const [importingSilae, setImportingSilae] = useState(false);
  const [silaeResult, setSilaeResult] = useState(null);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [unmatchedSilae, setUnmatchedSilae] = useState([]);
  const [matchedSilae, setMatchedSilae] = useState([]);
  const [pendingSilaeRows, setPendingSilaeRows] = useState([]);
  const [pendingSilaePeriode, setPendingSilaePeriode] = useState('');

  // Saisie hors Silae (import/export manuel)
  const [importingManuel, setImportingManuel] = useState(false);
  const [importManuelResult, setImportManuelResult] = useState(null);
  const fileInputRef = useRef(null);

  // Reload key pour la grille
  const [reloadKey, setReloadKey] = useState(0);

  // Anomalies prix/produit — modal de confirmation avant export
  const [anomalies, setAnomalies] = useState(null);
  const [pendingResult, setPendingResult] = useState(null);

  // === Chargement initial des dates d'effet ===
  useEffect(() => {
    (async () => {
      try {
        const dates = await getDatesEffetVariables(supabase);
        setDatesEffetDisponibles(dates);
        if (dates.length > 0) setDateEffet(dates[0]);
      } catch (err) {
        setError(`Erreur chargement initial: ${err.message}`);
      }
    })();
  }, []);

  // === Import Silae ===
  const handleSilaeFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingSilae(true);
    setSilaeResult(null);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const rows = parseSilaeExcel(buffer);

      // Utilise la période globale sélectionnée en Section 1
      const periodeImport = periode;

      const result = await importSilaeData(supabase, rows, periodeImport, clients);
      setMatchedSilae(result.matched);

      if (result.unmatched.length > 0) {
        setUnmatchedSilae(result.unmatched);
        setPendingSilaeRows(rows);
        setPendingSilaePeriode(periodeImport);
        setShowMappingModal(true);
      }

      setSilaeResult({ ...result, periode: periodeImport, filename: file.name });
      setReloadKey(k => k + 1);
    } catch (err) {
      console.error('Erreur import Silae:', err);
      setSilaeResult({ errors: [err.message] });
      setError(`Erreur import Silae: ${err.message}`);
    }
    setImportingSilae(false);
    e.target.value = '';
  }, [periode, clients]);

  const handleMappingSave = useCallback(async (mappingsMap) => {
    setShowMappingModal(false);
    try {
      for (const [codeSilae, clientIds] of mappingsMap) {
        const silaeRow = unmatchedSilae.find(r => r.code === codeSilae);
        await updateSilaeMapping(supabase, codeSilae, clientIds, silaeRow?.nom, silaeRow?.siren);
      }
      if (pendingSilaeRows.length > 0 && pendingSilaePeriode) {
        const result = await importSilaeData(supabase, pendingSilaeRows, pendingSilaePeriode, clients);
        setSilaeResult(prev => ({
          ...prev,
          inserted: (prev?.inserted || 0) + result.inserted,
          matched: [...(prev?.matched || []), ...result.matched]
        }));
        setReloadKey(k => k + 1);
      }
    } catch (err) {
      console.error('Erreur save mapping:', err);
      setError(`Erreur mapping Silae: ${err.message}`);
    }
    setUnmatchedSilae([]);
    setMatchedSilae([]);
    setPendingSilaeRows([]);
    setPendingSilaePeriode('');
  }, [unmatchedSilae, pendingSilaeRows, pendingSilaePeriode, clients]);

  // === Saisie hors Silae — Export modèle ===
  const handleExportModele = useCallback(async () => {
    try {
      const cabinet = filterCabinet !== 'tous' ? filterCabinet : undefined;
      await exportModeleManuel({ supabase, periode, cabinet });
    } catch (err) {
      alert(`Erreur export : ${err.message}`);
    }
  }, [periode, filterCabinet]);

  // === Saisie hors Silae — Import fichier ===
  const handleImportManuel = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setImportingManuel(true);
    setImportManuelResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const rows = parseManuelExcel(buffer);

      if (rows.length === 0) {
        setImportManuelResult({ updated: 0, skipped: 0, unmatched: [], message: 'Aucune donnée à importer.' });
        setImportingManuel(false);
        return;
      }

      const { data: activeClients } = await supabase
        .from('clients')
        .select('id, nom, siren')
        .eq('actif', true);

      const result = await importManuelData({ supabase, rows, periode, clients: activeClients || [] });
      setImportManuelResult(result);
      setReloadKey(k => k + 1);
    } catch (err) {
      setImportManuelResult({ updated: 0, skipped: 0, unmatched: [], message: `Erreur : ${err.message}` });
    } finally {
      setImportingManuel(false);
    }
  }, [periode]);

  // === Export Pennylane (unifié : sync + génération + export) ===
  const handleExportPL = useCallback(async () => {
    if (!periode || !dateEffet) {
      setError('Veuillez sélectionner une période et une date de tarifs.');
      return;
    }
    setExporting(true);
    setError(null);
    setResultat(null);
    setSyncStatus({ message: 'Synchronisation des produits Pennylane…', type: 'info' });

    try {
      // 1. Sync produits pour chaque cabinet
      const cabinets = filterCabinet !== 'tous'
        ? [filterCabinet]
        : ['Audit Up', 'Zerah Fiduciaire'];

      for (const cab of cabinets) {
        const keyInfo = apiKeysMap?.[cab];
        if (!keyInfo?.api_key) {
          console.warn(`[ExportPL] Pas de clé API pour ${cab}, skip sync`);
          continue;
        }
        setSyncStatus({ message: `Récupération des produits ${cab}…`, type: 'info' });
        if (keyInfo.company_id) setCompanyId(keyInfo.company_id);
        const plProducts = await getAllProducts(keyInfo.api_key);
        setSyncStatus({ message: `Mise à jour produits ${cab} (${plProducts.length})…`, type: 'info' });
        const syncResult = await syncProduitsPennylane({ supabase, cabinet: cab, plProducts });
        console.log(`[ExportPL] ${cab}: ${syncResult.created} créés, ${syncResult.updated} mis à jour`);
      }

      // 2. Générer facturation
      setSyncStatus({ message: 'Génération de la facturation…', type: 'info' });
      const cabinet = filterCabinet !== 'tous' ? filterCabinet : undefined;
      const result = await genererFacturationVariable({
        supabase, periode, dateEffet, cabinet, onProgress: setProgress
      });
      setResultat(result);

      // 3. Vérifier anomalies (prix manquants / produit PL manquant)
      const detectedAnomalies = [];
      for (const client of result.clients) {
        for (const ligne of client.lignes) {
          if (!ligne.quantite) continue;
          const issues = [];
          if (ligne.pu_ht === null || ligne.pu_ht === undefined ||
              (ligne.pu_ht === 0 && ligne.label_normalise !== 'coffre_fort')) {
            issues.push('Prix manquant (0 €)');
          }
          if (!ligne.pennylane_product_id) {
            issues.push('Produit PL non trouvé');
          }
          if (issues.length > 0) {
            detectedAnomalies.push({
              client_nom: client.client_nom,
              cabinet: client.cabinet,
              label: ligne.label,
              pu_ht: ligne.pu_ht,
              issues
            });
          }
        }
      }

      if (detectedAnomalies.length > 0) {
        // Anomalies détectées → afficher modal, stocker résultat en attente
        setAnomalies(detectedAnomalies);
        setPendingResult(result);
        setSyncStatus({ message: `${detectedAnomalies.length} anomalie(s) détectée(s)`, type: 'error' });
        return; // PAS d'export automatique
      }

      // 4. Pas d'anomalies → Export Excel direct
      setSyncStatus({ message: 'Export Excel…', type: 'info' });
      exportFacturationVariableExcel({ resultat: result, periode });

      setSyncStatus({ message: 'Export terminé ✓', type: 'success' });
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err) {
      console.error('[ExportPL] Erreur:', err);
      setSyncStatus({ message: `Erreur: ${err.message}`, type: 'error' });
    } finally {
      setExporting(false);
      setProgress(null);
    }
  }, [periode, dateEffet, filterCabinet, apiKeysMap]);

  // === Anomalies : exporter quand même ===
  const handleConfirmExport = useCallback(() => {
    if (!pendingResult) return;
    exportFacturationVariableExcel({ resultat: pendingResult, periode });
    setSyncStatus({ message: 'Export terminé ✓', type: 'success' });
    setTimeout(() => setSyncStatus(null), 3000);
    setAnomalies(null);
    setPendingResult(null);
  }, [pendingResult, periode]);

  // === Anomalies : exporter la liste des manquants ===
  const handleExportManquants = useCallback(() => {
    if (!anomalies) return;
    exportManquantsExcel(anomalies, periode);
    setAnomalies(null);
    setPendingResult(null);
    setSyncStatus(null);
  }, [anomalies, periode]);

  // === Anomalies : annuler ===
  const handleCancelExport = useCallback(() => {
    setAnomalies(null);
    setPendingResult(null);
    setSyncStatus(null);
  }, []);

  // ═══════════════════════ RENDER ═══════════════════════

  return (
    <div className="space-y-4">
      {/* ── Section 1 : Période + Tarifs ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Facturation variable mensuelle</h3>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-3">
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Mois
            </label>
            <select
              value={periodeMois}
              onChange={e => setPeriodeMois(e.target.value)}
              className="w-full bg-slate-700 text-white border border-slate-600 rounded px-3 py-2"
            >
              {MOIS_OPTIONS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-1">Année</label>
            <select
              value={periodeAnnee}
              onChange={e => setPeriodeAnnee(e.target.value)}
              className="w-full bg-slate-700 text-white border border-slate-600 rounded px-3 py-2"
            >
              {[2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                <option key={y} value={String(y)}>{y}</option>
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

      {/* ── Section 2 : Import Silae ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Upload className="w-4 h-4 text-orange-400" />
          <h4 className="text-white font-semibold text-sm">Importer un fichier Silae</h4>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-sm text-white">
            Période : <strong>{MOIS_OPTIONS.find(m => m.value === periodeMois)?.label} {periodeAnnee}</strong>
          </div>
          <div className="flex items-end">
            <label className={`px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-2 text-sm font-medium transition ${
              importingSilae ? 'bg-slate-600 text-white' : 'bg-orange-600 text-white hover:bg-orange-500'
            }`}>
              {importingSilae ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importingSilae ? 'Import en cours…' : 'Choisir fichier Silae'}
              <input type="file" accept=".xlsx,.xls" onChange={handleSilaeFileSelect} className="hidden" disabled={importingSilae} />
            </label>
          </div>
          {silaeResult && silaeResult.inserted !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-white">
                {silaeResult.inserted} importés pour {silaeResult.periode}
              </span>
              {silaeResult.unmatched?.length > 0 && (
                <span className="text-amber-400 text-xs">
                  ({silaeResult.unmatched.length} non mappés)
                </span>
              )}
            </div>
          )}
          {silaeResult?.errors?.length > 0 && !silaeResult.inserted && (
            <span className="text-red-400 text-sm">{silaeResult.errors[0]}</span>
          )}
        </div>
      </div>

      {/* ── Section 3 : Saisie hors Silae ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-purple-400" />
          <h4 className="text-white font-semibold text-sm">Saisie hors Silae (bulletins manuels, refaits, temps passé…)</h4>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-sm text-white">
            Période : <strong>{MOIS_OPTIONS.find(m => m.value === periodeMois)?.label} {periodeAnnee}</strong>
          </div>

          <button
            onClick={handleExportModele}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Exporter modèle
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importingManuel}
            className="bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            {importingManuel
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Upload className="w-3.5 h-3.5" />}
            Importer Excel
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleImportManuel}
            className="hidden"
          />
        </div>

        {/* Résultat import manuel */}
        {importManuelResult && (
          <div className="mt-3 p-2 rounded text-sm border bg-slate-700/50 border-slate-600">
            <div className="flex items-center justify-between">
              <div className="text-white">
                {importManuelResult.message || (
                  <>
                    Import : <span className="font-semibold">{importManuelResult.updated}</span> mis à jour,{' '}
                    <span className="font-semibold">{importManuelResult.skipped}</span> ignorés
                  </>
                )}
              </div>
              <button onClick={() => setImportManuelResult(null)} className="text-white hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {importManuelResult.unmatched?.length > 0 && (
              <div className="mt-1 text-white text-xs">
                Non matchés : {importManuelResult.unmatched.join(', ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Section 4 : Export Pennylane ── */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Download className="w-4 h-4 text-emerald-400" />
          <h4 className="text-white font-semibold text-sm">Export pour Pennylane</h4>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleExportPL}
            disabled={exporting || !periode || !dateEffet}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white rounded font-medium transition"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? (progress || syncStatus?.message || 'En cours…') : 'Générer et Exporter Excel'}
          </button>

          {syncStatus && !exporting && (
            <span className={`text-sm ${syncStatus.type === 'error' ? 'text-red-400' : syncStatus.type === 'success' ? 'text-emerald-400' : 'text-white'}`}>
              {syncStatus.message}
            </span>
          )}
        </div>

        {/* Statistiques après génération */}
        {resultat && (
          <div className="grid grid-cols-5 gap-3 mt-3">
            <StatCard label="Clients variables" value={resultat.stats.nb_clients} color="purple" />
            <StatCard label="Avec Silae" value={resultat.stats.nb_avec_silae} color="emerald" />
            <StatCard label="Sans Silae" value={resultat.stats.nb_sans_silae} color="red" />
            <StatCard label="Complets" value={resultat.stats.nb_complets} color="blue" />
            <StatCard label="Total HT auto" value={`${resultat.stats.total_ht_auto.toFixed(2)} €`} color="amber" />
          </div>
        )}
      </div>

      {/* Erreur */}
      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <span className="text-white text-sm">{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
          <span className="ml-3 text-white">{progress || 'Chargement...'}</span>
        </div>
      )}

      {/* Modal anomalies prix/produit */}
      {anomalies && anomalies.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-amber-700 rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-slate-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h3 className="text-white font-semibold">
                {anomalies.length} anomalie{anomalies.length > 1 ? 's' : ''} détectée{anomalies.length > 1 ? 's' : ''}
              </h3>
              <span className="text-white text-sm ml-2">— prix ou produit Pennylane manquant</span>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-600">
                    <th className="text-white pb-2 pr-3">Client</th>
                    <th className="text-white pb-2 pr-3">Cabinet</th>
                    <th className="text-white pb-2 pr-3">Produit</th>
                    <th className="text-white pb-2 pr-3 text-right">PU HT</th>
                    <th className="text-white pb-2">Anomalie</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.map((a, i) => (
                    <tr key={i} className="border-b border-slate-700/50">
                      <td className="text-white py-1.5 pr-3">{a.client_nom}</td>
                      <td className="text-white py-1.5 pr-3">{a.cabinet === 'Audit Up' ? 'AUP' : 'ZF'}</td>
                      <td className="text-white py-1.5 pr-3">{a.label}</td>
                      <td className="text-white py-1.5 pr-3 text-right">{a.pu_ht != null ? `${a.pu_ht} €` : '—'}</td>
                      <td className="py-1.5">
                        {a.issues.map((issue, j) => (
                          <span key={j} className={`inline-block text-xs px-1.5 py-0.5 rounded mr-1 ${
                            issue.includes('Prix') ? 'bg-red-900/50 text-white' : 'bg-amber-900/50 text-white'
                          }`}>{issue}</span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-700 flex items-center gap-3 justify-end">
              <button
                onClick={handleCancelExport}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleExportManquants}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Exporter la liste
              </button>
              <button
                onClick={handleConfirmExport}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Exporter quand même
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal mapping Silae */}
      {showMappingModal && unmatchedSilae.length > 0 && (
        <SilaeMappingModal
          unmatchedRows={unmatchedSilae}
          matchedRows={matchedSilae}
          clients={clients}
          onSave={handleMappingSave}
          onClose={() => setShowMappingModal(false)}
          accent={accent}
        />
      )}

      {/* ── Section 5 : Grille Silae annuelle ── */}
      <FacturationGrid filterCabinet={filterCabinet} externalReloadKey={reloadKey} />
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
