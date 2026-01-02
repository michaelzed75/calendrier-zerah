import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Filter, Download, Eye, Pencil, Users, Building2, Calendar, Menu, Check, Trash2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const SUPABASE_URL = 'https://anrvvsfvejnmdouxjfxj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_BxHx7EG9PQ-TDT3BmHFfWg_BZz77c8k';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// DONNÉES INITIALES (seront migrées vers Supabase)
// ============================================
const INITIAL_COLLABORATEURS = [
  { id: 1, nom: 'Michaël Z', est_chef_mission: true, chef_id: null, actif: true },
  { id: 2, nom: 'Delphine Z', est_chef_mission: false, chef_id: 1, actif: true },
  { id: 3, nom: 'Thérèse D', est_chef_mission: true, chef_id: 1, actif: true },
  { id: 4, nom: 'Benoît O', est_chef_mission: false, chef_id: 1, actif: true },
  { id: 5, nom: 'Danny', est_chef_mission: false, chef_id: 3, actif: true },
  { id: 6, nom: 'Jeremy Z', est_chef_mission: true, chef_id: 1, actif: true },
  { id: 7, nom: 'Anny', est_chef_mission: false, chef_id: 6, actif: true },
  { id: 8, nom: 'Camille', est_chef_mission: false, chef_id: 6, actif: true }
];

const INITIAL_CLIENTS = [
  { id: 1, nom: 'PPF', code_pennylane: '', actif: true },
  { id: 2, nom: 'PfA', code_pennylane: '', actif: true },
  { id: 3, nom: 'Hôtel Saint James', code_pennylane: '', actif: true },
  { id: 4, nom: 'Hôtel Relais Christine', code_pennylane: '', actif: true },
  { id: 5, nom: 'Hôtel Richepense', code_pennylane: '', actif: true },
  { id: 6, nom: 'Hôtel Ballu', code_pennylane: '', actif: true },
  { id: 7, nom: 'Le Comptoir de Saint Cloud', code_pennylane: '', actif: true },
  { id: 8, nom: 'Le Comptoir de Boulogne', code_pennylane: '', actif: true }
];

