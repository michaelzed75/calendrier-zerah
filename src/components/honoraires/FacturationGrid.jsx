// @ts-check
import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Loader2, CalendarDays, AlertTriangle, Users, ShieldCheck, Download, Upload, X, Save } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { chargerDonneesGrille, sauverDonneesManuelles } from '../../utils/honoraires/facturationVariableService';
import { exportModeleManuel, parseManuelExcel, importManuelData } from '../../utils/honoraires/facturationManuelleService';

// ═══════════════════════════ Constantes ═══════════════════════════

const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];
const MOIS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const YEAR_OPTIONS = [];
for (let y = 2025; y <= 2030; y++) YEAR_OPTIONS.push(y);

// ═══════════════════════════ Helpers ═══════════════════════════

function getSilaeRow(silaeByClient, clientId, year, month) {
  const moisMap = silaeByClient.get(clientId);
  if (!moisMap) return null;
  return moisMap.get(`${year}-${month}`) || null;
}

function getRowTotal(silaeByClient, clientId, year, field) {
  let total = 0;
  for (const m of MONTHS) {
    const row = getSilaeRow(silaeByClient, clientId, year, m);
    if (row) total += (row[field] || 0);
  }
  return total;
}

function getColTotal(silaeByClient, clientIds, year, month, field) {
  let total = 0;
  for (const id of clientIds) {
    const row = getSilaeRow(silaeByClient, id, year, month);
    if (row) total += (row[field] || 0);
  }
  return total;
}

function getGrandTotal(silaeByClient, clientIds, year, field) {
  let total = 0;
  for (const id of clientIds) {
    total += getRowTotal(silaeByClient, id, year, field);
  }
  return total;
}

// ═══════════════════════════ TooltipCell ═══════════════════════════

