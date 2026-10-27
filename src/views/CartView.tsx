import React, { useEffect, useState } from 'react';
import { Trash2, Plus, Minus, ArrowLeft, Truck, AlertCircle, CheckCircle, ShieldCheck, ShoppingBag } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useCart } from '../context/CartContext.js';
import { apiFetch, formatFCFA } from '../api/client.js';
import { SENEGAL_REGIONS } from '../types/index.js';

export const CartView: React.FC = () => {
  const { user, openAuth, navigate, showToast } = useAuth();
  const { items, removeFromCart, updateQuantity, clearCart } = useCart();

  // Delivery destination chosen by customer
  const [selectedRegion, setSelectedRegion] = useState<string>('Dakar');
  const [customerName, setCustomerName] = useState<string>(user?.full_name || '');
  const [customerPhone, setCustomerPhone] = useState<string>(user?.phone || '');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'paiement_livraison' | 'wave' | 'orange_money'>('paiement_livraison');

  // Multi-vendor quote calculated by server
  const [quoteData, setQuoteData] = useState<any>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync customer details from user object
  useEffect(() => {
    if (user) {
      if (!customerName) setCustomerName(user.full_name);
      if (!customerPhone && user.phone) setCustomerPhone(user.phone);
    }
  }, [user]);

  // Request server quote whenever items or region change
  useEffect(() => {
    async function fetchQuote() {
      if (items.length === 0) {
        setQuoteData(null);
        return;
      }
      setLoadingQuote(true);
      try {
        const payload = {
          items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
          deliveryRegion: selectedRegion
        };
        const data = await apiFetch('/cart/quote', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setQuoteData(data);
      } catch (err: any) {
        console.error('Erreur devis panier:', err);
      } finally {
        setLoadingQuote(false);
      }
    }
    fetchQuote();
  }, [items, selectedRegion]);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!user) {
      openAuth('login');
      return;
    }

    if (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim()) {
      setErrorMessage('Veuillez renseigner votre nom, téléphone et adresse précise de livraison au Sénégal.');
      return;
    }

    // Check if any store doesn't deliver to the selected region
    if (quoteData?.groups) {
      const unsupported = quoteData.groups.filter((g: any) => !g.isDeliveringToRegion);
      if (unsupported.length > 0) {
        setErrorMessage(
          `La boutique "${unsupported[0].storeName}" ne dessert pas la région "${selectedRegion}". Régions desservies par cette boutique : ${unsupported[0].availableZones.join(', ')}.`
        );
        return;
      }
    }

    // Payment validation: Only actually configured and allowed methods
    const canUseCod = quoteData?.groups?.length > 0 && quoteData.groups.every((g: any) => g.allowsCod !== false);
    if (!canUseCod) {
      const disallowing = quoteData?.groups?.filter((g: any) => g.allowsCod === false) || [];
      const storeNames = disallowing.map((g: any) => `« ${g.storeName} »`).join(', ');
      setErrorMessage(
        `Le paiement à la livraison n'a pas été configuré par ${storeNames || 'une boutique'}. Aucun paiement en ligne n'étant actif pour les paniers, la commande ne peut pas être validée.`
      );
      return;
    }

    if (paymentMethod !== 'paiement_livraison') {
      setErrorMessage(
        'Le paiement en ligne Wave / Orange Money pour les commandes nécessite une intégration API dynamique. Seul le paiement en espèces à la livraison configuré est disponible.'
      );
      return;
    }

    setSubmittingOrder(true);
    try {
      // Build order groups
      const storeOrders = quoteData.groups.map((g: any) => ({
        storeId: g.storeId,
        items: g.items.map((i: any) => ({ productId: i.productId, quantity: i.quantity }))
      }));

      const res = await apiFetch('/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerName,
          customerPhone,
          deliveryRegion: selectedRegion,
          deliveryAddress,
          deliveryNotes,
          paymentMethod,
          storeOrders
        })
      });

      clearCart();
      showToast(res.message || 'Commande enregistrée avec succès !', 'success');
      navigate('client-dashboard', { tab: 'orders' });
    } catch (err: any) {
      setErrorMessage(err.message || 'Impossible de finaliser la commande.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Votre panier est vide</h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Explorez le catalogue de MARKET SÉNÉGAL et découvrez des articles d'artisans et boutiques locales.
        </p>
        <button
          onClick={() => navigate('search')}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
        >
          Commencer mes achats
        </button>
      </div>
    );
  }

  const groups = quoteData?.groups || [];
  const grandTotal = quoteData?.grandTotal || 0;
  const allStoresAllowCod = groups.length > 0 && groups.every((g: any) => g.allowsCod !== false);
  const storesDisallowingCod = groups.filter((g: any) => g.allowsCod === false);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('search')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Continuer mes achats
        </button>
        <div className="text-xs text-slate-500">
          Séparation automatique des colis par boutique
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Col: Multi-Vendor Orders Breakdown */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Votre Panier</h1>
            <span className="text-xs text-slate-500">
              {groups.length} boutique{groups.length > 1 ? 's' : ''} différente{groups.length > 1 ? 's' : ''}
            </span>
          </div>

          {/* Group per Store */}
          {groups.map((group: any) => (
            <div key={group.storeId} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              
              {/* Store sub-header */}
              <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Colis de : {group.storeName}
                  </h3>
                  <span className="text-[11px] text-slate-500">{group.storeCity}</span>
                </div>
                <div className="text-right text-xs">
                  {group.isDeliveringToRegion ? (
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5" />
                      Livraison {group.deliveryTime} ({formatFCFA(group.deliveryFee)})
                    </span>
                  ) : (
                    <span className="text-rose-600 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Ne livre pas en {selectedRegion}
                    </span>
                  )}
                </div>
              </div>

              {/* Items in this store */}
              <div className="divide-y divide-slate-100 p-6 space-y-4">
                {group.items.map((it: any) => (
                  <div key={it.productId} className="flex items-center gap-4 pt-4 first:pt-0">
                    <img
                      src={it.image || '/assets/aistudio/a_clean_professional_vector_logo_graphic_on_a_whi_98efa245.png'}
                      alt={it.name}
                      className="w-16 h-16 rounded-xl object-cover bg-slate-100 border border-slate-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900 truncate">{it.name}</h4>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {formatFCFA(it.unitPrice)} l'unité
                      </p>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden shrink-0">
                      <button
                        onClick={() => updateQuantity(it.productId, it.quantity - 1)}
                        className="p-1.5 hover:bg-slate-100 text-slate-600"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2.5 text-xs font-bold tabular-nums text-slate-800">{it.quantity}</span>
                      <button
                        onClick={() => updateQuantity(it.productId, it.quantity + 1)}
                        className="p-1.5 hover:bg-slate-100 text-slate-600"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-right min-w-[80px]">
                      <div className="text-sm font-bold text-slate-900 tabular-nums">
                        {formatFCFA(it.lineTotal)}
                      </div>
                      <button
                        onClick={() => removeFromCart(it.productId)}
                        className="text-[11px] text-rose-500 hover:text-rose-700 mt-0.5"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Subtotal for this vendor */}
              <div className="bg-slate-50/50 px-6 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>Sous-total articles : {formatFCFA(group.subtotal)}</span>
                <span className="font-semibold text-slate-900">
                  Total pour {group.storeName} : {formatFCFA(group.storeTotal)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Right Col: Checkout Delivery & Payment Form */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-28">
          
          <form onSubmit={handleCheckoutSubmit} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Coordonnées de livraison</h2>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Region Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Région du Sénégal de destination <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedRegion}
                onChange={e => setSelectedRegion(e.target.value)}
                className="w-full p-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
              >
                {SENEGAL_REGIONS.map(reg => (
                  <option key={reg} value={reg}>{reg}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nom complet du destinataire <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Ex: Ibrahima Diallo"
                className="w-full p-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Numéro de téléphone joignable (WhatsApp/Appels) <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="Ex: +221 77 123 45 67"
                className="w-full p-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Adresse exacte ou repère <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)}
                placeholder="Ex: Sacré-Cœur 3, Villa n°12, près de la boulangerie..."
                className="w-full p-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Instructions particulières pour le livreur (Optionnel)
              </label>
              <input
                type="text"
                value={deliveryNotes}
                onChange={e => setDeliveryNotes(e.target.value)}
                placeholder="Ex: Appeler avant de venir"
                className="w-full p-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Mode de règlement de la commande
                </label>
                <span className="text-[11px] text-slate-400">Paiement client</span>
              </div>

              {/* Only propose actually configured payment methods */}
              <div className="space-y-3">
                {allStoresAllowCod ? (
                  <label className="flex items-start gap-3 p-3.5 border-2 border-emerald-500 bg-emerald-50/40 rounded-xl cursor-pointer hover:bg-emerald-50/70 transition-colors">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="paiement_livraison"
                      checked={paymentMethod === 'paiement_livraison'}
                      onChange={() => setPaymentMethod('paiement_livraison')}
                      className="mt-1 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          Paiement en espèces à la livraison
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Configuré & Activé
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-600 block mt-1 leading-relaxed">
                        Réglez le livreur directement en espèces lors de la réception de votre colis. 0 FCFA de frais bancaires.
                      </span>
                    </div>
                  </label>
                ) : (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-rose-900">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>Paiement à la livraison non disponible</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      {storesDisallowingCod.map((g: any) => `« ${g.storeName} »`).join(', ')} n'a pas configuré le paiement à la livraison pour ses articles.
                    </p>
                  </div>
                )}

                {/* Online Payment Notice (Dynamic API required) */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-slate-400" />
                      Paiements en ligne Wave & Orange Money
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600">
                      Non disponible pour les commandes
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Les paiements Wave et Orange Money des commandes nécessitent une future intégration API dynamique, car leurs montants varient selon chaque panier d’achat. <strong>N'utilisez jamais les liens de paiement professionnels des vendeurs pour régler une commande client.</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Price Summary Calculation */}
            <div className="pt-4 border-t border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Commission plateforme</span>
                <span className="font-semibold text-emerald-600">0 FCFA (0%)</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Frais de livraison ({selectedRegion})</span>
                <span className="tabular-nums font-medium text-slate-900">
                  {formatFCFA(groups.reduce((acc: number, g: any) => acc + g.deliveryFee, 0))}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-100">
                <span>Total à régler</span>
                <span className="tabular-nums text-lg text-blue-700">
                  {formatFCFA(grandTotal)}
                </span>
              </div>
            </div>

            {/* Submit CTA */}
            {!user ? (
              <button
                type="button"
                onClick={() => openAuth('login')}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-sm transition-colors"
              >
                Connectez-vous pour valider la commande
              </button>
            ) : !allStoresAllowCod ? (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled
                  className="w-full py-3.5 bg-slate-200 text-slate-500 font-bold text-sm rounded-xl cursor-not-allowed"
                >
                  Aucun moyen de paiement disponible
                </button>
                <p className="text-[11px] text-center text-rose-600 font-medium">
                  Le paiement en ligne n’est pas disponible et le paiement à la livraison n’est pas configuré. Aucune commande ne peut être passée.
                </p>
              </div>
            ) : (
              <button
                type="submit"
                disabled={submittingOrder || loadingQuote}
                className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submittingOrder ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Confirmer et envoyer la commande'
                )}
              </button>
            )}

            <p className="text-[11px] text-center text-slate-400">
              Chaque boutique est directement notifiée et prendra contact avec vous par téléphone ou messagerie pour la livraison.
            </p>
          </form>

        </div>

      </div>

    </div>
  );
};
