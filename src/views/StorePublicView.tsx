import React, { useEffect, useState } from 'react';
import { Store as StoreIcon, MapPin, Phone, Truck, MessageSquare, PlusCircle, Share2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useCart } from '../context/CartContext.js';
import { apiFetch, formatFCFA } from '../api/client.js';
import type { Store, Product, StoreCategory, DeliveryZone } from '../types/index.js';
import { CertifiedBadge } from '../components/CertifiedBadge.js';
import { ShareModal } from '../components/ShareModal.js';

export const StorePublicView: React.FC = () => {
  const { viewParams, navigate, user, openAuth, showToast, getStorePublicUrl } = useAuth();
  const { addToCart } = useCart();
  const slug = viewParams.slug || viewParams.storeId || viewParams.id;

  const [store, setStore] = useState<Store | null>(null);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    async function loadStore() {
      if (!slug) return;
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<{
          store: Store;
          categories: StoreCategory[];
          deliveryZones: DeliveryZone[];
          products: Product[];
        }>(`/stores/${slug}`);
        setStore(res.store);
        if (res.store?.name) {
          document.title = `${res.store.name} – Boutique Officielle | MARKET SÉNÉGAL`;
        }
        setCategories(res.categories || []);
        setDeliveryZones(res.deliveryZones || []);
        setProducts(res.products || []);
      } catch (err: any) {
        setError(err.message || 'Boutique introuvable.');
      } finally {
        setLoading(false);
      }
    }
    loadStore();
  }, [slug]);

  const handleStartChat = async () => {
    if (!store) return;
    if (!user) {
      openAuth('login', 'messages');
      return;
    }
    try {
      const res = await apiFetch<{ success: boolean; conversation: { id: string } }>('/conversations/start', {
        method: 'POST',
        body: JSON.stringify({ storeId: store.id })
      });
      navigate('client-dashboard', { tab: 'messages', activeConversationId: res.conversation.id });
    } catch (e: any) {
      showToast(e.message || 'Impossible d’ouvrir la discussion.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Boutique introuvable</h2>
        <p className="text-xs text-slate-500">{error || 'Cette boutique n’existe pas ou a été suspendue.'}</p>
        <button
          onClick={() => navigate('search', { type: 'stores' })}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"
        >
          Retour aux boutiques
        </button>
      </div>
    );
  }

  const filteredProducts = selectedCatId
    ? products.filter(p => p.category_id === selectedCatId)
    : products;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Store Banner & Brand Header */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {/* Banner */}
        <div className="h-44 sm:h-60 bg-gradient-to-r from-blue-900 to-indigo-950 relative">
          {store.banner_url && (
            <img src={store.banner_url} alt={store.name} className="w-full h-full object-cover" />
          )}
          <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-xs text-white text-[11px] font-medium px-3 py-1 rounded-full">
            0% de commission vendeur
          </div>
        </div>

        {/* Store Profile Bar */}
        <div className="p-6 sm:p-8 relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 -mt-16 sm:-mt-20">
            <div className="flex items-end gap-5">
              <div className="w-24 h-24 rounded-2xl bg-white border-4 border-white shadow-md overflow-hidden flex items-center justify-center shrink-0">
                {store.logo_url ? (
                  <img src={store.logo_url} alt={store.name} className="w-full h-full object-cover" />
                ) : (
                  <StoreIcon className="w-10 h-10 text-slate-400" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{store.name}</h1>
                  {store.is_certified && <CertifiedBadge size="md" />}
                </div>
                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-orange-500" />
                    {store.city} ({store.address})
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {store.phone}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={() => setShareOpen(true)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Share2 className="w-4 h-4 text-blue-600" />
                Partager la boutique
              </button>

              <button
                onClick={handleStartChat}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Contacter le vendeur
              </button>
            </div>
          </div>

          {store.description && (
            <p className="text-xs text-slate-600 mt-6 max-w-3xl leading-relaxed">
              {store.description}
            </p>
          )}
        </div>
      </div>

      {/* Main Grid: Delivery Zones Sidebar + Products Catalog */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Delivery Zones Card */}
        <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Truck className="w-4 h-4 text-orange-600" />
            Régions desservies & Frais de port
          </h3>

          {deliveryZones.length === 0 ? (
            <p className="text-xs text-slate-500 italic">
              Cette boutique n'a pas encore renseigné sa grille tarifaire.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {deliveryZones.map(zone => (
                <div key={zone.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800">{zone.region}</span>
                    <span className="text-[11px] text-slate-400 block">{zone.estimated_days}</span>
                  </div>
                  <span className="font-bold text-slate-900 tabular-nums">{formatFCFA(zone.price_fcfa)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="p-3 bg-slate-50 rounded-lg text-[11px] text-slate-500">
            {store.allows_cod ? '✓ Paiement en espèces à la livraison accepté' : 'Paiement à la livraison non disponible'}
          </div>
        </div>

        {/* Products Section */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Category Filter Tabs */}
          {categories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setSelectedCatId('')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${!selectedCatId ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                Tous les articles ({products.length})
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${selectedCatId === cat.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Products Grid */}
          {filteredProducts.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-xs text-slate-500">
              Aucun produit disponible dans cette catégorie pour le moment.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              {filteredProducts.map(prod => (
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
                      <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                        {prod.name}
                      </h3>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                      <div className="text-base font-bold text-slate-900 tabular-nums">
                        {formatFCFA(prod.price_fcfa)}
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

        </div>

      {/* Share Store Modal */}
      {store && (
        <ShareModal
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          type="store"
          title={store.name}
          description={store.description}
          imageUrl={store.banner_url || store.logo_url}
          url={getStorePublicUrl(store)}
          storeName={store.name}
        />
      )}

    </div>
  );
};
