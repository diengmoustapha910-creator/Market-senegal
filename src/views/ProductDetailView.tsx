import React, { useEffect, useState } from 'react';
import { ArrowLeft, MessageSquare, Truck, ShieldCheck, Plus, Minus, Store, MapPin, CheckCircle, Share2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useCart } from '../context/CartContext.js';
import { apiFetch, formatFCFA } from '../api/client.js';
import type { Product, Store as StoreType, DeliveryZone } from '../types/index.js';
import { CertifiedBadge } from '../components/CertifiedBadge.js';
import { ShareModal } from '../components/ShareModal.js';

export const ProductDetailView: React.FC = () => {
  const { viewParams, navigate, user, openAuth, showToast, getProductPublicUrl } = useAuth();
  const { addToCart } = useCart();

  const productId = viewParams.id || viewParams.productId;
  const [product, setProduct] = useState<Product | null>(null);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    async function fetchProduct() {
      if (!productId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<{ product: Product & { store: StoreType }; deliveryZones: DeliveryZone[] }>(`/products/${productId}`);
        setProduct(res.product);
        if (res.product) {
          document.title = `${res.product.name} – ${res.product.store?.name || 'MARKET SÉNÉGAL'} (${formatFCFA(res.product.price_fcfa)})`;
        }
        setDeliveryZones(res.deliveryZones || []);
      } catch (err: any) {
        setError(err.message || 'Produit introuvable.');
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [productId]);

  const handleAddToCart = () => {
    if (!product) return;
    addToCart(product, quantity);
    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 2500);
  };

  const handleStartChat = async () => {
    if (!product) return;
    if (!user) {
      openAuth('login', 'messages');
      return;
    }
    try {
      const res = await apiFetch<{ success: boolean; conversation: { id: string } }>('/conversations/start', {
        method: 'POST',
        body: JSON.stringify({ storeId: product.store_id })
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

  if (error || !product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Ce produit n'est plus disponible</h2>
        <p className="text-xs text-slate-500">{error || 'Le produit demandé a été retiré ou la boutique est inactive.'}</p>
        <button
          onClick={() => navigate('search')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold"
        >
          Retour au catalogue
        </button>
      </div>
    );
  }

  const store = product.store!;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Back button */}
      <button
        onClick={() => navigate('search')}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux résultats
      </button>

      {/* Main PDP Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        
        {/* Left Column: Image Gallery */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative aspect-[4/3] rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
            <img
              src={product.images[selectedImageIndex] || product.images[0] || '/assets/aistudio/a_clean_professional_vector_logo_graphic_on_a_whi_98efa245.png'}
              alt={product.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain p-4"
            />
          </div>

          {/* Thumbnails if multiple images */}
          {product.images.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`w-20 h-20 rounded-xl border-2 overflow-hidden shrink-0 transition-all ${selectedImageIndex === idx ? 'border-blue-600 ring-2 ring-blue-100' : 'border-slate-200 opacity-70 hover:opacity-100'}`}
                >
                  <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Detailed Description */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Description du produit</h3>
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          </div>
        </div>

        {/* Right Column: Contiguous Purchase Module */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-28">
          
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
            
            {/* Header info */}
            <div>
              <div className="text-xs text-slate-500 flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-semibold text-slate-700">{store.name}</span>
                {store.is_certified && <CertifiedBadge size="sm" />}
                <span aria-hidden="true">·</span>
                <span>{store.city}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
                {product.name}
              </h1>
            </div>

            {/* Price Box */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-baseline justify-between">
              <div>
                <span className="text-xs text-slate-500 block">Prix de vente direct</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                  {formatFCFA(product.price_fcfa)}
                </span>
              </div>
              {product.compare_price_fcfa && product.compare_price_fcfa > product.price_fcfa && (
                <div className="text-right">
                  <span className="text-xs text-slate-400 line-through tabular-nums block">
                    {formatFCFA(product.compare_price_fcfa)}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    -{Math.round(((product.compare_price_fcfa - product.price_fcfa) / product.compare_price_fcfa) * 100)}%
                  </span>
                </div>
              )}
            </div>

            {/* Stock status */}
            <div className="text-xs flex items-center justify-between">
              <span className="text-slate-500">Disponibilité :</span>
              {product.stock_quantity > 0 ? (
                <span className="font-semibold text-emerald-600">
                  En stock ({product.stock_quantity} unité{product.stock_quantity > 1 ? 's' : ''})
                </span>
              ) : (
                <span className="font-semibold text-rose-600">Actuellement en rupture</span>
              )}
            </div>

            {/* Quantity Stepper */}
            {product.stock_quantity > 0 && (
              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-xs font-semibold text-slate-700">Quantité :</span>
                <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-2 hover:bg-slate-100 text-slate-600 transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-4 text-xs font-bold tabular-nums text-slate-800">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                    className="p-2 hover:bg-slate-100 text-slate-600 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3 pt-2">
              <button
                onClick={handleAddToCart}
                disabled={product.stock_quantity <= 0}
                className="w-full py-3.5 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {addedSuccess ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-emerald-300" />
                    Ajouté au panier !
                  </>
                ) : (
                  'Ajouter au panier'
                )}
              </button>

              <button
                onClick={handleStartChat}
                className="w-full py-3 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4 text-blue-600" />
                Contacter le vendeur
              </button>
            </div>

            {/* Seller profile card summary */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700">
                  {store.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="text-xs font-bold text-slate-900">{store.name}</h4>
                    {store.is_certified && <CertifiedBadge size="sm" />}
                  </div>
                  <p className="text-[11px] text-slate-500">{store.city} · Vendeur officiel</p>
                </div>
              </div>
              <button
                onClick={() => navigate('store', { slug: store.slug })}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Visiter la boutique
              </button>
            </div>

          </div>

          {/* Delivery rates for this specific vendor */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Truck className="w-4 h-4 text-orange-600" />
              Zones et Tarifs de Livraison de cette boutique
            </h3>

            {deliveryZones.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                Ce vendeur n'a pas encore configuré ses zones d'expédition. Contactez-le via la messagerie pour convenir de la remise en main propre.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {deliveryZones.map(zone => (
                  <div key={zone.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800">{zone.region}</span>
                      <span className="text-[11px] text-slate-400 block">Délai estimé : {zone.estimated_days}</span>
                    </div>
                    <span className="font-bold text-slate-900 tabular-nums">{formatFCFA(zone.price_fcfa)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
