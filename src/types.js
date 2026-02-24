// @ts-check

/**
 * @file Définitions des types pour l'application Calendrier Zerah
 * Ces types sont utilisés avec JSDoc pour le typage statique
 */

// ============================================
// TYPES DE BASE - ENTITÉS SUPABASE
// ============================================

/**
 * @typedef {Object} Collaborateur
 * @property {number} id - Identifiant unique
 * @property {string} nom - Nom du collaborateur
 * @property {string|null} email - Email du collaborateur
 * @property {boolean} actif - Si le collaborateur est actif
 * @property {boolean} est_chef_mission - Si c'est un chef de mission
 * @property {boolean} is_admin - Si c'est un administrateur
 * @property {string|null} couleur - Code couleur hex pour l'affichage
 */

/**
 * @typedef {Object} CollaborateurChef
 * @property {number} id - Identifiant unique de la liaison
 * @property {number} collaborateur_id - ID du collaborateur
 * @property {number} chef_id - ID du chef de mission
 */

/**
 * @typedef {'zerah'|'audit_up'} Cabinet
 */

/**
 * @typedef {Object} Client
 * @property {number} id - Identifiant unique
 * @property {string} nom - Nom du client
 * @property {boolean} actif - Si le client est actif
 * @property {'PM'|'PP'|null} type_personne - PM = Personne Morale, PP = Personne Physique
 * @property {string|null} siren - Numéro SIREN (9 chiffres). Clé universelle de matching
 * @property {string|null} siret_complement - NIC : 5 chiffres complémentaires du SIRET (facultatif)
 * @property {Cabinet|null} cabinet - Cabinet (zerah ou audit_up)
 * @property {number|null} chef_mission_id - ID du chef de mission assigné
 * @property {string|null} pennylane_id - ID Pennylane pour la synchronisation
 * @property {string|null} pennylane_customer_id - UUID Pennylane du customer
 * @property {string|null} code_pennylane - Code Pennylane
 * @property {string|null} code_silae - Code dossier Silae
 * @property {string|null} pennylane_client_api_key - Clé API Pennylane du client
 */

/**
 * @typedef {'budgété'|'réalisé'} TypeCharge
 */

/**
 * @typedef {Object} Charge
 * @property {number} id - Identifiant unique
 * @property {number} collaborateur_id - ID du collaborateur
 * @property {number} client_id - ID du client
 * @property {string} date_charge - Date au format YYYY-MM-DD
 * @property {number} heures - Heures budgétées
 * @property {number} heures_realisees - Heures réellement passées
 * @property {TypeCharge} type - Type de charge (budgété ou réalisé)
 * @property {string|null} detail - Description de la tâche
 */

/**
 * @typedef {'mensuel'|'trimestriel'|'ca12'} TVAPeriodicite
 */

/**
 * @typedef {Object} ImpotsTaxes
 * @property {number} id - Identifiant unique
 * @property {number} client_id - ID du client
 * @property {number} annee_fiscale - Année fiscale (ex: 2025)
 * @property {string|null} mois_cloture - Mois de clôture (ex: "Décembre")
 * @property {number|null} tva_jour - Jour du mois pour TVA
 * @property {TVAPeriodicite|null} tva_periodicite - Périodicité TVA
 * @property {boolean|null} soumis_is - Si soumis à l'IS
 * @property {number|null} is_acompte_03 - Acompte IS mars
 * @property {number|null} is_acompte_06 - Acompte IS juin
 * @property {number|null} is_acompte_09 - Acompte IS septembre
 * @property {number|null} is_acompte_12 - Acompte IS décembre
 * @property {number|null} cfe_montant - Montant CFE
 * @property {number|null} cfe_montant_n1 - Montant CFE N-1
 * @property {boolean|null} cvae - Si soumis à la CVAE
 * @property {boolean|null} tvts - Si soumis à la TVTS
 * @property {boolean|null} das2 - Si soumis à la DAS2
 * @property {boolean|null} taxe_salaires - Si soumis à la taxe sur les salaires
 * @property {boolean|null} ifu - Si soumis à l'IFU
 * @property {string|null} created_at - Date de création
 * @property {string|null} updated_at - Date de mise à jour
 */

