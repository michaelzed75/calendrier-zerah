import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ThemeModal from './ThemeModal';

// Mock fetch pour Unsplash
global.fetch = vi.fn();

describe('ThemeModal', () => {
  const mockOnClose = vi.fn();
  const mockSetBackgroundTheme = vi.fn();
  const mockSetAccentColor = vi.fn();

  const defaultProps = {
    onClose: mockOnClose,
    backgroundTheme: { type: 'gradient', value: 'aurora' },
    setBackgroundTheme: mockSetBackgroundTheme,
    accentColor: 'pink',
    setAccentColor: mockSetAccentColor,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendu initial', () => {
    it('affiche le titre de la modale', () => {
      render(<ThemeModal {...defaultProps} />);
      expect(screen.getByText('Personnaliser le fond')).toBeInTheDocument();
    });

    it('affiche le bouton de fermeture', () => {
      render(<ThemeModal {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('affiche les onglets Dégradés et Photos Unsplash', () => {
      render(<ThemeModal {...defaultProps} />);
      expect(screen.getByText('Dégradés')).toBeInTheDocument();
      expect(screen.getByText('Photos Unsplash')).toBeInTheDocument();
    });

    it('affiche la section Couleur d\'accent', () => {
      render(<ThemeModal {...defaultProps} />);
      expect(screen.getByText("Couleur d'accent")).toBeInTheDocument();
    });
  });

  describe('Onglet Dégradés', () => {
    it('affiche les thèmes dégradés disponibles', () => {
      render(<ThemeModal {...defaultProps} />);

      expect(screen.getByText('Défaut')).toBeInTheDocument();
      expect(screen.getByText('Océan')).toBeInTheDocument();
      expect(screen.getByText('Forêt')).toBeInTheDocument();
    });

    it('appelle setBackgroundTheme quand on clique sur un dégradé', () => {
      render(<ThemeModal {...defaultProps} />);

      const oceanButton = screen.getByText('Océan').closest('button');
      fireEvent.click(oceanButton);

      expect(mockSetBackgroundTheme).toHaveBeenCalledWith({
        type: 'gradient',
        value: 'ocean',
      });
    });
  });

  describe('Couleurs d\'accent', () => {
    it('affiche les boutons de couleurs avec les titres', () => {
      render(<ThemeModal {...defaultProps} />);

      // Les noms de couleurs sont dans les attributs title des boutons
      const buttons = screen.getAllByRole('button');
      const colorButtons = buttons.filter(btn => btn.hasAttribute('title'));
      expect(colorButtons.length).toBeGreaterThan(0);
    });

    it('appelle setAccentColor quand on clique sur une couleur', () => {
      render(<ThemeModal {...defaultProps} />);

      // Trouve un bouton de couleur par son titre
      const blueButton = screen.getByTitle('Bleu');
      fireEvent.click(blueButton);

      expect(mockSetAccentColor).toHaveBeenCalledWith('blue');
    });
  });

  describe('Fermeture', () => {
    it('appelle onClose quand on clique sur le bouton X', () => {
      render(<ThemeModal {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      // Le bouton X est le premier bouton dans le header (avant les onglets)
      const closeButton = buttons[0];

      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Navigation onglets', () => {
    it('change d\'onglet quand on clique sur Photos Unsplash', () => {
      render(<ThemeModal {...defaultProps} />);

      const photosTab = screen.getByText('Photos Unsplash');
      fireEvent.click(photosTab);

      // Après clic, l'onglet Photos devrait être actif
      // Les catégories Unsplash apparaissent
      expect(screen.getByText('Nature')).toBeInTheDocument();
      expect(screen.getByText('Minimaliste')).toBeInTheDocument();
    });
  });
});
