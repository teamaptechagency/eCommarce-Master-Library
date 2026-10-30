import React from 'react';
import { Heart, Plus } from 'lucide-react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';

interface ProductCardProps {
  product: Product;
}

const FALLBACK_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="15" fill="#EBF6ED"/><text x="50" y="60" font-size="34" text-anchor="middle">🍃</text></svg>'
  );

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { openCheckout, openProductDetail, toggleWishlist, isInWishlist, addToCart } = useStore();

  const isFavorite = isInWishlist(product.id);

  const handleCardClick = () => {
    openProductDetail(product);
  };

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Quick Add directly to cart / checkout
    addToCart(product, 1);
  };

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWishlist(product.id);
  };

  // Derive display tags (like "15 Gram", "40 Gram", or custom variants)
  const displayTags =
    product.variants && product.variants.length > 0
      ? product.variants.slice(0, 2).map((v) => v.name || v.value)
      : [product.secondary_badge || 'Standard'];

  return (
    <div
      onClick={handleCardClick}
      className="bg-white rounded-2xl border border-gray-200 hover:border-emerald-300 p-2.5 sm:p-3.5 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group cursor-pointer hover:-translate-y-0.5"
    >
      {/* 1. Center Image Section matching Acure Product Card */}
      <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-gray-50/60 mb-2.5 flex items-center justify-center p-2">
        <img
          src={product.image_url || FALLBACK_IMAGE}
          alt={product.name}
          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const img = e.currentTarget;
            img.onerror = null;
            img.src = FALLBACK_IMAGE;
          }}
        />

        {/* Optional Discount Badge */}
        {product.discount_percent && product.discount_percent > 0 ? (
          <div className="absolute top-1.5 left-1.5 bg-[#E5A016] text-[#1F2937] text-[10px] font-black px-2 py-0.5 rounded-md shadow-xs">
            -{product.discount_percent}%
          </div>
        ) : null}

        {/* Wishlist Button (Subtle top right) */}
        <button
          onClick={handleWishlistClick}
          className={`absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-xs cursor-pointer ${
            isFavorite
              ? 'bg-emerald-50 text-[#185824]'
              : 'bg-white/80 text-gray-400 hover:text-[#185824]'
          }`}
          aria-label="Wishlist"
        >
          <Heart
            className={`w-3.5 h-3.5 ${
              isFavorite ? 'fill-[#185824] text-[#185824]' : 'text-gray-400'
            }`}
          />
        </button>
      </div>

      {/* 2. Product Information */}
      <div className="flex-1 flex flex-col justify-between space-y-2">
        {/* Title (2 lines max, matching "Acure Rosemary - রোজমেরি") */}
        <div>
          <h3 className="text-xs sm:text-sm font-semibold text-[#1F2937] line-clamp-2 leading-snug group-hover:text-[#185824] transition-colors">
            {product.name}
            {product.name_bn && product.name_bn !== product.name ? ` - ${product.name_bn}` : ''}
          </h3>
        </div>

        {/* 3. Price & "+ Add" Button Row matching Screenshot 2 */}
        <div className="flex items-center justify-between gap-1 pt-1">
          {/* Price in Green */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm sm:text-base font-black text-[#185824]">
              ৳{product.price.toLocaleString('en-US')}
            </span>
            {product.old_price && product.old_price > product.price ? (
              <span className="text-[11px] text-gray-400 line-through">
                ৳{product.old_price.toLocaleString('en-US')}
              </span>
            ) : null}
          </div>

          {/* "+ Add" Deep Forest Green Pill Button */}
          <button
            onClick={handleAddClick}
            className="px-3 py-1 sm:px-3.5 sm:py-1.5 bg-[#185824] hover:bg-[#12431C] active:scale-95 text-white text-xs font-bold rounded-full transition-all flex items-center gap-1 cursor-pointer shadow-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add</span>
          </button>
        </div>

        {/* 4. Variant / Gram Badges below matching Screenshot 2 (e.g. "15 Gram", "40 Gram") */}
        <div className="flex items-center gap-1.5 pt-0.5 overflow-x-hidden">
          {displayTags.map((tag, idx) => (
            <span
              key={idx}
              className="inline-block border border-[#278838]/80 text-[#185824] bg-emerald-50/40 rounded-md text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 truncate"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
