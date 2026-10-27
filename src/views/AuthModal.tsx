import React, { useState, useEffect } from 'react';
import { X, Lock, Mail, User, Phone, CheckCircle, AlertCircle, KeyRound, ShieldCheck, ArrowRight, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { apiFetch } from '../api/client.js';

export const AuthModal: React.FC = () => {
  const { authModalOpen, authModalTab, authResetToken, closeAuth, login, showToast } = useAuth();
  const [tab, setTab] = useState<'login' | 'register' | 'forgot' | 'reset'>(authModalTab);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  
  // Password reset states
  const [resetToken, setResetToken] = useState(authResetToken || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [unconfiguredInfo, setUnconfiguredInfo] = useState<{
    missingConfig: string[];
    devToken?: string;
    devUrl?: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleConfigError, setGoogleConfigError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync tab and resetToken when opening
  useEffect(() => {
    setTab(authModalTab);
    if (authResetToken) {
      setResetToken(authResetToken);
    }
    setError(null);
    setSuccessMsg(null);
    setUnconfiguredInfo(null);
    setGoogleConfigError(null);
  }, [authModalTab, authModalOpen, authResetToken]);

  const handleGoogleAuth = async () => {
    setGoogleLoading(true);
    setGoogleConfigError(null);
    setError(null);
    try {
      const res = await apiFetch<{ configured: boolean; url?: string; error?: string }>('/auth/google/url');
      if (res.configured && res.url) {
        window.location.href = res.url;
      } else {
        setGoogleConfigError(res.error || 'La connexion avec Google n’est pas encore configurée côté serveur (variables GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET manquantes).');
      }
    } catch (err: any) {
      setGoogleConfigError(err.message || 'La connexion avec Google nécessite la configuration des identifiants Google OAuth sur Cloud Run.');
    } finally {
      setGoogleLoading(false);
    }
  };

  if (!authModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (tab === 'login') {
        const res = await apiFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        login(res.token, res.user, res.store);
        closeAuth();
      } else if (tab === 'register') {
        const res = await apiFetch('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email, password, full_name: fullName, phone })
        });
        login(res.token, res.user, res.store);
        closeAuth();
      } else if (tab === 'forgot') {
        const res = await apiFetch<{
          success: boolean;
          email_configured: boolean;
          message: string;
          missing_config?: string[];
          dev_reset_token?: string;
          dev_reset_url?: string;
        }>('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email })
        });

        if (res.email_configured === false) {
          setUnconfiguredInfo({
            missingConfig: res.missing_config || ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'],
            devToken: res.dev_reset_token,
            devUrl: res.dev_reset_url
          });
          setSuccessMsg(res.message);
        } else {
          setSuccessMsg(res.message);
          showToast(res.message, 'success');
        }
      } else if (tab === 'reset') {
        if (!resetToken.trim()) {
          throw new Error('Le jeton de réinitialisation est requis.');
        }
        if (newPassword.length < 6) {
          throw new Error('Le nouveau mot de passe doit comporter au moins 6 caractères.');
        }
        if (newPassword !== confirmPassword) {
          throw new Error('Les deux mots de passe saisis ne sont pas identiques.');
        }

        const res = await apiFetch<{
          success: boolean;
          message: string;
          user: any;
          store?: any;
          token: string;
        }>('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({
            token: resetToken.trim(),
            new_password: newPassword
          })
        });

        showToast(res.message, 'success');
        // Auto-login with the newly set password
        login(res.token, res.user, res.store);
        closeAuth();
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header modal */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/assets/aistudio/a_clean_professional_vector_logo_graphic_on_a_whi_98efa245.png"
              alt="Logo Market Sénégal"
              className="h-8 w-auto object-contain"
            />
          </div>
          <button
            onClick={closeAuth}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switchers */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold">
          <button
            type="button"
            onClick={() => { setTab('login'); setError(null); setSuccessMsg(null); }}
            className={`py-2 rounded-lg transition-all cursor-pointer ${tab === 'login' || tab === 'forgot' || tab === 'reset' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {tab === 'reset' ? 'Réinitialisation' : tab === 'forgot' ? 'Mot de passe oublié' : 'Connexion'}
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setError(null); setSuccessMsg(null); }}
            className={`py-2 rounded-lg transition-all cursor-pointer ${tab === 'register' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Créer un compte
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Google OAuth Button for Clients */}
          {(tab === 'login' || tab === 'register') && (
            <div className="space-y-3 pb-1">
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={googleLoading}
                className="w-full py-2.5 px-4 border border-slate-300 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs transition-all flex items-center justify-center gap-2.5 shadow-2xs cursor-pointer disabled:opacity-50 active:scale-[0.99]"
              >
                {googleLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                )}
                <span>
                  {tab === 'register' ? 'S’inscrire avec Google (Client)' : 'Continuer avec Google'}
                </span>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-2.5 text-[10px] uppercase font-bold text-slate-400 absolute">
                  ou par e-mail
                </span>
              </div>
            </div>
          )}

          {/* Diagnostic Google Unconfigured */}
          {googleConfigError && (
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 text-xs space-y-1.5">
              <div className="flex items-start gap-2 font-bold text-blue-900">
                <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>Configuration Google OAuth requise</span>
              </div>
              <p className="text-[11px] leading-relaxed text-blue-800">
                {googleConfigError}
              </p>
              <div className="text-[10px] text-blue-700 bg-blue-100/60 p-2 rounded-lg font-mono">
                URI de redirection autorisée :<br />
                <code>https://ais-dev-lhrk3jauzs5yp25ycmq2ud-346996706457.europe-west2.run.app/api/auth/google/callback</code>
              </div>
            </div>
          )}

          {/* Unconfigured Email Diagnostic Card */}
          {unconfiguredInfo && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-3">
              <div className="flex items-start gap-2 font-bold text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Fournisseur d'e-mails non configuré sur le serveur</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800">
                Les variables d'environnement SMTP (<strong>{unconfiguredInfo.missingConfig.join(', ')}</strong>) ne sont pas encore définies côté serveur. Aucun e-mail réel n'a donc été expédié.
              </p>
              {unconfiguredInfo.devToken && (
                <div className="space-y-2 pt-1 border-t border-amber-200/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block">
                    Mode Développement / Test en direct :
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setResetToken(unconfiguredInfo.devToken!);
                      setTab('reset');
                      setError(null);
                      setSuccessMsg('Jeton de test injecté automatiquement. Vous pouvez définir votre nouveau mot de passe ci-dessous.');
                    }}
                    className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Définir le nouveau mot de passe avec ce jeton</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Registration specific fields */}
          {tab === 'register' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nom complet <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Ex: Fatou Sow ou Amadou Ndiaye"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Numéro de téléphone (Sénégal)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="Ex: +221 77 000 00 00"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}

          {/* Email field for Login, Register, Forgot */}
          {tab !== 'reset' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Adresse e-mail <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="votre-email@domaine.sn"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Password field for Login & Register */}
          {(tab === 'login' || tab === 'register') && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Mot de passe <span className="text-rose-500">*</span>
                </label>
                {tab === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setTab('forgot');
                      setError(null);
                      setSuccessMsg(null);
                      setUnconfiguredInfo(null);
                    }}
                    className="text-xs text-blue-600 hover:underline cursor-pointer"
                  >
                    Mot de passe oublié ?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Instructions for forgot */}
          {tab === 'forgot' && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 leading-relaxed">
                Saisissez l'adresse e-mail associée à votre compte MARKET SÉNÉGAL. Si l'adresse existe, un lien sécurisé de réinitialisation valable 30 minutes sera généré.
              </p>
              <button
                type="button"
                onClick={() => {
                  setTab('reset');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Vous possédez déjà un jeton de réinitialisation ? Cliquez ici.
              </button>
            </div>
          )}

          {/* Reset tab fields */}
          {tab === 'reset' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jeton de réinitialisation sécurisé <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={resetToken}
                    onChange={e => setResetToken(e.target.value)}
                    placeholder="Collez votre jeton de réinitialisation (reçu par e-mail)"
                    className="w-full pl-9 pr-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nouveau mot de passe <span className="text-rose-500">* (min. 6 caractères)</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirmer le nouveau mot de passe <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            ) : null}
            {tab === 'login' && 'Se connecter'}
            {tab === 'register' && 'Créer mon compte client'}
            {tab === 'forgot' && 'Demander le lien de réinitialisation'}
            {tab === 'reset' && 'Enregistrer le nouveau mot de passe'}
          </button>

          {(tab === 'forgot' || tab === 'reset') && (
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setError(null);
                setSuccessMsg(null);
                setUnconfiguredInfo(null);
              }}
              className="w-full text-center text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Retour à la page de connexion
            </button>
          )}

          <div className="pt-2 border-t border-slate-100 text-center text-[11px] text-slate-500">
            En continuant, vous acceptez les Conditions Générales d'Utilisation de MARKET SÉNÉGAL.
          </div>
        </form>

      </div>
    </div>
  );
};