/**
 * @typedef {Object} SuiviEcheance
 * @property {number} id - Identifiant unique
 * @property {number} client_id - ID du client
 * @property {string} type_echeance - Type d'échéance (tva, is, cvae, etc.)
 * @property {string} date_echeance - Date de l'échéance YYYY-MM-DD
 * @property {number|null} fait_par_id - ID du collaborateur qui a marqué comme fait
 * @property {string|null} fait_le - Date/heure de réalisation
 * @property {number|null} annee_fiscale - Année fiscale
 */

/**
 * @typedef {Object} TempsReel
 * @property {number} id - Identifiant unique
 * @property {number} collaborateur_id - ID du collaborateur
 * @property {number} client_id - ID du client
 * @property {string} date - Date au format YYYY-MM-DD
 * @property {number} heures - Nombre d'heures
 * @property {string|null} commentaire - Commentaire
 * @property {string|null} activite - Type d'activité
 * @property {string|null} type_mission - Type de mission
 * @property {string|null} millesime - Millésime
 */

// ============================================
// TYPES UI / THÈME
// ============================================

/**
 * @typedef {Object} GradientTheme
 * @property {string} id - Identifiant du thème
 * @property {string} name - Nom affiché
 * @property {string} gradient - Classes Tailwind du dégradé
 */

/**
 * @typedef {Object} AccentColor
 * @property {string} id - Identifiant de la couleur
 * @property {string} name - Nom affiché
 * @property {string} color - Classe Tailwind bg
 * @property {string} hover - Classe Tailwind hover
 * @property {string} text - Classe Tailwind text
 * @property {string} ring - Classe Tailwind ring
 */

/**
 * @typedef {'gradient'|'image'} BackgroundThemeType
 */

/**
 * @typedef {Object} BackgroundTheme
 * @property {BackgroundThemeType} type - Type de fond
 * @property {string} [value] - Valeur (id du gradient)
 * @property {string} [imageUrl] - URL de l'image
 * @property {ImageCredits} [credits] - Crédits de l'image
 */

/**
 * @typedef {Object} ImageCredits
 * @property {string} userName - Nom du photographe
 * @property {string} userLink - Lien vers le profil
 */

/**
 * @typedef {Object} UnsplashCategory
 * @property {string} id - Identifiant de la catégorie
 * @property {string} name - Nom affiché
 * @property {string} query - Requête de recherche
 */

// ============================================
// TYPES POUR LES ÉCHÉANCES FISCALES
// ============================================

/**
 * @typedef {Object} EcheanceFiscale
 * @property {number} clientId - ID du client
 * @property {string} client - Nom du client
 * @property {string} type - Type d'échéance (TVA, IS, CVAE, etc.)
 * @property {number|null} montant - Montant si applicable
 * @property {string} dateEcheance - Date de l'échéance YYYY-MM-DD
 */

// ============================================
// TYPES POUR L'IMPORT PENNYLANE
// ============================================

/**
 * @typedef {Object} ImportedTempsRow
 * @property {string} collaborateurPennylane - Nom du collaborateur dans Pennylane
 * @property {string} clientPennylane - Nom du client dans Pennylane
 * @property {string} millesime - Millésime
 * @property {string} commentaire - Commentaire
 * @property {string} code - Code
 * @property {string} typeMission - Type de mission
 * @property {string} activite - Activité
 * @property {string} date - Date YYYY-MM-DD
 * @property {number} dureeMinutes - Durée en minutes
 * @property {number} dureeHeures - Durée en heures
 */

/**
 * @typedef {Object} ImportStats
 * @property {number} totalLignes - Nombre total de lignes
 * @property {number} collaborateurs - Nombre de collaborateurs uniques
 * @property {number} clients - Nombre de clients uniques
 * @property {number} totalHeures - Total des heures
 */

