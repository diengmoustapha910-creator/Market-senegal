import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { CartProvider } from './context/CartContext.js';
import { Header } from './components/Header.js';
import { Footer } from './components/Footer.js';
import { AuthModal } from './views/AuthModal.js';
import { HomeView } from './views/HomeView.js';
import { SearchView } from './views/SearchView.js';
import { ProductDetailView } from './views/ProductDetailView.js';
import { StorePublicView } from './views/StorePublicView.js';
import { CartView } from './views/CartView.js';
import { ClientDashboardView } from './views/ClientDashboardView.js';
import { VendorDashboardView } from './views/VendorDashboardView.js';
import { AdminDashboardView } from './views/AdminDashboardView.js';
import { AdminLoginView } from './views/AdminLoginView.js';
import { PricingView, HelpView, ContactView, TermsView, PrivacyView } from './views/StaticPages.js';
import { AiChatAssistant } from './components/AiChatAssistant.js';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

const AppContent: React.FC = () => {
  const { currentView, toast } = useAuth();

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <HomeView />;
      case 'search':
        return <SearchView />;
      case 'product':
        return <ProductDetailView />;
      case 'store':
        return <StorePublicView />;
      case 'cart':
        return <CartView />;
      case 'client-dashboard':
        return <ClientDashboardView />;
      case 'vendor-dashboard':
        return <VendorDashboardView />;
      case 'admin-dashboard':
        return <AdminDashboardView />;
      case 'admin-login':
        return <AdminLoginView />;
      case 'pricing':
        return <PricingView />;
      case 'help':
        return <HelpView />;
      case 'contact':
        return <ContactView />;
      case 'terms':
        return <TermsView />;
      case 'privacy':
        return <PrivacyView />;
      default:
        return <HomeView />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      
      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce duration-300">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-xs font-semibold ${
              toast.type === 'success'
                ? 'bg-emerald-900 text-white border-emerald-700'
                : toast.type === 'error'
                ? 'bg-rose-900 text-white border-rose-700'
                : 'bg-slate-900 text-white border-slate-700'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-sky-400 shrink-0" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Global Header */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1">
        {renderView()}
      </main>

      {/* Global Footer */}
      <Footer />

      {/* Global Authentication Modal */}
      <AuthModal />

      {/* Global AI Chat Assistant */}
      <AiChatAssistant />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppContent />
      </CartProvider>
    </AuthProvider>
  );
}
