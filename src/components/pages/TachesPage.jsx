// @ts-check
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import usePersistedState from '../../hooks/usePersistedState';
import {
  ListTodo, Plus, Mail, Pencil, Flag, Trash2, X, AlertTriangle, Check,
  RotateCcw, CalendarClock,
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import {
  getVisibleCollaborateurIds, getTaches, createTache,
  marquerFaite, updateTache, deleteTache,
} from '../../utils/taches';
import { diffJours } from '../../utils/taches/tachesStatus.js';

/**
 * @typedef {import('../../types.js').Client} Client
 * @typedef {import('../../types.js').Collaborateur} Collaborateur
 * @typedef {import('../../types.js').CollaborateurChef} CollaborateurChef
 * @typedef {import('../../types.js').AccentColor} AccentColor
 */

const COLONNES = [
  { statut: 'a_faire', titre: 'À faire', dot: 'bg-amber-500' },
  { statut: 'faite', titre: 'Fait', dot: 'bg-green-500' },
];

/**
 * Formate une date ISO (YYYY-MM-DD) en libellé court français (ex. "mar. 8 juil").
 * @param {string|null|undefined} iso
 * @returns {string}
 */
function formatFr(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Niveau d'urgence d'une date d'échéance par rapport à aujourd'hui.
 * @param {string|null|undefined} dateIso
 * @param {string} today - YYYY-MM-DD
 * @returns {'aucune'|'retard'|'proche'|'ok'}
 */
function urgenceDate(dateIso, today) {
  if (!dateIso) return 'aucune';
  const d = diffJours(today, dateIso);
  if (d < 0) return 'retard';
  if (d <= 2) return 'proche';
  return 'ok';
}

/**
 * Comparateur de tri : urgentes d'abord, puis par échéance croissante (sans date en dernier).
 */
function comparerTaches(a, b) {
  const ua = a.priorite === 'urgente' ? 0 : 1;
  const ub = b.priorite === 'urgente' ? 0 : 1;
  if (ua !== ub) return ua - ub;
  const da = a.date_echeance || '9999-12-31';
  const db = b.date_echeance || '9999-12-31';
  if (da !== db) return da < db ? -1 : 1;
  return (a.created_at || '') < (b.created_at || '') ? -1 : 1;
}

/** Initiales d'un collaborateur (ex. "Jean Dupont" -> "JD"). */
function initiales(nom) {
  if (!nom) return '?';
  const parts = nom.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const AVATAR_COLORS = ['#7c3aed', '#0e7490', '#9d174d', '#a16207', '#15803d', '#4338ca', '#0f766e', '#b45309'];

/** Couleur d'avatar stable selon l'id du collaborateur. */
function avatarColor(id) {
  if (id == null) return '#475569';
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

/**
 * Puce d'échéance cliquable : affiche la date en chip coloré (rouge=retard, orange=proche),
 * clic → sélecteur de date natif. Ne persiste qu'une année complète (corrige la saisie).
 */
function DateChip({ value, urg, onCommit }) {
  const [local, setLocal] = useState(value || '');
  useEffect(() => { setLocal(value || ''); }, [value]);

  const commit = (v) => {
    if (v === '') { if (value) onCommit(null); return; }
    const annee = Number(v.split('-')[0]);
    if (annee >= 1900 && annee <= 2999 && v !== value) onCommit(v);
  };

  const bg = urg === 'retard' ? 'bg-red-900/50' : urg === 'proche' ? 'bg-amber-900/50' : 'bg-slate-700';
  const ic = urg === 'retard' ? 'text-red-400' : urg === 'proche' ? 'text-amber-400' : 'text-white';

  return (
    <span className="relative inline-flex shrink-0" onClick={e => e.stopPropagation()}>
      <span className={`${bg} text-white text-[11px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 whitespace-nowrap`}>
        <CalendarClock size={12} className={ic} />
        {value ? formatFr(value) : 'échéance'}
      </span>
      <input
        type="date"
        value={local}
        onChange={e => { setLocal(e.target.value); commit(e.target.value); }}
        onClick={e => { e.stopPropagation(); if (e.currentTarget.showPicker) e.currentTarget.showPicker(); }}
        className="absolute inset-0 w-full opacity-0 cursor-pointer"
        title="Modifier l'échéance"
      />
    </span>
  );
}

/**
 * Page de gestion des tâches déléguées (kanban À faire / Fait + vue patron).
 * @param {Object} props
 * @param {Client[]} props.clients
 * @param {Collaborateur[]} props.collaborateurs
 * @param {CollaborateurChef[]} props.collaborateurChefs
 * @param {AccentColor} props.accent
 * @param {Collaborateur|null} props.userCollaborateur
 * @returns {JSX.Element}
 */
function TachesPage({ clients, collaborateurs, collaborateurChefs, accent, userCollaborateur }) {
  /** @type {[Object[], function]} */
  const [taches, setTaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState('');
  const [filtreCollab, setFiltreCollab] = usePersistedState('taches_filtreCollab', 'mes');
  const [showCreate, setShowCreate] = useState(false);
  /** @type {[Object|null, function]} */
  const [detail, setDetail] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [reassignForId, setReassignForId] = useState(null);
  const [clientForId, setClientForId] = useState(null);

  const today = new Date().toISOString().slice(0, 10);

  const scopeIds = useMemo(
    () => getVisibleCollaborateurIds(userCollaborateur, collaborateurChefs, collaborateurs),
    [userCollaborateur, collaborateurChefs, collaborateurs]
  );

  const visibleCollabs = useMemo(() => {
    if (!userCollaborateur) return [];
    if (scopeIds === null) {
      return [...collaborateurs].filter(c => c.actif).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    }
    return collaborateurs
      .filter(c => scopeIds.includes(c.id))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [scopeIds, collaborateurs, userCollaborateur]);

  const peutVoirEquipe = scopeIds === null || visibleCollabs.length > 1;

  const clientsById = useMemo(() => {
    const m = new Map();
    for (const c of clients) m.set(c.id, c);
    return m;
  }, [clients]);

  const collabsById = useMemo(() => {
    const m = new Map();
    for (const c of collaborateurs) m.set(c.id, c);
    return m;
  }, [collaborateurs]);

  const charger = useCallback(async () => {
    setLoading(true);
    setErreur('');
    try {
      const data = await getTaches(supabase, { collaborateurIds: scopeIds });
      setTaches(data);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur de chargement');
    }
    setLoading(false);
  }, [scopeIds]);

  useEffect(() => { charger(); }, [charger]);

  // Ferme les menus déroulants (réaffectation, société) au clic à l'extérieur
  useEffect(() => {
    if (reassignForId == null && clientForId == null) return undefined;
    const close = () => { setReassignForId(null); setClientForId(null); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [reassignForId, clientForId]);

  const remplacer = (t) => setTaches(prev => prev.map(x => (x.id === t.id ? t : x)));

  const protege = async (fn) => {
    try { await fn(); } catch (e) { setErreur(e instanceof Error ? e.message : 'Erreur'); }
  };

  // Notifie l'auteur (demandeur) d'un évènement, sauf si c'est lui-même qui agit.
  // Fire-and-forget : n'échoue jamais (le mail part côté serveur via Brevo, en prod).
  const notifierAuteur = (tache, type, extra = {}) => {
    if (!tache.created_by || tache.created_by === userCollaborateur?.id) return;
    const auteur = collabsById.get(tache.created_by);
    if (!auteur?.email) return;
    fetch('/api/notify-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        destinataireEmail: auteur.email,
        destinataireNom: auteur.nom,
        titre: tache.titre,
        client: clientsById.get(tache.client_id)?.nom || null,
        parQui: userCollaborateur?.nom || 'Un collaborateur',
        ...extra,
      }),
    }).catch(() => {});
  };

  const handleChangeEcheance = (tache, dateStr) =>
    protege(async () => {
      remplacer(await updateTache(supabase, tache.id, { date_echeance: dateStr }));
      notifierAuteur(tache, 'date_modifiee', { nouvelleDate: dateStr });
    });

  const handleToggleUrgent = (tache) =>
    protege(async () => remplacer(await updateTache(supabase, tache.id, {
      priorite: tache.priorite === 'urgente' ? 'normale' : 'urgente',
    })));

  const handleFait = (tache) =>
    protege(async () => {
      remplacer(await marquerFaite(supabase, tache.id));
      notifierAuteur(tache, 'tache_faite');
    });

  const handleRouvrir = (tache) =>
    protege(async () => remplacer(await updateTache(supabase, tache.id, { statut: 'a_faire', date_faite: null })));

  const handleSupprimer = (tache) =>
    protege(async () => {
      // Prévient l'auteur si la tâche n'est pas faite et qu'un AUTRE collaborateur la supprime
      if (tache.statut !== 'faite') notifierAuteur(tache, 'tache_supprimee');
      await deleteTache(supabase, tache.id);
      setTaches(prev => prev.filter(x => x.id !== tache.id));
      setDetail(null);
    });

  const handleReassign = (tache, nouveau) =>
    protege(async () => {
      setReassignForId(null);
      if (!nouveau || nouveau.id === tache.collaborateur_id) return;
      remplacer(await updateTache(supabase, tache.id, { collaborateur_id: nouveau.id }));
      // Prévient le nouveau destinataire (sauf si c'est soi-même)
      if (nouveau.email && nouveau.id !== userCollaborateur?.id) {
        fetch('/api/notify-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'tache_reassignee',
            destinataireEmail: nouveau.email,
            destinataireNom: nouveau.nom,
            titre: tache.titre,
            client: clientsById.get(tache.client_id)?.nom || null,
            parQui: userCollaborateur?.nom || 'Un collaborateur',
          }),
        }).catch(() => {});
      }
    });

  const handleSetClient = (tache, client) =>
    protege(async () => {
      setClientForId(null);
      remplacer(await updateTache(supabase, tache.id, { client_id: client ? client.id : null }));
    });

  const handleDrop = (statutCible) => {
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const tache = taches.find(t => t.id === id);
    if (!tache || tache.statut === statutCible) return;
    if (statutCible === 'faite') handleFait(tache);
    else if (statutCible === 'a_faire') protege(async () => remplacer(await updateTache(supabase, tache.id, { statut: 'a_faire', date_faite: null })));
  };

  const tachesAffichees = useMemo(() => {
    if (filtreCollab === 'mes') return taches.filter(t => t.collaborateur_id === userCollaborateur?.id);
    if (filtreCollab === 'tous') return taches;
    const id = Number(filtreCollab);
    return taches.filter(t => t.collaborateur_id === id);
  }, [taches, filtreCollab, userCollaborateur]);

  // "Fait" = statut faite ; "À faire" = tout le reste (inclut d'anciens statuts 'planifiee')
  const parStatut = (statut) =>
    tachesAffichees
      .filter(t => (statut === 'faite' ? t.statut === 'faite' : t.statut !== 'faite'))
      .sort(comparerTaches);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 relative z-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <ListTodo className="text-white" size={28} />
          <div>
            <h2 className="text-2xl font-bold text-white">Mes tâches</h2>
            <p className="text-white text-sm opacity-80">
              {tachesAffichees.filter(t => t.statut !== 'faite').length} en cours
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {peutVoirEquipe && (
            <select
              value={filtreCollab}
              onChange={e => setFiltreCollab(e.target.value)}
              className="bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2"
            >
              <option value="mes">Mes tâches</option>
              <option value="tous">Toute l'équipe</option>
              {visibleCollabs
                .filter(c => c.id !== userCollaborateur?.id)
                .map(c => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
            </select>
          )}
          <button
            onClick={() => setShowCreate(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${accent.color} text-white ${accent.hover} transition`}
          >
            <Plus size={18} />
            Nouvelle tâche
          </button>
        </div>
      </div>

      {erreur && (
        <div className="mb-4 bg-red-900/30 border border-red-800 text-white px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle size={18} />
          {erreur}
        </div>
      )}

      {loading ? (
        <div className="text-white text-center py-12 opacity-80">Chargement…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {COLONNES.map(col => {
            const liste = parStatut(col.statut);
            return (
              <div
                key={col.statut}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(col.statut)}
                className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 min-h-[200px]"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className="text-white font-semibold">{col.titre}</span>
                  <span className="ml-auto text-white bg-slate-700 text-xs px-2 py-0.5 rounded-full">
                    {liste.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {liste.length === 0 && (
                    <p className="text-white text-sm opacity-50 py-4 text-center">Aucune tâche</p>
                  )}
                  {liste.map(tache => (
                    <TacheCard
                      key={tache.id}
                      tache={tache}
                      today={today}
                      client={clientsById.get(tache.client_id)}
                      collab={collabsById.get(tache.collaborateur_id)}
                      createur={collabsById.get(tache.created_by)}
                      montrerCollab={filtreCollab !== 'mes'}
                      clients={clients}
                      equipe={visibleCollabs}
                      reassignOpen={reassignForId === tache.id}
                      clientOpen={clientForId === tache.id}
                      onToggleReassign={(id) => { setClientForId(null); setReassignForId(prev => (prev === id ? null : id)); }}
                      onToggleClient={(id) => { setReassignForId(null); setClientForId(prev => (prev === id ? null : id)); }}
                      onReassign={handleReassign}
                      onSetClient={handleSetClient}
                      onDragStart={() => setDragId(tache.id)}
                      onOpen={() => setDetail(tache)}
                      onChangeEcheance={handleChangeEcheance}
                      onToggleUrgent={handleToggleUrgent}
                      onFait={handleFait}
                      onRouvrir={handleRouvrir}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateTacheModal
          accent={accent}
          clients={clients}
          collaborateurs={visibleCollabs}
          userCollaborateur={userCollaborateur}
          onClose={() => setShowCreate(false)}
          onCreated={(t) => { setTaches(prev => [t, ...prev]); setShowCreate(false); }}
        />
      )}

      {detail && (
        <DetailTacheModal
          tache={detail}
          client={clientsById.get(detail.client_id)}
          collab={collabsById.get(detail.collaborateur_id)}
          createur={collabsById.get(detail.created_by)}
          onClose={() => setDetail(null)}
          onSupprimer={handleSupprimer}
        />
      )}
    </div>
  );
}

/**
 * Menu déroulant de choix de la société (avec recherche parmi tous les clients).
 */
function ClientPicker({ clients, currentId, onPick }) {
  const [q, setQ] = useState('');
  const liste = useMemo(() => {
    const term = q.trim().toLowerCase();
    const arr = [...clients].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    return term ? arr.filter(c => c.nom.toLowerCase().includes(term)) : arr;
  }, [clients, q]);

  return (
    <div
      className="absolute left-0 top-7 z-50 bg-slate-900 border border-slate-700 rounded-lg p-1.5 w-60 shadow-xl"
      onClick={e => e.stopPropagation()}
    >
      <input
        autoFocus
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Rechercher une société…"
        className="w-full bg-slate-700 text-white text-[12px] border border-slate-600 rounded px-2 py-1 mb-1"
      />
      <div className="max-h-56 overflow-y-auto">
        <button
          onClick={() => onPick(null)}
          className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-800 text-white text-[12px] opacity-70"
        >
          — Aucune —
        </button>
        {liste.map(c => (
          <button
            key={c.id}
            onClick={() => onPick(c)}
            className={`w-full text-left px-2 py-1.5 rounded hover:bg-slate-800 text-white text-[13px] truncate ${c.id === currentId ? 'bg-slate-800' : ''}`}
          >
            {c.nom}
          </button>
        ))}
        {liste.length === 0 && (
          <div className="text-white text-[12px] opacity-60 px-2 py-2">Aucun résultat</div>
        )}
      </div>
    </div>
  );
}

/**
 * Carte compacte d'une tâche (2 lignes) avec société et destinataire cliquables.
 */
function TacheCard({ tache, today, client, clients, collab, createur, montrerCollab, equipe, reassignOpen, clientOpen, onToggleReassign, onToggleClient, onReassign, onSetClient, onDragStart, onOpen, onChangeEcheance, onToggleUrgent, onFait, onRouvrir }) {
  const faite = tache.statut === 'faite';
  const urg = urgenceDate(tache.date_echeance, today);
  const estUrgent = tache.priorite === 'urgente';
  const autres = equipe ? equipe.filter(c => c.id !== tache.collaborateur_id) : [];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 hover:border-slate-500 transition"
      style={faite ? { opacity: 0.7 } : undefined}
    >
      {/* Ligne 1 : priorité · titre · action */}
      <div className="flex items-center gap-2">
        {!faite ? (
          <button
            onClick={() => onToggleUrgent(tache)}
            title={estUrgent ? 'Retirer urgent' : 'Marquer urgent'}
            className="shrink-0 hover:opacity-80"
          >
            <Flag size={14} className={estUrgent ? 'text-red-500' : 'text-white opacity-40'} fill={estUrgent ? '#ef4444' : 'none'} />
          </button>
        ) : (
          <Check size={15} className="text-green-500 shrink-0" />
        )}
        <span
          onClick={onOpen}
          className={`flex-1 min-w-0 truncate text-white text-[13px] font-medium cursor-pointer ${faite ? 'line-through' : ''}`}
          title={tache.titre}
        >
          {tache.titre}
        </span>
        {!faite ? (
          <button onClick={() => onFait(tache)} title="Marquer comme fait" className="shrink-0 text-green-500 hover:text-green-400">
            <Check size={18} />
          </button>
        ) : (
          <button onClick={() => onRouvrir(tache)} title="Rouvrir" className="shrink-0 text-white opacity-70 hover:opacity-100">
            <RotateCcw size={14} />
          </button>
        )}
      </div>

      {/* Ligne 2 : client · échéance · source · destinataire */}
      <div className="flex items-center gap-1.5 mt-1.5">
        {/* Société (cliquable : choisir / changer) */}
        <div className="relative shrink-0 max-w-[45%]">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleClient(tache.id); }}
            title={client ? `${client.nom} — changer la société` : 'Choisir la société'}
            className={`text-[11px] px-1.5 py-0.5 rounded truncate max-w-full inline-block ${client ? 'bg-cyan-600 text-white' : 'border border-dashed border-slate-500 text-white opacity-70'}`}
          >
            {client ? client.nom : 'SOCIÉTÉ'}
          </button>
          {clientOpen && (
            <ClientPicker clients={clients} currentId={tache.client_id} onPick={(c) => onSetClient(tache, c)} />
          )}
        </div>
        {!faite && (
          <DateChip value={tache.date_echeance} urg={urg} onCommit={(d) => onChangeEcheance(tache, d)} />
        )}
        {faite && tache.date_faite && (
          <span className="text-white text-[11px] opacity-70">fait le {formatFr(tache.date_faite.slice(0, 10))}</span>
        )}

        <span className="flex-1" />

        {createur && !faite && (
          <span className="text-white text-[11px] opacity-70 inline-flex items-center gap-1 shrink-0">
            {tache.source === 'email' ? <Mail size={11} /> : <Pencil size={11} />}
            <span className="truncate max-w-[70px]">{tache.source === 'email' ? 'de ' : ''}{createur.nom.split(' ')[0]}</span>
          </span>
        )}

        {/* Pastille destinataire + menu de réaffectation */}
        <div className="relative shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleReassign(tache.id); }}
            title={`${collab ? collab.nom : 'Non assignée'} — réaffecter`}
            className="rounded-full block"
            style={{ outline: reassignOpen ? '2px solid #a78bfa' : 'none' }}
          >
            <span
              className="w-[22px] h-[22px] rounded-full inline-flex items-center justify-center text-white text-[10px] font-medium"
              style={{ background: avatarColor(collab?.id) }}
            >
              {initiales(collab?.nom)}
            </span>
          </button>
          {reassignOpen && (
            <div
              className="absolute right-0 top-8 z-50 bg-slate-900 border border-slate-700 rounded-lg p-1.5 w-52 shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-white text-[10px] uppercase tracking-wide opacity-60 px-2 py-1">Réaffecter à</div>
              <div className="max-h-56 overflow-y-auto">
                {autres.map(c => (
                  <button
                    key={c.id}
                    onClick={() => onReassign(tache, c)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-800 text-left"
                  >
                    <span
                      className="w-[22px] h-[22px] rounded-full inline-flex items-center justify-center text-white text-[10px] font-medium shrink-0"
                      style={{ background: avatarColor(c.id) }}
                    >
                      {initiales(c.nom)}
                    </span>
                    <span className="text-white text-[13px] truncate">{c.nom}</span>
                  </button>
                ))}
                {autres.length === 0 && (
                  <div className="text-white text-[12px] opacity-60 px-2 py-2">Aucun autre collègue dans votre périmètre</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Modale de détail d'une tâche.
 */
function DetailTacheModal({ tache, client, collab, createur, onClose, onSupprimer }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-slate-800 border border-slate-700 rounded-xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h3 className="text-xl font-bold text-white text-center flex-1">{tache.titre}</h3>
          <button onClick={onClose} className="text-white hover:opacity-70">
            <X size={22} />
          </button>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-4">
          {tache.priorite === 'urgente' && (
            <span className="text-red-500 font-bold text-sm inline-flex items-center gap-1">
              <Flag size={14} /> URGENT
            </span>
          )}
          {client && (
            <span className="bg-cyan-600 text-white text-xs px-2.5 py-1 rounded">{client.nom}</span>
          )}
          {tache.date_echeance && (
            <span className="bg-slate-700 text-white text-xs px-2 py-1 rounded inline-flex items-center gap-1">
              <Flag size={12} /> {formatFr(tache.date_echeance)}
            </span>
          )}
        </div>

        {tache.detail && (
          <div className="mb-4">
            <div className="text-white text-sm opacity-70 mb-1">Détail</div>
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-white text-sm whitespace-pre-wrap">
              {tache.detail}
            </div>
          </div>
        )}

        <div className="text-white text-sm space-y-1 mb-5 opacity-90">
          {collab && <div>Assignée à : <span className="font-medium">{collab.nom}</span></div>}
          {createur && <div>Demandée par : <span className="font-medium">{createur.nom}</span></div>}
          {tache.source === 'email' && tache.email_from && <div>Reçue par email de {tache.email_from}</div>}
          {tache.source === 'manuel' && <div>Créée manuellement</div>}
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => onSupprimer(tache)}
            className="bg-red-600/20 hover:bg-red-600/30 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2"
          >
            <Trash2 size={16} /> Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Modale de création manuelle d'une tâche.
 */
function CreateTacheModal({ accent, clients, collaborateurs, userCollaborateur, onClose, onCreated }) {
  const [titre, setTitre] = useState('');
  const [detail, setDetail] = useState('');
  const [collaborateurId, setCollaborateurId] = useState(userCollaborateur?.id || '');
  const [clientId, setClientId] = useState('');
  const [dateEcheance, setDateEcheance] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const clientsTries = useMemo(
    () => [...clients].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    [clients]
  );

  const submit = async () => {
    if (!titre.trim() || !collaborateurId) {
      setErr('Titre et destinataire obligatoires');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const t = await createTache(supabase, {
        collaborateur_id: Number(collaborateurId),
        client_id: clientId ? Number(clientId) : null,
        titre: titre.trim(),
        detail: detail.trim() || null,
        priorite: urgente ? 'urgente' : 'normale',
        date_echeance: dateEcheance || null,
        source: 'manuel',
        created_by: userCollaborateur?.id || null,
      });
      onCreated(t);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-slate-800 border border-slate-700 rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Nouvelle tâche</h3>
          <button onClick={onClose} className="text-white hover:opacity-70"><X size={22} /></button>
        </div>

        {err && (
          <div className="mb-3 bg-red-900/30 border border-red-800 text-white px-3 py-2 rounded-lg text-sm">
            {err}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-white text-sm block mb-1">Titre *</label>
            <input
              value={titre}
              onChange={e => setTitre(e.target.value)}
              className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2"
              placeholder="Ex. Faire la TVA de juin"
            />
          </div>
          <div>
            <label className="text-white text-sm block mb-1">Détail</label>
            <textarea
              value={detail}
              onChange={e => setDetail(e.target.value)}
              rows={3}
              className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white text-sm block mb-1">Assignée à *</label>
              <select
                value={collaborateurId}
                onChange={e => setCollaborateurId(e.target.value)}
                className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2"
              >
                <option value="">—</option>
                {collaborateurs.map(c => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-white text-sm block mb-1">Client</label>
              <select
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2"
              >
                <option value="">Aucun</option>
                {clientsTries.map(c => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className="text-white text-sm block mb-1">Date</label>
              <input
                type="date"
                value={dateEcheance}
                onChange={e => setDateEcheance(e.target.value)}
                className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2"
              />
            </div>
            <label className="text-white text-sm inline-flex items-center gap-2 py-2">
              <input type="checkbox" checked={urgente} onChange={e => setUrgente(e.target.checked)} />
              Urgente
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg">
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className={`${accent.color} text-white ${accent.hover} px-4 py-2 rounded-lg disabled:opacity-50`}
          >
            {saving ? 'Création…' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TachesPage;