/**
 * @typedef {Object} MappingPennylane
 * @property {number} id - Identifiant unique
 * @property {'collaborateur'|'client'} type - Type de mapping
 * @property {string} nom_pennylane - Nom dans Pennylane
 * @property {number} entity_id - ID de l'entité locale
 */

/**
 * @typedef {Object} JournalImport
 * @property {number} id - Identifiant unique
 * @property {string} date_import - Date/heure de l'import
 * @property {number} lignes_importees - Nombre de lignes importées
 * @property {string|null} details - Détails de l'import
 */

// ============================================
// TYPES POUR LES PROPS DES COMPOSANTS
// ============================================

/**
 * @typedef {Object} CalendarPageProps
 * @property {Collaborateur[]} collaborateurs - Liste des collaborateurs
 * @property {CollaborateurChef[]} collaborateurChefs - Liaisons collaborateur-chefs
 * @property {Client[]} clients - Liste des clients
 * @property {Charge[]} charges - Liste des charges
 * @property {function(Charge[]): void} setCharges - Setter pour les charges
 * @property {function(number): Collaborateur[]} getChefsOf - Obtenir les chefs d'un collaborateur
 * @property {function(number): Collaborateur[]} getEquipeOf - Obtenir l'équipe d'un chef
 * @property {function(Collaborateur|null): Client[]} getAccessibleClients - Obtenir les clients accessibles
 * @property {AccentColor} accent - Couleur d'accent
 * @property {Collaborateur|null} userCollaborateur - Collaborateur connecté
 * @property {ImpotsTaxes[]} impotsTaxes - Configuration des impôts/taxes
 * @property {SuiviEcheance[]} suiviEcheances - Suivi des échéances
 * @property {function(SuiviEcheance[]): void} setSuiviEcheances - Setter pour le suivi
 */

/**
 * @typedef {Object} CollaborateursPageProps
 * @property {Collaborateur[]} collaborateurs - Liste des collaborateurs
 * @property {function(Collaborateur[]): void} setCollaborateurs - Setter
 * @property {CollaborateurChef[]} collaborateurChefs - Liaisons
 * @property {function(CollaborateurChef[]): void} setCollaborateurChefs - Setter
 * @property {Charge[]} charges - Liste des charges
 * @property {function(number): Collaborateur[]} getChefsOf - Obtenir les chefs
 * @property {function(number): Collaborateur[]} getEquipeOf - Obtenir l'équipe
 * @property {AccentColor} accent - Couleur d'accent
 * @property {boolean} isAdmin - Si l'utilisateur est admin
 * @property {Collaborateur|null} userCollaborateur - Collaborateur connecté
 */

/**
 * @typedef {Object} ClientsPageProps
 * @property {Client[]} clients - Liste des clients
 * @property {function(Client[]): void} setClients - Setter
 * @property {Charge[]} charges - Liste des charges
 * @property {function(Charge[]): void} setCharges - Setter
 * @property {Collaborateur[]} collaborateurs - Liste des collaborateurs
 * @property {AccentColor} accent - Couleur d'accent
 * @property {Collaborateur|null} userCollaborateur - Collaborateur connecté
 */

/**
 * @typedef {Object} ImpotsTaxesPageProps
 * @property {Client[]} clients - Liste des clients
 * @property {Collaborateur[]} collaborateurs - Liste des collaborateurs
 * @property {ImpotsTaxes[]} impotsTaxes - Configuration des impôts/taxes
 * @property {function(ImpotsTaxes[]): void} setImpotsTaxes - Setter
 * @property {SuiviEcheance[]} suiviEcheances - Suivi des échéances
 * @property {AccentColor} accent - Couleur d'accent
 * @property {Collaborateur|null} userCollaborateur - Collaborateur connecté
 */

/**
 * @typedef {Object} TempsReelsPageProps
 * @property {Client[]} clients - Liste des clients
 * @property {Collaborateur[]} collaborateurs - Liste des collaborateurs
 * @property {Charge[]} charges - Liste des charges
 * @property {function(Charge[]): void} setCharges - Setter
 * @property {AccentColor} accent - Couleur d'accent
 */

