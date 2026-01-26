// @ts-check
import React, { useState, useEffect, useCallback } from 'react';
import { Users, Building2, Calendar, Menu, Palette, LogOut, Receipt, FileText, Clock, ClipboardCheck, Euro } from 'lucide-react';
import { supabase } from './supabaseClient';
import AuthPage from './components/pages/AuthPage';
import CalendarPage from './components/pages/CalendarPage';
import TempsReelsPage from './components/pages/TempsReelsPage';
import ImpotsTaxesPage from './components/pages/ImpotsTaxesPage';
import CollaborateursPage from './components/pages/CollaborateursPage';
import ClientsPage from './components/pages/ClientsPage';
import RepartitionTVAPage from './components/pages/RepartitionTVAPage';
import TestsComptablesPage from './components/pages/TestsComptablesPage';
import HonorairesPage from './components/pages/HonorairesPage';
import { ThemeModal } from './components/modals';
import { GRADIENT_THEMES, ACCENT_COLORS } from './constants/theme';

/**
 * @typedef {import('./types.js').Collaborateur} Collaborateur
 * @typedef {import('./types.js').CollaborateurChef} CollaborateurChef
 * @typedef {import('./types.js').Client} Client
 * @typedef {import('./types.js').Charge} Charge
 * @typedef {import('./types.js').ImpotsTaxes} ImpotsTaxes
 * @typedef {import('./types.js').SuiviEcheance} SuiviEcheance
 * @typedef {import('./types.js').AccentColor} AccentColor
 * @typedef {import('./types.js').BackgroundTheme} BackgroundTheme
 * @typedef {import('./types.js').ImageCredits} ImageCredits
 */

/** @typedef {'calendar'|'collaborateurs'|'clients'|'impots'|'tva'|'temps-reels'|'tests-comptables'|'honoraires'} PageName */

// ============================================
// COMPOSANT PRINCIPAL - APP
// ============================================

/**
 * Composant racine de l'application
 * Gère l'authentification, le chargement des données et la navigation
 * @returns {JSX.Element}
 */
