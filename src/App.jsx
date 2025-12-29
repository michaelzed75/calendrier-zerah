import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Filter } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Initialiser Supabase
const SUPABASE_URL = 'https://anrvvsfvejnmdouxjfxj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_BxHx7EG9PQ-TDT3BmHFfWg_BZz77c8k';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Données de base
const COLLABORATEURS = [
  { id: 1, nom: 'Michaël Z', role: 'manager', supervise: 'tous' },
  { id: 2, nom: 'Delphine Z', role: 'autonome' },
  { id: 3, nom: 'Thérèse D', role: 'manager', supervise: ['Danny'] },
  { id: 4, nom: 'Benoît O', role: 'autonome' },
  { id: 5, nom: 'Danny', role: 'employee', superviseBy: 'Thérèse D' },
  { id: 6, nom: 'Jeremy Z', role: 'manager', supervise: ['Camille', 'Anny'] },
  { id: 7, nom: 'Anny', role: 'employee', superviseBy: 'Jeremy Z' },
  { id: 8, nom: 'Camille', role: 'employee', superviseBy: 'Jeremy Z' }
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
  const [currentDate, setCurrentDate] = useState(new Date(2025, 0, 1));
  const [charges, setCharges] = useState([]);
  const [filteredCollaborateurs, setFilteredCollaborateurs] = useState(COLLABORATEURS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedCollaborateurs, setSelectedCollaborateurs] = useState(
    COLLABORATEURS.map(c => c.id)
  );
  const [loading, setLoading] = useState(true);

  // Charger les données depuis Supabase au montage
  useEffect(() => {
    loadCharges();
  }, []);

  // Charger les charges depuis Supabase
  const loadCharges = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('charges')
        .select('*');
      
      if (error) {
        console.log('Supabase pas encore configuré, utilisation des données locales');
        setCharges([]);
      } else {
        setCharges(data || []);
      }
    } catch (err) {
      console.log('Supabase non disponible, utilisation des données locales');
      setCharges([]);
    } finally {
      setLoading(false);
    }
  };

  // Récupérer le nombre de jours du mois
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Jours vides avant le début du mois
  const emptyDays = Array.from({ length: firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1 }, (_, i) => null);

  const allDays = [...emptyDays, ...monthDays];

  // Mettre à jour les collaborateurs filtrés
  useEffect(() => {
    const filtered = COLLABORATEURS.filter(c => selectedCollaborateurs.includes(c.id));
    setFilteredCollaborateurs(filtered);
  }, [selectedCollaborateurs]);

  // Ajouter une charge
  const handleAddCharge = async (collaborateurId, clientId, date, heures, type = 'budgété') => {
    const newCharge = {
      collaborateur_id: collaborateurId,
      client_id: clientId,
      date_charge: new Date(currentDate.getFullYear(), currentDate.getMonth(), date).toISOString().split('T')[0],
      heures: parseFloat(heures),
      type: type
    };

    try {
      const { data, error } = await supabase
        .from('charges')
        .insert([newCharge])
        .select();

      if (error) {
        // Supabase non configuré, ajout local
        console.log('Ajout local (Supabase non configuré)');
        setCharges([...charges, { id: Date.now(), ...newCharge }]);
      } else {
        setCharges([...charges, data[0]]);
      }
    } catch (err) {
      // Fallback local
      setCharges([...charges, { id: Date.now(), ...newCharge }]);
    }

    setShowAddModal(false);
  };

  // Supprimer une charge
  const handleDeleteCharge = async (chargeId) => {
    try {
      await supabase
        .from('charges')
        .delete()
        .eq('id', chargeId);

      setCharges(charges.filter(c => c.id !== chargeId));
    } catch (err) {
      // Fallback local
      setCharges(charges.filter(c => c.id !== chargeId));
    }
  };

  // Obtenir les charges d'un collaborateur pour un jour
  const getChargesForDay = (collaborateurId, day) => {
    const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      .toISOString()
      .split('T')[0];

    return charges.filter(c => 
      c.collaborateur_id === collaborateurId &&
      c.date_charge === targetDate
    );
  };

  // Obtenir le total d'heures par jour pour un collaborateur
  const getTotalHoursForDay = (collaborateurId, day) => {
    const dayCharges = getChargesForDay(collaborateurId, day);
    return dayCharges.reduce((sum, c) => sum + c.heures, 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Calendrier d'équipe</h1>
          <p className="text-slate-400">Gestion des charges de travail par collaborateur</p>
        </div>

        {/* Navigation & Controls */}
        <div className="bg-slate-800 rounded-lg p-4 mb-6 border border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
              className="p-2 hover:bg-slate-700 rounded-lg transition text-white"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-xl font-semibold text-white min-w-48 text-center">
              {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </h2>
            <button
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
              className="p-2 hover:bg-slate-700 rounded-lg transition text-white"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowFilterModal(!showFilterModal)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
            >
              <Filter size={18} />
              Filtrer
            </button>
            <button
              onClick={() => setShowAddModal(!showAddModal)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
            >
              <Plus size={18} />
              Ajouter
            </button>
          </div>
        </div>

        {/* Filter Modal */}
        {showFilterModal && (
          <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Filtrer par collaborateur</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {COLLABORATEURS.map(collab => (
                <label key={collab.id} className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={selectedCollaborateurs.includes(collab.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCollaborateurs([...selectedCollaborateurs, collab.id]);
                      } else {
                        setSelectedCollaborateurs(selectedCollaborateurs.filter(id => id !== collab.id));
                      }
                    }}
                    className="rounded"
                  />
                  {collab.nom}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Add Modal */}
        {showAddModal && (
          <AddChargeModal
            clients={CLIENTS}
            collaborateurs={COLLABORATEURS}
            currentMonth={currentDate}
            onAdd={handleAddCharge}
            onClose={() => setShowAddModal(false)}
          />
        )}

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 mb-6 bg-slate-800 p-4 rounded-lg border border-slate-700">
          {/* Header jours semaine */}
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
            <div key={day} className="text-center text-slate-400 text-sm font-semibold py-2">
              {day}
            </div>
          ))}

          {/* Cases jours */}
          {allDays.map((day, idx) => (
            <div
              key={idx}
              className="bg-slate-700 min-h-96 rounded-lg p-3 border border-slate-600 overflow-y-auto"
            >
              {day && (
                <>
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
                                <div
                                  key={charge.id}
                                  className="bg-slate-500 rounded p-1 flex items-center justify-between text-slate-200"
                                >
                                  <div className="flex-1">
                                    <span className="text-slate-300">
                                      {CLIENTS.find(c => c.id === charge.client_id)?.nom.substring(0, 8)}
                                    </span>
                                    <span className="ml-1 text-slate-400">{charge.heures}h</span>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteCharge(charge.id)}
                                    className="hover:bg-red-600 p-0.5 rounded transition"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-slate-400 text-xs">-</div>
                          )}
                          {totalHours > 8 && (
                            <div className="mt-1 text-red-400 font-bold text-xs">⚠ {totalHours}h</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Stats Footer */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">
            Charges affichées : {charges.length} | Collaborateurs : {filteredCollaborateurs.length}
          </p>
        </div>
      </div>
    </div>
  );
}

// Composant Modal pour ajouter une charge
function AddChargeModal({ clients, collaborateurs, currentMonth, onAdd, onClose }) {
  const [formData, setFormData] = useState({
    collaborateurId: collaborateurs[0]?.id,
    clientId: clients[0]?.id,
    date: 1,
    heures: 1,
    type: 'budgété'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd(
      parseInt(formData.collaborateurId),
      parseInt(formData.clientId),
      parseInt(formData.date),
      formData.heures,
      formData.type
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Ajouter une charge</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Collaborateur</label>
            <select
              value={formData.collaborateurId}
              onChange={(e) => setFormData({ ...formData, collaborateurId: e.target.value })}
              className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600"
            >
              {collaborateurs.map(c => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Client</label>
            <select
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
              className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600"
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Jour du mois</label>
              <input
                type="number"
                min="1"
                max="31"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Heures</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={formData.heures}
                onChange={(e) => setFormData({ ...formData, heures: e.target.value })}
                className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600"
            >
              <option value="budgété">Budgété</option>
              <option value="réel">Réel</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded transition"
          >
            Ajouter
          </button>
        </form>
      </div>
    </div>
  );
}
