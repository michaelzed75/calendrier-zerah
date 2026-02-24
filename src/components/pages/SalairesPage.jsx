// @ts-check
import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Plus, Edit2, Trash2, Download, TrendingUp, Award,
  Calculator, ChevronDown, ChevronUp, Search, AlertCircle,
  Save, X, Eye, EyeOff, DollarSign, Clock, FileText, Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../supabaseClient';
import {
  getSalairesActuels,
  getHistoriqueSalaires,
  createSalaire,
  updateSalaire,
  deleteSalaire,
  getPrimes,
  createPrime,
  updatePrime,
  deletePrime,
  TYPES_PRIMES,
  getSimulations,
  getSimulation,
  createSimulation,
  updateSimulation,
  deleteSimulation,
  appliquerSimulation,
  upsertLigneSimulation,
  calculerCoutTotal,
  calculerTauxHoraireBrut,
  calculerTauxHoraireCharge,
  calculerAugmentation,
  calculerMasseSalariale,
  formatMontant,
  formatTauxHoraire,
  calculerEvolution,
  estimerChargesPatronales,
  HEURES_ANNUELLES_LEGALES
} from '../../utils/salaires';

/**
 * @typedef {import('../../types.js').Collaborateur} Collaborateur
 * @typedef {import('../../types.js').AccentColor} AccentColor
 */

/**
 * @typedef {Object} SalairesPageProps
 * @property {Collaborateur[]} collaborateurs - Liste des collaborateurs
 * @property {AccentColor} accent - Couleur d'accent
 * @property {Collaborateur} userCollaborateur - Collaborateur connecté
 */

/**
 * Page de gestion des salaires - ADMIN UNIQUEMENT
 * Protégée par RLS Supabase + vérification frontend
 * @param {SalairesPageProps} props
 * @returns {JSX.Element}
 */
