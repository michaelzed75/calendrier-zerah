// @ts-check
import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Filter, Download, Eye, Pencil, Check, Trash2, ChevronDown, ChevronUp, AlertCircle, VolumeX, Volume2, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../supabaseClient';
import { AddChargeModal, EditChargeModal, ExportModal } from '../modals';
import { formatDateToYMD, parseDateString } from '../../utils/dateUtils';

/**
 * @typedef {import('../../types.js').Collaborateur} Collaborateur
 * @typedef {import('../../types.js').CollaborateurChef} CollaborateurChef
 * @typedef {import('../../types.js').Client} Client
 * @typedef {import('../../types.js').Charge} Charge
 * @typedef {import('../../types.js').ImpotsTaxes} ImpotsTaxes
 * @typedef {import('../../types.js').SuiviEcheance} SuiviEcheance
 * @typedef {import('../../types.js').AccentColor} AccentColor
 * @typedef {import('../../types.js').EcheanceFiscale} EcheanceFiscale
 * @typedef {import('../../types.js').TempsReel} TempsReel
 * @typedef {import('../../types.js').CalendarPageProps} CalendarPageProps
 */

/** @typedef {'month'|'week'|'day'} ViewMode */

// ============================================
// PAGE CALENDRIER
// ============================================

/**
 * Page principale du calendrier de gestion des charges
 * @param {CalendarPageProps} props
 * @returns {JSX.Element}
 */
