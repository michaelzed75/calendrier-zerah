import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Filter, Download, Eye, Pencil, Users, Building2, Calendar, Menu, Check, Trash2, ChevronDown, ChevronUp, Palette, Image, RefreshCw, LogIn, LogOut, UserPlus, Shield, Mail, Lock, AlertCircle, Receipt, FileText, Search, Clock, Upload, Link2, BarChart3, ArrowUpDown, VolumeX, Volume2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const SUPABASE_URL = 'https://anrvvsfvejnmdouxjfxj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_BxHx7EG9PQ-TDT3BmHFfWg_BZz77c8k';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// UTILITAIRES
// ============================================
const formatDateToYMD = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateString = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// ============================================
// CONFIGURATION UNSPLASH
// ============================================
const UNSPLASH_ACCESS_KEY = 'X6rfvR5uCg1PCojlkBuk0xMhTBC2gQDVilj8HOoq95M';

// Thèmes dégradés prédéfinis
const GRADIENT_THEMES = [
  { id: 'default', name: 'Défaut', gradient: 'from-slate-900 via-slate-800 to-slate-900' },
  { id: 'ocean', name: 'Océan', gradient: 'from-blue-900 via-cyan-800 to-blue-900' },
  { id: 'forest', name: 'Forêt', gradient: 'from-green-900 via-emerald-800 to-green-900' },
  { id: 'sunset', name: 'Coucher de soleil', gradient: 'from-orange-900 via-red-800 to-pink-900' },
  { id: 'purple', name: 'Violet', gradient: 'from-purple-900 via-violet-800 to-indigo-900' },
  { id: 'midnight', name: 'Minuit', gradient: 'from-gray-900 via-zinc-900 to-black' },
  { id: 'aurora', name: 'Aurore', gradient: 'from-teal-900 via-purple-800 to-pink-900' },
  { id: 'golden', name: 'Doré', gradient: 'from-amber-900 via-yellow-800 to-orange-900' },
];

// Couleurs d'accent
const ACCENT_COLORS = [
  { id: 'purple', name: 'Violet', color: 'bg-purple-600', hover: 'hover:bg-purple-700', text: 'text-purple-400', ring: 'ring-purple-500' },
  { id: 'blue', name: 'Bleu', color: 'bg-blue-600', hover: 'hover:bg-blue-700', text: 'text-blue-400', ring: 'ring-blue-500' },
  { id: 'cyan', name: 'Cyan', color: 'bg-cyan-600', hover: 'hover:bg-cyan-700', text: 'text-cyan-400', ring: 'ring-cyan-500' },
  { id: 'emerald', name: 'Vert', color: 'bg-emerald-600', hover: 'hover:bg-emerald-700', text: 'text-emerald-400', ring: 'ring-emerald-500' },
  { id: 'orange', name: 'Orange', color: 'bg-orange-600', hover: 'hover:bg-orange-700', text: 'text-orange-400', ring: 'ring-orange-500' },
  { id: 'pink', name: 'Rose', color: 'bg-pink-600', hover: 'hover:bg-pink-700', text: 'text-pink-400', ring: 'ring-pink-500' },
  { id: 'red', name: 'Rouge', color: 'bg-red-600', hover: 'hover:bg-red-700', text: 'text-red-400', ring: 'ring-red-500' },
  { id: 'amber', name: 'Ambre', color: 'bg-amber-600', hover: 'hover:bg-amber-700', text: 'text-amber-400', ring: 'ring-amber-500' },
];

// Catégories Unsplash
const UNSPLASH_CATEGORIES = [
  { id: 'nature', name: 'Nature', query: 'nature landscape' },
  { id: 'minimal', name: 'Minimaliste', query: 'minimal abstract' },
  { id: 'architecture', name: 'Architecture', query: 'architecture building' },
  { id: 'office', name: 'Bureau', query: 'office workspace desk' },
  { id: 'mountains', name: 'Montagnes', query: 'mountains peaks' },
  { id: 'ocean', name: 'Océan', query: 'ocean sea waves' },
  { id: 'city', name: 'Ville', query: 'city night lights' },
  { id: 'abstract', name: 'Abstrait', query: 'abstract gradient colors' },
];

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

