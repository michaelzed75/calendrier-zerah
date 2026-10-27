// @ts-check
import React, { useState, useEffect } from 'react';
import { X, Lock, Edit3, Trash2, Loader2, CheckCircle, AlertCircle, Shield, ShieldAlert } from 'lucide-react';
import { supabase } from '../../supabaseClient';

/**
 * @typedef {'client_id' | 'client_secret' | 'subscription_key'} ChampSilae
 */

/** @type {{ champ: ChampSilae, label: string, description: string }[]} */
const CHAMPS = [
  { champ: 'client_id', label: 'Client ID', description: 'Identifiant de l’application OAuth2 Silae' },
  { champ: 'client_secret', label: 'Client Secret', description: 'Secret OAuth2 associé au Client ID' },
  { champ: 'subscription_key', label: 'Subscription Key', description: 'En-tête Ocp-Apim-Subscription-Key' }
];

/**
 * Modal de gestion des identifiants de l'API Silae Paie (Vault).
 * 3 secrets : client_id, client_secret, subscription_key (migration 023).
 *
 * Sécurité : les fonctions SQL ne répondent qu'à un collaborateur administrateur
 * connecté (JWT de la session). Le site ne relit jamais les valeurs : seul l'état
 * (configuré ou non, date) est affiché. L'extension Claude « Silae Paie API » les
 * lit dans le Vault avec le compte du site de l'utilisateur.
 *
 * @param {Object} props
 * @param {() => void} props.onClose
 */