const TooltipCell = memo(function TooltipCell({ silaeRow, value, tooltipContent, positiveColor = 'emerald', isManuel, refaits, onClick }) {
  const [hovered, setHovered] = useState(false);

  let bgClass = '';
  if (silaeRow) {
    if (isManuel && value > 0) {
      bgClass = 'bg-purple-900/30';
    } else if (value > 0) {
      bgClass = positiveColor === 'emerald' ? 'bg-emerald-900/30' : 'bg-blue-900/30';
    } else {
      bgClass = 'bg-amber-900/30';
    }
  }

  return (
    <td
      className={`relative text-center text-sm px-1.5 py-1.5 border-r border-slate-700 cursor-pointer hover:ring-1 hover:ring-purple-500/50 ${bgClass}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <span className="text-white">{silaeRow ? value : ''}</span>
      {refaits > 0 && (
        <span className="text-xs text-purple-400 ml-0.5">+{refaits}R</span>
      )}
      {hovered && silaeRow && tooltipContent && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-slate-600 rounded p-2 text-xs text-white whitespace-nowrap shadow-lg pointer-events-none mb-1">
          {tooltipContent}
        </div>
      )}
    </td>
  );
});

// ═══════════════════════════ Popover édition ═══════════════════════════

function EditPopover({ editCell, editValues, setEditValues, onSave, onCancel, saving }) {
  if (!editCell) return null;

  const handleChange = (field, value) => {
    setEditValues(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="bg-slate-900 border border-slate-600 rounded-lg p-4 shadow-xl w-80"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-white font-semibold text-sm truncate max-w-[220px]">{editCell.clientNom}</div>
            <div className="text-white text-xs">{editCell.periodeFr}</div>
          </div>
          <button onClick={onCancel} className="text-white hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Silae auto */}
        <div className="text-white text-xs mb-3 bg-slate-800 rounded p-2 border border-slate-700">
          {editCell.currentRow
            ? `Silae auto : ${editCell.currentRow.bulletins || 0} bulletins`
            : 'Pas de data Silae'}
        </div>

        {/* Champs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-white text-sm">Bulletins manuels</label>
            <input
              type="number" min="0"
              value={editValues.bulletins_manuels}
              onChange={e => handleChange('bulletins_manuels', parseInt(e.target.value) || 0)}
              className="bg-slate-700 text-white border border-slate-600 rounded px-2 py-1 text-sm w-20 text-right"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-white text-sm">Bulletins refaits</label>
            <input
              type="number" min="0"
              value={editValues.bulletins_refaits}
              onChange={e => handleChange('bulletins_refaits', parseInt(e.target.value) || 0)}
              className="bg-slate-700 text-white border border-slate-600 rounded px-2 py-1 text-sm w-20 text-right"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-white text-sm">Temps passe (h)</label>
            <input
              type="number" min="0" step="0.5"
              value={editValues.temps_passe}
              onChange={e => handleChange('temps_passe', parseFloat(e.target.value) || 0)}
              className="bg-slate-700 text-white border border-slate-600 rounded px-2 py-1 text-sm w-20 text-right"
            />
          </div>
          <div>
            <label className="text-white text-sm block mb-1">Commentaires</label>
            <textarea
              value={editValues.commentaires}
              onChange={e => handleChange('commentaires', e.target.value)}
              className="bg-slate-700 text-white border border-slate-600 rounded px-2 py-1 text-sm w-full resize-none"
              rows={2}
            />
          </div>
        </div>

        {/* Boutons */}
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={onCancel}
            className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-sm"
          >
            Annuler
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Sauver
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════ Composant principal ═══════════════════════════

/**
 * Grille Silae 12 mois : suivi annuel des imports par client.
 * @param {Object} props
 * @param {string} props.filterCabinet - Filtre cabinet actif ('tous', 'Audit Up', 'Zerah Fiduciaire')
 */
export default function FacturationGrid({ filterCabinet }) {
  const [gridYear, setGridYear] = useState(new Date().getFullYear());
  const [gridData, setGridData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Popover
  const [editCell, setEditCell] = useState(null);
  const [editValues, setEditValues] = useState({ bulletins_manuels: 0, bulletins_refaits: 0, temps_passe: 0, commentaires: '' });
  const [saving, setSaving] = useState(false);

  // Import/Export
  const [importMois, setImportMois] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [importingManuel, setImportingManuel] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  // Reload counter to trigger re-fetch after save/import
  const [reloadKey, setReloadKey] = useState(0);

  // Chargement des données
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const cabinet = filterCabinet !== 'tous' ? filterCabinet : undefined;
        const data = await chargerDonneesGrille({ supabase, year: gridYear, cabinet });
        if (!cancelled) setGridData(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [gridYear, filterCabinet, reloadKey]);

  // ═══════════════════════ Popover handlers ═══════════════════════

  const handleCellClick = useCallback((client, month) => {
    const row = getSilaeRow(gridData?.silaeByClient || new Map(), client.id, gridYear, month);
    const moisIndex = parseInt(month, 10) - 1;
    setEditCell({
      clientId: client.id,
      clientNom: client.nom,
      periode: `${gridYear}-${month}`,
      periodeFr: `${MOIS_FR[moisIndex]} ${gridYear}`,
      currentRow: row
    });
    setEditValues({
      bulletins_manuels: row?.bulletins_manuels || 0,
      bulletins_refaits: row?.bulletins_refaits || 0,
      temps_passe: row?.temps_passe || 0,
      commentaires: row?.commentaires || ''
    });
  }, [gridData, gridYear]);

  const handleSave = useCallback(async () => {
    if (!editCell) return;
    setSaving(true);
    try {
      await sauverDonneesManuelles({
        supabase,
        clientId: editCell.clientId,
        periode: editCell.periode,
        data: editValues
      });
      setEditCell(null);
      setReloadKey(k => k + 1);
    } catch (err) {
      alert(`Erreur : ${err.message}`);
    } finally {
      setSaving(false);
    }
  }, [editCell, editValues]);

  const handleCancelEdit = useCallback(() => {
    setEditCell(null);
  }, []);

  // ═══════════════════════ Import/Export handlers ═══════════════════════

  const handleExportModele = useCallback(async () => {
    try {
      const cabinet = filterCabinet !== 'tous' ? filterCabinet : undefined;
      const periode = `${gridYear}-${importMois}`;
      await exportModeleManuel({ supabase, periode, cabinet });
    } catch (err) {
      alert(`Erreur export : ${err.message}`);
    }
  }, [gridYear, importMois, filterCabinet]);

  const handleImportFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setImportingManuel(true);
    setImportResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const rows = parseManuelExcel(buffer);

      if (rows.length === 0) {
        setImportResult({ updated: 0, skipped: 0, unmatched: [], message: 'Aucune donnee a importer.' });
        setImportingManuel(false);
        return;
      }

      // Charger les clients actifs pour le matching
      const { data: clients } = await supabase
        .from('clients')
        .select('id, nom, siren')
        .eq('actif', true);

      const periode = `${gridYear}-${importMois}`;
      const result = await importManuelData({ supabase, rows, periode, clients: clients || [] });
      setImportResult(result);
      setReloadKey(k => k + 1);
    } catch (err) {
      setImportResult({ updated: 0, skipped: 0, unmatched: [], message: `Erreur : ${err.message}` });
    } finally {
      setImportingManuel(false);
    }
  }, [gridYear, importMois]);

  // ═══════════════════════ Infobulle enrichie ═══════════════════════

  const renderTooltipReel = useCallback((row) => (
    <div className="space-y-0.5">
      <div className="font-semibold text-white border-b border-slate-600 pb-1 mb-1">
        {row.periode}
      </div>
      <div>Bulletins : <span className="font-medium">{row.bulletins || 0}</span></div>
      <div>Coffre-fort : <span className="font-medium">{row.coffre_fort || 0}</span></div>
      <div>Editique : <span className="font-medium">{row.editique || 0}</span></div>
      <div>Entrees : <span className="font-medium">{row.entrees || 0}</span></div>
      <div>Sorties : <span className="font-medium">{row.sorties || 0}</span></div>
      <div>Declarations : <span className="font-medium">{row.declarations || 0}</span></div>
      <div>Attestations PE : <span className="font-medium">{row.attestations_pe || 0}</span></div>
      {/* Séparateur données manuelles */}
      {((row.bulletins_manuels || 0) > 0 || (row.bulletins_refaits || 0) > 0 || (row.temps_passe || 0) > 0 || row.commentaires) && (
        <>
          <div className="border-t border-slate-600 my-1 pt-1 text-purple-400 font-semibold">Saisie manuelle</div>
          {(row.bulletins_manuels || 0) > 0 && (
            <div>Bulletins manuels : <span className="font-medium">{row.bulletins_manuels}</span></div>
          )}
          {(row.bulletins_refaits || 0) > 0 && (
            <div>Bulletins refaits : <span className="font-medium">{row.bulletins_refaits}</span></div>
          )}
          {(row.temps_passe || 0) > 0 && (
            <div>Temps passe : <span className="font-medium">{row.temps_passe}h</span></div>
          )}
          {row.commentaires && (
            <div>Commentaires : <span className="font-medium">"{row.commentaires}"</span></div>
          )}
        </>
      )}
    </div>
  ), []);

  const renderTooltipForfait = useCallback((row) => (
    <div className="space-y-0.5">
      <div className="font-semibold text-white border-b border-slate-600 pb-1 mb-1">
        {row.periode}
      </div>
      <div>Coffre-fort : <span className="font-medium">{row.coffre_fort || 0}</span></div>
      <div>Editique : <span className="font-medium">{row.editique || 0}</span></div>
    </div>
  ), []);

  // ═══════════════════════ Cell value helpers ═══════════════════════

  /** Valeur affichée pour un client au réel */
  const getCellDisplay = useCallback((row) => {
    if (!row) return { value: null, isManuel: false, refaits: 0 };
    const auto = row.bulletins || 0;
    const manuel = row.bulletins_manuels || 0;
    const refaits = row.bulletins_refaits || 0;
    const value = auto > 0 ? auto : (manuel > 0 ? manuel : 0);
    return { value, isManuel: auto === 0 && manuel > 0, refaits };
  }, []);

  // ═══════════════════════ RENDER ═══════════════════════

  if (loading) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
        <span className="ml-3 text-white">Chargement de la grille Silae {gridYear}...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <span className="text-white text-sm">{error}</span>
      </div>
    );
  }

  const { clientsReel = [], clientsForfait = [], silaeByClient = new Map() } = gridData || {};
  const reelIds = clientsReel.map(c => c.id);
  const forfaitIds = clientsForfait.map(c => c.id);

  return (
    <div className="space-y-4">
      {/* En-tete avec controles */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Suivi Silae annuel</h3>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Selecteur annee */}
            <div className="flex items-center gap-1.5">
              <label className="text-sm text-white font-medium">Annee :</label>
              <select
                value={gridYear}
                onChange={e => setGridYear(Number(e.target.value))}
                className="bg-slate-700 text-white border border-slate-600 rounded px-2 py-1.5 text-sm"
              >
                {YEAR_OPTIONS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Selecteur mois (pour import/export) */}
            <div className="flex items-center gap-1.5">
              <label className="text-sm text-white font-medium">Mois :</label>
              <select
                value={importMois}
                onChange={e => setImportMois(e.target.value)}
                className="bg-slate-700 text-white border border-slate-600 rounded px-2 py-1.5 text-sm"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={m}>{MOIS_FR[i]}</option>
                ))}
              </select>
            </div>

            {/* Bouton Export modele */}
            <button
              onClick={handleExportModele}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Exporter modele
            </button>

            {/* Bouton Import Excel */}
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
              onChange={handleImportFile}
              className="hidden"
            />
          </div>
        </div>

        {/* Resultat import */}
        {importResult && (
          <div className="mt-3 p-2 rounded text-sm border bg-slate-700/50 border-slate-600">
            <div className="flex items-center justify-between">
              <div className="text-white">
                {importResult.message || (
                  <>
                    Import : <span className="font-semibold text-white">{importResult.updated}</span> mis a jour,{' '}
                    <span className="font-semibold text-white">{importResult.skipped}</span> ignores
                  </>
                )}
              </div>
              <button onClick={() => setImportResult(null)} className="text-white hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {importResult.unmatched?.length > 0 && (
              <div className="mt-1 text-white text-xs">
                Non matches : {importResult.unmatched.join(', ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table 1 : Clients au reel */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-emerald-400" />
          <h4 className="text-white font-semibold text-sm">
            Clients au reel — Bulletins de salaire
          </h4>
          <span className="text-white text-xs bg-emerald-900/50 px-2 py-0.5 rounded">
            {clientsReel.length} clients
          </span>
        </div>

        {clientsReel.length === 0 ? (
          <p className="text-white text-sm">Aucun client au reel trouve pour {gridYear}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-700/50">
                  <th className="text-left py-2 px-3 text-white font-medium sticky left-0 bg-slate-700/50 z-10 min-w-[180px]">Client</th>
                  <th className="text-center py-2 px-2 text-white font-medium w-16">Cab.</th>
                  {MONTH_LABELS.map((label, i) => (
                    <th key={i} className="text-center py-2 px-1 text-white font-medium w-14">{label}</th>
                  ))}
                  <th className="text-center py-2 px-2 text-white font-bold w-14">Total</th>
                </tr>
              </thead>
              <tbody>
                {clientsReel.map(client => {
                  const rowTotal = getRowTotal(silaeByClient, client.id, gridYear, 'bulletins');
                  const rowManuel = getRowTotal(silaeByClient, client.id, gridYear, 'bulletins_manuels');
                  const displayTotal = rowTotal > 0 ? rowTotal : (rowManuel > 0 ? rowManuel : 0);
                  return (
                    <tr key={client.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-1.5 px-3 text-white font-medium sticky left-0 bg-slate-800 z-10 truncate max-w-[220px]" title={client.nom}>
                        {client.nom}
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <span className="text-white text-xs bg-slate-700 px-1.5 py-0.5 rounded">
                          {client.cabinet === 'Audit Up' ? 'AUP' : 'ZF'}
                        </span>
                      </td>
                      {MONTHS.map((m, i) => {
                        const row = getSilaeRow(silaeByClient, client.id, gridYear, m);
                        const { value, isManuel, refaits } = getCellDisplay(row);
                        return (
                          <TooltipCell
                            key={i}
                            silaeRow={row}
                            value={row ? value : null}
                            tooltipContent={row ? renderTooltipReel(row) : null}
                            positiveColor="emerald"
                            isManuel={isManuel}
                            refaits={refaits}
                            onClick={() => handleCellClick(client, m)}
                          />
                        );
                      })}
                      <td className="py-1.5 px-2 text-center text-white font-bold border-l-2 border-slate-600">
                        {displayTotal > 0 ? displayTotal : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-600 bg-slate-700/30">
                  <td className="py-2 px-3 text-white font-bold sticky left-0 bg-slate-700/30 z-10">TOTAL</td>
                  <td></td>
                  {MONTHS.map((m, i) => {
                    const total = getColTotal(silaeByClient, reelIds, gridYear, m, 'bulletins');
                    return (
                      <td key={i} className="py-2 text-center text-white font-bold">
                        {total > 0 ? total : ''}
                      </td>
                    );
                  })}
                  <td className="py-2 px-2 text-center text-white font-bold border-l-2 border-slate-600">
                    {getGrandTotal(silaeByClient, reelIds, gridYear, 'bulletins') || ''}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Table 2 : Forfait avec coffre-fort / editique */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <h4 className="text-white font-semibold text-sm">
            Clients au forfait — Coffre-fort / Editique
          </h4>
          <span className="text-white text-xs bg-blue-900/50 px-2 py-0.5 rounded">
            {clientsForfait.length} clients
          </span>
        </div>

        {clientsForfait.length === 0 ? (
          <p className="text-white text-sm">Aucun client au forfait avec coffre-fort ou editique pour {gridYear}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-700/50">
                  <th className="text-left py-2 px-3 text-white font-medium sticky left-0 bg-slate-700/50 z-10 min-w-[180px]">Client</th>
                  <th className="text-center py-2 px-2 text-white font-medium w-16">Cab.</th>
                  {MONTH_LABELS.map((label, i) => (
                    <th key={i} className="text-center py-2 px-1 text-white font-medium w-14">{label}</th>
                  ))}
                  <th className="text-center py-2 px-2 text-white font-bold w-14">Total</th>
                </tr>
              </thead>
              <tbody>
                {clientsForfait.map(client => {
                  const rowTotal = getRowTotal(silaeByClient, client.id, gridYear, 'coffre_fort');
                  return (
                    <tr key={client.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-1.5 px-3 text-white font-medium sticky left-0 bg-slate-800 z-10 truncate max-w-[220px]" title={client.nom}>
                        {client.nom}
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <span className="text-white text-xs bg-slate-700 px-1.5 py-0.5 rounded">
                          {client.cabinet === 'Audit Up' ? 'AUP' : 'ZF'}
                        </span>
                      </td>
                      {MONTHS.map((m, i) => {
                        const row = getSilaeRow(silaeByClient, client.id, gridYear, m);
                        return (
                          <TooltipCell
                            key={i}
                            silaeRow={row}
                            value={row ? (row.coffre_fort || 0) : null}
                            tooltipContent={row ? renderTooltipForfait(row) : null}
                            positiveColor="amber"
                            isManuel={false}
                            refaits={0}
                            onClick={() => handleCellClick(client, m)}
                          />
                        );
                      })}
                      <td className="py-1.5 px-2 text-center text-white font-bold border-l-2 border-slate-600">
                        {rowTotal > 0 ? rowTotal : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-600 bg-slate-700/30">
                  <td className="py-2 px-3 text-white font-bold sticky left-0 bg-slate-700/30 z-10">TOTAL</td>
                  <td></td>
                  {MONTHS.map((m, i) => {
                    const total = getColTotal(silaeByClient, forfaitIds, gridYear, m, 'coffre_fort');
                    return (
                      <td key={i} className="py-2 text-center text-white font-bold">
                        {total > 0 ? total : ''}
                      </td>
                    );
                  })}
                  <td className="py-2 px-2 text-center text-white font-bold border-l-2 border-slate-600">
                    {getGrandTotal(silaeByClient, forfaitIds, gridYear, 'coffre_fort') || ''}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Popover edition */}
      <EditPopover
        editCell={editCell}
        editValues={editValues}
        setEditValues={setEditValues}
        onSave={handleSave}
        onCancel={handleCancelEdit}
        saving={saving}
      />
    </div>
  );
}
