import React from 'react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from './ProductCard';
import { isProductMatchingCategory } from '../lib/categoryUtils';

export const HotDeals: React.FC = () => {
  const {
    products,
    categories,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    isAdmin,
    openAdminDashboard,
  } = useStore();

  const activeCategory = selectedCategory
    ? categories.find(
        (c) =>
          c.slug === selectedCategory ||
          c.id === selectedCategory ||
          c.slug.toLowerCase() === selectedCategory.toLowerCase() ||
          c.name.toLowerCase() === selectedCategory.toLowerCase()
      )
    : null;

  // Filter products for category / search / all
  let displayProducts = products;

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    displayProducts = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.name_bn.includes(q) ||
        (p.short_description && p.short_description.toLowerCase().includes(q))
    );
  } else if (selectedCategory) {
    displayProducts = products.filter((p) =>
      isProductMatchingCategory(p, selectedCategory, categories)
    );
  } else {
    // Show all available products on the main catalog
    displayProducts = products;
  }

  return (
    <section id="products-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-12">
      {/* 1. Header: "Bestselling Products" on Left and "VIEW ALL →" on Right (Matching Screenshot 2) */}
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#185824] tracking-tight">
            {searchQuery
              ? `Search: "${searchQuery}"`
              : activeCategory
              ? `${activeCategory.name} Products`
              : 'Bestselling Products'}
          </h2>
          <p className="text-xs text-gray-500 font-medium">
            {displayProducts.length > 0
              ? `${displayProducts.length}টি পণ্য প্রদর্শিত হচ্ছে`
              : 'কোনো পণ্য নেই'}
          </p>
        </div>

        {/* VIEW ALL -> Link */}
        <button
          onClick={() => setSelectedCategory(null)}
          className="text-xs sm:text-sm font-bold text-[#185824] hover:text-[#12431C] flex items-center gap-1 cursor-pointer transition-colors"
        >
          <span>VIEW ALL</span>
          <span>→</span>
        </button>
      </div>

      {/* 2. Responsive 2-Column Grid on Mobile (Matching Screenshot 2) */}
      {displayProducts.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 p-8 sm:p-12 text-center space-y-3 shadow-2xs">
          <span className="text-4xl block mb-2">🍃</span>
          <h3 className="text-base sm:text-lg font-bold text-gray-800">
            {searchQuery
              ? 'কোনো পণ্য পাওয়া যায়নি'
              : selectedCategory
              ? `"${activeCategory?.name || selectedCategory}" ক্যাটাগরিতে এখনো কোনো পণ্য নেই`
              : 'এখনো কোনো পণ্য যুক্ত করা হয়নি'}
          </h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            {searchQuery
              ? 'অন্য কোনো নাম বা কি-ওয়ার্ড দিয়ে সার্চ করে দেখুন।'
              : 'শীঘ্রই আমাদের নতুন কালেকশন যুক্ত করা হবে!'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#185824] text-xs font-bold rounded-xl border border-emerald-200 transition-colors cursor-pointer"
              >
                সব পণ্য দেখুন (View All)
              </button>
            )}
            {isAdmin && !searchQuery && (
              <button
                onClick={openAdminDashboard}
                className="px-4 py-2 bg-[#185824] hover:bg-[#12431C] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>+ নতুন পণ্য যুক্ত করুন</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4.5">
          {displayProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
};