function SalairesPage({ collaborateurs, accent, userCollaborateur }) {
  // ===========================================
  // VERIFICATION ACCES ADMIN
  // ===========================================
  if (!userCollaborateur?.is_admin) {
    return (
      <div className="p-8">
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-400 mb-2">Accès refusé</h2>
          <p className="text-white">
            Cette page est strictement réservée aux administrateurs.
          </p>
        </div>
      </div>
    );
  }

  // ===========================================
  // ÉTATS
  // ===========================================
  const [activeTab, setActiveTab] = useState('salaires'); // 'salaires' | 'primes' | 'simulations'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Données
  const [salaires, setSalaires] = useState([]);
  const [primes, setPrimes] = useState([]);
  const [simulations, setSimulations] = useState([]);

  // Filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAnnee, setFilterAnnee] = useState(new Date().getFullYear());
  const [showInactifs, setShowInactifs] = useState(false);

  // Modals
  const [showSalaireModal, setShowSalaireModal] = useState(false);
  const [showPrimeModal, setShowPrimeModal] = useState(false);
  const [showSimulationModal, setShowSimulationModal] = useState(false);
  const [showHistoriqueModal, setShowHistoriqueModal] = useState(false);

  // Édition
  const [editingSalaire, setEditingSalaire] = useState(null);
  const [editingPrime, setEditingPrime] = useState(null);
  const [editingSimulation, setEditingSimulation] = useState(null);
  const [selectedCollaborateur, setSelectedCollaborateur] = useState(null);
  const [historiqueData, setHistoriqueData] = useState([]);

  // ===========================================
  // CHARGEMENT DONNÉES
  // ===========================================
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [salairesData, primesData, simulationsData] = await Promise.all([
        getSalairesActuels(supabase),
        getPrimes(supabase),
        getSimulations(supabase)
      ]);

      setSalaires(salairesData);
      setPrimes(primesData);
      setSimulations(simulationsData);
    } catch (err) {
      console.error('Erreur chargement données salaires:', err);
      setError(err.message);
    }

    setLoading(false);
  };

  // ===========================================
  // DONNÉES FILTRÉES
  // ===========================================
  const collaborateursActifs = useMemo(() => {
    return collaborateurs.filter(c => showInactifs || c.actif);
  }, [collaborateurs, showInactifs]);

  const salairesFiltres = useMemo(() => {
    return salaires.filter(s => {
      const matchSearch = !searchTerm ||
        s.collaborateur?.nom?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchActif = showInactifs || s.collaborateur?.actif;
      return matchSearch && matchActif;
    });
  }, [salaires, searchTerm, showInactifs]);

  const primesFiltrees = useMemo(() => {
    return primes.filter(p => {
      const matchSearch = !searchTerm ||
        p.collaborateur?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.libelle?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchAnnee = !filterAnnee || p.annee === filterAnnee;
      return matchSearch && matchAnnee;
    });
  }, [primes, searchTerm, filterAnnee]);

  // ===========================================
  // CALCULS MASSE SALARIALE
  // ===========================================
  const masseSalariale = useMemo(() => {
    const salairesActifs = salairesFiltres.filter(s => s.collaborateur?.actif);
    return calculerMasseSalariale(salairesActifs.map(s => ({
      salaire_brut_annuel: s.salaire_brut_annuel,
      charges_patronales_annuel: s.charges_patronales_annuel
    })));
  }, [salairesFiltres]);

  const totalPrimesAnnee = useMemo(() => {
    return primesFiltrees.reduce((sum, p) => sum + (p.montant_brut || 0), 0);
  }, [primesFiltrees]);

  // ===========================================
  // HANDLERS SALAIRES
  // ===========================================
  const handleSaveSalaire = async (salaireData) => {
    try {
      if (editingSalaire?.id) {
        await updateSalaire(supabase, editingSalaire.id, salaireData);
      } else {
        await createSalaire(supabase, {
          ...salaireData,
          created_by: userCollaborateur.id
        });
      }
      await loadData();
      setShowSalaireModal(false);
      setEditingSalaire(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteSalaire = async (id) => {
    if (!confirm('Supprimer ce salaire ?')) return;
    try {
      await deleteSalaire(supabase, id);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleShowHistorique = async (collaborateurId, collaborateurNom) => {
    try {
      const historique = await getHistoriqueSalaires(supabase, collaborateurId);
      setHistoriqueData(historique);
      setSelectedCollaborateur({ id: collaborateurId, nom: collaborateurNom });
      setShowHistoriqueModal(true);
    } catch (err) {
      setError(err.message);
    }
  };

  // ===========================================
  // HANDLERS PRIMES
  // ===========================================
  const handleSavePrime = async (primeData) => {
    try {
      if (editingPrime?.id) {
        await updatePrime(supabase, editingPrime.id, primeData);
      } else {
        await createPrime(supabase, {
          ...primeData,
          created_by: userCollaborateur.id
        });
      }
      await loadData();
      setShowPrimeModal(false);
      setEditingPrime(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeletePrime = async (id) => {
    if (!confirm('Supprimer cette prime ?')) return;
    try {
      await deletePrime(supabase, id);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  // ===========================================
  // EXPORT EXCEL
  // ===========================================
  const handleExport = () => {
    const data = salairesFiltres.map(s => ({
      'Collaborateur': s.collaborateur?.nom || '',
      'Actif': s.collaborateur?.actif ? 'Oui' : 'Non',
      'Date effet': s.date_effet,
      'Salaire brut annuel': s.salaire_brut_annuel,
      'Charges patronales': s.charges_patronales_annuel,
      'Coût total annuel': calculerCoutTotal(s.salaire_brut_annuel, s.charges_patronales_annuel),
      'Salaire brut mensuel': s.salaire_brut_annuel / 12,
      'Heures annuelles': s.heures_annuelles || HEURES_ANNUELLES_LEGALES,
      'Taux horaire brut': calculerTauxHoraireBrut(s.salaire_brut_annuel, s.heures_annuelles),
      'Taux horaire chargé': calculerTauxHoraireCharge(s.salaire_brut_annuel, s.charges_patronales_annuel, s.heures_annuelles),
      'Motif': s.motif_modification || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Salaires');

    // Ajouter feuille primes si onglet actif
    if (activeTab === 'primes') {
      const dataPrimes = primesFiltrees.map(p => ({
        'Collaborateur': p.collaborateur?.nom || '',
        'Année': p.annee,
        'Mois': p.mois || 'Annuel',
        'Type': TYPES_PRIMES.find(t => t.value === p.type_prime)?.label || p.type_prime,
        'Libellé': p.libelle,
        'Montant brut': p.montant_brut,
        'Charges': p.charges_patronales,
        'Date versement': p.date_versement || ''
      }));
      const wsPrimes = XLSX.utils.json_to_sheet(dataPrimes);
      XLSX.utils.book_append_sheet(wb, wsPrimes, 'Primes');
    }

    XLSX.writeFile(wb, `salaires_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ===========================================
  // RENDU
  // ===========================================
  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="text-green-400" />
            Gestion des Salaires
          </h1>
          <p className="text-white text-sm mt-1">
            Accès administrateur uniquement • Données protégées
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition"
          >
            <Download size={18} />
            Export
          </button>
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="text-red-400 flex-shrink-0" />
          <p className="text-red-300">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Résumé masse salariale */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg p-4">
          <p className="text-white text-sm">Masse salariale brute</p>
          <p className="text-2xl font-bold text-white">{formatMontant(masseSalariale.totalBrut, false)}</p>
          <p className="text-white text-xs">/an</p>
        </div>
        <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg p-4">
          <p className="text-white text-sm">Charges patronales</p>
          <p className="text-2xl font-bold text-orange-400">{formatMontant(masseSalariale.totalCharges, false)}</p>
          <p className="text-white text-xs">/an</p>
        </div>
        <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg p-4">
          <p className="text-white text-sm">Coût total employeur</p>
          <p className="text-2xl font-bold text-green-400">{formatMontant(masseSalariale.coutTotal, false)}</p>
          <p className="text-white text-xs">/an</p>
        </div>
        <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg p-4">
          <p className="text-white text-sm">Primes {filterAnnee}</p>
          <p className="text-2xl font-bold text-purple-400">{formatMontant(totalPrimesAnnee, false)}</p>
          <p className="text-white text-xs">brut</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        <button
          onClick={() => setActiveTab('salaires')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition ${
            activeTab === 'salaires' ? `${accent.color} text-white` : 'text-white hover:text-white'
          }`}
        >
          <Users size={18} />
          Salaires
        </button>
        <button
          onClick={() => setActiveTab('primes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition ${
            activeTab === 'primes' ? `${accent.color} text-white` : 'text-white hover:text-white'
          }`}
        >
          <Award size={18} />
          Primes
        </button>
        <button
          onClick={() => setActiveTab('simulations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition ${
            activeTab === 'simulations' ? `${accent.color} text-white` : 'text-white hover:text-white'
          }`}
        >
          <Calculator size={18} />
          Simulations
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white" size={18} />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {activeTab === 'primes' && (
          <select
            value={filterAnnee}
            onChange={(e) => setFilterAnnee(Number(e.target.value))}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600"
          >
            {[2024, 2025, 2026, 2027].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        )}

        <label className="flex items-center gap-2 text-white cursor-pointer">
          <input
            type="checkbox"
            checked={showInactifs}
            onChange={(e) => setShowInactifs(e.target.checked)}
            className="rounded"
          />
          Afficher inactifs
        </label>

        {activeTab === 'salaires' && (
          <button
            onClick={() => { setEditingSalaire(null); setShowSalaireModal(true); }}
            className={`flex items-center gap-2 px-4 py-2 ${accent.color} text-white rounded-lg ${accent.hover} transition`}
          >
            <Plus size={18} />
            Nouveau salaire
          </button>
        )}

        {activeTab === 'primes' && (
          <button
            onClick={() => { setEditingPrime(null); setShowPrimeModal(true); }}
            className={`flex items-center gap-2 px-4 py-2 ${accent.color} text-white rounded-lg ${accent.hover} transition`}
          >
            <Plus size={18} />
            Nouvelle prime
          </button>
        )}

        {activeTab === 'simulations' && (
          <button
            onClick={() => { setEditingSimulation(null); setShowSimulationModal(true); }}
            className={`flex items-center gap-2 px-4 py-2 ${accent.color} text-white rounded-lg ${accent.hover} transition`}
          >
            <Plus size={18} />
            Nouvelle simulation
          </button>
        )}
      </div>

      {/* Contenu selon onglet */}
      {activeTab === 'salaires' && (
        <SalairesTable
          salaires={salairesFiltres}
          accent={accent}
          onEdit={(s) => { setEditingSalaire(s); setShowSalaireModal(true); }}
          onDelete={handleDeleteSalaire}
          onShowHistorique={handleShowHistorique}
        />
      )}

      {activeTab === 'primes' && (
        <PrimesTable
          primes={primesFiltrees}
          accent={accent}
          onEdit={(p) => { setEditingPrime(p); setShowPrimeModal(true); }}
          onDelete={handleDeletePrime}
        />
      )}

      {activeTab === 'simulations' && (
        <SimulationsPanel
          simulations={simulations}
          collaborateurs={collaborateursActifs}
          salaires={salaires}
          accent={accent}
          userCollaborateur={userCollaborateur}
          onRefresh={loadData}
          setError={setError}
        />
      )}

      {/* Modals */}
      {showSalaireModal && (
        <SalaireModal
          salaire={editingSalaire}
          collaborateurs={collaborateursActifs}
          accent={accent}
          onSave={handleSaveSalaire}
          onClose={() => { setShowSalaireModal(false); setEditingSalaire(null); }}
        />
      )}

      {showPrimeModal && (
        <PrimeModal
          prime={editingPrime}
          collaborateurs={collaborateursActifs}
          filterAnnee={filterAnnee}
          accent={accent}
          onSave={handleSavePrime}
          onClose={() => { setShowPrimeModal(false); setEditingPrime(null); }}
        />
      )}

      {showHistoriqueModal && (
        <HistoriqueModal
          collaborateur={selectedCollaborateur}
          historique={historiqueData}
          accent={accent}
          onClose={() => setShowHistoriqueModal(false)}
        />
      )}
    </div>
  );
}

// ===========================================
// COMPOSANTS INTERNES
// ===========================================

function SalairesTable({ salaires, accent, onEdit, onDelete, onShowHistorique }) {
  if (salaires.length === 0) {
    return (
      <div className="bg-slate-800/90 rounded-lg p-8 text-center text-white">
        Aucun salaire enregistré
      </div>
    );
  }

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-900/50">
            <tr>
              <th className="text-left px-4 py-3 text-white font-medium">Collaborateur</th>
              <th className="text-right px-4 py-3 text-white font-medium">Brut annuel</th>
              <th className="text-right px-4 py-3 text-white font-medium">Charges</th>
              <th className="text-right px-4 py-3 text-white font-medium">Coût total</th>
              <th className="text-right px-4 py-3 text-white font-medium">Taux horaire</th>
              <th className="text-center px-4 py-3 text-white font-medium">Date effet</th>
              <th className="text-center px-4 py-3 text-white font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {salaires.map((s) => {
              const coutTotal = calculerCoutTotal(s.salaire_brut_annuel, s.charges_patronales_annuel);
              const tauxCharge = calculerTauxHoraireCharge(s.salaire_brut_annuel, s.charges_patronales_annuel, s.heures_annuelles);

              return (
                <tr key={s.id} className={`hover:bg-slate-700/50 ${!s.collaborateur?.actif ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div>
                      <span className="text-white font-medium">{s.collaborateur?.nom}</span>
                      {!s.collaborateur?.actif && (
                        <span className="ml-2 text-xs text-white">(inactif)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-white font-mono">
                    {formatMontant(s.salaire_brut_annuel)}
                  </td>
                  <td className="px-4 py-3 text-right text-orange-400 font-mono">
                    {formatMontant(s.charges_patronales_annuel)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-400 font-mono font-medium">
                    {formatMontant(coutTotal)}
                  </td>
                  <td className="px-4 py-3 text-right text-blue-400 font-mono">
                    {formatTauxHoraire(tauxCharge)}
                  </td>
                  <td className="px-4 py-3 text-center text-white">
                    {s.date_effet}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => onShowHistorique(s.collaborateur_id, s.collaborateur?.nom)}
                        className="p-1 text-white hover:text-blue-400 transition"
                        title="Historique"
                      >
                        <TrendingUp size={16} />
                      </button>
                      <button
                        onClick={() => onEdit(s)}
                        className="p-1 text-white hover:text-white transition"
                        title="Modifier"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => onDelete(s.id)}
                        className="p-1 text-white hover:text-red-400 transition"
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
    </div>
  );
}

function PrimesTable({ primes, accent, onEdit, onDelete }) {
  if (primes.length === 0) {
    return (
      <div className="bg-slate-800/90 rounded-lg p-8 text-center text-white">
        Aucune prime enregistrée
      </div>
    );
  }

  return (
    <div className="bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-900/50">
            <tr>
              <th className="text-left px-4 py-3 text-white font-medium">Collaborateur</th>
              <th className="text-left px-4 py-3 text-white font-medium">Type</th>
              <th className="text-left px-4 py-3 text-white font-medium">Libellé</th>
              <th className="text-right px-4 py-3 text-white font-medium">Montant brut</th>
              <th className="text-center px-4 py-3 text-white font-medium">Période</th>
              <th className="text-center px-4 py-3 text-white font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {primes.map((p) => (
              <tr key={p.id} className="hover:bg-slate-700/50">
                <td className="px-4 py-3 text-white">{p.collaborateur?.nom}</td>
                <td className="px-4 py-3 text-white">
                  {TYPES_PRIMES.find(t => t.value === p.type_prime)?.label || p.type_prime}
                </td>
                <td className="px-4 py-3 text-white">{p.libelle}</td>
                <td className="px-4 py-3 text-right text-purple-400 font-mono">
                  {formatMontant(p.montant_brut)}
                </td>
                <td className="px-4 py-3 text-center text-white">
                  {p.mois ? `${p.mois}/${p.annee}` : p.annee}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => onEdit(p)}
                      className="p-1 text-white hover:text-white transition"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => onDelete(p.id)}
                      className="p-1 text-white hover:text-red-400 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SimulationsPanel({ simulations, collaborateurs, salaires, accent, userCollaborateur, onRefresh, setError }) {
  const [selectedSimulation, setSelectedSimulation] = useState(null);
  const [simulationDetail, setSimulationDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showNewSimulationModal, setShowNewSimulationModal] = useState(false);

  const loadSimulationDetail = async (simId) => {
    setLoading(true);
    try {
      const data = await getSimulation(supabase, simId);
      setSimulationDetail(data);
      setSelectedSimulation(simId);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleAppliquer = async (simId) => {
    if (!confirm('Appliquer cette simulation ? Les nouveaux salaires seront créés.')) return;
    try {
      await appliquerSimulation(supabase, simId, userCollaborateur.id);
      await onRefresh();
      setSelectedSimulation(null);
      setSimulationDetail(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteSimulation = async (simId) => {
    if (!confirm('Supprimer cette simulation ?')) return;
    try {
      await deleteSimulation(supabase, simId);
      await onRefresh();
      if (selectedSimulation === simId) {
        setSelectedSimulation(null);
        setSimulationDetail(null);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateSimulation = async (data) => {
    try {
      const newSim = await createSimulation(supabase, {
        ...data,
        created_by: userCollaborateur.id
      });
      await onRefresh();
      setShowNewSimulationModal(false);
      loadSimulationDetail(newSim.id);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Liste des simulations */}
      <div className="lg:col-span-1 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-white">Simulations</h3>
          <button
            onClick={() => setShowNewSimulationModal(true)}
            className={`p-2 ${accent.color} text-white rounded-lg ${accent.hover} transition`}
          >
            <Plus size={18} />
          </button>
        </div>

        {simulations.length === 0 ? (
          <div className="bg-slate-800/90 rounded-lg p-4 text-center text-white">
            Aucune simulation
          </div>
        ) : (
          <div className="space-y-2">
            {simulations.map((sim) => (
              <div
                key={sim.id}
                className={`bg-slate-800/90 border rounded-lg p-4 cursor-pointer transition ${
                  selectedSimulation === sim.id ? 'border-blue-500' : 'border-slate-700 hover:border-slate-600'
                }`}
                onClick={() => loadSimulationDetail(sim.id)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-white font-medium">{sim.nom_simulation}</h4>
                    <p className="text-white text-sm">Année cible: {sim.annee_cible}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    sim.statut === 'applique' ? 'bg-green-900/50 text-green-400' :
                    sim.statut === 'valide' ? 'bg-blue-900/50 text-blue-400' :
                    'bg-slate-700 text-white'
                  }`}>
                    {sim.statut}
                  </span>
                </div>
                <div className="flex gap-2 mt-2">
                  {sim.statut !== 'applique' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteSimulation(sim.id); }}
                      className="text-white hover:text-red-400 text-sm"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Détail simulation */}
      <div className="lg:col-span-2">
        {loading ? (
          <div className="bg-slate-800/90 rounded-lg p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
          </div>
        ) : selectedSimulation && simulationDetail ? (
          <SimulationDetail
            simulation={simulationDetail.simulation}
            lignes={simulationDetail.lignes}
            collaborateurs={collaborateurs}
            salaires={salaires}
            accent={accent}
            onAppliquer={() => handleAppliquer(selectedSimulation)}
            onRefresh={() => loadSimulationDetail(selectedSimulation)}
            setError={setError}
          />
        ) : (
          <div className="bg-slate-800/90 rounded-lg p-8 text-center text-white">
            Sélectionnez une simulation ou créez-en une nouvelle
          </div>
        )}
      </div>

      {/* Modal nouvelle simulation */}
      {showNewSimulationModal && (
        <NewSimulationModal
          accent={accent}
          onSave={handleCreateSimulation}
          onClose={() => setShowNewSimulationModal(false)}
        />
      )}
    </div>
  );
}

function SimulationDetail({ simulation, lignes, collaborateurs, salaires, accent, onAppliquer, onRefresh, setError }) {
  const [editingLigne, setEditingLigne] = useState(null);

  // Calculer le coût total de la simulation
  const coutActuel = lignes.reduce((sum, l) =>
    sum + (l.salaire_actuel_brut || 0) + (l.charges_actuelles || 0), 0);
  const nouveauCout = lignes.reduce((sum, l) =>
    sum + (l.nouveau_salaire_brut || 0) + (l.nouvelles_charges || 0), 0);
  const difference = nouveauCout - coutActuel;

  const handleSaveLigne = async (ligneData) => {
    try {
      await upsertLigneSimulation(supabase, {
        simulation_id: simulation.id,
        ...ligneData
      });
      onRefresh();
      setEditingLigne(null);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="bg-slate-800/90 border border-slate-700 rounded-lg">
      {/* En-tête */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold text-white">{simulation.nom_simulation}</h3>
            <p className="text-white">Année cible: {simulation.annee_cible}</p>
          </div>
          {simulation.statut === 'brouillon' && (
            <button
              onClick={onAppliquer}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <Check size={18} />
              Appliquer
            </button>
          )}
        </div>

        {/* Résumé impact */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-slate-900/50 rounded p-3">
            <p className="text-white text-sm">Coût actuel</p>
            <p className="text-white font-mono">{formatMontant(coutActuel, false)}</p>
          </div>
          <div className="bg-slate-900/50 rounded p-3">
            <p className="text-white text-sm">Nouveau coût</p>
            <p className="text-white font-mono">{formatMontant(nouveauCout, false)}</p>
          </div>
          <div className="bg-slate-900/50 rounded p-3">
            <p className="text-white text-sm">Différence</p>
            <p className={`font-mono ${difference >= 0 ? 'text-red-400' : 'text-green-400'}`}>
              {difference >= 0 ? '+' : ''}{formatMontant(difference, false)}
            </p>
          </div>
        </div>
      </div>

      {/* Lignes */}
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-white font-medium">Détail par collaborateur</h4>
          <button
            onClick={() => setEditingLigne({})}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            + Ajouter un collaborateur
          </button>
        </div>

        {lignes.length === 0 ? (
          <p className="text-white text-center py-4">
            Aucun collaborateur dans cette simulation
          </p>
        ) : (
          <div className="space-y-2">
            {lignes.map((ligne) => {
              const evolution = calculerEvolution(
                ligne.salaire_actuel_brut || 0,
                ligne.nouveau_salaire_brut || 0
              );

              return (
                <div
                  key={ligne.id}
                  className="flex items-center justify-between bg-slate-900/50 rounded p-3"
                >
                  <div className="flex-1">
                    <span className="text-white">{ligne.collaborateur?.nom}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-white">
                      {formatMontant(ligne.salaire_actuel_brut)}
                    </span>
                    <span className="text-white">→</span>
                    <span className="text-white font-medium">
                      {formatMontant(ligne.nouveau_salaire_brut)}
                    </span>
                    <span className={`${evolution.pourcentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ({evolution.pourcentage >= 0 ? '+' : ''}{evolution.pourcentage.toFixed(1)}%)
                    </span>
                    {simulation.statut === 'brouillon' && (
                      <button
                        onClick={() => setEditingLigne(ligne)}
                        className="text-white hover:text-white"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal édition ligne */}
      {editingLigne !== null && (
        <LigneSimulationModal
          ligne={editingLigne}
          collaborateurs={collaborateurs}
          salaires={salaires}
          accent={accent}
          onSave={handleSaveLigne}
          onClose={() => setEditingLigne(null)}
        />
      )}
    </div>
  );
}

// ===========================================
// MODALS
// ===========================================

function SalaireModal({ salaire, collaborateurs, accent, onSave, onClose }) {
  const [formData, setFormData] = useState({
    collaborateur_id: salaire?.collaborateur_id || '',
    annee: salaire?.annee || new Date().getFullYear(),
    date_effet: salaire?.date_effet || new Date().toISOString().split('T')[0],
    salaire_brut_annuel: salaire?.salaire_brut_annuel || '',
    charges_patronales_annuel: salaire?.charges_patronales_annuel || '',
    heures_annuelles: salaire?.heures_annuelles || HEURES_ANNUELLES_LEGALES,
    motif_modification: salaire?.motif_modification || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      collaborateur_id: Number(formData.collaborateur_id),
      annee: Number(formData.annee),
      salaire_brut_annuel: Number(formData.salaire_brut_annuel),
      charges_patronales_annuel: Number(formData.charges_patronales_annuel) || 0,
      heures_annuelles: Number(formData.heures_annuelles)
    });
  };

  // Estimation charges si non renseigné
  const estimerCharges = () => {
    if (formData.salaire_brut_annuel && !formData.charges_patronales_annuel) {
      setFormData({
        ...formData,
        charges_patronales_annuel: Math.round(estimerChargesPatronales(Number(formData.salaire_brut_annuel)))
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-md">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">
            {salaire ? 'Modifier salaire' : 'Nouveau salaire'}
          </h3>
          <button onClick={onClose} className="text-white hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-white text-sm mb-1">Collaborateur</label>
            <select
              value={formData.collaborateur_id}
              onChange={(e) => setFormData({ ...formData, collaborateur_id: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
              required
            >
              <option value="">Sélectionner...</option>
              {collaborateurs.map(c => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-white text-sm mb-1">Année</label>
              <input
                type="number"
                value={formData.annee}
                onChange={(e) => setFormData({ ...formData, annee: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
                required
              />
            </div>
            <div>
              <label className="block text-white text-sm mb-1">Date effet</label>
              <input
                type="date"
                value={formData.date_effet}
                onChange={(e) => setFormData({ ...formData, date_effet: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-white text-sm mb-1">Salaire brut annuel (€)</label>
            <input
              type="number"
              step="0.01"
              value={formData.salaire_brut_annuel}
              onChange={(e) => setFormData({ ...formData, salaire_brut_annuel: e.target.value })}
              onBlur={estimerCharges}
              className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
              required
            />
          </div>

          <div>
            <label className="block text-white text-sm mb-1">
              Charges patronales annuelles (€)
              <button
                type="button"
                onClick={estimerCharges}
                className="ml-2 text-xs text-blue-400 hover:text-blue-300"
              >
                Estimer (45%)
              </button>
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.charges_patronales_annuel}
              onChange={(e) => setFormData({ ...formData, charges_patronales_annuel: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
            />
          </div>

          <div>
            <label className="block text-white text-sm mb-1">Heures annuelles</label>
            <input
              type="number"
              value={formData.heures_annuelles}
              onChange={(e) => setFormData({ ...formData, heures_annuelles: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
            />
          </div>

          <div>
            <label className="block text-white text-sm mb-1">Motif</label>
            <input
              type="text"
              value={formData.motif_modification}
              onChange={(e) => setFormData({ ...formData, motif_modification: e.target.value })}
              placeholder="Embauche, Augmentation, Promotion..."
              className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
            />
          </div>

          {/* Aperçu calculs */}
          {formData.salaire_brut_annuel && (
            <div className="bg-slate-900/50 rounded p-3 text-sm">
              <p className="text-white">Mensuel brut: <span className="text-white">{formatMontant(formData.salaire_brut_annuel / 12)}</span></p>
              <p className="text-white">Coût total: <span className="text-green-400">{formatMontant(calculerCoutTotal(Number(formData.salaire_brut_annuel), Number(formData.charges_patronales_annuel) || 0))}</span></p>
              <p className="text-white">Taux horaire chargé: <span className="text-blue-400">{formatTauxHoraire(calculerTauxHoraireCharge(Number(formData.salaire_brut_annuel), Number(formData.charges_patronales_annuel) || 0, formData.heures_annuelles))}</span></p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className={`flex-1 px-4 py-2 ${accent.color} text-white rounded ${accent.hover} transition`}
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PrimeModal({ prime, collaborateurs, filterAnnee, accent, onSave, onClose }) {
  const [formData, setFormData] = useState({
    collaborateur_id: prime?.collaborateur_id || '',
    annee: prime?.annee || filterAnnee,
    mois: prime?.mois || '',
    date_versement: prime?.date_versement || '',
    type_prime: prime?.type_prime || 'prime_exceptionnelle',
    libelle: prime?.libelle || '',
    montant_brut: prime?.montant_brut || '',
    charges_patronales: prime?.charges_patronales || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      collaborateur_id: Number(formData.collaborateur_id),
      annee: Number(formData.annee),
      mois: formData.mois ? Number(formData.mois) : null,
      montant_brut: Number(formData.montant_brut),
      charges_patronales: Number(formData.charges_patronales) || 0,
      date_versement: formData.date_versement || null
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-md">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">
            {prime ? 'Modifier prime' : 'Nouvelle prime'}
          </h3>
          <button onClick={onClose} className="text-white hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-white text-sm mb-1">Collaborateur</label>
            <select
              value={formData.collaborateur_id}
              onChange={(e) => setFormData({ ...formData, collaborateur_id: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
              required
            >
              <option value="">Sélectionner...</option>
              {collaborateurs.map(c => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-white text-sm mb-1">Type de prime</label>
            <select
              value={formData.type_prime}
              onChange={(e) => setFormData({ ...formData, type_prime: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
              required
            >
              {TYPES_PRIMES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-white text-sm mb-1">Libellé</label>
            <input
              type="text"
              value={formData.libelle}
              onChange={(e) => setFormData({ ...formData, libelle: e.target.value })}
              placeholder="Description de la prime"
              className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-white text-sm mb-1">Année</label>
              <input
                type="number"
                value={formData.annee}
                onChange={(e) => setFormData({ ...formData, annee: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
                required
              />
            </div>
            <div>
              <label className="block text-white text-sm mb-1">Mois (optionnel)</label>
              <select
                value={formData.mois}
                onChange={(e) => setFormData({ ...formData, mois: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
              >
                <option value="">Annuel</option>
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-white text-sm mb-1">Montant brut (€)</label>
            <input
              type="number"
              step="0.01"
              value={formData.montant_brut}
              onChange={(e) => setFormData({ ...formData, montant_brut: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
              required
            />
          </div>

          <div>
            <label className="block text-white text-sm mb-1">Charges patronales (€)</label>
            <input
              type="number"
              step="0.01"
              value={formData.charges_patronales}
              onChange={(e) => setFormData({ ...formData, charges_patronales: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
            />
          </div>

          <div>
            <label className="block text-white text-sm mb-1">Date de versement</label>
            <input
              type="date"
              value={formData.date_versement}
              onChange={(e) => setFormData({ ...formData, date_versement: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className={`flex-1 px-4 py-2 ${accent.color} text-white rounded ${accent.hover} transition`}
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HistoriqueModal({ collaborateur, historique, accent, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">
            Historique - {collaborateur?.nom}
          </h3>
          <button onClick={onClose} className="text-white hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {historique.length === 0 ? (
            <p className="text-white text-center">Aucun historique</p>
          ) : (
            <div className="space-y-3">
              {historique.map((h, index) => {
                const precedent = historique[index + 1];
                const evolution = precedent
                  ? calculerEvolution(precedent.salaire_brut_annuel, h.salaire_brut_annuel)
                  : null;

                return (
                  <div key={h.id} className="bg-slate-900/50 rounded p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-white font-medium">{formatMontant(h.salaire_brut_annuel)}</p>
                        <p className="text-white text-sm">
                          Effet: {h.date_effet}
                          {h.motif_modification && ` • ${h.motif_modification}`}
                        </p>
                      </div>
                      {evolution && (
                        <span className={`text-sm ${evolution.pourcentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {evolution.pourcentage >= 0 ? '+' : ''}{evolution.pourcentage.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-white">
                      Taux horaire: {formatTauxHoraire(calculerTauxHoraireCharge(h.salaire_brut_annuel, h.charges_patronales_annuel, h.heures_annuelles))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function NewSimulationModal({ accent, onSave, onClose }) {
  const [formData, setFormData] = useState({
    nom_simulation: '',
    annee_cible: new Date().getFullYear() + 1,
    date_effet_prevue: `${new Date().getFullYear() + 1}-01-01`,
    notes: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-md">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">Nouvelle simulation</h3>
          <button onClick={onClose} className="text-white hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-white text-sm mb-1">Nom de la simulation</label>
            <input
              type="text"
              value={formData.nom_simulation}
              onChange={(e) => setFormData({ ...formData, nom_simulation: e.target.value })}
              placeholder="Ex: Budget 2026, Augmentation 3%..."
              className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-white text-sm mb-1">Année cible</label>
              <input
                type="number"
                value={formData.annee_cible}
                onChange={(e) => setFormData({ ...formData, annee_cible: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
                required
              />
            </div>
            <div>
              <label className="block text-white text-sm mb-1">Date effet prévue</label>
              <input
                type="date"
                value={formData.date_effet_prevue}
                onChange={(e) => setFormData({ ...formData, date_effet_prevue: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-white text-sm mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className={`flex-1 px-4 py-2 ${accent.color} text-white rounded ${accent.hover} transition`}
            >
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LigneSimulationModal({ ligne, collaborateurs, salaires, accent, onSave, onClose }) {
  const [formData, setFormData] = useState({
    collaborateur_id: ligne?.collaborateur_id || '',
    salaire_actuel_brut: ligne?.salaire_actuel_brut || 0,
    charges_actuelles: ligne?.charges_actuelles || 0,
    type_augmentation: ligne?.type_augmentation || 'pourcentage',
    valeur_augmentation: ligne?.valeur_augmentation || '',
    nouveau_salaire_brut: ligne?.nouveau_salaire_brut || 0,
    nouvelles_charges: ligne?.nouvelles_charges || 0,
    notes: ligne?.notes || ''
  });

  // Charger le salaire actuel quand on sélectionne un collaborateur
  useEffect(() => {
    if (formData.collaborateur_id && !ligne?.id) {
      const salaireActuel = salaires.find(s => s.collaborateur_id === Number(formData.collaborateur_id));
      if (salaireActuel) {
        setFormData(prev => ({
          ...prev,
          salaire_actuel_brut: salaireActuel.salaire_brut_annuel,
          charges_actuelles: salaireActuel.charges_patronales_annuel
        }));
      }
    }
  }, [formData.collaborateur_id, salaires, ligne]);

  // Calculer le nouveau salaire quand la valeur d'augmentation change
  useEffect(() => {
    if (formData.valeur_augmentation && formData.salaire_actuel_brut) {
      const nouveauBrut = calculerAugmentation(
        formData.salaire_actuel_brut,
        Number(formData.valeur_augmentation),
        formData.type_augmentation
      );
      const nouvellesCharges = estimerChargesPatronales(nouveauBrut);
      setFormData(prev => ({
        ...prev,
        nouveau_salaire_brut: Math.round(nouveauBrut * 100) / 100,
        nouvelles_charges: Math.round(nouvellesCharges * 100) / 100
      }));
    }
  }, [formData.valeur_augmentation, formData.type_augmentation, formData.salaire_actuel_brut]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      collaborateur_id: Number(formData.collaborateur_id),
      valeur_augmentation: Number(formData.valeur_augmentation)
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg w-full max-w-md">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">
            {ligne?.id ? 'Modifier' : 'Ajouter'} collaborateur
          </h3>
          <button onClick={onClose} className="text-white hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-white text-sm mb-1">Collaborateur</label>
            <select
              value={formData.collaborateur_id}
              onChange={(e) => setFormData({ ...formData, collaborateur_id: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
              required
              disabled={!!ligne?.id}
            >
              <option value="">Sélectionner...</option>
              {collaborateurs.map(c => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>

          <div className="bg-slate-900/50 rounded p-3">
            <p className="text-white text-sm">Salaire actuel</p>
            <p className="text-white font-medium">{formatMontant(formData.salaire_actuel_brut)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-white text-sm mb-1">Type augmentation</label>
              <select
                value={formData.type_augmentation}
                onChange={(e) => setFormData({ ...formData, type_augmentation: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
              >
                <option value="pourcentage">Pourcentage (%)</option>
                <option value="montant">Montant (€)</option>
              </select>
            </div>
            <div>
              <label className="block text-white text-sm mb-1">
                Valeur ({formData.type_augmentation === 'pourcentage' ? '%' : '€'})
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.valeur_augmentation}
                onChange={(e) => setFormData({ ...formData, valeur_augmentation: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded border border-slate-600"
                required
              />
            </div>
          </div>

          <div className="bg-green-900/30 rounded p-3">
            <p className="text-green-400 text-sm">Nouveau salaire</p>
            <p className="text-white font-medium text-lg">{formatMontant(formData.nouveau_salaire_brut)}</p>
            <p className="text-white text-xs">
              Coût total: {formatMontant(formData.nouveau_salaire_brut + formData.nouvelles_charges)}
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className={`flex-1 px-4 py-2 ${accent.color} text-white rounded ${accent.hover} transition`}
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SalairesPage;
