import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, Store } from '../types/index.js';
import { apiFetch, getStoredToken, setStoredToken } from '../api/client.js';

export type ViewType =
  | 'home'
  | 'search'
  | 'product'
  | 'store'
  | 'cart'
  | 'client-dashboard'
  | 'vendor-dashboard'
  | 'admin-dashboard'
  | 'admin-login'
  | 'pricing'
  | 'help'
  | 'contact'
  | 'terms'
  | 'privacy';

interface AuthContextType {
  user: User | null;
  store: Store | null;
  loading: boolean;
  currentView: ViewType;
  viewParams: Record<string, any>;
  navigate: (view: ViewType, params?: Record<string, any>) => void;
  authModalOpen: boolean;
  authModalTab: 'login' | 'register' | 'forgot' | 'reset';
  authResetToken: string;
  setAuthResetToken: (token: string) => void;
  openAuth: (
    tab?: 'login' | 'register' | 'forgot' | 'reset',
    redirectTarget?: 'messages' | { view: ViewType; params?: Record<string, any> },
    resetToken?: string
  ) => void;
  closeAuth: () => void;
  login: (token: string, user: User, store?: Store) => void;
  logout: () => Promise<void>;
  appUrl: string;
  getStorePublicUrl: (storeObj: { slug?: string; id: string }) => string;
  getProductPublicUrl: (productId: string) => string;
  unreadMessagesCount: number;
  refreshUnreadMessagesCount: () => Promise<void>;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [viewParams, setViewParams] = useState<Record<string, any>>({});

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [authResetToken, setAuthResetToken] = useState<string>('');
  const [authRedirect, setAuthRedirect] = useState<'messages' | { view: ViewType; params?: Record<string, any> } | null>(null);

  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 4000);
  };

  const [appUrl, setAppUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.origin.replace(/\/+$/, '');
    }
    return 'https://marketsenegal.sn';
  });

  const getStorePublicUrl = (storeObj: { slug?: string; id: string }): string => {
    const slugOrId = storeObj.slug || storeObj.id;
    return `${appUrl}/boutique/${slugOrId}`;
  };

  const getProductPublicUrl = (productId: string): string => {
    return `${appUrl}/produit/${productId}`;
  };

  const navigate = (view: ViewType, params: Record<string, any> = {}) => {
    setCurrentView(view);
    setViewParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Synchroniser la barre d'adresse du navigateur (liens stables directs & boutons précédent/suivant)
    try {
      let targetPath = '/';
      if (view === 'store') {
        const slug = params.slug || params.storeId || params.id;
        targetPath = slug ? `/boutique/${slug}` : '/';
      } else if (view === 'product') {
        const id = params.id || params.productId;
        targetPath = id ? `/produit/${id}` : '/';
      } else if (view === 'vendor-dashboard') {
        targetPath = params.tab ? `/espace-vendeur?tab=${params.tab}` : '/espace-vendeur';
      } else if (view === 'client-dashboard') {
        targetPath = params.tab ? `/mon-compte?tab=${params.tab}` : '/mon-compte';
      } else if (view === 'cart') {
        targetPath = '/panier';
      } else if (view === 'admin-login') {
        targetPath = '/admin-login';
      } else if (view !== 'home') {
        targetPath = `/${view}`;
      }

      if (window.location.pathname + window.location.search !== targetPath) {
        window.history.pushState({ view, params }, '', targetPath);
      }
    } catch {
      // Ignored
    }
  };

  const openAuth = (
    tab: 'login' | 'register' | 'forgot' | 'reset' = 'login',
    redirectTarget?: 'messages' | { view: ViewType; params?: Record<string, any> },
    resetToken?: string
  ) => {
    setAuthModalTab(tab);
    if (resetToken !== undefined) {
      setAuthResetToken(resetToken);
    }
    if (redirectTarget) {
      setAuthRedirect(redirectTarget);
    }
    setAuthModalOpen(true);
  };

  const closeAuth = () => {
    setAuthModalOpen(false);
  };

  const refreshUnreadMessagesCount = async () => {
    const token = getStoredToken();
    if (!token) {
      setUnreadMessagesCount(0);
      return;
    }
    try {
      const res = await apiFetch<{ unread_count: number }>('/conversations/unread-count');
      setUnreadMessagesCount(typeof res.unread_count === 'number' ? res.unread_count : 0);
    } catch {
      // Ignored
    }
  };

  const refreshUser = async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setStore(null);
      setUnreadMessagesCount(0);
      setLoading(false);
      return;
    }
    try {
      const res = await apiFetch<{ user: User; store: Store | null }>('/auth/me');
      setUser(res.user);
      setStore(res.store || null);
      refreshUnreadMessagesCount();
    } catch {
      setStoredToken(null);
      setUser(null);
      setStore(null);
      setUnreadMessagesCount(0);
    } finally {
      setLoading(false);
    }
  };

  const parseLocation = () => {
    try {
      const pathname = window.location.pathname;
      const params = new URLSearchParams(window.location.search);

      if (pathname.startsWith('/boutique/')) {
        const slug = decodeURIComponent(pathname.replace('/boutique/', '').split('/')[0].split('?')[0]);
        if (slug) {
          setCurrentView('store');
          setViewParams({ slug, storeId: slug });
          return;
        }
      } else if (params.get('store')) {
        const slug = params.get('store')!;
        setCurrentView('store');
        setViewParams({ slug, storeId: slug });
        return;
      }

      if (pathname.startsWith('/produit/')) {
        const id = decodeURIComponent(pathname.replace('/produit/', '').split('/')[0].split('?')[0]);
        if (id) {
          setCurrentView('product');
          setViewParams({ id, productId: id });
          return;
        }
      } else if (params.get('product')) {
        const id = params.get('product')!;
        setCurrentView('product');
        setViewParams({ id, productId: id });
        return;
      }

      if (pathname === '/espace-vendeur' || pathname.startsWith('/espace-vendeur/')) {
        setCurrentView('vendor-dashboard');
        const tab = params.get('tab');
        if (tab) setViewParams({ tab });
        return;
      }

      if (pathname === '/mon-compte' || pathname.startsWith('/mon-compte/')) {
        setCurrentView('client-dashboard');
        const tab = params.get('tab');
        if (tab) setViewParams({ tab });
        return;
      }

      if (pathname === '/panier') {
        setCurrentView('cart');
        return;
      }

      if (pathname === '/admin-login' || pathname === '/connexion-admin') {
        setCurrentView('admin-login');
        return;
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    // 1. Fetch public configuration (canonical APP_URL)
    apiFetch<{ appUrl?: string }>('/public-config')
      .then((cfg) => {
        if (cfg && cfg.appUrl) {
          setAppUrl(cfg.appUrl.replace(/\/+$/, ''));
        }
      })
      .catch(() => {});

    // 2. Parse current URL location for deep-linking
    parseLocation();

    // 3. Handle browser back/forward buttons
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.view) {
        setCurrentView(e.state.view);
        setViewParams(e.state.params || {});
      } else {
        parseLocation();
      }
    };
    window.addEventListener('popstate', handlePopState);

    // 4. Detect query parameters on startup (Google OAuth callback, reset tokens)
    try {
      const params = new URLSearchParams(window.location.search);
      const authToken = params.get('auth_token');
      const googleError = params.get('google_error');
      const urlToken = params.get('reset_token') || params.get('token');
      const emailVerified = params.get('email_verified');
      const emailVerifyError = params.get('email_verify_error');

      if (emailVerified) {
        const cleanPath = window.location.pathname;
        window.history.replaceState({}, document.title, cleanPath);
        showToast('Votre adresse e-mail a été confirmée avec succès !', 'success');
      }

      if (emailVerifyError) {
        const cleanPath = window.location.pathname;
        window.history.replaceState({}, document.title, cleanPath);
        showToast('Ce lien de confirmation d’e-mail est invalide ou a expiré.', 'error');
      }

      if (authToken) {
        setStoredToken(authToken);
        const cleanPath = window.location.pathname;
        window.history.replaceState({}, document.title, cleanPath);
        refreshUser().then(() => {
          showToast('Connexion avec Google réussie ! Bienvenue sur MARKET SÉNÉGAL.', 'success');
        });
        return;
      }

      if (googleError) {
        const cleanPath = window.location.pathname;
        window.history.replaceState({}, document.title, cleanPath);
        showToast(`Échec d’authentification Google : ${googleError}`, 'error');
      }

      if (urlToken) {
        openAuth('reset', undefined, urlToken);
      }
    } catch {
      // Ignored
    }
    refreshUser();

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setUnreadMessagesCount(0);
      return;
    }
    refreshUnreadMessagesCount();
    const interval = setInterval(refreshUnreadMessagesCount, 25000);
    const onFocus = () => refreshUnreadMessagesCount();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [user]);

  const login = async (token: string, loggedUser: User, loggedStore?: Store) => {
    setStoredToken(token);
    setUser(loggedUser);
    let resolvedStore = loggedStore || null;
    if (!resolvedStore) {
      try {
        const res = await apiFetch<{ user: User; store: Store | null }>('/auth/me');
        if (res.store) {
          resolvedStore = res.store;
          setStore(res.store);
        }
      } catch {
        // Ignored
      }
    } else {
      setStore(resolvedStore);
    }
    setAuthModalOpen(false);
    showToast(`Bienvenue, ${loggedUser.full_name} !`, 'success');

    // Post-login redirection
    if (authRedirect) {
      const intent = authRedirect;
      setAuthRedirect(null);
      if (intent === 'messages') {
        const isVendor = Boolean(resolvedStore || loggedUser.role === 'vendeur' || (loggedUser.role as any) === 'vendor');
        const targetView: ViewType = isVendor ? 'vendor-dashboard' : 'client-dashboard';
        navigate(targetView, { tab: 'messages' });
      } else if (typeof intent === 'object' && intent.view) {
        navigate(intent.view, intent.params);
      }
    }

    refreshUnreadMessagesCount();
  };

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Ignored
    }
    setStoredToken(null);
    setUser(null);
    setStore(null);
    setUnreadMessagesCount(0);
    setAuthRedirect(null);
    navigate('home');
    showToast('Vous êtes déconnecté.', 'info');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        store,
        loading,
        currentView,
        viewParams,
        navigate,
        authModalOpen,
        authModalTab,
        authResetToken,
        setAuthResetToken,
        openAuth,
        closeAuth,
        login,
        logout,
        refreshUser,
        appUrl,
        getStorePublicUrl,
        getProductPublicUrl,
        unreadMessagesCount,
        refreshUnreadMessagesCount,
        toast,
        showToast
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
