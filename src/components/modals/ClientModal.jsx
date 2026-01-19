// @ts-check
import React, { useState } from 'react';
import { X } from 'lucide-react';

/**
 * @typedef {import('../../types.js').Client} Client
 */

/**
 * @typedef {Object} ClientModalProps
 * @property {Client|null} [client] - Client à éditer (null pour création)
 * @property {function(string, string): void} onSave - Callback de sauvegarde (nom, codePennylane)
 * @property {function(): void} onClose - Callback de fermeture
 */

/**
 * Modal d'ajout/modification d'un client
 * @param {ClientModalProps} props
 * @returns {JSX.Element}
 */
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

export default ClientModal;
