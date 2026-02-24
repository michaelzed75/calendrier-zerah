// @ts-check
import React, { useState, useEffect } from 'react';
import { LogIn, UserPlus, Mail, Lock, AlertCircle } from 'lucide-react';
import { supabase } from '../../supabaseClient';

/**
 * @typedef {import('../../types.js').AccentColor} AccentColor
 * @typedef {import('../../types.js').AuthPageProps} AuthPageProps
 */

/**
 * Page d'authentification (connexion, inscription, mot de passe oublié)
 * @param {AuthPageProps} props
 * @returns {JSX.Element}
 */
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
              <p className="text-white text-sm">Entrez le code reçu par email et votre nouveau mot de passe</p>
            </div>
            <div>
              <label className="block text-white text-sm font-medium mb-2">Code de vérification</label>
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
              <label className="block text-white text-sm font-medium mb-2">Nouveau mot de passe</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white" />
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
              <label className="block text-white text-sm font-medium mb-2">Confirmer le mot de passe</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white" />
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
              className="w-full text-white hover:text-white text-sm"
            >
              Annuler
            </button>
          </form>
        )}

        {/* Formulaire Connexion */}
        {authPage === 'login' && !showOtpForm && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-white text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white" />
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
              <label className="block text-white text-sm font-medium mb-2">Mot de passe</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white" />
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
                className="text-white hover:text-white"
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
              <label className="block text-white text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-700 text-white pl-10 pr-4 py-3 rounded-lg border border-slate-600 focus:border-pink-500 focus:outline-none"
                  placeholder="votre@email.com"
                  required
                />
              </div>
              <p className="text-xs text-white mt-1">Utilisez l'email fourni par votre administrateur</p>
            </div>
            <div>
              <label className="block text-white text-sm font-medium mb-2">Mot de passe</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white" />
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
              <label className="block text-white text-sm font-medium mb-2">Confirmer le mot de passe</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white" />
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
              className="w-full text-white hover:text-white text-sm"
            >
              Déjà un compte ? Se connecter
            </button>
          </form>
        )}

        {/* Formulaire Mot de passe oublié */}
        {authPage === 'forgot' && !showOtpForm && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-white text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white" />
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
              className="w-full text-white hover:text-white text-sm"
            >
              Retour à la connexion
            </button>
          </form>
        )}

        {/* Footer - Powered by */}
        <div className="mt-8 pt-6 border-t border-slate-700 text-center">
          <p className="text-white text-xs">Powered by</p>
          <p className="text-white font-semibold">AUDIT UP</p>
        </div>
      </div>
    </div>
  );
}

export default AuthPage;
