// @ts-check
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Download, Upload, Check, Loader2, AlertCircle, Pencil, Lock, Unlock, ArrowUpDown, ArrowUp, ArrowDown, Activity } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import {
  AXE_DEFINITIONS, AXE_KEYS, classifierToutesLesLignes,
  calculerAugmentationGlobale, calculerTotauxResume, creerParametresDefaut,
  parseSilaeExcel, importSilaeData, getSilaeProductions, getSilaePeriodes,
  updateSilaeMapping, exportAugmentationExcel, genererDiagnostic
} from '../../utils/honoraires';
import SilaeMappingModal from './SilaeMappingModal';
import DiagnosticModal from './DiagnosticModal';

// Clé localStorage + version (incrémenter pour invalider les anciennes données)
const LS_KEY = 'augmentation_state';
const LS_VERSION = 2;

// Axes configurables (on exclut accessoires_social qui suit le bulletin)
const AXES_CONFIGURABLES = AXE_KEYS.filter(k => !AXE_DEFINITIONS[k].suiviBulletin);

// === Persistance localStorage ===

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);

    // Vérifier la version — invalider si ancienne
    if (data.version !== LS_VERSION) {
      localStorage.removeItem(LS_KEY);
      return null;
    }

    // Valider les lockedLines : chaque entrée doit avoir nouveau_montant_ht et nouveau_prix_unitaire_ht
    const validLocked = [];
    for (const [key, val] of (data.lockedLines || [])) {
      if (
        typeof key === 'string' && key.includes('|') &&
        val && typeof val.nouveau_montant_ht === 'number' &&
        typeof val.nouveau_prix_unitaire_ht === 'number'
      ) {
        validLocked.push([key, val]);
      }
    }

    // Valider les paramètres : doivent avoir la structure axes
    const parametres = data.parametres;
    if (parametres && (!parametres.axes || typeof parametres.axes !== 'object')) {
      return null;
    }

    return {
      parametres: parametres || null,
      lockedLines: new Map(validLocked),
    };
  } catch {
    localStorage.removeItem(LS_KEY);
    return null;
  }
}

function saveState(parametres, lockedLines) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      version: LS_VERSION,
      parametres,
      lockedLines: [...lockedLines.entries()],
    }));
  } catch {
    // Silently fail
  }
}

/**
 * Cellule de montant cliquable/éditable.
 */
