import React from 'react';
import { Home, LayoutGrid, ShoppingCart, Search, MessageCircle } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { scrollToProducts } from '../lib/scroll';

export const BottomNav: React.FC = () => {
  const {
    cartCount,
    setIsCartOpen,
    setSelectedCategory,
    closeProductDetail,
    settings,
  } = useStore();

  const handleHomeClick = () => {
    setSelectedCategory(null);
    closeProductDetail();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCategoriesClick = () => {
    closeProductDetail();
    const catSection = document.getElementById('shop-by-category-section');
    if (catSection) {
      catSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      scrollToProducts();
    }
  };

  const handleSearchClick = () => {
    closeProductDetail();
    const searchInput = document.getElementById('header-search-input');
    if (searchInput) {
      searchInput.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      scrollToProducts();
    }
  };

  const handleChatClick = () => {
    const waUrl = `https://wa.me/88${settings.whatsapp_number}?text=${encodeURIComponent(
      'হ্যালো, আমি আপনার ওয়েবসাইট থেকে পণ্য সম্পর্কে বিস্তারিত জানতে চাই।'
    )}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <nav
      aria-label="Mobile Navigation"
      className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 px-3 py-1.5 flex items-center justify-around shadow-lg"
    >
      {/* 1. Home */}
      <button
        onClick={handleHomeClick}
        className="flex flex-col items-center justify-center gap-0.5 text-[#185824] hover:text-[#12431C] py-1 px-2 cursor-pointer transition-colors"
      >
        <Home className="w-5 h-5 stroke-[2.2]" />
        <span className="text-[10px] font-bold">Home</span>
      </button>

      {/* 2. Menu / Categories */}
      <button
        onClick={handleCategoriesClick}
        className="flex flex-col items-center justify-center gap-0.5 text-gray-500 hover:text-[#185824] py-1 px-2 cursor-pointer transition-colors"
      >
        <LayoutGrid className="w-5 h-5 stroke-[2]" />
        <span className="text-[10px] font-semibold">Menu</span>
      </button>

      {/* 3. Cart with Yellow Badge */}
      <button
        onClick={() => setIsCartOpen(true)}
        className="relative flex flex-col items-center justify-center gap-0.5 text-gray-600 hover:text-[#185824] py-1 px-2 cursor-pointer transition-colors"
      >
        <div className="relative">
          <ShoppingCart className="w-5 h-5 stroke-[2]" />
          {cartCount > 0 && (
            <span className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 bg-[#E5A016] text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-xs animate-pulse-subtle">
              {cartCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-semibold">Cart</span>
      </button>

      {/* 4. Search */}
      <button
        onClick={handleSearchClick}
        className="flex flex-col items-center justify-center gap-0.5 text-gray-500 hover:text-[#185824] py-1 px-2 cursor-pointer transition-colors"
      >
        <Search className="w-5 h-5 stroke-[2]" />
        <span className="text-[10px] font-semibold">Search</span>
      </button>

      {/* 5. Chat */}
      <button
        onClick={handleChatClick}
        className="flex flex-col items-center justify-center gap-0.5 text-gray-500 hover:text-[#185824] py-1 px-2 cursor-pointer transition-colors"
      >
        <MessageCircle className="w-5 h-5 stroke-[2]" />
        <span className="text-[10px] font-semibold">Chat</span>
      </button>
    </nav>
  );
};
