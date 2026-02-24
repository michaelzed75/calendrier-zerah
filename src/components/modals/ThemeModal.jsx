// @ts-check
import React, { useState } from 'react';
import { Palette, X, Check, Image, RefreshCw } from 'lucide-react';
import { GRADIENT_THEMES, ACCENT_COLORS, UNSPLASH_CATEGORIES, UNSPLASH_ACCESS_KEY } from '../../constants/theme';

/**
 * @typedef {import('../../types.js').ThemeModalProps} ThemeModalProps
 * @typedef {import('../../types.js').BackgroundTheme} BackgroundTheme
 * @typedef {import('../../types.js').GradientTheme} GradientTheme
 * @typedef {import('../../types.js').UnsplashCategory} UnsplashCategory
 */

/**
 * Modal de personnalisation du thème (fond et couleur d'accent)
 * @param {ThemeModalProps} props
 * @returns {JSX.Element}
 */
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
            className="text-white hover:text-white p-2 rounded-lg hover:bg-slate-700 transition"
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
                : 'text-white hover:text-white'
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
                : 'text-white hover:text-white'
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
                <p className="text-white text-sm mt-2">
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
                        : 'bg-slate-700 text-white hover:bg-slate-600'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
                {selectedCategory && (
                  <button
                    onClick={refreshPhotos}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 text-white hover:bg-slate-600 transition flex items-center gap-2"
                    disabled={loadingPhotos}
                  >
                    <RefreshCw size={16} className={loadingPhotos ? 'animate-spin' : ''} />
                    Autres photos
                  </button>
                )}
              </div>

              {/* Photos */}
              {!selectedCategory && (
                <div className="text-center text-white py-12">
                  <Image size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Sélectionnez une catégorie pour voir les photos</p>
                </div>
              )}

              {loadingPhotos && (
                <div className="text-center text-white py-12">
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
                <div className="text-center text-white py-12">
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

export default ThemeModal;
