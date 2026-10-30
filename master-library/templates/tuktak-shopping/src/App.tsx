import React, { useEffect } from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { Header } from './components/Header';
import { HeroBanner } from './components/HeroBanner';
import { TopCategories } from './components/TopCategories';
import { FlashSales } from './components/FlashSales';
import { HotDeals } from './components/HotDeals';
import { ProductDetailPage } from './components/ProductDetailPage';
import { CheckoutModal } from './components/CheckoutModal';
import { CartDrawer } from './components/CartDrawer';
import { TrackOrderModal } from './components/TrackOrderModal';
import { AuthModal } from './components/AuthModal';
import { AdminDashboard } from './components/AdminDashboard';
import { Footer } from './components/Footer';
import { BottomNav } from './components/BottomNav';

const MainLayout: React.FC = () => {
  const {
    selectedProduct,
    toastMessage,
    openAdminDashboard,
    closeAdminDashboard,
    isAdminDashboardOpen,
    isAdmin,
    user,
    openAuthModal,
    showToast,
    setIsCartOpen,
    openTrackOrder,
  } = useStore();

  useEffect(()=>{const portal=new URLSearchParams(location.search).get('portal');if(portal==='cart')setIsCartOpen(true);if(portal==='track')openTrackOrder();},[]);

  // Strict route & hash guard for admin dashboard
  useEffect(() => {
    const checkAdminRoute = () => {
      const isTryingAdmin =
        window.location.hash === '#admin' ||
        window.location.pathname === '/admin' ||
        window.location.pathname.startsWith('/admin');

      if (isTryingAdmin) {
        if (!user) {
          // Unauthenticated user
          closeAdminDashboard();
          if (window.location.hash === '#admin') {
            window.history.replaceState(null, '', window.location.pathname.replace(/\/admin\/?$/, '/') || '/');
          }
          openAuthModal();
          showToast('অ্যাডমিন ড্যাশবোর্ডে প্রবেশ করতে অনুগ্রহ করে আগে লগইন করুন।');
          return;
        }

        if (!isAdmin) {
          // Authenticated normal user without admin role
          closeAdminDashboard();
          if (window.location.hash === '#admin' || window.location.pathname.includes('/admin')) {
            window.history.replaceState(null, '', '/');
          }
          showToast('অ্যাক্সেস অস্বীকৃত: আপনার অ্যাকাউন্টে অ্যাডমিন অনুমতি নেই। (Access Denied)');
          return;
        }

        // Verified admin user
        openAdminDashboard();
      }
    };

    checkAdminRoute();
    window.addEventListener('hashchange', checkAdminRoute);
    window.addEventListener('popstate', checkAdminRoute);
    return () => {
      window.removeEventListener('hashchange', checkAdminRoute);
      window.removeEventListener('popstate', checkAdminRoute);
    };
  }, [user, isAdmin, openAdminDashboard, closeAdminDashboard, openAuthModal, showToast]);

  // If Admin Dashboard is active and authorized, render as a full standalone page
  if (isAdminDashboardOpen && isAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 text-[#1F1F24]">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-60 bg-[#1F1F24] text-white px-5 py-2.5 rounded-full shadow-2xl text-xs sm:text-sm font-bold flex items-center gap-2 animate-bounce">
            <span>{toastMessage}</span>
          </div>
        )}
        <AdminDashboard />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAF6] text-[#1F2937]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-60 bg-[#165020] text-white px-5 py-2.5 rounded-full shadow-2xl text-xs sm:text-sm font-bold flex items-center gap-2 animate-bounce border border-emerald-500/30">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <Header />

      {/* Main View Router */}
      <main className="flex-1 pb-16 sm:pb-0">
        {selectedProduct ? (
          /* Product Details Page */
          <ProductDetailPage product={selectedProduct} />
        ) : (
          /* Homepage */
          <>
            <HeroBanner />
            <TopCategories />
            <FlashSales />
            <HotDeals />
          </>
        )}
      </main>

      {/* Footer & Mobile Bottom Navigation */}
      <Footer />
      <BottomNav />

      {/* Overlays / Modals */}
      <CheckoutModal />
      <CartDrawer />
      <TrackOrderModal />
      <AuthModal />
    </div>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <MainLayout />
    </StoreProvider>
  );
}
