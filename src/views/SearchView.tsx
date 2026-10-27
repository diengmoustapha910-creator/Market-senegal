import React, { useEffect, useState } from 'react';
import { Search, Filter, MapPin, Store, SlidersHorizontal, PlusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useCart } from '../context/CartContext.js';
import { apiFetch, formatFCFA } from '../api/client.js';
import type { Product, Store as StoreType } from '../types/index.js';
import { SENEGAL_REGIONS } from '../types/index.js';
import { CertifiedBadge } from '../components/CertifiedBadge.js';

export const SearchView: React.FC = () => {
  const { viewParams, navigate } = useAuth();
  const { addToCart } = useCart();

  const [activeTab, setActiveTab] = useState<'products' | 'stores'>(
    viewParams.type === 'stores' ? 'stores' : 'products'
  );
  const [query, setQuery] = useState<string>(viewParams.query || '');
  const [selectedRegion, setSelectedRegion] = useState<string>(viewParams.region || '');
  const [selectedStoreId, setSelectedStoreId] = useState<string>(viewParams.storeId || '');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [sort, setSort] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');

  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState(true);

  // Load stores list for filters
  useEffect(() => {
    apiFetch<{ stores: StoreType[] }>('/stores').then(res => setStores(res.stores || []));
  }, []);

  // Fetch results
  const fetchResults = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.append('search', query.trim());
      if (selectedRegion) params.append('region', selectedRegion);
      if (selectedStoreId) params.append('storeId', selectedStoreId);
      if (minPrice) params.append('minPrice', minPrice);
      if (maxPrice) params.append('maxPrice', maxPrice);
      params.append('sort', sort);

      const res = await apiFetch<{ products: Product[]; total: number }>(`/products?${params.toString()}`);
      setProducts(res.products || []);
    } catch (e) {
      console.error('Erreur recherche produits:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [query, selectedRegion, selectedStoreId, sort]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchResults();
  };

  const filteredStores = stores.filter(s => {
    if (query && !s.name.toLowerCase().includes(query.toLowerCase()) && !s.description.toLowerCase().includes(query.toLowerCase())) {
      return false;
    }
    if (selectedRegion && s.city.toLowerCase() !== selectedRegion.toLowerCase()) {
      return false;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Top Filter and Search Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        
        {/* Toggle Products vs Stores */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${activeTab === 'products' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Catalogue Produits ({products.length})
            </button>
            <button
              onClick={() => setActiveTab('stores')}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${activeTab === 'stores' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Annuaire des Boutiques ({filteredStores.length})
            </button>
          </div>

          <div className="text-xs text-slate-500 hidden sm:block">
            0% de commission sur toutes les ventes
          </div>
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher par mot-clé, article, artisan..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedRegion}
              onChange={e => setSelectedRegion(e.target.value)}
              className="w-full py-2.5 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-700"
            >
              <option value="">Toutes les régions (Sénégal)</option>
              {SENEGAL_REGIONS.map(reg => (
                <option key={reg} value={reg}>{reg}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <select
              value={sort}
              onChange={e => setSort(e.target.value as any)}
              className="w-full py-2.5 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-700"
            >
              <option value="newest">Nouveautés en premier</option>
              <option value="price_asc">Prix croissant (FCFA)</option>
              <option value="price_desc">Prix décroissant (FCFA)</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shrink-0"
            >
              Filtrer
            </button>
          </div>
        </form>

        {/* Store filter chips if available */}
        {stores.length > 0 && activeTab === 'products' && (
          <div className="pt-2 flex items-center gap-2 overflow-x-auto text-xs pb-1">
            <span className="text-slate-400 shrink-0">Boutique :</span>
            <button
              onClick={() => setSelectedStoreId('')}
              className={`px-3 py-1 rounded-full border text-[11px] font-medium transition-colors ${!selectedStoreId ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              Toutes
            </button>
            {stores.map(st => (
              <button
                key={st.id}
                onClick={() => setSelectedStoreId(selectedStoreId === st.id ? '' : st.id)}
                className={`px-3 py-1 rounded-full border text-[11px] font-medium transition-colors whitespace-nowrap ${selectedStoreId === st.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {st.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Results Display */}
      {activeTab === 'products' ? (
        <section className="space-y-6">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <div key={n} className="bg-slate-100 rounded-xl aspect-[3/4] animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center space-y-3">
              <SlidersHorizontal className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-base font-semibold text-slate-800">Aucun produit ne correspond à vos critères</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Modifiez vos termes de recherche ou essayez de sélectionner une autre région du Sénégal.
              </p>
              <div>
                <button
                  onClick={() => { setQuery(''); setSelectedRegion(''); setSelectedStoreId(''); }}
                  className="px-4 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  Réinitialiser tous les filtres
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map(prod => (
                <div
                  key={prod.id}
                  onClick={() => navigate('product', { id: prod.id })}
                  className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-all cursor-pointer flex flex-col"
                >
                  <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                    <img
                      src={prod.images[0] || '/assets/aistudio/a_clean_professional_vector_logo_graphic_on_a_whi_98efa245.png'}
                      alt={prod.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {prod.stock_quantity <= 0 && (
                      <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center text-white text-xs font-bold uppercase tracking-wider">
                        Rupture
                      </div>
                    )}
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                    <div>
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
                        <div className="text-base font-bold text-slate-900 tabular-nums">
                          {formatFCFA(prod.price_fcfa)}
                        </div>
                        {prod.compare_price_fcfa && prod.compare_price_fcfa > prod.price_fcfa && (
                          <div className="text-xs text-slate-400 line-through tabular-nums">
                            {formatFCFA(prod.compare_price_fcfa)}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(prod, 1);
                        }}
                        disabled={prod.stock_quantity <= 0}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-30"
                        title="Ajouter au panier"
                      >
                        <PlusCircle className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        /* Stores Directory */
        <section className="space-y-6">
          {filteredStores.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center space-y-2">
              <Store className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-base font-semibold text-slate-800">Aucune boutique trouvée</h3>
              <p className="text-xs text-slate-500">Essayez un autre terme de recherche.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStores.map(st => (
                <div
                  key={st.id}
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
                </div>
              ))}
            </div>
          )}
        </section>
      )}

    </div>
  );
};
