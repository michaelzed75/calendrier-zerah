// @ts-check
import React, { useState } from 'react';
import { X } from 'lucide-react';

/**
 * @typedef {import('../../types.js').Client} Client
 * @typedef {import('../../types.js').Charge} Charge
 */

/**
 * @typedef {Object} MergeClientModalProps
 * @property {Client} sourceClient - Client source à fusionner (sera supprimé)
 * @property {Client[]} clients - Liste de tous les clients
 * @property {Charge[]} charges - Liste des charges (pour compter celles du client source)
 * @property {function(number, number): void} onMerge - Callback de fusion (sourceId, targetId)
 * @property {function(): void} onClose - Callback de fermeture
 */

/**
 * Modal de fusion de clients (transfert de TOUTES les données vers un autre client)
 * Transfère : charges, abonnements, honoraires_historique, effectifs_silae,
 * silae_productions, fournisseurs_releve. Supprime : silae_mapping, tests_comptables.
 * @param {MergeClientModalProps} props
 * @returns {JSX.Element}
 */
function MergeClientModal({ sourceClient, clients, charges, onMerge, onClose }) {
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Clients disponibles pour la fusion (actifs, différents du source)
  const pennylaneClients = clients.filter(c =>
    c.actif && c.id !== sourceClient.id
  );

  const filteredClients = [...pennylaneClients]
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    .filter(c => c.nom.toLowerCase().includes(searchTerm.toLowerCase()));

  // Compter les charges du client source
  const sourceChargesCount = charges.filter(c => c.client_id === sourceClient.id).length;

  const handleMerge = () => {
    if (!selectedTargetId) {
      alert('Veuillez sélectionner un client cible');
      return;
    }
    const targetClient = clients.find(c => c.id === parseInt(selectedTargetId));
    if (confirm(
      `Fusionner "${sourceClient.nom}" vers "${targetClient.nom}" ?\n\n` +
      `Toutes les données liées (charges, abonnements, productions Silae, historique...) seront transférées.\n` +
      `Le client "${sourceClient.nom}" sera supprimé définitivement.`
    )) {
      onMerge(sourceClient.id, parseInt(selectedTargetId));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg p-6 max-w-lg w-full border border-slate-700 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Fusionner le client</h3>
          <button onClick={onClose} className="text-white hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4 mb-4">
          <p className="text-sm text-white mb-1">Client source (sera supprimé)</p>
          <p className="text-white font-medium">{sourceClient.nom}</p>
          {sourceChargesCount > 0 && (
            <p className="text-orange-400 text-sm mt-2">
              {sourceChargesCount} charge(s) seront transférées
            </p>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-white mb-2">
            Fusionner vers (client cible)
          </label>
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 mb-2"
          />
          <div className="max-h-60 overflow-y-auto space-y-1">
            {filteredClients.map(client => (
              <div
                key={client.id}
                onClick={() => setSelectedTargetId(String(client.id))}
                className={`p-3 rounded cursor-pointer transition ${
                  selectedTargetId === String(client.id)
                    ? 'bg-orange-600/30 border border-orange-500'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                <div className="text-white">{client.nom}</div>
                <div className="text-xs text-white flex gap-2 mt-1">
                  <span className={`px-1.5 py-0.5 rounded ${
                    client.cabinet === 'Audit Up' ? 'bg-purple-600/30 text-purple-300' : 'bg-blue-600/30 text-blue-300'
                  }`}>
                    {client.cabinet}
                  </span>
                  {client.code_pennylane && <span>{client.code_pennylane}</span>}
                </div>
              </div>
            ))}
            {filteredClients.length === 0 && (
              <p className="text-white text-center py-4">Aucun client trouvé</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded transition"
          >
            Annuler
          </button>
          <button
            onClick={handleMerge}
            disabled={!selectedTargetId}
            className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-2 rounded transition"
          >
            Fusionner
          </button>
        </div>
      </div>
    </div>
  );
}

export default MergeClientModal;
