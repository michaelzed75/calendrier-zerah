// @ts-check
import React, { useState } from 'react';
import { X } from 'lucide-react';

/**
 * @typedef {import('../../types.js').Client} Client
 * @typedef {import('../../types.js').Collaborateur} Collaborateur
 * @typedef {import('../../types.js').Charge} Charge
 */

/**
 * @typedef {Object} EditChargeModalProps
 * @property {Charge} charge - La charge à modifier
 * @property {Client[]} clients - Liste des clients disponibles
 * @property {Collaborateur[]} collaborateurs - Liste des collaborateurs disponibles
 * @property {function(number, number, number, string, number, string, string): void} onUpdate - Callback de mise à jour
 * @property {function(): void} onClose - Callback de fermeture
 */

/**
 * Modal de modification d'une charge de travail existante
 * @param {EditChargeModalProps} props
 * @returns {JSX.Element}
 */
function EditChargeModal({ charge, clients, collaborateurs, onUpdate, onClose }) {
  if (!collaborateurs || collaborateurs.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">Modifier la charge</h3>
            <button onClick={onClose} className="text-white hover:text-white">
              <X size={24} />
            </button>
          </div>
          <p className="text-white">Veuillez sélectionner au moins un collaborateur dans le filtre.</p>
          <button onClick={onClose} className="mt-4 w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded transition">
            Fermer
          </button>
        </div>
      </div>
    );
  }

  // Trouver le client initial pour afficher son nom
  const initialClient = clients.find(c => c.id === charge.client_id);

  const [formData, setFormData] = useState({
    collaborateurId: charge.collaborateur_id,
    clientId: charge.client_id,
    dateComplete: charge.date_charge,
    heures: charge.heures,
    type: charge.type || 'budgété',
    detail: charge.detail || ''
  });

  const [clientSearch, setClientSearch] = useState(initialClient?.nom || '');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  // Clients triés et filtrés
  const sortedClients = [...clients].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const filteredClients = sortedClients.filter(c =>
    c.nom.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const handleClientSelect = (client) => {
    setFormData({ ...formData, clientId: client.id });
    setClientSearch(client.nom);
    setShowClientDropdown(false);
  };

  const handleCollaborateurChange = (newCollabId) => {
    setFormData({
      ...formData,
      collaborateurId: newCollabId
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
          <button onClick={onClose} className="text-white hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-1">Collaborateur</label>
            <select value={formData.collaborateurId} onChange={(e) => handleCollaborateurChange(e.target.value)} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600">
              {collaborateurs.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-white mb-1">Client</label>
            <input
              type="text"
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value);
                setFormData({ ...formData, clientId: '' });
                setShowClientDropdown(true);
              }}
              onFocus={() => setShowClientDropdown(true)}
              placeholder="Rechercher un client..."
              className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600"
            />
            {showClientDropdown && filteredClients.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-slate-700 border border-slate-600 rounded max-h-48 overflow-y-auto">
                {filteredClients.map(c => (
                  <div
                    key={c.id}
                    onClick={() => handleClientSelect(c)}
                    className="px-3 py-2 cursor-pointer hover:bg-slate-600 text-white"
                  >
                    {c.nom}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1">Date</label>
            <input type="date" value={formData.dateComplete} onChange={(e) => setFormData({ ...formData, dateComplete: e.target.value })} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1">Heures</label>
            <input type="number" step="0.5" min="0.5" value={formData.heures} onChange={(e) => setFormData({ ...formData, heures: e.target.value })} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1">Type</label>
            <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600">
              <option value="budgété">Budgété</option>
              <option value="réel">Réel</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1">Détail (optionnel)</label>
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

export default EditChargeModal;
