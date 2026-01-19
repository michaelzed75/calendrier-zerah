// @ts-check

/**
 * @file Configuration des thèmes et couleurs de l'application
 */

/**
 * @typedef {import('../types.js').GradientTheme} GradientTheme
 * @typedef {import('../types.js').AccentColor} AccentColor
 * @typedef {import('../types.js').UnsplashCategory} UnsplashCategory
 */

/**
 * Clé d'accès à l'API Unsplash pour les images de fond
 * @type {string}
 */
export const UNSPLASH_ACCESS_KEY = 'X6rfvR5uCg1PCojlkBuk0xMhTBC2gQDVilj8HOoq95M';

/**
 * Thèmes dégradés prédéfinis pour le fond de l'application
 * @type {GradientTheme[]}
 */
export const GRADIENT_THEMES = [
  { id: 'default', name: 'Défaut', gradient: 'from-slate-900 via-slate-800 to-slate-900' },
  { id: 'ocean', name: 'Océan', gradient: 'from-blue-900 via-cyan-800 to-blue-900' },
  { id: 'forest', name: 'Forêt', gradient: 'from-green-900 via-emerald-800 to-green-900' },
  { id: 'sunset', name: 'Coucher de soleil', gradient: 'from-orange-900 via-red-800 to-pink-900' },
  { id: 'purple', name: 'Violet', gradient: 'from-purple-900 via-violet-800 to-indigo-900' },
  { id: 'midnight', name: 'Minuit', gradient: 'from-gray-900 via-zinc-900 to-black' },
  { id: 'aurora', name: 'Aurore', gradient: 'from-teal-900 via-purple-800 to-pink-900' },
  { id: 'golden', name: 'Doré', gradient: 'from-amber-900 via-yellow-800 to-orange-900' },
];

/**
 * Couleurs d'accent disponibles pour les boutons et éléments interactifs
 * @type {AccentColor[]}
 */
export const ACCENT_COLORS = [
  { id: 'purple', name: 'Violet', color: 'bg-purple-600', hover: 'hover:bg-purple-700', text: 'text-purple-400', ring: 'ring-purple-500' },
  { id: 'blue', name: 'Bleu', color: 'bg-blue-600', hover: 'hover:bg-blue-700', text: 'text-blue-400', ring: 'ring-blue-500' },
  { id: 'cyan', name: 'Cyan', color: 'bg-cyan-600', hover: 'hover:bg-cyan-700', text: 'text-cyan-400', ring: 'ring-cyan-500' },
  { id: 'emerald', name: 'Vert', color: 'bg-emerald-600', hover: 'hover:bg-emerald-700', text: 'text-emerald-400', ring: 'ring-emerald-500' },
  { id: 'orange', name: 'Orange', color: 'bg-orange-600', hover: 'hover:bg-orange-700', text: 'text-orange-400', ring: 'ring-orange-500' },
  { id: 'pink', name: 'Rose', color: 'bg-pink-600', hover: 'hover:bg-pink-700', text: 'text-pink-400', ring: 'ring-pink-500' },
  { id: 'red', name: 'Rouge', color: 'bg-red-600', hover: 'hover:bg-red-700', text: 'text-red-400', ring: 'ring-red-500' },
  { id: 'amber', name: 'Ambre', color: 'bg-amber-600', hover: 'hover:bg-amber-700', text: 'text-amber-400', ring: 'ring-amber-500' },
];

/**
 * Catégories de recherche Unsplash pour les images de fond
 * @type {UnsplashCategory[]}
 */
export const UNSPLASH_CATEGORIES = [
  { id: 'nature', name: 'Nature', query: 'nature landscape' },
  { id: 'minimal', name: 'Minimaliste', query: 'minimal abstract' },
  { id: 'architecture', name: 'Architecture', query: 'architecture building' },
  { id: 'office', name: 'Bureau', query: 'office workspace desk' },
  { id: 'mountains', name: 'Montagnes', query: 'mountains peaks' },
  { id: 'ocean', name: 'Océan', query: 'ocean sea waves' },
  { id: 'city', name: 'Ville', query: 'city night lights' },
  { id: 'abstract', name: 'Abstrait', query: 'abstract gradient colors' },
];
