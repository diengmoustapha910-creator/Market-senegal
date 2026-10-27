import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { Shield, Truck, Sparkles, MapPin } from 'lucide-react';

export const Footer: React.FC = () => {
  const { navigate } = useAuth();

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 mt-24">
      {/* 3 Pillars banner */}
      <div className="border-b border-slate-800 bg-slate-950/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-900/50 text-blue-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h4 className="text-white font-semibold text-sm">0% de commission sur les ventes</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Le vendeur perçoit l'intégralité du prix de ses articles. Aucun frais caché ni ponction sur votre chiffre d'affaires.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-orange-950/50 text-orange-400 flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h4 className="text-white font-semibold text-sm">Livraison transparente au Sénégal</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Chaque boutique définit précisément ses zones et tarifs régionaux. Tarifs transparents connus à l'avance.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-950/50 text-emerald-400 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-white font-semibold text-sm">Messagerie & Relation directe</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Échangez directement entre acheteurs et vendeurs locaux avant ou après votre commande en toute sécurité.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Col 1: Brand Info */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2">
              <img
                src="/assets/aistudio/a_clean_professional_vector_logo_graphic_on_a_whi_98efa245.png"
                alt="MARKET SÉNÉGAL"
                className="h-10 w-auto object-contain bg-white rounded p-1"
              />
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Le grand marché en ligne du Sénégal. Plateforme ouverte connectant les commerçants, créateurs et consommateurs de toutes les régions.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
              <span>Dakar, Sénégal · marketsenegal.com</span>
            </div>
          </div>

          {/* Col 2: Navigation Acheteurs */}
          <div>
            <h5 className="text-xs font-semibold text-white tracking-wider uppercase mb-3">Pour les acheteurs</h5>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => navigate('search')} className="hover:text-white transition-colors">
                  Explorer les produits
                </button>
              </li>
              <li>
                <button onClick={() => navigate('search', { type: 'stores' })} className="hover:text-white transition-colors">
                  Annuaire des boutiques
                </button>
              </li>
              <li>
                <button onClick={() => navigate('cart')} className="hover:text-white transition-colors">
                  Mon panier d'achats
                </button>
              </li>
              <li>
                <button onClick={() => navigate('client-dashboard')} className="hover:text-white transition-colors">
                  Suivi de mes commandes
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Pour les vendeurs */}
          <div>
            <h5 className="text-xs font-semibold text-white tracking-wider uppercase mb-3">Pour les vendeurs</h5>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => navigate('pricing')} className="hover:text-white transition-colors font-medium text-slate-200">
                  Tarifs Vendeurs (Abonnements)
                </button>
              </li>
              <li>
                <button onClick={() => navigate('client-dashboard', { tab: 'create-store' })} className="hover:text-white transition-colors">
                  Ouvrir une boutique (0% commission)
                </button>
              </li>
              <li>
                <button onClick={() => navigate('vendor-dashboard')} className="hover:text-white transition-colors">
                  Tableau de bord commerçant
                </button>
              </li>
              <li>
                <button onClick={() => navigate('help')} className="hover:text-white transition-colors">
                  Guide d'expédition locale
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4: Informations légales */}
          <div>
            <h5 className="text-xs font-semibold text-white tracking-wider uppercase mb-3">Informations & Support</h5>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => navigate('help')} className="hover:text-white transition-colors font-medium text-slate-200">
                  Aide & FAQ
                </button>
              </li>
              <li>
                <button onClick={() => navigate('contact')} className="hover:text-white transition-colors">
                  Nous contacter
                </button>
              </li>
              <li>
                <button onClick={() => navigate('terms')} className="hover:text-white transition-colors">
                  Conditions Générales d'Utilisation
                </button>
              </li>
              <li>
                <button onClick={() => navigate('privacy')} className="hover:text-white transition-colors">
                  Politique de Confidentialité
                </button>
              </li>
              <li className="pt-2 border-t border-slate-800/80">
                <button
                  onClick={() => navigate('admin-login')}
                  className="text-slate-400 hover:text-amber-400 transition-colors font-medium flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Espace Administration (Accès restreint)
                </button>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom copyright line */}
        <div className="mt-12 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} MARKET SÉNÉGAL. Tous droits réservés.</p>
          <p className="flex items-center gap-2">
            <span>Devise officielle : FCFA</span>
            <span>·</span>
            <button
              onClick={() => navigate('admin-login')}
              className="hover:text-slate-400 transition-colors underline decoration-slate-700"
            >
              Portail Direction
            </button>
          </p>
        </div>
      </div>
    </footer>
  );
};
