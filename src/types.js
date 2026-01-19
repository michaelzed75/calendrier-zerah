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
 * @property {Cabinet|null} cabinet - Cabinet (zerah ou audit_up)
 * @property {number|null} chef_mission_id - ID du chef de mission assigné
 * @property {string|null} pennylane_id - ID Pennylane pour la synchronisation
 * @property {string|null} code_pennylane - Code Pennylane
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
// EXPORT (pour permettre l'import des types)
// ============================================

export {};
