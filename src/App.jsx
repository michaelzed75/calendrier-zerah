import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Filter, Download, Eye, Pencil, Users, Building2, Calendar, Menu, Check, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const SUPABASE_URL = 'https://anrvvsfvejnmdouxjfxj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_BxHx7EG9PQ-TDT3BmHFfWg_BZz77c8k';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
  const [collaborateurChefs, setCollaborateurChefs] = useState([]);
  const [collaborateurClients, setCollaborateurClients] = useState([]);
  const [clients, setClients] = useState([]);
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Chargement initial des données depuis Supabase
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    
    try {
      // Charger collaborateurs
      const { data: collabData, error: collabError } = await supabase
        .from('collaborateurs')
        .select('*')
        .order('id');
      if (!collabError && collabData) {
        setCollaborateurs(collabData);
      }

      // Charger liaisons collaborateur-chefs
      const { data: chefsData, error: chefsError } = await supabase
        .from('collaborateur_chefs')
        .select('*');
      if (!chefsError && chefsData) {
        setCollaborateurChefs(chefsData);
      }

      // Charger clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('id');
      if (!clientsError && clientsData) {
        setClients(clientsData);
      }

      // Charger charges
      const { data: chargesData, error: chargesError } = await supabase
        .from('charges')
        .select('*');
      if (!chargesError && chargesData) {
        setCharges(chargesData);
      }

      // Charger assignations collaborateur-clients
      const { data: collabClientsData, error: collabClientsError } = await supabase
        .from('collaborateur_clients')
        .select('*');
      if (!collabClientsError && collabClientsData) {
        setCollaborateurClients(collabClientsData);
      }
    } catch (err) {
      console.error('Erreur chargement données:', err);
    }

    setLoading(false);
  };

  // Obtenir les chefs d'un collaborateur
  const getChefsOf = (collaborateurId) => {
    const chefIds = collaborateurChefs
      .filter(cc => cc.collaborateur_id === collaborateurId)
      .map(cc => cc.chef_id);
    return collaborateurs.filter(c => chefIds.includes(c.id));
  };

  // Obtenir l'équipe d'un chef
  const getEquipeOf = (chefId) => {
    const membreIds = collaborateurChefs
      .filter(cc => cc.chef_id === chefId)
      .map(cc => cc.collaborateur_id);
    return collaborateurs.filter(c => membreIds.includes(c.id));
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
          collaborateurChefs={collaborateurChefs}
          collaborateurClients={collaborateurClients}
          clients={clients}
          charges={charges}
          setCharges={setCharges}
          getChefsOf={getChefsOf}
          getEquipeOf={getEquipeOf}
        />
      )}
      {currentPage === 'collaborateurs' && (
        <CollaborateursPage 
          collaborateurs={collaborateurs}
          setCollaborateurs={setCollaborateurs}
          collaborateurChefs={collaborateurChefs}
          setCollaborateurChefs={setCollaborateurChefs}
          charges={charges}
          getChefsOf={getChefsOf}
          getEquipeOf={getEquipeOf}
        />
      )}
      {currentPage === 'clients' && (
        <ClientsPage
          clients={clients}
          setClients={setClients}
          charges={charges}
          collaborateurs={collaborateurs}
          collaborateurClients={collaborateurClients}
          setCollaborateurClients={setCollaborateurClients}
        />
      )}
    </div>
  );
}

