import React, { useEffect, useState } from 'react';
import {
  Store as StoreIcon, Package, ShoppingCart, Truck, Tag, Percent,
  CreditCard, MessageSquare, Settings, Plus, Upload, Trash2, Eye, EyeOff,
  Download, CheckCircle, Clock, XCircle, AlertCircle, Sparkles, Send,
  ShieldCheck, ExternalLink, FileText, CheckCircle2, Brain, Wand2, Image as ImageIcon,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { apiFetch, formatFCFA } from '../api/client.js';
import type { Store, Product, StoreCategory, DeliveryZone, Coupon, Order, Conversation, Message, StoreCertification, Subscription } from '../types/index.js';
import { SENEGAL_REGIONS } from '../types/index.js';
import { CertifiedBadge } from '../components/CertifiedBadge.js';

export const VendorDashboardView: React.FC = () => {
  const { store, user, showToast, refreshUser, viewParams, refreshUnreadMessagesCount } = useAuth();

  const [activeTab, setActiveTab] = useState<
    'products' | 'orders' | 'delivery' | 'categories' | 'coupons' | 'pro_payments' | 'subscription' | 'certification' | 'settings' | 'messages'
  >((viewParams?.tab as any) || 'products');

  useEffect(() => {
    if (viewParams?.tab) {
      setActiveTab(viewParams.tab as any);
    }
    if (viewParams?.activeConversationId) {
      setActiveConvId(viewParams.activeConversationId);
    }
  }, [viewParams]);

  // Products
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Product form state
  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pComparePrice, setPComparePrice] = useState('');
  const [pStock, setPStock] = useState('1');
  const [pCatId, setPCatId] = useState('');
  const [pImages, setPImages] = useState<string[]>([]);
  const [pAiImages, setPAiImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pError, setPError] = useState<string | null>(null);

  // AI Product Image Generator Tool State
  const [aiImageModalOpen, setAiImageModalOpen] = useState(false);
  const [aiSelectedProduct, setAiSelectedProduct] = useState<Product | null>(null);
  const [aiProdName, setAiProdName] = useState('');
  const [aiProdDesc, setAiProdDesc] = useState('');
  const [aiProdCategory, setAiProdCategory] = useState('');
  const [aiRefPhoto, setAiRefPhoto] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGeneratedResult, setAiGeneratedResult] = useState<string | null>(null);
  const [aiGeneratedError, setAiGeneratedError] = useState<string | null>(null);
  const [aiQuotaRemaining, setAiQuotaRemaining] = useState<number | null>(null);

  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Delivery Zones
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [newZoneRegion, setNewZoneRegion] = useState<string>(SENEGAL_REGIONS[0]);
  const [newZonePrice, setNewZonePrice] = useState<string>('2000');
  const [newZoneDelay, setNewZoneDelay] = useState<string>('24h-48h');

  // Categories
  const [newCategoryName, setNewCategoryName] = useState('');

  // Coupons (Croissance plan)
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponPercent, setNewCouponPercent] = useState('10');
  const [newCouponMin, setNewCouponMin] = useState('5000');

  // Subscriptions
  const [vendorSubscriptions, setVendorSubscriptions] = useState<Subscription[]>([]);
  const [pendingSubscription, setPendingSubscription] = useState<Subscription | null>(null);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [subPaymentRef, setSubPaymentRef] = useState('');
  const [subProofUrl, setSubProofUrl] = useState('');
  const [subNotes, setSubNotes] = useState('');
  const [uploadingSubProof, setUploadingSubProof] = useState(false);
  const [submittingSub, setSubmittingSub] = useState(false);
  const [waveLinkClicked, setWaveLinkClicked] = useState(false);
  const [waveCertClicked, setWaveCertClicked] = useState(false);
  const [proPaymentsSubTab, setProPaymentsSubTab] = useState<'all' | 'subscriptions' | 'certification' | 'history'>('all');
  const [proPaymentsData, setProPaymentsData] = useState<any>(null);
  const [loadingProPayments, setLoadingProPayments] = useState(false);

  // Certification (10 000 FCFA via Wave)
  const [certData, setCertData] = useState<{
    store: Store;
    currentCert: StoreCertification | null;
    history: StoreCertification[];
  } | null>(null);
  const [loadingCert, setLoadingCert] = useState(false);
  const [waveRef, setWaveRef] = useState('');
  const [proofDocumentUrl, setProofDocumentUrl] = useState('');
  const [vendorCertNotes, setVendorCertNotes] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [submittingCert, setSubmittingCert] = useState(false);

  // Settings
  const [storeName, setStoreName] = useState(store?.name || '');
  const [storeDesc, setStoreDesc] = useState(store?.description || '');
  const [storePhone, setStorePhone] = useState(store?.phone || '');
  const [storeAddress, setStoreAddress] = useState(store?.address || '');
  const [storeCity, setStoreCity] = useState(store?.city || 'Dakar');
  const [storeAllowsCod, setStoreAllowsCod] = useState(store?.allows_cod !== false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Messaging
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [vendorNewMessage, setVendorNewMessage] = useState('');
  const [sendingVendorMessage, setSendingVendorMessage] = useState(false);
  const [loadingVendorDraft, setLoadingVendorDraft] = useState(false);

  // Stats
  const [stats, setStats] = useState<any>(null);

  const isCroissance = store?.plan_tier === 'croissance';

  const loadCertification = async () => {
    setLoadingCert(true);
    try {
      const res = await apiFetch<{
        store: Store;
        currentCert: StoreCertification | null;
        history: StoreCertification[];
      }>('/vendor/certification');
      setCertData(res);
      if (res.currentCert?.wave_payment_reference) {
        setWaveRef(res.currentCert.wave_payment_reference);
      }
    } catch (e) {
      console.error('Erreur chargement certification:', e);
    } finally {
      setLoadingCert(false);
    }
  };

  const loadSubscriptions = async () => {
    setLoadingSubscriptions(true);
    try {
      const res = await apiFetch<{
        subscriptions: Subscription[];
        pendingSubscription: Subscription | null;
        store: Store;
      }>('/vendor/subscriptions');
      setVendorSubscriptions(res.subscriptions || []);
      setPendingSubscription(res.pendingSubscription || null);
      if (res.pendingSubscription?.offline_payment_reference) {
        setSubPaymentRef(res.pendingSubscription.offline_payment_reference);
      }
      if (res.pendingSubscription?.proof_document_url) {
        setSubProofUrl(res.pendingSubscription.proof_document_url);
      }
    } catch (e) {
      console.error('Erreur chargement abonnements:', e);
    } finally {
      setLoadingSubscriptions(false);
    }
  };

  const loadProPayments = async () => {
    setLoadingProPayments(true);
    try {
      const res = await apiFetch<any>('/vendor/pro-payments');
      setProPaymentsData(res);
      if (res.subscriptions) {
        setVendorSubscriptions(res.subscriptions);
        const pending = res.subscriptions.find((s: any) => s.status === 'paiement_a_verifier' || s.status === 'en_attente') || null;
        setPendingSubscription(pending);
        if (pending?.offline_payment_reference) {
          setSubPaymentRef(pending.offline_payment_reference);
        }
        if (pending?.proof_document_url) {
          setSubProofUrl(pending.proof_document_url);
        }
      }
      if (res.currentCert) {
        setCertData({
          store: res.store || store!,
          currentCert: res.currentCert,
          history: res.certifications || []
        });
        if (res.currentCert.wave_payment_reference) {
          setWaveRef(res.currentCert.wave_payment_reference);
        }
        if (res.currentCert.proof_document_url) {
          setProofDocumentUrl(res.currentCert.proof_document_url);
        }
      }
    } catch (e) {
      console.error('Erreur chargement paiements pro:', e);
    } finally {
      setLoadingProPayments(false);
    }
  };

  // Load products
  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        apiFetch<{ products: Product[] }>('/vendor/products'),
        apiFetch<{ categories: StoreCategory[] }>('/vendor/categories')
      ]);
      setProducts(prodRes.products || []);
      setCategories(catRes.categories || []);
    } catch (e) {
      console.error('Erreur chargement catalogue vendeur:', e);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Load orders
  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await apiFetch<{ orders: Order[] }>('/vendor/orders');
      setOrders(res.orders || []);
    } catch (e) {
      console.error('Erreur commandes vendeur:', e);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Load delivery zones
  const loadDeliveryZones = async () => {
    try {
      const res = await apiFetch<{ zones: DeliveryZone[] }>('/vendor/delivery-zones');
      setDeliveryZones(res.zones || []);
    } catch (e) {
      console.error('Erreur zones livraison:', e);
    }
  };

  // Load coupons
  const loadCoupons = async () => {
    if (!isCroissance) return;
    try {
      const res = await apiFetch<{ coupons: Coupon[] }>('/vendor/coupons');
      setCoupons(res.coupons || []);
    } catch (e) {
      console.error('Erreur coupons:', e);
    }
  };

  // Load stats
  const loadStats = async () => {
    try {
      const res = await apiFetch('/vendor/stats');
      setStats(res);
    } catch (e) {
      console.error('Erreur stats vendeur:', e);
    }
  };

  // Load conversations
  const loadConversations = async () => {
    try {
      const res = await apiFetch<{ conversations: Conversation[] }>('/conversations');
      setConversations(res.conversations || []);
      if (!activeConvId && res.conversations?.length > 0) {
        setActiveConvId(res.conversations[0].id);
      }
    } catch (e) {
      console.error('Erreur convs vendeur:', e);
    }
  };

  useEffect(() => {
    loadProducts();
    loadDeliveryZones();
    loadStats();
    loadCertification();
  }, [store]);

  useEffect(() => {
    if (activeTab === 'orders') loadOrders();
    if (activeTab === 'coupons') loadCoupons();
    if (activeTab === 'messages') loadConversations();
    if (activeTab === 'certification') loadCertification();
    if (activeTab === 'subscription') loadSubscriptions();
    if (activeTab === 'pro_payments') loadProPayments();
  }, [activeTab]);

  // Load active conversation messages
  useEffect(() => {
    async function fetchMsgs() {
      if (!activeConvId) return;
      try {
        const res = await apiFetch<{ messages: Message[] }>(`/conversations/${activeConvId}/messages`);
        setMessages(res.messages || []);
        refreshUnreadMessagesCount();
      } catch (e) {
        console.error(e);
      }
    }
    if (activeConvId && activeTab === 'messages') {
      fetchMsgs();
    }
  }, [activeConvId, activeTab]);

  // Image Upload handler
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);

    setUploadingImage(true);
    setPError(null);
    try {
      const res = await apiFetch('/upload', {
        method: 'POST',
        body: formData
      });
      setPImages(prev => [...prev, res.url]);
      showToast('Photo téléchargée avec succès.', 'success');
    } catch (err: any) {
      setPError(err.message || 'Erreur lors du téléchargement de l’image.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Save product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setPError(null);

    if (pImages.length === 0) {
      setPError('Chaque produit doit avoir au moins une photo avant sa publication.');
      return;
    }

    try {
      const payload = {
        name: pName,
        description: pDesc,
        price_fcfa: Number(pPrice),
        compare_price_fcfa: pComparePrice ? Number(pComparePrice) : undefined,
        stock_quantity: Number(pStock),
        category_id: pCatId || undefined,
        images: pImages
      };

      if (editingProductId) {
        await apiFetch(`/vendor/products/${editingProductId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast('Produit mis à jour avec succès.', 'success');
      } else {
        await apiFetch('/vendor/products', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast('Nouveau produit publié avec succès !', 'success');
      }

      setProductModalOpen(false);
      resetProductForm();
      loadProducts();
    } catch (err: any) {
      setPError(err.message || 'Erreur enregistrement produit.');
    }
  };

  const resetProductForm = () => {
    setEditingProductId(null);
    setPName('');
    setPDesc('');
    setPPrice('');
    setPComparePrice('');
    setPStock('1');
    setPCatId('');
    setPImages([]);
    setPError(null);
  };

  const openEditProduct = (prod: Product) => {
    setEditingProductId(prod.id);
    setPName(prod.name);
    setPDesc(prod.description);
    setPPrice(String(prod.price_fcfa));
    setPComparePrice(prod.compare_price_fcfa ? String(prod.compare_price_fcfa) : '');
    setPStock(String(prod.stock_quantity));
    setPCatId(prod.category_id || '');
    setPImages(prod.images || []);
    setProductModalOpen(true);
  };

  const handleToggleProductStatus = async (prod: Product) => {
    try {
      await apiFetch(`/vendor/products/${prod.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !prod.is_active })
      });
      loadProducts();
      showToast(prod.is_active ? 'Produit masqué du catalogue.' : 'Produit activé et visible.', 'info');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer définitivement cet article ?')) return;
    try {
      await apiFetch(`/vendor/products/${id}`, { method: 'DELETE' });
      loadProducts();
      showToast('Article supprimé.', 'info');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // Order status update
  const handleUpdateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      await apiFetch(`/vendor/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      loadOrders();
      showToast('Statut de la commande mis à jour.', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // Add delivery zone
  const handleAddDeliveryZone = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/vendor/delivery-zones', {
        method: 'POST',
        body: JSON.stringify({
          region: newZoneRegion,
          price_fcfa: Number(newZonePrice),
          estimated_days: newZoneDelay
        })
      });
      loadDeliveryZones();
      showToast(`Zone "${newZoneRegion}" configurée.`, 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleDeleteDeliveryZone = async (id: string) => {
    try {
      await apiFetch(`/vendor/delivery-zones/${id}`, { method: 'DELETE' });
      loadDeliveryZones();
      showToast('Zone supprimée.', 'info');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // Category creation
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await apiFetch('/vendor/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCategoryName.trim() })
      });
      setNewCategoryName('');
      loadProducts();
      showToast('Catégorie ajoutée.', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // Coupon creation
  const handleAddCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCouponCode.trim()) return;
    try {
      await apiFetch('/vendor/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: newCouponCode,
          discount_percent: Number(newCouponPercent),
          min_order_amount_fcfa: Number(newCouponMin)
        })
      });
      setNewCouponCode('');
      loadCoupons();
      showToast('Code promo créé !', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // Subscription Request (Forfait Essentiel - 8 000 FCFA Wave)
  const handleSubscriptionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subPaymentRef.trim() && !subProofUrl) {
      showToast('Veuillez renseigner votre référence de paiement Wave ou joindre un justificatif.', 'error');
      return;
    }

    if (subPaymentRef.trim() && proPaymentsData?.history?.some((h: any) => h.payment_reference?.trim().toLowerCase() === subPaymentRef.trim().toLowerCase())) {
      showToast('Cette référence Wave a déjà été enregistrée pour un paiement. Chaque règlement doit avoir une référence unique.', 'error');
      return;
    }

    setSubmittingSub(true);
    try {
      await apiFetch('/vendor/subscriptions/request', {
        method: 'POST',
        body: JSON.stringify({
          planTier: 'essentiel',
          offlineReference: subPaymentRef.trim(),
          proofDocumentUrl: subProofUrl,
          notes: subNotes.trim()
        })
      });
      showToast('Demande enregistrée au statut « Paiement à vérifier ». L’administrateur validera après vérification du reçu.', 'success');
      loadSubscriptions();
      loadProPayments();
      refreshUser();
    } catch (e: any) {
      showToast(e.message || 'Erreur lors de la transmission.', 'error');
    } finally {
      setSubmittingSub(false);
    }
  };

  // Proof document upload for subscription
  const handleSubProofFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);

    setUploadingSubProof(true);
    try {
      const res = await apiFetch<{ url: string }>('/upload', {
        method: 'POST',
        body: formData
      });
      setSubProofUrl(res.url);
      showToast('Reçu ou capture du paiement Wave enregistré avec succès.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Échec du téléchargement du justificatif.', 'error');
    } finally {
      setUploadingSubProof(false);
    }
  };

  // Proof doc upload for certification
  const handleProofDocFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);

    setUploadingProof(true);
    try {
      const res = await apiFetch<{ url: string }>('/upload', {
        method: 'POST',
        body: formData
      });
      setProofDocumentUrl(res.url);
      showToast('Document justificatif enregistré avec succès.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Échec du téléchargement du document.', 'error');
    } finally {
      setUploadingProof(false);
    }
  };

  // Submit certification request
  const handleSubmitCertification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waveRef.trim()) {
      showToast('Veuillez renseigner la référence de transaction Wave (10 000 FCFA).', 'error');
      return;
    }

    if (waveRef.trim() && proPaymentsData?.history?.some((h: any) => h.payment_reference?.trim().toLowerCase() === waveRef.trim().toLowerCase())) {
      showToast('Cette référence Wave a déjà été enregistrée pour un paiement. Chaque règlement doit avoir une référence unique.', 'error');
      return;
    }

    setSubmittingCert(true);
    try {
      const res = await apiFetch<{
        success: boolean;
        certification: StoreCertification;
        store: Store;
        message: string;
      }>('/vendor/certification/request', {
        method: 'POST',
        body: JSON.stringify({
          wavePaymentReference: waveRef.trim(),
          proofDocumentUrl: proofDocumentUrl || undefined,
          vendorNotes: vendorCertNotes || undefined
        })
      });
      await loadCertification();
      await loadProPayments();
      await refreshUser();
      showToast(res.message || 'Demande de certification transmise.', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSubmittingCert(false);
    }
  };

  // Save Store Settings
  const handleSaveStoreSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await apiFetch('/vendor/store', {
        method: 'PUT',
        body: JSON.stringify({
          name: storeName,
          description: storeDesc,
          phone: storePhone,
          address: storeAddress,
          city: storeCity,
          allows_cod: storeAllowsCod
        })
      });
      await refreshUser();
      showToast('Paramètres de la boutique mis à jour.', 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // Send message from vendor
  const handleSendVendorMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorNewMessage.trim() || !activeConvId || sendingVendorMessage) return;
    setSendingVendorMessage(true);
    try {
      const res = await apiFetch<{ success: boolean; message: Message }>(`/conversations/${activeConvId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: vendorNewMessage.trim() })
      });
      setMessages(prev => [...prev, res.message]);
      setVendorNewMessage('');
      setConversations(prev =>
        prev.map(c =>
          c.id === activeConvId
            ? { ...c, last_message: res.message.content, last_message_date: res.message.created_at }
            : c
        )
      );
    } catch (e: any) {
      showToast(e.message || 'Erreur lors de l’envoi du message.', 'error');
    } finally {
      setSendingVendorMessage(false);
    }
  };

  const handleVendorSuggestDraft = async () => {
    if (!activeConvId) return;
    setLoadingVendorDraft(true);
    try {
      const res = await apiFetch<{ draft: string; available: boolean; error?: string }>('/ai/draft-response', {
        method: 'POST',
        body: JSON.stringify({ conversationId: activeConvId })
      });

      if (!res.available || res.error) {
        showToast(res.error || "L'assistance d'IA n'est pas configurée actuellement.", 'info');
      } else if (res.draft) {
        setVendorNewMessage(res.draft);
        showToast("Brouillon suggéré par l'IA de MARKET SÉNÉGAL. Vous pouvez le relire, l'éditer et l'envoyer.", 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la suggestion du brouillon.', 'error');
    } finally {
      setLoadingVendorDraft(false);
    }
  };

  if (!store) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Top Banner & KPI Strip */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                Espace Vendeur Officiel
              </span>
              <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-200">
                0% de commission sur les ventes
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{store.name}</h1>
              {store.is_certified && <CertifiedBadge size="md" />}
            </div>
            <p className="text-xs text-slate-500">{store.city} · Forfait actuel : <span className="font-semibold text-slate-700 uppercase">{store.plan_tier}</span></p>
          </div>

          <div className="flex items-center gap-3">
            {isCroissance && (
              <a
                href="/api/vendor/orders/export-csv"
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                Exporter commandes (CSV)
              </a>
            )}

            <button
              onClick={() => {
                resetProductForm();
                setProductModalOpen(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Ajouter un produit
            </button>
          </div>
        </div>

        {/* Real KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-slate-500 block">Total Articles</span>
            <span className="text-xl font-bold text-slate-900 tabular-nums">{products.length}</span>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-slate-500 block">Commandes reçues</span>
            <span className="text-xl font-bold text-slate-900 tabular-nums">{orders.length}</span>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-slate-500 block">Chiffre d'affaires perçu</span>
            <span className="text-xl font-bold text-blue-700 tabular-nums">
              {formatFCFA(stats?.totalRevenueFcfa || 0)}
            </span>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="text-slate-500 block">Zones desservies</span>
            <span className="text-xl font-bold text-slate-900 tabular-nums">{deliveryZones.length} / 14</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto text-xs font-semibold pb-px">
        <button
          onClick={() => setActiveTab('products')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'products' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
        >
          <Package className="w-4 h-4" />
          Produits & Stocks ({products.length})
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'orders' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
        >
          <ShoppingCart className="w-4 h-4" />
          Commandes ({orders.length})
        </button>

        <button
          onClick={() => setActiveTab('delivery')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'delivery' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
        >
          <Truck className="w-4 h-4" />
          Livraisons & Régions ({deliveryZones.length})
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'categories' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
        >
          <Tag className="w-4 h-4" />
          Mes Catégories ({categories.length})
        </button>

        <button
          onClick={() => setActiveTab('coupons')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'coupons' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
        >
          <Percent className="w-4 h-4" />
          Codes Promo {isCroissance ? `(${coupons.length})` : '(Croissance)'}
        </button>

        <button
          onClick={() => setActiveTab('messages')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'messages' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
        >
          <MessageSquare className="w-4 h-4" />
          Messages Clients ({conversations.length})
        </button>

        <button
          onClick={() => {
            setActiveTab('pro_payments');
            loadProPayments();
          }}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'pro_payments' || activeTab === 'subscription' || activeTab === 'certification' ? 'border-blue-600 text-blue-700 font-bold' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Abonnements et services de ma boutique</span>
          {store?.is_certified ? (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 rounded">
              Certifiée
            </span>
          ) : store?.certification_status === 'paiement_a_verifier' || pendingSubscription ? (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">
              Paiement à vérifier
            </span>
          ) : null}
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'settings' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
        >
          <Settings className="w-4 h-4" />
          Paramètres Boutique
        </button>
      </div>

      {/* Tab 1: Products Management */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Catalogue des produits</h2>
            <button
              onClick={() => { resetProductForm(); setProductModalOpen(true); }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Nouveau produit
            </button>
          </div>

          {loadingProducts ? (
            <div className="p-12 text-center text-xs text-slate-400">Chargement des produits...</div>
          ) : products.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center space-y-3">
              <Package className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-semibold text-slate-800">Aucun produit publié pour l'instant</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Chaque article doit comporter au minimum une photo avant d'être publié.
              </p>
              <div>
                <button
                  onClick={() => { resetProductForm(); setProductModalOpen(true); }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                >
                  Ajouter mon premier produit
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs divide-y divide-slate-200">
                <thead className="bg-slate-50 font-semibold text-slate-700">
                  <tr>
                    <th className="p-4">Article</th>
                    <th className="p-4">Prix</th>
                    <th className="p-4">Stock</th>
                    <th className="p-4">Statut</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map(prod => (
                    <tr key={prod.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={prod.images[0] || '/assets/aistudio/a_clean_professional_vector_logo_graphic_on_a_whi_98efa245.png'}
                            alt={prod.name}
                            className="w-12 h-12 rounded-lg object-cover bg-slate-100 border border-slate-200 shrink-0"
                          />
                          <div>
                            <span className="font-semibold text-slate-900 block">{prod.name}</span>
                            <span className="text-[11px] text-slate-400 truncate max-w-xs block">
                              {prod.description}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 font-bold text-slate-900 tabular-nums">
                        {formatFCFA(prod.price_fcfa)}
                      </td>

                      <td className="p-4 tabular-nums">
                        <span className={prod.stock_quantity > 0 ? 'text-emerald-700 font-semibold' : 'text-rose-600 font-semibold'}>
                          {prod.stock_quantity} disponible(s)
                        </span>
                      </td>

                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${prod.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                          {prod.is_active ? 'Actif' : 'Masqué'}
                        </span>
                      </td>

                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => handleToggleProductStatus(prod)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                          title={prod.is_active ? 'Masquer' : 'Activer'}
                        >
                          {prod.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => openEditProduct(prod)}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(prod.id)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Orders Management */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-slate-900">Commandes clients reçues</h2>

          {loadingOrders ? (
            <div className="p-12 text-center text-xs text-slate-400">Chargement des commandes...</div>
          ) : orders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center space-y-2">
              <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-semibold text-slate-800">Aucune commande pour le moment</h3>
              <p className="text-xs text-slate-500">
                Dès qu'un client passe commande de vos articles, vous la verrez s'afficher ici.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map(order => (
                <div key={order.id} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <div className="text-xs text-slate-500">
                        Commande <span className="font-bold text-slate-800">{order.order_number}</span> · {new Date(order.created_at).toLocaleDateString('fr-FR')}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 mt-0.5">
                        Client : {order.customer_name} ({order.customer_phone})
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-base font-bold text-slate-900 tabular-nums">
                        {formatFCFA(order.total_fcfa)}
                      </span>
                      <select
                        value={order.status}
                        onChange={e => handleUpdateOrderStatus(order.id, e.target.value as any)}
                        className="text-xs font-semibold p-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-800 cursor-pointer"
                      >
                        <option value="en_attente">En attente</option>
                        <option value="confirmee">Confirmée</option>
                        <option value="en_livraison">En cours de livraison</option>
                        <option value="livree">Livrée</option>
                        <option value="annulee">Annulée</option>
                      </select>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="divide-y divide-slate-100 text-xs">
                    {order.items?.map(it => (
                      <div key={it.id} className="py-2 flex items-center justify-between">
                        <span>{it.product_name} (x{it.quantity})</span>
                        <span className="font-bold tabular-nums text-slate-900">{formatFCFA(it.total_price_fcfa)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl text-xs text-slate-600 flex flex-col sm:flex-row justify-between gap-2 border border-slate-100">
                    <div>
                      <span className="font-semibold text-slate-700">Lieu de livraison : </span>
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

      {/* Tab 3: Delivery Zones Management */}
      {activeTab === 'delivery' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Zones et tarifs de livraison personnalisés</h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
              Sur MARKET SÉNÉGAL, aucune région n'est affichée au client sans que vous l'ayez expressément configurée. Définissez vos tarifs réels pour chaque région du Sénégal que vous desservez.
            </p>

            {/* Add Zone Form */}
            <form onSubmit={handleAddDeliveryZone} className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Région du Sénégal</label>
                <select
                  value={newZoneRegion}
                  onChange={e => setNewZoneRegion(e.target.value)}
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                >
                  {SENEGAL_REGIONS.map(reg => (
                    <option key={reg} value={reg}>{reg}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Frais de livraison (FCFA)</label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  required
                  value={newZonePrice}
                  onChange={e => setNewZonePrice(e.target.value)}
                  placeholder="Ex: 2000"
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Délai estimé</label>
                <input
                  type="text"
                  required
                  value={newZoneDelay}
                  onChange={e => setNewZoneDelay(e.target.value)}
                  placeholder="Ex: 24h ou 48h-72h"
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  Ajouter / Mettre à jour
                </button>
              </div>
            </form>
          </div>

          {/* Zones Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs divide-y divide-slate-200">
              <thead className="bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="p-4">Région</th>
                  <th className="p-4">Frais de port</th>
                  <th className="p-4">Délai estimé</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deliveryZones.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-400">
                      Aucune région configurée. Vos clients ne pourront pas choisir de livraison.
                    </td>
                  </tr>
                ) : (
                  deliveryZones.map(zone => (
                    <tr key={zone.id} className="hover:bg-slate-50/50">
                      <td className="p-4 font-bold text-slate-900">{zone.region}</td>
                      <td className="p-4 font-semibold text-slate-800 tabular-nums">{formatFCFA(zone.price_fcfa)}</td>
                      <td className="p-4 text-slate-500">{zone.estimated_days}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeleteDeliveryZone(zone.id)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Store Categories Management */}
      {activeTab === 'categories' && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Catégories personnalisées de votre boutique</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Vous êtes libre d'organiser vos produits selon vos propres rayons et catégories, sans catalogue global imposé.
            </p>

            <form onSubmit={handleAddCategory} className="flex items-center gap-2 pt-2">
              <input
                type="text"
                required
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                placeholder="Ex: Robes Wax, Chaussures Cuir, Cosmétiques Bio..."
                className="flex-1 p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs shrink-0"
              >
                Créer la catégorie
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs divide-y divide-slate-100 text-xs">
            {categories.length === 0 ? (
              <div className="p-8 text-center text-slate-400">Aucune catégorie créée pour l'instant.</div>
            ) : (
              categories.map(cat => (
                <div key={cat.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                  <span className="font-semibold text-slate-800">{cat.name}</span>
                  <button
                    onClick={async () => {
                      await apiFetch(`/vendor/categories/${cat.id}`, { method: 'DELETE' });
                      loadProducts();
                    }}
                    className="text-rose-500 hover:text-rose-700 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Coupons (Croissance Tier) */}
      {activeTab === 'coupons' && (
        <div className="space-y-6">
          {!isCroissance ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center space-y-3">
              <Sparkles className="w-10 h-10 text-amber-600 mx-auto" />
              <h3 className="text-base font-bold text-amber-900">Fonctionnalité réservée au forfait Croissance</h3>
              <p className="text-xs text-amber-800 max-w-md mx-auto leading-relaxed">
                Passez au forfait Croissance (18 000 FCFA / mois) pour créer des codes promotionnels personnalisés, exporter vos commandes en CSV et accéder à des statistiques de vente détaillées.
              </p>
              <div>
                <button
                  onClick={() => setActiveTab('subscription')}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  Découvrir le forfait Croissance
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h2 className="text-lg font-bold text-slate-900">Créer un code promotionnel</h2>
                <form onSubmit={handleAddCoupon} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Code promo</label>
                    <input
                      type="text"
                      required
                      value={newCouponCode}
                      onChange={e => setNewCouponCode(e.target.value)}
                      placeholder="Ex: TERANGA10"
                      className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Remise en %</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      required
                      value={newCouponPercent}
                      onChange={e => setNewCouponPercent(e.target.value)}
                      className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Montant min. (FCFA)</label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={newCouponMin}
                      onChange={e => setNewCouponMin(e.target.value)}
                      className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                    >
                      Activer le code promo
                    </button>
                  </div>
                </form>
              </div>

              {/* Coupons List */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs divide-y divide-slate-100 text-xs">
                {coupons.map(c => (
                  <div key={c.id} className="p-4 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 tracking-wider text-sm">{c.code}</span>
                      <span className="text-slate-500 block">-{c.discount_percent}% sur commandes dès {formatFCFA(c.min_order_amount_fcfa)}</span>
                    </div>
                    <span className="font-semibold text-emerald-600">Actif</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Messages */}
      {activeTab === 'messages' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs grid grid-cols-1 md:grid-cols-12 min-h-[500px]">
          <div className="md:col-span-4 border-r border-slate-200 divide-y divide-slate-100 overflow-y-auto max-h-[600px]">
            <div className="p-4 bg-slate-50 font-bold text-xs text-slate-700 uppercase tracking-wider">
              Clients
            </div>
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">Aucun message de client pour le moment.</div>
            ) : (
              conversations.map(c => (
                <button
                  key={c.id}
                  onClick={() => setActiveConvId(c.id)}
                  className={`w-full text-left p-4 hover:bg-slate-50 transition-colors flex items-start justify-between gap-2 ${activeConvId === c.id ? 'bg-blue-50/60' : ''}`}
                >
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{c.customer_name}</h4>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{c.last_message || 'Client intéressé'}</p>
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

          <div className="md:col-span-8 flex flex-col justify-between h-[600px]">
            {activeConvId ? (
              <>
                <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-slate-50/40">
                  {messages.map(m => {
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
                  })}
                </div>

                {/* AI Draft assistance banner */}
                <div className="flex items-center justify-between px-4 py-2 bg-indigo-50/80 border-t border-indigo-100 text-[11px] text-indigo-950">
                  <span className="flex items-center gap-1.5 font-medium text-indigo-800">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Aide à la réponse vendeur
                  </span>
                  <button
                    type="button"
                    onClick={handleVendorSuggestDraft}
                    disabled={loadingVendorDraft}
                    className="font-bold text-indigo-700 hover:text-indigo-900 transition-colors flex items-center gap-1.5 bg-white px-3 py-1 rounded-lg border border-indigo-200 shadow-2xs hover:bg-indigo-50 cursor-pointer disabled:opacity-50"
                  >
                    {loadingVendorDraft ? (
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

                <form onSubmit={handleSendVendorMessage} className="p-4 bg-white border-t border-slate-200 flex items-center gap-2">
                  <input
                    type="text"
                    value={vendorNewMessage}
                    onChange={e => setVendorNewMessage(e.target.value)}
                    placeholder="Répondre au client (ou utiliser l'IA pour suggérer un brouillon)..."
                    disabled={sendingVendorMessage}
                    className="flex-1 p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={sendingVendorMessage || !vendorNewMessage.trim()}
                    className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {sendingVendorMessage ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">
                Sélectionnez une conversation client.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Abonnements et services de ma boutique (Paiements professionnels des vendeurs) */}
      {(activeTab === 'pro_payments' || activeTab === 'subscription' || activeTab === 'certification') && (
        <div className="space-y-8">
          {/* Header & Sub-Navigation */}
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                    Espace Professionnel Vendeur
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    Paiements administratifs & services
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1.5 flex items-center gap-2">
                  Abonnements et services de ma boutique
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                  Gérez vos forfaits mensuels et votre certification officielle. Les paiements de commandes clients sont strictement séparés et ne transitent jamais par vos liens de paiement professionnels.
                </p>
              </div>

              {/* Status Chips */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Abonnement</span>
                  <span className="font-bold text-slate-800 capitalize">
                    {store?.plan_tier === 'croissance' ? 'Croissance (18 000 F)' : store?.plan_tier === 'essentiel' ? 'Essentiel (8 000 F)' : 'Gratuit standard'}
                  </span>
                </div>
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Certification</span>
                  <span className={`font-bold ${store?.is_certified ? 'text-blue-700' : 'text-slate-700'}`}>
                    {store?.is_certified ? 'Certifiée officielle' : store?.certification_status === 'paiement_a_verifier' ? 'Paiement à vérifier' : 'Non certifiée'}
                  </span>
                </div>
              </div>
            </div>

            {/* Sub-tab Filter Pills */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setProPaymentsSubTab('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  proPaymentsSubTab === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tous les services pro
              </button>
              <button
                type="button"
                onClick={() => setProPaymentsSubTab('subscriptions')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  proPaymentsSubTab === 'subscriptions'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Abonnements mensuels (8 000 F / 18 000 F)
              </button>
              <button
                type="button"
                onClick={() => setProPaymentsSubTab('certification')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  proPaymentsSubTab === 'certification'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Certification officielle (10 000 F)
              </button>
              <button
                type="button"
                onClick={() => {
                  setProPaymentsSubTab('history');
                  loadProPayments();
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  proPaymentsSubTab === 'history'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Historique des paiements pro {proPaymentsData?.history?.length ? `(${proPaymentsData.history.length})` : ''}
              </button>
            </div>
          </div>

          {/* SECTION 1: Abonnements mensuels (Displayed if 'all' or 'subscriptions') */}
          {(proPaymentsSubTab === 'all' || proPaymentsSubTab === 'subscriptions') && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    1. Abonnements mensuels de la boutique
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Forfaits mensuels pour bénéficier de 0% de commission sur vos ventes et des fonctionnalités avancées.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                  Renouvellement manuel mensuel (aucun prélèvement automatique)
                </span>
              </div>

              {/* Active / Pending Status Banner */}
              {pendingSubscription || waveLinkClicked ? (
                <div className="p-4 sm:p-5 bg-amber-50 border-2 border-amber-300 rounded-2xl space-y-2 text-xs shadow-xs">
                  <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
                    <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>Statut abonnement : Paiement à vérifier</span>
                  </div>
                  <p className="text-amber-800 leading-relaxed">
                    Le clic sur le lien ou le retour de Wave ne confirme pas automatiquement le paiement. L'administrateur de MARKET SÉNÉGAL doit vérifier l'encaissement effectif des 8 000 FCFA sur le compte Wave avant d'activer votre forfait Essentiel pour un mois (30 jours).
                  </p>
                  {pendingSubscription?.offline_payment_reference && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="font-semibold text-amber-900">Référence Wave transmise :</span>
                      <code className="font-mono font-bold bg-amber-100 px-2 py-0.5 rounded text-amber-900">
                        {pendingSubscription.offline_payment_reference}
                      </code>
                    </div>
                  )}
                  {pendingSubscription?.proof_document_url && (
                    <div className="pt-1">
                      <a
                        href={pendingSubscription.proof_document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-bold underline"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Consulter le justificatif transmis
                      </a>
                    </div>
                  )}
                </div>
              ) : store?.plan_tier === 'essentiel' && store.plan_expires_at ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-bold text-emerald-900 block">Forfait Essentiel Actif (8 000 FCFA / mois)</span>
                      <span className="text-emerald-700">
                        Valable pour 1 mois jusqu'au {new Date(store.plan_expires_at).toLocaleDateString('fr-FR')} (sans renouvellement automatique)
                      </span>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[11px]">
                    Actif
                  </span>
                </div>
              ) : null}

              {/* 2 Column Plans Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Plan Essentiel (8 000 FCFA) with Wave Payment button */}
                <div className={`bg-white rounded-2xl p-6 sm:p-7 border-2 shadow-xs space-y-6 ${store?.plan_tier === 'essentiel' ? 'border-blue-600 ring-2 ring-blue-50' : 'border-slate-200'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Abonnement Mensuel</span>
                      <h4 className="font-bold text-lg text-slate-900">Forfait Essentiel</h4>
                      <p className="text-xs text-slate-500">Pour lancer son activité en ligne avec 0% de commission</p>
                    </div>
                    {store?.plan_tier === 'essentiel' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                        Forfait Actuel
                      </span>
                    )}
                  </div>

                  <div className="text-3xl font-black text-slate-900 tabular-nums">
                    8 000 FCFA <span className="text-xs font-normal text-slate-500">/ mois</span>
                  </div>

                  <ul className="text-xs text-slate-600 space-y-2.5 pt-4 border-t border-slate-100">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Gestion complète de la boutique et commandes</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Publication des produits & gestion des stocks</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Configuration libre des zones et frais de livraison</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Messagerie directe avec les acheteurs</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span><strong>0% de commission</strong> sur toutes vos ventes</span>
                    </li>
                  </ul>

                  {/* Exact Wave Payment Action for Essentiel */}
                  <div className="pt-2 border-t border-slate-100 space-y-3">
                    <a
                      href="https://pay.wave.com/m/M_sn_dJZ66is9Zsju/c/sn/?amount=8000"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setWaveLinkClicked(true)}
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-[#1dc4e9] hover:bg-[#18b5d8] text-slate-950 font-black text-sm rounded-xl shadow-md transition-transform hover:scale-[1.01] active:scale-[0.99] text-center"
                    >
                      <ExternalLink className="w-4 h-4 shrink-0" />
                      <span>Payer 8 000 FCFA avec Wave</span>
                    </a>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                      <span className="font-bold text-slate-800 block">Règle d'affectation stricte :</span>
                      <p className="leading-relaxed">
                        Ce lien sert <strong>uniquement au forfait Essentiel</strong> (8 000 FCFA). Les frais de certification de 10 000 FCFA sont séparés et utilisent leur propre lien Wave. N'utilisez pas le lien Essentiel pour payer le forfait Croissance à 18 000 FCFA.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Plan Croissance (18 000 FCFA) with Payment Non Configured notice */}
                <div className={`bg-white rounded-2xl p-6 sm:p-7 border-2 shadow-xs space-y-6 ${store?.plan_tier === 'croissance' ? 'border-orange-500 ring-2 ring-orange-100' : 'border-slate-200'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">Abonnement Mensuel</span>
                      <h4 className="font-bold text-lg text-slate-900">Forfait Croissance</h4>
                      <p className="text-xs text-slate-500">Pour accélérer ses ventes & fidéliser</p>
                    </div>
                    {store?.plan_tier === 'croissance' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-800">
                        Forfait Actuel
                      </span>
                    )}
                  </div>

                  <div className="text-3xl font-black text-slate-900 tabular-nums">
                    18 000 FCFA <span className="text-xs font-normal text-slate-500">/ mois</span>
                  </div>

                  <ul className="text-xs text-slate-600 space-y-2.5 pt-4 border-t border-slate-100">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-orange-500 shrink-0" />
                      <span><strong>Toutes les fonctionnalités Essentiel</strong></span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-orange-500 shrink-0" />
                      <span>Statistiques avancées des ventes</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-orange-500 shrink-0" />
                      <span>Création de promotions & codes promo personnalisés</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-orange-500 shrink-0" />
                      <span>Export des commandes en CSV et Excel</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-orange-500 shrink-0" />
                      <span>Mise en avant prioritaire des produits</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-orange-500 shrink-0" />
                      <span>Assistance dédiée & support prioritaire</span>
                    </li>
                  </ul>

                  {/* Payment Status: Explicitly Non Configuré as required */}
                  <div className="pt-2 border-t border-slate-100 space-y-3">
                    <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-amber-900 font-bold">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Moyen de paiement non configuré</span>
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Le paiement en ligne pour le forfait Croissance (18 000 FCFA) reste indiqué comme non configuré tant qu'un moyen de paiement correspondant ou une intégration valide n'est pas fourni. N'utilisez pas le lien Essentiel à 8 000 FCFA pour régler ce forfait.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled
                      className="w-full py-3 px-4 bg-slate-100 border border-slate-200 text-slate-400 font-semibold text-xs rounded-xl cursor-not-allowed text-center"
                    >
                      Paiement en ligne non configuré
                    </button>
                  </div>
                </div>
              </div>

              {/* Form to submit transaction reference or proof document for Essentiel */}
              <div className="max-w-2xl bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                      Validation du règlement
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      Forfait Essentiel (8 000 FCFA)
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 mt-2">
                    Transmission de la référence Wave ou du justificatif
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Après avoir cliqué sur <strong>« Payer 8 000 FCFA avec Wave »</strong> ou effectué le virement, renseignez ci-dessous votre code de transaction ou joignez une capture de votre reçu. Votre demande sera enregistrée au statut <strong>« Paiement à vérifier »</strong> jusqu'à vérification manuelle de l'administrateur.
                  </p>
                </div>

                <form onSubmit={handleSubscriptionRequest} className="space-y-4 text-xs">
                  {/* Wave Transaction Reference */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Référence de transaction Wave (8 000 FCFA) <span className="text-slate-400 font-normal">(Recommandé)</span>
                    </label>
                    <input
                      type="text"
                      value={subPaymentRef}
                      onChange={e => setSubPaymentRef(e.target.value)}
                      placeholder="Ex: WAVE-SN-87654321 ou numéro de transaction figurant sur le reçu Wave..."
                      className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 font-mono"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Indiquez le numéro de transaction figurant dans votre SMS ou application Wave. Les doublons sont rejetés.
                    </span>
                  </div>

                  {/* Proof Document File Upload */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Justificatif de paiement (Capture d’écran ou reçu Wave)
                    </label>

                    {subProofUrl ? (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="text-xs text-blue-900 font-medium truncate">
                            Justificatif de paiement joint
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={subProofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 text-[11px] bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100 font-semibold"
                          >
                            Visualiser
                          </a>
                          <button
                            type="button"
                            onClick={() => setSubProofUrl('')}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                      <Upload className="w-4 h-4 text-slate-500" />
                      <span className="font-semibold text-blue-600">
                        {uploadingSubProof ? 'Téléchargement du justificatif...' : 'Télécharger une capture ou reçu Wave (JPG, PNG, WEBP)'}
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/jpg"
                        onChange={handleSubProofFileChange}
                        className="hidden"
                        disabled={uploadingSubProof}
                      />
                    </label>
                  </div>

                  {/* Vendor Notes */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Commentaire ou précision pour l'administrateur (Optionnel)
                    </label>
                    <textarea
                      rows={2}
                      value={subNotes}
                      onChange={e => setSubNotes(e.target.value)}
                      placeholder="Ex: Nom ou numéro de téléphone de l'émetteur Wave..."
                      className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submittingSub || uploadingSubProof}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {submittingSub ? 'Enregistrement de la demande...' : 'Soumettre pour vérification du paiement (8 000 FCFA)'}
                    </button>
                    <span className="text-[11px] text-slate-400 text-center block mt-2">
                      Votre demande sera enregistrée sous le statut <strong>« Paiement à vérifier »</strong>.
                    </span>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* SECTION 2: Certification officielle (Displayed if 'all' or 'certification') */}
          {(proPaymentsSubTab === 'all' || proPaymentsSubTab === 'certification') && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                    2. Certification officielle de la boutique
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Service optionnel de vérification juridique et de visibilité avec le badge officiel « Boutique certifiée ».
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                  Paiement unique 10 000 FCFA · Sans renouvellement
                </span>
              </div>

              {/* Certification Overview Card */}
              <div className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                      Frais de service uniques
                    </span>
                    <h4 className="text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
                      Certification officielle MARKET SÉNÉGAL
                      {store?.is_certified && <CertifiedBadge size="md" />}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                      La certification est <strong>facultative</strong> et coûte <strong>10 000 FCFA en paiement unique</strong>, séparément des abonnements mensuels Essentiel et Croissance. Une boutique peut vendre sans être certifiée. Ne facture aucun renouvellement.
                    </p>
                  </div>

                  <div className="text-right sm:border-l sm:border-slate-100 sm:pl-6">
                    <div className="text-2xl font-black text-slate-900 tabular-nums">
                      10 000 FCFA
                    </div>
                    <span className="text-[11px] text-slate-400 block">Paiement unique</span>
                  </div>
                </div>

                {/* Current State Alert */}
                {store?.is_certified ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Votre boutique est certifiée officiellement par MARKET SÉNÉGAL</span>
                    </div>
                    <p className="text-xs text-emerald-700 leading-relaxed">
                      Le badge <strong>« Boutique certifiée »</strong> est affiché sur votre boutique et tous vos produits. Dans les recherches, le répertoire des boutiques et les listes de produits, vos articles sont placés avant les autres boutiques actives.
                    </p>
                    {store.certified_at && (
                      <p className="text-[11px] text-emerald-600">
                        Certifiée le : {new Date(store.certified_at).toLocaleDateString('fr-FR')} {certData?.currentCert?.verified_payment_reference ? `· Réf. vérifiée : ${certData.currentCert.verified_payment_reference}` : ''}
                      </p>
                    )}
                  </div>
                ) : store?.certification_status === 'paiement_a_verifier' ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center gap-2 text-amber-900 font-bold">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>Statut actuel : Paiement à vérifier</span>
                    </div>
                    <p className="text-amber-800 leading-relaxed">
                      Votre référence Wave (<code className="font-mono font-bold bg-amber-100 px-1 py-0.5 rounded">{certData?.currentCert?.wave_payment_reference || waveRef}</code>) a été enregistrée. L'administrateur vérifie l'encaissement effectif des 10 000 FCFA et vos justificatifs avant d'attribuer le badge officiel.
                    </p>
                  </div>
                ) : store?.certification_status === 'verification_en_cours' ? (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center gap-2 text-blue-900 font-bold">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span>Statut actuel : Vérification en cours</span>
                    </div>
                    <p className="text-blue-800 leading-relaxed">
                      L'administration procède à la vérification de vos justificatifs et documents légaux.
                    </p>
                  </div>
                ) : store?.certification_status === 'refusee' ? (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-rose-900 font-bold">
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span>Statut actuel : Demande de certification refusée</span>
                    </div>
                    {certData?.currentCert?.rejection_reason && (
                      <p className="text-rose-800 leading-relaxed bg-white/70 p-2.5 rounded-lg border border-rose-200">
                        <strong>Motif du refus :</strong> {certData.currentCert.rejection_reason}
                      </p>
                    )}
                    <p className="text-rose-700">
                      Vous pouvez corriger votre référence ou vos documents ci-dessous et soumettre une nouvelle demande.
                    </p>
                  </div>
                ) : null}

                {/* 4-Stage Progress Pipeline */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Parcours de certification en 4 étapes
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs pt-1">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold text-blue-600 block">Étape 1</span>
                      <span className="font-bold text-slate-900 block mt-0.5">Paiement Wave</span>
                      <span className="text-[11px] text-slate-500">10 000 FCFA via le lien officiel Wave</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold text-amber-600 block">Étape 2</span>
                      <span className="font-bold text-slate-900 block mt-0.5">Paiement à vérifier</span>
                      <span className="text-[11px] text-slate-500">Transmission référence et justificatifs</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold text-indigo-600 block">Étape 3</span>
                      <span className="font-bold text-slate-900 block mt-0.5">Contrôle Admin</span>
                      <span className="text-[11px] text-slate-500">Vérification sur le compte Wave officiel</span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold text-emerald-600 block">Étape 4</span>
                      <span className="font-bold text-slate-900 block mt-0.5">Badge officiel</span>
                      <span className="text-[11px] text-slate-500">Priorité catalogue et confiance acheteurs</span>
                    </div>
                  </div>
                </div>

                {/* Exact Wave Payment Action for Certification */}
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <a
                    href="https://pay.wave.com/m/M_sn_dJZ66is9Zsju/c/sn/?amount=10000"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setWaveCertClicked(true)}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-[#1dc4e9] hover:bg-[#18b5d8] text-slate-950 font-black text-sm rounded-xl shadow-md transition-transform hover:scale-[1.01] active:scale-[0.99] text-center"
                  >
                    <ExternalLink className="w-4 h-4 shrink-0" />
                    <span>Payer 10 000 FCFA avec Wave</span>
                  </a>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                    <span className="font-bold text-slate-800 block">Rappel de conformité Wave :</span>
                    <p className="leading-relaxed">
                      Ce bouton ouvre exactement le lien de certification à 10 000 FCFA. Le clic ou le retour depuis Wave ne confirme jamais automatiquement un paiement. Après le règlement, saisissez votre référence de transaction ci-dessous.
                    </p>
                  </div>
                </div>
              </div>

              {/* Form to submit certification request and proof */}
              <div className="max-w-2xl bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                      Formulaire de certification
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      Montant fixe : 10 000 FCFA
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 mt-2">
                    Transmission de la référence Wave et des pièces justificatives
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Renseignez le numéro de transaction Wave obtenu lors de votre règlement de 10 000 FCFA, et joignez votre reçu ou document légal (RC, NINEA, ou pièce d'identité du gérant).
                  </p>
                </div>

                <form onSubmit={handleSubmitCertification} className="space-y-4 text-xs">
                  {/* Wave Reference */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Référence de transaction Wave (10 000 FCFA) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={waveRef}
                      onChange={e => setWaveRef(e.target.value)}
                      placeholder="Ex: WAVE-SN-10000-XXXXX..."
                      className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 font-mono"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Code unique fourni par Wave dans le SMS de confirmation ou l'application. Les références dupliquées sont rejetées.
                    </span>
                  </div>

                  {/* Proof Document File Upload */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Justificatif ou document légal (Optionnel mais recommandé)
                    </label>

                    {proofDocumentUrl ? (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="text-xs text-blue-900 font-medium truncate">
                            Document justificatif joint
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={proofDocumentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 text-[11px] bg-white border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-100 font-semibold"
                          >
                            Visualiser
                          </a>
                          <button
                            type="button"
                            onClick={() => setProofDocumentUrl('')}
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                      <Upload className="w-4 h-4 text-slate-500" />
                      <span className="font-semibold text-blue-600">
                        {uploadingProof ? 'Téléchargement du document...' : 'Télécharger un reçu Wave, RC, NINEA ou CNI (JPG, PNG, WEBP)'}
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/jpg"
                        onChange={handleProofDocFileChange}
                        className="hidden"
                        disabled={uploadingProof}
                      />
                    </label>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Précisions ou notes pour l'administrateur (Optionnel)
                    </label>
                    <textarea
                      rows={2}
                      value={vendorCertNotes}
                      onChange={e => setVendorCertNotes(e.target.value)}
                      placeholder="Ex: Nom de l'expéditeur Wave, date et heure du paiement..."
                      className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submittingCert || uploadingProof}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {submittingCert ? 'Envoi de la demande...' : 'Transmettre la demande de certification (10 000 FCFA)'}
                    </button>
                    <span className="text-[11px] text-slate-400 text-center block mt-2">
                      Votre demande passera immédiatement au statut <strong>« Paiement à vérifier »</strong>.
                    </span>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* SECTION 3: Historique séparé des paiements professionnels */}
          {(proPaymentsSubTab === 'all' || proPaymentsSubTab === 'history') && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    3. Historique séparé de vos paiements professionnels
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Historique individuel de chaque paiement professionnel : compte vendeur, objet payé, montant, date, référence, statut et décision de vérification.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                  Séparé des commandes clients
                </span>
              </div>

              {loadingProPayments ? (
                <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                  Chargement de l'historique des règlements...
                </div>
              ) : proPaymentsData?.history && proPaymentsData.history.length > 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Objet payé & Type</th>
                          <th className="py-3 px-4">Montant</th>
                          <th className="py-3 px-4">Référence Wave</th>
                          <th className="py-3 px-4">Statut</th>
                          <th className="py-3 px-4">Décision / Réf. vérifiée</th>
                          <th className="py-3 px-4 text-right">Justificatif</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {proPaymentsData.history.map((item: any) => {
                          const isSuccess = item.status === 'actif' || item.status === 'certifiee';
                          const isRejected = item.status === 'refusee';
                          const isPending = item.status === 'paiement_a_verifier' || item.status === 'en_attente' || item.status === 'verification_en_cours';

                          return (
                            <tr key={`${item.type}-${item.id}`} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                                {new Date(item.created_at).toLocaleDateString('fr-FR', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="font-bold text-slate-900">{item.item_label}</div>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {item.frequency === 'mensuel' ? 'Abonnement mensuel (30 jours)' : 'Frais de service uniques'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-black text-slate-900 tabular-nums whitespace-nowrap">
                                {formatFCFA(item.amount_fcfa)}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                                {item.payment_reference || '—'}
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                                  isSuccess
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isRejected
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {isSuccess && <CheckCircle2 className="w-3 h-3" />}
                                  {isPending && <Clock className="w-3 h-3" />}
                                  {isRejected && <XCircle className="w-3 h-3" />}
                                  {isSuccess ? 'Confirmé / Actif' : isRejected ? 'Refusé' : 'Paiement à vérifier'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-[11px] text-slate-600">
                                {item.verified_payment_reference ? (
                                  <span className="text-emerald-700 font-medium font-mono">
                                    Vérifié : {item.verified_payment_reference}
                                  </span>
                                ) : item.decision_note ? (
                                  <span className="text-rose-700">
                                    Motif : {item.decision_note}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">En attente de contrôle Wave</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                {item.proof_document_url ? (
                                  <a
                                    href={item.proof_document_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-[11px]"
                                  >
                                    <FileText className="w-3 h-3" />
                                    <span>Reçu</span>
                                  </a>
                                ) : (
                                  <span className="text-slate-300 text-[11px]">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2">
                  <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">Aucun paiement professionnel enregistré pour le moment.</p>
                  <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                    Effectuez le règlement de votre abonnement Essentiel (8 000 FCFA) ou de votre certification (10 000 FCFA) avec Wave pour commencer.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 8: Store Settings */}
      {activeTab === 'settings' && (
        <div className="max-w-xl bg-white p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <h2 className="text-lg font-bold text-slate-900">Coordonnées et paramètres de la boutique</h2>

          <form onSubmit={handleSaveStoreSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nom commercial</label>
              <input
                type="text"
                required
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
              <textarea
                rows={3}
                value={storeDesc}
                onChange={e => setStoreDesc(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Téléphone</label>
                <input
                  type="tel"
                  required
                  value={storePhone}
                  onChange={e => setStorePhone(e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ville / Région</label>
                <input
                  type="text"
                  required
                  value={storeCity}
                  onChange={e => setStoreCity(e.target.value)}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Adresse physique / Quartier</label>
              <input
                type="text"
                required
                value={storeAddress}
                onChange={e => setStoreAddress(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {/* Cash on delivery toggle */}
            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={storeAllowsCod}
                  onChange={e => setStoreAllowsCod(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="text-xs font-semibold text-slate-800">
                  Accepter le paiement en espèces à la livraison
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs"
            >
              {savingSettings ? 'Sauvegarde...' : 'Enregistrer les modifications'}
            </button>
          </form>
        </div>
      )}

      {/* Modal: Add/Edit Product */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">
                {editingProductId ? 'Modifier le produit' : 'Publier un nouvel article'}
              </h3>
              <button onClick={() => setProductModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 text-xs">
              {pError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pError}</span>
                </div>
              )}

              {/* Photo Upload (At least 1 photo required) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Photos du produit <span className="text-rose-500">* (Minimum 1 requise)</span>
                </label>
                
                {/* Thumbnails preview */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {pImages.map((img, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 group">
                      <img src={img} alt="Aperçu" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPImages(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute inset-0 bg-rose-600/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <Upload className="w-4 h-4 text-slate-500" />
                  <span className="font-semibold text-blue-600">
                    {uploadingImage ? 'Téléchargement...' : 'Télécharger une photo (JPG, PNG, WEBP)'}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    onChange={handleImageFileChange}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nom de l'article <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={pName}
                  onChange={e => setPName(e.target.value)}
                  placeholder="Ex: Boubou traditionnel brodé main"
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catégorie de la boutique
                </label>
                <select
                  value={pCatId}
                  onChange={e => setPCatId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">Sans catégorie</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Prix (FCFA) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    required
                    value={pPrice}
                    onChange={e => setPPrice(e.target.value)}
                    placeholder="15000"
                    className="w-full p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Prix barré (FCFA)</label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={pComparePrice}
                    onChange={e => setPComparePrice(e.target.value)}
                    placeholder="18000"
                    className="w-full p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Quantité stock</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={pStock}
                    onChange={e => setPStock(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Description complète <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={pDesc}
                  onChange={e => setPDesc(e.target.value)}
                  placeholder="Détails, matière, conseils de taille..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={uploadingImage}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-xs"
                >
                  {editingProductId ? 'Sauvegarder les modifications' : 'Publier le produit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
