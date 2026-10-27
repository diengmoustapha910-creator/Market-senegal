import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { apiFetch } from '../api/client.js';
import type { User } from '../types/index.js';
import { ShieldCheck, Lock, Mail, AlertTriangle, KeyRound, ArrowLeft, CheckCircle2, RefreshCw } from 'lucide-react';

export const AdminLoginView: React.FC = () => {
  const { login, navigate, showToast } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  // First login password setup state
  const [firstLoginPending, setFirstLoginPending] = useState(false);
  const [firstLoginNewPassword, setFirstLoginNewPassword] = useState('');
  const [firstLoginConfirmPassword, setFirstLoginConfirmPassword] = useState('');
  const [tempToken, setTempToken] = useState<string | null>(null);

  // Recovery mode state
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'reset'>('request');
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);

  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('reset_token') || params.get('token');
      if (urlToken) {
        setShowRecovery(true);
        setRecoveryToken(urlToken);
        setRecoveryStep('reset');
        setRecoverySuccess('Jeton de sécurité détecté. Vous pouvez saisir votre nouveau mot de passe administrateur.');
      }
    } catch {
      // Ignored
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await apiFetch<{
        success: boolean;
        user: User;
        token: string;
        must_change_password?: boolean;
      }>('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password })
      });

      // Always authenticate token for subsequent API calls
      login(res.token, res.user);

      // Force first-login password change if required
      if (res.must_change_password || res.user.must_change_password) {
        setTempToken(res.token);
        setFirstLoginPending(true);
        showToast('Première connexion détectée. Veuillez définir votre mot de passe personnel.', 'info');
        return;
      }

      showToast('Authentification administrateur réussie.', 'success');
      navigate('admin-dashboard');
    } catch (err: any) {
      const msg = err.message || 'Échec de l’authentification.';
      setErrorMessage(msg);
      if (err.attemptsRemaining !== undefined) {
        setAttemptsRemaining(err.attemptsRemaining);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFirstLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (firstLoginNewPassword.length < 8) {
      setErrorMessage('Le mot de passe doit comporter au moins 8 caractères.');
      return;
    }
    if (firstLoginNewPassword !== firstLoginConfirmPassword) {
      setErrorMessage('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<{ success: boolean; message: string; user: User }>(
        '/admin/first-login-password',
        {
          method: 'POST',
          body: JSON.stringify({ new_password: firstLoginNewPassword })
        }
      );

      if (tempToken) {
        login(tempToken, res.user);
      }
      showToast(res.message || 'Votre mot de passe personnel a été enregistré avec succès.', 'success');
      navigate('admin-dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la configuration du mot de passe.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiFetch<{ success: boolean; message: string; recovery_token?: string }>(
        '/admin/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ email: recoveryEmail })
        }
      );

      if (res.recovery_token) {
        setRecoveryToken(res.recovery_token);
        setRecoverySuccess('Jeton de récupération de sécurité généré (valable 30 min). Saisissez votre nouveau mot de passe ci-dessous.');
        setRecoveryStep('reset');
      } else {
        setRecoverySuccess(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la demande de réinitialisation.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiFetch<{ success: boolean; message: string }>(
        '/admin/reset-password',
        {
          method: 'POST',
          body: JSON.stringify({ token: recoveryToken, new_password: newPassword })
        }
      );

      showToast(res.message, 'success');
      setShowRecovery(false);
      setRecoveryStep('request');
      setPassword('');
      setRecoverySuccess(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Échec de la réinitialisation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-950 text-slate-100">
      <div className="max-w-md w-full space-y-8 bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle top security accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-amber-500 to-orange-500" />

        {/* Back to marketplace */}
        <button
          onClick={() => navigate('home')}
          className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Retour au grand marché
        </button>

        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 mx-auto bg-slate-800/80 border border-slate-700 rounded-2xl flex items-center justify-center text-amber-400 shadow-inner mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white uppercase">
            Espace Administration
          </h2>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            Portail dédié et restreint à la direction de <span className="text-amber-400 font-semibold">MARKET SÉNÉGAL</span>.
            Contrôle d'accès et sécurité renforcée.
          </p>
        </div>

        {/* Error notification banner */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">{errorMessage}</p>
              {attemptsRemaining !== null && attemptsRemaining < 5 && (
                <p className="text-[11px] text-rose-300">
                  Tentatives autorisées restantes : <span className="font-bold">{attemptsRemaining}</span>. Au-delà, l'adresse IP et le compte seront bloqués 15 minutes.
                </p>
              )}
            </div>
          </div>
        )}

        {/* First Login Password Setup Form */}
        {firstLoginPending ? (
          <form className="mt-8 space-y-5" onSubmit={handleFirstLoginSubmit}>
            <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-800/80 text-amber-200 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-300">
                <KeyRound className="w-4 h-4 text-amber-400" />
                Première connexion détectée
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Le mot de passe initial fourni doit être remplacé par votre propre mot de passe administrateur personnel avant d'accéder au tableau de bord.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Nouveau mot de passe administrateur <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={firstLoginNewPassword}
                  onChange={(e) => setFirstLoginNewPassword(e.target.value)}
                  placeholder="Minimum 8 caractères"
                  className="block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-xl bg-slate-800/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Confirmer le nouveau mot de passe <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={firstLoginConfirmPassword}
                  onChange={(e) => setFirstLoginConfirmPassword(e.target.value)}
                  placeholder="Répétez le mot de passe"
                  className="block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-xl bg-slate-800/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 space-y-1">
              <span className="font-semibold text-slate-300 block">Exigences de sécurité :</span>
              <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                <li>Minimum 8 caractères</li>
                <li>Seule l'empreinte sécurisée (PBKDF2-SHA512) sera stockée</li>
                <li>Toutes les autres sessions actives seront invalidées</li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Sécurisation du compte en cours...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Valider mon mot de passe et continuer
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setFirstLoginPending(false);
                setFirstLoginNewPassword('');
                setFirstLoginConfirmPassword('');
                setPassword('');
              }}
              className="w-full text-center text-xs text-slate-400 hover:text-white pt-2"
            >
              Annuler et revenir à la connexion
            </button>
          </form>
        ) : !showRecovery ? (
          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Adresse e-mail
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@domaine.sn"
                  className="block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-xl bg-slate-800/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-xl bg-slate-800/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-400" /> Session chiffrée
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowRecovery(true);
                  setErrorMessage(null);
                }}
                className="text-amber-400 hover:text-amber-300 font-medium transition-colors"
              >
                Procédure de récupération
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Vérification des accréditations...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Connexion sécurisée
                </>
              )}
            </button>

            <div className="pt-4 border-t border-slate-800 text-center">
              <p className="text-[11px] text-slate-500">
                L'inscription publique au rôle administrateur est strictement désactivée.
              </p>
            </div>
          </form>
        ) : (
          /* Password Recovery Procedure Form */
          <div className="mt-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <KeyRound className="w-4 h-4" />
                Récupération sécurisée administrateur
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowRecovery(false);
                  setErrorMessage(null);
                  setRecoverySuccess(null);
                }}
                className="text-xs text-slate-400 hover:text-white"
              >
                Annuler
              </button>
            </div>

            {recoverySuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <span>{recoverySuccess}</span>
              </div>
            )}

            {recoveryStep === 'request' ? (
              <form onSubmit={handleRequestRecovery} className="space-y-4">
                <p className="text-xs text-slate-400">
                  Entrez votre adresse e-mail pour initier une réinitialisation de mot de passe sécurisée.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Adresse e-mail
                  </label>
                  <input
                    type="email"
                    required
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="nom@domaine.sn"
                    className="w-full p-3 border border-slate-700 rounded-xl bg-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  Générer le jeton de sécurité
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Jeton de sécurité (Token)
                  </label>
                  <input
                    type="text"
                    required
                    value={recoveryToken}
                    onChange={(e) => setRecoveryToken(e.target.value)}
                    placeholder="Jeton de 64 caractères hexadécimaux"
                    className="w-full p-3 font-mono text-xs border border-slate-700 rounded-xl bg-slate-800 text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nouveau mot de passe administrateur (min. 8 caractères)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full p-3 border border-slate-700 rounded-xl bg-slate-800 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-bold text-xs bg-emerald-500 hover:bg-emerald-600 text-slate-950 transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  Mettre à jour le mot de passe administrateur
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
