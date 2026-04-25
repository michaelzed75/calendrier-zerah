// @ts-check
import React, { useState, useEffect } from 'react';
import { X, Lock, Eye, Edit3, Trash2, Loader2, CheckCircle, AlertCircle, Shield, ShieldAlert } from 'lucide-react';
import { supabase } from '../../supabaseClient';

/**
 * Modal de gestion des clés API Pennylane (Vault) pour un client.
 * Gère 2 clés par client : read (lecture seule) et write (lecture + écriture).
 *
 * Sécurité : les clés ne sont JAMAIS lues depuis le frontend après saisie.
 * Le backend (endpoint /api/pennylane-key) ne retourne que des métadonnées
 * (statut existant ou non, label, date de mise à jour).
 *
 * @param {Object} props
 * @param {{ id: number, nom: string, cabinet?: string }} props.client
 * @param {() => void} props.onClose
 * @param {() => void} [props.onUpdate] - Callback appelé après set/delete
 */
export default function PennylaneKeysModal({ client, onClose, onUpdate }) {
  const [readStatus, setReadStatus] = useState(/** @type {{loading: boolean, has: boolean, label?: string, updated_at?: string}} */ ({ loading: true, has: false }));
  const [writeStatus, setWriteStatus] = useState(/** @type {{loading: boolean, has: boolean, label?: string, updated_at?: string}} */ ({ loading: true, has: false }));
  const [editingScope, setEditingScope] = useState(/** @type {null | 'read' | 'write'} */ (null));
  const [keyInput, setKeyInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(/** @type {null | 'read' | 'write'} */ (null));
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(/** @type {null | { scope: 'read' | 'write', message: string }} */ (null));

  /**
   * Appelle l'endpoint /api/pennylane-key avec le JWT du user.
   */
  const callApi = async (body) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Session expirée — reconnectez-vous');
    }

    const response = await fetch('/api/pennylane-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Erreur HTTP ${response.status}`);
    }
    return data;
  };

  /**
   * Charge le statut des deux clés (read + write).
   */
  const loadStatuses = async () => {
    try {
      const [readRes, writeRes] = await Promise.all([
        callApi({ action: 'has', client_id: client.id, scope: 'read' }),
        callApi({ action: 'has', client_id: client.id, scope: 'write' })
      ]);
      setReadStatus({ loading: false, has: readRes.has, label: readRes.label, updated_at: readRes.updated_at });
      setWriteStatus({ loading: false, has: writeRes.has, label: writeRes.label, updated_at: writeRes.updated_at });
    } catch (err) {
      setError(err.message);
      setReadStatus(prev => ({ ...prev, loading: false }));
      setWriteStatus(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    loadStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  const startEditing = (scope) => {
    setEditingScope(scope);
    setKeyInput('');
    const existing = scope === 'read' ? readStatus : writeStatus;
    setLabelInput(existing.label || `Clé ${scope} ${client.nom}`);
    setError('');
    setFeedback(null);
  };

  const cancelEditing = () => {
    setEditingScope(null);
    setKeyInput('');
    setLabelInput('');
    setError('');
  };

  const saveKey = async () => {
    if (!editingScope) return;
    if (!keyInput.trim() || keyInput.trim().length < 10) {
      setError('Clé API invalide (au moins 10 caractères)');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await callApi({
        action: 'set',
        client_id: client.id,
        scope: editingScope,
        api_key: keyInput.trim(),
        label: labelInput.trim() || null
      });
      setFeedback({ scope: editingScope, message: 'Clé enregistrée ✅' });
      setEditingScope(null);
      setKeyInput('');
      setLabelInput('');
      await loadStatuses();
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  const deleteKey = async (scope) => {
    if (!confirm(`Supprimer la clé ${scope} de ${client.nom} ? Cette action est irréversible.`)) return;
    setDeleting(scope);
    setError('');
    try {
      await callApi({ action: 'delete', client_id: client.id, scope });
      setFeedback({ scope, message: 'Clé supprimée 🗑️' });
      await loadStatuses();
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err.message);
    }
    setDeleting(null);
  };

  /**
   * Rendu d'une section (read ou write).
   */
  const renderSection = (scope) => {
    const status = scope === 'read' ? readStatus : writeStatus;
    const isEditing = editingScope === scope;
    const isDeleting = deleting === scope;
    const showFeedback = feedback?.scope === scope;
    const Icon = scope === 'read' ? Eye : Edit3;
    const label = scope === 'read' ? 'Clé lecture seule' : 'Clé lecture + écriture';
    const description = scope === 'read'
      ? 'Pour les opérations sans risque (consultation FEC, factures, etc.)'
      : 'Pour les opérations sensibles (création factures, lettrage, etc.)';
    const colorClasses = scope === 'read'
      ? 'border-blue-800 bg-blue-900/20'
      : 'border-orange-800 bg-orange-900/20';
    const iconColorClass = scope === 'read' ? 'text-blue-400' : 'text-orange-400';

    return (
      <div className={`border rounded-lg p-4 ${colorClasses}`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3">
            <Icon size={20} className={`mt-0.5 ${iconColorClass}`} />
            <div>
              <div className="font-semibold text-white">{label}</div>
              <div className="text-sm text-white opacity-75">{description}</div>
            </div>
          </div>
          {status.loading ? (
            <Loader2 size={20} className="text-white animate-spin" />
          ) : status.has ? (
            <span className="bg-green-900/50 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
              <CheckCircle size={14} /> Configurée
            </span>
          ) : (
            <span className="bg-slate-700 text-white px-2 py-1 rounded text-xs">
              Non configurée
            </span>
          )}
        </div>

        {/* Métadonnées si la clé existe */}
        {!status.loading && status.has && !isEditing && (
          <div className="text-sm text-white opacity-75 mb-3 ml-8 space-y-0.5">
            {status.label && <div>Label : {status.label}</div>}
            {status.updated_at && (
              <div>Dernière maj : {new Date(status.updated_at).toLocaleString('fr-FR')}</div>
            )}
          </div>
        )}

        {/* Feedback succès */}
        {showFeedback && (
          <div className="bg-green-900/30 border border-green-800 text-white text-sm px-3 py-2 rounded mb-3">
            {feedback.message}
          </div>
        )}

        {/* Mode édition */}
        {isEditing ? (
          <div className="space-y-3 ml-8">
            <div>
              <label className="block text-sm text-white mb-1">Clé API Pennylane</label>
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Coller la clé..."
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm font-mono"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm text-white mb-1">Label (optionnel)</label>
              <input
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                placeholder="Ex: Clé read calendrier"
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveKey}
                disabled={saving}
                className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Enregistrer
              </button>
              <button
                onClick={cancelEditing}
                disabled={saving}
                className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded text-sm"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          /* Boutons d'action */
          <div className="flex gap-2 ml-8">
            <button
              onClick={() => startEditing(scope)}
              disabled={status.loading}
              className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {status.has ? <Edit3 size={14} /> : <Lock size={14} />}
              {status.has ? 'Modifier' : 'Configurer'}
            </button>
            {status.has && (
              <button
                onClick={() => deleteKey(scope)}
                disabled={isDeleting}
                className="bg-red-900/40 hover:bg-red-900/60 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Supprimer
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800/90 border border-slate-700 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="text-cyan-400" size={24} />
              <h2 className="text-xl font-bold text-white">Clés API Pennylane (Vault)</h2>
            </div>
            <div className="text-sm text-white opacity-75">
              {client.nom}
              {client.cabinet && <span className="opacity-50"> — {client.cabinet}</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:bg-slate-700 p-1 rounded">
            <X size={20} />
          </button>
        </div>

        {/* Bandeau d'info sécurité */}
        <div className="bg-cyan-900/20 border border-cyan-800 rounded p-3 mb-5 text-sm text-white">
          <div className="flex items-start gap-2">
            <ShieldAlert size={16} className="text-cyan-400 mt-0.5 flex-shrink-0" />
            <div>
              Les clés sont stockées chiffrées dans <strong>Supabase Vault</strong>.
              Une fois enregistrée, une clé n'est <strong>plus jamais affichée</strong> ici —
              seuls les serveurs (API serverless, MCP) peuvent la lire pour appeler Pennylane.
              Pour modifier une clé, écrasez-la avec une nouvelle valeur.
            </div>
          </div>
        </div>

        {/* Erreur globale */}
        {error && (
          <div className="bg-red-900/30 border border-red-800 text-white text-sm px-3 py-2 rounded mb-4 flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-400" />
            <div>{error}</div>
          </div>
        )}

        {/* Sections read + write */}
        <div className="space-y-4">
          {renderSection('read')}
          {renderSection('write')}
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-sm"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
