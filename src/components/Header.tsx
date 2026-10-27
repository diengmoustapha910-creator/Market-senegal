import React, { useState } from 'react';
import { ShoppingCart, User, Store, ShieldCheck, Menu, X, Search, MessageSquare } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useAuth } from '../context/AuthContext.js';
import { useCart } from '../context/CartContext.js';

export const Header: React.FC = () => {
  const { user, store, currentView, navigate, openAuth, logout, unreadMessagesCount } = useAuth();
  const { totalItemsCount } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const shouldReduceMotion = useReducedMotion();

  const handleOpenMessages = () => {
    if (!user) {
      openAuth('login', 'messages');
    } else if (store || user.role === 'vendeur' || (user.role as any) === 'vendor') {
      navigate('vendor-dashboard', { tab: 'messages' });
    } else {
      navigate('client-dashboard', { tab: 'messages' });
    }
  };

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSearch.trim()) {
      navigate('search', { query: quickSearch.trim() });
      setQuickSearch('');
      setMobileMenuOpen(false);
    }
  };

  const bannerText = 'MARKET SÉNÉGAL — Le grand marché en ligne du Sénégal';
  const tickerItems = Array(6).fill(bannerText);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 transition-colors">
      {/* Top animated continuous ticker banner */}
      <div className="bg-blue-950 border-b border-blue-900 overflow-hidden py-2 select-none">
        {shouldReduceMotion ? (
          <div className="text-center text-xs sm:text-sm font-bold text-orange-400 tracking-wide px-4">
            {bannerText}
          </div>
        ) : (
          <div className="flex w-max overflow-hidden">
            <motion.div
              className="flex items-center shrink-0"
              animate={{ x: ['0%', '-50%'] }}
              transition={{
                ease: 'linear',
                duration: 25,
                repeat: Infinity,
              }}
            >
              {[...tickerItems, ...tickerItems].map((text, idx) => (
                <div key={idx} className="flex items-center shrink-0">
                  <span className="text-xs sm:text-sm font-bold text-orange-400 tracking-wide whitespace-nowrap pl-6">
                    {text}
                  </span>
                  <span className="mx-6 text-orange-500/70 text-xs shrink-0 select-none" aria-hidden="true">
                    ✦
                  </span>
                </div>
              ))}
            </motion.div>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-20">
          
          {/* Zone 1: Single Brand element with official logo */}
          <button
            onClick={() => navigate('home')}
            className="flex items-center gap-3 text-left shrink-0 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg p-1"
          >
            <img
              src="/assets/aistudio/a_clean_professional_vector_logo_graphic_on_a_whi_98efa245.png"
              alt="MARKET SÉNÉGAL Logo"
              className="h-12 w-auto object-contain transition-transform group-hover:scale-105"
            />
          </button>

          {/* Quick Search Input (Desktop) */}
          <form onSubmit={handleQuickSearch} className="hidden lg:flex items-center flex-1 max-w-md relative">
            <input
              type="text"
              value={quickSearch}
              onChange={e => setQuickSearch(e.target.value)}
              placeholder="Rechercher un produit, une marque, un artisan..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-full focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all placeholder:text-slate-400"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
          </form>

          {/* Zone 2: 3 concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              onClick={() => navigate('home')}
              className={`hover:text-blue-700 transition-colors whitespace-nowrap shrink-0 ${currentView === 'home' ? 'text-blue-700 font-semibold' : ''}`}
            >
              Accueil
            </button>
            <button
              onClick={() => navigate('search')}
              className={`hover:text-blue-700 transition-colors whitespace-nowrap shrink-0 ${currentView === 'search' ? 'text-blue-700 font-semibold' : ''}`}
            >
              Tous les produits
            </button>
            <button
              onClick={() => navigate('search', { type: 'stores' })}
              className="hover:text-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              Boutiques
            </button>
          </nav>

          {/* Zone 3: Primary action & cart buttons */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            
            {/* Messages Button (Orange MARKET SÉNÉGAL) */}
            <button
              onClick={handleOpenMessages}
              className="relative inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 active:scale-95 rounded-xl shadow-xs transition-all shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 cursor-pointer"
              title="Messagerie et discussions"
              aria-label="Messages"
            >
              <div className="relative flex items-center justify-center">
                <MessageSquare className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white" />
                {unreadMessagesCount > 0 && (
                  <span className="absolute -top-2.5 -right-2.5 min-w-[18px] h-[18px] px-1 bg-red-600 text-white font-black text-[10px] rounded-full flex items-center justify-center shadow-md border-2 border-white animate-pulse">
                    {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                  </span>
                )}
              </div>
              <span className="font-bold">Messages</span>
            </button>

            {/* Cart Button */}
            <button
              onClick={() => navigate('cart')}
              className="relative p-2.5 text-orange-500 hover:text-orange-600 hover:bg-orange-50 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              title="Mon Panier"
              aria-label="Mon Panier"
            >
              <ShoppingCart className="w-5 h-5 text-orange-500" />
              {totalItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-orange-600 text-white font-bold text-[11px] w-5 h-5 rounded-full flex items-center justify-center tabular-nums shadow-sm">
                  {totalItemsCount}
                </span>
              )}
            </button>

            {/* Auth Actions */}
            {!user ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openAuth('login')}
                  className="hidden sm:inline-flex px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-blue-700 transition-colors whitespace-nowrap shrink-0"
                >
                  Connexion
                </button>
                <button
                  onClick={() => openAuth('register')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors whitespace-nowrap shrink-0"
                >
                  Créer un compte
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {/* Specific Role Shortcuts */}
                {user.role === 'admin' && (
                  <button
                    onClick={() => navigate('admin-dashboard')}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors whitespace-nowrap shrink-0"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Administration
                  </button>
                )}

                {store ? (
                  <button
                    onClick={() => navigate('vendor-dashboard')}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Store className="w-3.5 h-3.5" />
                    Ma Boutique
                  </button>
                ) : (
                  <button
                    onClick={() => navigate('client-dashboard', { tab: 'create-store' })}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Store className="w-3.5 h-3.5" />
                    Ouvrir ma boutique
                  </button>
                )}

                {/* Client Account Hub */}
                <button
                  onClick={() => navigate('client-dashboard')}
                  className="flex items-center gap-2 p-1.5 pr-3 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                >
                  <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs uppercase">
                    {user.full_name.charAt(0)}
                  </div>
                  <span className="hidden xl:inline truncate max-w-[100px]">{user.full_name}</span>
                </button>

                <button
                  onClick={logout}
                  className="hidden md:inline-flex px-2 py-1.5 text-xs text-slate-500 hover:text-rose-600 transition-colors"
                  title="Déconnexion"
                >
                  Quitter
                </button>
              </div>
            )}

            {/* Mobile menu hamburger toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>

        {/* Mobile search bar if open */}
        <div className="lg:hidden pb-3">
          <form onSubmit={handleQuickSearch} className="relative">
            <input
              type="text"
              value={quickSearch}
              onChange={e => setQuickSearch(e.target.value)}
              placeholder="Rechercher sur Market Sénégal..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          </form>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3">
          {/* Quick Messages CTA in Mobile Menu */}
          <button
            onClick={() => {
              handleOpenMessages();
              setMobileMenuOpen(false);
            }}
            className="w-full flex items-center justify-between px-4 py-3 bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-bold rounded-xl shadow-xs transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <MessageSquare className="w-5 h-5 text-white" />
                {unreadMessagesCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white" />
                )}
              </div>
              <span className="text-sm">Messages</span>
            </div>
            {unreadMessagesCount > 0 ? (
              <span className="px-2 py-0.5 bg-red-600 text-white font-black text-xs rounded-full border border-white">
                {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount} non lu{unreadMessagesCount > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-xs text-orange-100 font-medium">Ouvrir l'espace</span>
            )}
          </button>

          <div className="flex flex-col space-y-2 text-sm">
            <button
              onClick={() => { navigate('home'); setMobileMenuOpen(false); }}
              className="text-left py-2 font-medium text-slate-700 hover:text-blue-600"
            >
              Accueil
            </button>
            <button
              onClick={() => { navigate('search'); setMobileMenuOpen(false); }}
              className="text-left py-2 font-medium text-slate-700 hover:text-blue-600"
            >
              Tous les produits
            </button>
            <button
              onClick={() => { navigate('search', { type: 'stores' }); setMobileMenuOpen(false); }}
              className="text-left py-2 font-medium text-slate-700 hover:text-blue-600"
            >
              Découvrir les boutiques
            </button>
            <button
              onClick={() => { navigate('pricing'); setMobileMenuOpen(false); }}
              className="text-left py-2 font-medium text-slate-700 hover:text-blue-600"
            >
              Tarifs Abonnements Vendeurs
            </button>
            <button
              onClick={() => { navigate('help'); setMobileMenuOpen(false); }}
              className="text-left py-2 font-medium text-slate-700 hover:text-blue-600"
            >
              Aide & FAQ
            </button>
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            {user ? (
              <>
                <button
                  onClick={() => { navigate('client-dashboard'); setMobileMenuOpen(false); }}
                  className="w-full py-2.5 text-center text-xs font-semibold bg-slate-100 text-slate-900 rounded-lg"
                >
                  Mon Espace Client ({user.full_name})
                </button>
                {store ? (
                  <button
                    onClick={() => { navigate('vendor-dashboard'); setMobileMenuOpen(false); }}
                    className="w-full py-2.5 text-center text-xs font-semibold bg-blue-50 text-blue-800 rounded-lg"
                  >
                    Espace Vendeur : {store.name}
                  </button>
                ) : (
                  <button
                    onClick={() => { navigate('client-dashboard', { tab: 'create-store' }); setMobileMenuOpen(false); }}
                    className="w-full py-2.5 text-center text-xs font-semibold bg-orange-50 text-orange-700 rounded-lg"
                  >
                    Ouvrir ma boutique (Gratuit)
                  </button>
                )}
                {user.role === 'admin' && (
                  <button
                    onClick={() => { navigate('admin-dashboard'); setMobileMenuOpen(false); }}
                    className="w-full py-2.5 text-center text-xs font-semibold bg-amber-100 text-amber-900 rounded-lg"
                  >
                    Console Administrateur
                  </button>
                )}
                <button
                  onClick={() => { logout(); setMobileMenuOpen(false); }}
                  className="w-full py-2 text-center text-xs text-rose-600"
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => { openAuth('login'); setMobileMenuOpen(false); }}
                  className="py-2.5 text-center text-xs font-semibold border border-slate-300 rounded-lg text-slate-700"
                >
                  Connexion
                </button>
                <button
                  onClick={() => { openAuth('register'); setMobileMenuOpen(false); }}
                  className="py-2.5 text-center text-xs font-semibold bg-blue-600 text-white rounded-lg shadow-sm"
                >
                  Inscription
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
