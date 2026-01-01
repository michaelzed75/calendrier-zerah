import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Filter, Calendar, Download } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

// Initialiser Supabase
const SUPABASE_URL = 'https://anrvvsfvejnmdouxjfxj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_BxHx7EG9PQ-TDT3BmHFfWg_BZz77c8k';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Données de base
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
  const [viewMode, setViewMode] = useState('month');
  const [weekOffset, setWeekOffset] = useState(0);

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

  const getWeekDays = () => {
    const today = new Date(currentDate);
    today.setDate(today.getDate() + weekOffset * 7);
    const first = today.getDate() - today.getDay() + 1;
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today.getFullYear(), today.getMonth(), first + i);
      weekDays.push(date);
    }
    return weekDays;
  };

  const getWeekLabel = () => {
    const days = getWeekDays();
    if (days.length === 0) return '';
    const start = days[0];
    const end = days[6];
    return `${start.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })} - ${end.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}`;
  };

  const weekDays = viewMode === 'week' ? getWeekDays() : [];

  const handleAddCharge = async (collaborateurId, clientId, date, heures, type = 'budgété', detail = '') => {
    const chargeDate = new Date(date);
    const newCharge = {
      collaborateur_id: collaborateurId,
      client_id: clientId,
      date_charge: `${chargeDate.getFullYear()}-${String(chargeDate.getMonth() + 1).padStart(2, '0')}-${String(chargeDate.getDate()).padStart(2, '0')}`,
      heures: parseFloat(heures),
      type: type,
      detail: detail,
      heures_realisees: 0
    };

    try {
      const { data, error } = await supabase.from('charges').insert([newCharge]).select();
      if (error) {
        const newChargeWithId = { id: Date.now(), ...newCharge };
        const updated = [...charges, newChargeWithId];
        setCharges(updated);
        localStorage.setItem('charges', JSON.stringify(updated));
      } else {
        const updated = [...charges, data[0]];
        setCharges(updated);
        localStorage.setItem('charges', JSON.stringify(updated));
      }
    } catch (err) {
      const newChargeWithId = { id: Date.now(), ...newCharge };
      const updated = [...charges, newChargeWithId];
      setCharges(updated);
      localStorage.setItem('charges', JSON.stringify(updated));
    }
    setShowAddModal(false);
  };

  const handleDeleteCharge = async (chargeId) => {
    try {
      await supabase.from('charges').delete().eq('id', chargeId);
      const updated = charges.filter(c => c.id !== chargeId);
      setCharges(updated);
      localStorage.setItem('charges', JSON.stringify(updated));
    } catch (err) {
      const updated = charges.filter(c => c.id !== chargeId);
      setCharges(updated);
      localStorage.setItem('charges', JSON.stringify(updated));
    }
  };

  const getChargesForDay = (collaborateurId, day) => {
    const targetDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return charges.filter(c => c.collaborateur_id === collaborateurId && c.date_charge === targetDate);
  };

  const getTotalHoursForDay = (collaborateurId, day) => {
    return getChargesForDay(collaborateurId, day).reduce((sum, c) => sum + c.heures, 0);
  };

  const getWeekTotal = (collaborateurId) => {
    return weekDays.reduce((sum, date) => {
      const dayTotal = charges.filter(c => c.collaborateur_id === collaborateurId && c.date_charge === date.toISOString().split('T')[0]).reduce((daySum, c) => daySum + c.heures, 0);
      return sum + dayTotal;
    }, 0);
  };

  const handleNavigateWeek = (direction) => {
    setWeekOffset(weekOffset + direction);
  };

  const exportToExcel = (startDate, endDate) => {
    const data = [];
    
    filteredCollaborateurs.forEach(collab => {
      const chargesForCollab = charges.filter(c => {
        const chargeDate = new Date(c.date_charge);
        return c.collaborateur_id === collab.id &&
               chargeDate >= startDate &&
               chargeDate <= endDate;
      });

      chargesForCollab.forEach(charge => {
        data.push({
          'Collaborateur': collab.nom,
          'Client': CLIENTS.find(cl => cl.id === charge.client_id)?.nom || '',
          'Date': new Date(charge.date_charge).toLocaleDateString('fr-FR'),
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
    
    const fileName = `Charges_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.xlsx`;
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
            <button onClick={() => viewMode === 'month' ? setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)) : handleNavigateWeek(-1)} className="p-2 hover:bg-slate-700 rounded-lg transition text-white">
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-xl font-semibold text-white min-w-48 text-center">
              {viewMode === 'month' 
                ? currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                : `Semaine du ${getWeekLabel()}`
              }
            </h2>
            <button onClick={() => viewMode === 'month' ? setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)) : handleNavigateWeek(1)} className="p-2 hover:bg-slate-700 rounded-lg transition text-white">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex gap-3">
            <select value={currentUser} onChange={(e) => setCurrentUser(parseInt(e.target.value))} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition">
              {COLLABORATEURS.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>

            <button onClick={() => { setViewMode(viewMode === 'month' ? 'week' : 'month'); setWeekOffset(0); }} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition">
              <Calendar size={18} />
              {viewMode === 'month' ? 'Semaine' : 'Mois'}
            </button>

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

        {showAddModal && <AddChargeModal clients={CLIENTS} collaborateurs={COLLABORATEURS} currentMonth={currentDate} onAdd={handleAddCharge} onClose={() => setShowAddModal(false)} />}

        {showExportModal && <ExportModal viewMode={viewMode} currentDate={currentDate} weekDays={weekDays} onExport={exportToExcel} onClose={() => setShowExportModal(false)} />}

        {viewMode === 'month' && (
          <div className="grid grid-cols-7 gap-1 mb-6 bg-slate-800 p-4 rounded-lg border border-slate-700">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => <div key={day} className="text-center text-slate-400 text-sm font-semibold py-2">{day}</div>)}
            {allDays.map((day, idx) => (
              <div key={idx} className="bg-slate-700 min-h-96 rounded-lg p-3 border border-slate-600 overflow-y-auto">
                {day && <>
                  <div className="text-white font-bold mb-3 text-lg">{day}</div>
                  <div className="space-y-2">
                    {filteredCollaborateurs.map(collab => {
                      const dayCharges = getChargesForDay(collab.id, day);
                      const totalHours = getTotalHoursForDay(collab.id, day);
                      return (
                        <div key={collab.id} className="bg-slate-600 rounded p-2 text-xs">
                          <div className="text-blue-300 font-semibold mb-1">{collab.nom}</div>
                          {dayCharges.length > 0 ? (
                            <div className="space-y-1">
                              {dayCharges.map(charge => (
                                <div key={charge.id} className="bg-slate-500 rounded p-1">
                                  <div className="flex items-center justify-between">
                                    <div><span className="text-slate-300 text-xs">{CLIENTS.find(c => c.id === charge.client_id)?.nom.substring(0, 8)}</span>
                                    <span className="ml-1 text-slate-400 text-xs">{charge.heures}h</span></div>
                                    <button onClick={() => handleDeleteCharge(charge.id)} className="hover:bg-red-600 p-0.5 rounded transition">
                                      <X size={12} />
                                    </button>
                                  </div>
                                  {charge.detail && <div className="text-slate-300 text-xs mt-1 italic">{charge.detail}</div>}
                                </div>
                              ))}
                            </div>
                          ) : <div className="text-slate-400 text-xs">-</div>}
                          {totalHours > 8 && <div className="mt-1 text-red-400 font-bold text-xs">⚠ {totalHours}h</div>}
                        </div>
                      );
                    })}
                  </div>
                </>}
              </div>
            ))}
          </div>
        )}

        {viewMode === 'week' && (
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 overflow-x-auto">
            <div className="min-w-full">
              <div className="flex gap-4 mb-4">
                <div className="w-32 flex-shrink-0"><div className="font-bold text-white text-sm">Collaborateur</div></div>
                {weekDays.map(date => <div key={date.toString()} className="flex-1 min-w-32"><div className="font-semibold text-white text-sm">{date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}</div></div>)}
                <div className="w-24 flex-shrink-0"><div className="font-bold text-green-300 text-sm">Total</div></div>
              </div>
              {filteredCollaborateurs.map(collab => (
                <div key={collab.id} className="flex gap-4 mb-4 bg-slate-700 p-3 rounded">
                  <div className="w-32 flex-shrink-0"><div className="text-blue-300 font-semibold text-sm">{collab.nom}</div></div>
                  {weekDays.map(date => {
                    const dateStr = date.toISOString().split('T')[0];
                    const dayCharges = charges.filter(c => c.collaborateur_id === collab.id && c.date_charge === dateStr);
                    const dayTotal = dayCharges.reduce((sum, c) => sum + c.heures, 0);
                    return (
                      <div key={dateStr} className="flex-1 min-w-32">
                        <div className={`text-sm font-semibold ${dayTotal > 8 ? 'text-red-400' : 'text-slate-300'}`}>{dayTotal > 0 ? `${dayTotal}h` : '-'}</div>
                        {dayCharges.map(charge => <div key={charge.id} className="text-xs text-slate-400 mt-1">{CLIENTS.find(c => c.id === charge.client_id)?.nom.substring(0, 6)}</div>)}
                      </div>
                    );
                  })}
                  <div className="w-24 flex-shrink-0"><div className={`text-sm font-bold ${getWeekTotal(collab.id) > 40 ? 'text-red-400' : 'text-green-300'}`}>{getWeekTotal(collab.id)}h</div></div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 mt-6">
          <p className="text-slate-400 text-sm">
            Charges affichées : {charges.length} | Collaborateurs : {filteredCollaborateurs.length} | Utilisateur : {COLLABORATEURS.find(c => c.id === currentUser)?.nom}
          </p>
          <p className="text-slate-500 text-xs mt-2">Développé par Audit Up | calendrier-zerah v2.0</p>
        </div>
      </div>
    </div>
  );
}

function AddChargeModal({ clients, collaborateurs, currentMonth, onAdd, onClose }) {
  const today = new Date();
  const defaultDate = today.toISOString().split('T')[0];

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
    const dateObj = new Date(formData.dateComplete);
    const day = dateObj.getDate();
    onAdd(parseInt(formData.collaborateurId), parseInt(formData.clientId), day, formData.heures, formData.type, formData.detail);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700 max-h-96 overflow-y-auto">
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

function ExportModal({ viewMode, currentDate, weekDays, onExport, onClose }) {
  const [startDate, setStartDate] = useState(() => {
    if (viewMode === 'month') {
      return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
    } else {
      return weekDays[0].toISOString().split('T')[0];
    }
  });

  const [endDate, setEndDate] = useState(() => {
    if (viewMode === 'month') {
      return new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];
    } else {
      return weekDays[6].toISOString().split('T')[0];
    }
  });

  const handleExport = () => {
    onExport(new Date(startDate), new Date(endDate));
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