export default function SilaeKeysModal({ onClose }) {
  const [etat, setEtat] = useState(/** @type {Record<string, {configure: boolean, mis_a_jour_le: string|null}>} */ ({}));
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [valeurs, setValeurs] = useState(/** @type {Record<ChampSilae, string>} */ ({ client_id: '', client_secret: '', subscription_key: '' }));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const loadEtat = async () => {
    setLoading(true);
    const { data, error: rpcErr } = await supabase.rpc('etat_identifiants_silae_admin');
    if (rpcErr) {
      setError(messageErreur(rpcErr));
    } else {
      /** @type {Record<string, {configure: boolean, mis_a_jour_le: string|null}>} */
      const parChamp = {};
      for (const ligne of data || []) {
        parChamp[ligne.champ] = { configure: ligne.configure, mis_a_jour_le: ligne.mis_a_jour_le };
      }
      setEtat(parChamp);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadEtat();
  }, []);

  const toutConfigure = CHAMPS.every(c => etat[c.champ]?.configure);
  const aucunConfigure = CHAMPS.every(c => !etat[c.champ]?.configure);

  const startEditing = () => {
    setEditing(true);
    setValeurs({ client_id: '', client_secret: '', subscription_key: '' });
    setError('');
    setFeedback('');
  };

  const cancelEditing = () => {
    setEditing(false);
    setValeurs({ client_id: '', client_secret: '', subscription_key: '' });
    setError('');
  };

  const save = async () => {
    const saisis = CHAMPS.filter(c => valeurs[c.champ].trim());
    if (saisis.length === 0) {
      setError('Saisissez au moins un identifiant');
      return;
    }
    const manquants = CHAMPS.filter(c => !etat[c.champ]?.configure && !valeurs[c.champ].trim());
    if (manquants.length > 0) {
      setError(`Identifiant(s) encore absent(s) du Vault : ${manquants.map(c => c.label).join(', ')}`);
      return;
    }
    setSaving(true);
    setError('');
    const { error: rpcErr } = await supabase.rpc('set_identifiants_silae_admin', {
      p_client_id: valeurs.client_id.trim() || null,
      p_client_secret: valeurs.client_secret.trim() || null,
      p_subscription_key: valeurs.subscription_key.trim() || null
    });
    if (rpcErr) {
      setError(messageErreur(rpcErr));
    } else {
      setFeedback(`${saisis.length} identifiant(s) enregistré(s) ✅`);
      setEditing(false);
      setValeurs({ client_id: '', client_secret: '', subscription_key: '' });
      await loadEtat();
    }
    setSaving(false);
  };

  const remove = async () => {
    if (!confirm('Supprimer les identifiants Silae du Vault ? L’extension Claude ne pourra plus appeler Silae.')) return;
    setDeleting(true);
    setError('');
    const { error: rpcErr } = await supabase.rpc('delete_identifiants_silae_admin');
    if (rpcErr) {
      setError(messageErreur(rpcErr));
    } else {
      setFeedback('Identifiants supprimés 🗑️');
      await loadEtat();
    }
    setDeleting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800/90 border border-slate-700 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="text-cyan-400" size={24} />
              <h2 className="text-xl font-bold text-white">Identifiants API Silae (Vault)</h2>
            </div>
            <div className="text-sm text-white opacity-75">Silae Paie — OAuth2 client_credentials</div>
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
              Les identifiants sont stockés chiffrés dans <strong>Supabase Vault</strong>.
              Une fois enregistrés, ils ne sont <strong>plus jamais affichés</strong> ici —
              seule l'extension Claude « Silae Paie API », connectée avec un compte administrateur
              du site, peut les lire pour appeler Silae.
              Pour modifier un identifiant, écrasez-le avec une nouvelle valeur.
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

        {/* Feedback succès */}
        {feedback && (
          <div className="bg-green-900/30 border border-green-800 text-white text-sm px-3 py-2 rounded mb-4">
            {feedback}
          </div>
        )}

        <div className="border rounded-lg p-4 border-blue-800 bg-blue-900/20 space-y-3">
          {CHAMPS.map(({ champ, label, description }) => {
            const e = etat[champ];
            return (
              <div key={champ}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{label}</div>
                    <div className="text-sm text-white opacity-75">{description}</div>
                    {!loading && e?.configure && e.mis_a_jour_le && (
                      <div className="text-xs text-white opacity-60">
                        Dernière maj : {new Date(e.mis_a_jour_le).toLocaleString('fr-FR')}
                      </div>
                    )}
                  </div>
                  {loading ? (
                    <Loader2 size={20} className="text-white animate-spin" />
                  ) : e?.configure ? (
                    <span className="bg-green-900/50 text-white px-2 py-1 rounded text-xs flex items-center gap-1 whitespace-nowrap">
                      <CheckCircle size={14} /> Configuré
                    </span>
                  ) : (
                    <span className="bg-slate-700 text-white px-2 py-1 rounded text-xs whitespace-nowrap">
                      Non configuré
                    </span>
                  )}
                </div>
                {editing && (
                  <input
                    type="password"
                    autoComplete="off"
                    value={valeurs[champ]}
                    onChange={(ev) => setValeurs(prev => ({ ...prev, [champ]: ev.target.value }))}
                    placeholder={e?.configure ? 'Laisser vide pour conserver la valeur actuelle' : 'Coller la valeur...'}
                    className="mt-2 w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm font-mono"
                  />
                )}
              </div>
            );
          })}

          {editing ? (
            <div className="flex gap-2 pt-1">
              <button
                onClick={save}
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
          ) : (
            <div className="flex gap-2 pt-1">
              <button
                onClick={startEditing}
                disabled={loading}
                className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50 flex items-center gap-2"
              >
                {toutConfigure ? <Edit3 size={14} /> : <Lock size={14} />}
                {toutConfigure ? 'Modifier' : 'Configurer'}
              </button>
              {!loading && !aucunConfigure && (
                <button
                  onClick={remove}
                  disabled={deleting}
                  className="bg-red-900/40 hover:bg-red-900/60 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Supprimer
                </button>
              )}
            </div>
          )}
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

/**
 * Traduit une erreur RPC Supabase en message lisible.
 * @param {{ message?: string, code?: string }} err
 */
function messageErreur(err) {
  const msg = err?.message || String(err);
  if (/acces_reserve_admin/.test(msg) || err?.code === '42501') {
    return 'Accès réservé aux administrateurs du site.';
  }
  if (err?.code === 'PGRST202' || /Could not find the function/i.test(msg)) {
    return 'Fonctions SQL absentes : exécutez la migration 023_silae_identifiants_vault.sql dans le SQL Editor de Supabase.';
  }
  return msg;
}
