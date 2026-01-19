import React, { useState, useEffect } from 'react';
import { FileText, Search, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';

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

export default ImpotsTaxesPage;
