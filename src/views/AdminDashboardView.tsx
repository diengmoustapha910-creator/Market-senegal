import React, { useEffect, useState } from 'react';
import {
  ShieldAlert, Users, Store, Package, ShoppingCart, DollarSign,
  AlertTriangle, CheckCircle, Ban, History, Star, ShieldCheck, Eye, RefreshCw,
  ExternalLink, FileText, CheckCircle2, XCircle, Brain, Sliders, Check, KeyRound, Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { apiFetch, formatFCFA } from '../api/client.js';
import type { Store as StoreType, User, Subscription, PlatformReview, AuditLog, Order, StoreCertification } from '../types/index.js';
import { CertifiedBadge } from '../components/CertifiedBadge.js';

export const AdminDashboardView: React.FC = () => {
  const { user, navigate, showToast } = useAuth();

  const [activeTab, setActiveTab] = useState<'stats' | 'stores' | 'users' | 'subscriptions' | 'certifications' | 'reviews' | 'audit' | 'orders' | 'ai' | 'security'>('stats');

  // Stats
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Stores
  const [stores, setStores] = useState<StoreType[]>([]);
  const [selectedStoreToSuspend, setSelectedStoreToSuspend] = useState<StoreType | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [suspensionHistory, setSuspensionHistory] = useState<any[]>([]);
  const [historyModalStoreName, setHistoryModalStoreName] = useState<string | null>(null);

  // Users
  const [users, setUsers] = useState<User[]>([]);

  // Subscriptions
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [selectedSubToValidate, setSelectedSubToValidate] = useState<any | null>(null);
  const [verifiedPaymentRef, setVerifiedPaymentRef] = useState('');

  // Certifications (10 000 FCFA via Wave)
  const [certifications, setCertifications] = useState<StoreCertification[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(false);
  const [selectedCertToApprove, setSelectedCertToApprove] = useState<StoreCertification | null>(null);
  const [adminVerifiedWaveRef, setAdminVerifiedWaveRef] = useState('');
  const [adminCertApprovalNotes, setAdminCertApprovalNotes] = useState('');
  const [selectedCertToReject, setSelectedCertToReject] = useState<StoreCertification | null>(null);
  const [certRejectionReason, setCertRejectionReason] = useState('');
  const [selectedStoreToRevokeCert, setSelectedStoreToRevokeCert] = useState<StoreType | null>(null);
  const [revokeCertReason, setRevokeCertReason] = useState('');
  const [certHistoryModal, setCertHistoryModal] = useState<{ storeName: string; list: StoreCertification[] } | null>(null);

  // Reviews
  const [reviews, setReviews] = useState<PlatformReview[]>([]);

  // Audit
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Orders
  const [orders, setOrders] = useState<Order[]>([]);

  // AI Configuration & State
  const [aiConfig, setAiConfig] = useState<any>(null);
  const [aiStatus, setAiStatus] = useState<any>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [dailyQuotaInput, setDailyQuotaInput] = useState<number>(25);
  const [aiEnabledInput, setAiEnabledInput] = useState<boolean>(true);

  // Security & Password Management
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<string | null>(null);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [invalidatedSessionsCount, setInvalidatedSessionsCount] = useState<number | null>(null);

  const handleAdminChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError(null);
    setPasswordChangeSuccess(null);
    setInvalidatedSessionsCount(null);

    if (newPassword.length < 8) {
      setPasswordChangeError('Le nouveau mot de passe doit comporter au moins 8 caractères.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordChangeError('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordChangeError('Le nouveau mot de passe doit être différent de votre mot de passe actuel.');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await apiFetch<{
        success: boolean;
        message: string;
        otherSessionsTerminated: number;
        user: User;
      }>('/admin/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      setPasswordChangeSuccess(res.message);
      setInvalidatedSessionsCount(res.otherSessionsTerminated);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Mot de passe administrateur modifié avec succès.', 'success');
      loadAudit();
    } catch (err: any) {
      setPasswordChangeError(err.message || 'Erreur lors du changement de mot de passe.');
    } finally {
      setChangingPassword(false);
    }
  };

  // Strict role check & redirect for non-admins
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      showToast('Accès restreint. Veuillez vous connecter avec un compte administrateur.', 'error');
      navigate('admin-login');
    }
  }, [user]);

  const loadAiConfig = async () => {
    setLoadingAi(true);
    try {
      const res = await apiFetch<any>('/admin/ai-config');
      setAiConfig(res.config);
      setAiStatus(res.status);
      setDailyQuotaInput(res.config.daily_quota_per_store || 25);
      setAiEnabledInput(res.config.enabled !== false);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleSaveAiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAi(true);
    try {
      const res = await apiFetch<any>('/admin/ai-config', {
        method: 'PUT',
        body: JSON.stringify({
          daily_quota_per_store: Number(dailyQuotaInput),
          enabled: Boolean(aiEnabledInput)
        })
      });
      setAiConfig(res.config);
      showToast('Configuration de l’IA mise à jour avec succès.', 'success');
      loadAiConfig();
    } catch (err: any) {
      showToast(err.message || 'Erreur lors de la sauvegarde.', 'error');
    } finally {
      setSavingAi(false);
    }
  };

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const res = await apiFetch('/admin/stats');
      setStats(res.stats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadStores = async () => {
    try {
      const res = await apiFetch('/admin/stores');
      setStores(res.stores || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await apiFetch('/admin/users');
      setUsers(res.users || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadSubscriptions = async () => {
    try {
      const res = await apiFetch('/admin/subscriptions');
      setSubscriptions(res.subscriptions || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadReviews = async () => {
    try {
      const res = await apiFetch('/admin/reviews');
      setReviews(res.reviews || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadAudit = async () => {
    try {
      const res = await apiFetch('/admin/audit-logs');
      setAuditLogs(res.logs || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadOrders = async () => {
    try {
      const res = await apiFetch('/admin/orders');
      setOrders(res.orders || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadCertifications = async () => {
    setLoadingCerts(true);
    try {
      const res = await apiFetch('/admin/certifications');
      setCertifications(res.certifications || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCerts(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadStores();
    loadCertifications();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'subscriptions') loadSubscriptions();
    if (activeTab === 'certifications') loadCertifications();
    if (activeTab === 'reviews') loadReviews();
    if (activeTab === 'audit') loadAudit();
    if (activeTab === 'orders') loadOrders();
    if (activeTab === 'stats') loadStats();
    if (activeTab === 'stores') loadStores();
    if (activeTab === 'ai') loadAiConfig();
  }, [activeTab]);

  // Suspend store action
  const handleConfirmSuspend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStoreToSuspend || !suspensionReason.trim()) return;
    try {
      await apiFetch(`/admin/stores/${selectedStoreToSuspend.id}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ reason: suspensionReason.trim() })
      });
      showToast(`Boutique "${selectedStoreToSuspend.name}" suspendue. Ses articles sont masqués.`, 'info');
      setSelectedStoreToSuspend(null);
      setSuspensionReason('');
      loadStores();
      loadStats();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Reactivate store action
  const handleReactivateStore = async (st: StoreType) => {
    const reason = prompt(`Motif de la réactivation pour "${st.name}" :`, 'Dossier régularisé et vérifié');
    if (!reason) return;
    try {
      await apiFetch(`/admin/stores/${st.id}/reactivate`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      showToast(`Boutique "${st.name}" réactivée avec succès.`, 'success');
      loadStores();
      loadStats();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // View suspension history
  const handleViewHistory = async (st: StoreType) => {
    try {
      const res = await apiFetch(`/admin/stores/${st.id}/suspension-history`);
      setSuspensionHistory(res.history || []);
      setHistoryModalStoreName(st.name);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // Validate Subscription Offline
  const handleConfirmValidateSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubToValidate || !verifiedPaymentRef.trim()) return;
    try {
      await apiFetch(`/admin/subscriptions/${selectedSubToValidate.id}/validate`, {
        method: 'POST',
        body: JSON.stringify({ paymentReference: verifiedPaymentRef.trim() })
      });
      showToast('Abonnement validé et activé avec succès.', 'success');
      setSelectedSubToValidate(null);
      setVerifiedPaymentRef('');
      loadSubscriptions();
      loadStats();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Moderate platform review
  const handleToggleReviewApproval = async (reviewId: string, current: boolean) => {
    try {
      await apiFetch(`/admin/reviews/${reviewId}/approve`, {
        method: 'PUT',
        body: JSON.stringify({ isApproved: !current })
      });
      loadReviews();
      showToast('Statut de modération mis à jour.', 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Approve certification
  const handleConfirmApproveCert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCertToApprove || !adminVerifiedWaveRef.trim()) return;
    try {
      await apiFetch(`/admin/certifications/${selectedCertToApprove.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          verifiedPaymentReference: adminVerifiedWaveRef.trim(),
          adminNotes: adminCertApprovalNotes.trim() || undefined
        })
      });
      showToast('Boutique certifiée avec succès ! Le badge officiel est activé.', 'success');
      setSelectedCertToApprove(null);
      setAdminVerifiedWaveRef('');
      setAdminCertApprovalNotes('');
      loadCertifications();
      loadStores();
      loadStats();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Reject certification
  const handleConfirmRejectCert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCertToReject || !certRejectionReason.trim()) return;
    try {
      await apiFetch(`/admin/certifications/${selectedCertToReject.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({
          rejectionReason: certRejectionReason.trim()
        })
      });
      showToast('Demande de certification refusée. Le motif a été notifié à la boutique.', 'info');
      setSelectedCertToReject(null);
      setCertRejectionReason('');
      loadCertifications();
      loadStores();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Revoke certification
  const handleConfirmRevokeCert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStoreToRevokeCert || !revokeCertReason.trim()) return;
    try {
      await apiFetch(`/admin/stores/${selectedStoreToRevokeCert.id}/revoke-certification`, {
        method: 'POST',
        body: JSON.stringify({
          reason: revokeCertReason.trim()
        })
      });
      showToast(`Certification révoquée pour "${selectedStoreToRevokeCert.name}".`, 'info');
      setSelectedStoreToRevokeCert(null);
      setRevokeCertReason('');
      loadCertifications();
      loadStores();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // View store certification history
  const handleViewStoreCertHistory = async (storeId: string, storeName: string) => {
    try {
      const res = await apiFetch(`/admin/stores/${storeId}/certification-history`);
      setCertHistoryModal({
        storeName,
        list: res.history || []
      });
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Top Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Console d'Administration Globale</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">MARKET SÉNÉGAL · Direction</h1>
          <p className="text-xs text-slate-400">Contrôle des boutiques, modération, abonnements et journal d'audit</p>
        </div>

        <div className="text-xs text-slate-300 bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700">
          Admin : <span className="font-semibold text-white">{user?.full_name}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto text-xs font-semibold pb-px">
        <button
          onClick={() => setActiveTab('stats')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'stats' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
        >
          <DollarSign className="w-4 h-4" />
          Statistiques de la base
        </button>

        <button
          onClick={() => setActiveTab('stores')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'stores' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
        >
          <Store className="w-4 h-4" />
          Boutiques & Suspensions ({stores.length})
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'users' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
        >
          <Users className="w-4 h-4" />
          Comptes ({users.length})
        </button>

        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'subscriptions' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
        >
          <DollarSign className="w-4 h-4" />
          Abonnements & Règlements ({subscriptions.length})
        </button>

        <button
          onClick={() => setActiveTab('certifications')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'certifications' ? 'border-amber-600 text-amber-800 font-bold' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
        >
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <span>Certifications (10 000 FCFA)</span>
          {certifications.filter(c => c.status === 'paiement_a_verifier' || c.status === 'verification_en_cours').length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
              {certifications.filter(c => c.status === 'paiement_a_verifier' || c.status === 'verification_en_cours').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('reviews')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'reviews' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
        >
          <Star className="w-4 h-4" />
          Modération des Avis ({reviews.length})
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'orders' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
        >
          <ShoppingCart className="w-4 h-4" />
          Toutes les Commandes ({orders.length})
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'audit' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
        >
          <ShieldAlert className="w-4 h-4" />
          Journal d'Audit ({auditLogs.length})
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'ai' ? 'border-indigo-600 text-indigo-800 font-bold' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
        >
          <Brain className="w-4 h-4 text-indigo-600" />
          <span>Intelligence Artificielle</span>
          <span className={`w-2 h-2 rounded-full ${aiStatus?.available ? 'bg-emerald-500' : 'bg-slate-300'}`} />
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'security' ? 'border-amber-600 text-amber-800 font-bold' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
        >
          <KeyRound className="w-4 h-4 text-amber-600" />
          <span>Sécurité & Mot de passe</span>
        </button>
      </div>

      {/* Tab 1: Real Stats */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Indicateurs calculés en temps réel depuis la base</h2>
            <button onClick={loadStats} className="p-2 text-slate-500 hover:text-slate-900">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 block">Utilisateurs enregistrés</span>
              <span className="text-2xl font-extrabold text-slate-900 tabular-nums">{stats?.totalUsers || 0}</span>
              <span className="text-[11px] text-slate-400 block mt-1">
                {stats?.totalClients || 0} clients · {stats?.totalVendors || 0} vendeurs
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 block">Boutiques actives</span>
              <span className="text-2xl font-extrabold text-blue-700 tabular-nums">{stats?.activeStores || 0}</span>
              <span className="text-[11px] text-rose-500 block mt-1">
                {stats?.suspendedStores || 0} boutique(s) suspendue(s)
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 block">Produits référencés</span>
              <span className="text-2xl font-extrabold text-slate-900 tabular-nums">{stats?.activeProducts || 0}</span>
              <span className="text-[11px] text-slate-400 block mt-1">
                sur {stats?.totalProducts || 0} au total
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 block">Volume des ventes (GMV)</span>
              <span className="text-2xl font-extrabold text-emerald-700 tabular-nums">
                {formatFCFA(stats?.gmvTotalFcfa || 0)}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">
                {stats?.totalOrders || 0} commandes ({stats?.totalCompletedOrders || 0} livrées)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Stores & Suspensions */}
      {activeTab === 'stores' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Boutiques enregistrées</h2>
            <p className="text-xs text-slate-500">
              Une boutique suspendue n'apparaît plus aux clients et ses produits ne peuvent plus être commandés.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs divide-y divide-slate-200">
              <thead className="bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="p-4">Boutique</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4">Forfait</th>
                  <th className="p-4">Statut</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stores.map(st => (
                  <tr key={st.id} className="hover:bg-slate-50/50">
                    <td className="p-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900">{st.name}</span>
                        {st.is_certified && <CertifiedBadge size="sm" />}
                      </div>
                      <div className="text-[11px] text-slate-400">{st.city} · {st.address}</div>
                      {st.is_certified && st.certified_at && (
                        <div className="text-[11px] text-blue-700 font-medium mt-0.5">
                          Certifiée le {new Date(st.certified_at).toLocaleDateString('fr-FR')}
                        </div>
                      )}
                      {st.is_suspended && st.suspension_reason && (
                        <div className="text-[11px] text-rose-700 font-medium mt-1">
                          Motif suspension : {st.suspension_reason}
                        </div>
                      )}
                    </td>

                    <td className="p-4 text-slate-600">
                      {st.phone}
                    </td>

                    <td className="p-4 uppercase font-semibold text-slate-800">
                      {st.plan_tier}
                    </td>

                    <td className="p-4">
                      {st.is_suspended ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Suspendue
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => handleViewStoreCertHistory(st.id, st.name)}
                        className="px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded-lg inline-flex items-center gap-1"
                        title="Historique des certifications"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Hist. Certif.
                      </button>

                      {st.is_certified && (
                        <button
                          onClick={() => setSelectedStoreToRevokeCert(st)}
                          className="px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50 rounded-lg"
                          title="Retirer la certification"
                        >
                          Retirer certif.
                        </button>
                      )}

                      <button
                        onClick={() => handleViewHistory(st)}
                        className="px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg inline-flex items-center gap-1"
                        title="Historique des suspensions"
                      >
                        <History className="w-3.5 h-3.5" />
                        Suspensions
                      </button>

                      {st.is_suspended ? (
                        <button
                          onClick={() => handleReactivateStore(st)}
                          className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg"
                        >
                          Réactiver
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedStoreToSuspend(st)}
                          className="px-2.5 py-1 text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg"
                        >
                          Suspendre
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Users */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs divide-y divide-slate-200">
            <thead className="bg-slate-50 font-semibold text-slate-700">
              <tr>
                <th className="p-4">Utilisateur</th>
                <th className="p-4">Email</th>
                <th className="p-4">Téléphone</th>
                <th className="p-4">Rôle</th>
                <th className="p-4">Inscrit le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50">
                  <td className="p-4 font-bold text-slate-900">{u.full_name}</td>
                  <td className="p-4 text-slate-600">{u.email}</td>
                  <td className="p-4 text-slate-600">{u.phone || 'Non renseigné'}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${u.role === 'admin' ? 'bg-amber-100 text-amber-900' : u.role === 'vendeur' ? 'bg-blue-100 text-blue-900' : 'bg-slate-100 text-slate-700'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4 text-slate-500">{new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Subscriptions & Offline Validations */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Abonnements des boutiques</h2>
            <p className="text-xs text-slate-500">
              Validation manuelle après vérification du versement réel hors-plateforme (Wave, Orange Money ou virement).
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs divide-y divide-slate-200">
              <thead className="bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="p-4">Boutique</th>
                  <th className="p-4">Forfait</th>
                  <th className="p-4">Tarif</th>
                  <th className="p-4">Réf. Vendeur</th>
                  <th className="p-4">Justificatif</th>
                  <th className="p-4">Statut</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">
                      Aucune demande d'abonnement enregistrée.
                    </td>
                  </tr>
                ) : (
                  subscriptions.map(sub => (
                    <tr key={sub.id} className="hover:bg-slate-50/50">
                      <td className="p-4 font-bold text-slate-900">{sub.store_name}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                          sub.plan_tier === 'essentiel'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {sub.plan_tier}
                        </span>
                      </td>
                      <td className="p-4 tabular-nums font-bold">{formatFCFA(sub.price_fcfa)}</td>
                      <td className="p-4 font-mono text-slate-700">
                        {sub.offline_payment_reference || <span className="text-slate-400 italic">Non renseignée</span>}
                      </td>
                      <td className="p-4">
                        {sub.proof_document_url ? (
                          <a
                            href={sub.proof_document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Voir reçu
                          </a>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Aucun</span>
                        )}
                      </td>
                      <td className="p-4">
                        {sub.status === 'actif' ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Actif (1 mois)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 ring-1 ring-amber-300">
                            Paiement à vérifier
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {(sub.status === 'en_attente' || sub.status === 'paiement_a_verifier') && (
                          <button
                            onClick={() => {
                              setSelectedSubToValidate(sub);
                              setVerifiedPaymentRef(sub.offline_payment_reference || '');
                            }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                          >
                            Vérifier & Activer
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Store Certifications (10 000 FCFA Wave) */}
      {activeTab === 'certifications' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                Certifications payantes des boutiques (10 000 FCFA)
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                Le paiement seul ou le retour Wave ne suffit pas : vérifiez la réception effective des 10 000 FCFA sur Wave et contrôlez les justificatifs (RCCM, NINEA ou CNI). Le badge <strong>« Boutique certifiée »</strong> ne s'affiche qu'après votre approbation.
              </p>
            </div>
            <button
              onClick={loadCertifications}
              className="p-2 text-slate-500 hover:text-slate-900 self-start"
              title="Actualiser la liste"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs divide-y divide-slate-200">
              <thead className="bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="p-4">Boutique</th>
                  <th className="p-4">Réf. Wave Vendeur</th>
                  <th className="p-4">Justificatif</th>
                  <th className="p-4">Montant</th>
                  <th className="p-4">Statut</th>
                  <th className="p-4">Réf. Vérifiée / Décision</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {certifications.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      Aucune demande de certification enregistrée pour le moment.
                    </td>
                  </tr>
                ) : (
                  certifications.map(cert => (
                    <tr key={cert.id} className="hover:bg-slate-50/50">
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900">{cert.store_name}</span>
                          {cert.status === 'certifiee' && <CertifiedBadge size="sm" />}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Demande : {new Date(cert.created_at).toLocaleDateString('fr-FR')} {new Date(cert.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {cert.vendor_notes && (
                          <div className="text-[11px] text-slate-600 italic mt-0.5 max-w-xs truncate" title={cert.vendor_notes}>
                            Note vendeur : {cert.vendor_notes}
                          </div>
                        )}
                      </td>

                      <td className="p-4">
                        <code className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono text-[11px] text-slate-900 font-bold">
                          {cert.wave_payment_reference}
                        </code>
                      </td>

                      <td className="p-4">
                        {cert.proof_document_url ? (
                          <a
                            href={cert.proof_document_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Voir document</span>
                            <ExternalLink className="w-3 h-3 ml-0.5" />
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Non fourni</span>
                        )}
                      </td>

                      <td className="p-4 font-bold tabular-nums text-slate-900">
                        {formatFCFA(cert.amount_fcfa)}
                      </td>

                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          cert.status === 'certifiee'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : cert.status === 'refusee'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : cert.status === 'verification_en_cours'
                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {cert.status === 'paiement_a_verifier'
                            ? 'Paiement à vérifier'
                            : cert.status === 'verification_en_cours'
                            ? 'Vérification en cours'
                            : cert.status === 'demande_envoyee'
                            ? 'Demande envoyée'
                            : cert.status === 'certifiee'
                            ? 'Certifiée'
                            : 'Refusée'}
                        </span>
                      </td>

                      <td className="p-4">
                        {cert.status === 'certifiee' ? (
                          <div className="text-[11px] text-slate-700">
                            <div>Réf. : <code className="font-mono font-semibold">{cert.verified_payment_reference || 'Vérifié'}</code></div>
                            {cert.certified_at && (
                              <div className="text-slate-400">Le {new Date(cert.certified_at).toLocaleDateString('fr-FR')}</div>
                            )}
                          </div>
                        ) : cert.status === 'refusee' ? (
                          <div className="text-[11px] text-rose-700 max-w-xs truncate" title={cert.rejection_reason || ''}>
                            Refus : {cert.rejection_reason}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">En attente de vérification</span>
                        )}
                      </td>

                      <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                        {cert.status !== 'certifiee' && (
                          <button
                            onClick={() => {
                              setSelectedCertToApprove(cert);
                              setAdminVerifiedWaveRef(cert.wave_payment_reference || '');
                              setAdminCertApprovalNotes('');
                            }}
                            className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs inline-flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Valider & Certifier
                          </button>
                        )}

                        {cert.status !== 'refusee' && cert.status !== 'certifiee' && (
                          <button
                            onClick={() => {
                              setSelectedCertToReject(cert);
                              setCertRejectionReason('');
                            }}
                            className="px-2.5 py-1 text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg inline-flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Refuser
                          </button>
                        )}

                        {cert.status === 'certifiee' && (
                          <button
                            onClick={() => {
                              const storeObj = stores.find(s => s.id === cert.store_id) || ({ id: cert.store_id, name: cert.store_name || 'Boutique' } as StoreType);
                              setSelectedStoreToRevokeCert(storeObj);
                              setRevokeCertReason('');
                            }}
                            className="px-2 py-1 text-xs font-semibold bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-lg"
                          >
                            Retirer la certif.
                          </button>
                        )}

                        <button
                          onClick={() => handleViewStoreCertHistory(cert.store_id, cert.store_name || 'Boutique')}
                          className="px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                          title="Historique des décisions"
                        >
                          Historique
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

      {/* Tab 5: Reviews Moderation */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-slate-900">Modération des avis sur Market Sénégal</h2>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs divide-y divide-slate-100 text-xs">
            {reviews.length === 0 ? (
              <div className="p-8 text-center text-slate-400">Aucun avis utilisateur déposé.</div>
            ) : (
              reviews.map(rev => (
                <div key={rev.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{rev.user_name}</span>
                      <span className="text-amber-500 font-bold">★ {rev.rating}/5</span>
                      <span className="text-slate-400">· {new Date(rev.created_at).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <p className="text-slate-700 italic">« {rev.comment} »</p>
                  </div>

                  <div>
                    <button
                      onClick={() => handleToggleReviewApproval(rev.id, rev.is_approved)}
                      className={`px-3 py-1 rounded-lg font-semibold text-xs transition-colors ${rev.is_approved ? 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                    >
                      {rev.is_approved ? 'Masquer' : 'Approuver'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Orders Overview */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-slate-900">Ensemble des commandes de la plateforme</h2>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs divide-y divide-slate-200">
              <thead className="bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="p-4">N° Commande</th>
                  <th className="p-4">Boutique</th>
                  <th className="p-4">Client</th>
                  <th className="p-4">Région</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50/50">
                    <td className="p-4 font-bold font-mono text-slate-900">{o.order_number}</td>
                    <td className="p-4 font-semibold text-slate-800">{o.store_name}</td>
                    <td className="p-4 text-slate-600">{o.customer_name} ({o.customer_phone})</td>
                    <td className="p-4 text-slate-600">{o.delivery_region}</td>
                    <td className="p-4 font-bold tabular-nums text-slate-900">{formatFCFA(o.total_fcfa)}</td>
                    <td className="p-4 font-semibold text-slate-700">{o.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 7: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-slate-900">Journal d'audit sécurisé</h2>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs divide-y divide-slate-200">
              <thead className="bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="p-4">Horodatage</th>
                  <th className="p-4">Administrateur</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Cible</th>
                  <th className="p-4">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="p-4 text-slate-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('fr-FR')}
                    </td>
                    <td className="p-4 font-semibold text-slate-900">{log.admin_name || log.admin_id}</td>
                    <td className="p-4 font-mono text-blue-700">{log.action}</td>
                    <td className="p-4 text-slate-600">{log.target_type}</td>
                    <td className="p-4 text-slate-500 text-[11px] max-w-xs truncate">
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Intelligence Artificielle */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Brain className="w-5 h-5 text-indigo-600" />
                Gestion & Quotas de l'Intelligence Artificielle
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Supervision des modèles d'IA, limites d'utilisation journalières et transparence pour les vendeurs et clients.
              </p>
            </div>
            <button
              onClick={loadAiConfig}
              className="p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
              title="Rafraîchir l'état"
            >
              <RefreshCw className={`w-4 h-4 ${loadingAi ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Status Box */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">État du service</span>
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${aiStatus?.available ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <span className="text-base font-bold text-slate-900">
                  {aiStatus?.available ? 'Opérationnel' : 'Clé API en attente'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {aiStatus?.available
                  ? 'Le service d’IA est actif côté serveur avec le SDK officiel Google Gen AI.'
                  : 'Aucune clé API d’IA active n’a été renseignée. Les outils sont présentés comme momentanément indisponibles aux utilisateurs sans afficher de fausse réponse.'}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Modèles intégrés</span>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between items-center text-slate-700">
                  <span>Discussion & Brouillons :</span>
                  <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[11px] text-indigo-700 font-semibold">gemini-3.8-flash</code>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>Génération d'images :</span>
                  <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[11px] text-indigo-700 font-semibold">gemini-3.1-flash-lite-image</code>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">Appels strictement isolés côté serveur (aucun secret exposé dans le navigateur).</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Politique tarifaire & Transparence</span>
              <div className="text-2xl font-black text-emerald-600">0 FCFA</div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Aucun surcoût n’est facturé aux boutiques pour l’assistance ou la création d’images IA. Les fonctionnalités sont encadrées par des quotas journaliers.
              </p>
            </div>
          </div>

          {/* Configuration Form */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              Paramétrage des quotas et règles d'utilisation
            </h3>

            <form onSubmit={handleSaveAiConfig} className="space-y-6 max-w-xl">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Quota journalier d'illustrations par boutique (images / jour)
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={dailyQuotaInput}
                  onChange={e => setDailyQuotaInput(Number(e.target.value))}
                  className="w-full sm:w-48 p-2.5 text-xs font-semibold border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600"
                />
                <span className="text-[11px] text-slate-400 block mt-1">
                  Limite le nombre d'images de présentation qu'un vendeur peut générer par jour afin de préserver les ressources.
                </span>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="aiEnabled"
                  checked={aiEnabledInput}
                  onChange={e => setAiEnabledInput(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <label htmlFor="aiEnabled" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  Activer les fonctionnalités d'IA sur l'ensemble de MARKET SÉNÉGAL
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingAi}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {savingAi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Enregistrer les paramètres d'IA
                </button>
              </div>
            </form>
          </div>

          {/* Constitution & Règles déontologiques de l'IA */}
          <div className="bg-indigo-50/50 rounded-2xl border border-indigo-100 p-6 space-y-3 text-xs text-indigo-950">
            <h4 className="font-bold text-sm text-indigo-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              Charte éthique et protection des utilisateurs
            </h4>
            <ul className="list-disc list-inside space-y-1.5 text-slate-700 leading-relaxed">
              <li>
                <strong>Identité non équivoque :</strong> L'assistant s'identifie toujours comme « IA de MARKET SÉNÉGAL » et ne peut jamais se faire passer pour un acheteur ou un vendeur.
              </li>
              <li>
                <strong>Vérité des stocks (Grounding strict) :</strong> L'IA ne peut recommander que des produits réellement enregistrés en base avec un stock disponible. Aucune affirmation de livraison fantaisiste.
              </li>
              <li>
                <strong>Photo réelle obligatoire :</strong> La photo réelle du produit reste la référence obligatoire pour toute fiche produit. L'image IA ne sert qu'à compléter la présentation.
              </li>
              <li>
                <strong>Badge public obligatoire :</strong> Toute illustration générée porte la mention transparente « Illustration générée par IA » sur le catalogue.
              </li>
              <li>
                <strong>Respect de la vie privée :</strong> Les conversations privées ne font l'objet d'aucune analyse automatique. L'IA intervient uniquement lorsque l'utilisateur clique volontairement sur « Suggérer un brouillon ».
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab: Security & Password Management */}
      {activeTab === 'security' && (
        <div className="space-y-8">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-600" />
              Sécurité du Compte Administrateur & Gestion des Accès
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              Espace d'administration strictement restreint au compte administrateur habilité.
              Toute modification de mot de passe invalide automatiquement les autres sessions actives.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Change Password Form */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600" />
                  Changer mon mot de passe
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Accessible à tout moment pour renouveler vos accréditations de manière sécurisée.
                </p>
              </div>

              {passwordChangeSuccess && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">{passwordChangeSuccess}</p>
                    {invalidatedSessionsCount !== null && invalidatedSessionsCount > 0 && (
                      <p className="text-[11px] text-emerald-700">
                        {invalidatedSessionsCount} autre(s) session(s) active(s) révoquée(s) sur vos autres appareils.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {passwordChangeError && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <p className="font-semibold">{passwordChangeError}</p>
                </div>
              )}

              <form onSubmit={handleAdminChangePassword} className="space-y-5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Mot de passe actuel <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="block w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Nouveau mot de passe <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 caractères"
                      className="block w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Confirmer le nouveau mot de passe <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Retapez votre nouveau mot de passe"
                      className="block w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none text-xs"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-[11px] text-slate-600 space-y-1">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Engagements de sécurité automatique :
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
                    <li>Seule l'empreinte cryptographique salée (PBKDF2-SHA512) est persistée en base.</li>
                    <li>Votre mot de passe en clair n'est jamais consigné, journalisé ni exposé.</li>
                    <li>Toutes les autres sessions actives sur d'autres postes seront invalidées immédiatement.</li>
                  </ul>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {changingPassword ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Chiffrement et mise à jour...
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-3.5 h-3.5" />
                        Enregistrer mon nouveau mot de passe
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Right: Security Safeguards & Account Details */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-sm space-y-4 text-xs">
                <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-[11px]">
                  <ShieldCheck className="w-4 h-4" />
                  Protection de l'administration
                </div>
                <h4 className="text-base font-bold text-white">
                  Compte Administrateur Principal
                </h4>

                <div className="space-y-3 pt-2 text-slate-300">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-slate-400">Statut du compte :</span>
                    <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" /> Administrateur Principal Vérifié
                    </span>
                  </div>

                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-slate-400">Rôle système :</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Super Administrateur
                    </span>
                  </div>

                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-slate-400">Stockage mot de passe :</span>
                    <span className="text-emerald-400 font-semibold">PBKDF2-SHA512 + Sel</span>
                  </div>

                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-slate-400">Protection Anti-Brute-Force :</span>
                    <span className="text-emerald-400 font-semibold">5 essais / 15 min blocage</span>
                  </div>

                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-slate-400">Inscription publique admin :</span>
                    <span className="text-rose-400 font-semibold">Désactivée (interdite)</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Récupération par e-mail :</span>
                    <span className="text-slate-200">Jeton unique (30 min)</span>
                  </div>
                </div>
              </div>

              {/* Security Audit preview */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-slate-600" />
                    Dernières actions de sécurité
                  </h4>
                  <button
                    onClick={() => setActiveTab('audit')}
                    className="text-amber-800 hover:underline text-[11px] font-semibold"
                  >
                    Voir tout le journal
                  </button>
                </div>

                <div className="divide-y divide-slate-100 text-[11px]">
                  {auditLogs.filter(l => l.target_type === 'security' || l.action.startsWith('admin_')).length === 0 ? (
                    <div className="py-3 text-slate-400 text-center">Aucun événement de sécurité récent.</div>
                  ) : (
                    auditLogs
                      .filter(l => l.target_type === 'security' || l.action.startsWith('admin_'))
                      .slice(0, 5)
                      .map(l => (
                        <div key={l.id} className="py-2.5 space-y-0.5">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-800 capitalize">
                              {l.action.replace(/_/g, ' ')}
                            </span>
                            <span className="text-slate-400 text-[10px]">
                              {new Date(l.created_at).toLocaleDateString('fr-FR')} {new Date(l.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="text-slate-500 truncate">
                            Admin : {l.admin_name || l.admin_id}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Suspend Store with mandatory reason */}
      {selectedStoreToSuspend && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-sm text-slate-900">
                Suspendre la boutique « {selectedStoreToSuspend.name} »
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              La suspension retirera immédiatement la boutique et ses produits du catalogue public. Les commandes antérieures seront conservées.
            </p>

            <form onSubmit={handleConfirmSuspend} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motif officiel de suspension <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={suspensionReason}
                  onChange={e => setSuspensionReason(e.target.value)}
                  placeholder="Ex: Non-respect des engagements de livraison, signalements répétés..."
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedStoreToSuspend(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl"
                >
                  Confirmer la suspension
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Suspension History */}
      {historyModalStoreName && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">
                Historique des suspensions · {historyModalStoreName}
              </h3>
              <button onClick={() => setHistoryModalStoreName(null)} className="text-xs text-slate-500">
                Fermer
              </button>
            </div>

            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto text-xs">
              {suspensionHistory.length === 0 ? (
                <div className="p-4 text-center text-slate-400">Aucun historique d'incident pour cette boutique.</div>
              ) : (
                suspensionHistory.map(h => (
                  <div key={h.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`font-bold ${h.action === 'suspend' ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {h.action === 'suspend' ? 'Suspension' : 'Réactivation'}
                      </span>
                      <span className="text-slate-400">{new Date(h.created_at).toLocaleString('fr-FR')}</span>
                    </div>
                    <p className="text-slate-600">Motif : {h.reason}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Validate Subscription */}
      {selectedSubToValidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
                Vérification du paiement de l'abonnement
              </h3>
              <button onClick={() => setSelectedSubToValidate(null)} className="text-slate-400 hover:text-slate-700">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl space-y-1.5 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Boutique :</span>
                <strong className="text-slate-900">{selectedSubToValidate.store_name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Forfait demandé :</span>
                <strong className="text-blue-700 uppercase font-black">{selectedSubToValidate.plan_tier} ({formatFCFA(selectedSubToValidate.price_fcfa)})</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Réf. Wave vendeur :</span>
                <code className="font-mono font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  {selectedSubToValidate.offline_payment_reference || 'Non renseignée'}
                </code>
              </div>
              {selectedSubToValidate.proof_document_url && (
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Justificatif / Reçu :</span>
                  <a
                    href={selectedSubToValidate.proof_document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-700 font-semibold underline hover:text-blue-900"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Ouvrir le reçu Wave
                  </a>
                </div>
              )}
            </div>

            <form onSubmit={handleConfirmValidateSub} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Référence du paiement vérifiée sur le compte Wave <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={verifiedPaymentRef}
                  onChange={e => setVerifiedPaymentRef(e.target.value)}
                  placeholder="Ex: WAVE-TX-VERIF-123456"
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 font-mono"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Enregistrez la référence vérifiée de l'encaissement avant d'activer le forfait pour 1 mois (30 jours).
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedSubToValidate(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-xs"
                >
                  Enregistrer et activer pour 1 mois
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Approve Certification */}
      {selectedCertToApprove && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Vérifier le paiement Wave & Valider la certification
              </h3>
              <button onClick={() => setSelectedCertToApprove(null)} className="text-slate-400 hover:text-slate-700">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
              <div>Boutique : <strong className="text-slate-900">{selectedCertToApprove.store_name}</strong></div>
              <div>Montant dû : <strong className="text-slate-900">{formatFCFA(selectedCertToApprove.amount_fcfa)}</strong></div>
              <div>Réf. Wave déclarée : <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-300">{selectedCertToApprove.wave_payment_reference}</code></div>
              {selectedCertToApprove.proof_document_url && (
                <div className="pt-1">
                  <a
                    href={selectedCertToApprove.proof_document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 font-semibold hover:underline"
                  >
                    <FileText className="w-4 h-4" />
                    Ouvrir le document justificatif fourni dans un nouvel onglet
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
              {selectedCertToApprove.vendor_notes && (
                <div className="text-slate-500 italic pt-1">Note vendeur : « {selectedCertToApprove.vendor_notes} »</div>
              )}
            </div>

            <form onSubmit={handleConfirmApproveCert} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Référence vérifiée du paiement Wave (10 000 FCFA) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={adminVerifiedWaveRef}
                  onChange={e => setAdminVerifiedWaveRef(e.target.value)}
                  placeholder="Ex: WAVE-TX-VERIFIE-12345"
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 font-mono"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Confirmez la référence exacte après vérification de l'encaissement sur le relevé Wave officiel.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Notes internes de contrôle (Optionnel)
                </label>
                <textarea
                  rows={2}
                  value={adminCertApprovalNotes}
                  onChange={e => setAdminCertApprovalNotes(e.target.value)}
                  placeholder="Ex: NINEA vérifié auprès de l'ANSD, virement Wave reçu à 14h20..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCertToApprove(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmer et attribuer le badge « Boutique certifiée »
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reject Certification */}
      {selectedCertToReject && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 text-xs">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-600" />
              Refuser la demande de certification
            </h3>
            <p className="text-slate-600">
              Boutique : <strong>{selectedCertToReject.store_name}</strong><br />
              Réf. déclarée : <code className="font-mono">{selectedCertToReject.wave_payment_reference}</code>
            </p>

            <form onSubmit={handleConfirmRejectCert} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Motif du refus (Notifié au vendeur) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={certRejectionReason}
                  onChange={e => setCertRejectionReason(e.target.value)}
                  placeholder="Ex: Transaction Wave introuvable pour ce montant, ou document justificatif illisible..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCertToReject(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl"
                >
                  Confirmer le refus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Revoke Certification */}
      {selectedStoreToRevokeCert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 text-xs">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Retirer la certification de la boutique
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Vous êtes sur le point de retirer la certification pour <strong>{selectedStoreToRevokeCert.name}</strong>. Le badge officiel sera immédiatement retiré de la boutique et de tous ses produits, et la boutique perdra sa priorité d'affichage.
            </p>

            <form onSubmit={handleConfirmRevokeCert} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Motif du retrait / suspension de certification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={revokeCertReason}
                  onChange={e => setRevokeCertReason(e.target.value)}
                  placeholder="Ex: Non-respect répété des délais d'expédition, litige client non résolu..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStoreToRevokeCert(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl"
                >
                  Confirmer le retrait de la certification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Certification History */}
      {certHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                Historique des certifications · {certHistoryModal.storeName}
              </h3>
              <button onClick={() => setCertHistoryModal(null)} className="text-xs text-slate-500 hover:text-slate-900">
                Fermer
              </button>
            </div>

            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto text-xs">
              {certHistoryModal.list.length === 0 ? (
                <div className="p-4 text-center text-slate-400">Aucune demande ou historique pour cette boutique.</div>
              ) : (
                certHistoryModal.list.map(h => (
                  <div key={h.id} className="py-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        h.status === 'certifiee'
                          ? 'bg-emerald-100 text-emerald-800'
                          : h.status === 'refusee'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {h.status === 'certifiee' ? 'Certifiée' : h.status === 'refusee' ? 'Refusée' : h.status}
                      </span>
                      <span className="text-slate-400 text-[11px]">{new Date(h.created_at).toLocaleString('fr-FR')}</span>
                    </div>
                    <div className="text-slate-700">
                      Réf. Wave : <code className="font-mono font-semibold">{h.wave_payment_reference}</code>
                    </div>
                    {h.verified_payment_reference && (
                      <div className="text-emerald-700 text-[11px]">
                        Réf. vérifiée : <code className="font-mono">{h.verified_payment_reference}</code>
                      </div>
                    )}
                    {h.rejection_reason && (
                      <p className="text-rose-700 text-[11px]">Motif refus : {h.rejection_reason}</p>
                    )}
                    {h.admin_notes && (
                      <p className="text-slate-500 text-[11px] italic">Notes admin : {h.admin_notes}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
