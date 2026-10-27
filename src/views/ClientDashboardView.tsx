import React, { useEffect, useState } from 'react';
import { Package, MessageSquare, Star, User, Store, Send, CheckCircle, Clock, Truck, XCircle, AlertCircle, Brain, Sparkles, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { apiFetch, formatFCFA } from '../api/client.js';
import type { Order, Conversation, Message, PlatformReview } from '../types/index.js';

export const ClientDashboardView: React.FC = () => {
  const { user, store, viewParams, navigate, refreshUser, showToast, refreshUnreadMessagesCount } = useAuth();
  const [activeTab, setActiveTab] = useState<'orders' | 'messages' | 'review' | 'profile' | 'create-store'>(
    viewParams.tab || 'orders'
  );

  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Messaging
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(viewParams.activeConversationId || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  // Review Form
  const [rating, setRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // Profile Form
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Store creation form
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreDescription, setNewStoreDescription] = useState('');
  const [newStorePhone, setNewStorePhone] = useState(user?.phone || '');
  const [newStoreAddress, setNewStoreAddress] = useState('');
  const [newStoreCity, setNewStoreCity] = useState('Dakar');
  const [creatingStore, setCreatingStore] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);

  useEffect(() => {
    if (viewParams.tab) {
      setActiveTab(viewParams.tab);
    }
    if (viewParams.activeConversationId) {
      setActiveConversationId(viewParams.activeConversationId);
    }
  }, [viewParams]);

  // Load orders
  useEffect(() => {
    async function loadOrders() {
      setLoadingOrders(true);
      try {
        const res = await apiFetch<{ orders: Order[] }>('/customer/orders');
        setOrders(res.orders || []);
      } catch (e) {
        console.error('Erreur chargement commandes:', e);
      } finally {
        setLoadingOrders(false);
      }
    }
    if (activeTab === 'orders') {
      loadOrders();
    }
  }, [activeTab]);

  // Load conversations
  useEffect(() => {
    async function loadConvs() {
      try {
        const res = await apiFetch<{ conversations: Conversation[] }>('/conversations');
        setConversations(res.conversations || []);
        if (!activeConversationId && res.conversations && res.conversations.length > 0) {
          setActiveConversationId(res.conversations[0].id);
        }
      } catch (e) {
        console.error('Erreur conversations:', e);
      }
    }
    if (activeTab === 'messages') {
      loadConvs();
    }
  }, [activeTab]);

  // Load messages for selected conversation
  useEffect(() => {
    async function loadMsgs() {
      if (!activeConversationId) return;
      setLoadingMessages(true);
      try {
        const res = await apiFetch<{ messages: Message[] }>(`/conversations/${activeConversationId}/messages`);
        setMessages(res.messages || []);
        refreshUnreadMessagesCount();
      } catch (e) {
        console.error('Erreur chargement messages:', e);
      } finally {
        setLoadingMessages(false);
      }
    }
    if (activeTab === 'messages' && activeConversationId) {
      loadMsgs();
    }
  }, [activeConversationId, activeTab]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversationId || sendingMessage) return;
    setSendingMessage(true);
    try {
      const res = await apiFetch<{ success: boolean; message: Message }>(`/conversations/${activeConversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: newMessage.trim() })
      });
      setMessages(prev => [...prev, res.message]);
      setNewMessage('');
      setConversations(prev =>
        prev.map(c =>
          c.id === activeConversationId
            ? { ...c, last_message: res.message.content, last_message_date: res.message.created_at }
            : c
        )
      );
    } catch (e: any) {
      showToast(e.message || 'Erreur lors de l’envoi du message.', 'error');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSuggestDraft = async () => {
    if (!activeConversationId) return;
    setLoadingDraft(true);
    try {
      const res = await apiFetch<{ draft: string; available: boolean; error?: string }>('/ai/draft-response', {
        method: 'POST',
        body: JSON.stringify({ conversationId: activeConversationId })
      });

      if (!res.available || res.error) {
        showToast(res.error || "L'assistance d'IA n'est pas disponible actuellement.", 'info');
      } else if (res.draft) {
        setNewMessage(res.draft);
        showToast("Brouillon suggéré par l'IA de MARKET SÉNÉGAL. Vous pouvez le relire, l'éditer et l'envoyer.", 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la suggestion de brouillon.', 'error');
    } finally {
      setLoadingDraft(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim()) return;
    setSubmittingReview(true);
    try {
      await apiFetch('/reviews', {
        method: 'POST',
        body: JSON.stringify({ rating, comment: reviewComment })
      });
      setReviewSubmitted(true);
      showToast('Merci ! Votre avis a été enregistré sur MARKET SÉNÉGAL.', 'success');
      setReviewComment('');
    } catch (e: any) {
      showToast(e.message || 'Erreur soumission avis', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await apiFetch('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ full_name: fullName, phone })
      });
      await refreshUser();
      showToast('Profil mis à jour.', 'success');
    } catch (e: any) {
      showToast(e.message || 'Erreur mise à jour profil', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setStoreError(null);
    setCreatingStore(true);
    try {
      const res = await apiFetch('/stores', {
        method: 'POST',
        body: JSON.stringify({
          name: newStoreName,
          description: newStoreDescription,
          phone: newStorePhone,
          address: newStoreAddress,
          city: newStoreCity
        })
      });
      await refreshUser();
      showToast(`Félicitations ! Votre boutique "${res.store.name}" est immédiatement active.`, 'success');
      navigate('vendor-dashboard');
    } catch (e: any) {
      setStoreError(e.message || 'Erreur création boutique.');
    } finally {
      setCreatingStore(false);
    }
  };

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'en_attente':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" /> En attente
          </span>
        );
      case 'confirmee':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle className="w-3 h-3" /> Confirmée
          </span>
        );
      case 'en_livraison':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Truck className="w-3 h-3" /> En cours d'expédition
          </span>
        );
      case 'livree':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3 h-3" /> Livrée avec succès
          </span>
        );
      case 'annulee':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" /> Annulée
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Client Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs text-slate-500">Espace Client</span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{user?.full_name}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{user?.email} · Compte vérifié</p>
        </div>

        {store ? (
          <button
            onClick={() => navigate('vendor-dashboard')}
            className="px-4 py-2 bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2"
          >
            <Store className="w-4 h-4" />
            Gérer ma boutique ({store.name})
          </button>
        ) : (
          <button
            onClick={() => setActiveTab('create-store')}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 shadow-xs"
          >
            <Store className="w-4 h-4" />
            Ouvrir ma boutique (0% commission)
          </button>
        )}
      </div>

      {/* Tabs Menu */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto text-xs font-semibold pb-px">
        <button
          onClick={() => setActiveTab('orders')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'orders' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
        >
          <Package className="w-4 h-4" />
          Mes Commandes ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('messages')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'messages' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
        >
          <MessageSquare className="w-4 h-4" />
          Messagerie vendeurs ({conversations.length})
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'review' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
        >
          <Star className="w-4 h-4 text-amber-500" />
          Avis sur Market Sénégal
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'profile' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
        >
          <User className="w-4 h-4" />
          Profil & Coordonnées
        </button>
        {!store && (
          <button
            onClick={() => setActiveTab('create-store')}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'create-store' ? 'border-orange-600 text-orange-600' : 'border-transparent text-orange-600 hover:text-orange-700'}`}
          >
            <Store className="w-4 h-4" />
            Créer une boutique
          </button>
        )}
      </div>

      {/* Tab 1: Orders */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {loadingOrders ? (
            <div className="p-12 text-center text-xs text-slate-400">Chargement de vos commandes...</div>
          ) : orders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center space-y-3">
              <Package className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-semibold text-slate-800">Vous n'avez pas encore passé de commande</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Vos commandes passées auprès des boutiques du Sénégal apparaîtront ici avec leur suivi en temps réel.
              </p>
              <div>
                <button
                  onClick={() => navigate('search')}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
                >
                  Découvrir les articles
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map(order => (
                <div key={order.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <div className="text-xs text-slate-500">
                        Commande <span className="font-bold text-slate-800">{order.order_number}</span> · Passée le {new Date(order.created_at).toLocaleDateString('fr-FR')}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 mt-0.5">
                        Boutique : {order.store_name}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {getStatusBadge(order.status)}
                      <span className="text-base font-bold text-slate-900 tabular-nums">
                        {formatFCFA(order.total_fcfa)}
                      </span>
                    </div>
                  </div>

                  {/* Order items */}
                  <div className="divide-y divide-slate-100 text-xs">
                    {order.items?.map(it => (
                      <div key={it.id} className="py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img
                            src={it.product_image || '/assets/aistudio/a_clean_professional_vector_logo_graphic_on_a_whi_98efa245.png'}
                            alt={it.product_name}
                            className="w-10 h-10 rounded-lg object-cover bg-slate-100 border border-slate-200"
                          />
                          <div>
                            <span className="font-semibold text-slate-800">{it.product_name}</span>
                            <span className="text-slate-400 block">Quantité : {it.quantity} × {formatFCFA(it.unit_price_fcfa)}</span>
                          </div>
                        </div>
                        <span className="font-semibold tabular-nums text-slate-900">{formatFCFA(it.total_price_fcfa)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Delivery and payment notes */}
                  <div className="bg-slate-50 p-3.5 rounded-xl text-xs text-slate-600 flex flex-col sm:flex-row justify-between gap-2 border border-slate-100">
                    <div>
                      <span className="font-semibold text-slate-700">Adresse de livraison : </span>
                      <span>{order.delivery_address} ({order.delivery_region})</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Paiement : </span>
                      <span>{order.payment_method === 'paiement_livraison' ? 'En espèces à la livraison' : order.payment_method}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Messaging */}
      {activeTab === 'messages' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs grid grid-cols-1 md:grid-cols-12 min-h-[500px]">
          {/* Convs list */}
          <div className="md:col-span-4 border-r border-slate-200 divide-y divide-slate-100 overflow-y-auto max-h-[600px]">
            <div className="p-4 bg-slate-50 font-bold text-xs text-slate-700 uppercase tracking-wider">
              Discussions
            </div>
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Aucune discussion active. Ouvrez une fiche produit pour contacter une boutique.
              </div>
            ) : (
              conversations.map(c => (
                <button
                  key={c.id}
                  onClick={() => setActiveConversationId(c.id)}
                  className={`w-full text-left p-4 hover:bg-slate-50 transition-colors flex items-start justify-between gap-2 ${activeConversationId === c.id ? 'bg-blue-50/60' : ''}`}
                >
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{c.store_name}</h4>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{c.last_message || 'Nouvelle discussion'}</p>
                  </div>
                  {c.unread_count && c.unread_count > 0 ? (
                    <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shrink-0">
                      {c.unread_count}
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </div>

          {/* Active Conversation Messages */}
          <div className="md:col-span-8 flex flex-col justify-between h-[600px]">
            {activeConversationId ? (
              <>
                {/* Messages feed */}
                <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-slate-50/40">
                  {loadingMessages ? (
                    <div className="text-center text-xs text-slate-400 py-10">Chargement des messages...</div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-xs text-slate-400 py-10">
                      Début de la conversation. Posez vos questions au vendeur.
                    </div>
                  ) : (
                    messages.map(m => {
                      const isMe = m.sender_id === user?.id;
                      return (
                        <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-md p-3 rounded-2xl text-xs leading-relaxed ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-xs'}`}
                          >
                            <p>{m.content}</p>
                            <span className={`block text-[10px] mt-1 text-right ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                              {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* AI Draft assistance banner */}
                <div className="flex items-center justify-between px-4 py-2 bg-indigo-50/80 border-t border-indigo-100 text-[11px] text-indigo-950">
                  <span className="flex items-center gap-1.5 font-medium text-indigo-800">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Aide à la discussion
                  </span>
                  <button
                    type="button"
                    onClick={handleSuggestDraft}
                    disabled={loadingDraft}
                    className="font-bold text-indigo-700 hover:text-indigo-900 transition-colors flex items-center gap-1.5 bg-white px-3 py-1 rounded-lg border border-indigo-200 shadow-2xs hover:bg-indigo-50 cursor-pointer disabled:opacity-50"
                  >
                    {loadingDraft ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Génération du brouillon...
                      </>
                    ) : (
                      <>
                        <Brain className="w-3.5 h-3.5 text-indigo-600" />
                        Suggérer un brouillon avec l'IA
                      </>
                    )}
                  </button>
                </div>

                {/* Input box */}
                <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-200 flex items-center gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Écrivez votre message au vendeur (ou utilisez l'IA pour suggérer un brouillon)..."
                    disabled={sendingMessage}
                    className="flex-1 p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={sendingMessage || !newMessage.trim()}
                    className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {sendingMessage ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">
                Sélectionnez une discussion pour afficher les messages.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Platform Review */}
      {activeTab === 'review' && (
        <div className="max-w-2xl bg-white p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Votre avis sur MARKET SÉNÉGAL</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Vos avis portent sur l'expérience globale de la plateforme MARKET SÉNÉGAL (ergonomie, transparence, 0% de commission, respect des engagements).
            </p>
          </div>

          {reviewSubmitted ? (
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs space-y-2 text-center">
              <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto" />
              <h3 className="font-bold text-sm">Merci pour votre retour d'expérience !</h3>
              <p>Votre avis a été soumis avec succès et apparaît sur la plateforme.</p>
              <button
                onClick={() => setReviewSubmitted(false)}
                className="mt-2 text-xs font-semibold text-emerald-700 underline"
              >
                Déposer un autre avis
              </button>
            </div>
          ) : (
            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Note sur 5 étoiles</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setRating(star)}
                      className="p-1 focus:outline-none"
                    >
                      <Star
                        className={`w-7 h-7 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-slate-700 ml-2">{rating} / 5</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Votre commentaire d'évaluation <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  placeholder="Partagez votre avis sincère sur l'utilisation du grand marché en ligne du Sénégal..."
                  className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submittingReview}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {submittingReview ? 'Envoi en cours...' : 'Publier mon avis'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Tab 4: Profile */}
      {activeTab === 'profile' && (
        <div className="max-w-xl bg-white p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Coordonnées du compte</h2>
          
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nom complet</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Téléphone au Sénégal</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+221 77 000 00 00"
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Adresse e-mail</label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full p-2.5 text-xs border border-slate-200 bg-slate-100 text-slate-500 rounded-xl cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors"
            >
              {savingProfile ? 'Enregistrement...' : 'Mettre à jour mes coordonnées'}
            </button>
          </form>
        </div>
      )}

      {/* Tab 5: Create Store */}
      {activeTab === 'create-store' && !store && (
        <div className="max-w-2xl bg-white p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div>
            <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">Lancement Commerçant</span>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1">Ouvrir ma boutique sur MARKET SÉNÉGAL</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Votre boutique est activée instantanément sans délai d'attente. Vous pourrez publier vos produits, configurer vos tarifs de livraison par région et encaisser vos ventes à 0% de commission.
            </p>
          </div>

          {storeError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{storeError}</span>
            </div>
          )}

          <form onSubmit={handleCreateStore} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nom de la boutique <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newStoreName}
                onChange={e => setNewStoreName(e.target.value)}
                placeholder="Ex: Teranga Mode, SenArtisanat, Électro Dakar..."
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Présentation / Description de votre activité
              </label>
              <textarea
                rows={3}
                value={newStoreDescription}
                onChange={e => setNewStoreDescription(e.target.value)}
                placeholder="Décrivez vos articles, votre savoir-faire ou vos spécialités..."
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Téléphone professionnel <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={newStorePhone}
                  onChange={e => setNewStorePhone(e.target.value)}
                  placeholder="+221 77 000 00 00"
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Région du siège <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newStoreCity}
                  onChange={e => setNewStoreCity(e.target.value)}
                  placeholder="Ex: Dakar, Thiès, Saint-Louis..."
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Adresse physique ou quartier <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newStoreAddress}
                onChange={e => setNewStoreAddress(e.target.value)}
                placeholder="Ex: Marché Sandaga, Allée 4 ou Liberté 6..."
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={creatingStore}
              className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              {creatingStore ? 'Création en cours...' : 'Activer immédiatement ma boutique'}
            </button>
          </form>
        </div>
      )}

    </div>
  );
};