/**
 * @typedef {Object} RepartitionTVAPageProps
 * @property {Client[]} clients - Liste des clients
 * @property {Collaborateur[]} collaborateurs - Liste des collaborateurs
 * @property {Charge[]} charges - Liste des charges
 * @property {function(Charge[]): void} setCharges - Setter
 * @property {function(number): Collaborateur[]} getEquipeOf - Obtenir l'équipe
 * @property {AccentColor} accent - Couleur d'accent
 * @property {Collaborateur|null} userCollaborateur - Collaborateur connecté
 * @property {ImpotsTaxes[]} impotsTaxes - Configuration des impôts/taxes
 */

/**
 * @typedef {Object} AuthPageProps
 * @property {'login'|'register'|'forgot'} authPage - Page d'auth actuelle
 * @property {function('login'|'register'|'forgot'): void} setAuthPage - Setter
 * @property {AccentColor} accent - Couleur d'accent
 */

// ============================================
// TYPES POUR LES MODALS
// ============================================

/**
 * @typedef {Object} ThemeModalProps
 * @property {function(): void} onClose - Fermer le modal
 * @property {BackgroundTheme} backgroundTheme - Thème actuel
 * @property {function(BackgroundTheme): void} setBackgroundTheme - Setter
 * @property {string} accentColor - ID de la couleur d'accent
 * @property {function(string): void} setAccentColor - Setter
 */

/**
 * @typedef {Object} CollaborateurModalProps
 * @property {function(): void} onClose - Fermer le modal
 * @property {function(string, boolean, number[]): Promise<void>} onSave - Sauvegarder
 * @property {Collaborateur|null} [collaborateur] - Collaborateur à éditer
 * @property {Collaborateur[]} chefsMission - Liste des chefs disponibles
 * @property {number[]} currentChefIds - IDs des chefs actuels
 * @property {AccentColor} accent - Couleur d'accent
 */

/**
 * @typedef {Object} ClientModalProps
 * @property {function(): void} onClose - Fermer le modal
 * @property {function(string, string): Promise<void>} onSave - Sauvegarder (nom, codePennylane)
 * @property {Client|null} [client] - Client à éditer
 * @property {AccentColor} accent - Couleur d'accent
 */

/**
 * @typedef {Object} AddChargeModalProps
 * @property {function(): void} onClose - Fermer le modal
 * @property {function(number, number, string, number, string, string): Promise<void>} onSave - Sauvegarder
 * @property {Collaborateur[]} collaborateurs - Collaborateurs disponibles
 * @property {Client[]} clients - Clients disponibles
 * @property {string} defaultDate - Date par défaut YYYY-MM-DD
 * @property {number|null} defaultCollaborateur - Collaborateur par défaut
 * @property {AccentColor} accent - Couleur d'accent
 */

/**
 * @typedef {Object} EditChargeModalProps
 * @property {function(): void} onClose - Fermer le modal
 * @property {function(number, number, number, string, number, string, string): Promise<void>} onSave - Sauvegarder
 * @property {function(number): Promise<void>} onDelete - Supprimer
 * @property {Charge} charge - Charge à éditer
 * @property {Collaborateur[]} collaborateurs - Collaborateurs disponibles
 * @property {Client[]} clients - Clients disponibles
 * @property {AccentColor} accent - Couleur d'accent
 */

/**
 * @typedef {Object} ExportModalProps
 * @property {function(): void} onClose - Fermer le modal
 * @property {function(string, string): void} onExport - Exporter (dateDebut, dateFin)
 * @property {AccentColor} accent - Couleur d'accent
 */

// ============================================
// TYPES POUR LES TESTS COMPTABLES
// ============================================

/**
 * @typedef {Object} TestComptableDefinition
 * @property {number} id - Identifiant unique
 * @property {string} code - Code unique du test (ex: 'doublons_fournisseurs')
 * @property {string} nom - Nom affiché du test
 * @property {string|null} description - Description détaillée
 * @property {string|null} categorie - Catégorie (FEC, rapprochement, etc.)
 * @property {boolean} actif - Si le test est actif
 * @property {number} ordre_affichage - Ordre d'affichage
 */