// ============================================
// PAGE CALENDRIER
// ============================================
function CalendarPage({ collaborateurs, collaborateurChefs, collaborateurClients, clients, charges, setCharges, getChefsOf, getEquipeOf }) {
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
  const [expandedEquipes, setExpandedEquipes] = useState({});

  const activeCollaborateurs = collaborateurs.filter(c => c.actif);
  const activeClients = clients.filter(c => c.actif);
  const chefsMission = activeCollaborateurs.filter(c => c.est_chef_mission);

  // Charger les préférences utilisateur
  useEffect(() => {
    const saved = localStorage.getItem('userPreferences');
    if (saved) {
      const prefs = JSON.parse(saved);
      setCurrentUser(prefs.currentUser);
      setViewMode(prefs.viewMode || 'month');
      setSelectedCollaborateurs(prefs.selectedCollaborateurs || []);
      setExpandedEquipes(prefs.expandedEquipes || {});
      if (prefs.viewMode === 'day' && prefs.selectedDay) {
        setSelectedDay(prefs.selectedDay);
      } else if (prefs.viewMode === 'day') {
        setSelectedDay(formatDateToYMD(new Date()));
      }
    } else {
      setCurrentUser(activeCollaborateurs[0]?.id || 1);
      setSelectedCollaborateurs(activeCollaborateurs.map(c => c.id));
      // Ouvrir toutes les équipes par défaut
      const defaultExpanded = {};
      chefsMission.forEach(chef => { defaultExpanded[chef.id] = true; });
      setExpandedEquipes(defaultExpanded);
    }
  }, [collaborateurs]);

  // Sauvegarder les préférences
  useEffect(() => {
    if (currentUser !== null) {
      localStorage.setItem('userPreferences', JSON.stringify({
        currentUser,
        viewMode,
        selectedCollaborateurs,
        expandedEquipes,
        selectedDay
      }));
    }
  }, [currentUser, viewMode, selectedCollaborateurs, expandedEquipes, selectedDay]);

  // Filtrer les collaborateurs actifs et sélectionnés
  useEffect(() => {
    const filtered = collaborateurs.filter(c => c.actif && selectedCollaborateurs.includes(c.id));
    setFilteredCollaborateurs(filtered);
  }, [selectedCollaborateurs, collaborateurs]);

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
      if (!error && data) {
        setCharges(prev => [...prev, data[0]]);
      }
    } catch (err) {
      console.error('Erreur ajout charge:', err);
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

    setCharges(prev => prev.map(c => 
      c.id === chargeId ? { ...c, ...updatedCharge } : c
    ));

    try {
      await supabase.from('charges').update(updatedCharge).eq('id', chargeId);
    } catch (err) {
      console.error('Erreur mise à jour:', err);
    }
    
    setEditingCharge(null);
  };

  const handleDeleteCharge = useCallback(async (chargeId) => {
    setCharges(prev => prev.filter(c => c.id !== chargeId));

    try {
      await supabase.from('charges').delete().eq('id', chargeId);
    } catch (err) {
      console.error('Erreur suppression:', err);
    }
  }, [setCharges]);

  const getChargesForDay = useCallback((collaborateurId, day) => {
    const targetDate = formatDateToYMD(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
    return charges.filter(c => c.collaborateur_id === collaborateurId && c.date_charge === targetDate);
  }, [charges, currentDate]);

  const getChargesForDateStr = useCallback((collaborateurId, dateStr) => {
    return charges.filter(c => c.collaborateur_id === collaborateurId && c.date_charge === dateStr);
  }, [charges]);

  const getTotalHoursForDay = useCallback((collaborateurId, day) => {
    return getChargesForDay(collaborateurId, day).reduce((sum, c) => sum + parseFloat(c.heures), 0);
  }, [getChargesForDay]);

  const getTotalHoursForDateStr = useCallback((collaborateurId, dateStr) => {
    return getChargesForDateStr(collaborateurId, dateStr).reduce((sum, c) => sum + parseFloat(c.heures), 0);
  }, [getChargesForDateStr]);

  const getAggregatedByClient = useCallback((collaborateurId, dateStr) => {
    const dayCharges = charges.filter(c => c.collaborateur_id === collaborateurId && c.date_charge === dateStr);
    const aggregated = {};
    dayCharges.forEach(charge => {
      const clientName = clients.find(c => c.id === charge.client_id)?.nom || 'Inconnu';
      if (!aggregated[clientName]) {
        aggregated[clientName] = 0;
      }
      aggregated[clientName] += parseFloat(charge.heures);
    });
    return Object.entries(aggregated).map(([client, heures]) => ({ client, heures }));
  }, [charges, clients]);

  const getWeekTotal = useCallback((collaborateurId) => {
    return weekDays.reduce((sum, date) => {
      const dateStr = formatDateToYMD(date);
      const dayTotal = charges
        .filter(c => c.collaborateur_id === collaborateurId && c.date_charge === dateStr)
        .reduce((daySum, c) => daySum + parseFloat(c.heures), 0);
      return sum + dayTotal;
    }, 0);
  }, [charges, weekDays]);

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

  // Toggle équipe dans le filtre
  const toggleEquipe = (chefId) => {
    setExpandedEquipes(prev => ({ ...prev, [chefId]: !prev[chefId] }));
  };

  // Sélectionner toute une équipe
  const selectEquipe = (chefId, select) => {
    const equipe = getEquipeOf(chefId);
    const equipeIds = [chefId, ...equipe.map(m => m.id)];
    
    if (select) {
      setSelectedCollaborateurs(prev => [...new Set([...prev, ...equipeIds])]);
    } else {
      setSelectedCollaborateurs(prev => prev.filter(id => !equipeIds.includes(id)));
    }
  };

  const exportToExcel = (startDateStr, endDateStr) => {
    const data = [];
    
    filteredCollaborateurs.forEach(collab => {
      const chargesForCollab = charges.filter(c => {
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
              <select value={currentUser || ''} onChange={(e) => setCurrentUser(parseInt(e.target.value))} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition">
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

        {/* FILTRE PAR ÉQUIPE */}
        {showFilterModal && (
          <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Filtrer par équipe</h3>
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
            
            <div className="space-y-3">
              {chefsMission.map(chef => {
                const equipe = getEquipeOf(chef.id);
                const isExpanded = expandedEquipes[chef.id];
                const allSelected = [chef.id, ...equipe.map(m => m.id)].every(id => selectedCollaborateurs.includes(id));
                const someSelected = [chef.id, ...equipe.map(m => m.id)].some(id => selectedCollaborateurs.includes(id));
                
                return (
                  <div key={chef.id} className="bg-slate-700 rounded-lg overflow-hidden">
                    {/* En-tête équipe */}
                    <div className="flex items-center justify-between p-3 bg-slate-600">
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleEquipe(chef.id)} className="text-white">
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        <input 
                          type="checkbox"
                          checked={allSelected}
                          ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                          onChange={(e) => selectEquipe(chef.id, e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-white font-semibold">Équipe {chef.nom}</span>
                        <span className="text-slate-400 text-sm">({equipe.length + 1} personnes)</span>
                      </div>
                    </div>
                    
                    {/* Membres de l'équipe */}
                    {isExpanded && (
                      <div className="p-3 space-y-2">
                        {/* Le chef lui-même */}
                        <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white pl-8">
                          <input 
                            type="checkbox" 
                            checked={selectedCollaborateurs.includes(chef.id)} 
                            onChange={(e) => {
                              if (e.target.checked) setSelectedCollaborateurs(prev => [...prev, chef.id]);
                              else setSelectedCollaborateurs(prev => prev.filter(id => id !== chef.id));
                            }} 
                            className="rounded" 
                          />
                          <span>{chef.nom}</span>
                          <span className="text-xs bg-purple-600/30 text-purple-300 px-1.5 py-0.5 rounded">Chef</span>
                        </label>
                        
                        {/* Les membres */}
                        {equipe.filter(m => m.actif).map(membre => (
                          <label key={membre.id} className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white pl-8">
                            <input 
                              type="checkbox" 
                              checked={selectedCollaborateurs.includes(membre.id)} 
                              onChange={(e) => {
                                if (e.target.checked) setSelectedCollaborateurs(prev => [...prev, membre.id]);
                                else setSelectedCollaborateurs(prev => prev.filter(id => id !== membre.id));
                              }} 
                              className="rounded" 
                            />
                            <span>{membre.nom}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* Collaborateurs sans chef (autonomes) */}
              {(() => {
                const collabsAvecChef = collaborateurChefs.map(cc => cc.collaborateur_id);
                const autonomes = activeCollaborateurs.filter(c => !c.est_chef_mission && !collabsAvecChef.includes(c.id));
                
                if (autonomes.length === 0) return null;
                
                return (
                  <div className="bg-slate-700 rounded-lg p-3">
                    <div className="text-slate-400 text-sm mb-2">Autres collaborateurs</div>
                    {autonomes.map(collab => (
                      <label key={collab.id} className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                        <input 
                          type="checkbox" 
                          checked={selectedCollaborateurs.includes(collab.id)} 
                          onChange={(e) => {
                            if (e.target.checked) setSelectedCollaborateurs(prev => [...prev, collab.id]);
                            else setSelectedCollaborateurs(prev => prev.filter(id => id !== collab.id));
                          }} 
                          className="rounded" 
                        />
                        <span>{collab.nom}</span>
                      </label>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {showAddModal && (
          <AddChargeModal
            clients={activeClients}
            collaborateurs={filteredCollaborateurs}
            collaborateurClients={collaborateurClients}
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
            collaborateurClients={collaborateurClients}
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
            Charges : {charges.length} | Collaborateurs filtrés : {filteredCollaborateurs.length} | Vue : {viewMode === 'month' ? 'Mois' : viewMode === 'week' ? 'Semaine' : 'Jour'}
          </p>
          <p className="text-slate-500 text-xs mt-2">calendrier-zerah v3.1</p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// PAGE COLLABORATEURS
// ============================================
function CollaborateursPage({ collaborateurs, setCollaborateurs, collaborateurChefs, setCollaborateurChefs, charges, getChefsOf, getEquipeOf }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCollab, setEditingCollab] = useState(null);

  const chefsMission = collaborateurs.filter(c => c.est_chef_mission && c.actif);

  const handleAddCollaborateur = async (nom, estChefMission, chefIds) => {
    try {
      // Ajouter le collaborateur
      const { data, error } = await supabase
        .from('collaborateurs')
        .insert([{ nom, est_chef_mission: estChefMission, actif: true }])
        .select();
      
      if (error) throw error;
      
      const newCollab = data[0];
      setCollaborateurs(prev => [...prev, newCollab]);
      
      // Ajouter les liaisons avec les chefs
      if (chefIds && chefIds.length > 0) {
        const liaisons = chefIds.map(chefId => ({
          collaborateur_id: newCollab.id,
          chef_id: chefId
        }));
        
        const { data: liaisonsData, error: liaisonsError } = await supabase
          .from('collaborateur_chefs')
          .insert(liaisons)
          .select();
        
        if (!liaisonsError && liaisonsData) {
          setCollaborateurChefs(prev => [...prev, ...liaisonsData]);
        }
      }
    } catch (err) {
      console.error('Erreur ajout collaborateur:', err);
      alert('Erreur lors de l\'ajout');
    }
    setShowAddModal(false);
  };

  const handleUpdateCollaborateur = async (id, nom, estChefMission, chefIds) => {
    // Vérifier si on peut décocher "chef de mission"
    if (!estChefMission) {
      const equipe = getEquipeOf(id);
      if (equipe.length > 0) {
        alert('Impossible de retirer le statut chef de mission : ce collaborateur a des membres dans son équipe.');
        return;
      }
    }
    
    try {
      // Mettre à jour le collaborateur
      const { error } = await supabase
        .from('collaborateurs')
        .update({ nom, est_chef_mission: estChefMission })
        .eq('id', id);
      
      if (error) throw error;
      
      setCollaborateurs(prev => prev.map(c => 
        c.id === id ? { ...c, nom, est_chef_mission: estChefMission } : c
      ));
      
      // Supprimer les anciennes liaisons
      await supabase
        .from('collaborateur_chefs')
        .delete()
        .eq('collaborateur_id', id);
      
      // Ajouter les nouvelles liaisons
      if (chefIds && chefIds.length > 0) {
        const liaisons = chefIds.map(chefId => ({
          collaborateur_id: id,
          chef_id: chefId
        }));
        
        const { data: liaisonsData } = await supabase
          .from('collaborateur_chefs')
          .insert(liaisons)
          .select();
        
        // Mettre à jour le state local
        setCollaborateurChefs(prev => [
          ...prev.filter(cc => cc.collaborateur_id !== id),
          ...(liaisonsData || [])
        ]);
      } else {
        setCollaborateurChefs(prev => prev.filter(cc => cc.collaborateur_id !== id));
      }
    } catch (err) {
      console.error('Erreur mise à jour collaborateur:', err);
      alert('Erreur lors de la mise à jour');
    }
    setEditingCollab(null);
  };

  const handleToggleActif = async (id) => {
    const collab = collaborateurs.find(c => c.id === id);
    
    if (collab.actif) {
      const equipe = getEquipeOf(id);
      const hasActiveMembers = equipe.some(m => m.actif);
      if (hasActiveMembers) {
        alert('Impossible de désactiver : ce collaborateur a des membres actifs dans son équipe.');
        return;
      }
      const hasCharges = charges.some(c => c.collaborateur_id === id);
      if (hasCharges) {
        if (!confirm('Ce collaborateur a des charges. Voulez-vous vraiment le désactiver ?')) {
          return;
        }
      }
    }
    
    try {
      const { error } = await supabase
        .from('collaborateurs')
        .update({ actif: !collab.actif })
        .eq('id', id);
      
      if (error) throw error;
      
      setCollaborateurs(prev => prev.map(c => 
        c.id === id ? { ...c, actif: !c.actif } : c
      ));
    } catch (err) {
      console.error('Erreur toggle actif:', err);
    }
  };

  const handleDeleteCollaborateur = async (id) => {
    const collab = collaborateurs.find(c => c.id === id);
    
    const equipe = getEquipeOf(id);
    if (equipe.length > 0) {
      alert('Impossible de supprimer : ce collaborateur a des membres dans son équipe.');
      return;
    }
    
    const hasCharges = charges.some(c => c.collaborateur_id === id);
    if (hasCharges) {
      alert('Impossible de supprimer : ce collaborateur a des charges. Désactivez-le plutôt.');
      return;
    }
    
    if (confirm(`Supprimer définitivement ${collab.nom} ?`)) {
      try {
        const { error } = await supabase
          .from('collaborateurs')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        
        setCollaborateurs(prev => prev.filter(c => c.id !== id));
        setCollaborateurChefs(prev => prev.filter(cc => cc.collaborateur_id !== id && cc.chef_id !== id));
      } catch (err) {
        console.error('Erreur suppression:', err);
        alert('Erreur lors de la suppression');
      }
    }
  };

  const getChefsNoms = (collaborateurId) => {
    const chefs = getChefsOf(collaborateurId);
    if (chefs.length === 0) return '-';
    return chefs.map(c => c.nom).join(', ');
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
                <th className="text-left py-3 px-4">Ses chefs</th>
                <th className="text-center py-3 px-4">Équipe</th>
                <th className="text-center py-3 px-4">Actif</th>
                <th className="text-center py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {collaborateurs.map(collab => {
                const equipe = getEquipeOf(collab.id);
                return (
                  <tr key={collab.id} className={`border-t border-slate-700 ${!collab.actif ? 'opacity-50' : ''}`}>
                    <td className="py-3 px-4 text-white font-medium">{collab.nom}</td>
                    <td className="py-3 px-4 text-center">
                      {collab.est_chef_mission ? (
                        <span className="bg-purple-600/30 text-purple-300 px-2 py-1 rounded text-sm">Oui</span>
                      ) : (
                        <span className="text-slate-500">Non</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-300 text-sm">{getChefsNoms(collab.id)}</td>
                    <td className="py-3 px-4 text-center">
                      {collab.est_chef_mission && equipe.length > 0 ? (
                        <span className="bg-blue-600/30 text-blue-300 px-2 py-1 rounded text-sm">
                          {equipe.length} membre(s)
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
                );
              })}
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
            collaborateurChefs={collaborateurChefs}
            onSave={handleAddCollaborateur}
            onClose={() => setShowAddModal(false)}
          />
        )}

        {editingCollab && (
          <CollaborateurModal 
            collaborateur={editingCollab}
            chefsMission={chefsMission.filter(c => c.id !== editingCollab.id)}
            collaborateurChefs={collaborateurChefs}
            onSave={(nom, estChef, chefIds) => handleUpdateCollaborateur(editingCollab.id, nom, estChef, chefIds)}
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
function ClientsPage({ clients, setClients, charges, collaborateurs, collaborateurClients, setCollaborateurClients }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [assigningClient, setAssigningClient] = useState(null);
  const [filterCabinet, setFilterCabinet] = useState('tous');
  const [searchTerm, setSearchTerm] = useState('');

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

  // Obtenir les collaborateurs assignés à un client
  const getAssignedCollaborateurs = (clientId) => {
    const assignedIds = collaborateurClients
      .filter(cc => cc.client_id === clientId)
      .map(cc => cc.collaborateur_id);
    return collaborateurs.filter(c => assignedIds.includes(c.id));
  };

  // Assigner/désassigner un collaborateur à un client
  const handleToggleAssignment = async (clientId, collaborateurId) => {
    const existing = collaborateurClients.find(
      cc => cc.client_id === clientId && cc.collaborateur_id === collaborateurId
    );

    try {
      if (existing) {
        // Supprimer l'assignation
        const { error } = await supabase
          .from('collaborateur_clients')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
        setCollaborateurClients(prev => prev.filter(cc => cc.id !== existing.id));
      } else {
        // Ajouter l'assignation
        const { data, error } = await supabase
          .from('collaborateur_clients')
          .insert([{ client_id: clientId, collaborateur_id: collaborateurId }])
          .select();
        if (error) throw error;
        setCollaborateurClients(prev => [...prev, data[0]]);
      }
    } catch (err) {
      console.error('Erreur assignation:', err);
      alert('Erreur lors de l\'assignation');
    }
  };

  // Obtenir les cabinets uniques
  const cabinets = [...new Set(clients.filter(c => c.cabinet).map(c => c.cabinet))];

  // Filtrer les clients
  const filteredClients = clients.filter(client => {
    const matchesCabinet = filterCabinet === 'tous' || client.cabinet === filterCabinet || (filterCabinet === 'autres' && !client.cabinet);
    const matchesSearch = client.nom.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCabinet && matchesSearch;
  });

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Gestion des Clients</h2>
            <p className="text-slate-400">Gérez vos clients et assignez des collaborateurs</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
          >
            <Plus size={18} />
            Ajouter
          </button>
        </div>

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
                <th className="text-left py-3 px-4">Collaborateurs</th>
                <th className="text-center py-3 px-4">Charges</th>
                <th className="text-center py-3 px-4">Actif</th>
                <th className="text-center py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(client => {
                const assigned = getAssignedCollaborateurs(client.id);
                return (
                  <tr key={client.id} className={`border-t border-slate-700 ${!client.actif ? 'opacity-50' : ''}`}>
                    <td className="py-3 px-4">
                      <div className="text-white font-medium">{client.nom}</div>
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
                      <div className="flex flex-wrap gap-1">
                        {assigned.length > 0 ? (
                          assigned.slice(0, 3).map(collab => (
                            <span key={collab.id} className="bg-slate-600 text-white px-2 py-0.5 rounded text-xs">
                              {collab.nom.split(' ')[0]}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 text-sm italic">Non assigné</span>
                        )}
                        {assigned.length > 3 && (
                          <span className="text-slate-400 text-xs">+{assigned.length - 3}</span>
                        )}
                      </div>
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
                          onClick={() => setAssigningClient(client)}
                          className="text-purple-400 hover:text-purple-300 hover:bg-purple-900/30 p-1 rounded transition"
                          title="Gérer les collaborateurs"
                        >
                          <Users size={16} />
                        </button>
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
            onSave={(nom, code) => handleUpdateClient(editingClient.id, nom, code)}
            onClose={() => setEditingClient(null)}
          />
        )}

        {/* Modal d'assignation des collaborateurs */}
        {assigningClient && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md border border-slate-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-white">Collaborateurs assignés</h3>
                <button onClick={() => setAssigningClient(null)} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <p className="text-slate-400 mb-4">{assigningClient.nom}</p>

              <div className="max-h-80 overflow-y-auto space-y-2">
                {collaborateurs.filter(c => c.actif).map(collab => {
                  const isAssigned = collaborateurClients.some(
                    cc => cc.client_id === assigningClient.id && cc.collaborateur_id === collab.id
                  );
                  return (
                    <div
                      key={collab.id}
                      onClick={() => handleToggleAssignment(assigningClient.id, collab.id)}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition ${
                        isAssigned ? 'bg-purple-600/30 border border-purple-500' : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                    >
                      <div>
                        <span className="text-white">{collab.nom}</span>
                        {collab.est_chef_mission && (
                          <span className="ml-2 text-xs bg-yellow-600/30 text-yellow-300 px-2 py-0.5 rounded">
                            Chef
                          </span>
                        )}
                      </div>
                      {isAssigned && <Check size={18} className="text-purple-400" />}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700">
                <button
                  onClick={() => setAssigningClient(null)}
                  className="w-full bg-slate-600 hover:bg-slate-500 text-white py-2 rounded-lg transition"
                >
                  Fermer
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
// MODALS
// ============================================
function CollaborateurModal({ collaborateur, chefsMission, collaborateurChefs, onSave, onClose }) {
  const [nom, setNom] = useState(collaborateur?.nom || '');
  const [estChefMission, setEstChefMission] = useState(collaborateur?.est_chef_mission || false);
  const [selectedChefIds, setSelectedChefIds] = useState(() => {
    if (collaborateur && collaborateurChefs) {
      return collaborateurChefs
        .filter(cc => cc.collaborateur_id === collaborateur.id)
        .map(cc => cc.chef_id);
    }
    return [];
  });

  const toggleChef = (chefId) => {
    setSelectedChefIds(prev => 
      prev.includes(chefId) 
        ? prev.filter(id => id !== chefId)
        : [...prev, chefId]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nom.trim()) {
      alert('Le nom est obligatoire');
      return;
    }
    onSave(nom.trim(), estChefMission, selectedChefIds);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700 max-h-[90vh] overflow-y-auto">
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
            <label className="block text-sm font-medium text-slate-300 mb-2">Ses chefs de mission</label>
            {chefsMission.length === 0 ? (
              <p className="text-slate-500 text-sm">Aucun chef de mission disponible. Créez d'abord un chef de mission.</p>
            ) : (
              <div className="space-y-2 bg-slate-700 rounded p-3 max-h-40 overflow-y-auto">
                {chefsMission.map(chef => (
                  <label key={chef.id} className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                    <input 
                      type="checkbox" 
                      checked={selectedChefIds.includes(chef.id)} 
                      onChange={() => toggleChef(chef.id)} 
                      className="rounded" 
                    />
                    <span>{chef.nom}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-slate-500 text-xs mt-1">Vous pouvez sélectionner plusieurs chefs</p>
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

function AddChargeModal({ clients, collaborateurs, collaborateurClients, defaultDate, onAdd, onClose }) {
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

  // Fonction pour obtenir les clients assignés à un collaborateur
  const getClientsForCollaborateur = (collaborateurId) => {
    const assignedClientIds = collaborateurClients
      .filter(cc => cc.collaborateur_id === parseInt(collaborateurId))
      .map(cc => cc.client_id);

    // Si le collaborateur a des assignations, filtrer les clients
    if (assignedClientIds.length > 0) {
      return clients.filter(c => assignedClientIds.includes(c.id));
    }
    // Sinon, retourner tous les clients (pour compatibilité)
    return clients;
  };

  const initialCollabId = collaborateurs[0]?.id || '';
  const initialClients = getClientsForCollaborateur(initialCollabId);

  const [formData, setFormData] = useState({
    collaborateurId: initialCollabId,
    clientId: initialClients[0]?.id || '',
    dateComplete: defaultDate,
    heures: 1,
    type: 'budgété',
    detail: ''
  });

  // Clients disponibles pour le collaborateur sélectionné
  const availableClients = getClientsForCollaborateur(formData.collaborateurId);

  const handleCollaborateurChange = (newCollabId) => {
    const newClients = getClientsForCollaborateur(newCollabId);
    setFormData({
      ...formData,
      collaborateurId: newCollabId,
      clientId: newClients[0]?.id || ''
    });
  };

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
            <select value={formData.collaborateurId} onChange={(e) => handleCollaborateurChange(e.target.value)} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600">
              {collaborateurs.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Client
              {availableClients.length < clients.length && (
                <span className="text-purple-400 text-xs ml-2">({availableClients.length} assigné{availableClients.length > 1 ? 's' : ''})</span>
              )}
            </label>
            {availableClients.length > 0 ? (
              <select value={formData.clientId} onChange={(e) => setFormData({ ...formData, clientId: e.target.value })} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600">
                {availableClients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            ) : (
              <p className="text-red-400 text-sm py-2">Aucun client assigné à ce collaborateur</p>
            )}
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

function EditChargeModal({ charge, clients, collaborateurs, collaborateurClients, onUpdate, onClose }) {
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

  // Fonction pour obtenir les clients assignés à un collaborateur
  const getClientsForCollaborateur = (collaborateurId) => {
    const assignedClientIds = collaborateurClients
      .filter(cc => cc.collaborateur_id === parseInt(collaborateurId))
      .map(cc => cc.client_id);

    if (assignedClientIds.length > 0) {
      return clients.filter(c => assignedClientIds.includes(c.id));
    }
    return clients;
  };

  const [formData, setFormData] = useState({
    collaborateurId: charge.collaborateur_id,
    clientId: charge.client_id,
    dateComplete: charge.date_charge,
    heures: charge.heures,
    type: charge.type || 'budgété',
    detail: charge.detail || ''
  });

  const availableClients = getClientsForCollaborateur(formData.collaborateurId);

  const handleCollaborateurChange = (newCollabId) => {
    const newClients = getClientsForCollaborateur(newCollabId);
    // Garder le client actuel s'il est dans la liste, sinon prendre le premier
    const newClientId = newClients.find(c => c.id === formData.clientId)
      ? formData.clientId
      : (newClients[0]?.id || '');
    setFormData({
      ...formData,
      collaborateurId: newCollabId,
      clientId: newClientId
    });
  };

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
            <select value={formData.collaborateurId} onChange={(e) => handleCollaborateurChange(e.target.value)} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600">
              {collaborateurs.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Client
              {availableClients.length < clients.length && (
                <span className="text-purple-400 text-xs ml-2">({availableClients.length} assigné{availableClients.length > 1 ? 's' : ''})</span>
              )}
            </label>
            {availableClients.length > 0 ? (
              <select value={formData.clientId} onChange={(e) => setFormData({ ...formData, clientId: e.target.value })} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600">
                {availableClients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            ) : (
              <p className="text-red-400 text-sm py-2">Aucun client assigné à ce collaborateur</p>
            )}
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
