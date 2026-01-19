import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AuthPage from './AuthPage';

// Mock Supabase
vi.mock('../../supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      verifyOtp: vi.fn(),
      updateUser: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
  },
}));

const mockAccent = {
  id: 'pink',
  name: 'Rose',
  color: 'bg-pink-600',
  hover: 'hover:bg-pink-700',
  text: 'text-pink-400',
  ring: 'ring-pink-500',
};

describe('AuthPage', () => {
  const mockSetAuthPage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Page de connexion', () => {
    it('affiche le formulaire de connexion avec les champs email et mot de passe', () => {
      render(
        <AuthPage
          authPage="login"
          setAuthPage={mockSetAuthPage}
          accent={mockAccent}
        />
      );

      expect(screen.getByPlaceholderText('votre@email.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    });

    it('affiche le bouton Se connecter', () => {
      render(
        <AuthPage
          authPage="login"
          setAuthPage={mockSetAuthPage}
          accent={mockAccent}
        />
      );

      expect(screen.getByText('Se connecter')).toBeInTheDocument();
    });

    it('affiche le lien vers inscription', () => {
      render(
        <AuthPage
          authPage="login"
          setAuthPage={mockSetAuthPage}
          accent={mockAccent}
        />
      );

      expect(screen.getByText('Créer un compte')).toBeInTheDocument();
    });

    it('affiche le lien mot de passe oublié', () => {
      render(
        <AuthPage
          authPage="login"
          setAuthPage={mockSetAuthPage}
          accent={mockAccent}
        />
      );

      expect(screen.getByText('Mot de passe oublié ?')).toBeInTheDocument();
    });

    it('permet de saisir email et mot de passe', () => {
      render(
        <AuthPage
          authPage="login"
          setAuthPage={mockSetAuthPage}
          accent={mockAccent}
        />
      );

      const emailInput = screen.getByPlaceholderText('votre@email.com');
      const passwordInput = screen.getByPlaceholderText('••••••••');

      fireEvent.change(emailInput, { target: { value: 'test@test.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      expect(emailInput).toHaveValue('test@test.com');
      expect(passwordInput).toHaveValue('password123');
    });

    it('appelle setAuthPage quand on clique sur Créer un compte', () => {
      render(
        <AuthPage
          authPage="login"
          setAuthPage={mockSetAuthPage}
          accent={mockAccent}
        />
      );

      fireEvent.click(screen.getByText('Créer un compte'));
      expect(mockSetAuthPage).toHaveBeenCalledWith('register');
    });

    it('appelle setAuthPage quand on clique sur Mot de passe oublié', () => {
      render(
        <AuthPage
          authPage="login"
          setAuthPage={mockSetAuthPage}
          accent={mockAccent}
        />
      );

      fireEvent.click(screen.getByText('Mot de passe oublié ?'));
      expect(mockSetAuthPage).toHaveBeenCalledWith('forgot');
    });
  });

  describe('Page d\'inscription', () => {
    it('affiche le formulaire d\'inscription avec email', () => {
      render(
        <AuthPage
          authPage="register"
          setAuthPage={mockSetAuthPage}
          accent={mockAccent}
        />
      );

      expect(screen.getByPlaceholderText('votre@email.com')).toBeInTheDocument();
    });

    it('affiche deux champs mot de passe (mot de passe + confirmation)', () => {
      render(
        <AuthPage
          authPage="register"
          setAuthPage={mockSetAuthPage}
          accent={mockAccent}
        />
      );

      const passwordInputs = screen.getAllByPlaceholderText('••••••••');
      expect(passwordInputs.length).toBe(2);
    });

    it('affiche le lien vers connexion', () => {
      render(
        <AuthPage
          authPage="register"
          setAuthPage={mockSetAuthPage}
          accent={mockAccent}
        />
      );

      expect(screen.getByText(/déjà un compte/i)).toBeInTheDocument();
    });
  });

  describe('Page mot de passe oublié', () => {
    it('affiche le formulaire de réinitialisation avec email', () => {
      render(
        <AuthPage
          authPage="forgot"
          setAuthPage={mockSetAuthPage}
          accent={mockAccent}
        />
      );

      expect(screen.getByPlaceholderText('votre@email.com')).toBeInTheDocument();
      expect(screen.getByText('Retour à la connexion')).toBeInTheDocument();
    });

    it('affiche le lien retour connexion', () => {
      render(
        <AuthPage
          authPage="forgot"
          setAuthPage={mockSetAuthPage}
          accent={mockAccent}
        />
      );

      expect(screen.getByText('Retour à la connexion')).toBeInTheDocument();
    });
  });

  describe('Branding', () => {
    it('affiche le slogan Powered by AUDIT UP', () => {
      render(
        <AuthPage
          authPage="login"
          setAuthPage={mockSetAuthPage}
          accent={mockAccent}
        />
      );

      expect(screen.getByText('Powered by')).toBeInTheDocument();
      expect(screen.getByText('AUDIT UP')).toBeInTheDocument();
    });
  });
});