function EditableAmount({ value, onChange, disabled, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  const fmtDec = (n) => (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const startEdit = () => {
    if (disabled) return;
    setDraft(value.toFixed(2).replace('.', ','));
    setEditing(true);
  };

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const parsed = parseFloat(draft.replace(',', '.').replace(/\s/g, ''));
    if (!isNaN(parsed) && parsed !== value) {
      onChange(parsed);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="w-24 px-1 py-0.5 bg-slate-600 border border-blue-400 rounded text-sm text-right text-white"
      />
    );
  }

  return (
    <button
      onClick={startEdit}
      disabled={disabled}
      className={`group inline-flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
        disabled ? 'cursor-default' : 'cursor-pointer hover:bg-slate-600/50'
      } ${className}`}
      title={disabled ? 'Ligne verrouillée' : 'Cliquer pour modifier'}
    >
      <span>{fmtDec(value)}</span>
      {!disabled && <Pencil size={12} className="opacity-0 group-hover:opacity-50 transition-opacity" />}
    </button>
  );
}

/**
 * Panneau principal de l'outil d'augmentation des honoraires.
 */
function AugmentationPanel({ honoraires, clients, accent, filterCabinet, filterStatus }) {
  // === Charger l'état persisté ===
  const savedState = useRef(loadState());

  // === Paramètres de simulation ===
  const [parametres, setParametres] = useState(() => {
    return savedState.current?.parametres || creerParametresDefaut();
  });

  const [clientsExclus, setClientsExclus] = useState(new Set());

  // === Overrides par ligne (nouveau_montant_ht forcé manuellement) ===
  // Map<"clientId|ligneId", number>
  const [lineOverrides, setLineOverrides] = useState(new Map());

  // === Lignes verrouillées (survivent aux changements de paramètres + navigation) ===
  // Map<"clientId|ligneId", { nouveau_montant_ht, nouveau_prix_unitaire_ht, delta_ht, delta_pourcentage }>
  const [lockedLines, setLockedLines] = useState(() => {
    return savedState.current?.lockedLines || new Map();
  });

  // === Silae ===
  const [silaeData, setSilaeData] = useState(null);
  const [silaePeriode, setSilaePeriode] = useState('');
  const [silaePeriodesDisponibles, setSilaePeriodesDisponibles] = useState([]);
  const [importingSilae, setImportingSilae] = useState(false);
  const [silaeResult, setSilaeResult] = useState(null);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [unmatchedSilae, setUnmatchedSilae] = useState([]);
  const [matchedSilae, setMatchedSilae] = useState([]);
  const [pendingSilaeRows, setPendingSilaeRows] = useState([]);
  const [pendingSilaePeriode, setPendingSilaePeriode] = useState('');

  // === Diagnostic ===
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState(null);

  // === UI ===
  const [searchTerm, setSearchTerm] = useState('');
  // Tri : { key: 'client_nom'|'axe'|'ancien_prix_unitaire_ht'|'nouveau_prix_unitaire_ht'|'delta_ht'|'delta_pourcentage', dir: 'asc'|'desc' }
  const [sortConfig, setSortConfig] = useState({ key: 'client_nom', dir: 'asc' });

  // === Persister en localStorage à chaque changement ===
  useEffect(() => {
    saveState(parametres, lockedLines);
  }, [parametres, lockedLines]);

  // === Charger données Silae depuis BDD ===
  useEffect(() => {
    loadSilaeData();
  }, []);

  const loadSilaeData = async () => {
    try {
      const periodes = await getSilaePeriodes(supabase);
      setSilaePeriodesDisponibles(periodes);
      if (periodes.length > 0) {
        const dernierePeriode = periodes[0];
        setSilaePeriode(dernierePeriode);
        const productions = await getSilaeProductions(supabase, dernierePeriode);
        const map = new Map();
        for (const p of productions) map.set(p.client_id, p);
        setSilaeData(map);
      }
    } catch (err) {
      console.error('Erreur chargement Silae:', err);
    }
  };

  // === Classification des lignes ===
  const clientsEnrichis = clients || [];

  const { lignesClassifiees, modesDetectes } = useMemo(() => {
    if (!honoraires || !clientsEnrichis) {
      return { lignesClassifiees: [], modesDetectes: new Map() };
    }
    // Sécurité : toujours exclure les stopped/finished même s'ils remontent de la BDD.
    // Les stopped sont d'anciens abos remplacés — les compter gonfle le CA artificiellement.
    let filteredHonoraires = honoraires.filter(h => h.status !== 'stopped' && h.status !== 'finished');
    if (filterStatus !== 'tous') {
      filteredHonoraires = filteredHonoraires.filter(h => h.status === filterStatus);
    }
    const { lignes, modesDetectes } = classifierToutesLesLignes(filteredHonoraires, clientsEnrichis);
    return { lignesClassifiees: lignes, modesDetectes };
  }, [honoraires, clientsEnrichis, filterStatus]);

  // Persister les modes détectés en BDD
  useEffect(() => {
    if (modesDetectes.size > 0) {
      const updateModes = async () => {
        for (const [clientId, mode] of modesDetectes) {
          await supabase.from('clients').update({ mode_facturation_social: mode }).eq('id', clientId);
        }
      };
      updateModes();
    }
  }, [modesDetectes]);

  // === Calcul des résultats ===
  const resultats = useMemo(() => {
    let lignes = lignesClassifiees;
    if (filterCabinet !== 'tous') {
      lignes = lignes.filter(l => l.client_cabinet === filterCabinet);
    }
    return calculerAugmentationGlobale(lignes, parametres, clientsExclus, silaeData);
  }, [lignesClassifiees, parametres, clientsExclus, filterCabinet, silaeData]);

  // Appliquer les overrides manuels ET les lignes verrouillées
  const resultatsFinaux = useMemo(() => {
    return resultats.map(client => {
      let hasChange = false;
      const lignesModifiees = client.lignes.map(ligne => {
        const key = `${client.client_id}|${ligne.ligne_id}`;

        // 1. Ligne verrouillée = valeur figée, pas touchée par les paramètres
        const locked = lockedLines.get(key);
        if (locked) {
          hasChange = true;
          const nouveauMontant = locked.nouveau_montant_ht;
          const nouveauPU = locked.nouveau_prix_unitaire_ht;
          const delta = Math.round((nouveauMontant - ligne.ancien_montant_ht) * 100) / 100;
          const deltaPct = ligne.ancien_montant_ht > 0
            ? Math.round(((nouveauMontant - ligne.ancien_montant_ht) / ligne.ancien_montant_ht) * 10000) / 100
            : 0;
          return {
            ...ligne,
            nouveau_montant_ht: nouveauMontant,
            nouveau_prix_unitaire_ht: nouveauPU,
            delta_ht: delta,
            delta_pourcentage: deltaPct,
            _locked: true
          };
        }

        // 2. Override manuel (pas encore verrouillé)
        const override = lineOverrides.get(key);
        if (override !== undefined) {
          hasChange = true;
          const nouveauMontant = override;
          const nouveauPU = ligne.quantite > 0 ? nouveauMontant / ligne.quantite : nouveauMontant;
          const delta = Math.round((nouveauMontant - ligne.ancien_montant_ht) * 100) / 100;
          const deltaPct = ligne.ancien_montant_ht > 0
            ? Math.round(((nouveauMontant - ligne.ancien_montant_ht) / ligne.ancien_montant_ht) * 10000) / 100
            : 0;
          return {
            ...ligne,
            nouveau_montant_ht: nouveauMontant,
            nouveau_prix_unitaire_ht: Math.round(nouveauPU * 100) / 100,
            delta_ht: delta,
            delta_pourcentage: deltaPct,
            _overridden: true
          };
        }

        return ligne;
      });

      if (!hasChange) return client;

      // Recalculer les totaux du client (annualisés, cohérent Silae)
      let ancienTotal = 0, nouveauTotal = 0, nbMod = 0;
      for (const l of lignesModifiees) {
        const coeff = l.coeff_annualisation || 12;
        // Même logique que le moteur : si Silae dispo, utiliser montants Silae
        const ancienPourTotal = l.montant_silae !== null && l.montant_silae !== undefined
          ? Math.round(l.ancien_prix_unitaire_ht * l.quantite_silae * 100) / 100
          : l.ancien_montant_ht;
        const nouveauPourTotal = l.montant_silae !== null && l.montant_silae !== undefined
          ? l.montant_silae
          : l.nouveau_montant_ht;
        ancienTotal += ancienPourTotal * coeff;
        nouveauTotal += nouveauPourTotal * coeff;
        const deltaPourTotal = l.delta_silae !== null && l.delta_silae !== undefined
          ? l.delta_silae
          : l.delta_ht;
        if (deltaPourTotal !== 0) nbMod++;
      }
      const deltaTotal = Math.round((nouveauTotal - ancienTotal) * 100) / 100;
      const deltaPct = ancienTotal > 0
        ? Math.round(((nouveauTotal - ancienTotal) / ancienTotal) * 10000) / 100
        : 0;

      return {
        ...client,
        lignes: lignesModifiees,
        ancien_total_ht: Math.round(ancienTotal * 100) / 100,
        nouveau_total_ht: Math.round(nouveauTotal * 100) / 100,
        delta_total_ht: deltaTotal,
        delta_total_pourcentage: deltaPct,
        nb_lignes_modifiees: nbMod
      };
    });
  }, [resultats, lineOverrides, lockedLines]);

  const totaux = useMemo(() => calculerTotauxResume(resultatsFinaux), [resultatsFinaux]);

  // === Lignes modifiées aplaties ===
  // Afficher si delta != 0 (le moteur de calcul ne produit un delta que si l'axe est actif)
  // OU si la ligne est verrouillée (valeurs figées indépendamment des paramètres)
  const lignesModifiees = useMemo(() => {
    const result = [];
    for (const client of resultatsFinaux) {
      if (client.exclu) continue;
      for (const ligne of client.lignes) {
        const key = `${client.client_id}|${ligne.ligne_id}`;
        const isLocked = lockedLines.has(key);

        if (ligne.delta_ht !== 0 || ligne.delta_silae || isLocked || ligne._overridden) {
          result.push({
            ...ligne,
            client_nom: client.client_nom,
            client_cabinet: client.client_cabinet,
            client_id: client.client_id,
            mode_facturation_social: client.mode_facturation_social
          });
        }
      }
    }
    return result;
  }, [resultatsFinaux, lockedLines]);

  // Filtrer par recherche + tri
  const lignesAffichees = useMemo(() => {
    let result = lignesModifiees;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      result = result.filter(l => l.client_nom.toLowerCase().includes(s));
    }
    // Tri
    const { key, dir } = sortConfig;
    const mult = dir === 'asc' ? 1 : -1;
    result = [...result].sort((a, b) => {
      const va = a[key];
      const vb = b[key];
      if (typeof va === 'string') return mult * va.localeCompare(vb, 'fr');
      return mult * ((va || 0) - (vb || 0));
    });
    return result;
  }, [lignesModifiees, searchTerm, sortConfig]);

  // === Handlers paramètres ===
  const setAxeParam = (axeKey, field, value) => {
    setParametres(prev => ({
      ...prev,
      axes: {
        ...prev.axes,
        [axeKey]: { ...prev.axes[axeKey], [field]: value }
      }
    }));
    // Reset les overrides manuels (pas les verrouillées !)
    setLineOverrides(new Map());
  };

  const toggleAxe = (axeKey) => {
    setParametres(prev => {
      const wasActive = prev.axes[axeKey]?.actif;
      const axe = { ...prev.axes[axeKey], actif: !wasActive };
      if (wasActive) {
        axe.valeur = 0;
      }
      return {
        ...prev,
        axes: { ...prev.axes, [axeKey]: axe }
      };
    });
    // Reset les overrides manuels (pas les verrouillées !)
    setLineOverrides(new Map());
  };

  const toggleExclure = (clientId) => {
    setClientsExclus(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  // Handler pour modifier un montant de ligne manuellement
  const handleLineOverride = useCallback((clientId, ligneId, nouveauMontant) => {
    setLineOverrides(prev => {
      const next = new Map(prev);
      next.set(`${clientId}|${ligneId}`, nouveauMontant);
      return next;
    });
  }, []);

  // Verrouiller une ligne (figer les valeurs actuelles)
  const lockLine = useCallback((clientId, ligneId, ligne) => {
    const key = `${clientId}|${ligneId}`;
    setLockedLines(prev => {
      const next = new Map(prev);
      next.set(key, {
        nouveau_montant_ht: ligne.nouveau_montant_ht,
        nouveau_prix_unitaire_ht: ligne.nouveau_prix_unitaire_ht
      });
      return next;
    });
    // Retirer de l'override manuel (maintenant c'est verrouillé)
    setLineOverrides(prev => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  // Déverrouiller une ligne
  const unlockLine = useCallback((clientId, ligneId) => {
    const key = `${clientId}|${ligneId}`;
    setLockedLines(prev => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  // Verrouiller TOUTES les lignes affichées d'un coup
  const lockAllVisible = useCallback(() => {
    setLockedLines(prev => {
      const next = new Map(prev);
      for (const ligne of lignesModifiees) {
        const key = `${ligne.client_id}|${ligne.ligne_id}`;
        if (!next.has(key)) {
          next.set(key, {
            nouveau_montant_ht: ligne.nouveau_montant_ht,
            nouveau_prix_unitaire_ht: ligne.nouveau_prix_unitaire_ht
          });
        }
      }
      return next;
    });
    setLineOverrides(new Map());
  }, [lignesModifiees]);

  // Déverrouiller TOUTES les lignes affichées d'un coup
  const unlockAllVisible = useCallback(() => {
    setLockedLines(prev => {
      const next = new Map(prev);
      for (const ligne of lignesModifiees) {
        next.delete(`${ligne.client_id}|${ligne.ligne_id}`);
      }
      return next;
    });
  }, [lignesModifiees]);

  // Handler de tri par colonne
  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  // === Import Silae ===
  const handleSilaeFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingSilae(true);
    setSilaeResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const rows = parseSilaeExcel(buffer);
      const periode = extractPeriodeFromFilename(file.name);
      const result = await importSilaeData(supabase, rows, periode, clients);
      setMatchedSilae(result.matched);
      if (result.unmatched.length > 0) {
        setUnmatchedSilae(result.unmatched);
        setPendingSilaeRows(rows);
        setPendingSilaePeriode(periode);
        setShowMappingModal(true);
      }
      setSilaeResult({ ...result, periode, filename: file.name });
      await loadSilaeData();
    } catch (err) {
      console.error('Erreur import Silae:', err);
      setSilaeResult({ errors: [err.message] });
    }
    setImportingSilae(false);
    e.target.value = '';
  };

  const handleMappingSave = async (mappingsMap) => {
    setShowMappingModal(false);
    try {
      for (const [codeSilae, clientIds] of mappingsMap) {
        const silaeRow = unmatchedSilae.find(r => r.code === codeSilae);
        await updateSilaeMapping(supabase, codeSilae, clientIds, silaeRow?.nom, silaeRow?.siren);
      }
      if (pendingSilaeRows.length > 0 && pendingSilaePeriode) {
        await importSilaeData(supabase, pendingSilaeRows, pendingSilaePeriode, clients);
        await loadSilaeData();
      }
    } catch (err) {
      console.error('Erreur save mapping:', err);
    }
    setUnmatchedSilae([]);
    setMatchedSilae([]);
    setPendingSilaeRows([]);
    setPendingSilaePeriode('');
  };

  // === Export ===
  const handleExport = () => {
    exportAugmentationExcel({
      resultats: resultatsFinaux,
      parametres,
      totaux,
      filterCabinet,
      honoraires,
      clients: clientsEnrichis
    });
  };

  // === Formatage ===
  const fmt = (n) => (n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  const fmtDec = (n) => (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtFrequence = (frequence, intervalle = 1) => {
    if (frequence === 'yearly') return intervalle > 1 ? `${intervalle}ans` : 'An';
    // monthly
    const inter = intervalle || 1;
    if (inter === 1) return 'Mens.';
    if (inter === 3) return 'Trim.';
    if (inter === 6) return 'Sem.';
    if (inter === 12) return 'An';
    return `${inter}m`;
  };

  const nbAxesActifs = AXES_CONFIGURABLES.filter(k => parametres.axes[k]?.actif).length;
  const nbLocked = lockedLines.size;

  const axeColors = {
    compta_mensuelle: 'bg-blue-900/60 text-blue-300',
    bilan: 'bg-indigo-900/60 text-indigo-300',
    pl: 'bg-violet-900/60 text-violet-300',
    social_forfait: 'bg-green-900/60 text-green-300',
    social_bulletin: 'bg-emerald-900/60 text-emerald-300',
    accessoires_social: 'bg-teal-900/60 text-teal-300',
    juridique: 'bg-purple-900/60 text-purple-300',
    support: 'bg-amber-900/60 text-amber-300'
  };

  return (
    <div className="text-white">

      {/* === Paramètres par catégorie === */}
      <div className="mb-6 bg-slate-800/60 backdrop-blur-sm rounded-lg border border-slate-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Paramètres d'augmentation par catégorie</h3>
          <div className="flex items-center gap-3">
            {nbLocked > 0 && (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <Lock size={12} /> {nbLocked} ligne{nbLocked > 1 ? 's' : ''} verrouillée{nbLocked > 1 ? 's' : ''}
              </span>
            )}
            <span className="text-xs text-white">{nbAxesActifs} / {AXES_CONFIGURABLES.length} actif{nbAxesActifs > 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="space-y-2">
          {AXES_CONFIGURABLES.map(key => {
            const def = AXE_DEFINITIONS[key];
            const param = parametres.axes[key];
            const axeTotaux = totaux.parAxe[key];

            return (
              <div
                key={key}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all ${
                  param.actif
                    ? 'bg-slate-700/40 border-slate-600'
                    : 'bg-slate-800/20 border-slate-700/50 opacity-80'
                }`}
              >
                <label className="flex items-center gap-2 cursor-pointer min-w-[180px]">
                  <input
                    type="checkbox"
                    checked={param.actif}
                    onChange={() => toggleAxe(key)}
                    className="rounded"
                  />
                  <span className={`text-sm ${param.actif ? 'text-white font-semibold' : 'text-white font-medium'}`}>
                    {def.label}
                  </span>
                </label>

                {param.actif && def.modes.length > 1 && (
                  <select
                    value={param.mode}
                    onChange={(e) => setAxeParam(key, 'mode', e.target.value)}
                    className="text-xs bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white"
                  >
                    <option value="pourcentage">%</option>
                    <option value="montant">EUR</option>
                  </select>
                )}

                {param.actif && def.modes.length === 1 && (
                  <span className="text-xs text-white w-14 text-center">
                    {def.modes[0] === 'montant' ? 'EUR' : '%'}
                  </span>
                )}

                {param.actif && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step={param.mode === 'pourcentage' ? '0.5' : '0.01'}
                      value={param.valeur || ''}
                      onChange={(e) => setAxeParam(key, 'valeur', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-center text-white"
                    />
                    <span className="text-xs text-white w-12">
                      {param.mode === 'pourcentage' ? '%' : key === 'social_bulletin' ? '€/bull.' : '€'}
                    </span>
                  </div>
                )}

                <div className="ml-auto text-right">
                  <span className="text-xs text-white">{fmt(axeTotaux?.ancien || 0)} €/an</span>
                  {param.actif && axeTotaux?.delta > 0 && (
                    <span className="text-xs text-emerald-400 ml-2">+{fmt(axeTotaux.delta)} €/an</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-white mt-2 italic">
          Les accessoires social (coffre-fort, publi-postage, entrées/sorties) suivent automatiquement le prix au bulletin.
        </p>
      </div>

      {/* === Silae & Export === */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-500 cursor-pointer flex items-center gap-2 text-sm">
          {importingSilae ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          Importer Silae
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleSilaeFileSelect}
            className="hidden"
            disabled={importingSilae}
          />
        </label>

        {silaePeriodesDisponibles.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-white">Silae :</span>
            <select
              value={silaePeriode}
              onChange={async (e) => {
                const p = e.target.value;
                setSilaePeriode(p);
                const productions = await getSilaeProductions(supabase, p);
                const map = new Map();
                for (const prod of productions) map.set(prod.client_id, prod);
                setSilaeData(map);
              }}
              className="text-xs bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white"
            >
              {silaePeriodesDisponibles.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        )}

        {silaeResult && (
          <span className="text-xs text-white">
            {silaeResult.inserted !== undefined && (
              <>
                <Check size={12} className="inline text-emerald-400" /> {silaeResult.inserted} importés
                {silaeResult.unmatched?.length > 0 && (
                  <span className="text-orange-400 ml-1">{silaeResult.unmatched.length} non mappés</span>
                )}
              </>
            )}
            {silaeResult.errors?.length > 0 && !silaeResult.inserted && (
              <span className="text-red-400">
                <AlertCircle size={12} className="inline" /> {silaeResult.errors[0]}
              </span>
            )}
          </span>
        )}

        <button
          onClick={() => {
            const report = genererDiagnostic(honoraires, clientsEnrichis);
            setDiagnosticReport(report);
            setShowDiagnostic(true);
          }}
          disabled={!honoraires || honoraires.length === 0}
          className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
        >
          <Activity size={14} />
          Diagnostic
        </button>

        <div className="ml-auto flex items-center gap-3">
          {totaux.global.delta > 0 && (
            <div className="text-right">
              <span className="text-[10px] text-white block text-right">Impact annuel HT {silaeData?.size > 0 ? '(prod. Silae)' : ''}</span>
              <span className="text-xs text-white" title={silaeData?.size > 0 ? 'Estimé production réelle (quantités Silae pour le social)' : 'Basé sur les montants Pennylane'}>{fmt(totaux.global.ancien)} →</span>
              <span className="text-sm font-bold text-blue-400 ml-1">{fmt(totaux.global.nouveau)} €</span>
              <span className="text-xs text-emerald-400 ml-2">+{fmt(totaux.global.delta)} €/an (+{fmtDec(totaux.global.deltaPct)}%)</span>
            </div>
          )}
          <button
            onClick={handleExport}
            disabled={lignesModifiees.length === 0}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
          >
            <Download size={14} />
            Export Excel
          </button>
        </div>
      </div>

      {/* === Recherche + actions en masse === */}
      {lignesModifiees.length > 0 && (
        <div className="mb-3 flex items-center gap-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher un client..."
            className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg w-56 text-sm text-white placeholder-slate-400"
          />
          <span className="text-xs text-white">
            {lignesAffichees.length} ligne{lignesAffichees.length > 1 ? 's' : ''} modifiée{lignesAffichees.length > 1 ? 's' : ''}
            {' '}— {totaux.global.nbClients} client{totaux.global.nbClients > 1 ? 's' : ''}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={lockAllVisible}
              className="px-2.5 py-1 bg-amber-700/60 hover:bg-amber-600/60 text-amber-200 rounded text-xs flex items-center gap-1.5 transition-colors"
              title="Verrouiller toutes les lignes affichées"
            >
              <Lock size={12} /> Tout verrouiller
            </button>
            {nbLocked > 0 && (
              <button
                onClick={unlockAllVisible}
                className="px-2.5 py-1 bg-slate-700/60 hover:bg-slate-600/60 text-white rounded text-xs flex items-center gap-1.5 transition-colors"
                title="Déverrouiller toutes les lignes affichées"
              >
                <Unlock size={12} /> Tout déverrouiller
              </button>
            )}
          </div>
        </div>
      )}

      {/* === Table des lignes modifiées === */}
      {lignesModifiees.length === 0 ? (
        <div className="text-center py-12 text-white">
          <p className="text-lg mb-1">Aucune augmentation configurée</p>
          <p className="text-sm">Cochez une catégorie ci-dessus et indiquez un % ou un montant pour voir les résultats.</p>
        </div>
      ) : (
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-lg border border-slate-700 overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-slate-700/50 border-b border-slate-600">
              <tr>
                {[
                  { key: 'client_nom', label: 'Client', align: 'left' },
                  { key: 'axe', label: 'Axe', align: 'left' },
                  { key: 'label', label: 'Produit', align: 'left' },
                  { key: 'quantite', label: 'Qté', align: 'center' },
                  { key: 'coeff_annualisation', label: 'Fréq.', align: 'center' },
                  { key: 'ancien_prix_unitaire_ht', label: 'PU avant', align: 'right' },
                  { key: 'nouveau_prix_unitaire_ht', label: 'PU après', align: 'right' },
                  { key: 'ancien_montant_ht', label: 'Mt avant', align: 'right' },
                  { key: 'nouveau_montant_ht', label: 'Mt après', align: 'right' },
                  { key: 'delta_ht', label: 'Delta', align: 'right' },
                  { key: 'delta_pourcentage', label: '%', align: 'right' },
                ].map(col => {
                  const isActive = sortConfig.key === col.key;
                  const SortIcon = isActive ? (sortConfig.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                  return (
                    <th
                      key={col.key}
                      className={`px-3 py-2 text-${col.align} text-xs font-medium text-white cursor-pointer hover:text-white select-none`}
                      onClick={() => handleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        <SortIcon size={10} className={isActive ? 'text-blue-400' : 'text-white opacity-50'} />
                      </span>
                    </th>
                  );
                })}
                <th className="px-3 py-2 text-center text-xs font-medium text-white" title="Verrouiller pour conserver même après changement de paramètres">
                  <Lock size={12} className="inline" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {lignesAffichees.map((ligne) => {
                const lineKey = `${ligne.client_id}|${ligne.ligne_id}`;
                const isLocked = lockedLines.has(lineKey);

                return (
                  <tr
                    key={lineKey}
                    className={`hover:bg-slate-700/30 ${
                      isLocked ? 'bg-amber-900/10' : ligne._overridden ? 'bg-blue-900/10' : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-sm font-medium text-white whitespace-nowrap">
                      {ligne.client_nom}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${axeColors[ligne.axe] || 'bg-slate-700 text-white'}`}>
                        {AXE_DEFINITIONS[ligne.axe]?.label || ligne.axe}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-white max-w-[250px]" title={ligne.description ? `${ligne.label} — ${ligne.description}` : ligne.label}>
                      <div className="truncate">{ligne.label}</div>
                      {ligne.description && (
                        <div className="text-[10px] text-white truncate">{ligne.description}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-center text-white">
                      {ligne.quantite}
                      {ligne.quantite_silae !== null && ligne.quantite_silae !== ligne.quantite && (
                        <div className="text-[10px] text-orange-400" title="Quantité Silae (production réelle)">
                          Silae: {ligne.quantite_silae}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="text-[10px] text-white" title={`×${ligne.coeff_annualisation}/an`}>
                        {fmtFrequence(ligne.frequence, ligne.intervalle)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-right text-white">{fmtDec(ligne.ancien_prix_unitaire_ht)} €</td>
                    <td className="px-3 py-2 text-sm text-right">
                      {ligne.axe === 'accessoires_social' ? (
                        // Accessoires : non modifiables, suivent le bulletin
                        <span className="text-blue-400/60 text-xs italic" title="Suit le prix au bulletin">
                          {fmtDec(ligne.nouveau_prix_unitaire_ht)} €
                        </span>
                      ) : (
                        <>
                          <EditableAmount
                            value={ligne.nouveau_prix_unitaire_ht}
                            disabled={isLocked}
                            className="text-blue-400"
                            onChange={(newPU) => {
                              const newMontant = Math.round(newPU * ligne.quantite * 100) / 100;
                              handleLineOverride(ligne.client_id, ligne.ligne_id, newMontant);
                            }}
                          />
                          <span className="text-blue-400 text-xs"> €</span>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-right text-white">{fmtDec(ligne.ancien_montant_ht)} €</td>
                    <td className="px-3 py-2 text-sm text-right">
                      {ligne.axe === 'accessoires_social' ? (
                        <span className="text-blue-400/60 text-xs italic">
                          {fmtDec(ligne.nouveau_montant_ht)} €
                        </span>
                      ) : (
                        <>
                          <EditableAmount
                            value={ligne.nouveau_montant_ht}
                            disabled={isLocked}
                            className="text-blue-400 font-medium"
                            onChange={(newMontant) => {
                              handleLineOverride(ligne.client_id, ligne.ligne_id, newMontant);
                            }}
                          />
                          <span className="text-blue-400 text-xs"> €</span>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-right">
                      <span className="text-emerald-400">+{fmtDec(ligne.delta_ht)} €</span>
                      {ligne.delta_silae !== null && (
                        <div className="text-[10px] text-orange-400" title="Impact réel Silae (basé sur la production)">
                          Silae: +{fmtDec(ligne.delta_silae)} €
                        </div>
                      )}
                      {ligne.coeff_annualisation > 1 && ligne.delta_ht !== 0 && (
                        <div className="text-[10px] text-white" title="Delta annualisé">
                          ×{ligne.coeff_annualisation} = {fmtDec(ligne.delta_ht * ligne.coeff_annualisation)} €/an
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-right text-white">
                      +{fmtDec(ligne.delta_pourcentage)}%
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => {
                          if (isLocked) {
                            unlockLine(ligne.client_id, ligne.ligne_id);
                          } else {
                            lockLine(ligne.client_id, ligne.ligne_id, ligne);
                          }
                        }}
                        className={`p-1 rounded transition-colors ${
                          isLocked
                            ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-900/30'
                            : 'text-white hover:text-white hover:bg-slate-600/50'
                        }`}
                        title={isLocked ? 'Déverrouiller cette ligne' : 'Verrouiller cette augmentation'}
                      >
                        {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* === Modal mapping Silae === */}
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

      {/* === Modal diagnostic === */}
      {showDiagnostic && diagnosticReport && (
        <DiagnosticModal
          report={diagnosticReport}
          onClose={() => setShowDiagnostic(false)}
        />
      )}
    </div>
  );
}

/**
 * Extrait la période (YYYY-MM) du nom de fichier Silae.
 */
function extractPeriodeFromFilename(filename) {
  const moisMap = {
    'janvier': '01', 'fevrier': '02', 'mars': '03', 'avril': '04',
    'mai': '05', 'juin': '06', 'juillet': '07', 'aout': '08',
    'septembre': '09', 'octobre': '10', 'novembre': '11', 'decembre': '12'
  };

  const lower = filename.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  for (const [mois, num] of Object.entries(moisMap)) {
    if (lower.includes(mois)) {
      const match = lower.match(/(\d{2,4})/);
      if (match) {
        let year = parseInt(match[1]);
        if (year < 100) year += 2000;
        return `${year}-${num}`;
      }
    }
  }

  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default AugmentationPanel;
