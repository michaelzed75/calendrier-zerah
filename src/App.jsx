import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Filter, Download, Eye, Pencil, Users, Building2, Calendar, Menu, Check, Trash2, ChevronDown, ChevronUp, Palette, Image, RefreshCw, LogOut, Shield, AlertCircle, Receipt, FileText, Search, Clock, Upload, Link2, BarChart3, ArrowUpDown, VolumeX, Volume2, Mail } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from './supabaseClient';
import AuthPage from './components/pages/AuthPage';
import CalendarPage from './components/pages/CalendarPage';
import TempsReelsPage from './components/pages/TempsReelsPage';
import ImpotsTaxesPage from './components/pages/ImpotsTaxesPage';
import CollaborateursPage from './components/pages/CollaborateursPage';
import ClientsPage from './components/pages/ClientsPage';
import RepartitionTVAPage from './components/pages/RepartitionTVAPage';
import { ThemeModal, CollaborateurModal, ClientModal, MergeClientModal, AddChargeModal, EditChargeModal, ExportModal } from './components/modals';
import { formatDateToYMD, parseDateString } from './utils/dateUtils';
import { GRADIENT_THEMES, ACCENT_COLORS, UNSPLASH_CATEGORIES, UNSPLASH_ACCESS_KEY } from './constants/theme';

// ============================================
// COMPOSANT PRINCIPAL - APP
// ============================================
export default function App() {
  // État d'authentification
  const [user, setUser] = useState(null);
  const [userCollaborateur, setUserCollaborateur] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authPage, setAuthPage] = useState('login'); // 'login', 'register', 'forgot'

  const [currentPage, setCurrentPage] = useState('calendar');
  const [collaborateurs, setCollaborateurs] = useState([]);
  const [collaborateurChefs, setCollaborateurChefs] = useState([]);
  const [clients, setClients] = useState([]);
  const [charges, setCharges] = useState([]);
  const [impotsTaxes, setImpotsTaxes] = useState([]);
  const [suiviEcheances, setSuiviEcheances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [backgroundTheme, setBackgroundTheme] = useState(() => {
    const saved = localStorage.getItem('backgroundTheme');
    return saved ? JSON.parse(saved) : { type: 'gradient', value: 'aurora' };
  });
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [imageCredits, setImageCredits] = useState(null);
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

  // Charger le collaborateur lié à l'utilisateur
  const loadUserCollaborateur = async (email) => {
    const { data, error } = await supabase
      .from('collaborateurs')
      .select('*')
      .eq('email', email)
      .single();

    if (!error && data) {
      setUserCollaborateur(data);
    }
  };

  // Déconnexion
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

  const loadAllData = async () => {
    setLoading(true);
    
    try {
      // Charger collaborateurs
      const { data: collabData, error: collabError } = await supabase
        .from('collaborateurs')
        .select('*')
        .order('id');
      if (!collabError && collabData) {
        setCollaborateurs(collabData);
      }

      // Charger liaisons collaborateur-chefs
      const { data: chefsData, error: chefsError } = await supabase
        .from('collaborateur_chefs')
        .select('*');
      if (!chefsError && chefsData) {
        setCollaborateurChefs(chefsData);
      }

      // Charger clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('id');
      if (!clientsError && clientsData) {
        setClients(clientsData);
      }

      // Charger charges
      const { data: chargesData, error: chargesError } = await supabase
        .from('charges')
        .select('*');
      if (!chargesError && chargesData) {
        setCharges(chargesData);
      }

      // Charger impots_taxes
      const { data: impotsTaxesData, error: impotsTaxesError } = await supabase
        .from('impots_taxes')
        .select('*');
      if (!impotsTaxesError && impotsTaxesData) {
        setImpotsTaxes(impotsTaxesData);
      }

      // Charger suivi_echeances
      const { data: suiviData, error: suiviError } = await supabase
        .from('suivi_echeances')
        .select('*');
      if (!suiviError && suiviData) {
        setSuiviEcheances(suiviData);
      }
    } catch (err) {
      console.error('Erreur chargement données:', err);
    }

    setLoading(false);
  };

  // Obtenir les chefs d'un collaborateur
  const getChefsOf = (collaborateurId) => {
    const chefIds = collaborateurChefs
      .filter(cc => cc.collaborateur_id === collaborateurId)
      .map(cc => cc.chef_id);
    return collaborateurs.filter(c => chefIds.includes(c.id));
  };

  // Obtenir l'équipe d'un chef
  const getEquipeOf = (chefId) => {
    const membreIds = collaborateurChefs
      .filter(cc => cc.chef_id === chefId)
      .map(cc => cc.collaborateur_id);
    return collaborateurs.filter(c => membreIds.includes(c.id));
  };

  // Obtenir les clients accessibles pour un collaborateur (pour ajouter des charges)
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

  // Calculer le style de fond
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

  const getBackgroundClass = () => {
    if (backgroundTheme.type === 'gradient') {
      const theme = GRADIENT_THEMES.find(t => t.id === backgroundTheme.value);
      return `bg-gradient-to-br ${theme?.gradient || 'from-slate-900 via-slate-800 to-slate-900'}`;
    }
    return '';
  };

  // Obtenir les classes pour la couleur d'accent
  const getAccentClasses = () => {
    const accent = ACCENT_COLORS.find(c => c.id === accentColor) || ACCENT_COLORS[0];
    return accent;
  };

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

