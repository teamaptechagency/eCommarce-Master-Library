import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { scrollToProducts } from '../lib/scroll';
import { isProductMatchingCategory } from '../lib/categoryUtils';

const FALLBACK_CATEGORY_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#EBF6ED"/><text x="50" y="62" font-size="42" text-anchor="middle">🍃</text></svg>`
  );

const hideScrollbar = '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

export const TopCategories: React.FC = () => {
  const { categories, products, selectedCategory, setSelectedCategory, closeProductDetail } =
    useStore();

  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollAmount = clientWidth * 0.75;
      scrollRef.current.scrollTo({
        left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <section id="shop-by-category-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
      {/* Header: "Shop by Category" in Green matching Screenshot 1 */}
      <div className="flex items-center justify-between mb-3.5 sm:mb-5 relative">
        <h2 className="text-xl sm:text-2xl font-black text-[#185824] tracking-tight">
          Shop by Category
        </h2>

        <div className="flex items-center gap-3">
          {/* Scroll Arrows (< and >) matching Screenshot 1 */}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              onClick={() => scroll('left')}
              aria-label="Scroll left"
              className="w-8 h-8 rounded-full bg-[#E5A016] hover:bg-[#D49010] text-[#1F2937] flex items-center justify-center shadow-xs transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
            </button>
            <button
              onClick={() => scroll('right')}
              aria-label="Scroll right"
              className="w-8 h-8 rounded-full bg-[#E5A016] hover:bg-[#D49010] text-[#1F2937] flex items-center justify-center shadow-xs transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          <button
            onClick={() => {
              setSelectedCategory(null);
              closeProductDetail();
              scrollToProducts();
            }}
            className="text-xs sm:text-sm font-bold text-[#185824] hover:text-[#12431C] flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>VIEW ALL</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Row with Circular/Rounded Cards matching Screenshot 1 */}
      <div className="relative">
        <div
          ref={scrollRef}
          className={`flex items-stretch gap-3.5 sm:gap-4 overflow-x-auto snap-x pb-3 pt-1 ${hideScrollbar}`}
        >
          {/* Card 1: All Products */}
          <button
            onClick={() => {
              setSelectedCategory(null);
              closeProductDetail();
              scrollToProducts();
            }}
            className={`shrink-0 snap-start w-32 sm:w-36 bg-white rounded-2xl border text-center p-3 shadow-2xs hover:shadow-md transition-all flex flex-col items-center justify-between cursor-pointer group ${
              selectedCategory === null
                ? 'border-[#278838] ring-2 ring-[#278838]/20 bg-emerald-50/25'
                : 'border-gray-200 hover:border-emerald-300'
            }`}
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-50/70 flex items-center justify-center text-3xl mb-2 group-hover:scale-105 transition-transform shadow-2xs">
              📦
            </div>
            <div className="w-full">
              <span className="block text-xs sm:text-sm font-bold text-[#185824] group-hover:text-[#12431C] leading-snug truncate">
                All Products
              </span>
              <span className="block text-[10px] sm:text-xs text-gray-400 font-sans mt-0.5">
                {products.length} items
              </span>
            </div>
          </button>

          {/* Dynamic Categories */}
          {categories.map((cat) => {
            const isSelected =
              Boolean(selectedCategory) &&
              (selectedCategory === cat.slug ||
                selectedCategory === cat.id ||
                selectedCategory?.toLowerCase() === cat.slug.toLowerCase() ||
                selectedCategory?.toLowerCase() === cat.name.toLowerCase());

            const itemCount = products.filter((p) =>
              isProductMatchingCategory(p, cat.slug, categories)
            ).length;

            return (
              <button
                key={cat.id}
                onClick={() => {
                  if (isSelected) {
                    setSelectedCategory(null);
                  } else {
                    setSelectedCategory(cat.slug);
                  }
                  closeProductDetail();
                  scrollToProducts();
                }}
                className={`shrink-0 snap-start w-32 sm:w-36 bg-white rounded-2xl border text-center p-3 shadow-2xs hover:shadow-md transition-all flex flex-col items-center justify-between cursor-pointer group ${
                  isSelected
                    ? 'border-[#278838] ring-2 ring-[#278838]/20 bg-emerald-50/25'
                    : 'border-gray-200 hover:border-emerald-300'
                }`}
              >
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-emerald-50/40 flex items-center justify-center p-1.5 mb-2 group-hover:scale-105 transition-transform shadow-2xs">
                  <img
                    src={cat.image_url || FALLBACK_CATEGORY_IMAGE}
                    alt={cat.name}
                    loading="lazy"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.onerror = null;
                      img.src = FALLBACK_CATEGORY_IMAGE;
                    }}
                  />
                </div>
                <div className="w-full">
                  <span className="block text-xs sm:text-sm font-bold text-[#185824] group-hover:text-[#12431C] leading-snug truncate capitalize">
                    {cat.name}
                  </span>
                  <span className="block text-[10px] sm:text-xs text-gray-400 font-sans mt-0.5">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
