// @ts-check
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

/**
 * @typedef {import('../../types.js').Client} Client
 * @typedef {import('../../types.js').Collaborateur} Collaborateur
 * @typedef {import('../../types.js').Charge} Charge
 * @typedef {import('../../types.js').ImpotsTaxes} ImpotsTaxes
 * @typedef {import('../../types.js').AccentColor} AccentColor
 * @typedef {import('../../types.js').RepartitionTVAPageProps} RepartitionTVAPageProps
 */

/**
 * Page de planification automatique de la TVA
 * @param {RepartitionTVAPageProps} props
 * @returns {JSX.Element}
 */
function RepartitionTVAPage({ clients, collaborateurs, charges, setCharges, getEquipeOf, accent, userCollaborateur, impotsTaxes }) {
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [repartitionData, setRepartitionData] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  // Annee fiscale courante pour recuperer les donnees impots_taxes
  const anneeFiscale = new Date().getFullYear();

  // Verifier si un client a la TVA configuree dans impots_taxes
  const clientHasTVA = (clientId) => {
    const data = impotsTaxes.find(it => it.client_id === clientId && it.annee_fiscale === anneeFiscale);
    return data?.tva_jour && data?.tva_periodicite;
  };

  // Clients TVA actifs appartenant au chef de mission connecte
  const clientsTVA = clients.filter(c =>
    c.actif &&
    clientHasTVA(c.id) &&
    (c.chef_mission_id === userCollaborateur?.id || !c.chef_mission_id)
  );

  // Collaborateurs de l'equipe du chef de mission (+ lui-meme)
  const equipeCollaborateurs = userCollaborateur ? [
    userCollaborateur,
    ...getEquipeOf(userCollaborateur.id)
  ] : [];

  // Obtenir la date limite TVA depuis impots_taxes
  const getTvaJourFromImpots = (clientId) => {
    const data = impotsTaxes.find(it => it.client_id === clientId && it.annee_fiscale === anneeFiscale);
    return data?.tva_jour || 19; // Par defaut 19 si non renseigne
  };

  // Jours feries francais 2025-2027
  const joursFeries = [
    // 2025
    '2025-01-01', '2025-04-21', '2025-05-01', '2025-05-08', '2025-05-29',
    '2025-06-09', '2025-07-14', '2025-08-15', '2025-11-01', '2025-11-11', '2025-12-25',
    // 2026
    '2026-01-01', '2026-04-06', '2026-05-01', '2026-05-08', '2026-05-14',
    '2026-05-25', '2026-07-14', '2026-08-15', '2026-11-01', '2026-11-11', '2026-12-25',
    // 2027
    '2027-01-01', '2027-03-29', '2027-05-01', '2027-05-08', '2027-05-06',
    '2027-05-17', '2027-07-14', '2027-08-15', '2027-11-01', '2027-11-11', '2027-12-25'
  ];

  // Ref pour eviter la sauvegarde au premier chargement
  const isInitialLoad = React.useRef(true);

  // Charger les donnees sauvegardees du localStorage (une seule fois)
  // La date limite vient maintenant de impots_taxes, pas du localStorage
  useEffect(() => {
    if (clientsTVA.length > 0 && repartitionData.length === 0) {
      const savedData = localStorage.getItem('tvaRepartitionData');
      const savedMap = savedData ? JSON.parse(savedData) : {};

      setRepartitionData(clientsTVA.map(client => {
        const saved = savedMap[client.id];
        return {
          clientId: client.id,
          clientNom: client.nom,
          collaborateurId: saved?.collaborateurId || '',
          heures: saved?.heures || 0,
          dateLimite: getTvaJourFromImpots(client.id) // Recupere depuis impots_taxes
        };
      }));
    }
  }, [clientsTVA, impotsTaxes]);

  // Sauvegarder les donnees dans le localStorage quand elles changent (pas au premier chargement)
  // Note: on ne sauvegarde plus dateLimite car elle vient de impots_taxes
  useEffect(() => {
    if (isInitialLoad.current) {
      if (repartitionData.length > 0) {
        isInitialLoad.current = false;
      }
      return;
    }
    if (repartitionData.length > 0) {
      const dataToSave = {};
      repartitionData.forEach(item => {
        dataToSave[item.clientId] = {
          collaborateurId: item.collaborateurId,
          heures: item.heures
          // dateLimite n'est plus sauvegarde ici, il vient de impots_taxes
        };
      });
      localStorage.setItem('tvaRepartitionData', JSON.stringify(dataToSave));
    }
  }, [repartitionData]);

  // Parser une date YYYY-MM-DD en objet Date local
  const parseDateLocal = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Formater une date en YYYY-MM-DD
  const formatDateToYMD = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Verifier si un jour est ouvre (Lun-Ven, pas ferie)
  const isJourOuvre = (dateStr) => {
    const date = parseDateLocal(dateStr);
    const jour = date.getDay();
    // 0 = Dimanche, 6 = Samedi
    if (jour === 0 || jour === 6) return false;
    // Verifier si c'est un jour ferie
    if (joursFeries.includes(dateStr)) return false;
    return true;
  };

  // Obtenir le prochain jour ouvre
  const getProchainJourOuvre = (dateStr) => {
    let date = parseDateLocal(dateStr);
    date.setDate(date.getDate() + 1);
    while (!isJourOuvre(formatDateToYMD(date))) {
      date.setDate(date.getDate() + 1);
    }
    return formatDateToYMD(date);
  };

  // Mettre a jour une ligne de repartition
  const updateRepartition = (index, field, value) => {
    setRepartitionData(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  // Verifier si toutes les donnees sont remplies
  const isDataComplete = () => {
    if (!dateDebut || !dateFin) return false;
    return repartitionData.every(item =>
      item.collaborateurId && item.dateLimite >= 1 && item.dateLimite <= 31
    );
  };

  // Calculer les heures deja planifiees pour un collaborateur sur une date
  const getHeuresPlanifiees = (collaborateurId, dateStr, chargesExistantes) => {
    const chargesJour = chargesExistantes.filter(c =>
      c.collaborateur_id === collaborateurId && c.date_charge === dateStr
    );
    return chargesJour.reduce((sum, c) => sum + parseFloat(c.heures), 0);
  };

  // Calculer les heures disponibles sur la periode pour un collaborateur
  const calculerHeuresDisponibles = (collaborateurId) => {
    if (!dateDebut || !dateFin) return 0;

    let heuresDisponibles = 0;
    const startDate = parseDateLocal(dateDebut);
    const endDate = parseDateLocal(dateFin);
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = formatDateToYMD(currentDate);
      if (isJourOuvre(dateStr)) {
        // Heures deja planifiees ce jour-la
        const heuresDejaPlanifiees = charges
          .filter(c => c.collaborateur_id === parseInt(collaborateurId) && c.date_charge === dateStr)
          .reduce((sum, c) => sum + parseFloat(c.heures), 0);
        heuresDisponibles += Math.max(0, 8 - heuresDejaPlanifiees);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return heuresDisponibles;
  };

  // Valider la capacite de chaque collaborateur
  const validerCapacite = () => {
    const errors = [];

    // Regrouper les heures par collaborateur
    const heuresParCollab = {};
    repartitionData.forEach(item => {
      if (item.collaborateurId && item.heures > 0) {
        if (!heuresParCollab[item.collaborateurId]) {
          heuresParCollab[item.collaborateurId] = 0;
        }
        heuresParCollab[item.collaborateurId] += parseFloat(item.heures);
      }
    });

    // Verifier chaque collaborateur
    Object.entries(heuresParCollab).forEach(([collabId, heuresReparties]) => {
      const heuresDisponibles = calculerHeuresDisponibles(collabId);
      if (heuresReparties > heuresDisponibles) {
        const collab = equipeCollaborateurs.find(c => c.id === parseInt(collabId));
        const nomCollab = collab ? collab.nom : 'Inconnu';
        const depassement = heuresReparties - heuresDisponibles;
        errors.push({
          collaborateur: nomCollab,
          heuresDisponibles,
          heuresReparties,
          depassement
        });
      }
    });

    return errors;
  };

  // Repartir les charges automatiquement
  const repartirCharges = async () => {
    if (!isDataComplete()) {
      alert('Veuillez remplir tous les champs (collaborateur et date limite) avant de repartir.');
      return;
    }

    // Valider la capacite
    const errors = validerCapacite();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);

    setIsGenerating(true);

    try {
      // Copie des charges existantes pour le calcul
      let chargesExistantes = [...charges];
      const nouvellesCharges = [];

      // Trier par date limite (priorite aux plus urgentes)
      const dataTriee = [...repartitionData]
        .filter(item => item.heures > 0)
        .sort((a, b) => a.dateLimite - b.dateLimite);

      for (const item of dataTriee) {
        let heuresRestantes = parseFloat(item.heures);
        let currentDate = dateDebut;

        // Avancer jusqu'au premier jour ouvre si necessaire
        while (!isJourOuvre(currentDate) && currentDate <= dateFin) {
          currentDate = getProchainJourOuvre(currentDate);
        }

        while (heuresRestantes > 0 && currentDate <= dateFin) {
          if (isJourOuvre(currentDate)) {
            const heuresDejaPlanifiees = getHeuresPlanifiees(
              parseInt(item.collaborateurId),
              currentDate,
              [...chargesExistantes, ...nouvellesCharges]
            );
            const heuresDisponibles = Math.max(0, 8 - heuresDejaPlanifiees);

            if (heuresDisponibles > 0) {
              const heuresAPlacer = Math.min(heuresRestantes, heuresDisponibles);

              nouvellesCharges.push({
                collaborateur_id: parseInt(item.collaborateurId),
                client_id: item.clientId,
                date_charge: currentDate,
                heures: heuresAPlacer,
                type: 'budgete',
                detail: 'TVA',
                heures_realisees: 0
              });

              heuresRestantes -= heuresAPlacer;
            }
          }

          // Passer au jour suivant
          const nextDate = new Date(currentDate);
          nextDate.setDate(nextDate.getDate() + 1);
          currentDate = formatDateToYMD(nextDate);
        }
      }

      // Inserer toutes les charges en base
      if (nouvellesCharges.length > 0) {
        const { data, error } = await supabase
          .from('charges')
          .insert(nouvellesCharges)
          .select();

        if (error) throw error;

        setCharges(prev => [...prev, ...data]);
        alert(`${nouvellesCharges.length} charge(s) creee(s) avec succes !`);
      } else {
        alert('Aucune charge a creer (toutes les durees sont a 0).');
      }
    } catch (err) {
      console.error('Erreur lors de la repartition:', err);
      alert('Erreur lors de la creation des charges');
    }

    setIsGenerating(false);
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="bg-slate-800/90 backdrop-blur-sm rounded-xl p-6 border border-slate-700 mb-6">
        <h1 className="text-2xl font-bold text-white mb-6">Repartition des charges TVA</h1>

        {/* Selection de la periode */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Date de debut</label>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Date de fin</label>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600"
            />
          </div>
        </div>

        {/* Erreurs de validation */}
        {validationErrors.length > 0 && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500 rounded-lg">
            <h3 className="text-red-400 font-bold mb-2">Capacite depassee - Veuillez revoir le planning</h3>
            {validationErrors.map((error, index) => (
              <p key={index} className="text-red-300 text-sm">
                <strong>{error.collaborateur}</strong> : duree disponible sur la periode = {error.heuresDisponibles}h, vous avez reparti {error.heuresReparties}h (depassement de {error.depassement}h)
              </p>
            ))}
          </div>
        )}

        {/* Tableau des clients TVA */}
        {clientsTVA.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            Aucun client avec TVA. Allez dans la page Clients pour activer la TVA sur les clients concernes.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-600">
                    <th className="text-left py-3 px-2">Client</th>
                    <th className="text-left py-3 px-2" title="Defini dans l'onglet Impots et Taxes">Jour TVA</th>
                    <th className="text-left py-3 px-2">Duree (h)</th>
                    <th className="text-left py-3 px-2">Collaborateur</th>
                  </tr>
                </thead>
                <tbody>
                  {repartitionData.map((item, index) => (
                    <tr key={item.clientId} className="border-b border-slate-700">
                      <td className="py-3 px-2 text-white">{item.clientNom}</td>
                      <td className="py-3 px-2">
                        <span
                          className="bg-slate-600 text-emerald-300 rounded px-3 py-1 font-semibold"
                          title="Modifiable dans l'onglet Impots et Taxes"
                        >
                          {item.dateLimite}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={item.heures}
                          onChange={(e) => updateRepartition(index, 'heures', parseFloat(e.target.value) || 0)}
                          className="w-20 bg-slate-700 text-white rounded px-2 py-1 border border-slate-600 text-center"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <select
                          value={item.collaborateurId}
                          onChange={(e) => updateRepartition(index, 'collaborateurId', e.target.value)}
                          className="bg-slate-700 text-white rounded px-2 py-1 border border-slate-600"
                        >
                          <option value="">Selectionner...</option>
                          {equipeCollaborateurs.map(c => (
                            <option key={c.id} value={c.id}>{c.nom}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bouton de repartition */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={repartirCharges}
                disabled={isGenerating || !isDataComplete()}
                className={`px-6 py-3 rounded-lg font-bold transition flex items-center gap-2 ${
                  isGenerating || !isDataComplete()
                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                    : `${accent.color} text-white ${accent.hover}`
                }`}
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Repartition en cours...
                  </>
                ) : (
                  'Repartir les charges'
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Resume */}
      <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg p-4 border border-slate-700">
        <p className="text-slate-400 text-sm">
          Clients TVA : {clientsTVA.length} | Total heures prevues : {repartitionData.reduce((sum, item) => sum + (item.heures || 0), 0)}h
        </p>
      </div>
    </div>
  );
}

export default RepartitionTVAPage;