function CalendarPage({ collaborateurs, collaborateurChefs, clients, charges, setCharges, getChefsOf, getEquipeOf, getAccessibleClients, accent, userCollaborateur, impotsTaxes, suiviEcheances, setSuiviEcheances }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filteredCollaborateurs, setFilteredCollaborateurs] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedCollaborateurs, setSelectedCollaborateurs] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [viewMode, setViewMode] = useState('month');
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(null);
  const [editingCharge, setEditingCharge] = useState(null);
  const [expandedEquipes, setExpandedEquipes] = useState({});
  const [prefilledDate, setPrefilledDate] = useState(null);
  const [draggedCharge, setDraggedCharge] = useState(null);
  const [dragOverDate, setDragOverDate] = useState(null);

  const activeCollaborateurs = collaborateurs.filter(c => c.actif);
  const activeClients = clients.filter(c => c.actif);
  const chefsMission = activeCollaborateurs.filter(c => c.est_chef_mission);

  // Calculer les collaborateurs visibles selon les droits de l'utilisateur
  const getVisibleCollaborateurs = () => {
    if (!userCollaborateur) return [];

    // Admin voit tout le monde
    if (userCollaborateur.is_admin) {
      return activeCollaborateurs;
    }

    const visibleIds = new Set();

    // L'utilisateur se voit toujours lui-même
    visibleIds.add(userCollaborateur.id);

    // Si c'est un chef de mission, il voit son équipe
    if (userCollaborateur.est_chef_mission) {
      const equipe = getEquipeOf(userCollaborateur.id);
      equipe.forEach(membre => visibleIds.add(membre.id));
    }

    // Tout collaborateur voit ses chefs
    const chefs = getChefsOf(userCollaborateur.id);
    chefs.forEach(chef => visibleIds.add(chef.id));

    // Et les membres de l'équipe de ses chefs (ses collègues)
    chefs.forEach(chef => {
      const equipeDuChef = getEquipeOf(chef.id);
      equipeDuChef.forEach(membre => visibleIds.add(membre.id));
    });

    return activeCollaborateurs.filter(c => visibleIds.has(c.id));
  };

  const visibleCollaborateurs = getVisibleCollaborateurs();
  const visibleChefsMission = visibleCollaborateurs.filter(c => c.est_chef_mission);

  // Charger les préférences utilisateur
  useEffect(() => {
    if (visibleCollaborateurs.length === 0) return;

    const saved = localStorage.getItem('userPreferences');
    if (saved) {
      const prefs = JSON.parse(saved);
      // Filtrer les collaborateurs sélectionnés pour ne garder que ceux visibles
      const visibleIds = visibleCollaborateurs.map(c => c.id);
      const filteredSelected = (prefs.selectedCollaborateurs || []).filter(id => visibleIds.includes(id));

      setCurrentUser(userCollaborateur?.id || prefs.currentUser);
      setViewMode('month');
      setSelectedCollaborateurs(filteredSelected.length > 0 ? filteredSelected : visibleIds);
      setExpandedEquipes(prefs.expandedEquipes || {});
    } else {
      setCurrentUser(userCollaborateur?.id || visibleCollaborateurs[0]?.id || 1);
      setSelectedCollaborateurs(visibleCollaborateurs.map(c => c.id));
      // Ouvrir toutes les équipes visibles par défaut
      const defaultExpanded = {};
      visibleChefsMission.forEach(chef => { defaultExpanded[chef.id] = true; });
      setExpandedEquipes(defaultExpanded);
    }
  }, [collaborateurs, userCollaborateur]);

  // Sauvegarder les préférences
  useEffect(() => {
    if (currentUser !== null) {
      localStorage.setItem('userPreferences', JSON.stringify({
        currentUser,
        viewMode,
        selectedCollaborateurs,
        expandedEquipes,
        selectedDay
      }));
    }
  }, [currentUser, viewMode, selectedCollaborateurs, expandedEquipes, selectedDay]);

  // Filtrer les collaborateurs visibles et sélectionnés
  useEffect(() => {
    const filtered = visibleCollaborateurs.filter(c => selectedCollaborateurs.includes(c.id));
    setFilteredCollaborateurs(filtered);
  }, [selectedCollaborateurs, visibleCollaborateurs]);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1 }, (_, i) => null);
  const allDays = [...emptyDays, ...monthDays];

  const getWeekDays = useCallback(() => {
    const today = new Date(currentDate);
    today.setDate(today.getDate() + weekOffset * 7);
    const first = today.getDate() - today.getDay() + 1;
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today.getFullYear(), today.getMonth(), first + i);
      weekDays.push(date);
    }
    return weekDays;
  }, [currentDate, weekOffset]);

  const getWeekLabel = () => {
    const days = getWeekDays();
    if (days.length === 0) return '';
    const start = days[0];
    const end = days[6];
    return `${start.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })} - ${end.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}`;
  };

  const weekDays = viewMode === 'week' ? getWeekDays() : [];

  const getDefaultDate = useCallback(() => {
    if (prefilledDate) {
      return prefilledDate;
    }
    if (viewMode === 'day' && selectedDay) {
      return selectedDay;
    } else if (viewMode === 'week') {
      const days = getWeekDays();
      if (days.length > 0) {
        return formatDateToYMD(days[0]);
      }
    }
    const today = new Date();
    return formatDateToYMD(today);
  }, [viewMode, selectedDay, getWeekDays, prefilledDate]);

  const openAddModalWithDate = useCallback((day) => {
    const dateStr = formatDateToYMD(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
    setPrefilledDate(dateStr);
    setShowAddModal(true);
  }, [currentDate]);

  const handleAddCharge = async (collaborateurId, clientId, date, heures, type = 'budgété', detail = '') => {
    const newCharge = {
      collaborateur_id: collaborateurId,
      client_id: clientId,
      date_charge: date,
      heures: parseFloat(heures),
      type: type,
      detail: detail,
      heures_realisees: 0
    };

    try {
      const { data, error } = await supabase.from('charges').insert([newCharge]).select();
      if (!error && data) {
        setCharges(prev => [...prev, data[0]]);
      }
    } catch (err) {
      console.error('Erreur ajout charge:', err);
    }
    setShowAddModal(false);
    setPrefilledDate(null);
  };

  const handleUpdateCharge = async (chargeId, collaborateurId, clientId, date, heures, type, detail) => {
    const updatedCharge = {
      collaborateur_id: collaborateurId,
      client_id: clientId,
      date_charge: date,
      heures: parseFloat(heures),
      type: type,
      detail: detail
    };

    setCharges(prev => prev.map(c => 
      c.id === chargeId ? { ...c, ...updatedCharge } : c
    ));

    try {
      await supabase.from('charges').update(updatedCharge).eq('id', chargeId);
    } catch (err) {
      console.error('Erreur mise à jour:', err);
    }
    
    setEditingCharge(null);
  };

  const handleDeleteCharge = useCallback(async (chargeId) => {
    setCharges(prev => prev.filter(c => c.id !== chargeId));

    try {
      await supabase.from('charges').delete().eq('id', chargeId);
    } catch (err) {
      console.error('Erreur suppression:', err);
    }
  }, [setCharges]);

  // Déplacer une charge à une nouvelle date (drag and drop)
  const handleMoveCharge = useCallback(async (chargeId, newDate) => {
    // Mise à jour optimiste
    setCharges(prev => prev.map(c =>
      c.id === chargeId ? { ...c, date_charge: newDate } : c
    ));

    try {
      const { error } = await supabase
        .from('charges')
        .update({ date_charge: newDate })
        .eq('id', chargeId);

      if (error) throw error;
    } catch (err) {
      console.error('Erreur déplacement charge:', err);
      // Recharger les données en cas d'erreur
    }
  }, [setCharges]);

  const getChargesForDay = useCallback((collaborateurId, day) => {
    const targetDate = formatDateToYMD(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
    return charges.filter(c => c.collaborateur_id === collaborateurId && c.date_charge === targetDate);
  }, [charges, currentDate]);

  const getChargesForDateStr = useCallback((collaborateurId, dateStr) => {
    return charges.filter(c => c.collaborateur_id === collaborateurId && c.date_charge === dateStr);
  }, [charges]);

  const getTotalHoursForDay = useCallback((collaborateurId, day) => {
    return getChargesForDay(collaborateurId, day).reduce((sum, c) => sum + parseFloat(c.heures), 0);
  }, [getChargesForDay]);

  const getTotalHoursForDateStr = useCallback((collaborateurId, dateStr) => {
    return getChargesForDateStr(collaborateurId, dateStr).reduce((sum, c) => sum + parseFloat(c.heures), 0);
  }, [getChargesForDateStr]);

  // Liste des collaborateurs en sourdine (stockée en localStorage)
  const [budgetSourdine, setBudgetSourdine] = useState(() => {
    const saved = localStorage.getItem('budgetSourdine');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('budgetSourdine', JSON.stringify(budgetSourdine));
  }, [budgetSourdine]);

  // Vérifier si un collaborateur a un budget saisi pour aujourd'hui
  const hasBudgetForToday = useCallback((collaborateurId) => {
    const today = formatDateToYMD(new Date());
    const budgetsToday = charges.filter(c =>
      c.collaborateur_id === collaborateurId &&
      c.date_charge === today
    );
    return budgetsToday.length > 0;
  }, [charges]);

  // Temps réels depuis Supabase
  const [tempsReelsLocal, setTempsReelsLocal] = useState([]);

  // Charger les temps réels depuis Supabase au démarrage et rafraîchir régulièrement
  useEffect(() => {
    const loadTempsReels = async () => {
      try {
        const { data, error } = await supabase
          .from('temps_reels')
          .select('*')
          .order('date', { ascending: false });

        if (!error && data) {
          setTempsReelsLocal(data);
        }
      } catch (err) {
        console.error('Erreur chargement temps réels:', err);
      }
    };

    // Charger au démarrage
    loadTempsReels();

    // Rafraîchir toutes les 30 secondes pour synchroniser avec les imports
    const interval = setInterval(loadTempsReels, 30000);

    return () => clearInterval(interval);
  }, []);

  // Vérifier si un collaborateur a des temps réels saisis pour J-1 (après 10h)
  const hasTempsReelsForYesterday = useCallback((collaborateurId) => {
    const now = new Date();
    // Seulement vérifier après 10h
    if (now.getHours() < 10) return true; // Pas d'alerte avant 10h

    // Calculer J-1 (hier)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDateToYMD(yesterday);

    // Vérifier si c'était un jour ouvré (lundi-vendredi)
    const dayOfWeek = yesterday.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return true; // Week-end, pas d'alerte

    // Chercher les temps réels pour ce collaborateur hier
    const tempsHier = tempsReelsLocal.filter(t =>
      t.collaborateur_id === collaborateurId &&
      t.date === yesterdayStr
    );

    const totalHeures = tempsHier.reduce((sum, t) => sum + (t.heures || 0), 0);
    return totalHeures > 0;
  }, [tempsReelsLocal]);

  // Vérifier si un collaborateur est en sourdine
  const isInSourdine = useCallback((collaborateurId) => {
    return budgetSourdine.includes(collaborateurId);
  }, [budgetSourdine]);

  // Toggle sourdine pour un collaborateur
  const toggleSourdine = useCallback((collaborateurId) => {
    setBudgetSourdine(prev =>
      prev.includes(collaborateurId)
        ? prev.filter(id => id !== collaborateurId)
        : [...prev, collaborateurId]
    );
  }, []);

  // Compter les alertes (collaborateurs sans budget aujourd'hui ou sans temps J-1, hors sourdine)
  const alertCount = visibleCollaborateurs.filter(c =>
    !isInSourdine(c.id) && (!hasBudgetForToday(c.id) || !hasTempsReelsForYesterday(c.id))
  ).length;

  const getAggregatedByClient = useCallback((collaborateurId, dateStr) => {
    const dayCharges = charges.filter(c => c.collaborateur_id === collaborateurId && c.date_charge === dateStr);
    const aggregated = {};
    dayCharges.forEach(charge => {
      const clientName = clients.find(c => c.id === charge.client_id)?.nom || 'Inconnu';
      if (!aggregated[clientName]) {
        aggregated[clientName] = 0;
      }
      aggregated[clientName] += parseFloat(charge.heures);
    });
    return Object.entries(aggregated).map(([client, heures]) => ({ client, heures }));
  }, [charges, clients]);

  const getTooltipForDay = useCallback((collaborateurId, day) => {
    const dayCharges = getChargesForDay(collaborateurId, day);
    if (dayCharges.length === 0) return '';
    return dayCharges.map(charge => {
      const clientName = clients.find(c => c.id === charge.client_id)?.nom || 'Inconnu';
      const detail = charge.detail ? ` - ${charge.detail}` : '';
      return `${clientName}: ${charge.heures}h${detail}`;
    }).join('\n');
  }, [getChargesForDay, clients]);

  const getWeekTotal = useCallback((collaborateurId) => {
    return weekDays.reduce((sum, date) => {
      const dateStr = formatDateToYMD(date);
      const dayTotal = charges
        .filter(c => c.collaborateur_id === collaborateurId && c.date_charge === dateStr)
        .reduce((daySum, c) => daySum + parseFloat(c.heures), 0);
      return sum + dayTotal;
    }, 0);
  }, [charges, weekDays]);

  // Calculer les échéances fiscales pour une date donnée
  const getEcheancesFiscales = useCallback((dateStr) => {
    const echeances = [];
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayOfMonth = date.getDate();
    const monthNum = date.getMonth() + 1; // 1-12
    const dayOfWeek = date.getDay(); // 0=Dim, 1=Lun, ...

    // Fonction helper: vérifie si une échéance théorique tombe sur cette date
    // En tenant compte du report dimanche → lundi
    const isEcheanceDay = (jourTheorique, moisCondition = true) => {
      if (!moisCondition) return false;

      // Créer la date théorique de l'échéance
      const dateTheorique = new Date(year, monthNum - 1, jourTheorique);
      const jourSemaineTheorique = dateTheorique.getDay();

      // Si l'échéance théorique tombe un dimanche, elle est reportée au lundi
      if (jourSemaineTheorique === 0) {
        // L'échéance est reportée au lundi (jour + 1)
        const dateLundi = new Date(dateTheorique);
        dateLundi.setDate(dateLundi.getDate() + 1);
        return dateLundi.getDate() === dayOfMonth && dateLundi.getMonth() + 1 === monthNum;
      }

      // Sinon, l'échéance reste au jour prévu
      return dayOfMonth === jourTheorique;
    };

    // Clients du chef de mission connecté
    const mesClients = clients.filter(c =>
      c.actif &&
      (c.chef_mission_id === userCollaborateur?.id || !c.chef_mission_id)
    );

    // Pour chaque client, vérifier les échéances
    mesClients.forEach(client => {
      const data = impotsTaxes.find(it => it.client_id === client.id && it.annee_fiscale === year);
      if (!data) return;

      // TVA
      if (data.tva_jour && data.tva_periodicite) {
        const tvaJour = parseInt(data.tva_jour);
        let isTvaDay = false;

        if (data.tva_periodicite === 'mensuel' && isEcheanceDay(tvaJour, true)) {
          isTvaDay = true;
        } else if (data.tva_periodicite === 'trimestriel' && isEcheanceDay(tvaJour, [1, 4, 7, 10].includes(monthNum))) {
          isTvaDay = true;
        }

        if (isTvaDay) {
          echeances.push({ clientId: client.id, client: client.nom, type: 'TVA', montant: null, dateEcheance: dateStr });
        }

        // CA12 (régime simplifié) - acomptes fixes en juillet et décembre (dates réglementaires)
        if (data.tva_periodicite === 'ca12') {
          // Acomptes CA12: 55% en juillet, 40% en décembre - dates fixes au 15 du mois
          if (isEcheanceDay(15, [7, 12].includes(monthNum))) {
            echeances.push({ clientId: client.id, client: client.nom, type: 'TVA Ac.', montant: null, dateEcheance: dateStr });
          }
          // Déclaration CA12 - 2ème jour ouvré après 1er mai si clôture décembre, sinon 3 mois après clôture
          const moisClotureNomTVA = data.mois_cloture || 'Décembre';
          const moisMapTVA = {
            'Janvier': 1, 'Février': 2, 'Mars': 3, 'Avril': 4, 'Mai': 5, 'Juin': 6,
            'Juillet': 7, 'Août': 8, 'Septembre': 9, 'Octobre': 10, 'Novembre': 11, 'Décembre': 12
          };
          const moisClotureNumTVA = moisMapTVA[moisClotureNomTVA] || 12;

          if (moisClotureNumTVA === 12) {
            // Clôture décembre → CA12 le 3 mai (2ème jour ouvré après 1er mai)
            if (isEcheanceDay(3, monthNum === 5)) {
              echeances.push({ clientId: client.id, client: client.nom, type: 'CA12', montant: null, dateEcheance: dateStr });
            }
          } else {
            // Autres clôtures → CA12 E dans les 3 mois après clôture (dernier jour du 3ème mois)
            let moisCA12 = moisClotureNumTVA + 3;
            if (moisCA12 > 12) moisCA12 -= 12;
            const dernierJourCA12 = new Date(year, moisCA12, 0).getDate();
            if (isEcheanceDay(dernierJourCA12, monthNum === moisCA12)) {
              echeances.push({ clientId: client.id, client: client.nom, type: 'CA12 E', montant: null, dateEcheance: dateStr });
            }
          }
        }
      }

      // IS Acomptes - dates fixes: 15/03, 15/06, 15/09, 15/12
      if (data.soumis_is) {
        if (isEcheanceDay(15, monthNum === 3) && data.is_acompte_03) {
          echeances.push({ clientId: client.id, client: client.nom, type: 'IS', montant: data.is_acompte_03, dateEcheance: dateStr });
        }
        if (isEcheanceDay(15, monthNum === 6) && data.is_acompte_06) {
          echeances.push({ clientId: client.id, client: client.nom, type: 'IS', montant: data.is_acompte_06, dateEcheance: dateStr });
        }
        if (isEcheanceDay(15, monthNum === 9) && data.is_acompte_09) {
          echeances.push({ clientId: client.id, client: client.nom, type: 'IS', montant: data.is_acompte_09, dateEcheance: dateStr });
        }
        if (isEcheanceDay(15, monthNum === 12) && data.is_acompte_12) {
          echeances.push({ clientId: client.id, client: client.nom, type: 'IS', montant: data.is_acompte_12, dateEcheance: dateStr });
        }
      }

      // IS Solde - 15 du 4ème mois après clôture (ou 15/05 si clôture Décembre)
      if (data.soumis_is) {
        const moisClotureNom = data.mois_cloture || 'Décembre';
        const moisMap = {
          'Janvier': 1, 'Février': 2, 'Mars': 3, 'Avril': 4, 'Mai': 5, 'Juin': 6,
          'Juillet': 7, 'Août': 8, 'Septembre': 9, 'Octobre': 10, 'Novembre': 11, 'Décembre': 12
        };
        const moisClotureNum = moisMap[moisClotureNom] || 12;

        if (moisClotureNum === 12) {
          // Clôture Décembre → solde 15/05
          if (isEcheanceDay(15, monthNum === 5)) {
            echeances.push({ clientId: client.id, client: client.nom, type: 'IS Solde', montant: null, dateEcheance: dateStr });
          }
        } else {
          // Autres clôtures → 15 du 4ème mois suivant
          let moisSolde = moisClotureNum + 4;
          if (moisSolde > 12) moisSolde -= 12;
          if (isEcheanceDay(15, monthNum === moisSolde)) {
            echeances.push({ clientId: client.id, client: client.nom, type: 'IS Solde', montant: null, dateEcheance: dateStr });
          }
        }
      }

      // Liasse fiscale - basée sur mois_cloture (+15 jours télétransmission expert-comptable)
      // Clôture décembre → 5 mai + 15 jours = 20 mai
      // Autres clôtures → 3 mois après + 15 jours
      const moisClotureNomLiasse = data.mois_cloture || 'Décembre';
      const moisMapLiasse = {
        'Janvier': 1, 'Février': 2, 'Mars': 3, 'Avril': 4, 'Mai': 5, 'Juin': 6,
        'Juillet': 7, 'Août': 8, 'Septembre': 9, 'Octobre': 10, 'Novembre': 11, 'Décembre': 12
      };
      const moisClotureNumLiasse = moisMapLiasse[moisClotureNomLiasse] || 12;

      if (moisClotureNumLiasse === 12) {
        // Clôture décembre → liasse 20/05 (5 mai + 15 jours télétransmission)
        if (isEcheanceDay(20, monthNum === 5)) {
          echeances.push({ clientId: client.id, client: client.nom, type: 'Liasse', montant: null, dateEcheance: dateStr });
        }
      } else {
        // Autres clôtures → 3 mois après la clôture + 15 jours
        let moisLiasse = moisClotureNumLiasse + 3;
        if (moisLiasse > 12) moisLiasse -= 12;
        // Dernier jour du 3e mois + 15 jours = 15 du 4e mois
        let moisLiasse15 = moisLiasse + 1;
        if (moisLiasse15 > 12) moisLiasse15 -= 12;
        if (isEcheanceDay(15, monthNum === moisLiasse15)) {
          echeances.push({ clientId: client.id, client: client.nom, type: 'Liasse', montant: null, dateEcheance: dateStr });
        }
      }

      // CFE - 15/12 toujours, + 15/06 si montant N-1 > 3000€
      if (data.cfe_montant_n1) {
        if (isEcheanceDay(15, monthNum === 12)) {
          echeances.push({ clientId: client.id, client: client.nom, type: 'CFE', montant: data.cfe_montant_n1, dateEcheance: dateStr });
        }
        if (data.cfe_montant_n1 > 3000 && isEcheanceDay(15, monthNum === 6)) {
          echeances.push({ clientId: client.id, client: client.nom, type: 'CFE Ac.', montant: Math.round(data.cfe_montant_n1 / 2), dateEcheance: dateStr });
        }
      }

      // CVAE - 15/06, 15/09, 03/05
      if (data.cvae) {
        if (isEcheanceDay(15, monthNum === 6) || isEcheanceDay(15, monthNum === 9)) {
          echeances.push({ clientId: client.id, client: client.nom, type: 'CVAE', montant: null, dateEcheance: dateStr });
        }
        if (isEcheanceDay(3, monthNum === 5)) {
          echeances.push({ clientId: client.id, client: client.nom, type: 'CVAE Sol.', montant: null, dateEcheance: dateStr });
        }
      }

      // TVTS - 15/01
      if (data.tvts && isEcheanceDay(15, monthNum === 1)) {
        echeances.push({ clientId: client.id, client: client.nom, type: 'TVTS', montant: null, dateEcheance: dateStr });
      }

      // DAS2 - 01/05
      if (data.das2 && isEcheanceDay(1, monthNum === 5)) {
        echeances.push({ clientId: client.id, client: client.nom, type: 'DAS2', montant: null, dateEcheance: dateStr });
      }

      // Taxe sur les salaires - 10/01
      if (data.taxe_salaires && isEcheanceDay(10, monthNum === 1)) {
        echeances.push({ clientId: client.id, client: client.nom, type: 'Taxe Salaires', montant: null, dateEcheance: dateStr });
      }

      // IFU - 15/02
      if (data.ifu && isEcheanceDay(15, monthNum === 2)) {
        echeances.push({ clientId: client.id, client: client.nom, type: 'IFU', montant: null, dateEcheance: dateStr });
      }
    });

    return echeances;
  }, [clients, impotsTaxes, userCollaborateur]);

  // Vérifier si une échéance est faite
  const isEcheanceFaite = useCallback((clientId, typeEcheance, dateEcheance) => {
    return suiviEcheances.some(s =>
      s.client_id === clientId &&
      s.type_echeance === typeEcheance &&
      s.date_echeance === dateEcheance
    );
  }, [suiviEcheances]);

  // Toggle le suivi d'une échéance
  const toggleSuiviEcheance = async (clientId, typeEcheance, dateEcheance, anneeFiscale) => {
    const existing = suiviEcheances.find(s =>
      s.client_id === clientId &&
      s.type_echeance === typeEcheance &&
      s.date_echeance === dateEcheance
    );

    try {
      if (existing) {
        // Supprimer le suivi
        const { error } = await supabase
          .from('suivi_echeances')
          .delete()
          .eq('id', existing.id);

        if (error) throw error;
        setSuiviEcheances(prev => prev.filter(s => s.id !== existing.id));
      } else {
        // Créer le suivi
        const { data, error } = await supabase
          .from('suivi_echeances')
          .insert({
            client_id: clientId,
            type_echeance: typeEcheance,
            date_echeance: dateEcheance,
            fait_par_id: userCollaborateur?.id,
            fait_le: new Date().toISOString(),
            annee_fiscale: anneeFiscale
          })
          .select()
          .single();

        if (error) throw error;
        setSuiviEcheances(prev => [...prev, data]);
      }
    } catch (err) {
      console.error('Erreur toggle suivi échéance:', err);
    }
  };

  const handleNavigateWeek = (direction) => {
    setWeekOffset(weekOffset + direction);
  };

  const openDayView = (day) => {
    const dateStr = formatDateToYMD(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
    setSelectedDay(dateStr);
    setViewMode('day');
  };

  const openDayViewFromDate = (date) => {
    const dateStr = formatDateToYMD(date);
    setSelectedDay(dateStr);
    setViewMode('day');
  };

  const navigateDay = (direction) => {
    const current = parseDateString(selectedDay);
    current.setDate(current.getDate() + direction);
    setSelectedDay(formatDateToYMD(current));
  };

  const switchToView = (newView) => {
    if (newView === 'day' && !selectedDay) {
      const today = new Date();
      if (today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear()) {
        setSelectedDay(formatDateToYMD(today));
      } else {
        setSelectedDay(formatDateToYMD(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)));
      }
    }
    if (newView === 'week') {
      // Calculer l'offset pour afficher la semaine contenant aujourd'hui
      const today = new Date();
      const baseDate = new Date(currentDate);
      // Trouver le lundi de la semaine de baseDate
      const baseDayOfWeek = baseDate.getDay();
      const baseMonday = new Date(baseDate);
      baseMonday.setDate(baseDate.getDate() - (baseDayOfWeek === 0 ? 6 : baseDayOfWeek - 1));
      // Trouver le lundi de la semaine d'aujourd'hui
      const todayDayOfWeek = today.getDay();
      const todayMonday = new Date(today);
      todayMonday.setDate(today.getDate() - (todayDayOfWeek === 0 ? 6 : todayDayOfWeek - 1));
      // Calculer la différence en semaines
      const diffTime = todayMonday.getTime() - baseMonday.getTime();
      const diffWeeks = Math.round(diffTime / (1000 * 60 * 60 * 24 * 7));
      setWeekOffset(diffWeeks);
    }
    setViewMode(newView);
  };

  // Toggle équipe dans le filtre
  const toggleEquipe = (chefId) => {
    setExpandedEquipes(prev => ({ ...prev, [chefId]: !prev[chefId] }));
  };

  // Sélectionner toute une équipe
  const selectEquipe = (chefId, select) => {
    const equipe = getEquipeOf(chefId);
    const equipeIds = [chefId, ...equipe.map(m => m.id)];
    
    if (select) {
      setSelectedCollaborateurs(prev => [...new Set([...prev, ...equipeIds])]);
    } else {
      setSelectedCollaborateurs(prev => prev.filter(id => !equipeIds.includes(id)));
    }
  };

  const exportToExcel = (startDateStr, endDateStr) => {
    const data = [];
    
    filteredCollaborateurs.forEach(collab => {
      const chargesForCollab = charges.filter(c => {
        return c.collaborateur_id === collab.id &&
               c.date_charge >= startDateStr &&
               c.date_charge <= endDateStr;
      });

      chargesForCollab.forEach(charge => {
        const displayDate = parseDateString(charge.date_charge);
        data.push({
          'Collaborateur': collab.nom,
          'Client': clients.find(cl => cl.id === charge.client_id)?.nom || '',
          'Date': displayDate.toLocaleDateString('fr-FR'),
          'Budgété (h)': charge.heures,
          'Réalisé (h)': charge.heures_realisees || 0,
          'Écart (h)': (charge.heures - (charge.heures_realisees || 0)).toFixed(2),
          'Type': charge.type,
          'Détail': charge.detail || ''
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Charges');
    
    const fileName = `Charges_${startDateStr}_${endDateStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    setShowExportModal(false);
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Calendrier d'équipe</h2>
          <p className="text-slate-400">Gestion des charges de travail par collaborateur</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 mb-6 border border-slate-700 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {viewMode === 'day' && selectedDay ? (
              <>
                <button onClick={() => navigateDay(-1)} className="p-2 hover:bg-slate-700 rounded-lg transition text-white">
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-xl font-semibold text-white min-w-48 text-center">
                  {parseDateString(selectedDay).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </h2>
                <button onClick={() => navigateDay(1)} className="p-2 hover:bg-slate-700 rounded-lg transition text-white">
                  <ChevronRight size={20} />
                </button>
              </>
            ) : viewMode === 'week' ? (
              <>
                <button onClick={() => handleNavigateWeek(-1)} className="p-2 hover:bg-slate-700 rounded-lg transition text-white">
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-xl font-semibold text-white min-w-48 text-center">
                  Semaine du {getWeekLabel()}
                </h2>
                <button onClick={() => handleNavigateWeek(1)} className="p-2 hover:bg-slate-700 rounded-lg transition text-white">
                  <ChevronRight size={20} />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))} className="p-2 hover:bg-slate-700 rounded-lg transition text-white">
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-xl font-semibold text-white min-w-48 text-center">
                  {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </h2>
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))} className="p-2 hover:bg-slate-700 rounded-lg transition text-white">
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>

          <div className="flex gap-3 flex-wrap">
            {filteredCollaborateurs.length > 0 && (
              <select value={currentUser || ''} onChange={(e) => setCurrentUser(parseInt(e.target.value))} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition">
                {filteredCollaborateurs.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            )}

            <div className="flex rounded-lg overflow-hidden border border-slate-600">
              <button
                onClick={() => switchToView('month')}
                className={`px-4 py-2 text-sm font-medium transition ${
                  viewMode === 'month' ? `${accent.color} text-white` : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Mois
              </button>
              <button
                onClick={() => switchToView('week')}
                className={`px-4 py-2 text-sm font-medium transition border-l border-slate-600 ${
                  viewMode === 'week' ? `${accent.color} text-white` : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Semaine
              </button>
              <button
                onClick={() => switchToView('day')}
                className={`px-4 py-2 text-sm font-medium transition border-l border-slate-600 ${
                  viewMode === 'day' ? `${accent.color} text-white` : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Jour
              </button>
            </div>

            <button onClick={() => setShowFilterModal(!showFilterModal)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition relative">
              <Filter size={18} />
              Filtrer ({selectedCollaborateurs.length})
              {alertCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {alertCount}
                </span>
              )}
            </button>

            <button onClick={() => setShowExportModal(true)} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition">
              <Download size={18} />
              Export
            </button>

            <button onClick={() => setShowAddModal(true)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition">
              <Plus size={18} />
              Ajouter
            </button>
          </div>
        </div>

        {/* FILTRE PAR ÉQUIPE */}
        {showFilterModal && (
          <div className="bg-slate-800 rounded-lg p-6 mb-6 border border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Filtrer par équipe</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedCollaborateurs(visibleCollaborateurs.map(c => c.id))}
                  className="text-sm bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded transition"
                >
                  Tout sélectionner
                </button>
                <button
                  onClick={() => setSelectedCollaborateurs([])}
                  className="text-sm bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded transition"
                >
                  Tout désélectionner
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {visibleChefsMission.map(chef => {
                const equipe = getEquipeOf(chef.id).filter(m => visibleCollaborateurs.some(v => v.id === m.id));
                const visibleIds = visibleCollaborateurs.map(v => v.id);
                const isExpanded = expandedEquipes[chef.id];
                const teamIds = [chef.id, ...equipe.map(m => m.id)].filter(id => visibleIds.includes(id));
                const allSelected = teamIds.every(id => selectedCollaborateurs.includes(id));
                const someSelected = teamIds.some(id => selectedCollaborateurs.includes(id));

                return (
                  <div key={chef.id} className="bg-slate-700 rounded-lg overflow-hidden">
                    {/* En-tête équipe */}
                    <div className="flex items-center justify-between p-3 bg-slate-600">
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleEquipe(chef.id)} className="text-white">
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                          onChange={(e) => selectEquipe(chef.id, e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-white font-semibold">Équipe {chef.nom}</span>
                        <span className="text-slate-400 text-sm">({equipe.length + 1} personnes)</span>
                      </div>
                    </div>

                    {/* Membres de l'équipe */}
                    {isExpanded && (
                      <div className="p-3 space-y-2">
                        {/* Le chef lui-même */}
                        <div className="flex items-center gap-2 pl-8">
                          <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white flex-1">
                            <input
                              type="checkbox"
                              checked={selectedCollaborateurs.includes(chef.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedCollaborateurs(prev => [...prev, chef.id]);
                                else setSelectedCollaborateurs(prev => prev.filter(id => id !== chef.id));
                              }}
                              className="rounded"
                            />
                            <span>{chef.nom}</span>
                            <span className="text-xs bg-purple-600/30 text-purple-300 px-1.5 py-0.5 rounded">Chef</span>
                            {!isInSourdine(chef.id) && (
                              <>
                                {hasBudgetForToday(chef.id) ? (
                                  <span className="text-xs bg-green-600/30 text-green-300 px-1.5 py-0.5 rounded" title="Budget saisi aujourd'hui">
                                    ✓ Budget
                                  </span>
                                ) : (
                                  <span className="text-xs bg-orange-600/30 text-orange-300 px-1.5 py-0.5 rounded" title="Pas de budget saisi aujourd'hui">
                                    ⚠ Budget
                                  </span>
                                )}
                                {hasTempsReelsForYesterday(chef.id) ? (
                                  <span className="text-xs bg-green-600/30 text-green-300 px-1.5 py-0.5 rounded" title="Temps réels J-1 saisis">
                                    ✓ Temps
                                  </span>
                                ) : (
                                  <span className="text-xs bg-red-600/30 text-red-300 px-1.5 py-0.5 rounded" title="Temps réels J-1 non saisis">
                                    ⚠ Temps
                                  </span>
                                )}
                              </>
                            )}
                            {isInSourdine(chef.id) && (
                              <span className="text-xs bg-slate-600/30 text-slate-400 px-1.5 py-0.5 rounded" title="Alertes désactivées">
                                <VolumeX size={12} className="inline" /> Sourdine
                              </span>
                            )}
                          </label>
                          {userCollaborateur?.is_admin && (
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleSourdine(chef.id); }}
                              className={`p-1.5 rounded transition ${isInSourdine(chef.id) ? 'bg-orange-600/30 text-orange-400 hover:bg-orange-600/50' : 'bg-slate-600/30 text-slate-400 hover:bg-slate-600/50 hover:text-green-400'}`}
                              title={isInSourdine(chef.id) ? 'Réactiver les alertes' : 'Mettre en sourdine'}
                            >
                              {isInSourdine(chef.id) ? <VolumeX size={14} /> : <Volume2 size={14} />}
                            </button>
                          )}
                        </div>

                        {/* Les membres visibles */}
                        {equipe.filter(m => m.actif).map(membre => (
                          <div key={membre.id} className="flex items-center gap-2 pl-8">
                            <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white flex-1">
                              <input
                                type="checkbox"
                                checked={selectedCollaborateurs.includes(membre.id)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedCollaborateurs(prev => [...prev, membre.id]);
                                  else setSelectedCollaborateurs(prev => prev.filter(id => id !== membre.id));
                                }}
                                className="rounded"
                              />
                              <span>{membre.nom}</span>
                              {!isInSourdine(membre.id) && (
                                <>
                                  {hasBudgetForToday(membre.id) ? (
                                    <span className="text-xs bg-green-600/30 text-green-300 px-1.5 py-0.5 rounded" title="Budget saisi aujourd'hui">
                                      ✓ Budget
                                    </span>
                                  ) : (
                                    <span className="text-xs bg-orange-600/30 text-orange-300 px-1.5 py-0.5 rounded" title="Pas de budget saisi aujourd'hui">
                                      ⚠ Budget
                                    </span>
                                  )}
                                  {hasTempsReelsForYesterday(membre.id) ? (
                                    <span className="text-xs bg-green-600/30 text-green-300 px-1.5 py-0.5 rounded" title="Temps réels J-1 saisis">
                                      ✓ Temps
                                    </span>
                                  ) : (
                                    <span className="text-xs bg-red-600/30 text-red-300 px-1.5 py-0.5 rounded" title="Temps réels J-1 non saisis">
                                      ⚠ Temps
                                    </span>
                                  )}
                                </>
                              )}
                              {isInSourdine(membre.id) && (
                                <span className="text-xs bg-slate-600/30 text-slate-400 px-1.5 py-0.5 rounded" title="Alertes désactivées">
                                  <VolumeX size={12} className="inline" /> Sourdine
                                </span>
                              )}
                            </label>
                            {userCollaborateur?.is_admin && (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleSourdine(membre.id); }}
                                className={`p-1.5 rounded transition ${isInSourdine(membre.id) ? 'bg-orange-600/30 text-orange-400 hover:bg-orange-600/50' : 'bg-slate-600/30 text-slate-400 hover:bg-slate-600/50 hover:text-green-400'}`}
                                title={isInSourdine(membre.id) ? 'Réactiver les alertes' : 'Mettre en sourdine'}
                              >
                                {isInSourdine(membre.id) ? <VolumeX size={14} /> : <Volume2 size={14} />}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Collaborateurs sans chef (autonomes) - visibles uniquement */}
              {(() => {
                const collabsAvecChef = collaborateurChefs.map(cc => cc.collaborateur_id);
                const autonomes = visibleCollaborateurs.filter(c => !c.est_chef_mission && !collabsAvecChef.includes(c.id));
                
                if (autonomes.length === 0) return null;
                
                return (
                  <div className="bg-slate-700 rounded-lg p-3">
                    <div className="text-slate-400 text-sm mb-2">Autres collaborateurs</div>
                    {autonomes.map(collab => (
                      <div key={collab.id} className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white flex-1">
                          <input
                            type="checkbox"
                            checked={selectedCollaborateurs.includes(collab.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedCollaborateurs(prev => [...prev, collab.id]);
                              else setSelectedCollaborateurs(prev => prev.filter(id => id !== collab.id));
                            }}
                            className="rounded"
                          />
                          <span>{collab.nom}</span>
                          {!isInSourdine(collab.id) && (
                            <>
                              {hasBudgetForToday(collab.id) ? (
                                <span className="text-xs bg-green-600/30 text-green-300 px-1.5 py-0.5 rounded" title="Budget saisi aujourd'hui">
                                  ✓ Budget
                                </span>
                              ) : (
                                <span className="text-xs bg-orange-600/30 text-orange-300 px-1.5 py-0.5 rounded" title="Pas de budget saisi aujourd'hui">
                                  ⚠ Budget
                                </span>
                              )}
                              {hasTempsReelsForYesterday(collab.id) ? (
                                <span className="text-xs bg-green-600/30 text-green-300 px-1.5 py-0.5 rounded" title="Temps réels J-1 saisis">
                                  ✓ Temps
                                </span>
                              ) : (
                                <span className="text-xs bg-red-600/30 text-red-300 px-1.5 py-0.5 rounded" title="Temps réels J-1 non saisis">
                                  ⚠ Temps
                                </span>
                              )}
                            </>
                          )}
                          {isInSourdine(collab.id) && (
                            <span className="text-xs bg-slate-600/30 text-slate-400 px-1.5 py-0.5 rounded" title="Alertes désactivées">
                              <VolumeX size={12} className="inline" /> Sourdine
                            </span>
                          )}
                        </label>
                        {userCollaborateur?.is_admin && (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleSourdine(collab.id); }}
                            className={`p-1.5 rounded transition ${isInSourdine(collab.id) ? 'bg-orange-600/30 text-orange-400 hover:bg-orange-600/50' : 'bg-slate-600/30 text-slate-400 hover:bg-slate-600/50 hover:text-green-400'}`}
                            title={isInSourdine(collab.id) ? 'Réactiver les alertes' : 'Mettre en sourdine'}
                          >
                            {isInSourdine(collab.id) ? <VolumeX size={14} /> : <Volume2 size={14} />}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {showAddModal && (
          <AddChargeModal
            clients={getAccessibleClients(userCollaborateur)}
            collaborateurs={filteredCollaborateurs}
            defaultDate={getDefaultDate()}
            onAdd={handleAddCharge}
            onClose={() => { setShowAddModal(false); setPrefilledDate(null); }}
          />
        )}

        {editingCharge && (
          <EditChargeModal
            charge={editingCharge}
            clients={getAccessibleClients(userCollaborateur)}
            collaborateurs={filteredCollaborateurs}
            onUpdate={handleUpdateCharge}
            onClose={() => setEditingCharge(null)}
          />
        )}

        {showExportModal && (
          <ExportModal 
            viewMode={viewMode} 
            currentDate={currentDate} 
            weekDays={weekDays} 
            onExport={exportToExcel} 
            onClose={() => setShowExportModal(false)} 
          />
        )}

        {/* VUE MOIS */}
        {viewMode === 'month' && (
          <div className="grid grid-cols-7 gap-1 mb-6 bg-slate-800 p-4 rounded-lg border border-slate-700">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
              <div key={day} className="text-center text-slate-400 text-sm font-semibold py-2">{day}</div>
            ))}
            {allDays.map((day, idx) => {
              const dateStr = day ? formatDateToYMD(new Date(currentDate.getFullYear(), currentDate.getMonth(), day)) : null;
              const echeances = dateStr ? getEcheancesFiscales(dateStr) : [];
              return (
                <div
                  key={idx}
                  className="bg-slate-700 min-h-32 rounded-lg border border-slate-600 flex flex-col"
                >
                  {day && (
                    <>
                      {/* Partie haute - Échéances fiscales (fond vert) */}
                      {echeances.length > 0 && (
                        <div className="bg-emerald-900/60 rounded-t-lg p-1 border-b border-emerald-700/50">
                          <div className="space-y-0.5 max-h-16 overflow-y-auto">
                            {echeances.slice(0, 3).map((ech, echIdx) => {
                              const isFait = isEcheanceFaite(ech.clientId, ech.type, ech.dateEcheance);
                              return (
                                <div
                                  key={echIdx}
                                  className={`text-xs truncate px-1 flex items-center gap-1 ${isFait ? 'text-emerald-400/50 line-through' : 'text-emerald-200'}`}
                                  title={`${ech.client} - ${ech.type}${ech.montant ? ` : ${ech.montant}€` : ''}`}
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleSuiviEcheance(ech.clientId, ech.type, ech.dateEcheance, currentDate.getFullYear());
                                    }}
                                    className={`w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center ${
                                      isFait
                                        ? 'bg-emerald-500 border-emerald-500'
                                        : 'border-emerald-400 hover:bg-emerald-700/50'
                                    }`}
                                    title={isFait ? 'Marquer comme non fait' : 'Marquer comme fait'}
                                  >
                                    {isFait && <Check size={8} className="text-white" />}
                                  </button>
                                  <span className={`font-semibold ${isFait ? 'text-emerald-500/50' : 'text-emerald-300'}`}>{ech.type}</span>
                                  {ech.montant && <span className="ml-1">{ech.montant}€</span>}
                                  <span className="text-emerald-400/70 text-[10px]">{ech.client.substring(0, 8)}</span>
                                </div>
                              );
                            })}
                            {echeances.length > 3 && (
                              <div className="text-[10px] text-emerald-400/70 px-1">+{echeances.length - 3} autres</div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Partie basse - Charges */}
                      <div className={`p-2 flex-1 ${echeances.length === 0 ? 'rounded-lg' : ''}`}>
                        <div className="flex justify-between items-center mb-2">
                          <span
                            className="text-white font-bold text-lg cursor-pointer hover:text-green-400 transition"
                            onClick={() => openAddModalWithDate(day)}
                            title="Ajouter une charge"
                          >
                            {day}
                          </span>
                          <button
                            onClick={() => openDayView(day)}
                            className="text-slate-400 hover:text-white p-1 hover:bg-slate-600 rounded transition"
                            title="Voir détails"
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                        <div className="space-y-0.5">
                          {filteredCollaborateurs.map(collab => {
                            const total = getTotalHoursForDay(collab.id, day);
                            if (total === 0) return null;
                            return (
                              <div
                                key={collab.id}
                                className="flex justify-between text-xs bg-slate-600 px-1 rounded cursor-pointer hover:bg-slate-500"
                                onClick={() => openDayView(day)}
                              >
                                <span className="truncate text-slate-300">{collab.nom.split(' ')[0]}</span>
                                <span className={total > 8 ? 'text-red-400' : 'text-green-300'}>{total}h</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* VUE SEMAINE */}
        {viewMode === 'week' && (
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 overflow-x-auto">
            <div className="min-w-full">
              <div className="flex gap-2 mb-4">
                <div className="w-28 flex-shrink-0">
                  <div className="font-bold text-white text-sm">Collab.</div>
                </div>
                {weekDays.map(date => (
                  <div key={formatDateToYMD(date)} className="flex-1 min-w-36">
                    <div 
                      className="font-semibold text-white text-sm cursor-pointer hover:text-blue-300 transition"
                      onClick={() => openDayViewFromDate(date)}
                    >
                      {date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
                    </div>
                  </div>
                ))}
                <div className="w-20 flex-shrink-0">
                  <div className="font-bold text-green-300 text-sm text-center">Total</div>
                </div>
              </div>

              {filteredCollaborateurs.map(collab => (
                <div key={collab.id} className="flex gap-2 mb-3 bg-slate-700 p-3 rounded">
                  <div className="w-28 flex-shrink-0">
                    <div className="text-blue-300 font-semibold text-sm">{collab.nom}</div>
                  </div>
                  {weekDays.map(date => {
                    const dateStr = formatDateToYMD(date);
                    const dayCharges = getChargesForDateStr(collab.id, dateStr);
                    const dayTotal = getTotalHoursForDateStr(collab.id, dateStr);
                    const isDropTarget = draggedCharge && draggedCharge.collaborateur_id === collab.id && dragOverDate === dateStr;
                    return (
                      <div
                        key={dateStr}
                        className={`flex-1 min-w-36 rounded p-1 transition min-h-[60px] ${
                          isDropTarget
                            ? 'bg-green-600/30 border-2 border-dashed border-green-400'
                            : 'hover:bg-slate-600'
                        }`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (draggedCharge && draggedCharge.collaborateur_id === collab.id) {
                            setDragOverDate(dateStr);
                          }
                        }}
                        onDragLeave={() => setDragOverDate(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedCharge && draggedCharge.collaborateur_id === collab.id && draggedCharge.date_charge !== dateStr) {
                            handleMoveCharge(draggedCharge.id, dateStr);
                          }
                          setDraggedCharge(null);
                          setDragOverDate(null);
                        }}
                      >
                        <div
                          className={`text-sm font-bold mb-1 cursor-pointer ${dayTotal > 8 ? 'text-red-400' : 'text-slate-300'}`}
                          onClick={() => openDayViewFromDate(date)}
                        >
                          {dayTotal > 0 ? `${dayTotal}h` : '-'}
                        </div>
                        {dayCharges.length > 0 && (
                          <div className="space-y-0.5">
                            {dayCharges.slice(0, 4).map((charge) => (
                              <div
                                key={charge.id}
                                draggable
                                onDragStart={(e) => {
                                  setDraggedCharge(charge);
                                  e.dataTransfer.effectAllowed = 'move';
                                }}
                                onDragEnd={() => {
                                  setDraggedCharge(null);
                                  setDragOverDate(null);
                                }}
                                className={`text-xs px-1 py-0.5 rounded truncate cursor-grab active:cursor-grabbing ${
                                  draggedCharge?.id === charge.id
                                    ? 'bg-blue-500/50 text-blue-200 opacity-50'
                                    : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                                }`}
                                title={`${clients.find(c => c.id === charge.client_id)?.nom || 'Inconnu'} - ${charge.heures}h - Glisser pour déplacer`}
                              >
                                {(clients.find(c => c.id === charge.client_id)?.nom || '?').substring(0, 8)}: {charge.heures}h
                              </div>
                            ))}
                            {dayCharges.length > 4 && (
                              <div className="text-xs text-slate-500">+{dayCharges.length - 4} autres</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="w-20 flex-shrink-0 flex items-center justify-center">
                    <div className={`text-sm font-bold ${getWeekTotal(collab.id) > 40 ? 'text-red-400' : 'text-green-300'}`}>
                      {getWeekTotal(collab.id)}h
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VUE JOUR */}
        {viewMode === 'day' && selectedDay && (
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="space-y-6">
              {filteredCollaborateurs.map(collab => {
                const dayCharges = getChargesForDateStr(collab.id, selectedDay);
                const totalHours = dayCharges.reduce((sum, c) => sum + parseFloat(c.heures), 0);
                
                return (
                  <div key={collab.id} className="bg-slate-700 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-blue-300">{collab.nom}</h3>
                      <span className={`text-lg font-bold ${totalHours > 8 ? 'text-red-400' : 'text-green-300'}`}>
                        Total: {totalHours}h
                      </span>
                    </div>
                    
                    {dayCharges.length === 0 ? (
                      <div className="text-slate-400 text-sm italic">Aucune charge planifiée</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-slate-400 border-b border-slate-600">
                              <th className="text-left py-2 px-2 w-40">Client</th>
                              <th className="text-center py-2 px-2 w-20">Budgété</th>
                              <th className="text-center py-2 px-2 w-20">Réalisé</th>
                              <th className="text-center py-2 px-2 w-24">Type</th>
                              <th className="text-left py-2 px-2">Détail</th>
                              <th className="text-center py-2 px-2 w-24">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dayCharges.map(charge => (
                              <tr key={charge.id} className="border-b border-slate-600/50 hover:bg-slate-600/30 align-top">
                                <td className="py-2 px-2 text-white">
                                  {clients.find(c => c.id === charge.client_id)?.nom || 'Inconnu'}
                                </td>
                                <td className="py-2 px-2 text-center text-slate-300">{charge.heures}h</td>
                                <td className="py-2 px-2 text-center text-slate-300">{charge.heures_realisees || 0}h</td>
                                <td className="py-2 px-2 text-center">
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    charge.type === 'budgété' ? 'bg-blue-600/30 text-blue-300' : 'bg-green-600/30 text-green-300'
                                  }`}>
                                    {charge.type}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-slate-400 whitespace-pre-wrap break-words">
                                  {charge.detail || '-'}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <div className="flex justify-center gap-1">
                                    <button 
                                      onClick={() => setEditingCharge(charge)} 
                                      className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 p-1 rounded transition"
                                      title="Modifier"
                                    >
                                      <Pencil size={16} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteCharge(charge.id)} 
                                      className="text-red-400 hover:text-red-300 hover:bg-red-900/30 p-1 rounded transition"
                                      title="Supprimer"
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 mt-6">
          <p className="text-slate-400 text-sm">
            Charges : {charges.length} | Collaborateurs filtrés : {filteredCollaborateurs.length} | Vue : {viewMode === 'month' ? 'Mois' : viewMode === 'week' ? 'Semaine' : 'Jour'}
          </p>
          <p className="text-slate-500 text-xs mt-2">calendrier-zerah v3.1</p>
        </div>
      </div>
    </div>
  );
}

export default CalendarPage;
