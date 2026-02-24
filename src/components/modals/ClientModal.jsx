// @ts-check
import React, { useState } from 'react';
import { X, Building2, User } from 'lucide-react';

/**
 * @typedef {import('../../types.js').Client} Client
 */

/**
 * @typedef {Object} ClientModalProps
 * @property {Client|null} [client] - Client à éditer (null pour création)
 * @property {function(Object): void} onSave - Callback de sauvegarde
 * @property {function(): void} onClose - Callback de fermeture
 */

/**
 * Modal d'ajout/modification d'un client
 * Champs obligatoires : nom, type_personne (PP/PM)
 * RÈGLE MÉTIER : si SIREN renseigné → TOUJOURS PM (un SIREN = une personne morale)
 * Si PM : SIREN obligatoire (9 chiffres)
 * Optionnel : siret_complement (5 chiffres NIC), code_pennylane
 * @param {ClientModalProps} props
 * @returns {JSX.Element}
 */
function ClientModal({ client, onSave, onClose }) {
  const [nom, setNom] = useState(client?.nom || '');
  const [typePersonne, setTypePersonne] = useState(client?.type_personne || '');
  const [siren, setSiren] = useState(client?.siren || '');
  const [siretComplement, setSiretComplement] = useState(client?.siret_complement || '');
  const [codePennylane, setCodePennylane] = useState(client?.code_pennylane || '');
  const [errors, setErrors] = useState({});

  // RÈGLE MÉTIER : SIREN/SIRET renseigné → force PM automatiquement
  const handleSirenChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 9);
    setSiren(val);
    if (val.length > 0) {
      setTypePersonne('PM');
    }
  };

  const handleSiretComplementChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 5);
    setSiretComplement(val);
    if (val.length > 0) {
      setTypePersonne('PM');
    }
  };

  const validate = () => {
    const errs = {};

    if (!nom.trim()) {
      errs.nom = 'Le nom est obligatoire';
    }

    // Si SIREN renseigné → forcer PM (un SIREN = toujours une PM)
    const effectiveType = siren.trim() ? 'PM' : typePersonne;

    if (!effectiveType) {
      errs.typePersonne = 'Sélectionnez PM ou PP';
    }

    if (effectiveType === 'PM') {
      if (!siren.trim()) {
        errs.siren = 'Le SIREN est obligatoire pour une Personne Morale';
      } else if (!/^\d{9}$/.test(siren.trim())) {
        errs.siren = 'Le SIREN doit contenir exactement 9 chiffres';
      }
    }

    if (siretComplement.trim() && !/^\d{5}$/.test(siretComplement.trim())) {
      errs.siretComplement = 'Le complément SIRET (NIC) doit contenir exactement 5 chiffres';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    // Si SIREN renseigné → toujours PM
    const effectiveType = siren.trim() ? 'PM' : typePersonne;

    onSave({
      nom: nom.trim(),
      type_personne: effectiveType,
      siren: siren.trim() || null,
      siret_complement: siretComplement.trim() || null,
      code_pennylane: codePennylane.trim() || null,
    });
  };

  const inputClass = (field) =>
    `w-full bg-slate-700 text-white rounded px-3 py-2 border ${
      errors[field] ? 'border-red-500' : 'border-slate-600'
    } focus:outline-none focus:border-blue-500`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg p-6 max-w-lg w-full border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">
            {client ? 'Modifier le client' : 'Ajouter un client'}
          </h3>
          <button onClick={onClose} className="text-white hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Personne - PM ou PP */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">Type *</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTypePersonne('PM')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition font-medium ${
                  typePersonne === 'PM'
                    ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                    : 'border-slate-600 bg-slate-700 text-white hover:border-slate-500'
                }`}
              >
                <Building2 size={20} />
                <div className="text-left">
                  <div className="font-semibold">PM</div>
                  <div className="text-xs opacity-75">Personne Morale</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { if (!siren.trim()) setTypePersonne('PP'); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition font-medium ${
                  typePersonne === 'PP'
                    ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                    : siren.trim()
                      ? 'border-slate-700 bg-slate-800 text-white cursor-not-allowed'
                      : 'border-slate-600 bg-slate-700 text-white hover:border-slate-500'
                }`}
                disabled={!!siren.trim()}
                title={siren.trim() ? 'SIREN renseigné → obligatoirement PM' : ''}
              >
                <User size={20} />
                <div className="text-left">
                  <div className="font-semibold">PP</div>
                  <div className="text-xs opacity-75">Personne Physique</div>
                </div>
              </button>
            </div>
            {errors.typePersonne && <p className="text-red-400 text-xs mt-1">{errors.typePersonne}</p>}
          </div>

          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">Nom *</label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Nom du client"
              className={inputClass('nom')}
            />
            {errors.nom && <p className="text-red-400 text-xs mt-1">{errors.nom}</p>}
          </div>

          {/* SIREN */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              SIREN {typePersonne === 'PM' ? '*' : ''}
            </label>
            <input
              type="text"
              value={siren}
              onChange={handleSirenChange}
              placeholder="9 chiffres"
              maxLength={9}
              className={inputClass('siren')}
            />
            {errors.siren && <p className="text-red-400 text-xs mt-1">{errors.siren}</p>}
            {siren.trim() && typePersonne !== 'PM' && (
              <p className="text-blue-400 text-xs mt-1">SIREN renseigné → type forcé en PM</p>
            )}
            {typePersonne === 'PP' && !siren.trim() && (
              <p className="text-white text-xs mt-1">Facultatif pour les personnes physiques</p>
            )}
          </div>

          {/* SIRET Complement (NIC) */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">
              Complément SIRET (NIC)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-white text-sm font-mono">{siren || '?????????'}</span>
              <input
                type="text"
                value={siretComplement}
                onChange={handleSiretComplementChange}
                placeholder="00000"
                maxLength={5}
                className={`w-24 bg-slate-700 text-white rounded px-3 py-2 border ${
                  errors.siretComplement ? 'border-red-500' : 'border-slate-600'
                } focus:outline-none focus:border-blue-500 font-mono`}
              />
            </div>
            {errors.siretComplement && <p className="text-red-400 text-xs mt-1">{errors.siretComplement}</p>}
            <p className="text-white text-xs mt-1">Facultatif — 5 chiffres NIC pour différencier les établissements</p>
          </div>

          {/* Code Pennylane */}
          <div>
            <label className="block text-sm font-medium text-white mb-1">Code Pennylane</label>
            <input
              type="text"
              value={codePennylane}
              onChange={(e) => setCodePennylane(e.target.value)}
              placeholder="Pour future intégration API"
              className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:outline-none focus:border-blue-500"
            />
            <p className="text-white text-xs mt-1">Optionnel</p>
          </div>

          {/* Email (lecture seule, synchronisé depuis Pennylane) */}
          {client && client.email && (
            <div>
              <label className="block text-sm font-medium text-white mb-1">Email (Pennylane)</label>
              <div className="w-full bg-slate-700/50 text-white rounded px-3 py-2 border border-slate-600">
                {client.email}
              </div>
              <p className="text-white text-xs mt-1">Synchronisé depuis Pennylane (lecture seule)</p>
            </div>
          )}

          {/* SIRET calculé */}
          {siren && siretComplement && (
            <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
              <span className="text-white text-sm">SIRET complet : </span>
              <span className="text-white font-mono font-semibold">{siren}{siretComplement}</span>
            </div>
          )}

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