/**
 * @typedef {'en_cours'|'termine'|'erreur'} TestExecutionStatut
 */

/**
 * @typedef {Object} TestComptableExecution
 * @property {number} id - Identifiant unique
 * @property {number} client_id - ID du client testé
 * @property {string} test_code - Code du test exécuté
 * @property {number} collaborateur_id - ID du collaborateur qui a lancé le test
 * @property {number} millesime - Année fiscale testée
 * @property {string} date_execution - Date/heure d'exécution
 * @property {TestExecutionStatut} statut - Statut de l'exécution
 * @property {number|null} duree_ms - Durée d'exécution en ms
 * @property {number} nombre_anomalies - Nombre d'anomalies détectées
 */

/**
 * @typedef {'info'|'warning'|'error'|'critical'} SeveriteAnomalie
 */

/**
 * @typedef {Object} TestComptableResultat
 * @property {number} id - Identifiant unique
 * @property {number} execution_id - ID de l'exécution
 * @property {string} type_anomalie - Type d'anomalie détectée
 * @property {SeveriteAnomalie} severite - Niveau de sévérité
 * @property {Object} donnees - Données de l'anomalie (flexible)
 * @property {string|null} commentaire - Commentaire optionnel
 * @property {boolean} traite - Si l'anomalie a été traitée
 * @property {number|null} traite_par - ID du collaborateur qui a traité
 * @property {string|null} traite_le - Date de traitement
 */

/**
 * @typedef {Object} TestsComptablesPageProps
 * @property {Client[]} clients - Liste des clients
 * @property {Collaborateur[]} collaborateurs - Liste des collaborateurs
 * @property {Collaborateur|null} userCollaborateur - Collaborateur connecté
 * @property {function(Collaborateur|null): Client[]} getAccessibleClients - Obtenir les clients accessibles
 * @property {AccentColor} accent - Couleur d'accent
 */

/**
 * @typedef {Object} FECEntry
 * @property {string} JournalCode - Code du journal
 * @property {string} JournalLib - Libellé du journal
 * @property {string} EcritureNum - Numéro d'écriture
 * @property {string} EcritureDate - Date de l'écriture
 * @property {string} CompteNum - Numéro de compte
 * @property {string} CompteLib - Libellé du compte
 * @property {string} CompAuxNum - Numéro de compte auxiliaire
 * @property {string} CompAuxLib - Libellé compte auxiliaire
 * @property {string} PieceRef - Référence de la pièce
 * @property {string} PieceDate - Date de la pièce
 * @property {string} EcritureLib - Libellé de l'écriture
 * @property {number} Debit - Montant débit
 * @property {number} Credit - Montant crédit
 * @property {string} [Produits] - Catégorie produit (Boissons, Food, Autres)
 * @property {string} EcritureLet - Lettrage
 * @property {string} DateLet - Date de lettrage
 * @property {string} ValidDate - Date de validation
 * @property {number} Montantdevise - Montant en devise
 * @property {string} Idevise - Code devise
 */

/**
 * @typedef {Object} TestResultAnomalie
 * @property {string} type_anomalie - Type de l'anomalie
 * @property {SeveriteAnomalie} severite - Niveau de sévérité
 * @property {Object} donnees - Données spécifiques à l'anomalie
 * @property {string} [commentaire] - Commentaire explicatif
 */

/**
 * @typedef {Object} TestDefinition
 * @property {string} code - Code unique du test
 * @property {string} nom - Nom affiché
 * @property {string} description - Description du test
 * @property {string[]} requiredData - Données requises ('fec', 'invoices', etc.)
 * @property {function(Object): Promise<TestResultAnomalie[]>} execute - Fonction d'exécution
 */

// ============================================
// EXPORT (pour permettre l'import des types)
// ============================================

export {};
