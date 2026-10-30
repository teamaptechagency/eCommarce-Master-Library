import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Menu,
  ShoppingCart,
  Search,
  PackageCheck,
  LayoutDashboard,
  LogOut,
  ChevronDown,
  ChevronRight,
  X,
  Phone,
  User,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { scrollToProducts } from '../lib/scroll';

const hideScrollbar = '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

export const Header: React.FC = () => {
  const {
    cartCount,
    cartTotal,
    settings,
    setIsCartOpen,
    searchQuery,
    setSearchQuery,
    categories,
    selectedCategory,
    setSelectedCategory,
    closeProductDetail,
    openTrackOrder,
    openAdminDashboard,
    isAdmin,
    user,
    logout,
    openAuthModal,
  } = useStore();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const callNumber = settings.call_number || '01717823525';
  const freeDeliveryThreshold = settings.free_delivery_threshold || 999;
  const diffToFree = Math.max(0, freeDeliveryThreshold - cartTotal);

  // Lock page scroll + close on Escape while the mobile drawer is open
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isMobileMenuOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    closeProductDetail();
    setIsMobileMenuOpen(false);
    scrollToProducts();
  };

  const goToCategory = (slug: string | null) => {
    setSelectedCategory(slug);
    setIsCategoryDropdownOpen(false);
    setIsMobileMenuOpen(false);
    closeProductDetail();
    scrollToProducts();
  };

  const goHome = () => {
    setSelectedCategory(null);
    setSearchQuery('');
    closeProductDetail();
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navCategories = [
    { label: 'All Products', slug: null as string | null },
    ...categories.map((c) => ({ label: c.name, slug: c.slug as string | null })),
  ];

  /* ---------------------------------------------------------------- */
  /*  Mobile drawer (rendered in a portal so nothing can overlap it)   */
  /* ---------------------------------------------------------------- */
  const mobileDrawer = (
    <div
      className={`md:hidden fixed inset-0 z-[100] ${isMobileMenuOpen ? '' : 'pointer-events-none'}`}
      aria-hidden={!isMobileMenuOpen}
    >
      {/* Backdrop */}
      <div
        onClick={() => setIsMobileMenuOpen(false)}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
          isMobileMenuOpen ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Panel */}
      <aside
        className={`absolute left-0 top-0 h-full w-[86%] max-w-sm bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100 shrink-0">
          <button onClick={goHome} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#EBF6ED] border border-[#A3D9A5] flex items-center justify-center text-[#185824] font-black text-lg">
              T
            </div>
            <span className="text-lg font-black tracking-tight text-[#185824] whitespace-nowrap">
              Tuktak <span className="text-[#E5A016]">Shopping</span>
            </span>
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 -mr-2 text-gray-500 hover:bg-gray-100 rounded-full"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Account */}
          {user ? (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
              <div className="w-11 h-11 shrink-0 rounded-full bg-[#185824] text-white flex items-center justify-center text-base font-bold">
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900 truncate">{user.full_name}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#185824] to-[#278838] text-white">
              <p className="text-sm font-bold">Welcome to Tuktak Shopping</p>
              <p className="text-xs text-white/80 mt-0.5">Login to track orders &amp; checkout faster</p>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  openAuthModal();
                }}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-white text-[#185824] rounded-full text-xs font-bold shadow-sm active:scale-[0.98] transition-transform"
              >
                <User className="w-4 h-4" />
                <span>Login / Sign Up (লগইন করুন)</span>
              </button>
            </div>
          )}

          {/* Quick links */}
          <div className="space-y-1">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                openTrackOrder();
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-gray-800 hover:bg-emerald-50 active:bg-emerald-50"
            >
              <span className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <PackageCheck className="w-4 h-4 text-[#185824]" />
              </span>
              <span className="flex-1 text-left">Track Order (অর্ডার ট্র্যাক)</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>

            {isAdmin && (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  openAdminDashboard();
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-gray-800 hover:bg-emerald-50 active:bg-emerald-50"
              >
                <span className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                  <LayoutDashboard className="w-4 h-4 text-amber-700" />
                </span>
                <span className="flex-1 text-left">Admin Dashboard</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>

          {/* Categories */}
          <div>
            <p className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Shop Categories
            </p>
            <div className="space-y-0.5">
              {navCategories.map((item) => {
                const isActive = selectedCategory === item.slug;
                const cat = categories.find((c) => c.slug === item.slug);
                return (
                  <button
                    key={item.slug ?? 'all'}
                    onClick={() => goToCategory(item.slug)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      isActive
                        ? 'bg-[#185824] text-white font-bold'
                        : 'text-gray-700 font-medium hover:bg-emerald-50 active:bg-emerald-50'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className={`text-xs ${isActive ? 'text-white/80' : 'text-gray-400'}`}>
                      {item.slug === null ? 'সবগুলো' : cat?.name_bn}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Drawer footer */}
        <div className="shrink-0 border-t border-gray-100 p-4 space-y-2 bg-gray-50/70">
          <a
            href={`tel:${callNumber}`}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full bg-white border border-gray-200 text-sm font-bold text-[#185824]"
          >
            <Phone className="w-4 h-4 text-[#E5A016]" />
            <span>{callNumber}</span>
          </a>
          {user && (
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                logout();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-bold text-rose-600 bg-rose-50 hover:bg-rose-100"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          )}
        </div>
      </aside>
    </div>
  );

  return (
    <header className="sticky top-0 z-40 w-full bg-white shadow-xs">
      {/* ============ 1. Top notice strip ============ */}
      <div className="bg-[#165020] text-white text-[11px] sm:text-xs py-1.5 sm:py-2 px-3 tracking-wide relative z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-medium min-w-0">
            <span className="text-sm shrink-0">🚚</span>
            <p className="truncate">
              <span className="sm:hidden">৳৯৯৯+ FREE delivery</span>
              <span className="hidden sm:inline">৳৯৯৯+ orders get FREE delivery</span>
              <span className="mx-1.5 text-emerald-300">{'•'}</span>
              <span className="sm:hidden">৳১,৯৯৯+ 5% OFF</span>
              <span className="hidden sm:inline">৳১,৯৯৯+ orders get 5% Extra OFF</span>
            </p>
          </div>

          <button
            onClick={() => setIsDetailsOpen(!isDetailsOpen)}
            className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-[#E5A016] hover:underline cursor-pointer shrink-0 bg-black/20 px-2.5 py-1 rounded-full"
          >
            <span>Details</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${isDetailsOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {/* Details dropdown */}
        {isDetailsOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-2xs"
              onClick={() => setIsDetailsOpen(false)}
            />
            <div className="absolute left-0 right-0 top-full bg-white text-gray-900 border-b border-gray-200 shadow-2xl p-4 sm:p-6 z-50 animate-fadeIn">
              <div className="max-w-3xl mx-auto space-y-4 text-center">
                <div className="flex items-center justify-center gap-2 text-sm sm:text-base font-black text-[#185824]">
                  <span>🎁</span>
                  <span>Spend more, save more</span>
                </div>
                <p className="text-xs text-gray-500">Applied automatically at checkout</p>

                <div className="relative flex items-center justify-between max-w-md mx-auto my-4 px-6">
                  <div className="absolute left-10 right-10 top-1/2 -translate-y-1/2 h-1 bg-emerald-200 z-0" />
                  <div
                    className="absolute left-10 top-1/2 -translate-y-1/2 h-1 bg-[#278838] z-0 transition-all duration-500"
                    style={{ width: cartTotal >= 1999 ? '100%' : cartTotal >= 999 ? '50%' : '10%' }}
                  />

                  <div className="relative z-10 flex flex-col items-center bg-white px-2">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 text-[#185824] flex items-center justify-center shadow-xs text-base">
                      🚚
                    </div>
                    <span className="text-[10px] sm:text-xs font-bold text-gray-800 mt-1">৳999+</span>
                    <span className="text-[9px] text-gray-500">FREE delivery</span>
                  </div>

                  <div className="relative z-10 flex flex-col items-center bg-white px-2">
                    <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs text-base">
                      🎁
                    </div>
                    <span className="text-[10px] sm:text-xs font-bold text-gray-800 mt-1">৳1,999+</span>
                    <span className="text-[9px] text-gray-500">5% Extra OFF</span>
                  </div>
                </div>

                <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 font-medium">
                  You have <strong className="font-bold">৳{cartTotal}</strong> in your cart —{' '}
                  {diffToFree > 0 ? (
                    <span>
                      add <strong className="font-bold text-[#185824]">৳{diffToFree}</strong> more to get FREE
                      delivery
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-bold">🎉 FREE Delivery Unlocked!</span>
                  )}
                </div>

                <button
                  onClick={() => setIsDetailsOpen(false)}
                  className="px-6 py-2.5 bg-[#185824] hover:bg-[#12431C] text-white text-xs font-bold rounded-full shadow-md transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>Start shopping</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ============ 2. Main bar: menu | logo | search | actions ============ */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center gap-2 sm:gap-4">
        {/* Hamburger (mobile only) */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="md:hidden -ml-1 p-2 text-[#185824] hover:bg-emerald-50 active:bg-emerald-100 rounded-xl transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6 stroke-[2.2]" />
        </button>

        {/* Logo */}
        <button
          onClick={goHome}
          className="flex items-center gap-2 group min-w-0 shrink-0 focus:outline-hidden"
          aria-label="Tuktak Shopping home"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-[#EBF6ED] border border-[#A3D9A5] flex items-center justify-center text-[#185824] font-black text-lg sm:text-2xl group-hover:scale-105 transition-transform shadow-2xs shrink-0">
            T
          </div>
          <span className="text-[17px] min-[400px]:text-lg sm:text-2xl font-black tracking-tight text-[#185824] leading-none whitespace-nowrap">
            Tuktak <span className="text-[#E5A016]">Shopping</span>
          </span>
        </button>

        {/* Desktop search */}
        <form
          onSubmit={handleSearchSubmit}
          className="hidden md:flex flex-1 max-w-xl mx-auto items-center"
        >
          <div className="w-full relative flex items-center">
            <input
              id="header-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, spices, nuts..."
              className="w-full h-10 pl-5 pr-12 bg-gray-50 border border-gray-200 rounded-full text-sm text-gray-800 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-[#278838] focus:border-transparent focus:bg-white transition-all"
            />
            <button
              type="submit"
              className="absolute right-1 w-8 h-8 flex items-center justify-center rounded-full bg-[#185824] text-white hover:bg-[#12431C] transition-colors cursor-pointer"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5">
          {/* Track */}
          <button
            onClick={() => openTrackOrder()}
            className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-[#185824] h-10 px-2.5 lg:px-3 rounded-full hover:bg-emerald-50 transition-colors cursor-pointer"
            aria-label="Track order"
          >
            <PackageCheck className="w-5 h-5 text-[#185824]" />
            <span className="hidden lg:inline">Track</span>
          </button>

          {/* Admin */}
          {isAdmin && (
            <button
              onClick={openAdminDashboard}
              className="hidden md:flex items-center gap-1.5 bg-[#165020] hover:bg-[#12431C] text-white text-xs font-bold h-9 px-3 rounded-full shadow-xs transition-all cursor-pointer"
            >
              <LayoutDashboard className="w-4 h-4 text-[#E5A016]" />
              <span className="hidden xl:inline">Admin</span>
            </button>
          )}

          {/* User */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 h-10 px-1.5 sm:px-2 rounded-full border border-emerald-200 transition-colors cursor-pointer"
                aria-label="Account"
              >
                <div className="w-7 h-7 rounded-full bg-[#185824] text-white flex items-center justify-center text-xs font-bold">
                  {user.full_name.charAt(0).toUpperCase()}
                </div>
                <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-gray-500" />
              </button>

              {isUserMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 text-xs font-medium">
                    <div className="px-4 py-2.5 border-b border-gray-100">
                      <p className="font-bold text-sm text-gray-900 truncate">{user.full_name}</p>
                      <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
                    </div>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        openTrackOrder();
                      }}
                      className="w-full text-left px-4 py-2.5 text-gray-800 hover:bg-emerald-50 hover:text-[#185824] flex items-center gap-2 cursor-pointer"
                    >
                      <PackageCheck className="w-4 h-4 text-[#185824]" />
                      <span>Track Order</span>
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          openAdminDashboard();
                        }}
                        className="w-full text-left px-4 py-2.5 text-gray-800 hover:bg-emerald-50 hover:text-[#185824] flex items-center gap-2 cursor-pointer font-bold"
                      >
                        <LayoutDashboard className="w-4 h-4 text-[#185824]" />
                        <span>Admin Dashboard</span>
                      </button>
                    )}

                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          logout();
                        }}
                        className="w-full text-left px-4 py-2.5 text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-semibold"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Log Out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={openAuthModal}
              className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#185824] hover:bg-emerald-50 active:bg-emerald-100 w-10 h-10 sm:w-auto sm:px-4 rounded-full sm:border sm:border-[#185824]/20 transition-colors cursor-pointer"
              aria-label="Login"
            >
              <User className="w-6 h-6 sm:w-4 sm:h-4 stroke-[2.2]" />
              <span className="hidden sm:inline">Login</span>
            </button>
          )}

          {/* Cart */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative w-10 h-10 flex items-center justify-center text-[#185824] hover:bg-emerald-50 active:bg-emerald-100 rounded-full transition-colors cursor-pointer focus:outline-hidden"
            aria-label="Shopping cart"
          >
            <ShoppingCart className="w-6 h-6 stroke-[2.2]" />
            {cartCount > 0 && (
              <span className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 bg-[#E5A016] text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs ring-2 ring-white">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ============ 3. Mobile search ============ */}
      <div className="md:hidden px-3 pb-3">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            id="mobile-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full h-10 pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-full text-sm text-gray-800 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-[#278838] focus:border-transparent focus:bg-white"
          />
        </form>
      </div>

      {/* ============ 4. Desktop sub-navigation ============ */}
      <div className="hidden md:block bg-[#185824] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 py-2">
          {/* Category dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-bold transition-all text-xs cursor-pointer whitespace-nowrap bg-white/10 hover:bg-white/20 text-white"
            >
              <Menu className="w-3.5 h-3.5" />
              <span>All Categories</span>
              <ChevronDown
                className={`w-3 h-3 ml-0.5 transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isCategoryDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsCategoryDropdownOpen(false)} />
                <div className="absolute left-0 top-full mt-2 w-64 max-h-[65vh] overflow-y-auto bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 text-gray-800">
                  {navCategories.map((item) => {
                    const cat = categories.find((c) => c.slug === item.slug);
                    return (
                      <button
                        key={item.slug ?? 'all'}
                        onClick={() => goToCategory(item.slug)}
                        className={`w-full text-left px-4 py-2.5 text-xs hover:bg-emerald-50 hover:text-[#185824] transition-colors flex items-center justify-between gap-2 ${
                          item.slug === null ? 'font-bold' : 'font-medium'
                        }`}
                      >
                        <span>{item.label}</span>
                        <span className="text-[10px] text-gray-400">
                          {item.slug === null ? 'সবগুলো' : cat?.name_bn}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Category pills */}
          <div
            className={`flex-1 min-w-0 flex items-center gap-2 overflow-x-auto text-xs font-semibold ${hideScrollbar}`}
          >
            {navCategories.map((item) => {
              const isActive = selectedCategory === item.slug;
              return (
                <button
                  key={item.slug ?? 'all'}
                  onClick={() => goToCategory(item.slug)}
                  className={`shrink-0 px-3.5 py-1 rounded-full transition-colors whitespace-nowrap cursor-pointer text-xs ${
                    isActive
                      ? 'bg-white text-[#185824] font-bold shadow-xs'
                      : 'font-semibold hover:bg-white/15 text-white/90'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Hotline */}
          <div className="hidden lg:flex shrink-0 items-center gap-1.5 text-white text-xs font-bold">
            <Phone className="w-3.5 h-3.5 text-[#E5A016]" />
            <a href={`tel:${callNumber}`} className="hover:underline">
              {callNumber}
            </a>
          </div>
        </div>
      </div>

      {/* ============ 5. Mobile drawer (portal) ============ */}
      {typeof document !== 'undefined' && createPortal(mobileDrawer, document.body)}
    </header>
  );
};