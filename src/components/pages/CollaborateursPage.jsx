import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Mail, Check, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { CollaborateurModal } from '../modals';

function CollaborateursPage({ collaborateurs, setCollaborateurs, collaborateurChefs, setCollaborateurChefs, charges, getChefsOf, getEquipeOf, accent, isAdmin, userCollaborateur }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCollab, setEditingCollab] = useState(null);
  const [editingEmail, setEditingEmail] = useState(null);
  const [newEmail, setNewEmail] = useState('');
  const [sendingReminder, setSendingReminder] = useState(false);
  const [sendingToAll, setSendingToAll] = useState(false);
  const [reminderMessage, setReminderMessage] = useState(null);

  // Envoyer un rappel de test (uniquement à l'admin)
  const handleSendTestReminder = async () => {
    if (!userCollaborateur?.email) {
      setReminderMessage({ type: 'error', text: 'Vous devez avoir un email configuré pour recevoir le test.' });
      return;
    }

    setSendingReminder(true);
    setReminderMessage(null);

    try {
      const response = await fetch('/api/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testMode: true,
          testEmail: userCollaborateur.email
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de l\'envoi');
      }

      setReminderMessage({
        type: 'success',
        text: `Email de test envoyé à ${userCollaborateur.email} !`
      });
    } catch (err) {
      console.error('Erreur envoi rappel:', err);
      setReminderMessage({ type: 'error', text: err.message || 'Erreur lors de l\'envoi' });
    }

    setSendingReminder(false);
  };

  // Envoyer les rappels à tous les chefs de mission
  const handleSendToAllChefs = async () => {
    if (!confirm('Envoyer le rappel à tous les chefs de mission ?')) {
      return;
    }

    setSendingToAll(true);
    setReminderMessage(null);

    try {
      const response = await fetch('/api/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testMode: false
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de l\'envoi');
      }

      setReminderMessage({
        type: 'success',
        text: `Rappels envoyés à ${result.sent} chef(s) de mission !`
      });
    } catch (err) {
      console.error('Erreur envoi rappels:', err);
      setReminderMessage({ type: 'error', text: err.message || 'Erreur lors de l\'envoi' });
    }

    setSendingToAll(false);
  };

  const chefsMission = collaborateurs.filter(c => c.est_chef_mission && c.actif);

  // Sauvegarder l'email d'un collaborateur (admin uniquement)
  const handleSaveEmail = async (collaborateurId) => {
    // Valider l'email
    if (newEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        alert('Email invalide');
        return;
      }
      // Vérifier si l'email est déjà utilisé
      const existingCollab = collaborateurs.find(c => c.email === newEmail && c.id !== collaborateurId);
      if (existingCollab) {
        alert('Cet email est déjà attribué à ' + existingCollab.nom);
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('collaborateurs')
        .update({ email: newEmail || null })
        .eq('id', collaborateurId);

      if (error) throw error;

      setCollaborateurs(prev => prev.map(c =>
        c.id === collaborateurId ? { ...c, email: newEmail || null } : c
      ));
      setEditingEmail(null);
      setNewEmail('');
    } catch (err) {
      console.error('Erreur mise à jour email:', err);
      alert('Erreur lors de la mise à jour');
    }
  };

  const handleAddCollaborateur = async (nom, estChefMission, chefIds) => {
    try {
      // Ajouter le collaborateur
      const { data, error } = await supabase
        .from('collaborateurs')
        .insert([{ nom, est_chef_mission: estChefMission, actif: true }])
        .select();
      
      if (error) throw error;
      
      const newCollab = data[0];
      setCollaborateurs(prev => [...prev, newCollab]);
      
      // Ajouter les liaisons avec les chefs
      if (chefIds && chefIds.length > 0) {
        const liaisons = chefIds.map(chefId => ({
          collaborateur_id: newCollab.id,
          chef_id: chefId
        }));
        
        const { data: liaisonsData, error: liaisonsError } = await supabase
          .from('collaborateur_chefs')
          .insert(liaisons)
          .select();
        
        if (!liaisonsError && liaisonsData) {
          setCollaborateurChefs(prev => [...prev, ...liaisonsData]);
        }
      }
    } catch (err) {
      console.error('Erreur ajout collaborateur:', err);
      alert('Erreur lors de l\'ajout');
    }
    setShowAddModal(false);
  };

  const handleUpdateCollaborateur = async (id, nom, estChefMission, chefIds) => {
    // Vérifier si on peut décocher "chef de mission"
    if (!estChefMission) {
      const equipe = getEquipeOf(id);
      if (equipe.length > 0) {
        alert('Impossible de retirer le statut chef de mission : ce collaborateur a des membres dans son équipe.');
        return;
      }
    }
    
    try {
      // Mettre à jour le collaborateur
      const { error } = await supabase
        .from('collaborateurs')
        .update({ nom, est_chef_mission: estChefMission })
        .eq('id', id);
      
      if (error) throw error;
      
      setCollaborateurs(prev => prev.map(c => 
        c.id === id ? { ...c, nom, est_chef_mission: estChefMission } : c
      ));
      
      // Supprimer les anciennes liaisons
      await supabase
        .from('collaborateur_chefs')
        .delete()
        .eq('collaborateur_id', id);
      
      // Ajouter les nouvelles liaisons
      if (chefIds && chefIds.length > 0) {
        const liaisons = chefIds.map(chefId => ({
          collaborateur_id: id,
          chef_id: chefId
        }));
        
        const { data: liaisonsData } = await supabase
          .from('collaborateur_chefs')
          .insert(liaisons)
          .select();
        
        // Mettre à jour le state local
        setCollaborateurChefs(prev => [
          ...prev.filter(cc => cc.collaborateur_id !== id),
          ...(liaisonsData || [])
        ]);
      } else {
        setCollaborateurChefs(prev => prev.filter(cc => cc.collaborateur_id !== id));
      }
    } catch (err) {
      console.error('Erreur mise à jour collaborateur:', err);
      alert('Erreur lors de la mise à jour');
    }
    setEditingCollab(null);
  };

  const handleToggleActif = async (id) => {
    const collab = collaborateurs.find(c => c.id === id);
    
    if (collab.actif) {
      const equipe = getEquipeOf(id);
      const hasActiveMembers = equipe.some(m => m.actif);
      if (hasActiveMembers) {
        alert('Impossible de désactiver : ce collaborateur a des membres actifs dans son équipe.');
        return;
      }
      const hasCharges = charges.some(c => c.collaborateur_id === id);
      if (hasCharges) {
        if (!confirm('Ce collaborateur a des charges. Voulez-vous vraiment le désactiver ?')) {
          return;
        }
      }
    }
    
    try {
      const { error } = await supabase
        .from('collaborateurs')
        .update({ actif: !collab.actif })
        .eq('id', id);
      
      if (error) throw error;
      
      setCollaborateurs(prev => prev.map(c => 
        c.id === id ? { ...c, actif: !c.actif } : c
      ));
    } catch (err) {
      console.error('Erreur toggle actif:', err);
    }
  };

  const handleDeleteCollaborateur = async (id) => {
    const collab = collaborateurs.find(c => c.id === id);
    
    const equipe = getEquipeOf(id);
    if (equipe.length > 0) {
      alert('Impossible de supprimer : ce collaborateur a des membres dans son équipe.');
      return;
    }
    
    const hasCharges = charges.some(c => c.collaborateur_id === id);
    if (hasCharges) {
      alert('Impossible de supprimer : ce collaborateur a des charges. Désactivez-le plutôt.');
      return;
    }
    
    if (confirm(`Supprimer définitivement ${collab.nom} ?`)) {
      try {
        const { error } = await supabase
          .from('collaborateurs')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        
        setCollaborateurs(prev => prev.filter(c => c.id !== id));
        setCollaborateurChefs(prev => prev.filter(cc => cc.collaborateur_id !== id && cc.chef_id !== id));
      } catch (err) {
        console.error('Erreur suppression:', err);
        alert('Erreur lors de la suppression');
      }
    }
  };

  const getChefsNoms = (collaborateurId) => {
    const chefs = getChefsOf(collaborateurId);
    if (chefs.length === 0) return '-';
    return chefs.map(c => c.nom).join(', ');
  };

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Gestion des Collaborateurs</h2>
            <p className="text-slate-400">Gérez votre équipe et la hiérarchie</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {isAdmin && (
              <>
                <button
                  onClick={handleSendTestReminder}
                  disabled={sendingReminder}
                  className="bg-slate-600 hover:bg-slate-700 disabled:bg-slate-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
                  title="Envoie un email de test à votre adresse"
                >
                  <Mail size={18} />
                  {sendingReminder ? 'Envoi...' : 'Tester'}
                </button>
                <button
                  onClick={handleSendToAllChefs}
                  disabled={sendingToAll}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
                  title="Envoie le rappel à tous les chefs de mission"
                >
                  <Mail size={18} />
                  {sendingToAll ? 'Envoi...' : 'Envoyer aux chefs de mission'}
                </button>
              </>
            )}
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
            >
              <Plus size={18} />
              Ajouter
            </button>
          </div>
        </div>

        {/* Message de rappel */}
        {reminderMessage && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
            reminderMessage.type === 'success'
              ? 'bg-green-500/20 border border-green-500 text-green-400'
              : 'bg-red-500/20 border border-red-500 text-red-400'
          }`}>
            {reminderMessage.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
            {reminderMessage.text}
            <button
              onClick={() => setReminderMessage(null)}
              className="ml-auto hover:opacity-70"
            >
              <X size={18} />
            </button>
          </div>
        )}

        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-700 text-slate-300">
                <th className="text-left py-3 px-4">Nom</th>
                {isAdmin && <th className="text-left py-3 px-4">Email (accès app)</th>}
                <th className="text-center py-3 px-4">Chef de mission</th>
                <th className="text-left py-3 px-4">Ses chefs</th>
                <th className="text-center py-3 px-4">Équipe</th>
                <th className="text-center py-3 px-4">Actif</th>
                <th className="text-center py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {collaborateurs.map(collab => {
                const equipe = getEquipeOf(collab.id);
                return (
                  <tr key={collab.id} className={`border-t border-slate-700 ${!collab.actif ? 'opacity-50' : ''}`}>
                    <td className="py-3 px-4 text-white font-medium">{collab.nom}</td>
                    {isAdmin && (
                      <td className="py-3 px-4">
                        {editingEmail === collab.id ? (
                          <div className="flex gap-2">
                            <input
                              type="email"
                              value={newEmail}
                              onChange={(e) => setNewEmail(e.target.value)}
                              className="bg-slate-700 text-white px-2 py-1 rounded border border-slate-500 text-sm w-40"
                              placeholder="email@exemple.com"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveEmail(collab.id)}
                              className={`${accent.color} text-white px-2 py-1 rounded text-sm`}
                            >
                              OK
                            </button>
                            <button
                              onClick={() => { setEditingEmail(null); setNewEmail(''); }}
                              className="bg-slate-600 text-white px-2 py-1 rounded text-sm"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {collab.email ? (
                              <>
                                <span className="text-green-400 text-sm">{collab.email}</span>
                                <button
                                  onClick={() => { setEditingEmail(collab.id); setNewEmail(collab.email || ''); }}
                                  className="text-slate-400 hover:text-white p-1"
                                  title="Modifier l'email"
                                >
                                  <Pencil size={14} />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => { setEditingEmail(collab.id); setNewEmail(''); }}
                                className="text-slate-500 hover:text-slate-300 text-sm flex items-center gap-1"
                              >
                                <Mail size={14} />
                                Ajouter
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    )}
                    <td className="py-3 px-4 text-center">
                      {collab.est_chef_mission ? (
                        <span className="bg-purple-600/30 text-purple-300 px-2 py-1 rounded text-sm">Oui</span>
                      ) : (
                        <span className="text-slate-500">Non</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-300 text-sm">{getChefsNoms(collab.id)}</td>
                    <td className="py-3 px-4 text-center">
                      {collab.est_chef_mission && equipe.length > 0 ? (
                        <span className="bg-blue-600/30 text-blue-300 px-2 py-1 rounded text-sm">
                          {equipe.length} membre(s)
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button 
                        onClick={() => handleToggleActif(collab.id)}
                        className={`p-1 rounded transition ${collab.actif ? 'text-green-400 hover:bg-green-900/30' : 'text-slate-500 hover:bg-slate-700'}`}
                      >
                        <Check size={18} />
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex justify-center gap-1">
                        <button 
                          onClick={() => setEditingCollab(collab)}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 p-1 rounded transition"
                          title="Modifier"
                        >
                          <Pencil size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteCollaborateur(collab.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-900/30 p-1 rounded transition"
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 mt-6">
          <p className="text-slate-400 text-sm">
            Total : {collaborateurs.length} collaborateurs | Actifs : {collaborateurs.filter(c => c.actif).length} | Chefs de mission : {chefsMission.length}
          </p>
        </div>

        {showAddModal && (
          <CollaborateurModal 
            chefsMission={chefsMission}
            collaborateurChefs={collaborateurChefs}
            onSave={handleAddCollaborateur}
            onClose={() => setShowAddModal(false)}
          />
        )}

        {editingCollab && (
          <CollaborateurModal 
            collaborateur={editingCollab}
            chefsMission={chefsMission.filter(c => c.id !== editingCollab.id)}
            collaborateurChefs={collaborateurChefs}
            onSave={(nom, estChef, chefIds) => handleUpdateCollaborateur(editingCollab.id, nom, estChef, chefIds)}
            onClose={() => setEditingCollab(null)}
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// PAGE CLIENTS
// ============================================

export default CollaborateursPage;