// ============================================
// UTILITAIRES
// ============================================
const formatDateToYMD = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateString = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// ============================================
// COMPOSANT PRINCIPAL - APP
// ============================================
export default function App() {
  const [currentPage, setCurrentPage] = useState('calendar');
  const [collaborateurs, setCollaborateurs] = useState([]);
  const [clients, setClients] = useState([]);
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Chargement initial des données
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    
    // Charger collaborateurs
    const savedCollabs = localStorage.getItem('collaborateurs');
    if (savedCollabs) {
      setCollaborateurs(JSON.parse(savedCollabs));
    } else {
      setCollaborateurs(INITIAL_COLLABORATEURS);
      localStorage.setItem('collaborateurs', JSON.stringify(INITIAL_COLLABORATEURS));
    }

    // Charger clients
    const savedClients = localStorage.getItem('clients');
    if (savedClients) {
      setClients(JSON.parse(savedClients));
    } else {
      setClients(INITIAL_CLIENTS);
      localStorage.setItem('clients', JSON.stringify(INITIAL_CLIENTS));
    }

    // Charger charges depuis Supabase
    try {
      const { data, error } = await supabase.from('charges').select('*');
      if (error) {
        const stored = localStorage.getItem('charges');
        setCharges(stored ? JSON.parse(stored) : []);
      } else {
        setCharges(data || []);
        localStorage.setItem('charges', JSON.stringify(data || []));
      }
    } catch (err) {
      const stored = localStorage.getItem('charges');
      setCharges(stored ? JSON.parse(stored) : []);
    }

    setLoading(false);
  };

  // Sauvegarder collaborateurs
  const saveCollaborateurs = (newCollabs) => {
    setCollaborateurs(newCollabs);
    localStorage.setItem('collaborateurs', JSON.stringify(newCollabs));
  };

  // Sauvegarder clients
  const saveClients = (newClients) => {
    setClients(newClients);
    localStorage.setItem('clients', JSON.stringify(newClients));
  };

  // Sauvegarder charges
  const saveCharges = (newCharges) => {
    setCharges(newCharges);
    localStorage.setItem('charges', JSON.stringify(newCharges));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Audit Up</h1>
          
          {/* Menu desktop */}
          <div className="hidden md:flex gap-2">
            <button
              onClick={() => setCurrentPage('calendar')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                currentPage === 'calendar' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Calendar size={18} />
              Calendrier
            </button>
            <button
              onClick={() => setCurrentPage('collaborateurs')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                currentPage === 'collaborateurs' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Users size={18} />
              Collaborateurs
            </button>
            <button
              onClick={() => setCurrentPage('clients')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                currentPage === 'clients' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Building2 size={18} />
              Clients
            </button>
          </div>

          {/* Menu mobile */}
          <button 
            className="md:hidden text-white p-2"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
          >
            <Menu size={24} />
          </button>
        </div>

        {/* Menu mobile déroulant */}
        {showMobileMenu && (
          <div className="md:hidden mt-4 space-y-2">
            <button
              onClick={() => { setCurrentPage('calendar'); setShowMobileMenu(false); }}
              className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg transition ${
                currentPage === 'calendar' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300'
              }`}
            >
              <Calendar size={18} />
              Calendrier
            </button>
            <button
              onClick={() => { setCurrentPage('collaborateurs'); setShowMobileMenu(false); }}
              className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg transition ${
                currentPage === 'collaborateurs' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300'
              }`}
            >
              <Users size={18} />
              Collaborateurs
            </button>
            <button
              onClick={() => { setCurrentPage('clients'); setShowMobileMenu(false); }}
              className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg transition ${
                currentPage === 'clients' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300'
              }`}
            >
              <Building2 size={18} />
              Clients
            </button>
          </div>
        )}
      </nav>

      {/* Contenu des pages */}
      {currentPage === 'calendar' && (
        <CalendarPage 
          collaborateurs={collaborateurs} 
          clients={clients} 
          charges={charges}
          saveCharges={saveCharges}
        />
      )}
      {currentPage === 'collaborateurs' && (
        <CollaborateursPage 
          collaborateurs={collaborateurs} 
          saveCollaborateurs={saveCollaborateurs}
          charges={charges}
        />
      )}
      {currentPage === 'clients' && (
        <ClientsPage 
          clients={clients} 
          saveClients={saveClients}
          charges={charges}
        />
      )}
    </div>
  );
}

// ============================================
// PAGE CALENDRIER
// ============================================
function CalendarPage({ collaborateurs, clients, charges, saveCharges }) {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 1));
  const [filteredCollaborateurs, setFilteredCollaborateurs] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedCollaborateurs, setSelectedCollaborateurs] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [viewMode, setViewMode] = useState('month');
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(null);
  const [editingCharge, setEditingCharge] = useState(null);
  const [localCharges, setLocalCharges] = useState(charges);

  // Synchroniser les charges locales avec les props
  useEffect(() => {
    setLocalCharges(charges);
  }, [charges]);

  // Charger les préférences utilisateur
  useEffect(() => {
    const saved = localStorage.getItem('userPreferences');
    if (saved) {
      const prefs = JSON.parse(saved);
      setCurrentUser(prefs.currentUser);
      setViewMode(prefs.viewMode || 'month');
      setSelectedCollaborateurs(prefs.selectedCollaborateurs || []);
      if (prefs.viewMode === 'day') {
        const today = new Date();
        setSelectedDay(formatDateToYMD(today));
      }
    } else {
      const activeCollabs = collaborateurs.filter(c => c.actif);
      setCurrentUser(activeCollabs[0]?.id || 1);
      setSelectedCollaborateurs(activeCollabs.map(c => c.id));
    }
  }, [collaborateurs]);

  // Sauvegarder les préférences
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('userPreferences', JSON.stringify({
        currentUser,
        viewMode,
        selectedCollaborateurs
      }));
    }
  }, [currentUser, viewMode, selectedCollaborateurs]);

  // Filtrer les collaborateurs actifs et sélectionnés
  useEffect(() => {
    const filtered = collaborateurs.filter(c => c.actif && selectedCollaborateurs.includes(c.id));
    setFilteredCollaborateurs(filtered);
  }, [selectedCollaborateurs, collaborateurs]);

  const activeCollaborateurs = collaborateurs.filter(c => c.actif);
  const activeClients = clients.filter(c => c.actif);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1 }, (_, i) => null);
  const allDays = [...emptyDays, ...monthDays];

  const getWeekDays = useCallback(() => {
    const today = new Date(currentDate);
    today.setDate(today.getDate() + weekOffset * 7);
    const first = today.getDate() - today.getDay() + 1;
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today.getFullYear(), today.getMonth(), first + i);
      weekDays.push(date);
    }
    return weekDays;
  }, [currentDate, weekOffset]);

  const getWeekLabel = () => {
    const days = getWeekDays();
    if (days.length === 0) return '';
    const start = days[0];
    const end = days[6];
    return `${start.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })} - ${end.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}`;
  };

  const weekDays = viewMode === 'week' ? getWeekDays() : [];

  const getDefaultDate = useCallback(() => {
    if (viewMode === 'day' && selectedDay) {
      return selectedDay;
    } else if (viewMode === 'week') {
      const days = getWeekDays();
      if (days.length > 0) {
        return formatDateToYMD(days[0]);
      }
    }
    const today = new Date();
    return formatDateToYMD(today);
  }, [viewMode, selectedDay, getWeekDays]);

  const handleAddCharge = async (collaborateurId, clientId, date, heures, type = 'budgété', detail = '') => {
    const newCharge = {
      collaborateur_id: collaborateurId,
      client_id: clientId,
      date_charge: date,
      heures: parseFloat(heures),
      type: type,
      detail: detail,
      heures_realisees: 0
    };

    try {
      const { data, error } = await supabase.from('charges').insert([newCharge]).select();
      if (error) {
        const newChargeWithId = { id: Date.now(), ...newCharge };
        const updated = [...localCharges, newChargeWithId];
        setLocalCharges(updated);
        saveCharges(updated);
      } else {
        const updated = [...localCharges, data[0]];
        setLocalCharges(updated);
        saveCharges(updated);
      }
    } catch (err) {
      const newChargeWithId = { id: Date.now(), ...newCharge };
      const updated = [...localCharges, newChargeWithId];
      setLocalCharges(updated);
      saveCharges(updated);
    }
    setShowAddModal(false);
  };

  const handleUpdateCharge = async (chargeId, collaborateurId, clientId, date, heures, type, detail) => {
    const updatedCharge = {
      collaborateur_id: collaborateurId,
      client_id: clientId,
      date_charge: date,
      heures: parseFloat(heures),
      type: type,
      detail: detail
    };

    const updated = localCharges.map(c => 
      c.id === chargeId ? { ...c, ...updatedCharge } : c
    );
    setLocalCharges(updated);
    saveCharges(updated);

    try {
      await supabase.from('charges').update(updatedCharge).eq('id', chargeId);
    } catch (err) {
      console.error('Erreur mise à jour:', err);
    }
    
    setEditingCharge(null);
  };

  const handleDeleteCharge = useCallback(async (chargeId) => {
    const updated = localCharges.filter(c => c.id !== chargeId);
    setLocalCharges(updated);
    saveCharges(updated);

    try {
      await supabase.from('charges').delete().eq('id', chargeId);
    } catch (err) {
      console.error('Erreur suppression:', err);
    }
  }, [localCharges, saveCharges]);

  const getChargesForDay = useCallback((collaborateurId, day) => {
    const targetDate = formatDateToYMD(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
    return localCharges.filter(c => c.collaborateur_id === collaborateurId && c.date_charge === targetDate);
  }, [localCharges, currentDate]);

  const getChargesForDateStr = useCallback((collaborateurId, dateStr) => {
    return localCharges.filter(c => c.collaborateur_id === collaborateurId && c.date_charge === dateStr);
  }, [localCharges]);

  const getTotalHoursForDay = useCallback((collaborateurId, day) => {
    return getChargesForDay(collaborateurId, day).reduce((sum, c) => sum + parseFloat(c.heures), 0);
  }, [getChargesForDay]);

  const getTotalHoursForDateStr = useCallback((collaborateurId, dateStr) => {
    return getChargesForDateStr(collaborateurId, dateStr).reduce((sum, c) => sum + parseFloat(c.heures), 0);
  }, [getChargesForDateStr]);

  const getAggregatedByClient = useCallback((collaborateurId, dateStr) => {
    const dayCharges = localCharges.filter(c => c.collaborateur_id === collaborateurId && c.date_charge === dateStr);
    const aggregated = {};
    dayCharges.forEach(charge => {
      const clientName = clients.find(c => c.id === charge.client_id)?.nom || 'Inconnu';
      if (!aggregated[clientName]) {
        aggregated[clientName] = 0;
      }
      aggregated[clientName] += parseFloat(charge.heures);
    });
    return Object.entries(aggregated).map(([client, heures]) => ({ client, heures }));
  }, [localCharges, clients]);

  const getWeekTotal = useCallback((collaborateurId) => {
    return weekDays.reduce((sum, date) => {
      const dateStr = formatDateToYMD(date);
      const dayTotal = localCharges
        .filter(c => c.collaborateur_id === collaborateurId && c.date_charge === dateStr)
        .reduce((daySum, c) => daySum + parseFloat(c.heures), 0);
      return sum + dayTotal;
    }, 0);
  }, [localCharges, weekDays]);

  const handleNavigateWeek = (direction) => {
    setWeekOffset(weekOffset + direction);
  };

  const openDayView = (day) => {
    const dateStr = formatDateToYMD(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
    setSelectedDay(dateStr);
    setViewMode('day');
  };

  const openDayViewFromDate = (date) => {
    const dateStr = formatDateToYMD(date);
    setSelectedDay(dateStr);
    setViewMode('day');
  };

  const navigateDay = (direction) => {
    const current = parseDateString(selectedDay);
    current.setDate(current.getDate() + direction);
    setSelectedDay(formatDateToYMD(current));
  };

  const switchToView = (newView) => {
    if (newView === 'day' && !selectedDay) {
      const today = new Date();
      if (today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear()) {
        setSelectedDay(formatDateToYMD(today));
      } else {
        setSelectedDay(formatDateToYMD(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)));
      }
    }
    if (newView === 'week') {
      setWeekOffset(0);
    }
    setViewMode(newView);
  };

  const exportToExcel = (startDateStr, endDateStr) => {
    const data = [];
    
    filteredCollaborateurs.forEach(collab => {
      const chargesForCollab = localCharges.filter(c => {
        return c.collaborateur_id === collab.id &&
               c.date_charge >= startDateStr &&
               c.date_charge <= endDateStr;
      });

      chargesForCollab.forEach(charge => {
        const displayDate = parseDateString(charge.date_charge);
        data.push({
          'Collaborateur': collab.nom,
          'Client': clients.find(cl => cl.id === charge.client_id)?.nom || '',
          'Date': displayDate.toLocaleDateString('fr-FR'),
          'Budgété (h)': charge.heures,
          'Réalisé (h)': charge.heures_realisees || 0,
          'Écart (h)': (charge.heures - (charge.heures_realisees || 0)).toFixed(2),
          'Type': charge.type,
          'Détail': charge.detail || ''
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Charges');
    
    const fileName = `Charges_${startDateStr}_${endDateStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    setShowExportModal(false);
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Calendrier d'équipe</h2>
          <p className="text-slate-400">Gestion des charges de travail par collaborateur</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 mb-6 border border-slate-700 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {viewMode === 'day' && selectedDay ? (
              <>
                <button onClick={() => navigateDay(-1)} className="p-2 hover:bg-slate-700 rounded-lg transition text-white">
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-xl font-semibold text-white min-w-48 text-center">
                  {parseDateString(selectedDay).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </h2>
                <button onClick={() => navigateDay(1)} className="p-2 hover:bg-slate-700 rounded-lg transition text-white">
                  <ChevronRight size={20} />
                </button>
              </>
            ) : viewMode === 'week' ? (
              <>
                <button onClick={() => handleNavigateWeek(-1)} className="p-2 hover:bg-slate-700 rounded-lg transition text-white">
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-xl font-semibold text-white min-w-48 text-center">
                  Semaine du {getWeekLabel()}
                </h2>
                <button onClick={() => handleNavigateWeek(1)} className="p-2 hover:bg-slate-700 rounded-lg transition text-white">
                  <ChevronRight size={20} />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))} className="p-2 hover:bg-slate-700 rounded-lg transition text-white">
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-xl font-semibold text-white min-w-48 text-center">
                  {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </h2>
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))} className="p-2 hover:bg-slate-700 rounded-lg transition text-white">
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>

          <div className="flex gap-3 flex-wrap">
            {filteredCollaborateurs.length > 0 && (
              <select value={currentUser} onChange={(e) => setCurrentUser(parseInt(e.target.value))} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition">
                {filteredCollaborateurs.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            )}

            <div className="flex rounded-lg overflow-hidden border border-slate-600">
              <button 
                onClick={() => switchToView('month')} 
                className={`px-4 py-2 text-sm font-medium transition ${
                  viewMode === 'month' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Mois
              </button>
              <button 
                onClick={() => switchToView('week')} 
                className={`px-4 py-2 text-sm font-medium transition border-l border-slate-600 ${
                  viewMode === 'week' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Semaine
              </button>
              <button 
                onClick={() => switchToView('day')} 
                className={`px-4 py-2 text-sm font-medium transition border-l border-slate-600 ${
                  viewMode === 'day' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Jour
              </button>
            </div>

            <button onClick={() => setShowFilterModal(!showFilterModal)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition">
              <Filter size={18} />
              Filtrer ({selectedCollaborateurs.length})
            </button>

            <button onClick={() => setShowExportModal(true)} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition">
              <Download size={18} />
              Export
            </button>

            <button onClick={() => setShowAddModal(true)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition">
              <Plus size={18} />
              Ajouter
            </button>
          </div>
        </div>

        {showFilterModal && (
          <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Filtrer par collaborateur</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => setSelectedCollaborateurs(activeCollaborateurs.map(c => c.id))}
                  className="text-sm bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded transition"
                >
                  Tout sélectionner
                </button>
                <button 
                  onClick={() => setSelectedCollaborateurs([])}
                  className="text-sm bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded transition"
                >
                  Tout désélectionner
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {activeCollaborateurs.map(collab => (
                <label key={collab.id} className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                  <input 
                    type="checkbox" 
                    checked={selectedCollaborateurs.includes(collab.id)} 
                    onChange={(e) => {
                      if (e.target.checked) setSelectedCollaborateurs([...selectedCollaborateurs, collab.id]);
                      else setSelectedCollaborateurs(selectedCollaborateurs.filter(id => id !== collab.id));
                    }} 
                    className="rounded" 
                  />
                  <span>{collab.nom}</span>
                  {collab.est_chef_mission && <span className="text-xs bg-purple-600/30 text-purple-300 px-1.5 py-0.5 rounded">Chef</span>}
                </label>
              ))}
            </div>
          </div>
        )}

        {showAddModal && (
          <AddChargeModal 
            clients={activeClients} 
            collaborateurs={filteredCollaborateurs} 
            defaultDate={getDefaultDate()}
            onAdd={handleAddCharge} 
            onClose={() => setShowAddModal(false)} 
          />
        )}

        {editingCharge && (
          <EditChargeModal 
            charge={editingCharge}
            clients={activeClients} 
            collaborateurs={filteredCollaborateurs} 
            onUpdate={handleUpdateCharge} 
            onClose={() => setEditingCharge(null)} 
          />
        )}

        {showExportModal && (
          <ExportModal 
            viewMode={viewMode} 
            currentDate={currentDate} 
            weekDays={weekDays} 
            onExport={exportToExcel} 
            onClose={() => setShowExportModal(false)} 
          />
        )}

        {/* VUE MOIS */}
        {viewMode === 'month' && (
          <div className="grid grid-cols-7 gap-1 mb-6 bg-slate-800 p-4 rounded-lg border border-slate-700">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
              <div key={day} className="text-center text-slate-400 text-sm font-semibold py-2">{day}</div>
            ))}
            {allDays.map((day, idx) => (
              <div key={idx} className="bg-slate-700 min-h-32 rounded-lg p-2 border border-slate-600">
                {day && (
                  <>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white font-bold text-lg">{day}</span>
                      <button 
                        onClick={() => openDayView(day)} 
                        className="text-slate-400 hover:text-white p-1 hover:bg-slate-600 rounded transition"
                        title="Voir détails"
                      >
                        <Eye size={14} />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {filteredCollaborateurs.map(collab => {
                        const totalHours = getTotalHoursForDay(collab.id, day);
                        if (totalHours === 0) return null;
                        return (
                          <div 
                            key={collab.id} 
                            className={`flex justify-between items-center text-xs px-2 py-1 rounded cursor-pointer hover:opacity-80 ${
                              totalHours > 8 ? 'bg-red-900/50 text-red-300' : 'bg-slate-600 text-slate-300'
                            }`}
                            onClick={() => openDayView(day)}
                          >
                            <span className="truncate">{collab.nom.split(' ')[0]}</span>
                            <span className="font-bold">{totalHours}h</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* VUE SEMAINE */}
        {viewMode === 'week' && (
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 overflow-x-auto">
            <div className="min-w-full">
              <div className="flex gap-2 mb-4">
                <div className="w-28 flex-shrink-0">
                  <div className="font-bold text-white text-sm">Collab.</div>
                </div>
                {weekDays.map(date => (
                  <div key={formatDateToYMD(date)} className="flex-1 min-w-36">
                    <div 
                      className="font-semibold text-white text-sm cursor-pointer hover:text-blue-300 transition"
                      onClick={() => openDayViewFromDate(date)}
                    >
                      {date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
                    </div>
                  </div>
                ))}
                <div className="w-20 flex-shrink-0">
                  <div className="font-bold text-green-300 text-sm text-center">Total</div>
                </div>
              </div>

              {filteredCollaborateurs.map(collab => (
                <div key={collab.id} className="flex gap-2 mb-3 bg-slate-700 p-3 rounded">
                  <div className="w-28 flex-shrink-0">
                    <div className="text-blue-300 font-semibold text-sm">{collab.nom}</div>
                  </div>
                  {weekDays.map(date => {
                    const dateStr = formatDateToYMD(date);
                    const aggregated = getAggregatedByClient(collab.id, dateStr);
                    const dayTotal = getTotalHoursForDateStr(collab.id, dateStr);
                    return (
                      <div 
                        key={dateStr} 
                        className="flex-1 min-w-36 cursor-pointer hover:bg-slate-600 rounded p-1 transition"
                        onClick={() => openDayViewFromDate(date)}
                      >
                        <div className={`text-sm font-bold mb-1 ${dayTotal > 8 ? 'text-red-400' : 'text-slate-300'}`}>
                          {dayTotal > 0 ? `${dayTotal}h` : '-'}
                        </div>
                        {aggregated.length > 0 && (
                          <div className="space-y-0.5">
                            {aggregated.slice(0, 3).map((item, idx) => (
                              <div key={idx} className="text-xs text-slate-400 truncate">
                                {item.client.substring(0, 10)}: {item.heures}h
                              </div>
                            ))}
                            {aggregated.length > 3 && (
                              <div className="text-xs text-slate-500">+{aggregated.length - 3} autres</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="w-20 flex-shrink-0 flex items-center justify-center">
                    <div className={`text-sm font-bold ${getWeekTotal(collab.id) > 40 ? 'text-red-400' : 'text-green-300'}`}>
                      {getWeekTotal(collab.id)}h
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VUE JOUR */}
        {viewMode === 'day' && selectedDay && (
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="space-y-6">
              {filteredCollaborateurs.map(collab => {
                const dayCharges = getChargesForDateStr(collab.id, selectedDay);
                const totalHours = dayCharges.reduce((sum, c) => sum + parseFloat(c.heures), 0);
                
                return (
                  <div key={collab.id} className="bg-slate-700 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-blue-300">{collab.nom}</h3>
                      <span className={`text-lg font-bold ${totalHours > 8 ? 'text-red-400' : 'text-green-300'}`}>
                        Total: {totalHours}h
                      </span>
                    </div>
                    
                    {dayCharges.length === 0 ? (
                      <div className="text-slate-400 text-sm italic">Aucune charge planifiée</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-slate-400 border-b border-slate-600">
                              <th className="text-left py-2 px-2 w-40">Client</th>
                              <th className="text-center py-2 px-2 w-20">Budgété</th>
                              <th className="text-center py-2 px-2 w-20">Réalisé</th>
                              <th className="text-center py-2 px-2 w-24">Type</th>
                              <th className="text-left py-2 px-2">Détail</th>
                              <th className="text-center py-2 px-2 w-24">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dayCharges.map(charge => (
                              <tr key={charge.id} className="border-b border-slate-600/50 hover:bg-slate-600/30 align-top">
                                <td className="py-2 px-2 text-white">
                                  {clients.find(c => c.id === charge.client_id)?.nom || 'Inconnu'}
                                </td>
                                <td className="py-2 px-2 text-center text-slate-300">{charge.heures}h</td>
                                <td className="py-2 px-2 text-center text-slate-300">{charge.heures_realisees || 0}h</td>
                                <td className="py-2 px-2 text-center">
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    charge.type === 'budgété' ? 'bg-blue-600/30 text-blue-300' : 'bg-green-600/30 text-green-300'
                                  }`}>
                                    {charge.type}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-slate-400 whitespace-pre-wrap break-words">
                                  {charge.detail || '-'}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <div className="flex justify-center gap-1">
                                    <button 
                                      onClick={() => setEditingCharge(charge)} 
                                      className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 p-1 rounded transition"
                                      title="Modifier"
                                    >
                                      <Pencil size={16} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteCharge(charge.id)} 
                                      className="text-red-400 hover:text-red-300 hover:bg-red-900/30 p-1 rounded transition"
                                      title="Supprimer"
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 mt-6">
          <p className="text-slate-400 text-sm">
            Charges : {localCharges.length} | Collaborateurs filtrés : {filteredCollaborateurs.length} | Vue : {viewMode === 'month' ? 'Mois' : viewMode === 'week' ? 'Semaine' : 'Jour'}
          </p>
          <p className="text-slate-500 text-xs mt-2">calendrier-zerah v3.0</p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// PAGE COLLABORATEURS
// ============================================
function CollaborateursPage({ collaborateurs, saveCollaborateurs, charges }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCollab, setEditingCollab] = useState(null);

  const chefsMission = collaborateurs.filter(c => c.est_chef_mission && c.actif);

  const handleAddCollaborateur = (nom, estChefMission, chefId) => {
    const newId = Math.max(...collaborateurs.map(c => c.id), 0) + 1;
    const newCollab = {
      id: newId,
      nom,
      est_chef_mission: estChefMission,
      chef_id: chefId,
      actif: true
    };
    saveCollaborateurs([...collaborateurs, newCollab]);
    setShowAddModal(false);
  };

  const handleUpdateCollaborateur = (id, nom, estChefMission, chefId) => {
    // Vérifier si on peut décocher "chef de mission"
    if (!estChefMission) {
      const hasSubordinates = collaborateurs.some(c => c.chef_id === id && c.actif);
      if (hasSubordinates) {
        alert('Impossible de retirer le statut chef de mission : ce collaborateur a des membres dans son équipe.');
        return;
      }
    }
    
    const updated = collaborateurs.map(c => 
      c.id === id ? { ...c, nom, est_chef_mission: estChefMission, chef_id: chefId } : c
    );
    saveCollaborateurs(updated);
    setEditingCollab(null);
  };

  const handleToggleActif = (id) => {
    const collab = collaborateurs.find(c => c.id === id);
    
    // Si on désactive, vérifier qu'il n'a pas de subordonnés actifs
    if (collab.actif) {
      const hasActiveSubordinates = collaborateurs.some(c => c.chef_id === id && c.actif);
      if (hasActiveSubordinates) {
        alert('Impossible de désactiver : ce collaborateur a des membres actifs dans son équipe.');
        return;
      }
      // Vérifier qu'il n'a pas de charges
      const hasCharges = charges.some(c => c.collaborateur_id === id);
      if (hasCharges) {
        if (!confirm('Ce collaborateur a des charges. Voulez-vous vraiment le désactiver ?')) {
          return;
        }
      }
    }
    
    const updated = collaborateurs.map(c => 
      c.id === id ? { ...c, actif: !c.actif } : c
    );
    saveCollaborateurs(updated);
  };

  const handleDeleteCollaborateur = (id) => {
    const collab = collaborateurs.find(c => c.id === id);
    
    // Vérifier qu'il n'a pas de subordonnés
    const hasSubordinates = collaborateurs.some(c => c.chef_id === id);
    if (hasSubordinates) {
      alert('Impossible de supprimer : ce collaborateur a des membres dans son équipe.');
      return;
    }
    
    // Vérifier qu'il n'a pas de charges
    const hasCharges = charges.some(c => c.collaborateur_id === id);
    if (hasCharges) {
      alert('Impossible de supprimer : ce collaborateur a des charges. Désactivez-le plutôt.');
      return;
    }
    
    if (confirm(`Supprimer définitivement ${collab.nom} ?`)) {
      const updated = collaborateurs.filter(c => c.id !== id);
      saveCollaborateurs(updated);
    }
  };

  const getChefNom = (chefId) => {
    if (!chefId) return '-';
    const chef = collaborateurs.find(c => c.id === chefId);
    return chef ? chef.nom : '-';
  };

  const getEquipeCount = (chefId) => {
    return collaborateurs.filter(c => c.chef_id === chefId && c.actif).length;
  };

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Gestion des Collaborateurs</h2>
            <p className="text-slate-400">Gérez votre équipe et la hiérarchie</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
          >
            <Plus size={18} />
            Ajouter
          </button>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-700 text-slate-300">
                <th className="text-left py-3 px-4">Nom</th>
                <th className="text-center py-3 px-4">Chef de mission</th>
                <th className="text-left py-3 px-4">Son chef</th>
                <th className="text-center py-3 px-4">Équipe</th>
                <th className="text-center py-3 px-4">Actif</th>
                <th className="text-center py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {collaborateurs.map(collab => (
                <tr key={collab.id} className={`border-t border-slate-700 ${!collab.actif ? 'opacity-50' : ''}`}>
                  <td className="py-3 px-4 text-white font-medium">{collab.nom}</td>
                  <td className="py-3 px-4 text-center">
                    {collab.est_chef_mission ? (
                      <span className="bg-purple-600/30 text-purple-300 px-2 py-1 rounded text-sm">Oui</span>
                    ) : (
                      <span className="text-slate-500">Non</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-300">{getChefNom(collab.chef_id)}</td>
                  <td className="py-3 px-4 text-center">
                    {collab.est_chef_mission && getEquipeCount(collab.id) > 0 ? (
                      <span className="bg-blue-600/30 text-blue-300 px-2 py-1 rounded text-sm">
                        {getEquipeCount(collab.id)} membre(s)
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button 
                      onClick={() => handleToggleActif(collab.id)}
                      className={`p-1 rounded transition ${collab.actif ? 'text-green-400 hover:bg-green-900/30' : 'text-slate-500 hover:bg-slate-700'}`}
                    >
                      <Check size={18} />
                    </button>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex justify-center gap-1">
                      <button 
                        onClick={() => setEditingCollab(collab)}
                        className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 p-1 rounded transition"
                        title="Modifier"
                      >
                        <Pencil size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteCollaborateur(collab.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/30 p-1 rounded transition"
                        title="Supprimer"
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

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 mt-6">
          <p className="text-slate-400 text-sm">
            Total : {collaborateurs.length} collaborateurs | Actifs : {collaborateurs.filter(c => c.actif).length} | Chefs de mission : {chefsMission.length}
          </p>
        </div>

        {showAddModal && (
          <CollaborateurModal 
            chefsMission={chefsMission}
            onSave={handleAddCollaborateur}
            onClose={() => setShowAddModal(false)}
          />
        )}

        {editingCollab && (
          <CollaborateurModal 
            collaborateur={editingCollab}
            chefsMission={chefsMission.filter(c => c.id !== editingCollab.id)}
            onSave={(nom, estChef, chefId) => handleUpdateCollaborateur(editingCollab.id, nom, estChef, chefId)}
            onClose={() => setEditingCollab(null)}
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// PAGE CLIENTS
// ============================================
function ClientsPage({ clients, saveClients, charges }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  const handleAddClient = (nom, codePennylane) => {
    const newId = Math.max(...clients.map(c => c.id), 0) + 1;
    const newClient = {
      id: newId,
      nom,
      code_pennylane: codePennylane,
      actif: true
    };
    saveClients([...clients, newClient]);
    setShowAddModal(false);
  };

  const handleUpdateClient = (id, nom, codePennylane) => {
    const updated = clients.map(c => 
      c.id === id ? { ...c, nom, code_pennylane: codePennylane } : c
    );
    saveClients(updated);
    setEditingClient(null);
  };

  const handleToggleActif = (id) => {
    const client = clients.find(c => c.id === id);
    
    if (client.actif) {
      const hasCharges = charges.some(c => c.client_id === id);
      if (hasCharges) {
        if (!confirm('Ce client a des charges. Voulez-vous vraiment le désactiver ?')) {
          return;
        }
      }
    }
    
    const updated = clients.map(c => 
      c.id === id ? { ...c, actif: !c.actif } : c
    );
    saveClients(updated);
  };

  const handleDeleteClient = (id) => {
    const client = clients.find(c => c.id === id);
    
    const hasCharges = charges.some(c => c.client_id === id);
    if (hasCharges) {
      alert('Impossible de supprimer : ce client a des charges. Désactivez-le plutôt.');
      return;
    }
    
    if (confirm(`Supprimer définitivement ${client.nom} ?`)) {
      const updated = clients.filter(c => c.id !== id);
      saveClients(updated);
    }
  };

  const getChargesCount = (clientId) => {
    return charges.filter(c => c.client_id === clientId).length;
  };

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Gestion des Clients</h2>
            <p className="text-slate-400">Gérez vos clients et leurs codes Pennylane</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
          >
            <Plus size={18} />
            Ajouter
          </button>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-700 text-slate-300">
                <th className="text-left py-3 px-4">Nom</th>
                <th className="text-left py-3 px-4">Code Pennylane</th>
                <th className="text-center py-3 px-4">Charges</th>
                <th className="text-center py-3 px-4">Actif</th>
                <th className="text-center py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(client => (
                <tr key={client.id} className={`border-t border-slate-700 ${!client.actif ? 'opacity-50' : ''}`}>
                  <td className="py-3 px-4 text-white font-medium">{client.nom}</td>
                  <td className="py-3 px-4 text-slate-300">
                    {client.code_pennylane || <span className="text-slate-500 italic">Non défini</span>}
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
                      onClick={() => handleToggleActif(client.id)}
                      className={`p-1 rounded transition ${client.actif ? 'text-green-400 hover:bg-green-900/30' : 'text-slate-500 hover:bg-slate-700'}`}
                    >
                      <Check size={18} />
                    </button>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex justify-center gap-1">
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
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 mt-6">
          <p className="text-slate-400 text-sm">
            Total : {clients.length} clients | Actifs : {clients.filter(c => c.actif).length}
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
            onSave={(nom, code) => handleUpdateClient(editingClient.id, nom, code)}
            onClose={() => setEditingClient(null)}
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// MODALS
// ============================================
function CollaborateurModal({ collaborateur, chefsMission, onSave, onClose }) {
  const [nom, setNom] = useState(collaborateur?.nom || '');
  const [estChefMission, setEstChefMission] = useState(collaborateur?.est_chef_mission || false);
  const [chefId, setChefId] = useState(collaborateur?.chef_id || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nom.trim()) {
      alert('Le nom est obligatoire');
      return;
    }
    onSave(nom.trim(), estChefMission, chefId ? parseInt(chefId) : null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">
            {collaborateur ? 'Modifier le collaborateur' : 'Ajouter un collaborateur'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nom *</label>
            <input 
              type="text" 
              value={nom} 
              onChange={(e) => setNom(e.target.value)} 
              placeholder="Prénom Nom"
              className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" 
            />
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input 
                type="checkbox" 
                checked={estChefMission} 
                onChange={(e) => setEstChefMission(e.target.checked)} 
                className="rounded" 
              />
              <span>Chef de mission</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Son chef de mission</label>
            <select 
              value={chefId} 
              onChange={(e) => setChefId(e.target.value)} 
              className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600"
            >
              <option value="">Aucun (N+2 / Direction)</option>
              {chefsMission.map(chef => (
                <option key={chef.id} value={chef.id}>{chef.nom}</option>
              ))}
            </select>
            {chefsMission.length === 0 && (
              <p className="text-slate-500 text-xs mt-1">Créez d'abord un chef de mission</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded transition">
              Annuler
            </button>
            <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded transition">
              {collaborateur ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ClientModal({ client, onSave, onClose }) {
  const [nom, setNom] = useState(client?.nom || '');
  const [codePennylane, setCodePennylane] = useState(client?.code_pennylane || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nom.trim()) {
      alert('Le nom est obligatoire');
      return;
    }
    onSave(nom.trim(), codePennylane.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">
            {client ? 'Modifier le client' : 'Ajouter un client'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nom *</label>
            <input 
              type="text" 
              value={nom} 
              onChange={(e) => setNom(e.target.value)} 
              placeholder="Nom du client"
              className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Code Pennylane</label>
            <input 
              type="text" 
              value={codePennylane} 
              onChange={(e) => setCodePennylane(e.target.value)} 
              placeholder="Pour future intégration API"
              className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" 
            />
            <p className="text-slate-500 text-xs mt-1">Optionnel - pour l'intégration future avec Pennylane</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded transition">
              Annuler
            </button>
            <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded transition">
              {client ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddChargeModal({ clients, collaborateurs, defaultDate, onAdd, onClose }) {
  if (!collaborateurs || collaborateurs.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">Ajouter une charge</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <X size={24} />
            </button>
          </div>
          <p className="text-slate-300">Veuillez sélectionner au moins un collaborateur dans le filtre.</p>
          <button onClick={onClose} className="mt-4 w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded transition">
            Fermer
          </button>
        </div>
      </div>
    );
  }

  const [formData, setFormData] = useState({
    collaborateurId: collaborateurs[0]?.id || '',
    clientId: clients[0]?.id || '',
    dateComplete: defaultDate,
    heures: 1,
    type: 'budgété',
    detail: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd(parseInt(formData.collaborateurId), parseInt(formData.clientId), formData.dateComplete, formData.heures, formData.type, formData.detail);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Ajouter une charge</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Collaborateur</label>
            <select value={formData.collaborateurId} onChange={(e) => setFormData({ ...formData, collaborateurId: e.target.value })} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600">
              {collaborateurs.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Client</label>
            <select value={formData.clientId} onChange={(e) => setFormData({ ...formData, clientId: e.target.value })} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600">
              {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Date</label>
            <input type="date" value={formData.dateComplete} onChange={(e) => setFormData({ ...formData, dateComplete: e.target.value })} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Heures</label>
            <input type="number" step="0.5" min="0.5" value={formData.heures} onChange={(e) => setFormData({ ...formData, heures: e.target.value })} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
            <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600">
              <option value="budgété">Budgété</option>
              <option value="réel">Réel</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Détail (optionnel)</label>
            <textarea value={formData.detail} onChange={(e) => setFormData({ ...formData, detail: e.target.value })} placeholder="Ex: Configuration système, réunion client..." className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 h-20 resize-none" />
          </div>

          <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded transition">
            Ajouter
          </button>
        </form>
      </div>
    </div>
  );
}

function EditChargeModal({ charge, clients, collaborateurs, onUpdate, onClose }) {
  if (!collaborateurs || collaborateurs.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">Modifier la charge</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <X size={24} />
            </button>
          </div>
          <p className="text-slate-300">Veuillez sélectionner au moins un collaborateur dans le filtre.</p>
          <button onClick={onClose} className="mt-4 w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded transition">
            Fermer
          </button>
        </div>
      </div>
    );
  }

  const [formData, setFormData] = useState({
    collaborateurId: charge.collaborateur_id,
    clientId: charge.client_id,
    dateComplete: charge.date_charge,
    heures: charge.heures,
    type: charge.type || 'budgété',
    detail: charge.detail || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdate(charge.id, parseInt(formData.collaborateurId), parseInt(formData.clientId), formData.dateComplete, formData.heures, formData.type, formData.detail);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Modifier la charge</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Collaborateur</label>
            <select value={formData.collaborateurId} onChange={(e) => setFormData({ ...formData, collaborateurId: e.target.value })} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600">
              {collaborateurs.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Client</label>
            <select value={formData.clientId} onChange={(e) => setFormData({ ...formData, clientId: e.target.value })} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600">
              {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Date</label>
            <input type="date" value={formData.dateComplete} onChange={(e) => setFormData({ ...formData, dateComplete: e.target.value })} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Heures</label>
            <input type="number" step="0.5" min="0.5" value={formData.heures} onChange={(e) => setFormData({ ...formData, heures: e.target.value })} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
            <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600">
              <option value="budgété">Budgété</option>
              <option value="réel">Réel</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Détail (optionnel)</label>
            <textarea value={formData.detail} onChange={(e) => setFormData({ ...formData, detail: e.target.value })} placeholder="Ex: Configuration système, réunion client..." className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 h-20 resize-none" />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded transition">
              Annuler
            </button>
            <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded transition">
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ExportModal({ viewMode, currentDate, weekDays, onExport, onClose }) {
  const getWeekDaysForExport = () => {
    if (weekDays && weekDays.length > 0) return weekDays;
    const today = new Date(currentDate);
    const first = today.getDate() - today.getDay() + 1;
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(today.getFullYear(), today.getMonth(), first + i));
    }
    return days;
  };

  const exportWeekDays = getWeekDaysForExport();

  const [startDate, setStartDate] = useState(() => {
    if (viewMode === 'month' || viewMode === 'day') {
      const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      return formatDateToYMD(firstDay);
    } else if (exportWeekDays.length > 0) {
      return formatDateToYMD(exportWeekDays[0]);
    }
    return '';
  });

  const [endDate, setEndDate] = useState(() => {
    if (viewMode === 'month' || viewMode === 'day') {
      const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      return formatDateToYMD(lastDay);
    } else if (exportWeekDays.length > 0) {
      return formatDateToYMD(exportWeekDays[6]);
    }
    return '';
  });

  const handleExport = () => {
    onExport(startDate, endDate);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Export Excel</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Date de début</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Date de fin</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" />
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded transition">
              Annuler
            </button>
            <button onClick={handleExport} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded transition">
              Exporter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
