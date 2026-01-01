import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Filter, Download, Eye, Pencil } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const SUPABASE_URL = 'https://anrvvsfvejnmdouxjfxj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_BxHx7EG9PQ-TDT3BmHFfWg_BZz77c8k';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const COLLABORATEURS = [
  { id: 1, nom: 'Michaël Z', role: 'manager', equipe: ['Delphine Z', 'Thérèse D', 'Benoît O', 'Danny', 'Jeremy Z', 'Anny', 'Camille'] },
  { id: 2, nom: 'Delphine Z', role: 'autonome', equipe: [] },
  { id: 3, nom: 'Thérèse D', role: 'manager', equipe: ['Danny'] },
  { id: 4, nom: 'Benoît O', role: 'autonome', equipe: [] },
  { id: 5, nom: 'Danny', role: 'employee', equipe: [] },
  { id: 6, nom: 'Jeremy Z', role: 'manager', equipe: ['Camille', 'Anny'] },
  { id: 7, nom: 'Anny', role: 'employee', equipe: [] },
  { id: 8, nom: 'Camille', role: 'employee', equipe: [] }
];

const CLIENTS = [
  { id: 1, nom: 'PPF' },
  { id: 2, nom: 'PfA' },
  { id: 3, nom: 'Hôtel Saint James' },
  { id: 4, nom: 'Hôtel Relais Christine' },
  { id: 5, nom: 'Hôtel Richepense' },
  { id: 6, nom: 'Hôtel Ballu' },
  { id: 7, nom: 'Le Comptoir de Saint Cloud' },
  { id: 8, nom: 'Le Comptoir de Boulogne' }
];

// Utilitaires date
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