export default function App() {
  // État d'authentification
  /** @type {[import('@supabase/supabase-js').User|null, function]} */
  const [user, setUser] = useState(null);
  /** @type {[Collaborateur|null, function]} */
  const [userCollaborateur, setUserCollaborateur] = useState(null);
  /** @type {[boolean, function]} */
  const [authLoading, setAuthLoading] = useState(true);
  /** @type {['login'|'register'|'forgot', function]} */
  const [authPage, setAuthPage] = useState('login');

  /** @type {[PageName, function]} */
  const [currentPage, setCurrentPage] = useState(/** @type {PageName} */ ('calendar'));
  /** @type {[Collaborateur[], function]} */
  const [collaborateurs, setCollaborateurs] = useState([]);
  /** @type {[CollaborateurChef[], function]} */
  const [collaborateurChefs, setCollaborateurChefs] = useState([]);
  /** @type {[Client[], function]} */
  const [clients, setClients] = useState([]);
  /** @type {[Charge[], function]} */
  const [charges, setCharges] = useState([]);
  /** @type {[ImpotsTaxes[], function]} */
  const [impotsTaxes, setImpotsTaxes] = useState([]);
  /** @type {[SuiviEcheance[], function]} */
  const [suiviEcheances, setSuiviEcheances] = useState([]);
  /** @type {[boolean, function]} */
  const [loading, setLoading] = useState(true);
  /** @type {[boolean, function]} */
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  /** @type {[boolean, function]} */
  const [showThemeModal, setShowThemeModal] = useState(false);
  /** @type {[BackgroundTheme, function]} */
  const [backgroundTheme, setBackgroundTheme] = useState(() => {
    const saved = localStorage.getItem('backgroundTheme');
    return saved ? JSON.parse(saved) : { type: 'gradient', value: 'aurora' };
  });
  /** @type {[string|null, function]} */
  const [backgroundImage, setBackgroundImage] = useState(null);
  /** @type {[ImageCredits|null, function]} */
  const [imageCredits, setImageCredits] = useState(null);
  /** @type {[string, function]} */
  const [accentColor, setAccentColor] = useState(() => {
    const saved = localStorage.getItem('accentColor');
    return saved || 'pink';
  });

  // Sauvegarder la couleur d'accent
  useEffect(() => {
    localStorage.setItem('accentColor', accentColor);
  }, [accentColor]);

  // Charger l'image de fond si nécessaire
  useEffect(() => {
    if (backgroundTheme.type === 'image' && backgroundTheme.imageUrl) {
      setBackgroundImage(backgroundTheme.imageUrl);
      setImageCredits(backgroundTheme.credits);
    } else {
      setBackgroundImage(null);
      setImageCredits(null);
    }
  }, [backgroundTheme]);

  // Sauvegarder le thème
  useEffect(() => {
    localStorage.setItem('backgroundTheme', JSON.stringify(backgroundTheme));
  }, [backgroundTheme]);

  // Vérifier l'authentification au démarrage
  useEffect(() => {
    // Récupérer la session actuelle
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserCollaborateur(session.user.email);
      }
      setAuthLoading(false);
    });

    // Écouter les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserCollaborateur(session.user.email);
      } else {
        setUserCollaborateur(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Charge le collaborateur lié à l'utilisateur connecté
   * @param {string} email - Email de l'utilisateur
   * @returns {Promise<void>}
   */
  const loadUserCollaborateur = async (email) => {
    const { data, error } = await supabase
      .from('collaborateurs')
      .select('*')
      .eq('email', email)
      .single();

    if (!error && data) {
      setUserCollaborateur(/** @type {Collaborateur} */ (data));
    }
  };

  /**
   * Déconnecte l'utilisateur
   * @returns {Promise<void>}
   */
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserCollaborateur(null);
  };

  // Chargement initial des données depuis Supabase
  useEffect(() => {
    if (user) {
      loadAllData();
    }
  }, [user]);

  /**
   * Charge toutes les données depuis Supabase
   * @returns {Promise<void>}
   */
  const loadAllData = async () => {
    setLoading(true);

    try {
      // Charger collaborateurs
      const { data: collabData, error: collabError } = await supabase
        .from('collaborateurs')
        .select('*')
        .order('id');
      if (!collabError && collabData) {
        setCollaborateurs(/** @type {Collaborateur[]} */ (collabData));
      }

      // Charger liaisons collaborateur-chefs
      const { data: chefsData, error: chefsError } = await supabase
        .from('collaborateur_chefs')
        .select('*');
      if (!chefsError && chefsData) {
        setCollaborateurChefs(/** @type {CollaborateurChef[]} */ (chefsData));
      }

      // Charger clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('id');
      if (!clientsError && clientsData) {
        setClients(/** @type {Client[]} */ (clientsData));
      }

      // Charger charges
      const { data: chargesData, error: chargesError } = await supabase
        .from('charges')
        .select('*');
      if (!chargesError && chargesData) {
        setCharges(/** @type {Charge[]} */ (chargesData));
      }

      // Charger impots_taxes
      const { data: impotsTaxesData, error: impotsTaxesError } = await supabase
        .from('impots_taxes')
        .select('*');
      if (!impotsTaxesError && impotsTaxesData) {
        setImpotsTaxes(/** @type {ImpotsTaxes[]} */ (impotsTaxesData));
      }

      // Charger suivi_echeances
      const { data: suiviData, error: suiviError } = await supabase
        .from('suivi_echeances')
        .select('*');
      if (!suiviError && suiviData) {
        setSuiviEcheances(/** @type {SuiviEcheance[]} */ (suiviData));
      }
    } catch (err) {
      console.error('Erreur chargement données:', err);
    }

    setLoading(false);
  };

  /**
   * Obtient les chefs de mission d'un collaborateur
   * @param {number} collaborateurId - ID du collaborateur
   * @returns {Collaborateur[]} Liste des chefs de mission
   */
  const getChefsOf = (collaborateurId) => {
    const chefIds = collaborateurChefs
      .filter(cc => cc.collaborateur_id === collaborateurId)
      .map(cc => cc.chef_id);
    return collaborateurs.filter(c => chefIds.includes(c.id));
  };

  /**
   * Obtient l'équipe d'un chef de mission
   * @param {number} chefId - ID du chef de mission
   * @returns {Collaborateur[]} Liste des membres de l'équipe
   */
  const getEquipeOf = (chefId) => {
    const membreIds = collaborateurChefs
      .filter(cc => cc.chef_id === chefId)
      .map(cc => cc.collaborateur_id);
    return collaborateurs.filter(c => membreIds.includes(c.id));
  };

  /**
   * Obtient les clients accessibles pour un collaborateur
   * @param {Collaborateur|null} collaborateur - Le collaborateur
   * @returns {Client[]} Liste des clients accessibles
   */
  const getAccessibleClients = (collaborateur) => {
    if (!collaborateur) return clients.filter(c => c.actif);

    // Admin voit tous les clients actifs
    if (collaborateur.is_admin) {
      return clients.filter(c => c.actif);
    }

    // Chef de mission voit ses clients + clients sans chef assigné
    if (collaborateur.est_chef_mission) {
      return clients.filter(c =>
        c.actif && (!c.chef_mission_id || c.chef_mission_id === collaborateur.id)
      );
    }

    // Collaborateur voit les clients de ses chefs + clients sans chef assigné
    const chefIds = getChefsOf(collaborateur.id).map(c => c.id);
    return clients.filter(c =>
      c.actif && (!c.chef_mission_id || chefIds.includes(c.chef_mission_id))
    );
  };

  /**
   * Calcule le style CSS pour le fond
   * @returns {React.CSSProperties} Style CSS pour le fond
   */
  const getBackgroundStyle = () => {
    if (backgroundTheme.type === 'image' && backgroundImage) {
      return {
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      };
    }
    return {};
  };

  /**
   * Obtient les classes Tailwind pour le fond
   * @returns {string} Classes Tailwind
   */
  const getBackgroundClass = () => {
    if (backgroundTheme.type === 'gradient') {
      const theme = GRADIENT_THEMES.find(t => t.id === backgroundTheme.value);
      return `bg-gradient-to-br ${theme?.gradient || 'from-slate-900 via-slate-800 to-slate-900'}`;
    }
    return '';
  };

  /**
   * Obtient la configuration de la couleur d'accent
   * @returns {AccentColor} Configuration de la couleur d'accent
   */
  const getAccentClasses = () => {
    const accent = ACCENT_COLORS.find(c => c.id === accentColor) || ACCENT_COLORS[0];
    return /** @type {AccentColor} */ (accent);
  };

  /** @type {AccentColor} */
  const accent = getAccentClasses();

  // Écran de chargement auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-900 via-purple-800 to-pink-900 flex items-center justify-center">
        <div className="text-white text-xl">Chargement...</div>
      </div>
    );
  }

  // Si non connecté, afficher la page de connexion
  if (!user) {
    return (
      <AuthPage
        authPage={authPage}
        setAuthPage={setAuthPage}
        accent={accent}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-900 via-purple-800 to-pink-900 flex items-center justify-center">
        <div className="text-white text-xl">Chargement...</div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${getBackgroundClass()}`}
      style={getBackgroundStyle()}
    >
      {/* Overlay pour améliorer la lisibilité sur les images */}
      {backgroundTheme.type === 'image' && (
        <div className="fixed inset-0 bg-black/40 pointer-events-none" />
      )}

      {/* Navigation */}
      <nav className="bg-slate-800/90 backdrop-blur-sm border-b border-slate-700 px-6 py-4 relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Audit Up</h1>
          
          {/* Menu desktop */}
          <div className="hidden md:flex gap-2">
            <button
              onClick={() => setCurrentPage('calendar')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                currentPage === 'calendar' ? `${accent.color} text-white` : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Calendar size={18} />
              Calendrier
            </button>
            <button
              onClick={() => setCurrentPage('collaborateurs')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                currentPage === 'collaborateurs' ? `${accent.color} text-white` : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Users size={18} />
              Collaborateurs
            </button>
            <button
              onClick={() => setCurrentPage('clients')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                currentPage === 'clients' ? `${accent.color} text-white` : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Building2 size={18} />
              Clients
            </button>
            {(userCollaborateur?.est_chef_mission || userCollaborateur?.is_admin) && (
              <button
                onClick={() => setCurrentPage('impots')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                  currentPage === 'impots' ? `${accent.color} text-white` : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <FileText size={18} />
                Impôts et Taxes
              </button>
            )}
            {userCollaborateur?.est_chef_mission && (
              <button
                onClick={() => setCurrentPage('tva')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                  currentPage === 'tva' ? `${accent.color} text-white` : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <Receipt size={18} />
                Planification TVA
              </button>
            )}
            {userCollaborateur?.est_chef_mission && (
              <button
                onClick={() => setCurrentPage('temps-reels')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                  currentPage === 'temps-reels' ? `${accent.color} text-white` : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <Clock size={18} />
                Temps Réels
              </button>
            )}
            <button
              onClick={() => setCurrentPage('tests-comptables')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                currentPage === 'tests-comptables' ? `${accent.color} text-white` : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <ClipboardCheck size={18} />
              Tests
            </button>
            {userCollaborateur?.is_admin && (
              <button
                onClick={() => setCurrentPage('honoraires')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                  currentPage === 'honoraires' ? `${accent.color} text-white` : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <Euro size={18} />
                Honoraires
              </button>
            )}
            <button
              onClick={() => setShowThemeModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition"
              title="Personnaliser le fond"
            >
              <Palette size={18} />
            </button>
            {/* Bouton Déconnexion */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition"
              title="Déconnexion"
            >
              <LogOut size={18} />
            </button>
          </div>

          {/* Menu mobile */}
          <button 
            className="md:hidden text-white p-2"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
          >
            <Menu size={24} />
          </button>
        </div>

        {/* Menu mobile déroulant */}
        {showMobileMenu && (
          <div className="md:hidden mt-4 space-y-2">
            <button
              onClick={() => { setCurrentPage('calendar'); setShowMobileMenu(false); }}
              className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg transition ${
                currentPage === 'calendar' ? `${accent.color} text-white` : 'bg-slate-700 text-slate-300'
              }`}
            >
              <Calendar size={18} />
              Calendrier
            </button>
            <button
              onClick={() => { setCurrentPage('collaborateurs'); setShowMobileMenu(false); }}
              className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg transition ${
                currentPage === 'collaborateurs' ? `${accent.color} text-white` : 'bg-slate-700 text-slate-300'
              }`}
            >
              <Users size={18} />
              Collaborateurs
            </button>
            <button
              onClick={() => { setCurrentPage('clients'); setShowMobileMenu(false); }}
              className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg transition ${
                currentPage === 'clients' ? `${accent.color} text-white` : 'bg-slate-700 text-slate-300'
              }`}
            >
              <Building2 size={18} />
              Clients
            </button>
            {(userCollaborateur?.est_chef_mission || userCollaborateur?.is_admin) && (
              <button
                onClick={() => { setCurrentPage('impots'); setShowMobileMenu(false); }}
                className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg transition ${
                  currentPage === 'impots' ? `${accent.color} text-white` : 'bg-slate-700 text-slate-300'
                }`}
              >
                <FileText size={18} />
                Impôts et Taxes
              </button>
            )}
            {userCollaborateur?.est_chef_mission && (
              <button
                onClick={() => { setCurrentPage('tva'); setShowMobileMenu(false); }}
                className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg transition ${
                  currentPage === 'tva' ? `${accent.color} text-white` : 'bg-slate-700 text-slate-300'
                }`}
              >
                <Receipt size={18} />
                Planification TVA
              </button>
            )}
            {userCollaborateur?.est_chef_mission && (
              <button
                onClick={() => { setCurrentPage('temps-reels'); setShowMobileMenu(false); }}
                className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg transition ${
                  currentPage === 'temps-reels' ? `${accent.color} text-white` : 'bg-slate-700 text-slate-300'
                }`}
              >
                <Clock size={18} />
                Temps Réels
              </button>
            )}
            <button
              onClick={() => { setCurrentPage('tests-comptables'); setShowMobileMenu(false); }}
              className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg transition ${
                currentPage === 'tests-comptables' ? `${accent.color} text-white` : 'bg-slate-700 text-slate-300'
              }`}
            >
              <ClipboardCheck size={18} />
              Tests Comptables
            </button>
            {userCollaborateur?.is_admin && (
              <button
                onClick={() => { setCurrentPage('honoraires'); setShowMobileMenu(false); }}
                className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg transition ${
                  currentPage === 'honoraires' ? `${accent.color} text-white` : 'bg-slate-700 text-slate-300'
                }`}
              >
                <Euro size={18} />
                Honoraires
              </button>
            )}
            <button
              onClick={() => { setShowThemeModal(true); setShowMobileMenu(false); }}
              className="flex items-center gap-2 w-full px-4 py-2 rounded-lg bg-slate-700 text-slate-300 transition"
            >
              <Palette size={18} />
              Personnaliser
            </button>
            {/* Bouton Déconnexion mobile */}
            <button
              onClick={() => { handleLogout(); setShowMobileMenu(false); }}
              className="flex items-center gap-2 w-full px-4 py-2 rounded-lg bg-red-600/20 text-red-400 transition"
            >
              <LogOut size={18} />
              Déconnexion
            </button>
          </div>
        )}
      </nav>

      {/* Contenu des pages */}
      {currentPage === 'calendar' && (
        <CalendarPage
          collaborateurs={collaborateurs}
          collaborateurChefs={collaborateurChefs}
          clients={clients}
          charges={charges}
          setCharges={setCharges}
          getChefsOf={getChefsOf}
          getEquipeOf={getEquipeOf}
          getAccessibleClients={getAccessibleClients}
          accent={accent}
          userCollaborateur={userCollaborateur}
          impotsTaxes={impotsTaxes}
          suiviEcheances={suiviEcheances}
          setSuiviEcheances={setSuiviEcheances}
        />
      )}
      {currentPage === 'collaborateurs' && (
        <CollaborateursPage
          collaborateurs={collaborateurs}
          setCollaborateurs={setCollaborateurs}
          collaborateurChefs={collaborateurChefs}
          setCollaborateurChefs={setCollaborateurChefs}
          charges={charges}
          getChefsOf={getChefsOf}
          getEquipeOf={getEquipeOf}
          accent={accent}
          isAdmin={userCollaborateur?.is_admin}
          userCollaborateur={userCollaborateur}
        />
      )}
      {currentPage === 'clients' && (
        <ClientsPage
          clients={clients}
          setClients={setClients}
          charges={charges}
          setCharges={setCharges}
          collaborateurs={collaborateurs}
          accent={accent}
          userCollaborateur={userCollaborateur}
        />
      )}
      {currentPage === 'tva' && userCollaborateur?.est_chef_mission && (
        <RepartitionTVAPage
          clients={clients}
          collaborateurs={collaborateurs}
          charges={charges}
          setCharges={setCharges}
          getEquipeOf={getEquipeOf}
          accent={accent}
          userCollaborateur={userCollaborateur}
          impotsTaxes={impotsTaxes}
        />
      )}
      {currentPage === 'impots' && (userCollaborateur?.est_chef_mission || userCollaborateur?.is_admin) && (
        <ImpotsTaxesPage
          clients={clients}
          collaborateurs={collaborateurs}
          impotsTaxes={impotsTaxes}
          setImpotsTaxes={setImpotsTaxes}
          suiviEcheances={suiviEcheances}
          accent={accent}
          userCollaborateur={userCollaborateur}
        />
      )}
      {currentPage === 'temps-reels' && userCollaborateur?.est_chef_mission && (
        <TempsReelsPage
          clients={clients}
          collaborateurs={collaborateurs}
          charges={charges}
          setCharges={setCharges}
          accent={accent}
        />
      )}
      {currentPage === 'tests-comptables' && (
        <TestsComptablesPage
          clients={clients}
          collaborateurs={collaborateurs}
          userCollaborateur={userCollaborateur}
          getAccessibleClients={getAccessibleClients}
          accent={accent}
        />
      )}
      {currentPage === 'honoraires' && userCollaborateur?.is_admin && (
        <HonorairesPage
          clients={clients}
          setClients={setClients}
          collaborateurs={collaborateurs}
          accent={accent}
          userCollaborateur={userCollaborateur}
        />
      )}
      {/* Crédits photo Unsplash */}
      {imageCredits && (
        <div className="fixed bottom-2 right-2 z-20 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-lg text-xs text-white/70">
          Photo par{' '}
          <a
            href={imageCredits.userLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:underline"
          >
            {imageCredits.userName}
          </a>
          {' '}sur{' '}
          <a
            href="https://unsplash.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:underline"
          >
            Unsplash
          </a>
        </div>
      )}

      {/* Modal de sélection de thème */}
      {showThemeModal && (
        <ThemeModal
          onClose={() => setShowThemeModal(false)}
          backgroundTheme={backgroundTheme}
          setBackgroundTheme={setBackgroundTheme}
          accentColor={accentColor}
          setAccentColor={setAccentColor}
        />
      )}
    </div>
  );
}

