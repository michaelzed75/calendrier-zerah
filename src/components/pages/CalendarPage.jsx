import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Filter, Download, Eye, Pencil, Check, Trash2, ChevronDown, ChevronUp, AlertCircle, VolumeX, Volume2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../supabaseClient';
import { AddChargeModal, EditChargeModal, ExportModal } from '../modals';
import { formatDateToYMD, parseDateString } from '../../utils/dateUtils';

// ============================================
// PAGE CALENDRIER
// ============================================
function CalendarPage({ collaborateurs, collaborateurChefs, clients, charges, setCharges, getChefsOf, getEquipeOf, getAccessibleClients, accent, userCollaborateur, impotsTaxes, suiviEcheances, setSuiviEcheances }) {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 1));
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
      setViewMode(prefs.viewMode || 'month');
      setSelectedCollaborateurs(filteredSelected.length > 0 ? filteredSelected : visibleIds);
      setExpandedEquipes(prefs.expandedEquipes || {});
      if (prefs.viewMode === 'day' && prefs.selectedDay) {
        setSelectedDay(prefs.selectedDay);
      } else if (prefs.viewMode === 'day') {
        setSelectedDay(formatDateToYMD(new Date()));
      }
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

// ============================================
// PAGE COLLABORATEURS
// ============================================
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
function ClientsPage({ clients, setClients, charges, setCharges, collaborateurs, accent, userCollaborateur }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [mergingClient, setMergingClient] = useState(null);
  const [filterCabinet, setFilterCabinet] = useState('tous');
  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

  // Chefs de mission pour l'assignation
  const chefsMission = collaborateurs.filter(c => c.est_chef_mission && c.actif);

  // Peut synchroniser : admin ou chef de mission
  const canSync = userCollaborateur?.is_admin || userCollaborateur?.est_chef_mission;

  // Synchronisation Pennylane via API serverless
  const handleSyncPennylane = async () => {
    setSyncing(true);
    setSyncMessage(null);

    try {
      const response = await fetch('/api/sync-pennylane', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur de synchronisation');
      }

      // Recharger les clients
      const { data: newClients } = await supabase.from('clients').select('*').order('id');
      if (newClients) setClients(newClients);

      setSyncMessage({
        type: 'success',
        text: `Sync terminée ! ${result.total} dossiers Pennylane. ${result.imported} nouveaux, ${result.updated} mis à jour, ${result.deactivated} désactivés.`
      });
    } catch (err) {
      console.error('Erreur sync:', err);
      setSyncMessage({ type: 'error', text: err.message || 'Erreur lors de la synchronisation' });
    }

    setSyncing(false);
  };

  // Fusionner un client sans cabinet vers un client Pennylane
  const handleMergeClient = async (sourceId, targetId) => {
    try {
      // Transférer toutes les charges du client source vers le client cible
      const { error: chargesError } = await supabase
        .from('charges')
        .update({ client_id: targetId })
        .eq('client_id', sourceId);

      if (chargesError) throw chargesError;

      // Supprimer le client source (sans cabinet)
      const { error: deleteError } = await supabase
        .from('clients')
        .delete()
        .eq('id', sourceId);

      if (deleteError) throw deleteError;

      // Mettre à jour le state local
      setClients(prev => prev.filter(c => c.id !== sourceId));
      setCharges(prev => prev.map(c =>
        c.client_id === sourceId ? { ...c, client_id: targetId } : c
      ));

      alert('Fusion réussie ! Les charges ont été transférées.');
    } catch (err) {
      console.error('Erreur fusion:', err);
      alert('Erreur lors de la fusion');
    }
    setMergingClient(null);
  };

  // Assigner un chef de mission à un client
  const handleAssignChef = async (clientId, chefId) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({ chef_mission_id: chefId || null })
        .eq('id', clientId);

      if (error) throw error;

      setClients(prev => prev.map(c =>
        c.id === clientId ? { ...c, chef_mission_id: chefId || null } : c
      ));
    } catch (err) {
      console.error('Erreur assignation chef:', err);
      alert('Erreur lors de l\'assignation');
    }
  };

  const handleAddClient = async (nom, codePennylane) => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert([{ nom, code_pennylane: codePennylane, actif: true }])
        .select();

      if (error) throw error;

      setClients(prev => [...prev, data[0]]);
    } catch (err) {
      console.error('Erreur ajout client:', err);
      alert('Erreur lors de l\'ajout');
    }
    setShowAddModal(false);
  };

  const handleUpdateClient = async (id, nom, codePennylane) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({ nom, code_pennylane: codePennylane })
        .eq('id', id);

      if (error) throw error;

      setClients(prev => prev.map(c =>
        c.id === id ? { ...c, nom, code_pennylane: codePennylane } : c
      ));
    } catch (err) {
      console.error('Erreur mise à jour client:', err);
      alert('Erreur lors de la mise à jour');
    }
    setEditingClient(null);
  };

  const handleToggleActif = async (id) => {
    const client = clients.find(c => c.id === id);
    
    if (client.actif) {
      const hasCharges = charges.some(c => c.client_id === id);
      if (hasCharges) {
        if (!confirm('Ce client a des charges. Voulez-vous vraiment le désactiver ?')) {
          return;
        }
      }
    }
    
    try {
      const { error } = await supabase
        .from('clients')
        .update({ actif: !client.actif })
        .eq('id', id);
      
      if (error) throw error;
      
      setClients(prev => prev.map(c =>
        c.id === id ? { ...c, actif: !c.actif } : c
      ));
    } catch (err) {
      console.error('Erreur toggle actif:', err);
    }
  };


  const handleDeleteClient = async (id) => {
    const client = clients.find(c => c.id === id);
    
    const hasCharges = charges.some(c => c.client_id === id);
    if (hasCharges) {
      alert('Impossible de supprimer : ce client a des charges. Désactivez-le plutôt.');
      return;
    }
    
    if (confirm(`Supprimer définitivement ${client.nom} ?`)) {
      try {
        const { error } = await supabase
          .from('clients')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        
        setClients(prev => prev.filter(c => c.id !== id));
      } catch (err) {
        console.error('Erreur suppression:', err);
        alert('Erreur lors de la suppression');
      }
    }
  };

  const getChargesCount = (clientId) => {
    return charges.filter(c => c.client_id === clientId).length;
  };

  // Obtenir le nom du chef de mission
  const getChefName = (chefId) => {
    const chef = collaborateurs.find(c => c.id === chefId);
    return chef ? chef.nom : null;
  };

  // Obtenir les cabinets uniques
  const cabinets = [...new Set(clients.filter(c => c.cabinet).map(c => c.cabinet))];

  // Filtrer les clients
  const filteredClients = clients.filter(client => {
    const matchesCabinet = filterCabinet === 'tous' || client.cabinet === filterCabinet || (filterCabinet === 'autres' && !client.cabinet);
    const matchesSearch = client.nom.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCabinet && matchesSearch;
  });

  // Export Excel
  const handleExportExcel = () => {
    const dataToExport = filteredClients.map(client => ({
      'Nom': client.nom,
      'Code Pennylane': client.code_pennylane || '',
      'Cabinet': client.cabinet || '',
      'Chef de mission': getChefName(client.chef_mission_id) || 'Non assigné',
      'SIREN': client.siren || '',
      'Adresse': client.adresse || '',
      'Ville': client.ville || '',
      'Code postal': client.code_postal || '',
      'Charges': getChargesCount(client.id),
      'Actif': client.actif ? 'Oui' : 'Non'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');

    // Ajuster la largeur des colonnes
    ws['!cols'] = [
      { wch: 30 }, // Nom
      { wch: 15 }, // Code
      { wch: 15 }, // Cabinet
      { wch: 20 }, // Chef
      { wch: 12 }, // SIREN
      { wch: 30 }, // Adresse
      { wch: 20 }, // Ville
      { wch: 10 }, // CP
      { wch: 8 },  // Charges
      { wch: 6 }   // Actif
    ];

    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `clients_${date}.xlsx`);
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Gestion des Clients</h2>
            <p className="text-slate-400">Gérez vos clients et assignez un chef de mission</p>
          </div>
          <div className="flex gap-2">
            {canSync && (
              <button
                onClick={handleSyncPennylane}
                disabled={syncing}
                className={`${accent.color} ${accent.hover} text-white px-4 py-2 rounded-lg flex items-center gap-2 transition disabled:opacity-50`}
              >
                <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Sync...' : 'Sync Pennylane'}
              </button>
            )}
            <button
              onClick={handleExportExcel}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
            >
              <Download size={18} />
              Export Excel
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
            >
              <Plus size={18} />
              Ajouter
            </button>
          </div>
        </div>

        {/* Message de sync */}
        {syncMessage && (
          <div className={`mb-4 p-3 rounded-lg ${
            syncMessage.type === 'success' ? 'bg-green-500/20 border border-green-500 text-green-400' : 'bg-red-500/20 border border-red-500 text-red-400'
          }`}>
            {syncMessage.text}
          </div>
        )}

        {/* Filtres */}
        <div className="flex flex-wrap gap-4 mb-6">
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-white px-4 py-2 rounded-lg w-64"
          />
          <select
            value={filterCabinet}
            onChange={(e) => setFilterCabinet(e.target.value)}
            className="bg-slate-700 border border-slate-600 text-white px-4 py-2 rounded-lg"
          >
            <option value="tous">Tous les cabinets</option>
            {cabinets.map(cab => (
              <option key={cab} value={cab}>{cab}</option>
            ))}
            <option value="autres">Sans cabinet</option>
          </select>
        </div>

        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-700 text-slate-300">
                <th className="text-left py-3 px-4">Nom</th>
                <th className="text-left py-3 px-4">Cabinet</th>
                <th className="text-left py-3 px-4">Chef de mission</th>
                <th className="text-center py-3 px-4">Charges</th>
                <th className="text-center py-3 px-4">Actif</th>
                <th className="text-center py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(client => {
                const chefName = getChefName(client.chef_mission_id);
                return (
                  <tr key={client.id} className={`border-t border-slate-700 ${!client.actif ? 'opacity-50' : ''}`}>
                    <td className="py-3 px-4">
                      <span className="text-white font-medium">{client.nom}</span>
                      {client.code_pennylane && (
                        <div className="text-slate-500 text-xs">{client.code_pennylane}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {client.cabinet ? (
                        <span className={`px-2 py-1 rounded text-xs ${
                          client.cabinet === 'Audit Up' ? 'bg-purple-600/30 text-purple-300' : 'bg-blue-600/30 text-blue-300'
                        }`}>
                          {client.cabinet}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-sm">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={client.chef_mission_id || ''}
                        onChange={(e) => handleAssignChef(client.id, e.target.value ? parseInt(e.target.value) : null)}
                        className="bg-slate-700 border border-slate-600 text-white px-2 py-1 rounded text-sm"
                      >
                        <option value="">Non assigné</option>
                        {chefsMission.map(chef => (
                          <option key={chef.id} value={chef.id}>{chef.nom}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {getChargesCount(client.id) > 0 ? (
                        <span className="bg-blue-600/30 text-blue-300 px-2 py-1 rounded text-sm">
                          {getChargesCount(client.id)}
                        </span>
                      ) : (
                        <span className="text-slate-500">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleActif(client.id)}
                        className={`p-1 rounded transition ${client.actif ? 'text-green-400 hover:bg-green-900/30' : 'text-slate-500 hover:bg-slate-700'}`}
                      >
                        <Check size={18} />
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex justify-center gap-1">
                        {/* Bouton Fusionner - seulement pour clients sans cabinet */}
                        {!client.cabinet && (
                          <button
                            onClick={() => setMergingClient(client)}
                            className="text-orange-400 hover:text-orange-300 hover:bg-orange-900/30 p-1 rounded transition"
                            title="Fusionner avec un client Pennylane"
                          >
                            <Download size={16} className="rotate-90" />
                          </button>
                        )}
                        <button
                          onClick={() => setEditingClient(client)}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 p-1 rounded transition"
                          title="Modifier"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteClient(client.id)}
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
            Affichés : {filteredClients.length} | Total : {clients.length} clients | Actifs : {clients.filter(c => c.actif).length}
          </p>
        </div>

        {showAddModal && (
          <ClientModal 
            onSave={handleAddClient}
            onClose={() => setShowAddModal(false)}
          />
        )}

        {editingClient && (
          <ClientModal
            client={editingClient}
            onSave={(nom, code, tva) => handleUpdateClient(editingClient.id, nom, code, tva)}
            onClose={() => setEditingClient(null)}
          />
        )}

        {/* Modal de fusion */}
        {mergingClient && (
          <MergeClientModal
            sourceClient={mergingClient}
            clients={clients}
            charges={charges}
            onMerge={handleMergeClient}
            onClose={() => setMergingClient(null)}
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// PAGE IMPOTS & TAXES
// ============================================
function ImpotsTaxesPage({ clients, collaborateurs, impotsTaxes, setImpotsTaxes, suiviEcheances, accent, userCollaborateur }) {
  const [anneeFiscale, setAnneeFiscale] = useState(new Date().getFullYear());
  const [saving, setSaving] = useState({});
  const [editingCell, setEditingCell] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [copyingData, setCopyingData] = useState(false);

  // Nouveaux états pour filtres, recherche et tri
  const [filtreChefMission, setFiltreChefMission] = useState('tous');
  const [recherche, setRecherche] = useState('');
  const [tri, setTri] = useState(() => {
    const saved = localStorage.getItem('impotsTaxes_tri');
    return saved ? JSON.parse(saved) : { colonne: 'nom', direction: 'asc' };
  });

  // Sauvegarder le tri en localStorage quand il change
  useEffect(() => {
    localStorage.setItem('impotsTaxes_tri', JSON.stringify(tri));
  }, [tri]);

  // Chefs de mission pour le filtre (admin uniquement)
  const chefsMission = collaborateurs.filter(c => c.est_chef_mission && c.actif);

  // Déterminer les clients à afficher selon le rôle
  const getClientsDeBase = () => {
    if (userCollaborateur?.is_admin) {
      // Admin voit tous les clients actifs
      return clients.filter(c => c.actif);
    } else {
      // Chef de mission voit ses clients
      return clients.filter(c =>
        c.actif &&
        (c.chef_mission_id === userCollaborateur?.id || !c.chef_mission_id)
      );
    }
  };

  // Appliquer le filtre par chef de mission (admin uniquement)
  const getClientsFiltresParChef = () => {
    const base = getClientsDeBase();
    if (!userCollaborateur?.is_admin || filtreChefMission === 'tous') {
      return base;
    }
    if (filtreChefMission === 'sans_chef') {
      return base.filter(c => !c.chef_mission_id);
    }
    return base.filter(c => String(c.chef_mission_id) === String(filtreChefMission));
  };

  // Appliquer la recherche
  const getClientsFiltresParRecherche = () => {
    const base = getClientsFiltresParChef();
    if (!recherche.trim()) return base;
    const rechercheLower = recherche.toLowerCase().trim();
    return base.filter(c => c.nom.toLowerCase().includes(rechercheLower));
  };

  // Appliquer le tri
  const getClientsTries = () => {
    const base = getClientsFiltresParRecherche();
    return [...base].sort((a, b) => {
      let valA, valB;
      const dataA = impotsTaxes.find(it => it.client_id === a.id && it.annee_fiscale === anneeFiscale) || {};
      const dataB = impotsTaxes.find(it => it.client_id === b.id && it.annee_fiscale === anneeFiscale) || {};

      switch (tri.colonne) {
        case 'nom':
          valA = a.nom.toLowerCase();
          valB = b.nom.toLowerCase();
          break;
        case 'mois_cloture':
          const moisOrdre = {
            'Janvier': 1, 'Février': 2, 'Mars': 3, 'Avril': 4, 'Mai': 5, 'Juin': 6,
            'Juillet': 7, 'Août': 8, 'Septembre': 9, 'Octobre': 10, 'Novembre': 11, 'Décembre': 12
          };
          valA = moisOrdre[dataA.mois_cloture] || 12;
          valB = moisOrdre[dataB.mois_cloture] || 12;
          break;
        case 'soumis_is':
          valA = dataA.soumis_is === true ? 1 : dataA.soumis_is === false ? 2 : 3;
          valB = dataB.soumis_is === true ? 1 : dataB.soumis_is === false ? 2 : 3;
          break;
        case 'tva_jour':
          valA = parseInt(dataA.tva_jour) || 99;
          valB = parseInt(dataB.tva_jour) || 99;
          break;
        case 'tva_periodicite':
          const perOrdre = { 'mensuel': 1, 'trimestriel': 2, 'ca12': 3 };
          valA = perOrdre[dataA.tva_periodicite] || 99;
          valB = perOrdre[dataB.tva_periodicite] || 99;
          break;
        default:
          valA = a.nom.toLowerCase();
          valB = b.nom.toLowerCase();
      }

      if (valA < valB) return tri.direction === 'asc' ? -1 : 1;
      if (valA > valB) return tri.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Clients finaux à afficher
  const mesClients = getClientsTries();

  // Fonction pour changer le tri
  const handleTriClick = (colonne) => {
    setTri(prev => ({
      colonne,
      direction: prev.colonne === colonne && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Composant pour l'icône de tri
  const TriIcon = ({ colonne }) => {
    if (tri.colonne !== colonne) return null;
    return (
      <span className="ml-1 text-pink-400">
        {tri.direction === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  // Champs à exclure de la copie (à remplir chaque année)
  // - Acomptes IS (montants différents chaque année)
  // - CFE N-1 (montant différent chaque année)
  const fieldsToExcludeFromCopy = ['is_acompte_03', 'is_acompte_06', 'is_acompte_09', 'is_acompte_12', 'cfe_montant'];

  // Copier les données de l'année précédente pour un client
  const copyDataFromPreviousYear = async (clientId, newYear) => {
    // Chercher les données de l'année précédente la plus récente
    const previousYearData = impotsTaxes
      .filter(it => it.client_id === clientId && it.annee_fiscale < newYear)
      .sort((a, b) => b.annee_fiscale - a.annee_fiscale)[0];

    if (!previousYearData) return null;

    // Créer un nouvel objet sans les champs à exclure
    const newData = {
      client_id: clientId,
      annee_fiscale: newYear
    };

    // Copier tous les champs sauf ceux à exclure et les champs système
    const systemFields = ['id', 'client_id', 'annee_fiscale', 'created_at', 'updated_at'];
    Object.keys(previousYearData).forEach(key => {
      if (!systemFields.includes(key) && !fieldsToExcludeFromCopy.includes(key)) {
        newData[key] = previousYearData[key];
      }
    });

    try {
      const { data, error } = await supabase
        .from('impots_taxes')
        .insert(newData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Erreur copie données:', err);
      return null;
    }
  };

  // Gérer le changement d'année fiscale avec copie des données si nécessaire
  const handleAnneeFiscaleChange = async (newYear) => {
    setAnneeFiscale(newYear);

    // Vérifier quels clients n'ont pas de données pour cette année (utiliser tous les clients de base, pas les filtrés)
    const tousLesClients = getClientsDeBase();
    const clientsWithoutData = tousLesClients.filter(client =>
      !impotsTaxes.some(it => it.client_id === client.id && it.annee_fiscale === newYear)
    );

    if (clientsWithoutData.length > 0) {
      setCopyingData(true);
      const newRecords = [];

      for (const client of clientsWithoutData) {
        const newRecord = await copyDataFromPreviousYear(client.id, newYear);
        if (newRecord) {
          newRecords.push(newRecord);
        }
      }

      if (newRecords.length > 0) {
        setImpotsTaxes(prev => [...prev, ...newRecords]);
      }
      setCopyingData(false);
    }
  };

  // Obtenir les données d'un client pour l'année sélectionnée
  const getClientData = (clientId) => {
    return impotsTaxes.find(it => it.client_id === clientId && it.annee_fiscale === anneeFiscale) || {};
  };

  // Propager une modification vers les années futures
  const propagateToFutureYears = async (clientId, field, value) => {
    // Ne pas propager les champs exclus (acomptes IS, CFE)
    if (fieldsToExcludeFromCopy.includes(field)) return;

    // Trouver les enregistrements des années futures pour ce client
    const futureRecords = impotsTaxes.filter(
      it => it.client_id === clientId && it.annee_fiscale > anneeFiscale
    );

    if (futureRecords.length === 0) return;

    const updatedRecords = [];
    for (const record of futureRecords) {
      try {
        const { data, error } = await supabase
          .from('impots_taxes')
          .update({ [field]: value, updated_at: new Date().toISOString() })
          .eq('id', record.id)
          .select()
          .single();

        if (!error && data) {
          updatedRecords.push(data);
        }
      } catch (err) {
        console.error('Erreur propagation:', err);
      }
    }

    if (updatedRecords.length > 0) {
      setImpotsTaxes(prev => prev.map(it => {
        const updated = updatedRecords.find(u => u.id === it.id);
        return updated || it;
      }));
    }
  };

  // Sauvegarder une modification
  const saveField = async (clientId, field, value) => {
    setSaving(prev => ({ ...prev, [`${clientId}-${field}`]: true }));

    const existingData = impotsTaxes.find(it => it.client_id === clientId && it.annee_fiscale === anneeFiscale);

    try {
      if (existingData) {
        // Update
        const { data, error } = await supabase
          .from('impots_taxes')
          .update({ [field]: value, updated_at: new Date().toISOString() })
          .eq('id', existingData.id)
          .select()
          .single();

        if (error) throw error;

        setImpotsTaxes(prev => prev.map(it => it.id === existingData.id ? data : it));

        // Propager vers les années futures (sauf champs exclus)
        await propagateToFutureYears(clientId, field, value);
      } else {
        // Insert
        const { data, error } = await supabase
          .from('impots_taxes')
          .insert({
            client_id: clientId,
            annee_fiscale: anneeFiscale,
            [field]: value
          })
          .select()
          .single();

        if (error) throw error;

        setImpotsTaxes(prev => [...prev, data]);

        // Propager vers les années futures (sauf champs exclus)
        await propagateToFutureYears(clientId, field, value);
      }
    } catch (err) {
      console.error('Erreur sauvegarde:', err);
      alert('Erreur lors de la sauvegarde');
    }

    setSaving(prev => ({ ...prev, [`${clientId}-${field}`]: false }));
    setEditingCell(null);
  };

  // Composant cellule éditable pour texte/nombre
  const EditableCell = ({ clientId, field, value, type = 'text', placeholder = '', className = '', disabled = false }) => {
    const [localValue, setLocalValue] = useState(value || '');
    const cellKey = `${clientId}-${field}`;
    const isEditing = editingCell === cellKey;
    const isSaving = saving[cellKey];

    useEffect(() => {
      setLocalValue(value || '');
    }, [value]);

    if (isSaving) {
      return <div className="px-2 py-1 text-slate-400 text-xs">...</div>;
    }

    if (disabled) {
      return (
        <div className={`px-2 py-1 rounded text-xs min-h-[24px] text-slate-500 bg-slate-800 cursor-not-allowed ${className}`}>
          -
        </div>
      );
    }

    if (isEditing) {
      return (
        <input
          type={type}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => saveField(clientId, field, type === 'number' ? (parseFloat(localValue) || null) : (localValue || null))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              saveField(clientId, field, type === 'number' ? (parseFloat(localValue) || null) : (localValue || null));
            }
            if (e.key === 'Escape') {
              setLocalValue(value || '');
              setEditingCell(null);
            }
          }}
          autoFocus
          className={`w-full bg-slate-600 text-white text-xs px-2 py-1 rounded border border-pink-500 focus:outline-none ${className}`}
        />
      );
    }

    return (
      <div
        onClick={() => setEditingCell(cellKey)}
        className={`px-2 py-1 cursor-pointer hover:bg-slate-600 rounded text-xs min-h-[24px] ${value ? 'text-white' : 'text-slate-500'} ${className}`}
      >
        {value || placeholder || '-'}
      </div>
    );
  };

  // Composant cellule select
  const SelectCell = ({ clientId, field, value, options, placeholder = '', disabled = false }) => {
    const cellKey = `${clientId}-${field}`;
    const isSaving = saving[cellKey];

    if (isSaving) {
      return <div className="px-2 py-1 text-slate-400 text-xs">...</div>;
    }

    return (
      <select
        value={value || ''}
        onChange={(e) => saveField(clientId, field, e.target.value || null)}
        disabled={disabled}
        className={`w-full text-xs px-1 py-1 rounded border focus:outline-none ${
          disabled
            ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
            : 'bg-slate-700 text-white border-slate-600 focus:border-pink-500'
        }`}
      >
        <option value="">{placeholder || '-'}</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  };

  // Composant cellule checkbox
  const CheckboxCell = ({ clientId, field, value }) => {
    const cellKey = `${clientId}-${field}`;
    const isSaving = saving[cellKey];

    if (isSaving) {
      return <div className="px-2 py-1 text-slate-400 text-xs text-center">...</div>;
    }

    return (
      <div className="flex justify-center">
        <input
          type="checkbox"
          checked={value || false}
          onChange={(e) => saveField(clientId, field, e.target.checked)}
          className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-pink-500 focus:ring-pink-500"
        />
      </div>
    );
  };

  // Obtenir le nom du collaborateur par son ID
  const getCollaborateurNom = (id) => {
    const collab = collaborateurs.find(c => c.id === id);
    return collab ? collab.nom : 'Inconnu';
  };

  // Générer toutes les échéances de l'année pour export (faites et à faire)
  const getAllEcheancesForYear = () => {
    const allEcheances = [];

    // Pour chaque client
    mesClients.forEach(client => {
      const data = impotsTaxes.find(it => it.client_id === client.id && it.annee_fiscale === anneeFiscale);
      if (!data) return;

      // Helper pour ajouter une échéance
      const addEcheance = (type, dateStr, montant = null) => {
        const suivi = suiviEcheances.find(s =>
          s.client_id === client.id &&
          s.type_echeance === type &&
          s.date_echeance === dateStr
        );
        allEcheances.push({
          client: client.nom,
          clientId: client.id,
          type,
          dateEcheance: dateStr,
          montant,
          fait: !!suivi,
          faitPar: suivi ? getCollaborateurNom(suivi.fait_par_id) : '',
          faitLe: suivi?.fait_le ? new Date(suivi.fait_le).toLocaleString('fr-FR') : ''
        });
      };

      // Helper pour calculer la date avec report dimanche → lundi
      const getDateWithSundayReport = (year, month, day) => {
        const date = new Date(year, month - 1, day);
        if (date.getDay() === 0) {
          date.setDate(date.getDate() + 1);
        }
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      };

      // TVA
      if (data.tva_jour && data.tva_periodicite) {
        const tvaJour = parseInt(data.tva_jour);
        let moisTVA = [];
        if (data.tva_periodicite === 'mensuel') {
          moisTVA = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        } else if (data.tva_periodicite === 'trimestriel') {
          moisTVA = [1, 4, 7, 10];
        }
        moisTVA.forEach(mois => {
          addEcheance('TVA', getDateWithSundayReport(anneeFiscale, mois, tvaJour));
        });

        // CA12 (régime simplifié)
        if (data.tva_periodicite === 'ca12') {
          // Acomptes CA12: dates fixes au 15 juillet et 15 décembre
          [7, 12].forEach(mois => {
            addEcheance('TVA Ac.', getDateWithSundayReport(anneeFiscale, mois, 15));
          });

          // Déclaration CA12
          const moisClotureNomTVA = data.mois_cloture || 'Décembre';
          const moisMapTVA = {
            'Janvier': 1, 'Février': 2, 'Mars': 3, 'Avril': 4, 'Mai': 5, 'Juin': 6,
            'Juillet': 7, 'Août': 8, 'Septembre': 9, 'Octobre': 10, 'Novembre': 11, 'Décembre': 12
          };
          const moisClotureNumTVA = moisMapTVA[moisClotureNomTVA] || 12;

          if (moisClotureNumTVA === 12) {
            // Clôture décembre → CA12 le 3 mai
            addEcheance('CA12', getDateWithSundayReport(anneeFiscale, 5, 3));
          } else {
            // Autres clôtures → CA12 E dans les 3 mois après clôture
            let moisCA12 = moisClotureNumTVA + 3;
            if (moisCA12 > 12) moisCA12 -= 12;
            const dernierJourCA12 = new Date(anneeFiscale, moisCA12, 0).getDate();
            addEcheance('CA12 E', getDateWithSundayReport(anneeFiscale, moisCA12, dernierJourCA12));
          }
        }
      }

      // IS Acomptes
      if (data.soumis_is) {
        if (data.is_acompte_03) addEcheance('IS', getDateWithSundayReport(anneeFiscale, 3, 15), data.is_acompte_03);
        if (data.is_acompte_06) addEcheance('IS', getDateWithSundayReport(anneeFiscale, 6, 15), data.is_acompte_06);
        if (data.is_acompte_09) addEcheance('IS', getDateWithSundayReport(anneeFiscale, 9, 15), data.is_acompte_09);
        if (data.is_acompte_12) addEcheance('IS', getDateWithSundayReport(anneeFiscale, 12, 15), data.is_acompte_12);
      }

      // IS Solde et Liasse - basés sur mois_cloture
      const moisClotureNom = data.mois_cloture || 'Décembre';
      const moisMap = {
        'Janvier': 1, 'Février': 2, 'Mars': 3, 'Avril': 4, 'Mai': 5, 'Juin': 6,
        'Juillet': 7, 'Août': 8, 'Septembre': 9, 'Octobre': 10, 'Novembre': 11, 'Décembre': 12
      };
      const moisClotureNum = moisMap[moisClotureNom] || 12;

      if (moisClotureNum === 12) {
        // Clôture décembre
        if (data.soumis_is) addEcheance('IS Solde', getDateWithSundayReport(anneeFiscale, 5, 15));
        // Liasse: 20 mai (5 mai + 15 jours télétransmission)
        addEcheance('Liasse', getDateWithSundayReport(anneeFiscale, 5, 20));
      } else {
        // Autres mois de clôture
        if (data.soumis_is) {
          let moisSolde = moisClotureNum + 4;
          if (moisSolde > 12) moisSolde -= 12;
          addEcheance('IS Solde', getDateWithSundayReport(anneeFiscale, moisSolde, 15));
        }
        // Liasse: 3 mois après clôture + 15 jours = 15 du 4e mois
        let moisLiasse = moisClotureNum + 3;
        if (moisLiasse > 12) moisLiasse -= 12;
        let moisLiasse15 = moisLiasse + 1;
        if (moisLiasse15 > 12) moisLiasse15 -= 12;
        addEcheance('Liasse', getDateWithSundayReport(anneeFiscale, moisLiasse15, 15));
      }

      // CFE
      if (data.cfe_montant_n1) {
        addEcheance('CFE', getDateWithSundayReport(anneeFiscale, 12, 15), data.cfe_montant_n1);
        if (data.cfe_montant_n1 > 3000) {
          addEcheance('CFE Ac.', getDateWithSundayReport(anneeFiscale, 6, 15), Math.round(data.cfe_montant_n1 / 2));
        }
      }

      // CVAE
      if (data.cvae) {
        addEcheance('CVAE', getDateWithSundayReport(anneeFiscale, 6, 15));
        addEcheance('CVAE', getDateWithSundayReport(anneeFiscale, 9, 15));
        addEcheance('CVAE Sol.', getDateWithSundayReport(anneeFiscale, 5, 3));
      }

      // TVTS
      if (data.tvts) {
        addEcheance('TVTS', getDateWithSundayReport(anneeFiscale, 1, 15));
      }

      // DAS2
      if (data.das2) {
        addEcheance('DAS2', getDateWithSundayReport(anneeFiscale, 5, 1));
      }

      // Taxe sur les salaires
      if (data.taxe_salaires) {
        addEcheance('Taxe Salaires', getDateWithSundayReport(anneeFiscale, 1, 10));
      }

      // IFU - 15 février
      if (data.ifu) {
        addEcheance('IFU', getDateWithSundayReport(anneeFiscale, 2, 15));
      }
    });

    return allEcheances.sort((a, b) => new Date(a.dateEcheance) - new Date(b.dateEcheance));
  };

  // Compter les échéances faites et à faire
  const getEcheancesStats = () => {
    const all = getAllEcheancesForYear();
    const faites = all.filter(e => e.fait).length;
    const aFaire = all.filter(e => !e.fait).length;
    return { total: all.length, faites, aFaire };
  };

  // Export CSV du suivi
  const exportSuiviCSV = () => {
    const data = getAllEcheancesForYear();
    if (data.length === 0) {
      alert('Aucune échéance configurée pour cette année');
      return;
    }

    const headers = ['Client', 'Type', 'Date échéance', 'Montant', 'Statut', 'Fait par', 'Fait le'];
    const csvContent = [
      headers.join(';'),
      ...data.map(row => [
        row.client,
        row.type,
        row.dateEcheance,
        row.montant || '',
        row.fait ? 'Fait' : 'À faire',
        row.faitPar,
        row.faitLe
      ].join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `suivi_echeances_${anneeFiscale}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  return (
    <div className="p-4 md:p-6 relative z-10">
      <div className="bg-slate-800/90 backdrop-blur-sm rounded-xl border border-slate-700">
        {/* Header fixe */}
        <div className="p-4 border-b border-slate-700 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <FileText className="text-white" size={24} />
              <h1 className="text-xl font-bold text-white">Impôts & Taxes</h1>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition"
              >
                <Download size={16} />
                <span className="hidden md:inline">Export suivi</span>
              </button>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-400">Année fiscale:</label>
                <select
                  value={anneeFiscale}
                  onChange={(e) => handleAnneeFiscaleChange(parseInt(e.target.value))}
                  disabled={copyingData}
                  className="bg-slate-700 text-white rounded px-3 py-1 border border-slate-600 disabled:opacity-50"
                >
                  {[2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032].map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                {copyingData && (
                  <span className="text-xs text-slate-400 animate-pulse">Copie des données...</span>
                )}
              </div>
            </div>
          </div>

          {/* Barre de filtres et recherche */}
          <div className="flex flex-col md:flex-row gap-3">
            {/* Recherche par nom */}
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher un dossier..."
                className="w-full bg-slate-700 text-white text-sm rounded-lg pl-9 pr-3 py-2 border border-slate-600 focus:border-pink-500 focus:outline-none"
              />
              {recherche && (
                <button
                  onClick={() => setRecherche('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filtre par chef de mission (admin uniquement) */}
            {userCollaborateur?.is_admin && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-400 whitespace-nowrap">Chef de mission:</label>
                <select
                  value={filtreChefMission}
                  onChange={(e) => setFiltreChefMission(e.target.value)}
                  className="bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600 focus:border-pink-500 focus:outline-none"
                >
                  <option value="tous">Tous</option>
                  <option value="sans_chef">Sans chef de mission</option>
                  {chefsMission.map(chef => (
                    <option key={chef.id} value={chef.id}>{chef.nom}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Compteur de résultats */}
            <div className="flex items-center text-sm text-slate-400">
              {mesClients.length} dossier{mesClients.length > 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Tableau avec scroll horizontal et header sticky */}
        <div className="overflow-x-auto">
          <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
            <table className="w-full text-sm table-fixed">
              <thead className="sticky top-0 z-10 bg-slate-800">
                <tr className="text-slate-400 text-xs">
                  <th
                    className="text-left py-3 px-2 border-b border-slate-700 sticky left-0 bg-slate-800 w-[200px] cursor-pointer hover:text-white transition"
                    onClick={() => handleTriClick('nom')}
                  >
                    Client<TriIcon colonne="nom" />
                  </th>
                  <th
                    className="text-center py-3 px-2 border-b border-slate-700 w-[90px] cursor-pointer hover:text-white transition"
                    title="Mois de clôture de l'exercice"
                    onClick={() => handleTriClick('mois_cloture')}
                  >
                    Mois clôt.<TriIcon colonne="mois_cloture" />
                  </th>
                  <th
                    className="text-center py-3 px-2 border-b border-slate-700 w-[70px] cursor-pointer hover:text-white transition"
                    onClick={() => handleTriClick('soumis_is')}
                  >
                    IS/IR<TriIcon colonne="soumis_is" />
                  </th>
                  <th
                    className="text-center py-3 px-2 border-b border-slate-700 w-[70px] cursor-pointer hover:text-white transition"
                    title="Jour limite TVA"
                    onClick={() => handleTriClick('tva_jour')}
                  >
                    TVA J.<TriIcon colonne="tva_jour" />
                  </th>
                  <th
                    className="text-center py-3 px-2 border-b border-slate-700 w-[90px] cursor-pointer hover:text-white transition"
                    title="Périodicité TVA"
                    onClick={() => handleTriClick('tva_periodicite')}
                  >
                    TVA Pér.<TriIcon colonne="tva_periodicite" />
                  </th>
                  <th className="text-center py-3 px-2 border-b border-slate-700 w-[90px]" title="Acompte IS 15 mars">IS 15/03</th>
                  <th className="text-center py-3 px-2 border-b border-slate-700 w-[90px]" title="Acompte IS 15 juin">IS 15/06</th>
                  <th className="text-center py-3 px-2 border-b border-slate-700 w-[90px]" title="Acompte IS 15 septembre">IS 15/09</th>
                  <th className="text-center py-3 px-2 border-b border-slate-700 w-[90px]" title="Acompte IS 15 décembre">IS 15/12</th>
                  <th className="text-center py-3 px-2 border-b border-slate-700 w-[90px]" title="Montant CFE N-1 (acompte si > 3000€)">CFE N-1</th>
                  <th className="text-center py-3 px-2 border-b border-slate-700 w-[60px]" title="CVAE">CVAE</th>
                  <th className="text-center py-3 px-2 border-b border-slate-700 w-[60px]" title="Taxe Véhicules Sociétés">TVTS</th>
                  <th className="text-center py-3 px-2 border-b border-slate-700 w-[60px]" title="Déclaration Honoraires">DAS2</th>
                  <th className="text-center py-3 px-2 border-b border-slate-700 w-[60px]" title="Taxe sur les salaires (10/01)">TS</th>
                  <th className="text-center py-3 px-2 border-b border-slate-700 w-[60px]" title="Imprimé Fiscal Unique (15/02)">IFU</th>
                </tr>
              </thead>
              <tbody>
                {mesClients.length === 0 ? (
                  <tr>
                    <td colSpan="15" className="text-center py-8 text-slate-400">
                      {recherche ? 'Aucun dossier trouvé' : 'Aucun dossier'}
                    </td>
                  </tr>
                ) : (
                  mesClients.map(client => {
                    const data = getClientData(client.id);
                    return (
                      <tr key={client.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                        <td className="py-2 px-2 sticky left-0 bg-slate-800/95 font-medium text-white text-xs truncate">
                          {client.nom}
                        </td>
                        <td className="py-1 px-1">
                          <SelectCell
                            clientId={client.id}
                            field="mois_cloture"
                            value={data.mois_cloture || 'Décembre'}
                            options={[
                              { value: 'Janvier', label: 'Janvier' },
                              { value: 'Février', label: 'Février' },
                              { value: 'Mars', label: 'Mars' },
                              { value: 'Avril', label: 'Avril' },
                              { value: 'Mai', label: 'Mai' },
                              { value: 'Juin', label: 'Juin' },
                              { value: 'Juillet', label: 'Juillet' },
                              { value: 'Août', label: 'Août' },
                              { value: 'Septembre', label: 'Septembre' },
                              { value: 'Octobre', label: 'Octobre' },
                              { value: 'Novembre', label: 'Novembre' },
                              { value: 'Décembre', label: 'Décembre' }
                            ]}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <SelectCell
                            clientId={client.id}
                            field="soumis_is"
                            value={data.soumis_is === true ? 'true' : data.soumis_is === false ? 'false' : ''}
                            options={[
                              { value: 'true', label: 'IS' },
                              { value: 'false', label: 'IR' }
                            ]}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <SelectCell
                            clientId={client.id}
                            field="tva_jour"
                            value={data.tva_jour}
                            options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
                            placeholder="-"
                            disabled={data.tva_periodicite === 'ca12'}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <SelectCell
                            clientId={client.id}
                            field="tva_periodicite"
                            value={data.tva_periodicite}
                            options={[
                              { value: 'mensuel', label: 'Mens.' },
                              { value: 'trimestriel', label: 'Trim.' },
                              { value: 'ca12', label: 'CA12' }
                            ]}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <EditableCell
                            clientId={client.id}
                            field="is_acompte_03"
                            value={data.is_acompte_03}
                            type="number"
                            placeholder="€"
                            className="text-center w-16"
                            disabled={data.soumis_is === false}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <EditableCell
                            clientId={client.id}
                            field="is_acompte_06"
                            value={data.is_acompte_06}
                            type="number"
                            placeholder="€"
                            className="text-center w-16"
                            disabled={data.soumis_is === false}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <EditableCell
                            clientId={client.id}
                            field="is_acompte_09"
                            value={data.is_acompte_09}
                            type="number"
                            placeholder="€"
                            className="text-center w-16"
                            disabled={data.soumis_is === false}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <EditableCell
                            clientId={client.id}
                            field="is_acompte_12"
                            value={data.is_acompte_12}
                            type="number"
                            placeholder="€"
                            className="text-center w-16"
                            disabled={data.soumis_is === false}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <EditableCell
                            clientId={client.id}
                            field="cfe_montant_n1"
                            value={data.cfe_montant_n1}
                            type="number"
                            placeholder="€"
                            className="text-center w-16"
                          />
                        </td>
                        <td className="py-1 px-1">
                          <CheckboxCell
                            clientId={client.id}
                            field="cvae"
                            value={data.cvae}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <CheckboxCell
                            clientId={client.id}
                            field="tvts"
                            value={data.tvts}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <CheckboxCell
                            clientId={client.id}
                            field="das2"
                            value={data.das2}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <CheckboxCell
                            clientId={client.id}
                            field="taxe_salaires"
                            value={data.taxe_salaires}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <CheckboxCell
                            clientId={client.id}
                            field="ifu"
                            value={data.ifu}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Légende */}
        <div className="p-4 border-t border-slate-700 text-xs text-slate-400">
          <p className="mb-2"><strong>Légende:</strong></p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            <span>• <strong>Mois clôt.:</strong> Mois de clôture (pour calcul IS Solde, Liasse et CA12)</span>
            <span>• <strong>TVA J.:</strong> Jour limite déclaration TVA</span>
            <span>• <strong>TVA Pér.:</strong> Mensuel / Trimestriel / CA12</span>
            <span>• <strong>CA12:</strong> Acomptes 15/07 + 15/12, déclaration 03/05 (ou 3 mois après clôture)</span>
            <span>• <strong>IS:</strong> Acomptes trimestriels + Solde (15 du 4e mois après clôture)</span>
            <span>• <strong>Liasse:</strong> 20/05 si clôture décembre, sinon 15 du 4e mois après clôture (+15j télétransmission)</span>
            <span>• <strong>CFE N-1:</strong> Si &gt; 3000€ → acompte 15/06</span>
            <span>• <strong>CVAE:</strong> 15/06, 15/09, 03/05</span>
            <span>• <strong>TVTS:</strong> 15 janvier</span>
            <span>• <strong>DAS2:</strong> 1er mai</span>
            <span>• <strong>TS:</strong> Taxe salaires 10 janvier</span>
            <span>• <strong>IFU:</strong> Imprimé Fiscal Unique 15 février</span>
          </div>
        </div>
      </div>

      {/* Modal export suivi */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Export du suivi des échéances</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mb-4 text-slate-300 text-sm">
              <p className="mb-2">Exporter la liste de toutes les échéances pour l'année {anneeFiscale}.</p>
              <p className="text-slate-400 text-xs">Le fichier CSV contiendra: Client, Type, Date, Montant, Statut (Fait/À faire), Fait par, Date/heure.</p>
            </div>
            <div className="mb-4 p-3 bg-slate-700/50 rounded-lg space-y-1">
              <p className="text-sm text-slate-300">
                <strong>{getEcheancesStats().total}</strong> échéance(s) au total
              </p>
              <p className="text-sm text-emerald-400">
                <strong>{getEcheancesStats().faites}</strong> faite(s)
              </p>
              <p className="text-sm text-amber-400">
                <strong>{getEcheancesStats().aFaire}</strong> à faire
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
              >
                Annuler
              </button>
              <button
                onClick={exportSuiviCSV}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition flex items-center gap-2"
              >
                <Download size={16} />
                Exporter CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// PAGE REPARTITION TVA
// ============================================
function RepartitionTVAPage({ clients, collaborateurs, charges, setCharges, getEquipeOf, accent, userCollaborateur, impotsTaxes }) {
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [repartitionData, setRepartitionData] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  // Année fiscale courante pour récupérer les données impots_taxes
  const anneeFiscale = new Date().getFullYear();

  // Vérifier si un client a la TVA configurée dans impots_taxes
  const clientHasTVA = (clientId) => {
    const data = impotsTaxes.find(it => it.client_id === clientId && it.annee_fiscale === anneeFiscale);
    return data?.tva_jour && data?.tva_periodicite;
  };

  // Clients TVA actifs appartenant au chef de mission connecté
  const clientsTVA = clients.filter(c =>
    c.actif &&
    clientHasTVA(c.id) &&
    (c.chef_mission_id === userCollaborateur?.id || !c.chef_mission_id)
  );

  // Collaborateurs de l'équipe du chef de mission (+ lui-même)
  const equipeCollaborateurs = userCollaborateur ? [
    userCollaborateur,
    ...getEquipeOf(userCollaborateur.id)
  ] : [];

  // Obtenir la date limite TVA depuis impots_taxes
  const getTvaJourFromImpots = (clientId) => {
    const data = impotsTaxes.find(it => it.client_id === clientId && it.annee_fiscale === anneeFiscale);
    return data?.tva_jour || 19; // Par défaut 19 si non renseigné
  };

  // Jours fériés français 2025-2027
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

  // Ref pour éviter la sauvegarde au premier chargement
  const isInitialLoad = React.useRef(true);

  // Charger les données sauvegardées du localStorage (une seule fois)
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
          dateLimite: getTvaJourFromImpots(client.id) // Récupéré depuis impots_taxes
        };
      }));
    }
  }, [clientsTVA, impotsTaxes]);

  // Sauvegarder les données dans le localStorage quand elles changent (pas au premier chargement)
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
          // dateLimite n'est plus sauvegardé ici, il vient de impots_taxes
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

  // Vérifier si un jour est ouvré (Lun-Ven, pas férié)
  const isJourOuvre = (dateStr) => {
    const date = parseDateLocal(dateStr);
    const jour = date.getDay();
    // 0 = Dimanche, 6 = Samedi
    if (jour === 0 || jour === 6) return false;
    // Vérifier si c'est un jour férié
    if (joursFeries.includes(dateStr)) return false;
    return true;
  };

  // Obtenir le prochain jour ouvré
  const getProchainJourOuvre = (dateStr) => {
    let date = parseDateLocal(dateStr);
    date.setDate(date.getDate() + 1);
    while (!isJourOuvre(formatDateToYMD(date))) {
      date.setDate(date.getDate() + 1);
    }
    return formatDateToYMD(date);
  };

  // Mettre à jour une ligne de répartition
  const updateRepartition = (index, field, value) => {
    setRepartitionData(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  // Vérifier si toutes les données sont remplies
  const isDataComplete = () => {
    if (!dateDebut || !dateFin) return false;
    return repartitionData.every(item =>
      item.collaborateurId && item.dateLimite >= 1 && item.dateLimite <= 31
    );
  };

  // Calculer les heures déjà planifiées pour un collaborateur sur une date
  const getHeuresPlanifiees = (collaborateurId, dateStr, chargesExistantes) => {
    const chargesJour = chargesExistantes.filter(c =>
      c.collaborateur_id === collaborateurId && c.date_charge === dateStr
    );
    return chargesJour.reduce((sum, c) => sum + parseFloat(c.heures), 0);
  };

  // Calculer les heures disponibles sur la période pour un collaborateur
  const calculerHeuresDisponibles = (collaborateurId) => {
    if (!dateDebut || !dateFin) return 0;

    let heuresDisponibles = 0;
    const startDate = parseDateLocal(dateDebut);
    const endDate = parseDateLocal(dateFin);
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = formatDateToYMD(currentDate);
      if (isJourOuvre(dateStr)) {
        // Heures déjà planifiées ce jour-là
        const heuresDejaPlanifiees = charges
          .filter(c => c.collaborateur_id === parseInt(collaborateurId) && c.date_charge === dateStr)
          .reduce((sum, c) => sum + parseFloat(c.heures), 0);
        heuresDisponibles += Math.max(0, 8 - heuresDejaPlanifiees);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return heuresDisponibles;
  };

  // Valider la capacité de chaque collaborateur
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

    // Vérifier chaque collaborateur
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

  // Répartir les charges automatiquement
  const repartirCharges = async () => {
    if (!isDataComplete()) {
      alert('Veuillez remplir tous les champs (collaborateur et date limite) avant de répartir.');
      return;
    }

    // Valider la capacité
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

      // Trier par date limite (priorité aux plus urgentes)
      const dataTriee = [...repartitionData]
        .filter(item => item.heures > 0)
        .sort((a, b) => a.dateLimite - b.dateLimite);

      for (const item of dataTriee) {
        let heuresRestantes = parseFloat(item.heures);
        let currentDate = dateDebut;

        // Avancer jusqu'au premier jour ouvré si nécessaire
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
                type: 'budgété',
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

      // Insérer toutes les charges en base
      if (nouvellesCharges.length > 0) {
        const { data, error } = await supabase
          .from('charges')
          .insert(nouvellesCharges)
          .select();

        if (error) throw error;

        setCharges(prev => [...prev, ...data]);
        alert(`${nouvellesCharges.length} charge(s) créée(s) avec succès !`);
      } else {
        alert('Aucune charge à créer (toutes les durées sont à 0).');
      }
    } catch (err) {
      console.error('Erreur lors de la répartition:', err);
      alert('Erreur lors de la création des charges');
    }

    setIsGenerating(false);
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="bg-slate-800/90 backdrop-blur-sm rounded-xl p-6 border border-slate-700 mb-6">
        <h1 className="text-2xl font-bold text-white mb-6">Répartition des charges TVA</h1>

        {/* Sélection de la période */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Date de début</label>
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
            <h3 className="text-red-400 font-bold mb-2">Capacité dépassée - Veuillez revoir le planning</h3>
            {validationErrors.map((error, index) => (
              <p key={index} className="text-red-300 text-sm">
                <strong>{error.collaborateur}</strong> : durée disponible sur la période = {error.heuresDisponibles}h, vous avez réparti {error.heuresReparties}h (dépassement de {error.depassement}h)
              </p>
            ))}
          </div>
        )}

        {/* Tableau des clients TVA */}
        {clientsTVA.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            Aucun client avec TVA. Allez dans la page Clients pour activer la TVA sur les clients concernés.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-600">
                    <th className="text-left py-3 px-2">Client</th>
                    <th className="text-left py-3 px-2" title="Défini dans l'onglet Impôts et Taxes">Jour TVA</th>
                    <th className="text-left py-3 px-2">Durée (h)</th>
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
                          title="Modifiable dans l'onglet Impôts et Taxes"
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
                          <option value="">Sélectionner...</option>
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

            {/* Bouton de répartition */}
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
                    Répartition en cours...
                  </>
                ) : (
                  'Répartir les charges'
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Résumé */}
      <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg p-4 border border-slate-700">
        <p className="text-slate-400 text-sm">
          Clients TVA : {clientsTVA.length} | Total heures prévues : {repartitionData.reduce((sum, item) => sum + (item.heures || 0), 0)}h
        </p>
      </div>
    </div>
  );
}


export default CalendarPage;
