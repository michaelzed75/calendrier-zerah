// @ts-check
import React, { useState, useEffect } from 'react';
import { Upload, Search, RefreshCw, Check, X, Trash2, AlertCircle, Pencil, Link2, BarChart3, ArrowUpDown, Clock, ChevronDown, ChevronUp, FileText, Users, Building2, Download, Plus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../supabaseClient';
import { formatDateToYMD } from '../../utils/dateUtils';

/**
 * @typedef {import('../../types.js').Client} Client
 * @typedef {import('../../types.js').Collaborateur} Collaborateur
 * @typedef {import('../../types.js').Charge} Charge
 * @typedef {import('../../types.js').AccentColor} AccentColor
 * @typedef {import('../../types.js').TempsReelsPageProps} TempsReelsPageProps
 * @typedef {import('../../types.js').TempsReel} TempsReel
 * @typedef {import('../../types.js').ImportedTempsRow} ImportedTempsRow
 * @typedef {import('../../types.js').ImportStats} ImportStats
 * @typedef {import('../../types.js').JournalImport} JournalImport
 */

// PAGE TEMPS RÉELS - Import et Analyse des Écarts
// ============================================

/**
 * Page d'import des temps réels et analyse des écarts
 * @param {TempsReelsPageProps} props
 * @returns {JSX.Element}
 */
function TempsReelsPage({ clients, collaborateurs, charges, setCharges, accent }) {
  const [activeTab, setActiveTab] = useState('mapping'); // 'mapping', 'import', 'ecarts', 'journal'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Variables obsolètes supprimées (Option 3 : plus de sélection de cabinet)
  // Le cabinet se déduit maintenant du client mappé

  // Mappings depuis Supabase
  const [mappingCollaborateurs, setMappingCollaborateurs] = useState({});
  const [mappingClients, setMappingClients] = useState({});

  // Données importées
  const [importedData, setImportedData] = useState([]);
  const [importStats, setImportStats] = useState(null);
  const [tempsReels, setTempsReels] = useState([]);

  // Journal des modifications
  const [journalModifications, setJournalModifications] = useState([]);

  // Filtres pour l'analyse des écarts
  const [filtreCollaborateur, setFiltreCollaborateur] = useState('');
  const [filtreClient, setFiltreClient] = useState('');
  const [filtrePeriode, setFiltrePeriode] = useState('jour'); // 'jour', 'mois', 'trimestre', 'annee', 'custom'
  // Par défaut : J-1 (hier)
  const [dateDebut, setDateDebut] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1); // J-1
    return formatDateToYMD(d);
  });
  const [dateFin, setDateFin] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1); // J-1
    return formatDateToYMD(d);
  });
  const [searchEcarts, setSearchEcarts] = useState('');
  const [sortEcarts, setSortEcarts] = useState({ column: 'ecart', direction: 'desc' }); // column: 'collaborateur', 'client', 'budgetees', 'reelles', 'ecart', 'ecartPourcent'

  // Charger les données depuis Supabase au démarrage
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Charger les mappings
        const { data: mappingsData, error: mappingsError } = await supabase
          .from('mappings_pennylane')
          .select('*');

        if (mappingsError) throw mappingsError;

        // Convertir en objets { nomPennylane: entityId }
        const collabMappings = {};
        const clientMappings = {};
        mappingsData?.forEach(m => {
          if (m.type === 'collaborateur') {
            collabMappings[m.nom_pennylane] = m.entity_id;
          } else if (m.type === 'client') {
            clientMappings[m.nom_pennylane] = m.entity_id;
          }
        });
        setMappingCollaborateurs(collabMappings);
        setMappingClients(clientMappings);

        // Charger les temps réels
        const { data: tempsData, error: tempsError } = await supabase
          .from('temps_reels')
          .select('*')
          .order('date', { ascending: false });

        if (tempsError) throw tempsError;
        setTempsReels(tempsData || []);

        // Charger le journal
        const { data: journalData, error: journalError } = await supabase
          .from('journal_imports')
          .select('*')
          .order('date_import', { ascending: false })
          .limit(100);

        if (journalError) throw journalError;
        setJournalModifications(journalData || []);

        // Migration: si des données existent en localStorage, les migrer vers Supabase
        const localTemps = localStorage.getItem('tempsReels');
        const localMappingsCollab = localStorage.getItem('mappingCollaborateurs');
        const localMappingsClient = localStorage.getItem('mappingClients');

        if (localTemps || localMappingsCollab || localMappingsClient) {
          console.log('Migration des données localStorage vers Supabase...');

          // Migrer les mappings collaborateurs
          if (localMappingsCollab && Object.keys(collabMappings).length === 0) {
            const parsed = JSON.parse(localMappingsCollab);
            for (const [nomPennylane, entityId] of Object.entries(parsed)) {
              if (entityId) {
                await supabase.from('mappings_pennylane').upsert({
                  type: 'collaborateur',
                  nom_pennylane: nomPennylane,
                  entity_id: entityId
                }, { onConflict: 'type,nom_pennylane' });
              }
            }
            setMappingCollaborateurs(parsed);
          }

          // Migrer les mappings clients
          if (localMappingsClient && Object.keys(clientMappings).length === 0) {
            const parsed = JSON.parse(localMappingsClient);
            for (const [nomPennylane, entityId] of Object.entries(parsed)) {
              if (entityId) {
                await supabase.from('mappings_pennylane').upsert({
                  type: 'client',
                  nom_pennylane: nomPennylane,
                  entity_id: entityId
                }, { onConflict: 'type,nom_pennylane' });
              }
            }
            setMappingClients(parsed);
          }

          // Migrer les temps réels
          if (localTemps && tempsData?.length === 0) {
            const parsed = JSON.parse(localTemps);
            for (const t of parsed) {
              await supabase.from('temps_reels').upsert({
                collaborateur_id: t.collaborateur_id,
                client_id: t.client_id,
                date: t.date,
                heures: t.heures,
                commentaire: t.commentaire,
                activite: t.activite,
                type_mission: t.typeMission,
                millesime: t.millesime
              }, { onConflict: 'collaborateur_id,client_id,date' });
            }
            // Recharger les temps après migration
            const { data: newTempsData } = await supabase
              .from('temps_reels')
              .select('*')
              .order('date', { ascending: false });
            setTempsReels(newTempsData || []);
          }

          // Nettoyer le localStorage après migration réussie
          localStorage.removeItem('tempsReels');
          localStorage.removeItem('mappingCollaborateurs');
          localStorage.removeItem('mappingClients');
          localStorage.removeItem('journalModifications');
          console.log('Migration terminée, localStorage nettoyé');
        }

      } catch (err) {
        console.error('Erreur chargement données:', err);
      }
      setLoading(false);
    };

    loadData();
  }, []);

  // Sauvegarder un mapping collaborateur dans Supabase
  const saveMappingCollaborateur = async (nomPennylane, entityId) => {
    if (entityId) {
      await supabase.from('mappings_pennylane').upsert({
        type: 'collaborateur',
        nom_pennylane: nomPennylane,
        entity_id: entityId
      }, { onConflict: 'type,nom_pennylane' });
    } else {
      await supabase.from('mappings_pennylane')
        .delete()
        .eq('type', 'collaborateur')
        .eq('nom_pennylane', nomPennylane);
    }
    setMappingCollaborateurs(prev => ({
      ...prev,
      [nomPennylane]: entityId || undefined
    }));
  };

  // Sauvegarder un mapping client dans Supabase
  const saveMappingClient = async (nomPennylane, entityId) => {
    if (entityId) {
      await supabase.from('mappings_pennylane').upsert({
        type: 'client',
        nom_pennylane: nomPennylane,
        entity_id: entityId
      }, { onConflict: 'type,nom_pennylane' });
    } else {
      await supabase.from('mappings_pennylane')
        .delete()
        .eq('type', 'client')
        .eq('nom_pennylane', nomPennylane);
    }
    setMappingClients(prev => ({
      ...prev,
      [nomPennylane]: entityId || undefined
    }));
  };

  // Extraction des noms uniques depuis les données importées
  const [uniquePennylaneCollabs, setUniquePennylaneCollabs] = useState([]);
  const [uniquePennylaneClients, setUniquePennylaneClients] = useState([]);

  // Fonction pour parser le fichier Excel
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // Parser les données (première ligne = headers)
      const headers = data[0];
      const rows = data.slice(1).filter(row => row.length > 0);

      // Trouver les indices des colonnes
      const colIndices = {
        collaborateur: headers.findIndex(h => h && h.toLowerCase().includes('collaborateur')),
        client: headers.findIndex(h => h && h.toLowerCase().includes('client')),
        millesime: headers.findIndex(h => h && h.toLowerCase().includes('mill')),
        commentaire: headers.findIndex(h => h && h.toLowerCase().includes('commentaire')),
        code: headers.findIndex(h => h && h.toLowerCase().includes('code')),
        typeMission: headers.findIndex(h => h && h.toLowerCase().includes('type') && h.toLowerCase().includes('mission')),
        activite: headers.findIndex(h => h && h.toLowerCase().includes('activit')),
        date: headers.findIndex(h => h && h.toLowerCase().includes('date')),
        duree: headers.findIndex(h => h && (h.toLowerCase().includes('dur') || h.toLowerCase().includes('factur')))
      };

      const parsed = rows.map(row => {
        // Parser la date Excel
        let dateStr = '';
        const dateVal = row[colIndices.date];
        if (dateVal) {
          if (typeof dateVal === 'number') {
            // Date Excel (nombre de jours depuis 1900)
            const date = new Date((dateVal - 25569) * 86400 * 1000);
            dateStr = formatDateToYMD(date);
          } else if (typeof dateVal === 'string') {
            // Format texte (ex: "6/1/2026")
            const parts = dateVal.split('/');
            if (parts.length === 3) {
              const [month, day, year] = parts;
              dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
          }
        }

        // Parser la durée (en minutes -> heures)
        let dureeMinutes = 0;
        const dureeVal = row[colIndices.duree];
        if (dureeVal) {
          if (typeof dureeVal === 'string') {
            dureeMinutes = parseInt(dureeVal.replace(/[^0-9]/g, '')) || 0;
          } else {
            dureeMinutes = parseInt(dureeVal) || 0;
          }
        }

        return {
          collaborateurPennylane: row[colIndices.collaborateur] || '',
          clientPennylane: row[colIndices.client] || '',
          millesime: row[colIndices.millesime] || '',
          commentaire: row[colIndices.commentaire] || '',
          code: row[colIndices.code] || '',
          typeMission: row[colIndices.typeMission] || '',
          activite: row[colIndices.activite] || '',
          date: dateStr,
          dureeMinutes: dureeMinutes,
          dureeHeures: Math.round((dureeMinutes / 60) * 100) / 100
        };
      }).filter(row => row.collaborateurPennylane && row.clientPennylane && row.date);

      setImportedData(parsed);

      // Extraire les noms uniques
      const uniqueCollabs = [...new Set(parsed.map(r => r.collaborateurPennylane))].sort();
      const uniqueClients = [...new Set(parsed.map(r => r.clientPennylane))].sort();
      setUniquePennylaneCollabs(uniqueCollabs);
      setUniquePennylaneClients(uniqueClients);

      // Statistiques d'import
      setImportStats({
        totalLignes: parsed.length,
        collaborateurs: uniqueCollabs.length,
        clients: uniqueClients.length,
        totalHeures: Math.round(parsed.reduce((sum, r) => sum + r.dureeHeures, 0) * 100) / 100
      });

    };
    reader.readAsBinaryString(file);
  };

  // Auto-matching des collaborateurs (avec sauvegarde Supabase)
  const autoMatchCollaborateurs = async () => {
    const newMapping = { ...mappingCollaborateurs };
    const toSave = [];

    uniquePennylaneCollabs.forEach(pennylane => {
      if (newMapping[pennylane]) return; // Déjà mappé

      const pennylaneNorm = pennylane.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      // Chercher une correspondance
      const match = collaborateurs.find(c => {
        const nomNorm = c.nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        // Match par prénom ou nom complet
        return pennylaneNorm.includes(nomNorm) || nomNorm.includes(pennylaneNorm.split(' ')[0]);
      });

      if (match) {
        newMapping[pennylane] = match.id;
        toSave.push({ type: 'collaborateur', nom_pennylane: pennylane, entity_id: match.id });
      }
    });

    // Sauvegarder dans Supabase
    if (toSave.length > 0) {
      await supabase.from('mappings_pennylane').upsert(toSave, { onConflict: 'type,nom_pennylane' });
    }

    setMappingCollaborateurs(newMapping);
  };

  // Auto-matching des clients (avec sauvegarde Supabase)
  const autoMatchClients = async () => {
    const newMapping = { ...mappingClients };
    const toSave = [];

    uniquePennylaneClients.forEach(pennylane => {
      if (newMapping[pennylane]) return; // Déjà mappé

      const pennylaneNorm = pennylane.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, ' ')
        .trim();

      // Chercher une correspondance
      const match = clients.find(c => {
        const nomNorm = c.nom.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, ' ')
          .trim();

        // Vérifier si les mots-clés principaux correspondent
        const pennylaneWords = pennylaneNorm.split(/\s+/).filter(w => w.length > 2);
        const clientWords = nomNorm.split(/\s+/).filter(w => w.length > 2);

        // Au moins un mot significatif en commun
        return pennylaneWords.some(pw => clientWords.some(cw => cw.includes(pw) || pw.includes(cw)));
      });

      if (match) {
        newMapping[pennylane] = match.id;
        toSave.push({ type: 'client', nom_pennylane: pennylane, entity_id: match.id });
      }
    });

    // Sauvegarder dans Supabase
    if (toSave.length > 0) {
      await supabase.from('mappings_pennylane').upsert(toSave, { onConflict: 'type,nom_pennylane' });
    }

    setMappingClients(newMapping);
  };

  // Valider et enregistrer les temps réels (mode FUSION INTELLIGENTE) - SUPABASE
  // Option A : Ajouter/Mettre à jour sans jamais supprimer automatiquement
  // Option 3 : Le cabinet se déduit du client, pas de champ cabinet sur les temps
  const handleValidateImport = async () => {
    setSaving(true);
    try {
      // 1. Parser les nouvelles données (sans cabinet)
      const newTempsReels = [];
      let lignesIgnorees = 0;
      const lignesIgnoreesDetails = [];

      importedData.forEach(row => {
        const collaborateurId = mappingCollaborateurs[row.collaborateurPennylane];
        const clientId = mappingClients[row.clientPennylane];

        if (!collaborateurId || !clientId) {
          lignesIgnorees++;
          lignesIgnoreesDetails.push({
            collaborateur: row.collaborateurPennylane,
            client: row.clientPennylane,
            raison: !collaborateurId ? 'Collaborateur non mappé' : 'Client non mappé'
          });
          return;
        }

        newTempsReels.push({
          collaborateur_id: collaborateurId,
          client_id: clientId,
          date: row.date,
          heures: row.dureeHeures,
          commentaire: row.commentaire,
          activite: row.activite,
          type_mission: row.typeMission,
          millesime: row.millesime
          // Plus de champ cabinet - il se déduit du client
        });
      });

      // 2. Vérifier les IDs avant insert (évite les erreurs FK si un client/collab a été supprimé)
      const usedClientIds = [...new Set(newTempsReels.map(t => t.client_id))];
      const usedCollabIds = [...new Set(newTempsReels.map(t => t.collaborateur_id))];

      const { data: validClients } = await supabase
        .from('clients').select('id').in('id', usedClientIds);
      const { data: validCollabs } = await supabase
        .from('collaborateurs').select('id').in('id', usedCollabIds);

      const validClientIds = new Set((validClients || []).map(c => c.id));
      const validCollabIds = new Set((validCollabs || []).map(c => c.id));

      const orphanClients = usedClientIds.filter(id => !validClientIds.has(id));
      const orphanCollabs = usedCollabIds.filter(id => !validCollabIds.has(id));

      if (orphanClients.length > 0 || orphanCollabs.length > 0) {
        // Identifier les noms Pennylane concernés pour un message clair
        const badClientNames = Object.entries(mappingClients)
          .filter(([, id]) => orphanClients.includes(id))
          .map(([name, id]) => `"${name}" (id=${id})`);
        const badCollabNames = Object.entries(mappingCollaborateurs)
          .filter(([, id]) => orphanCollabs.includes(id))
          .map(([name, id]) => `"${name}" (id=${id})`);

        const msg = [
          'Mappings invalides détectés (client ou collaborateur supprimé) :',
          ...badClientNames.map(n => `  Client: ${n}`),
          ...badCollabNames.map(n => `  Collab: ${n}`),
          '',
          'Corrigez ces mappings avant de relancer l\'import.'
        ].join('\n');

        alert(msg);
        setSaving(false);
        return;
      }

      // 3. Vérifier qu'il y a des données à importer
      if (newTempsReels.length === 0) {
        alert('Aucune donnée valide à importer.\n\nVérifiez que les mappings collaborateurs et clients sont configurés.');
        setSaving(false);
        return;
      }

      // 4. Agréger les nouvelles données par collaborateur/client/date
      const aggregatedNew = {};
      newTempsReels.forEach(t => {
        const key = `${t.collaborateur_id}-${t.client_id}-${t.date}`;
        if (!aggregatedNew[key]) {
          aggregatedNew[key] = { ...t };
        } else {
          // Additionner les heures pour la même combinaison
          aggregatedNew[key].heures += t.heures;
          // Concaténer les commentaires distincts
          if (t.commentaire && !aggregatedNew[key].commentaire?.includes(t.commentaire)) {
            aggregatedNew[key].commentaire = aggregatedNew[key].commentaire
              ? `${aggregatedNew[key].commentaire} | ${t.commentaire}`
              : t.commentaire;
          }
        }
      });
      const nouvellesDonneesAgregees = Object.values(aggregatedNew);

      // 5. Déterminer la période pour le journal
      const dates = nouvellesDonneesAgregees.map(t => t.date).filter(d => d);
      const periodeDebut = dates.reduce((min, d) => d < min ? d : min, dates[0]);
      const periodeFin = dates.reduce((max, d) => d > max ? d : max, dates[0]);

      // 6. Récupérer les données existantes pour ces combinaisons spécifiques
      // On ne récupère QUE les combinaisons qui sont dans le fichier importé
      const keysToCheck = nouvellesDonneesAgregees.map(t => ({
        collaborateur_id: t.collaborateur_id,
        client_id: t.client_id,
        date: t.date
      }));

      // Requête pour récupérer les temps existants qui correspondent aux clés importées
      const { data: existingTemps, error: fetchError } = await supabase
        .from('temps_reels')
        .select('*')
        .gte('date', periodeDebut)
        .lte('date', periodeFin);

      if (fetchError) throw fetchError;

      // Indexer les données existantes
      const existingIndex = {};
      (existingTemps || []).forEach(t => {
        const key = `${t.collaborateur_id}-${t.client_id}-${t.date}`;
        existingIndex[key] = t;
      });

      // 7. FUSION INTELLIGENTE : Séparer ajouts et mises à jour
      const modifications = {
        ajouts: [],
        modifications: [],
        inchanges: []
      };

      const toInsert = [];
      const toUpdate = [];

      nouvellesDonneesAgregees.forEach(nouveau => {
        const key = `${nouveau.collaborateur_id}-${nouveau.client_id}-${nouveau.date}`;
        const existant = existingIndex[key];
        const collab = collaborateurs.find(c => c.id === nouveau.collaborateur_id);
        const client = clients.find(c => c.id === nouveau.client_id);

        if (!existant) {
          // AJOUT : La combinaison n'existe pas encore
          toInsert.push(nouveau);
          modifications.ajouts.push({
            collaborateur: collab?.nom || 'Inconnu',
            client: client?.nom || 'Inconnu',
            date: nouveau.date,
            heures: Math.round(nouveau.heures * 100) / 100
          });
        } else {
          // Vérifier si les heures sont différentes
          const heuresExistantes = parseFloat(existant.heures);
          const heuresNouvelles = nouveau.heures;

          if (Math.abs(heuresExistantes - heuresNouvelles) > 0.01) {
            // MODIFICATION : Les heures sont différentes
            toUpdate.push({
              id: existant.id,
              ...nouveau
            });
            modifications.modifications.push({
              collaborateur: collab?.nom || 'Inconnu',
              client: client?.nom || 'Inconnu',
              date: nouveau.date,
              anciennesHeures: heuresExistantes,
              nouvellesHeures: Math.round(heuresNouvelles * 100) / 100,
              ecart: Math.round((heuresNouvelles - heuresExistantes) * 100) / 100
            });
          } else {
            // INCHANGE : Les heures sont identiques
            modifications.inchanges.push({
              collaborateur: collab?.nom || 'Inconnu',
              client: client?.nom || 'Inconnu',
              date: nouveau.date,
              heures: heuresExistantes
            });
          }
        }
      });

      // 8. Exécuter les insertions
      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('temps_reels')
          .insert(toInsert);

        if (insertError) throw insertError;
      }

      // 9. Exécuter les mises à jour une par une (upsert)
      for (const item of toUpdate) {
        const { id, ...dataWithoutId } = item;
        const { error: updateError } = await supabase
          .from('temps_reels')
          .update({
            heures: dataWithoutId.heures,
            commentaire: dataWithoutId.commentaire,
            activite: dataWithoutId.activite,
            type_mission: dataWithoutId.type_mission,
            millesime: dataWithoutId.millesime
          })
          .eq('id', id);

        if (updateError) throw updateError;
      }

      // 10. Enregistrer dans le journal
      const hasChanges = modifications.ajouts.length > 0 || modifications.modifications.length > 0;

      if (hasChanges) {
        const { data: journalEntry, error: journalError } = await supabase
          .from('journal_imports')
          .insert({
            periode_debut: periodeDebut,
            periode_fin: periodeFin,
            nb_ajouts: modifications.ajouts.length,
            nb_modifications: modifications.modifications.length,
            nb_suppressions: 0, // Plus jamais de suppression automatique !
            details: {
              ...modifications,
              lignesIgnorees: lignesIgnoreesDetails.slice(0, 20) // Limiter pour ne pas surcharger
            }
          })
          .select()
          .single();

        if (!journalError && journalEntry) {
          setJournalModifications(prev => [journalEntry, ...prev]);
        }
      }

      // 11. Recharger les temps réels depuis Supabase
      const { data: newTempsData } = await supabase
        .from('temps_reels')
        .select('*')
        .order('date', { ascending: false });

      setTempsReels(newTempsData || []);

      // 12. Afficher le résumé
      const resume = [
        `Import terminé (mode fusion) !`,
        `Période concernée: ${periodeDebut} au ${periodeFin}`,
        '',
        `${modifications.ajouts.length} nouveau(x) temps ajouté(s)`,
        `${modifications.modifications.length} temps mis à jour`,
        `${modifications.inchanges.length} temps inchangé(s)`,
        `${lignesIgnorees} ligne(s) ignorée(s) (mapping manquant)`,
        '',
        `Aucune donnée supprimée (mode fusion)`
      ].join('\n');

      alert(resume);

      // Ne plus modifier les filtres après import - ils restent sur J-1
      // Aller à l'onglet écarts
      setActiveTab('ecarts');

    } catch (err) {
      console.error('Erreur import:', err);
      alert('Erreur lors de l\'import: ' + err.message);
    }
    setSaving(false);
  };

  // Calcul des écarts
  const calculateEcarts = () => {
    // Filtrer les charges budgétées selon la période
    const chargesFiltrees = charges.filter(c => {
      if (c.date_charge < dateDebut || c.date_charge > dateFin) return false;
      if (filtreCollaborateur && c.collaborateur_id !== parseInt(filtreCollaborateur)) return false;
      if (filtreClient && c.client_id !== parseInt(filtreClient)) return false;
      return true;
    });

    // Filtrer les temps réels selon la période
    const tempsReelsFiltres = tempsReels.filter(t => {
      if (t.date < dateDebut || t.date > dateFin) return false;
      if (filtreCollaborateur && t.collaborateur_id !== parseInt(filtreCollaborateur)) return false;
      if (filtreClient && t.client_id !== parseInt(filtreClient)) return false;
      return true;
    });

    // Agréger par collaborateur et client
    const ecarts = {};

    // Ajouter les heures budgétées
    chargesFiltrees.forEach(c => {
      const key = `${c.collaborateur_id}-${c.client_id}`;
      if (!ecarts[key]) {
        ecarts[key] = {
          collaborateur_id: c.collaborateur_id,
          client_id: c.client_id,
          heuresBudgetees: 0,
          heuresReelles: 0,
          commentaires: new Set()
        };
      }
      ecarts[key].heuresBudgetees += c.heures || 0;
    });

    // Ajouter les heures réelles et les commentaires
    tempsReelsFiltres.forEach(t => {
      const key = `${t.collaborateur_id}-${t.client_id}`;
      if (!ecarts[key]) {
        ecarts[key] = {
          collaborateur_id: t.collaborateur_id,
          client_id: t.client_id,
          heuresBudgetees: 0,
          heuresReelles: 0,
          commentaires: new Set()
        };
      }
      ecarts[key].heuresReelles += t.heures || 0;
      // Ajouter le commentaire s'il existe et n'est pas vide
      if (t.commentaire && t.commentaire.trim()) {
        ecarts[key].commentaires.add(t.commentaire.trim());
      }
    });

    // Calculer les écarts et enrichir avec les noms
    return Object.values(ecarts).map(e => {
      const collab = collaborateurs.find(c => c.id === e.collaborateur_id);
      const client = clients.find(c => c.id === e.client_id);
      const ecart = e.heuresReelles - e.heuresBudgetees;
      const ecartPourcent = e.heuresBudgetees > 0 ? Math.round((ecart / e.heuresBudgetees) * 100) : (e.heuresReelles > 0 ? 100 : 0);

      // Déterminer le cabinet du client (ZG = Zerah Fiduciaire, AU = Audit Up)
      const cabinetCode = client?.cabinet === 'Zerah Fiduciaire' ? 'ZG' : client?.cabinet === 'Audit Up' ? 'AU' : '-';

      return {
        ...e,
        collaborateurNom: collab?.nom || 'Inconnu',
        clientNom: client?.nom || 'Inconnu',
        cabinet: cabinetCode,
        ecart: Math.round(ecart * 100) / 100,
        ecartPourcent,
        detailTravail: Array.from(e.commentaires).join(' | ')
      };
    });
  };

  const ecartsRaw = calculateEcarts();

  // Filtrer par recherche
  const ecartsFiltres = ecartsRaw.filter(e => {
    if (!searchEcarts) return true;
    const search = searchEcarts.toLowerCase();
    return e.collaborateurNom.toLowerCase().includes(search) ||
           e.clientNom.toLowerCase().includes(search);
  });

  // Trier les écarts
  const ecarts = [...ecartsFiltres].sort((a, b) => {
    const dir = sortEcarts.direction === 'asc' ? 1 : -1;
    switch (sortEcarts.column) {
      case 'cabinet':
        return dir * a.cabinet.localeCompare(b.cabinet);
      case 'collaborateur':
        return dir * a.collaborateurNom.localeCompare(b.collaborateurNom);
      case 'client':
        return dir * a.clientNom.localeCompare(b.clientNom);
      case 'budgetees':
        return dir * (a.heuresBudgetees - b.heuresBudgetees);
      case 'reelles':
        return dir * (a.heuresReelles - b.heuresReelles);
      case 'ecart':
        return dir * (Math.abs(a.ecart) - Math.abs(b.ecart));
      case 'ecartPourcent':
        return dir * (Math.abs(a.ecartPourcent) - Math.abs(b.ecartPourcent));
      default:
        return dir * (Math.abs(a.ecart) - Math.abs(b.ecart));
    }
  });

  // Fonction pour changer le tri
  const handleSort = (column) => {
    setSortEcarts(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Icône de tri
  const SortIcon = ({ column }) => {
    if (sortEcarts.column !== column) return <ChevronDown size={14} className="text-white" />;
    return sortEcarts.direction === 'desc'
      ? <ChevronDown size={14} className="text-pink-400" />
      : <ChevronUp size={14} className="text-pink-400" />;
  };

  // Totaux
  const totaux = ecarts.reduce((acc, e) => ({
    budgetees: acc.budgetees + e.heuresBudgetees,
    reelles: acc.reelles + e.heuresReelles,
    ecart: acc.ecart + e.ecart
  }), { budgetees: 0, reelles: 0, ecart: 0 });

  // Compter les mappings manquants
  const mappingCollabsManquants = uniquePennylaneCollabs.filter(p => !mappingCollaborateurs[p]).length;
  const mappingClientsManquants = uniquePennylaneClients.filter(p => !mappingClients[p]).length;

  // Afficher un écran de chargement au démarrage
  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-slate-800/80 backdrop-blur-sm rounded-xl p-12 shadow-xl border border-slate-700 text-center">
          <div className="animate-spin w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-white text-lg">Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="bg-slate-800/80 backdrop-blur-sm rounded-xl p-6 shadow-xl border border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Clock className="text-pink-400" />
              Temps Réels & Analyse des Écarts
              {saving && <span className="text-sm font-normal text-yellow-400 animate-pulse ml-2">(Sauvegarde...)</span>}
            </h2>
            <p className="text-white mt-1">Import des temps Pennylane et comparaison avec les temps budgétés</p>
          </div>

          {tempsReels.length > 0 && (
            <div className="text-right">
              <div className="text-sm text-white">Temps réels importés</div>
              <div className="text-2xl font-bold text-green-400">{tempsReels.length} entrées</div>
            </div>
          )}
        </div>

        {/* Onglets */}
        <div className="flex gap-2 mb-6 border-b border-slate-600 pb-4">
          <button
            onClick={() => setActiveTab('mapping')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === 'mapping' ? `${accent.color} text-white` : 'bg-slate-700 text-white hover:bg-slate-600'
            }`}
          >
            <Link2 size={18} />
            Correspondances
            {(mappingCollabsManquants > 0 || mappingClientsManquants > 0) && importedData.length > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {mappingCollabsManquants + mappingClientsManquants}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === 'import' ? `${accent.color} text-white` : 'bg-slate-700 text-white hover:bg-slate-600'
            }`}
          >
            <Upload size={18} />
            Import Excel
          </button>
          <button
            onClick={() => setActiveTab('ecarts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === 'ecarts' ? `${accent.color} text-white` : 'bg-slate-700 text-white hover:bg-slate-600'
            }`}
          >
            <BarChart3 size={18} />
            Analyse des Écarts
          </button>
          <button
            onClick={() => setActiveTab('journal')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === 'journal' ? `${accent.color} text-white` : 'bg-slate-700 text-white hover:bg-slate-600'
            }`}
          >
            <FileText size={18} />
            Journal
            {journalModifications.length > 0 && (
              <span className="bg-slate-500 text-white text-xs px-2 py-0.5 rounded-full">
                {journalModifications.length}
              </span>
            )}
          </button>
        </div>

        {/* Onglet Correspondances */}
        {activeTab === 'mapping' && (
          <div className="space-y-6">
            {/* Section Collaborateurs */}
            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Users size={20} className="text-blue-400" />
                  Collaborateurs
                  {uniquePennylaneCollabs.length > 0 && (
                    <span className="text-sm font-normal">
                      (<span className="text-green-400">{uniquePennylaneCollabs.filter(p => mappingCollaborateurs[p]).length}</span>
                      /{uniquePennylaneCollabs.length} mappés)
                    </span>
                  )}
                </h3>
                <button
                  onClick={autoMatchCollaborateurs}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition"
                  disabled={uniquePennylaneCollabs.length === 0}
                >
                  <RefreshCw size={16} />
                  Auto-matching
                </button>
              </div>

              {uniquePennylaneCollabs.length === 0 ? (
                <p className="text-white text-center py-4">
                  Importez d'abord un fichier Excel pour voir les collaborateurs à mapper
                </p>
              ) : (
                <div className="grid gap-2 max-h-64 overflow-y-auto">
                  {uniquePennylaneCollabs.map(pennylane => {
                    const isMapped = !!mappingCollaborateurs[pennylane];
                    return (
                      <div
                        key={pennylane}
                        className={`flex items-center gap-3 rounded-lg p-2 border ${
                          isMapped
                            ? 'bg-green-900/30 border-green-600/50'
                            : 'bg-slate-600/50 border-transparent'
                        }`}
                      >
                        {isMapped ? (
                          <Check size={16} className="text-green-400 flex-shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-slate-500 flex-shrink-0" />
                        )}
                        <div className={`flex-1 text-sm truncate ${isMapped ? 'text-green-200' : 'text-white'}`} title={pennylane}>
                          {pennylane}
                        </div>
                        <ArrowUpDown size={16} className="text-white" />
                        <select
                          value={mappingCollaborateurs[pennylane] || ''}
                          onChange={(e) => saveMappingCollaborateur(pennylane, e.target.value ? parseInt(e.target.value) : null)}
                          className={`w-48 px-3 py-1.5 rounded-lg text-sm ${
                            isMapped
                              ? 'bg-green-600/30 border-green-500 text-white'
                              : 'bg-slate-700 border-slate-600 text-white'
                          } border`}
                        >
                          <option value="">-- Non mappé --</option>
                          {collaborateurs.map(c => (
                            <option key={c.id} value={c.id}>{c.nom}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section Clients */}
            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Building2 size={20} className="text-purple-400" />
                  Clients
                  {uniquePennylaneClients.length > 0 && (
                    <span className="text-sm font-normal">
                      (<span className="text-green-400">{uniquePennylaneClients.filter(p => mappingClients[p]).length}</span>
                      /{uniquePennylaneClients.length} mappés)
                    </span>
                  )}
                </h3>
                <button
                  onClick={autoMatchClients}
                  className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition"
                  disabled={uniquePennylaneClients.length === 0}
                >
                  <RefreshCw size={16} />
                  Auto-matching
                </button>
              </div>

              {uniquePennylaneClients.length === 0 ? (
                <p className="text-white text-center py-4">
                  Importez d'abord un fichier Excel pour voir les clients à mapper
                </p>
              ) : (
                <div className="grid gap-2 max-h-96 overflow-y-auto">
                  {uniquePennylaneClients.map(pennylane => {
                    const isMapped = !!mappingClients[pennylane];
                    return (
                      <div
                        key={pennylane}
                        className={`flex items-center gap-3 rounded-lg p-2 border ${
                          isMapped
                            ? 'bg-green-900/30 border-green-600/50'
                            : 'bg-slate-600/50 border-transparent'
                        }`}
                      >
                        {isMapped ? (
                          <Check size={16} className="text-green-400 flex-shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-slate-500 flex-shrink-0" />
                        )}
                        <div className={`flex-1 text-sm truncate ${isMapped ? 'text-green-200' : 'text-white'}`} title={pennylane}>
                          {pennylane}
                        </div>
                        <ArrowUpDown size={16} className="text-white" />
                        <select
                          value={mappingClients[pennylane] || ''}
                          onChange={(e) => saveMappingClient(pennylane, e.target.value ? parseInt(e.target.value) : null)}
                          className={`w-64 px-3 py-1.5 rounded-lg text-sm ${
                            isMapped
                              ? 'bg-green-600/30 border-green-500 text-white'
                              : 'bg-slate-700 border-slate-600 text-white'
                          } border`}
                        >
                          <option value="">-- Non mappé --</option>
                          {[...clients].sort((a, b) => {
                            if (a.actif !== b.actif) return a.actif ? -1 : 1;
                            return a.nom.localeCompare(b.nom, 'fr');
                          }).map(c => (
                            <option key={c.id} value={c.id}>{c.nom}{!c.actif ? ' (inactif)' : ''}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Onglet Import */}
        {activeTab === 'import' && (
          <div className="space-y-6">
            {/* Info mode fusion */}
            <div className="bg-green-500/20 border border-green-500 rounded-lg p-4 flex items-start gap-3">
              <Check className="text-green-400 flex-shrink-0 mt-0.5" size={24} />
              <div>
                <p className="text-green-400 font-medium mb-1">Mode Fusion Intelligente</p>
                <p className="text-white text-sm">
                  Les temps importés seront ajoutés ou mis à jour. Les données existantes non présentes dans le fichier ne seront jamais supprimées.
                  Le cabinet est automatiquement déterminé par le client.
                </p>
              </div>
            </div>

            {/* Zone d'upload */}
            <div className="border-2 border-dashed rounded-xl p-8 text-center transition border-slate-600 hover:border-pink-500">
              <Upload size={48} className="mx-auto text-white mb-4" />
              <p className="text-white text-lg mb-2">Importez votre fichier Excel Pennylane</p>
              <p className="text-white text-sm mb-4">
                Format attendu: Collaborateur, Client, Date, Durée Facturée, etc.
              </p>
              <label className={`inline-flex items-center gap-2 px-6 py-3 ${accent.color} ${accent.hover} text-white rounded-lg cursor-pointer transition`}>
                <Upload size={20} />
                Choisir un fichier
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Statistiques d'import */}
            {importStats && (
              <div className="bg-slate-700/50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Résumé de l'import</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-600/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-white">{importStats.totalLignes}</div>
                    <div className="text-sm text-white">Lignes</div>
                  </div>
                  <div className="bg-slate-600/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-400">{importStats.collaborateurs}</div>
                    <div className="text-sm text-white">Collaborateurs</div>
                  </div>
                  <div className="bg-slate-600/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-purple-400">{importStats.clients}</div>
                    <div className="text-sm text-white">Clients</div>
                  </div>
                  <div className="bg-slate-600/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-400">{importStats.totalHeures}h</div>
                    <div className="text-sm text-white">Heures totales</div>
                  </div>
                </div>

                {/* Alerte si mappings manquants */}
                {(mappingCollabsManquants > 0 || mappingClientsManquants > 0) && (
                  <div className="mt-4 bg-amber-500/20 border border-amber-500 rounded-lg p-3 flex items-center gap-3">
                    <AlertCircle className="text-amber-400" size={24} />
                    <div>
                      <p className="text-amber-400 font-medium">Correspondances manquantes</p>
                      <p className="text-white text-sm">
                        {mappingCollabsManquants} collaborateur(s) et {mappingClientsManquants} client(s) non mappés.
                        Allez dans l'onglet "Correspondances" pour les configurer.
                      </p>
                    </div>
                  </div>
                )}

                {/* Bouton de validation */}
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleValidateImport}
                    className={`flex items-center gap-2 px-6 py-3 ${accent.color} ${accent.hover} text-white rounded-lg transition`}
                    disabled={importedData.length === 0}
                  >
                    <Check size={20} />
                    Valider et enregistrer les temps réels
                  </button>
                </div>
              </div>
            )}

            {/* Aperçu des données */}
            {importedData.length > 0 && (
              <div className="bg-slate-700/50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Aperçu des données ({importedData.length} lignes)</h3>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-600/50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-white">Collaborateur</th>
                        <th className="px-3 py-2 text-left text-white">Client</th>
                        <th className="px-3 py-2 text-left text-white">Date</th>
                        <th className="px-3 py-2 text-right text-white">Heures</th>
                        <th className="px-3 py-2 text-left text-white">Activité</th>
                        <th className="px-3 py-2 text-center text-white">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importedData.slice(0, 50).map((row, idx) => {
                        const collabMapped = mappingCollaborateurs[row.collaborateurPennylane];
                        const clientMapped = mappingClients[row.clientPennylane];
                        const isComplete = collabMapped && clientMapped;

                        return (
                          <tr key={idx} className={`border-t border-slate-600 ${isComplete ? '' : 'bg-red-500/10'}`}>
                            <td className="px-3 py-2 text-white">{row.collaborateurPennylane}</td>
                            <td className="px-3 py-2 text-white">{row.clientPennylane}</td>
                            <td className="px-3 py-2 text-white">{row.date}</td>
                            <td className="px-3 py-2 text-right text-green-400">{row.dureeHeures}h</td>
                            <td className="px-3 py-2 text-white truncate max-w-xs">{row.activite}</td>
                            <td className="px-3 py-2 text-center">
                              {isComplete ? (
                                <Check size={16} className="text-green-400 mx-auto" />
                              ) : (
                                <X size={16} className="text-red-400 mx-auto" />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {importedData.length > 50 && (
                    <p className="text-center text-white py-2">
                      ... et {importedData.length - 50} autres lignes
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Onglet Analyse des Écarts */}
        {activeTab === 'ecarts' && (
          <div className="space-y-6">
            {/* Filtres */}
            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-sm text-white mb-1">Collaborateur</label>
                  <select
                    value={filtreCollaborateur}
                    onChange={(e) => setFiltreCollaborateur(e.target.value)}
                    className="px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white"
                  >
                    <option value="">Tous</option>
                    {collaborateurs.map(c => (
                      <option key={c.id} value={c.id}>{c.nom}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-white mb-1">Client</label>
                  <select
                    value={filtreClient}
                    onChange={(e) => setFiltreClient(e.target.value)}
                    className="px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white"
                  >
                    <option value="">Tous</option>
                    {[...clients].sort((a, b) => {
                      if (a.actif !== b.actif) return a.actif ? -1 : 1;
                      return a.nom.localeCompare(b.nom, 'fr');
                    }).map(c => (
                      <option key={c.id} value={c.id}>{c.nom}{!c.actif ? ' (inactif)' : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-white mb-1">Du</label>
                  <input
                    type="date"
                    value={dateDebut}
                    onChange={(e) => setDateDebut(e.target.value)}
                    className="px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm text-white mb-1">Au</label>
                  <input
                    type="date"
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                    className="px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white"
                  />
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm text-white mb-1">Rechercher</label>
                  <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white" />
                    <input
                      type="text"
                      value={searchEcarts}
                      onChange={(e) => setSearchEcarts(e.target.value)}
                      placeholder="Collaborateur ou client..."
                      className="w-full pl-10 pr-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400"
                    />
                    {searchEcarts && (
                      <button
                        onClick={() => setSearchEcarts('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white hover:text-white"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Résumé global */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-500/20 border border-blue-500 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-400">{Math.round(totaux.budgetees * 10) / 10}h</div>
                <div className="text-sm text-white">Heures budgétées</div>
              </div>
              <div className="bg-green-500/20 border border-green-500 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-400">{Math.round(totaux.reelles * 10) / 10}h</div>
                <div className="text-sm text-white">Heures réelles</div>
              </div>
              <div className={`${totaux.ecart > 0 ? 'bg-red-500/20 border-red-500' : 'bg-emerald-500/20 border-emerald-500'} border rounded-lg p-4 text-center`}>
                <div className={`text-3xl font-bold ${totaux.ecart > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {totaux.ecart > 0 ? '+' : ''}{Math.round(totaux.ecart * 10) / 10}h
                </div>
                <div className="text-sm text-white">Écart total</div>
              </div>
              <div className={`${totaux.ecart > 0 ? 'bg-red-500/20 border-red-500' : 'bg-emerald-500/20 border-emerald-500'} border rounded-lg p-4 text-center`}>
                <div className={`text-3xl font-bold ${totaux.ecart > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {totaux.budgetees > 0 ? (totaux.ecart > 0 ? '+' : '') + Math.round((totaux.ecart / totaux.budgetees) * 100) : 0}%
                </div>
                <div className="text-sm text-white">Variation</div>
              </div>
            </div>

            {/* Tableau des écarts */}
            {ecarts.length === 0 ? (
              <div className="text-center py-12">
                <BarChart3 size={48} className="mx-auto text-white mb-4" />
                <p className="text-white">Aucune donnée à afficher pour cette période</p>
                <p className="text-white text-sm mt-2">Importez des temps réels ou ajustez les filtres</p>
              </div>
            ) : (
              <div className="bg-slate-700/50 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-600/50">
                      <tr>
                        <th
                          onClick={() => handleSort('cabinet')}
                          className="px-2 py-3 text-center text-white font-medium cursor-pointer hover:bg-slate-500/30 transition select-none"
                          title="Cabinet (ZG = Zerah, AU = Audit Up)"
                        >
                          <div className="flex items-center justify-center gap-1">
                            Cab.
                            <SortIcon column="cabinet" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('collaborateur')}
                          className="px-4 py-3 text-left text-white font-medium cursor-pointer hover:bg-slate-500/30 transition select-none"
                        >
                          <div className="flex items-center gap-1">
                            Collaborateur
                            <SortIcon column="collaborateur" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('client')}
                          className="px-4 py-3 text-left text-white font-medium cursor-pointer hover:bg-slate-500/30 transition select-none"
                        >
                          <div className="flex items-center gap-1">
                            Client
                            <SortIcon column="client" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('budgetees')}
                          className="px-4 py-3 text-right text-white font-medium cursor-pointer hover:bg-slate-500/30 transition select-none"
                        >
                          <div className="flex items-center justify-end gap-1">
                            Budgété
                            <SortIcon column="budgetees" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('reelles')}
                          className="px-4 py-3 text-right text-white font-medium cursor-pointer hover:bg-slate-500/30 transition select-none"
                        >
                          <div className="flex items-center justify-end gap-1">
                            Réel
                            <SortIcon column="reelles" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('ecart')}
                          className="px-4 py-3 text-right text-white font-medium cursor-pointer hover:bg-slate-500/30 transition select-none"
                        >
                          <div className="flex items-center justify-end gap-1">
                            Écart
                            <SortIcon column="ecart" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('ecartPourcent')}
                          className="px-4 py-3 text-right text-white font-medium cursor-pointer hover:bg-slate-500/30 transition select-none"
                        >
                          <div className="flex items-center justify-end gap-1">
                            %
                            <SortIcon column="ecartPourcent" />
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left text-white font-medium">
                          Détail travail
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ecarts.map((e, idx) => (
                        <tr key={idx} className="border-t border-slate-600 hover:bg-slate-600/30">
                          <td className={`px-2 py-3 text-center font-medium ${e.cabinet === 'ZG' ? 'text-purple-400' : e.cabinet === 'AU' ? 'text-cyan-400' : 'text-white'}`}>
                            {e.cabinet}
                          </td>
                          <td className="px-4 py-3 text-white">{e.collaborateurNom}</td>
                          <td className="px-4 py-3 text-white">{e.clientNom}</td>
                          <td className="px-4 py-3 text-right text-blue-400">{Math.round(e.heuresBudgetees * 10) / 10}h</td>
                          <td className="px-4 py-3 text-right text-green-400">{Math.round(e.heuresReelles * 10) / 10}h</td>
                          <td className={`px-4 py-3 text-right font-medium ${e.ecart > 0 ? 'text-red-400' : e.ecart < 0 ? 'text-emerald-400' : 'text-white'}`}>
                            {e.ecart > 0 ? '+' : ''}{e.ecart}h
                          </td>
                          <td className={`px-4 py-3 text-right ${e.ecartPourcent > 20 ? 'text-red-400' : e.ecartPourcent < -20 ? 'text-emerald-400' : 'text-white'}`}>
                            {e.ecartPourcent > 0 ? '+' : ''}{e.ecartPourcent}%
                          </td>
                          <td className="px-4 py-3 text-white text-sm max-w-md truncate" title={e.detailTravail}>
                            {e.detailTravail || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Export */}
            {ecarts.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    const wb = XLSX.utils.book_new();
                    const wsData = [
                      ['Cabinet', 'Collaborateur', 'Client', 'Heures Budgétées', 'Heures Réelles', 'Écart (h)', 'Écart (%)', 'Détail travail'],
                      ...ecarts.map(e => [
                        e.cabinet,
                        e.collaborateurNom,
                        e.clientNom,
                        Math.round(e.heuresBudgetees * 10) / 10,
                        Math.round(e.heuresReelles * 10) / 10,
                        e.ecart,
                        e.ecartPourcent,
                        e.detailTravail || ''
                      ]),
                      [],
                      ['TOTAL', '', '', Math.round(totaux.budgetees * 10) / 10, Math.round(totaux.reelles * 10) / 10, Math.round(totaux.ecart * 10) / 10, totaux.budgetees > 0 ? Math.round((totaux.ecart / totaux.budgetees) * 100) : 0, '']
                    ];
                    const ws = XLSX.utils.aoa_to_sheet(wsData);
                    XLSX.utils.book_append_sheet(wb, ws, 'Écarts');
                    XLSX.writeFile(wb, `ecarts_${dateDebut}_${dateFin}.xlsx`);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition"
                >
                  <Download size={18} />
                  Exporter en Excel
                </button>
              </div>
            )}
          </div>
        )}

        {/* Onglet Journal des modifications */}
        {activeTab === 'journal' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-white">Historique des imports</h3>

            {journalModifications.length === 0 ? (
              <div className="text-center py-12">
                <FileText size={48} className="mx-auto text-white mb-4" />
                <p className="text-white">Aucune modification enregistrée</p>
                <p className="text-white text-sm mt-2">Les modifications apparaîtront ici après chaque import</p>
              </div>
            ) : (
              <div className="space-y-4">
                {journalModifications.map((entry, idx) => {
                  // Support des deux formats: ancien (localStorage) et nouveau (Supabase)
                  const dateImport = new Date(entry.date_import || entry.date);
                  const details = entry.details || entry;
                  const ajouts = details.ajouts || [];
                  const modifications = details.modifications || [];
                  const suppressions = details.suppressions || [];
                  const periodeDebut = entry.periode_debut || entry.periodeDebut;
                  const periodeFin = entry.periode_fin || entry.periodeFin;

                  return (
                    <div key={idx} className="bg-slate-700/50 rounded-lg overflow-hidden">
                      {/* En-tête de l'entrée */}
                      <div className="bg-slate-600/50 px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-white font-medium">
                            {dateImport.toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                          <div className="text-white text-sm">
                            Période: {periodeDebut} → {periodeFin}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {ajouts.length > 0 && (
                            <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded">
                              +{ajouts.length} ajout(s)
                            </span>
                          )}
                          {modifications.length > 0 && (
                            <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-1 rounded">
                              {modifications.length} modif(s)
                            </span>
                          )}
                          {suppressions.length > 0 && (
                            <span className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded">
                              -{suppressions.length} suppression(s)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Détails des modifications */}
                      <div className="p-4 space-y-4">
                        {/* Suppressions (en premier car plus critique) */}
                        {suppressions.length > 0 && (
                          <div>
                            <h4 className="text-red-400 font-medium mb-2 flex items-center gap-2">
                              <Trash2 size={16} />
                              Entrées supprimées ({suppressions.length})
                            </h4>
                            <div className="bg-red-500/10 rounded-lg overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-red-500/20">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-red-300">Collaborateur</th>
                                    <th className="px-3 py-2 text-left text-red-300">Client</th>
                                    <th className="px-3 py-2 text-left text-red-300">Date</th>
                                    <th className="px-3 py-2 text-right text-red-300">Heures perdues</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {suppressions.map((s, sIdx) => (
                                    <tr key={sIdx} className="border-t border-red-500/20">
                                      <td className="px-3 py-2 text-white">{s.collaborateur}</td>
                                      <td className="px-3 py-2 text-white">{s.client}</td>
                                      <td className="px-3 py-2 text-white">{s.date}</td>
                                      <td className="px-3 py-2 text-right text-red-400">-{s.heures}h</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Modifications */}
                        {modifications.length > 0 && (
                          <div>
                            <h4 className="text-amber-400 font-medium mb-2 flex items-center gap-2">
                              <Pencil size={16} />
                              Heures modifiées ({modifications.length})
                            </h4>
                            <div className="bg-amber-500/10 rounded-lg overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-amber-500/20">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-amber-300">Collaborateur</th>
                                    <th className="px-3 py-2 text-left text-amber-300">Client</th>
                                    <th className="px-3 py-2 text-left text-amber-300">Date</th>
                                    <th className="px-3 py-2 text-right text-amber-300">Avant</th>
                                    <th className="px-3 py-2 text-right text-amber-300">Après</th>
                                    <th className="px-3 py-2 text-right text-amber-300">Écart</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {modifications.map((m, mIdx) => (
                                    <tr key={mIdx} className="border-t border-amber-500/20">
                                      <td className="px-3 py-2 text-white">{m.collaborateur}</td>
                                      <td className="px-3 py-2 text-white">{m.client}</td>
                                      <td className="px-3 py-2 text-white">{m.date}</td>
                                      <td className="px-3 py-2 text-right text-white">{m.anciennesHeures}h</td>
                                      <td className="px-3 py-2 text-right text-white">{m.nouvellesHeures}h</td>
                                      <td className={`px-3 py-2 text-right font-medium ${m.ecart > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                        {m.ecart > 0 ? '+' : ''}{m.ecart}h
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Ajouts (moins critique, replié par défaut si beaucoup) */}
                        {ajouts.length > 0 && (
                          <div>
                            <h4 className="text-green-400 font-medium mb-2 flex items-center gap-2">
                              <Plus size={16} />
                              Nouvelles entrées ({ajouts.length})
                            </h4>
                            {ajouts.length <= 10 ? (
                              <div className="bg-green-500/10 rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-green-500/20">
                                    <tr>
                                      <th className="px-3 py-2 text-left text-green-300">Collaborateur</th>
                                      <th className="px-3 py-2 text-left text-green-300">Client</th>
                                      <th className="px-3 py-2 text-left text-green-300">Date</th>
                                      <th className="px-3 py-2 text-right text-green-300">Heures</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ajouts.map((a, aIdx) => (
                                      <tr key={aIdx} className="border-t border-green-500/20">
                                        <td className="px-3 py-2 text-white">{a.collaborateur}</td>
                                        <td className="px-3 py-2 text-white">{a.client}</td>
                                        <td className="px-3 py-2 text-white">{a.date}</td>
                                        <td className="px-3 py-2 text-right text-green-400">+{a.heures}h</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="bg-green-500/10 rounded-lg p-3 text-green-300 text-sm">
                                {ajouts.length} nouvelles entrées ajoutées
                                (total: {Math.round(ajouts.reduce((sum, a) => sum + a.heures, 0) * 10) / 10}h)
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


export default TempsReelsPage;
