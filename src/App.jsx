import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Filter, Download, Eye, Pencil, Users, Building2, Calendar, Menu, Check, Trash2, ChevronDown, ChevronUp, Palette, Image, RefreshCw, LogIn, LogOut, UserPlus, Shield, Mail, Lock, AlertCircle } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [backgroundTheme, setBackgroundTheme] = useState(() => {
    const saved = localStorage.getItem('backgroundTheme');
    return saved ? JSON.parse(saved) : { type: 'gradient', value: 'default' };
  });
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [imageCredits, setImageCredits] = useState(null);
  const [accentColor, setAccentColor] = useState(() => {
    const saved = localStorage.getItem('accentColor');
    return saved || 'purple';
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
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
function CalendarPage({ collaborateurs, collaborateurChefs, clients, charges, setCharges, getChefsOf, getEquipeOf, getAccessibleClients, accent, userCollaborateur }) {
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
  }, [viewMode, selectedDay, getWeekDays]);

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

  const getWeekTotal = useCallback((collaborateurId) => {
    return weekDays.reduce((sum, date) => {
      const dateStr = formatDateToYMD(date);
      const dayTotal = charges
        .filter(c => c.collaborateur_id === collaborateurId && c.date_charge === dateStr)
        .reduce((daySum, c) => daySum + parseFloat(c.heures), 0);
      return sum + dayTotal;
    }, 0);
  }, [charges, weekDays]);

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
      setWeekOffset(0);
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

            <button onClick={() => setShowFilterModal(!showFilterModal)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition">
              <Filter size={18} />
              Filtrer ({selectedCollaborateurs.length})
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
                        <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white pl-8">
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
                        </label>

                        {/* Les membres visibles */}
                        {equipe.filter(m => m.actif).map(membre => (
                          <label key={membre.id} className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white pl-8">
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
                          </label>
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
                      <label key={collab.id} className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
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
                      </label>
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
            onClose={() => setShowAddModal(false)}
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
            {allDays.map((day, idx) => (
              <div key={idx} className="bg-slate-700 min-h-32 rounded-lg p-2 border border-slate-600">
                {day && (
                  <>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white font-bold text-lg">{day}</span>
                      <button 
                        onClick={() => openDayView(day)} 
                        className="text-slate-400 hover:text-white p-1 hover:bg-slate-600 rounded transition"
                        title="Voir détails"
                      >
                        <Eye size={14} />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {filteredCollaborateurs.map(collab => {
                        const totalHours = getTotalHoursForDay(collab.id, day);
                        if (totalHours === 0) return null;
                        return (
                          <div 
                            key={collab.id} 
                            className={`flex justify-between items-center text-xs px-2 py-1 rounded cursor-pointer hover:opacity-80 ${
                              totalHours > 8 ? 'bg-red-900/50 text-red-300' : 'bg-slate-600 text-slate-300'
                            }`}
                            onClick={() => openDayView(day)}
                          >
                            <span className="truncate">{collab.nom.split(' ')[0]}</span>
                            <span className="font-bold">{totalHours}h</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            ))}
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
                    const aggregated = getAggregatedByClient(collab.id, dateStr);
                    const dayTotal = getTotalHoursForDateStr(collab.id, dateStr);
                    return (
                      <div 
                        key={dateStr} 
                        className="flex-1 min-w-36 cursor-pointer hover:bg-slate-600 rounded p-1 transition"
                        onClick={() => openDayViewFromDate(date)}
                      >
                        <div className={`text-sm font-bold mb-1 ${dayTotal > 8 ? 'text-red-400' : 'text-slate-300'}`}>
                          {dayTotal > 0 ? `${dayTotal}h` : '-'}
                        </div>
                        {aggregated.length > 0 && (
                          <div className="space-y-0.5">
                            {aggregated.slice(0, 3).map((item, idx) => (
                              <div key={idx} className="text-xs text-slate-400 truncate">
                                {item.client.substring(0, 10)}: {item.heures}h
                              </div>
                            ))}
                            {aggregated.length > 3 && (
                              <div className="text-xs text-slate-500">+{aggregated.length - 3} autres</div>
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
function CollaborateursPage({ collaborateurs, setCollaborateurs, collaborateurChefs, setCollaborateurChefs, charges, getChefsOf, getEquipeOf, accent, isAdmin }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCollab, setEditingCollab] = useState(null);
  const [editingEmail, setEditingEmail] = useState(null);
  const [newEmail, setNewEmail] = useState('');

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
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
          >
            <Plus size={18} />
            Ajouter
          </button>
        </div>

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
                      <div className="text-white font-medium">{client.nom}</div>
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
            onSave={(nom, code) => handleUpdateClient(editingClient.id, nom, code)}
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
    clientId: clients[0]?.id || '',
    dateComplete: defaultDate,
    heures: 1,
    type: 'budgété',
    detail: ''
  });

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
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccess('Un email de réinitialisation a été envoyé si ce compte existe.');
      }
    } catch (err) {
      setError('Une erreur est survenue');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Audit Up</h1>
          <p className="text-slate-400">Calendrier de gestion</p>
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

        {/* Formulaire Connexion */}
        {authPage === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-700 text-white pl-10 pr-4 py-3 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
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
                  className="w-full bg-slate-700 text-white pl-10 pr-4 py-3 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
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
                className="text-purple-400 hover:text-purple-300"
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
        {authPage === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-700 text-white pl-10 pr-4 py-3 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
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
                  className="w-full bg-slate-700 text-white pl-10 pr-4 py-3 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
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
                  className="w-full bg-slate-700 text-white pl-10 pr-4 py-3 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
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
        {authPage === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-700 text-white pl-10 pr-4 py-3 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
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
      </div>
    </div>
  );
}