// ============================================
// MODAL DE SELECTION DE THEME
// ============================================
function ThemeModal({ onClose, backgroundTheme, setBackgroundTheme, accentColor, setAccentColor }) {
  const [activeTab, setActiveTab] = useState('gradients');
  const [unsplashPhotos, setUnsplashPhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const currentAccent = ACCENT_COLORS.find(c => c.id === accentColor) || ACCENT_COLORS[0];

  // Charger les photos Unsplash
  const loadUnsplashPhotos = async (category) => {
    setLoadingPhotos(true);
    setSelectedCategory(category.id);
    try {
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(category.query)}&per_page=12&orientation=landscape`,
        {
          headers: {
            Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
          },
        }
      );
      const data = await response.json();
      setUnsplashPhotos(data.results || []);
    } catch (error) {
      console.error('Erreur chargement Unsplash:', error);
      setUnsplashPhotos([]);
    }
    setLoadingPhotos(false);
  };

  // Rafraîchir les photos
  const refreshPhotos = () => {
    const category = UNSPLASH_CATEGORIES.find(c => c.id === selectedCategory);
    if (category) {
      loadUnsplashPhotos(category);
    }
  };

  // Sélectionner un thème gradient
  const selectGradient = (themeId) => {
    setBackgroundTheme({ type: 'gradient', value: themeId });
  };

  // Sélectionner une photo Unsplash
  const selectPhoto = (photo) => {
    setBackgroundTheme({
      type: 'image',
      imageUrl: photo.urls.regular,
      credits: {
        userName: photo.user.name,
        userLink: photo.user.links.html,
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Palette size={24} />
            Personnaliser le fond
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-700 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('gradients')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition flex items-center justify-center gap-2 ${
              activeTab === 'gradients'
                ? 'text-purple-400 border-b-2 border-purple-400 bg-slate-700/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Palette size={18} />
            Dégradés
          </button>
          <button
            onClick={() => setActiveTab('photos')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition flex items-center justify-center gap-2 ${
              activeTab === 'photos'
                ? 'text-purple-400 border-b-2 border-purple-400 bg-slate-700/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Image size={18} />
            Photos Unsplash
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {activeTab === 'gradients' && (
            <div>
              {/* Section Couleur d'accent */}
              <div className="mb-8">
                <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                  <Palette size={18} />
                  Couleur d'accent
                </h3>
                <div className="flex flex-wrap gap-3">
                  {ACCENT_COLORS.map((color) => (
                    <button
                      key={color.id}
                      onClick={() => setAccentColor(color.id)}
                      className={`relative w-12 h-12 rounded-xl ${color.color} transition-all duration-200 ${
                        accentColor === color.id
                          ? 'ring-4 ring-white scale-110'
                          : 'hover:scale-110'
                      }`}
                      title={color.name}
                    >
                      {accentColor === color.id && (
                        <Check size={20} className="absolute inset-0 m-auto text-white" />
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-slate-400 text-sm mt-2">
                  Couleur actuelle : <span className={currentAccent.text}>{currentAccent.name}</span>
                </p>
              </div>

              {/* Section Dégradés de fond */}
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                <Image size={18} />
                Fond dégradé
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {GRADIENT_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => selectGradient(theme.id)}
                    className={`relative h-24 rounded-xl overflow-hidden transition-all duration-200 ${
                      backgroundTheme.type === 'gradient' && backgroundTheme.value === theme.id
                        ? `ring-4 ${currentAccent.ring} scale-105`
                        : 'hover:scale-105'
                    }`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient}`} />
                    <div className="absolute inset-0 flex items-end justify-center p-2">
                      <span className="text-white text-sm font-medium drop-shadow-lg">{theme.name}</span>
                    </div>
                    {backgroundTheme.type === 'gradient' && backgroundTheme.value === theme.id && (
                      <div className={`absolute top-2 right-2 ${currentAccent.color} rounded-full p-1`}>
                        <Check size={14} className="text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'photos' && (
            <div>
              {/* Catégories */}
              <div className="flex flex-wrap gap-2 mb-6">
                {UNSPLASH_CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => loadUnsplashPhotos(category)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      selectedCategory === category.id
                        ? `${currentAccent.color} text-white`
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
                {selectedCategory && (
                  <button
                    onClick={refreshPhotos}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition flex items-center gap-2"
                    disabled={loadingPhotos}
                  >
                    <RefreshCw size={16} className={loadingPhotos ? 'animate-spin' : ''} />
                    Autres photos
                  </button>
                )}
              </div>

              {/* Photos */}
              {!selectedCategory && (
                <div className="text-center text-slate-400 py-12">
                  <Image size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Sélectionnez une catégorie pour voir les photos</p>
                </div>
              )}

              {loadingPhotos && (
                <div className="text-center text-slate-400 py-12">
                  <RefreshCw size={32} className="mx-auto mb-4 animate-spin" />
                  <p>Chargement des photos...</p>
                </div>
              )}

              {selectedCategory && !loadingPhotos && unsplashPhotos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {unsplashPhotos.map((photo) => (
                    <button
                      key={photo.id}
                      onClick={() => selectPhoto(photo)}
                      className={`relative aspect-video rounded-xl overflow-hidden transition-all duration-200 ${
                        backgroundTheme.type === 'image' && backgroundTheme.imageUrl === photo.urls.regular
                          ? 'ring-4 ring-purple-500 scale-105'
                          : 'hover:scale-105'
                      }`}
                    >
                      <img
                        src={photo.urls.small}
                        alt={photo.alt_description || 'Photo Unsplash'}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <div className="absolute bottom-2 left-2 right-2 text-xs text-white/80 truncate">
                        {photo.user.name}
                      </div>
                      {backgroundTheme.type === 'image' && backgroundTheme.imageUrl === photo.urls.regular && (
                        <div className="absolute top-2 right-2 bg-purple-500 rounded-full p-1">
                          <Check size={14} className="text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {selectedCategory && !loadingPhotos && unsplashPhotos.length === 0 && (
                <div className="text-center text-slate-400 py-12">
                  <p>Aucune photo trouvée</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-800/50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className={`px-6 py-2 ${currentAccent.color} text-white rounded-lg ${currentAccent.hover} transition font-medium`}
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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

  // Temps réels depuis localStorage
  const [tempsReelsLocal] = useState(() => {
    const saved = localStorage.getItem('tempsReels');
    return saved ? JSON.parse(saved) : [];
  });

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
                                {!hasTempsReelsForYesterday(chef.id) && (
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
                                  {!hasTempsReelsForYesterday(membre.id) && (
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
                              {!hasTempsReelsForYesterday(collab.id) && (
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

// ============================================
// MODALS
// ============================================
function CollaborateurModal({ collaborateur, chefsMission, collaborateurChefs, onSave, onClose }) {
  const [nom, setNom] = useState(collaborateur?.nom || '');
  const [estChefMission, setEstChefMission] = useState(collaborateur?.est_chef_mission || false);
  const [selectedChefIds, setSelectedChefIds] = useState(() => {
    if (collaborateur && collaborateurChefs) {
      return collaborateurChefs
        .filter(cc => cc.collaborateur_id === collaborateur.id)
        .map(cc => cc.chef_id);
    }
    return [];
  });

  const toggleChef = (chefId) => {
    setSelectedChefIds(prev => 
      prev.includes(chefId) 
        ? prev.filter(id => id !== chefId)
        : [...prev, chefId]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nom.trim()) {
      alert('Le nom est obligatoire');
      return;
    }
    onSave(nom.trim(), estChefMission, selectedChefIds);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">
            {collaborateur ? 'Modifier le collaborateur' : 'Ajouter un collaborateur'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nom *</label>
            <input 
              type="text" 
              value={nom} 
              onChange={(e) => setNom(e.target.value)} 
              placeholder="Prénom Nom"
              className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" 
            />
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input 
                type="checkbox" 
                checked={estChefMission} 
                onChange={(e) => setEstChefMission(e.target.checked)} 
                className="rounded" 
              />
              <span>Chef de mission</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Ses chefs de mission</label>
            {chefsMission.length === 0 ? (
              <p className="text-slate-500 text-sm">Aucun chef de mission disponible. Créez d'abord un chef de mission.</p>
            ) : (
              <div className="space-y-2 bg-slate-700 rounded p-3 max-h-40 overflow-y-auto">
                {chefsMission.map(chef => (
                  <label key={chef.id} className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                    <input 
                      type="checkbox" 
                      checked={selectedChefIds.includes(chef.id)} 
                      onChange={() => toggleChef(chef.id)} 
                      className="rounded" 
                    />
                    <span>{chef.nom}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-slate-500 text-xs mt-1">Vous pouvez sélectionner plusieurs chefs</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded transition">
              Annuler
            </button>
            <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded transition">
              {collaborateur ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ClientModal({ client, onSave, onClose }) {
  const [nom, setNom] = useState(client?.nom || '');
  const [codePennylane, setCodePennylane] = useState(client?.code_pennylane || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nom.trim()) {
      alert('Le nom est obligatoire');
      return;
    }
    onSave(nom.trim(), codePennylane.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">
            {client ? 'Modifier le client' : 'Ajouter un client'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nom *</label>
            <input 
              type="text" 
              value={nom} 
              onChange={(e) => setNom(e.target.value)} 
              placeholder="Nom du client"
              className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Code Pennylane</label>
            <input
              type="text"
              value={codePennylane}
              onChange={(e) => setCodePennylane(e.target.value)}
              placeholder="Pour future intégration API"
              className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600"
            />
            <p className="text-slate-500 text-xs mt-1">Optionnel - pour l'intégration future avec Pennylane</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded transition">
              Annuler
            </button>
            <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded transition">
              {client ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MergeClientModal({ sourceClient, clients, charges, onMerge, onClose }) {
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Clients Pennylane disponibles pour la fusion (actifs, avec cabinet)
  const pennylaneClients = clients.filter(c =>
    c.cabinet && c.actif && c.id !== sourceClient.id
  );

  const filteredClients = pennylaneClients.filter(c =>
    c.nom.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Compter les charges du client source
  const sourceChargesCount = charges.filter(c => c.client_id === sourceClient.id).length;

  const handleMerge = () => {
    if (!selectedTargetId) {
      alert('Veuillez sélectionner un client cible');
      return;
    }
    const targetClient = clients.find(c => c.id === parseInt(selectedTargetId));
    if (confirm(`Fusionner "${sourceClient.nom}" vers "${targetClient.nom}" ?\n\n${sourceChargesCount} charge(s) seront transférées.\nLe client "${sourceClient.nom}" sera supprimé.`)) {
      onMerge(sourceClient.id, parseInt(selectedTargetId));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg p-6 max-w-lg w-full border border-slate-700 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Fusionner le client</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-4 mb-4">
          <p className="text-sm text-slate-400 mb-1">Client source (sera supprimé)</p>
          <p className="text-white font-medium">{sourceClient.nom}</p>
          {sourceChargesCount > 0 && (
            <p className="text-orange-400 text-sm mt-2">
              {sourceChargesCount} charge(s) seront transférées
            </p>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Fusionner vers (client Pennylane)
          </label>
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 mb-2"
          />
          <div className="max-h-60 overflow-y-auto space-y-1">
            {filteredClients.map(client => (
              <div
                key={client.id}
                onClick={() => setSelectedTargetId(String(client.id))}
                className={`p-3 rounded cursor-pointer transition ${
                  selectedTargetId === String(client.id)
                    ? 'bg-orange-600/30 border border-orange-500'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                <div className="text-white">{client.nom}</div>
                <div className="text-xs text-slate-400 flex gap-2 mt-1">
                  <span className={`px-1.5 py-0.5 rounded ${
                    client.cabinet === 'Audit Up' ? 'bg-purple-600/30 text-purple-300' : 'bg-blue-600/30 text-blue-300'
                  }`}>
                    {client.cabinet}
                  </span>
                  {client.code_pennylane && <span>{client.code_pennylane}</span>}
                </div>
              </div>
            ))}
            {filteredClients.length === 0 && (
              <p className="text-slate-500 text-center py-4">Aucun client trouvé</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded transition"
          >
            Annuler
          </button>
          <button
            onClick={handleMerge}
            disabled={!selectedTargetId}
            className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-2 rounded transition"
          >
            Fusionner
          </button>
        </div>
      </div>
    </div>
  );
}

function AddChargeModal({ clients, collaborateurs, defaultDate, onAdd, onClose }) {
  if (!collaborateurs || collaborateurs.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">Ajouter une charge</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <X size={24} />
            </button>
          </div>
          <p className="text-slate-300">Veuillez sélectionner au moins un collaborateur dans le filtre.</p>
          <button onClick={onClose} className="mt-4 w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded transition">
            Fermer
          </button>
        </div>
      </div>
    );
  }

  const initialCollabId = collaborateurs[0]?.id || '';

  const [formData, setFormData] = useState({
    collaborateurId: initialCollabId,
    clientId: '',
    dateComplete: defaultDate,
    heures: 1,
    type: 'budgété',
    detail: ''
  });

  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const sortedClients = [...clients].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const filteredClients = sortedClients.filter(c =>
    c.nom.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const handleClientSelect = (client) => {
    setFormData({ ...formData, clientId: client.id });
    setClientSearch(client.nom);
    setShowClientDropdown(false);
  };

  const handleCollaborateurChange = (newCollabId) => {
    setFormData({
      ...formData,
      collaborateurId: newCollabId
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd(parseInt(formData.collaborateurId), parseInt(formData.clientId), formData.dateComplete, formData.heures, formData.type, formData.detail);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Ajouter une charge</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Collaborateur</label>
            <select value={formData.collaborateurId} onChange={(e) => handleCollaborateurChange(e.target.value)} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600">
              {collaborateurs.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-slate-300 mb-1">Client</label>
            <input
              type="text"
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value);
                setFormData({ ...formData, clientId: '' });
                setShowClientDropdown(true);
              }}
              onFocus={() => setShowClientDropdown(true)}
              placeholder="Rechercher un client..."
              className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600"
            />
            {showClientDropdown && filteredClients.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-slate-700 border border-slate-600 rounded max-h-48 overflow-y-auto">
                {filteredClients.map(c => (
                  <div
                    key={c.id}
                    onClick={() => handleClientSelect(c)}
                    className="px-3 py-2 cursor-pointer hover:bg-slate-600 text-white"
                  >
                    {c.nom}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Date</label>
            <input type="date" value={formData.dateComplete} onChange={(e) => setFormData({ ...formData, dateComplete: e.target.value })} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Heures</label>
            <input type="number" step="0.5" min="0.5" value={formData.heures} onChange={(e) => setFormData({ ...formData, heures: e.target.value })} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
            <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600">
              <option value="budgété">Budgété</option>
              <option value="réel">Réel</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Détail (optionnel)</label>
            <textarea value={formData.detail} onChange={(e) => setFormData({ ...formData, detail: e.target.value })} placeholder="Ex: Configuration système, réunion client..." className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 h-20 resize-none" />
          </div>

          <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded transition">
            Ajouter
          </button>
        </form>
      </div>
    </div>
  );
}

function EditChargeModal({ charge, clients, collaborateurs, onUpdate, onClose }) {
  if (!collaborateurs || collaborateurs.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">Modifier la charge</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <X size={24} />
            </button>
          </div>
          <p className="text-slate-300">Veuillez sélectionner au moins un collaborateur dans le filtre.</p>
          <button onClick={onClose} className="mt-4 w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded transition">
            Fermer
          </button>
        </div>
      </div>
    );
  }

  const [formData, setFormData] = useState({
    collaborateurId: charge.collaborateur_id,
    clientId: charge.client_id,
    dateComplete: charge.date_charge,
    heures: charge.heures,
    type: charge.type || 'budgété',
    detail: charge.detail || ''
  });

  const handleCollaborateurChange = (newCollabId) => {
    setFormData({
      ...formData,
      collaborateurId: newCollabId
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdate(charge.id, parseInt(formData.collaborateurId), parseInt(formData.clientId), formData.dateComplete, formData.heures, formData.type, formData.detail);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Modifier la charge</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Collaborateur</label>
            <select value={formData.collaborateurId} onChange={(e) => handleCollaborateurChange(e.target.value)} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600">
              {collaborateurs.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Client</label>
            <select value={formData.clientId} onChange={(e) => setFormData({ ...formData, clientId: e.target.value })} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600">
              {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Date</label>
            <input type="date" value={formData.dateComplete} onChange={(e) => setFormData({ ...formData, dateComplete: e.target.value })} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Heures</label>
            <input type="number" step="0.5" min="0.5" value={formData.heures} onChange={(e) => setFormData({ ...formData, heures: e.target.value })} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
            <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600">
              <option value="budgété">Budgété</option>
              <option value="réel">Réel</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Détail (optionnel)</label>
            <textarea value={formData.detail} onChange={(e) => setFormData({ ...formData, detail: e.target.value })} placeholder="Ex: Configuration système, réunion client..." className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 h-20 resize-none" />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded transition">
              Annuler
            </button>
            <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded transition">
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ExportModal({ viewMode, currentDate, weekDays, onExport, onClose }) {
  const getWeekDaysForExport = () => {
    if (weekDays && weekDays.length > 0) return weekDays;
    const today = new Date(currentDate);
    const first = today.getDate() - today.getDay() + 1;
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(today.getFullYear(), today.getMonth(), first + i));
    }
    return days;
  };

  const exportWeekDays = getWeekDaysForExport();

  const [startDate, setStartDate] = useState(() => {
    if (viewMode === 'month' || viewMode === 'day') {
      const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      return formatDateToYMD(firstDay);
    } else if (exportWeekDays.length > 0) {
      return formatDateToYMD(exportWeekDays[0]);
    }
    return '';
  });

  const [endDate, setEndDate] = useState(() => {
    if (viewMode === 'month' || viewMode === 'day') {
      const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      return formatDateToYMD(lastDay);
    } else if (exportWeekDays.length > 0) {
      return formatDateToYMD(exportWeekDays[6]);
    }
    return '';
  });

  const handleExport = () => {
    onExport(startDate, endDate);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Export Excel</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Date de début</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Date de fin</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" />
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded transition">
              Annuler
            </button>
            <button onClick={handleExport} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded transition">
              Exporter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// PAGE D'AUTHENTIFICATION
// ============================================
function AuthPage({ authPage, setAuthPage, accent }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [showOtpForm, setShowOtpForm] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // Détecter si on arrive via un lien de reset password ou une erreur
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const errorCode = hashParams.get('error_code');
    const errorDescription = hashParams.get('error_description');

    // Si erreur dans l'URL (lien expiré, etc.)
    if (errorCode) {
      if (errorCode === 'otp_expired') {
        setError('Le lien a expiré. Veuillez demander un nouveau code.');
      } else {
        setError(errorDescription?.replace(/\+/g, ' ') || 'Une erreur est survenue');
      }
      // Nettoyer l'URL
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // Vérifier le code OTP et changer le mot de passe
  const handleVerifyOtpAndReset = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      setLoading(false);
      return;
    }

    if (!otpCode || otpCode.length < 6) {
      setError('Veuillez entrer le code reçu par email');
      setLoading(false);
      return;
    }

    try {
      // Vérifier le code OTP
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: resetEmail,
        token: otpCode,
        type: 'recovery'
      });

      if (verifyError) {
        setError('Code invalide ou expiré. Veuillez réessayer.');
        setLoading(false);
        return;
      }

      // Mettre à jour le mot de passe
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess('Mot de passe modifié avec succès ! Vous pouvez maintenant vous connecter.');
        setShowOtpForm(false);
        setPassword('');
        setConfirmPassword('');
        setOtpCode('');
        setResetEmail('');
        setAuthPage('login');
      }
    } catch (err) {
      setError('Une erreur est survenue');
    }
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Vérifier que l'email existe dans collaborateurs
      const { data: collab, error: collabError } = await supabase
        .from('collaborateurs')
        .select('*')
        .eq('email', email)
        .single();

      if (collabError || !collab) {
        setError("Cet email n'est pas autorisé à accéder à l'application. Contactez votre administrateur.");
        setLoading(false);
        return;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          setError('Email ou mot de passe incorrect');
        } else {
          setError(authError.message);
        }
      }
    } catch (err) {
      setError('Une erreur est survenue');
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      setLoading(false);
      return;
    }

    try {
      // Vérifier que l'email existe dans collaborateurs
      const { data: collab, error: collabError } = await supabase
        .from('collaborateurs')
        .select('*')
        .eq('email', email)
        .single();

      if (collabError || !collab) {
        setError("Cet email n'est pas autorisé. Demandez à votre administrateur de vous ajouter.");
        setLoading(false);
        return;
      }

      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
      } else {
        setSuccess('Compte créé ! Vérifiez votre email pour confirmer votre inscription.');
        setAuthPage('login');
      }
    } catch (err) {
      setError('Une erreur est survenue');
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Envoyer le code OTP par email (pas de lien magique)
      const { error } = await supabase.auth.resetPasswordForEmail(email);

      if (error) {
        setError(error.message);
      } else {
        // Passer au formulaire de saisie du code
        setResetEmail(email);
        setShowOtpForm(true);
        setSuccess('Un code de vérification a été envoyé à votre adresse email.');
      }
    } catch (err) {
      setError('Une erreur est survenue');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-900 via-purple-800 to-pink-900 flex items-center justify-center p-4">
      <div className="bg-slate-800/90 backdrop-blur rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Calendrier de gestion d'équipe</h1>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg flex items-center gap-2 text-red-400">
            <AlertCircle size={18} />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-500/20 border border-green-500 rounded-lg text-green-400">
            {success}
          </div>
        )}

        {/* Formulaire Réinitialisation du mot de passe avec code OTP */}
        {showOtpForm && (
          <form onSubmit={handleVerifyOtpAndReset} className="space-y-4">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-white">Nouveau mot de passe</h2>
              <p className="text-slate-400 text-sm">Entrez le code reçu par email et votre nouveau mot de passe</p>
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Code de vérification</label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg border border-slate-600 focus:border-pink-500 focus:outline-none text-center text-2xl tracking-widest"
                placeholder="Code reçu par email"
                required
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Nouveau mot de passe</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-700 text-white pl-10 pr-4 py-3 rounded-lg border border-slate-600 focus:border-pink-500 focus:outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Confirmer le mot de passe</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-700 text-white pl-10 pr-4 py-3 rounded-lg border border-slate-600 focus:border-pink-500 focus:outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full ${accent.color} ${accent.hover} text-white font-bold py-3 rounded-lg transition`}
            >
              {loading ? 'Modification...' : 'Modifier le mot de passe'}
            </button>
            <button
              type="button"
              onClick={() => { setShowOtpForm(false); setOtpCode(''); setPassword(''); setConfirmPassword(''); setError(''); setSuccess(''); }}
              className="w-full text-slate-400 hover:text-slate-300 text-sm"
            >
              Annuler
            </button>
          </form>
        )}

        {/* Formulaire Connexion */}
        {authPage === 'login' && !showOtpForm && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-700 text-white pl-10 pr-4 py-3 rounded-lg border border-slate-600 focus:border-pink-500 focus:outline-none"
                  placeholder="votre@email.com"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Mot de passe</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-700 text-white pl-10 pr-4 py-3 rounded-lg border border-slate-600 focus:border-pink-500 focus:outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full ${accent.color} ${accent.hover} text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2`}
            >
              {loading ? 'Connexion...' : <><LogIn size={18} /> Se connecter</>}
            </button>
            <div className="flex justify-between text-sm">
              <button
                type="button"
                onClick={() => { setAuthPage('register'); setError(''); setSuccess(''); }}
                className="text-pink-400 hover:text-pink-300"
              >
                Créer un compte
              </button>
              <button
                type="button"
                onClick={() => { setAuthPage('forgot'); setError(''); setSuccess(''); }}
                className="text-slate-400 hover:text-slate-300"
              >
                Mot de passe oublié ?
              </button>
            </div>
          </form>
        )}

        {/* Formulaire Inscription */}
        {authPage === 'register' && !showOtpForm && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-700 text-white pl-10 pr-4 py-3 rounded-lg border border-slate-600 focus:border-pink-500 focus:outline-none"
                  placeholder="votre@email.com"
                  required
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Utilisez l'email fourni par votre administrateur</p>
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Mot de passe</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-700 text-white pl-10 pr-4 py-3 rounded-lg border border-slate-600 focus:border-pink-500 focus:outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Confirmer le mot de passe</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-700 text-white pl-10 pr-4 py-3 rounded-lg border border-slate-600 focus:border-pink-500 focus:outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full ${accent.color} ${accent.hover} text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2`}
            >
              {loading ? 'Création...' : <><UserPlus size={18} /> Créer mon compte</>}
            </button>
            <button
              type="button"
              onClick={() => { setAuthPage('login'); setError(''); setSuccess(''); }}
              className="w-full text-slate-400 hover:text-slate-300 text-sm"
            >
              Déjà un compte ? Se connecter
            </button>
          </form>
        )}

        {/* Formulaire Mot de passe oublié */}
        {authPage === 'forgot' && !showOtpForm && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-700 text-white pl-10 pr-4 py-3 rounded-lg border border-slate-600 focus:border-pink-500 focus:outline-none"
                  placeholder="votre@email.com"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full ${accent.color} ${accent.hover} text-white font-bold py-3 rounded-lg transition`}
            >
              {loading ? 'Envoi...' : 'Réinitialiser le mot de passe'}
            </button>
            <button
              type="button"
              onClick={() => { setAuthPage('login'); setError(''); setSuccess(''); }}
              className="w-full text-slate-400 hover:text-slate-300 text-sm"
            >
              Retour à la connexion
            </button>
          </form>
        )}

        {/* Footer - Powered by */}
        <div className="mt-8 pt-6 border-t border-slate-700 text-center">
          <p className="text-slate-500 text-xs">Powered by</p>
          <p className="text-slate-400 font-semibold">AUDIT UP</p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// PAGE TEMPS RÉELS - Import et Analyse des Écarts
// ============================================
function TempsReelsPage({ clients, collaborateurs, charges, setCharges, accent }) {
  const [activeTab, setActiveTab] = useState('mapping'); // 'mapping', 'import', 'ecarts', 'journal'

  // Mappings stockés en localStorage
  const [mappingCollaborateurs, setMappingCollaborateurs] = useState(() => {
    const saved = localStorage.getItem('mappingCollaborateurs');
    return saved ? JSON.parse(saved) : {};
  });
  const [mappingClients, setMappingClients] = useState(() => {
    const saved = localStorage.getItem('mappingClients');
    return saved ? JSON.parse(saved) : {};
  });

  // Données importées
  const [importedData, setImportedData] = useState([]);
  const [importStats, setImportStats] = useState(null);
  const [tempsReels, setTempsReels] = useState(() => {
    const saved = localStorage.getItem('tempsReels');
    return saved ? JSON.parse(saved) : [];
  });

  // Journal des modifications
  const [journalModifications, setJournalModifications] = useState(() => {
    const saved = localStorage.getItem('journalModifications');
    return saved ? JSON.parse(saved) : [];
  });

  // Filtres pour l'analyse des écarts
  const [filtreCollaborateur, setFiltreCollaborateur] = useState('');
  const [filtreClient, setFiltreClient] = useState('');
  const [filtrePeriode, setFiltrePeriode] = useState('mois'); // 'mois', 'trimestre', 'annee', 'custom'
  const [dateDebut, setDateDebut] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return formatDateToYMD(d);
  });
  const [dateFin, setDateFin] = useState(formatDateToYMD(new Date()));
  const [searchEcarts, setSearchEcarts] = useState('');
  const [sortEcarts, setSortEcarts] = useState({ column: 'ecart', direction: 'desc' }); // column: 'collaborateur', 'client', 'budgetees', 'reelles', 'ecart', 'ecartPourcent'

  // Sauvegarde des mappings
  useEffect(() => {
    localStorage.setItem('mappingCollaborateurs', JSON.stringify(mappingCollaborateurs));
  }, [mappingCollaborateurs]);

  useEffect(() => {
    localStorage.setItem('mappingClients', JSON.stringify(mappingClients));
  }, [mappingClients]);

  useEffect(() => {
    localStorage.setItem('tempsReels', JSON.stringify(tempsReels));
  }, [tempsReels]);

  useEffect(() => {
    localStorage.setItem('journalModifications', JSON.stringify(journalModifications));
  }, [journalModifications]);

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

  // Auto-matching des collaborateurs
  const autoMatchCollaborateurs = () => {
    const newMapping = { ...mappingCollaborateurs };

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
      }
    });

    setMappingCollaborateurs(newMapping);
  };

  // Auto-matching des clients
  const autoMatchClients = () => {
    const newMapping = { ...mappingClients };

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
      }
    });

    setMappingClients(newMapping);
  };

  // Valider et enregistrer les temps réels (mode remplacement par période)
  const handleValidateImport = () => {
    // 1. Parser les nouvelles données
    const newTempsReels = [];
    let lignesIgnorees = 0;

    importedData.forEach(row => {
      const collaborateurId = mappingCollaborateurs[row.collaborateurPennylane];
      const clientId = mappingClients[row.clientPennylane];

      if (!collaborateurId || !clientId) {
        lignesIgnorees++;
        return;
      }

      newTempsReels.push({
        collaborateur_id: collaborateurId,
        client_id: clientId,
        date: row.date,
        heures: row.dureeHeures,
        commentaire: row.commentaire,
        activite: row.activite,
        typeMission: row.typeMission,
        millesime: row.millesime
      });
    });

    // 2. Déterminer la période du fichier importé
    const dates = newTempsReels.map(t => t.date).filter(d => d);
    if (dates.length === 0) {
      alert('Aucune donnée valide à importer');
      return;
    }
    const periodeDebut = dates.reduce((min, d) => d < min ? d : min, dates[0]);
    const periodeFin = dates.reduce((max, d) => d > max ? d : max, dates[0]);

    // 3. Récupérer les anciennes données de cette période
    const anciennesDonnees = tempsReels.filter(t => t.date >= periodeDebut && t.date <= periodeFin);
    const donneesHorsPeriode = tempsReels.filter(t => t.date < periodeDebut || t.date > periodeFin);

    // 4. Agréger les nouvelles données par collaborateur/client/date
    const aggregatedNew = {};
    newTempsReels.forEach(t => {
      const key = `${t.collaborateur_id}-${t.client_id}-${t.date}`;
      if (!aggregatedNew[key]) {
        aggregatedNew[key] = { ...t };
      } else {
        aggregatedNew[key].heures += t.heures;
        if (t.commentaire && !aggregatedNew[key].commentaire?.includes(t.commentaire)) {
          aggregatedNew[key].commentaire = aggregatedNew[key].commentaire
            ? `${aggregatedNew[key].commentaire} | ${t.commentaire}`
            : t.commentaire;
        }
      }
    });
    const nouvellesDonneesAgregees = Object.values(aggregatedNew);

    // 5. Comparer et détecter les modifications
    const modifications = {
      date: new Date().toISOString(),
      periodeDebut,
      periodeFin,
      ajouts: [],
      modifications: [],
      suppressions: []
    };

    // Index des anciennes données
    const anciennesIndex = {};
    anciennesDonnees.forEach(t => {
      const key = `${t.collaborateur_id}-${t.client_id}-${t.date}`;
      anciennesIndex[key] = t;
    });

    // Index des nouvelles données
    const nouvellesIndex = {};
    nouvellesDonneesAgregees.forEach(t => {
      const key = `${t.collaborateur_id}-${t.client_id}-${t.date}`;
      nouvellesIndex[key] = t;
    });

    // Détecter ajouts et modifications
    Object.keys(nouvellesIndex).forEach(key => {
      const nouveau = nouvellesIndex[key];
      const ancien = anciennesIndex[key];
      const collab = collaborateurs.find(c => c.id === nouveau.collaborateur_id);
      const client = clients.find(c => c.id === nouveau.client_id);

      if (!ancien) {
        // Nouvelle entrée
        modifications.ajouts.push({
          collaborateur: collab?.nom || 'Inconnu',
          client: client?.nom || 'Inconnu',
          date: nouveau.date,
          heures: nouveau.heures
        });
      } else if (Math.abs(ancien.heures - nouveau.heures) > 0.01) {
        // Modification des heures
        modifications.modifications.push({
          collaborateur: collab?.nom || 'Inconnu',
          client: client?.nom || 'Inconnu',
          date: nouveau.date,
          anciennesHeures: ancien.heures,
          nouvellesHeures: nouveau.heures,
          ecart: Math.round((nouveau.heures - ancien.heures) * 100) / 100
        });
      }
    });

    // Détecter suppressions
    Object.keys(anciennesIndex).forEach(key => {
      if (!nouvellesIndex[key]) {
        const ancien = anciennesIndex[key];
        const collab = collaborateurs.find(c => c.id === ancien.collaborateur_id);
        const client = clients.find(c => c.id === ancien.client_id);
        modifications.suppressions.push({
          collaborateur: collab?.nom || 'Inconnu',
          client: client?.nom || 'Inconnu',
          date: ancien.date,
          heures: ancien.heures
        });
      }
    });

    // 6. Enregistrer dans le journal si des modifications ont eu lieu
    const hasChanges = modifications.ajouts.length > 0 ||
                       modifications.modifications.length > 0 ||
                       modifications.suppressions.length > 0;

    if (hasChanges) {
      setJournalModifications(prev => [modifications, ...prev].slice(0, 100)); // Garder les 100 derniers
    }

    // 7. Remplacer les données de la période par les nouvelles
    const finalTempsReels = [...donneesHorsPeriode, ...nouvellesDonneesAgregees];
    setTempsReels(finalTempsReels);

    // 8. Afficher le résumé
    const resume = [
      `Import terminé ! (Période: ${periodeDebut} → ${periodeFin})`,
      '',
      `✅ ${modifications.ajouts.length} ajout(s)`,
      `📝 ${modifications.modifications.length} modification(s)`,
      `🗑️ ${modifications.suppressions.length} suppression(s)`,
      `⏭️ ${lignesIgnorees} ligne(s) ignorée(s) (mapping manquant)`,
      '',
      `📊 Total: ${finalTempsReels.length} entrées`
    ].join('\n');

    alert(resume);

    // Mettre à jour les filtres de période avec la période importée
    setDateDebut(periodeDebut);
    setDateFin(periodeFin);

    // Aller au journal si des modifications importantes
    if (modifications.suppressions.length > 0 || modifications.modifications.length > 0) {
      setActiveTab('journal');
    } else {
      setActiveTab('ecarts');
    }
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
          heuresReelles: 0
        };
      }
      ecarts[key].heuresBudgetees += c.heures || 0;
    });

    // Ajouter les heures réelles
    tempsReelsFiltres.forEach(t => {
      const key = `${t.collaborateur_id}-${t.client_id}`;
      if (!ecarts[key]) {
        ecarts[key] = {
          collaborateur_id: t.collaborateur_id,
          client_id: t.client_id,
          heuresBudgetees: 0,
          heuresReelles: 0
        };
      }
      ecarts[key].heuresReelles += t.heures || 0;
    });

    // Calculer les écarts et enrichir avec les noms
    return Object.values(ecarts).map(e => {
      const collab = collaborateurs.find(c => c.id === e.collaborateur_id);
      const client = clients.find(c => c.id === e.client_id);
      const ecart = e.heuresReelles - e.heuresBudgetees;
      const ecartPourcent = e.heuresBudgetees > 0 ? Math.round((ecart / e.heuresBudgetees) * 100) : (e.heuresReelles > 0 ? 100 : 0);

      return {
        ...e,
        collaborateurNom: collab?.nom || 'Inconnu',
        clientNom: client?.nom || 'Inconnu',
        ecart: Math.round(ecart * 100) / 100,
        ecartPourcent
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
    if (sortEcarts.column !== column) return <ChevronDown size={14} className="text-slate-500" />;
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="bg-slate-800/80 backdrop-blur-sm rounded-xl p-6 shadow-xl border border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Clock className="text-pink-400" />
              Temps Réels & Analyse des Écarts
            </h2>
            <p className="text-slate-400 mt-1">Import des temps Pennylane et comparaison avec les temps budgétés</p>
          </div>

          {tempsReels.length > 0 && (
            <div className="text-right">
              <div className="text-sm text-slate-400">Temps réels importés</div>
              <div className="text-2xl font-bold text-green-400">{tempsReels.length} entrées</div>
            </div>
          )}
        </div>

        {/* Onglets */}
        <div className="flex gap-2 mb-6 border-b border-slate-600 pb-4">
          <button
            onClick={() => setActiveTab('mapping')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === 'mapping' ? `${accent.color} text-white` : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
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
              activeTab === 'import' ? `${accent.color} text-white` : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <Upload size={18} />
            Import Excel
          </button>
          <button
            onClick={() => setActiveTab('ecarts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === 'ecarts' ? `${accent.color} text-white` : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <BarChart3 size={18} />
            Analyse des Écarts
          </button>
          <button
            onClick={() => setActiveTab('journal')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              activeTab === 'journal' ? `${accent.color} text-white` : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
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
                  Collaborateurs ({uniquePennylaneCollabs.length})
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
                <p className="text-slate-400 text-center py-4">
                  Importez d'abord un fichier Excel pour voir les collaborateurs à mapper
                </p>
              ) : (
                <div className="grid gap-2 max-h-64 overflow-y-auto">
                  {uniquePennylaneCollabs.map(pennylane => (
                    <div key={pennylane} className="flex items-center gap-3 bg-slate-600/50 rounded-lg p-2">
                      <div className="flex-1 text-white text-sm truncate" title={pennylane}>
                        {pennylane}
                      </div>
                      <ArrowUpDown size={16} className="text-slate-400" />
                      <select
                        value={mappingCollaborateurs[pennylane] || ''}
                        onChange={(e) => setMappingCollaborateurs({
                          ...mappingCollaborateurs,
                          [pennylane]: e.target.value ? parseInt(e.target.value) : null
                        })}
                        className={`w-48 px-3 py-1.5 rounded-lg text-sm ${
                          mappingCollaborateurs[pennylane]
                            ? 'bg-green-600/30 border-green-500 text-white'
                            : 'bg-slate-700 border-slate-600 text-slate-300'
                        } border`}
                      >
                        <option value="">-- Non mappé --</option>
                        {collaborateurs.map(c => (
                          <option key={c.id} value={c.id}>{c.nom}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section Clients */}
            <div className="bg-slate-700/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Building2 size={20} className="text-purple-400" />
                  Clients ({uniquePennylaneClients.length})
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
                <p className="text-slate-400 text-center py-4">
                  Importez d'abord un fichier Excel pour voir les clients à mapper
                </p>
              ) : (
                <div className="grid gap-2 max-h-96 overflow-y-auto">
                  {uniquePennylaneClients.map(pennylane => (
                    <div key={pennylane} className="flex items-center gap-3 bg-slate-600/50 rounded-lg p-2">
                      <div className="flex-1 text-white text-sm truncate" title={pennylane}>
                        {pennylane}
                      </div>
                      <ArrowUpDown size={16} className="text-slate-400" />
                      <select
                        value={mappingClients[pennylane] || ''}
                        onChange={(e) => setMappingClients({
                          ...mappingClients,
                          [pennylane]: e.target.value ? parseInt(e.target.value) : null
                        })}
                        className={`w-64 px-3 py-1.5 rounded-lg text-sm ${
                          mappingClients[pennylane]
                            ? 'bg-green-600/30 border-green-500 text-white'
                            : 'bg-slate-700 border-slate-600 text-slate-300'
                        } border`}
                      >
                        <option value="">-- Non mappé --</option>
                        {clients.filter(c => c.actif !== false).map(c => (
                          <option key={c.id} value={c.id}>{c.nom}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Onglet Import */}
        {activeTab === 'import' && (
          <div className="space-y-6">
            {/* Zone d'upload */}
            <div className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center hover:border-pink-500 transition">
              <Upload size={48} className="mx-auto text-slate-400 mb-4" />
              <p className="text-white text-lg mb-2">Importez votre fichier Excel Pennylane</p>
              <p className="text-slate-400 text-sm mb-4">
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
                    <div className="text-sm text-slate-400">Lignes</div>
                  </div>
                  <div className="bg-slate-600/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-400">{importStats.collaborateurs}</div>
                    <div className="text-sm text-slate-400">Collaborateurs</div>
                  </div>
                  <div className="bg-slate-600/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-purple-400">{importStats.clients}</div>
                    <div className="text-sm text-slate-400">Clients</div>
                  </div>
                  <div className="bg-slate-600/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-400">{importStats.totalHeures}h</div>
                    <div className="text-sm text-slate-400">Heures totales</div>
                  </div>
                </div>

                {/* Alerte si mappings manquants */}
                {(mappingCollabsManquants > 0 || mappingClientsManquants > 0) && (
                  <div className="mt-4 bg-amber-500/20 border border-amber-500 rounded-lg p-3 flex items-center gap-3">
                    <AlertCircle className="text-amber-400" size={24} />
                    <div>
                      <p className="text-amber-400 font-medium">Correspondances manquantes</p>
                      <p className="text-slate-300 text-sm">
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
                        <th className="px-3 py-2 text-left text-slate-300">Collaborateur</th>
                        <th className="px-3 py-2 text-left text-slate-300">Client</th>
                        <th className="px-3 py-2 text-left text-slate-300">Date</th>
                        <th className="px-3 py-2 text-right text-slate-300">Heures</th>
                        <th className="px-3 py-2 text-left text-slate-300">Activité</th>
                        <th className="px-3 py-2 text-center text-slate-300">Statut</th>
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
                            <td className="px-3 py-2 text-slate-300">{row.date}</td>
                            <td className="px-3 py-2 text-right text-green-400">{row.dureeHeures}h</td>
                            <td className="px-3 py-2 text-slate-400 truncate max-w-xs">{row.activite}</td>
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
                    <p className="text-center text-slate-400 py-2">
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
                  <label className="block text-sm text-slate-400 mb-1">Collaborateur</label>
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
                  <label className="block text-sm text-slate-400 mb-1">Client</label>
                  <select
                    value={filtreClient}
                    onChange={(e) => setFiltreClient(e.target.value)}
                    className="px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white"
                  >
                    <option value="">Tous</option>
                    {clients.filter(c => c.actif !== false).map(c => (
                      <option key={c.id} value={c.id}>{c.nom}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Du</label>
                  <input
                    type="date"
                    value={dateDebut}
                    onChange={(e) => setDateDebut(e.target.value)}
                    className="px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Au</label>
                  <input
                    type="date"
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                    className="px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white"
                  />
                </div>

                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm text-slate-400 mb-1">Rechercher</label>
                  <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
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
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
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
                <div className="text-sm text-slate-300">Heures budgétées</div>
              </div>
              <div className="bg-green-500/20 border border-green-500 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-400">{Math.round(totaux.reelles * 10) / 10}h</div>
                <div className="text-sm text-slate-300">Heures réelles</div>
              </div>
              <div className={`${totaux.ecart > 0 ? 'bg-red-500/20 border-red-500' : 'bg-emerald-500/20 border-emerald-500'} border rounded-lg p-4 text-center`}>
                <div className={`text-3xl font-bold ${totaux.ecart > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {totaux.ecart > 0 ? '+' : ''}{Math.round(totaux.ecart * 10) / 10}h
                </div>
                <div className="text-sm text-slate-300">Écart total</div>
              </div>
              <div className={`${totaux.ecart > 0 ? 'bg-red-500/20 border-red-500' : 'bg-emerald-500/20 border-emerald-500'} border rounded-lg p-4 text-center`}>
                <div className={`text-3xl font-bold ${totaux.ecart > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {totaux.budgetees > 0 ? (totaux.ecart > 0 ? '+' : '') + Math.round((totaux.ecart / totaux.budgetees) * 100) : 0}%
                </div>
                <div className="text-sm text-slate-300">Variation</div>
              </div>
            </div>

            {/* Tableau des écarts */}
            {ecarts.length === 0 ? (
              <div className="text-center py-12">
                <BarChart3 size={48} className="mx-auto text-slate-500 mb-4" />
                <p className="text-slate-400">Aucune donnée à afficher pour cette période</p>
                <p className="text-slate-500 text-sm mt-2">Importez des temps réels ou ajustez les filtres</p>
              </div>
            ) : (
              <div className="bg-slate-700/50 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-600/50">
                      <tr>
                        <th
                          onClick={() => handleSort('collaborateur')}
                          className="px-4 py-3 text-left text-slate-300 font-medium cursor-pointer hover:bg-slate-500/30 transition select-none"
                        >
                          <div className="flex items-center gap-1">
                            Collaborateur
                            <SortIcon column="collaborateur" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('client')}
                          className="px-4 py-3 text-left text-slate-300 font-medium cursor-pointer hover:bg-slate-500/30 transition select-none"
                        >
                          <div className="flex items-center gap-1">
                            Client
                            <SortIcon column="client" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('budgetees')}
                          className="px-4 py-3 text-right text-slate-300 font-medium cursor-pointer hover:bg-slate-500/30 transition select-none"
                        >
                          <div className="flex items-center justify-end gap-1">
                            Budgété
                            <SortIcon column="budgetees" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('reelles')}
                          className="px-4 py-3 text-right text-slate-300 font-medium cursor-pointer hover:bg-slate-500/30 transition select-none"
                        >
                          <div className="flex items-center justify-end gap-1">
                            Réel
                            <SortIcon column="reelles" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('ecart')}
                          className="px-4 py-3 text-right text-slate-300 font-medium cursor-pointer hover:bg-slate-500/30 transition select-none"
                        >
                          <div className="flex items-center justify-end gap-1">
                            Écart
                            <SortIcon column="ecart" />
                          </div>
                        </th>
                        <th
                          onClick={() => handleSort('ecartPourcent')}
                          className="px-4 py-3 text-right text-slate-300 font-medium cursor-pointer hover:bg-slate-500/30 transition select-none"
                        >
                          <div className="flex items-center justify-end gap-1">
                            %
                            <SortIcon column="ecartPourcent" />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ecarts.map((e, idx) => (
                        <tr key={idx} className="border-t border-slate-600 hover:bg-slate-600/30">
                          <td className="px-4 py-3 text-white">{e.collaborateurNom}</td>
                          <td className="px-4 py-3 text-white">{e.clientNom}</td>
                          <td className="px-4 py-3 text-right text-blue-400">{Math.round(e.heuresBudgetees * 10) / 10}h</td>
                          <td className="px-4 py-3 text-right text-green-400">{Math.round(e.heuresReelles * 10) / 10}h</td>
                          <td className={`px-4 py-3 text-right font-medium ${e.ecart > 0 ? 'text-red-400' : e.ecart < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {e.ecart > 0 ? '+' : ''}{e.ecart}h
                          </td>
                          <td className={`px-4 py-3 text-right ${e.ecartPourcent > 20 ? 'text-red-400' : e.ecartPourcent < -20 ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {e.ecartPourcent > 0 ? '+' : ''}{e.ecartPourcent}%
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
                      ['Collaborateur', 'Client', 'Heures Budgétées', 'Heures Réelles', 'Écart (h)', 'Écart (%)'],
                      ...ecarts.map(e => [
                        e.collaborateurNom,
                        e.clientNom,
                        Math.round(e.heuresBudgetees * 10) / 10,
                        Math.round(e.heuresReelles * 10) / 10,
                        e.ecart,
                        e.ecartPourcent
                      ]),
                      [],
                      ['TOTAL', '', Math.round(totaux.budgetees * 10) / 10, Math.round(totaux.reelles * 10) / 10, Math.round(totaux.ecart * 10) / 10, totaux.budgetees > 0 ? Math.round((totaux.ecart / totaux.budgetees) * 100) : 0]
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
                <FileText size={48} className="mx-auto text-slate-500 mb-4" />
                <p className="text-slate-400">Aucune modification enregistrée</p>
                <p className="text-slate-500 text-sm mt-2">Les modifications apparaîtront ici après chaque import</p>
              </div>
            ) : (
              <div className="space-y-4">
                {journalModifications.map((entry, idx) => {
                  const dateImport = new Date(entry.date);
                  const totalModifs = entry.ajouts.length + entry.modifications.length + entry.suppressions.length;

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
                          <div className="text-slate-400 text-sm">
                            Période: {entry.periodeDebut} → {entry.periodeFin}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {entry.ajouts.length > 0 && (
                            <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded">
                              +{entry.ajouts.length} ajout(s)
                            </span>
                          )}
                          {entry.modifications.length > 0 && (
                            <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-1 rounded">
                              {entry.modifications.length} modif(s)
                            </span>
                          )}
                          {entry.suppressions.length > 0 && (
                            <span className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded">
                              -{entry.suppressions.length} suppression(s)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Détails des modifications */}
                      <div className="p-4 space-y-4">
                        {/* Suppressions (en premier car plus critique) */}
                        {entry.suppressions.length > 0 && (
                          <div>
                            <h4 className="text-red-400 font-medium mb-2 flex items-center gap-2">
                              <Trash2 size={16} />
                              Entrées supprimées ({entry.suppressions.length})
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
                                  {entry.suppressions.map((s, sIdx) => (
                                    <tr key={sIdx} className="border-t border-red-500/20">
                                      <td className="px-3 py-2 text-white">{s.collaborateur}</td>
                                      <td className="px-3 py-2 text-white">{s.client}</td>
                                      <td className="px-3 py-2 text-slate-300">{s.date}</td>
                                      <td className="px-3 py-2 text-right text-red-400">-{s.heures}h</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Modifications */}
                        {entry.modifications.length > 0 && (
                          <div>
                            <h4 className="text-amber-400 font-medium mb-2 flex items-center gap-2">
                              <Pencil size={16} />
                              Heures modifiées ({entry.modifications.length})
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
                                  {entry.modifications.map((m, mIdx) => (
                                    <tr key={mIdx} className="border-t border-amber-500/20">
                                      <td className="px-3 py-2 text-white">{m.collaborateur}</td>
                                      <td className="px-3 py-2 text-white">{m.client}</td>
                                      <td className="px-3 py-2 text-slate-300">{m.date}</td>
                                      <td className="px-3 py-2 text-right text-slate-400">{m.anciennesHeures}h</td>
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
                        {entry.ajouts.length > 0 && (
                          <div>
                            <h4 className="text-green-400 font-medium mb-2 flex items-center gap-2">
                              <Plus size={16} />
                              Nouvelles entrées ({entry.ajouts.length})
                            </h4>
                            {entry.ajouts.length <= 10 ? (
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
                                    {entry.ajouts.map((a, aIdx) => (
                                      <tr key={aIdx} className="border-t border-green-500/20">
                                        <td className="px-3 py-2 text-white">{a.collaborateur}</td>
                                        <td className="px-3 py-2 text-white">{a.client}</td>
                                        <td className="px-3 py-2 text-slate-300">{a.date}</td>
                                        <td className="px-3 py-2 text-right text-green-400">+{a.heures}h</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="bg-green-500/10 rounded-lg p-3 text-green-300 text-sm">
                                {entry.ajouts.length} nouvelles entrées ajoutées
                                (total: {Math.round(entry.ajouts.reduce((sum, a) => sum + a.heures, 0) * 10) / 10}h)
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