export default function CalendarApp() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 1));
  const [charges, setCharges] = useState([]);
  const [filteredCollaborateurs, setFilteredCollaborateurs] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedCollaborateurs, setSelectedCollaborateurs] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'day'
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(null); // Pour la vue jour
  const [editingCharge, setEditingCharge] = useState(null); // Pour l'édition

  useEffect(() => {
    const saved = localStorage.getItem('userPreferences');
    if (saved) {
      const prefs = JSON.parse(saved);
      setCurrentUser(prefs.currentUser);
      setViewMode(prefs.viewMode || 'month');
      setSelectedCollaborateurs(prefs.selectedCollaborateurs || []);
    } else {
      setCurrentUser(1);
      setSelectedCollaborateurs([1, 2, 3, 4, 5, 6, 7, 8]);
    }
    loadCharges();
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('userPreferences', JSON.stringify({
        currentUser,
        viewMode,
        selectedCollaborateurs
      }));
    }
  }, [currentUser, viewMode, selectedCollaborateurs]);

  const loadCharges = async () => {
    try {
      setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      const user = COLLABORATEURS.find(c => c.id === currentUser);
      let defaultTeam = [currentUser];
      if (user && user.equipe && user.equipe.length > 0) {
        const teamIds = user.equipe.map(nom => COLLABORATEURS.find(c => c.nom === nom)?.id).filter(id => id !== undefined);
        defaultTeam = [currentUser, ...teamIds];
      }
      if (selectedCollaborateurs.length === 0) {
        setSelectedCollaborateurs(defaultTeam);
      }
    }
  }, [currentUser]);

  useEffect(() => {
    const filtered = COLLABORATEURS.filter(c => selectedCollaborateurs.includes(c.id));
    setFilteredCollaborateurs(filtered);
  }, [selectedCollaborateurs]);

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

  // Calculer la date par défaut selon la vue
  const getDefaultDate = useCallback(() => {
    if (viewMode === 'day' && selectedDay) {
      return selectedDay;
    } else if (viewMode === 'week') {
      const days = getWeekDays();
      if (days.length > 0) {
        return formatDateToYMD(days[0]);
      }
    }
    // Vue mois ou fallback : date du jour
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
        setCharges(prevCharges => [...prevCharges, newChargeWithId]);
        localStorage.setItem('charges', JSON.stringify([...charges, newChargeWithId]));
      } else {
        setCharges(prevCharges => [...prevCharges, data[0]]);
        localStorage.setItem('charges', JSON.stringify([...charges, data[0]]));
      }
    } catch (err) {
      const newChargeWithId = { id: Date.now(), ...newCharge };
      setCharges(prevCharges => [...prevCharges, newChargeWithId]);
      localStorage.setItem('charges', JSON.stringify([...charges, newChargeWithId]));
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

    // Mise à jour optimiste
    setCharges(prevCharges => {
      const updated = prevCharges.map(c => 
        c.id === chargeId ? { ...c, ...updatedCharge } : c
      );
      localStorage.setItem('charges', JSON.stringify(updated));
      return updated;
    });

    try {
      const { error } = await supabase.from('charges').update(updatedCharge).eq('id', chargeId);
      if (error) {
        console.error('Erreur mise à jour Supabase:', error);
      }
    } catch (err) {
      console.error('Erreur mise à jour:', err);
    }
    
    setEditingCharge(null);
  };

  const handleDeleteCharge = useCallback(async (chargeId) => {
    setCharges(prevCharges => {
      const updated = prevCharges.filter(c => c.id !== chargeId);
      localStorage.setItem('charges', JSON.stringify(updated));
      return updated;
    });

    try {
      const { error } = await supabase.from('charges').delete().eq('id', chargeId);
      if (error) {
        console.error('Erreur suppression Supabase:', error);
      }
    } catch (err) {
      console.error('Erreur suppression:', err);
    }
  }, []);

  // Obtenir les charges pour un jour donné
  const getChargesForDay = useCallback((collaborateurId, day) => {
    const targetDate = formatDateToYMD(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
    return charges.filter(c => c.collaborateur_id === collaborateurId && c.date_charge === targetDate);
  }, [charges, currentDate]);

  // Obtenir les charges pour une date string
  const getChargesForDateStr = useCallback((collaborateurId, dateStr) => {
    return charges.filter(c => c.collaborateur_id === collaborateurId && c.date_charge === dateStr);
  }, [charges]);

  // Total heures pour un jour
  const getTotalHoursForDay = useCallback((collaborateurId, day) => {
    return getChargesForDay(collaborateurId, day).reduce((sum, c) => sum + parseFloat(c.heures), 0);
  }, [getChargesForDay]);

  // Total heures pour une date string
  const getTotalHoursForDateStr = useCallback((collaborateurId, dateStr) => {
    return getChargesForDateStr(collaborateurId, dateStr).reduce((sum, c) => sum + parseFloat(c.heures), 0);
  }, [getChargesForDateStr]);

  // Agrégation par client pour une date (vue semaine)
  const getAggregatedByClient = useCallback((collaborateurId, dateStr) => {
    const dayCharges = charges.filter(c => c.collaborateur_id === collaborateurId && c.date_charge === dateStr);
    const aggregated = {};
    dayCharges.forEach(charge => {
      const clientName = CLIENTS.find(c => c.id === charge.client_id)?.nom || 'Inconnu';
      if (!aggregated[clientName]) {
        aggregated[clientName] = 0;
      }
      aggregated[clientName] += parseFloat(charge.heures);
    });
    return Object.entries(aggregated).map(([client, heures]) => ({ client, heures }));
  }, [charges]);

  // Total semaine
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

  // Ouvrir la vue jour
  const openDayView = (day) => {
    const dateStr = formatDateToYMD(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
    setSelectedDay(dateStr);
    setViewMode('day');
  };

  // Ouvrir vue jour depuis vue semaine
  const openDayViewFromDate = (date) => {
    const dateStr = formatDateToYMD(date);
    setSelectedDay(dateStr);
    setViewMode('day');
  };

  // Navigation vue jour
  const navigateDay = (direction) => {
    const current = parseDateString(selectedDay);
    current.setDate(current.getDate() + direction);
    setSelectedDay(formatDateToYMD(current));
  };

  // Changer de vue avec initialisation correcte
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
      const chargesForCollab = charges.filter(c => {
        return c.collaborateur_id === collab.id &&
               c.date_charge >= startDateStr &&
               c.date_charge <= endDateStr;
      });

      chargesForCollab.forEach(charge => {
        const displayDate = parseDateString(charge.date_charge);
        data.push({
          'Collaborateur': collab.nom,
          'Client': CLIENTS.find(cl => cl.id === charge.client_id)?.nom || '',
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

  if (loading) {
    return <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center"><div className="text-white text-xl">Chargement...</div></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Calendrier d'équipe - Audit Up</h1>
          <p className="text-slate-400">Gestion des charges de travail par collaborateur</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 mb-6 border border-slate-700 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {viewMode === 'day' ? (
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
            <select value={currentUser} onChange={(e) => setCurrentUser(parseInt(e.target.value))} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition">
              {COLLABORATEURS.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>

            {/* Trois boutons fixes pour les vues */}
            <div className="flex rounded-lg overflow-hidden border border-slate-600">
              <button 
                onClick={() => switchToView('month')} 
                className={`px-4 py-2 text-sm font-medium transition ${
                  viewMode === 'month' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Mois
              </button>
              <button 
                onClick={() => switchToView('week')} 
                className={`px-4 py-2 text-sm font-medium transition border-l border-slate-600 ${
                  viewMode === 'week' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Semaine
              </button>
              <button 
                onClick={() => switchToView('day')} 
                className={`px-4 py-2 text-sm font-medium transition border-l border-slate-600 ${
                  viewMode === 'day' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Jour
              </button>
            </div>

            <button onClick={() => setShowFilterModal(!showFilterModal)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition">
              <Filter size={18} />
              Filtrer
            </button>

            <button onClick={() => setShowExportModal(true)} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition">
              <Download size={18} />
              Export
            </button>

            <button onClick={() => setShowAddModal(!showAddModal)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition">
              <Plus size={18} />
              Ajouter
            </button>
          </div>
        </div>

        {showFilterModal && (
          <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Filtrer par collaborateur</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {COLLABORATEURS.map(collab => (
                <label key={collab.id} className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                  <input type="checkbox" checked={selectedCollaborateurs.includes(collab.id)} onChange={(e) => {
                    if (e.target.checked) setSelectedCollaborateurs([...selectedCollaborateurs, collab.id]);
                    else setSelectedCollaborateurs(selectedCollaborateurs.filter(id => id !== collab.id));
                  }} className="rounded" />
                  {collab.nom}
                </label>
              ))}
            </div>
          </div>
        )}

        {showAddModal && (
          <AddChargeModal 
            clients={CLIENTS} 
            collaborateurs={filteredCollaborateurs} 
            defaultDate={getDefaultDate()}
            onAdd={handleAddCharge} 
            onClose={() => setShowAddModal(false)} 
          />
        )}

        {editingCharge && (
          <EditChargeModal 
            charge={editingCharge}
            clients={CLIENTS} 
            collaborateurs={filteredCollaborateurs} 
            onUpdate={handleUpdateCharge} 
            onClose={() => setEditingCharge(null)} 
          />
        )}

        {showExportModal && <ExportModal viewMode={viewMode} currentDate={currentDate} weekDays={weekDays} onExport={exportToExcel} onClose={() => setShowExportModal(false)} />}

        {/* ============================================ */}
        {/* VUE MOIS - Totaux heures uniquement */}
        {/* ============================================ */}
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

        {/* ============================================ */}
        {/* VUE SEMAINE - Heures + clients agrégés */}
        {/* ============================================ */}
        {viewMode === 'week' && (
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 overflow-x-auto">
            <div className="min-w-full">
              {/* En-tête */}
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

              {/* Lignes collaborateurs */}
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

        {/* ============================================ */}
        {/* VUE JOUR - Détail complet avec scroll */}
        {/* ============================================ */}
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
                                  {CLIENTS.find(c => c.id === charge.client_id)?.nom || 'Inconnu'}
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
            Charges affichées : {charges.length} | Collaborateurs : {filteredCollaborateurs.length} | Vue : {viewMode === 'month' ? 'Mois' : viewMode === 'week' ? 'Semaine' : 'Jour'} | Utilisateur : {COLLABORATEURS.find(c => c.id === currentUser)?.nom}
          </p>
          <p className="text-slate-500 text-xs mt-2">Développé par Audit Up | calendrier-zerah v2.4</p>
        </div>
      </div>
    </div>
  );
}

function AddChargeModal({ clients, collaborateurs, defaultDate, onAdd, onClose }) {
  const [formData, setFormData] = useState({
    collaborateurId: collaborateurs[0]?.id,
    clientId: clients[0]?.id,
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
  const [startDate, setStartDate] = useState(() => {
    if (viewMode === 'month' || viewMode === 'day') {
      const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      return `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`;
    } else if (weekDays.length > 0) {
      return `${weekDays[0].getFullYear()}-${String(weekDays[0].getMonth() + 1).padStart(2, '0')}-${String(weekDays[0].getDate()).padStart(2, '0')}`;
    }
    return '';
  });

  const [endDate, setEndDate] = useState(() => {
    if (viewMode === 'month' || viewMode === 'day') {
      const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
    } else if (weekDays.length > 0) {
      return `${weekDays[6].getFullYear()}-${String(weekDays[6].getMonth() + 1).padStart(2, '0')}-${String(weekDays[6].getDate()).padStart(2, '0')}`;
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
