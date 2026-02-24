// @ts-check
import React, { useState, useMemo } from 'react';
import { X, Search, Check, AlertCircle, Link2, Plus, Trash2 } from 'lucide-react';

/**
 * Modal de mapping des dossiers Silae non reconnus vers les clients locaux.
 * Supporte jusqu'à 2 clients par dossier Silae (ex: SNC Christine → Relais Christine + Saint James).
 *
 * @param {Object} props
 * @param {import('../../utils/honoraires/silaeService.js').SilaeRow[]} props.unmatchedRows
 * @param {{row: import('../../utils/honoraires/silaeService.js').SilaeRow, client_id: number, client_nom: string}[]} [props.matchedRows]
 * @param {Object[]} props.clients
 * @param {function} props.onSave - Callback avec Map<codeSilae, number[]> (code → tableau de clientIds)
 * @param {function} props.onClose
 * @param {Object} props.accent
 */
function SilaeMappingModal({ unmatchedRows, matchedRows = [], clients, onSave, onClose, accent }) {
  // État : code_silae → [clientId, clientId?] (1 ou 2 clients)
  const [mappings, setMappings] = useState(() => {
    const initial = {};
    for (const row of unmatchedRows) {
      initial[row.code] = [];
    }
    return initial;
  });

  const [searchTerms, setSearchTerms] = useState(() => {
    const initial = {};
    for (const row of unmatchedRows) {
      initial[row.code] = '';
    }
    return initial;
  });

  const clientsActifs = useMemo(() =>
    clients
      .filter(c => c.actif)
      .sort((a, b) => a.nom.localeCompare(b.nom)),
    [clients]
  );

  const filterClients = (search, excludeIds = []) => {
    let list = clientsActifs;
    if (excludeIds.length > 0) {
      list = list.filter(c => !excludeIds.includes(c.id));
    }
    if (!search) return list;
    const s = search.toLowerCase();
    return list.filter(c =>
      c.nom.toLowerCase().includes(s) ||
      (c.siren && c.siren.includes(s)) ||
      (c.code_silae && c.code_silae.toLowerCase().includes(s)) ||
      (c.external_reference && c.external_reference.toLowerCase().includes(s))
    );
  };

  const addClientToMapping = (code, clientId) => {
    setMappings(prev => {
      const current = prev[code] || [];
      if (current.length >= 2 || current.includes(clientId)) return prev;
      return { ...prev, [code]: [...current, clientId] };
    });
    setSearchTerms(prev => ({ ...prev, [code]: '' }));
  };

  const removeClientFromMapping = (code, clientId) => {
    setMappings(prev => {
      const current = prev[code] || [];
      return { ...prev, [code]: current.filter(id => id !== clientId) };
    });
  };

  const handleSave = () => {
    const result = new Map();
    for (const [code, clientIds] of Object.entries(mappings)) {
      if (clientIds.length > 0) {
        result.set(code, clientIds);
      }
    }
    onSave(result);
  };

  const nbMapped = Object.values(mappings).filter(v => v.length > 0).length;
  const nbTotal = unmatchedRows.length;
  const nbMatched = matchedRows.length;

  /** Rendu des badges d'info pour un client */
  const ClientBadges = ({ client }) => (
    <div className="flex gap-1 flex-wrap">
      {client.siren && (
        <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
          SIREN: {client.siren}
        </span>
      )}
      {client.code_silae && (
        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-mono">
          Silae: {client.code_silae}
        </span>
      )}
      {client.external_reference && (
        <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded font-mono">
          Ref: {client.external_reference}
        </span>
      )}
      {client.pennylane_customer_id && (
        <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded">
          PL #{client.pennylane_customer_id}
        </span>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Mapping dossiers Silae</h2>
            <p className="text-sm text-gray-500">
              {nbMatched + nbTotal} dossier{(nbMatched + nbTotal) > 1 ? 's' : ''} — {nbMatched} reconnu{nbMatched > 1 ? 's' : ''} — {nbTotal} à mapper ({nbMapped} fait{nbMapped > 1 ? 's' : ''})
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        {/* Info */}
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-start gap-2">
          <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            Associez chaque dossier Silae à 1 ou 2 clients (ex: un dossier paye couvrant 2 établissements).
            Le mapping et le SIREN seront enregistrés. Les dossiers non mappés seront ignorés.
          </p>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">

          {/* === DOSSIERS NON RECONNUS === */}
          {nbTotal > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-red-200">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wide">
                  Non reconnus — à mapper ({nbTotal})
                </h3>
              </div>
              <div className="space-y-3">
                {unmatchedRows.map(row => {
                  const search = (searchTerms[row.code] || '').toLowerCase();
                  const selectedIds = mappings[row.code] || [];
                  const selectedClients = selectedIds.map(id => clientsActifs.find(c => c.id === id)).filter(Boolean);
                  const filteredClients = filterClients(search, selectedIds);
                  const canAddMore = selectedIds.length < 2;

                  return (
                    <div key={row.code} className="border-2 border-orange-300 rounded-lg p-3 bg-orange-50/30">
                      {/* Entête dossier Silae */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center flex-wrap gap-1">
                          <span className="font-bold text-black text-base">{row.nom}</span>
                          <span className="text-xs px-2 py-0.5 bg-gray-800 text-white rounded font-mono">
                            {row.code}
                          </span>
                          {row.siren && (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                              SIREN: {row.siren}
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-semibold text-black">
                          {row.bulletins} bulletin{row.bulletins > 1 ? 's' : ''}
                        </div>
                      </div>

                      {/* Clients sélectionnés */}
                      {selectedClients.length > 0 && (
                        <div className="space-y-1 mb-2">
                          {selectedClients.map((c, i) => (
                            <div key={c.id} className="flex items-center gap-2 bg-green-50 rounded p-2">
                              <Check size={14} className="text-green-600 flex-shrink-0" />
                              <span className="text-green-800 font-medium text-sm">{c.nom}</span>
                              <span className="text-xs text-gray-500">({c.cabinet || '-'})</span>
                              <ClientBadges client={c} />
                              <button
                                onClick={() => removeClientFromMapping(row.code, c.id)}
                                className="ml-auto p-1 text-red-400 hover:text-red-600"
                                title="Retirer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Recherche pour ajouter un client (si < 2) */}
                      {canAddMore && (
                        <div>
                          {selectedClients.length > 0 && (
                            <div className="flex items-center gap-1 mb-1">
                              <Plus size={12} className="text-gray-400" />
                              <span className="text-xs text-gray-400">Ajouter un 2e client (optionnel)</span>
                            </div>
                          )}
                          <div className="relative">
                            <Search size={14} className="absolute left-2 top-2.5 text-gray-400" />
                            <input
                              type="text"
                              value={searchTerms[row.code] || ''}
                              onChange={(e) => setSearchTerms(prev => ({ ...prev, [row.code]: e.target.value }))}
                              placeholder="Rechercher par nom, SIREN, code Silae ou ref Pennylane..."
                              className="w-full pl-7 pr-3 py-2 border-2 border-gray-300 rounded text-sm focus:border-blue-500 focus:outline-none"
                            />
                          </div>
                          {(search || searchTerms[row.code]) && (
                            <div className="mt-1 max-h-40 overflow-y-auto border rounded shadow-sm">
                              {filteredClients.length === 0 ? (
                                <p className="px-3 py-2 text-sm text-gray-400">Aucun client trouvé</p>
                              ) : (
                                filteredClients.slice(0, 15).map(c => (
                                  <button
                                    key={c.id}
                                    onClick={() => addClientToMapping(row.code, c.id)}
                                    className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b last:border-b-0"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium text-gray-900">{c.nom}</span>
                                      <span className="text-xs text-gray-400 ml-2">{c.cabinet || '-'}</span>
                                    </div>
                                    <ClientBadges client={c} />
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* === DOSSIERS DÉJÀ RECONNUS (grisés) === */}
          {nbMatched > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <h3 className="font-medium text-gray-400 text-sm uppercase tracking-wide">
                  Déjà reconnus ({nbMatched})
                </h3>
              </div>
              <div className="space-y-1">
                {matchedRows.map(({ row, client_id, client_nom }) => {
                  const client = clientsActifs.find(c => c.id === client_id);
                  return (
                    <div key={`${row.code}-${client_id}`} className="rounded-lg px-3 py-2 bg-gray-50 border border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-gray-400 text-sm">{row.nom}</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-400 font-mono">
                            {row.code}
                          </span>
                          {row.siren && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">
                              {row.siren}
                            </span>
                          )}
                          <Link2 size={12} className="text-gray-300" />
                          <span className="text-gray-500 text-sm font-medium">{client_nom}</span>
                          {client?.code_silae && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded font-mono">
                              Silae: {client.code_silae}
                            </span>
                          )}
                          {client?.siren && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">
                              SIREN: {client.siren}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {row.bulletins} bull.
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t bg-gray-50">
          <p className="text-sm text-gray-500">
            {nbTotal - nbMapped > 0
              ? `${nbTotal - nbMapped} dossier${(nbTotal - nbMapped) > 1 ? 's' : ''} sera ignoré${(nbTotal - nbMapped) > 1 ? 's' : ''}`
              : 'Tous les dossiers sont mappés'
            }
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-100"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              style={{ backgroundColor: '#2563eb' }}
              className="px-4 py-2 text-white rounded-lg hover:opacity-90"
            >
              Enregistrer ({nbMapped} mapping{nbMapped > 1 ? 's' : ''})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SilaeMappingModal;
