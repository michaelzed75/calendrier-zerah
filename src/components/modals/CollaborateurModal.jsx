// @ts-check
import React, { useState } from 'react';
import { X } from 'lucide-react';

/**
 * @typedef {import('../../types.js').Collaborateur} Collaborateur
 * @typedef {import('../../types.js').CollaborateurChef} CollaborateurChef
 */

/**
 * @typedef {Object} CollaborateurModalProps
 * @property {Collaborateur|null} [collaborateur] - Collaborateur à éditer (null pour création)
 * @property {Collaborateur[]} chefsMission - Liste des chefs de mission disponibles
 * @property {CollaborateurChef[]} collaborateurChefs - Liaisons existantes
 * @property {function(string, boolean, number[]): void} onSave - Callback de sauvegarde
 * @property {function(): void} onClose - Callback de fermeture
 */

/**
 * Modal d'ajout/modification d'un collaborateur
 * @param {CollaborateurModalProps} props
 * @returns {JSX.Element}
 */
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

export default CollaborateurModal;
