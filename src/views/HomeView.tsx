import React, { useEffect, useState } from 'react';
import { Search, Store, ArrowRight, ShieldCheck, MapPin, Star, PlusCircle } from 'lucide-react';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { useAuth } from '../context/AuthContext.js';
import { useCart } from '../context/CartContext.js';
import { apiFetch, formatFCFA } from '../api/client.js';
import type { Product, Store as StoreType, PlatformReview } from '../types/index.js';
import { SENEGAL_REGIONS } from '../types/index.js';
import { CertifiedBadge } from '../components/CertifiedBadge.js';

export const HomeView: React.FC = () => {
  const { navigate, openAuth, user, store: userStore } = useAuth();
  const { addToCart } = useCart();
  const shouldReduceMotion = useReducedMotion();

  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [reviews, setReviews] = useState<PlatformReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [prodRes, storeRes, reviewRes] = await Promise.all([
          apiFetch<{ products: Product[] }>('/products'),
          apiFetch<{ stores: StoreType[] }>('/stores'),
          apiFetch<{ reviews: PlatformReview[] }>('/reviews')
        ]);
        setProducts(prodRes.products || []);
        setStores(storeRes.stores || []);
        setReviews(reviewRes.reviews || []);
      } catch (e) {
        console.error('Erreur chargement accueil:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('search', {
      query: searchQuery.trim(),
      region: selectedRegion || undefined
    });
  };

  const cubicEase = [0.16, 1, 0.3, 1] as const;

  // Animation variants configured to respect reduced motion
  const heroContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: shouldReduceMotion ? { duration: 0.01 } : {
        staggerChildren: 0.12,
        delayChildren: 0.05
      }
    }
  };

  const heroItemVariants: Variants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 18 },
    visible: {
      opacity: 1,
      y: 0,
      transition: shouldReduceMotion ? { duration: 0.01 } : {
        duration: 0.45,
        ease: cubicEase
      }
    }
  };

  const sectionVariants: Variants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: shouldReduceMotion ? { duration: 0.01 } : {
        duration: 0.4,
        ease: cubicEase
      }
    }
  };

  return (
    <div className="space-y-16">
      
      {/* 1. Hero Campaign Section with graceful entrance */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-900 via-blue-950 to-slate-950 text-white py-16 sm:py-24">
        {/* Subtle geometric pattern */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            className="max-w-3xl mx-auto text-center space-y-6"
            variants={heroContainerVariants}
            initial="hidden"
            animate="visible"
          >
            
            {/* Senegal Flag & Slogan accent */}
            <motion.div variants={heroItemVariants}>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/20 rounded-full text-xs font-semibold text-amber-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>MARKET SÉNÉGAL · 0% de commission vendeur</span>
              </div>
            </motion.div>

            {/* Main title */}
            <motion.h1
              variants={heroItemVariants}
              className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight"
              style={{ textWrap: 'balance' }}
            >
              Le grand marché en ligne du Sénégal
            </motion.h1>

            {/* Slogan & subtext */}
            <motion.p
              variants={heroItemVariants}
              className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed"
            >
              Découvrez des milliers de produits artisanaux, mode, électronique et alimentation vendus directement par des boutiques locales indépendantes.
            </motion.p>

            {/* Prominent Search Bar */}
            <motion.form
              variants={heroItemVariants}
              onSubmit={handleHeroSearch}
              className="bg-white p-2 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center gap-2 max-w-2xl mx-auto transition-shadow hover:shadow-2xl"
            >
              <div className="flex items-center flex-1 w-full px-3 py-2 text-slate-800">
                <Search className="w-5 h-5 text-slate-400 shrink-0 mr-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Que cherchez-vous ? (ex: Robe wax, thiéboudienne, téléphone...)"
                  className="w-full text-sm placeholder:text-slate-400 focus:outline-none bg-transparent"
                />
              </div>

              {/* Region Selector */}
              <div className="flex items-center w-full sm:w-auto border-t sm:border-t-0 sm:border-l border-slate-200 px-3 py-2 text-slate-700">
                <MapPin className="w-4 h-4 text-orange-600 shrink-0 mr-1.5" />
                <select
                  value={selectedRegion}
                  onChange={e => setSelectedRegion(e.target.value)}
                  className="text-xs bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value="">Toutes les régions</option>
                  {SENEGAL_REGIONS.map(reg => (
                    <option key={reg} value={reg}>{reg}</option>
                  ))}
                </select>
              </div>

              <motion.button
                whileHover={shouldReduceMotion ? {} : { scale: 1.02 }}
                whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                type="submit"
                className="w-full sm:w-auto px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm rounded-xl transition-colors shadow-sm shrink-0"
              >
                Rechercher
              </motion.button>
            </motion.form>

            {/* Direct Seller Call to Action */}
            <motion.div variants={heroItemVariants} className="pt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-300">
              <span>Vous êtes commerçant ou artisan au Sénégal ?</span>
              {userStore ? (
                <button
                  onClick={() => navigate('vendor-dashboard')}
                  className="font-bold text-amber-400 hover:underline flex items-center gap-1 transition-transform hover:translate-x-0.5"
                >
                  Accéder à votre boutique <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (!user) openAuth('register');
                    else navigate('client-dashboard', { tab: 'create-store' });
                  }}
                  className="font-bold text-amber-400 hover:underline flex items-center gap-1 transition-transform hover:translate-x-0.5"
                >
                  Ouvrez votre boutique gratuitement <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </motion.div>

          </motion.div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">

        {/* 2. Senegal Regional Quick Filter Strip (Scroll animated) */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Explorer par région</h2>
              <p className="text-xs text-slate-500 mt-0.5">Livraison locale directe assurée par les vendeurs</p>
            </div>
            <button
              onClick={() => navigate('search')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
            >
              Voir tout le catalogue →
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {SENEGAL_REGIONS.slice(0, 8).map(region => (
              <motion.button
                key={region}
                whileHover={shouldReduceMotion ? {} : { y: -2 }}
                whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                onClick={() => navigate('search', { region })}
                className="px-4 py-2 bg-white hover:bg-blue-50 hover:border-blue-300 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 whitespace-nowrap transition-colors shadow-xs"
              >
                {region}
              </motion.button>
            ))}
            <motion.button
              whileHover={shouldReduceMotion ? {} : { y: -2 }}
              whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
              onClick={() => navigate('search')}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-700 whitespace-nowrap transition-colors"
            >
              + 6 autres régions
            </motion.button>
          </div>
        </motion.section>

        {/* 3. Featured Products Grid (Progressive reveal on scroll) */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Produits à l'affiche</h2>
              <p className="text-xs text-slate-500 mt-1">Disponibles immédiatement auprès des boutiques sénégalaises</p>
            </div>
            <button
              onClick={() => navigate('search')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
            >
              Tout afficher ({products.length})
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(n => (
                <div key={n} className="bg-slate-100 rounded-xl aspect-[3/4] animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center space-y-4">
              <Store className="w-12 h-12 text-slate-300 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-800">Aucun produit publié pour l'instant</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Soyez le tout premier vendeur à référencer vos articles sur MARKET SÉNÉGAL avec 0% de commission !
                </p>
              </div>
              <div>
                <motion.button
                  whileHover={shouldReduceMotion ? {} : { scale: 1.02 }}
                  whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                  onClick={() => {
                    if (!user) openAuth('register');
                    else navigate(userStore ? 'vendor-dashboard' : 'client-dashboard', { tab: userStore ? 'products' : 'create-store' });
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                >
                  <PlusCircle className="w-4 h-4" />
                  {userStore ? 'Ajouter mon premier produit' : 'Créer ma boutique'}
                </motion.button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.slice(0, 8).map((prod, idx) => (
                <motion.div
                  key={prod.id}
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-20px' }}
                  transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.35, delay: idx * 0.05 }}
                  whileHover={shouldReduceMotion ? {} : { y: -4, transition: { duration: 0.2 } }}
                  onClick={() => navigate('product', { id: prod.id })}
                  className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md hover:border-slate-300 transition-all cursor-pointer flex flex-col"
                >
                  {/* Photo Container */}
                  <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                    <img
                      src={prod.images[0] || '/assets/aistudio/a_clean_professional_vector_logo_graphic_on_a_whi_98efa245.png'}
                      alt={prod.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
                    />
                    {prod.stock_quantity <= 0 && (
                      <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center text-white text-xs font-bold uppercase tracking-wider">
                        Rupture
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      {/* Unboxed metadata */}
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
                        <span className="truncate">{prod.store_name}</span>
                        {prod.store_is_certified && <CertifiedBadge size="sm" showText={false} />}
                        <span aria-hidden="true">·</span>
                        <span>{prod.store_city || 'Sénégal'}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 mt-0.5">
                        {prod.name}
                      </h3>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                      <div>
                        {/* Tabular numerals without artificial counter animation */}
                        <div className="text-base font-bold text-slate-900 tabular-nums">
                          {formatFCFA(prod.price_fcfa)}
                        </div>
                        {prod.compare_price_fcfa && prod.compare_price_fcfa > prod.price_fcfa && (
                          <div className="text-xs text-slate-400 line-through tabular-nums">
                            {formatFCFA(prod.compare_price_fcfa)}
                          </div>
                        )}
                      </div>

                      <motion.button
                        type="button"
                        whileTap={shouldReduceMotion ? {} : { scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(prod, 1);
                        }}
                        disabled={prod.stock_quantity <= 0}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-30"
                        title="Ajouter au panier"
                      >
                        <PlusCircle className="w-5 h-5" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>

        {/* 4. Active Independent Stores Showcase (Scroll animated) */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Boutiques et Artisans du Sénégal</h2>
              <p className="text-xs text-slate-500 mt-1">Achetez directement sans intermédiaire</p>
            </div>
            <button
              onClick={() => navigate('search', { type: 'stores' })}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
            >
              Toutes les boutiques ({stores.length})
            </button>
          </div>

          {stores.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
              Aucune boutique active enregistrée pour le moment.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {stores.slice(0, 6).map((st, idx) => (
                <motion.div
                  key={st.id}
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-20px' }}
                  transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.35, delay: idx * 0.05 }}
                  whileHover={shouldReduceMotion ? {} : { y: -3, transition: { duration: 0.2 } }}
                  onClick={() => navigate('store', { slug: st.slug })}
                  className="group bg-white p-5 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex items-start gap-4"
                >
                  <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                    {st.logo_url ? (
                      <img src={st.logo_url} alt={st.name} className="w-full h-full object-cover" />
                    ) : (
                      <Store className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                        {st.name}
                      </h3>
                      {st.is_certified && <CertifiedBadge size="sm" />}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{st.city} · {st.address}</span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 mt-2 leading-relaxed">
                      {st.description || 'Boutique vérifiée sur Market Sénégal.'}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>

        {/* 5. Trust & Transparency Banner (Scroll animated) */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          className="bg-slate-100 rounded-2xl p-8 sm:p-12 border border-slate-200"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">Engagement Market Sénégal</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Le modèle le plus équitable pour le commerce sénégalais
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Contrairement aux grandes plateformes qui prélèvent 10% à 25% sur chaque vente, MARKET SÉNÉGAL applique <strong>strictement 0% de commission</strong>. Les vendeurs conservent 100% de leurs revenus et peuvent ainsi offrir les meilleurs prix à leurs clients.
              </p>
              <div className="pt-2 flex items-center gap-3">
                <motion.button
                  whileHover={shouldReduceMotion ? {} : { scale: 1.02 }}
                  whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
                  onClick={() => navigate('pricing')}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm"
                >
                  Découvrir les forfaits vendeurs
                </motion.button>
                <motion.button
                  whileHover={shouldReduceMotion ? {} : { scale: 1.02 }}
                  whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
                  onClick={() => navigate('help')}
                  className="px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-xs rounded-lg transition-colors"
                >
                  Comment ça marche ?
                </motion.button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4 shadow-sm">
              <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Garanties de la plateforme
              </h3>
              <ul className="space-y-3 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span><strong>Tarifs transparents :</strong> Prix des articles et frais de livraison affichés sans frais surprise au paiement.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span><strong>Livraison flexible :</strong> Frais et délais calculés sur la base exacte des zones desservies par le vendeur.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span><strong>Messagerie intégrée :</strong> Contactez le vendeur avant de commander pour valider la taille ou les détails.</span>
                </li>
              </ul>
            </div>
          </div>
        </motion.section>

        {/* 6. Authentic Platform Reviews (Avis réels sur MARKET SÉNÉGAL) */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Avis sur la plateforme</h2>
              <p className="text-xs text-slate-500 mt-1">Les retours d'expérience vérifiés de nos utilisateurs</p>
            </div>
            {user && (
              <button
                onClick={() => navigate('client-dashboard', { tab: 'review' })}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                Donner mon avis →
              </button>
            )}
          </div>

          {reviews.length === 0 ? (
            <div className="p-8 bg-white border border-slate-200 rounded-xl text-center text-xs text-slate-500 space-y-2">
              <p>Aucun avis n'a encore été déposé sur la plateforme.</p>
              {user && (
                <button
                  onClick={() => navigate('client-dashboard', { tab: 'review' })}
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Soyez le premier à partager votre expérience client !
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {reviews.slice(0, 3).map((rev, idx) => (
                <motion.div
                  key={rev.id}
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-20px' }}
                  transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.35, delay: idx * 0.05 }}
                  className="bg-white p-5 rounded-xl border border-slate-200 space-y-3"
                >
                  <div className="flex items-center gap-1 text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${i < rev.rating ? 'fill-current text-amber-400' : 'text-slate-200'}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-700 italic leading-relaxed">
                    « {rev.comment} »
                  </p>
                  <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{rev.user_name || 'Utilisateur'}</span>
                    <span>{new Date(rev.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>

      </div>
    </div>
  );
};
