import React, { useState } from 'react';
import {
  ArrowLeft,
  ShoppingBag,
  Phone,
  MessageCircle,
  Truck,
  ShieldCheck,
  Minus,
  Plus,
  Star,
  Gift,
  Heart,
  Share2,
  CheckCircle2,
} from 'lucide-react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';
import { ProductCard } from './ProductCard';

interface ProductDetailPageProps {
  product: Product;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({ product }) => {
  const {
    closeProductDetail,
    addToCart,
    openCheckout,
    settings,
    toggleWishlist,
    isInWishlist,
    products,
    showToast,
  } = useStore();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(
    product.variants && product.variants.length > 0 ? product.variants[0].value : undefined
  );

  const isFavorite = isInWishlist(product.id);
  const images = product.images && product.images.length > 0 ? product.images : [product.image_url];
  const activeImage = images[activeImageIndex] || product.image_url;

  // Selected variant price calculation
  const currentVariantObj = product.variants?.find((v) => v.value === selectedVariant);
  const unitPrice = currentVariantObj?.price_override || product.price;
  const totalPrice = unitPrice * quantity;

  // Free delivery calculation
  const freeThreshold = settings.free_delivery_threshold || 999;
  const extraDiscountThreshold = settings.extra_discount_threshold || 1999;
  const diffToFree = Math.max(0, freeThreshold - totalPrice);
  const progressPercent = Math.min(100, (totalPrice / freeThreshold) * 100);

  // WhatsApp Order message
  const waMessage = encodeURIComponent(
    `Hello! I want to order "${product.name}" (Variant: ${
      selectedVariant || 'Standard'
    }, Qty: ${quantity}, Total: ৳${totalPrice}). Please confirm my order.`
  );
  const waUrl = `https://wa.me/88${settings.whatsapp_number}?text=${waMessage}`;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: `Check out ${product.name} on our store!`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('লিংক কপি করা হয়েছে!');
    }
  };

  // Related products (same category)
  const relatedProducts = products
    .filter(
      (p) =>
        p.id !== product.id &&
        (p.category_id === product.category_id ||
          (Boolean(p.category_slug) &&
            Boolean(product.category_slug) &&
            p.category_slug === product.category_slug))
    )
    .slice(0, 4);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-8">
      {/* 1. Breadcrumb / Back Navigation */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-6">
        <button
          onClick={closeProductDetail}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-gray-700 hover:text-[#185824] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>ব্যাক টু হোমপেজ (Back to Shop)</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="p-2 rounded-full bg-white hover:bg-emerald-50 border border-gray-200 text-gray-600 hover:text-[#185824] transition-colors cursor-pointer shadow-2xs"
            title="Share Product"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => toggleWishlist(product.id)}
            className={`p-2 rounded-full bg-white hover:bg-emerald-50 border border-gray-200 transition-colors cursor-pointer shadow-2xs ${
              isFavorite ? 'text-[#185824]' : 'text-gray-400'
            }`}
            title="Save to Wishlist"
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-[#185824]' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Main 2-Column Product Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Left Column: Image Showcase */}
        <div className="lg:col-span-6 space-y-4">
          {/* Large Main Image Frame */}
          <div className="relative aspect-square w-full rounded-3xl overflow-hidden bg-white border border-gray-200 shadow-xs flex items-center justify-center p-6">
            <img
              src={activeImage}
              alt={product.name}
              className="w-full h-full object-contain hover:scale-105 transition-transform duration-300"
              referrerPolicy="no-referrer"
            />

            {/* Discount Badge */}
            {product.discount_percent && product.discount_percent > 0 ? (
              <div className="absolute top-4 right-4 bg-[#E5A016] text-[#1F2937] text-xs font-black px-3 py-1 rounded-full shadow-xs">
                {product.badge || `${product.discount_percent}% OFF`}
              </div>
            ) : null}
          </div>

          {/* Thumbnail Strip */}
          {images.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 transition-all p-1.5 bg-white cursor-pointer shrink-0 ${
                    activeImageIndex === idx
                      ? 'border-[#278838] ring-2 ring-emerald-200 scale-105'
                      : 'border-gray-200 hover:border-emerald-300 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img}
                    alt={`${product.name} thumbnail ${idx + 1}`}
                    className="w-full h-full object-contain rounded-xl"
                    referrerPolicy="no-referrer"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Purchasing Module */}
        <div className="lg:col-span-6 space-y-5">
          {/* Tags & Title */}
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-emerald-50 text-[#185824] text-[11px] font-bold uppercase mb-2 border border-emerald-200/60">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#278838]" />
              <span>{product.secondary_badge || 'Acure Organic Standard'}</span>
              <span>·</span>
              <span>ইন স্টক ({product.stock} available)</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-[#1F2937] leading-tight">
              {product.name}
            </h1>
            {product.name_bn && (
              <p className="text-base sm:text-lg text-gray-500 font-sans mt-1">
                {product.name_bn}
              </p>
            )}

            {/* Rating */}
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="text-xs font-bold text-gray-700">5.0</span>
              <span className="text-xs text-gray-400">({product.review_count || 12} reviews)</span>
              <span className="text-gray-300">·</span>
              <span className="text-xs text-[#185824] font-bold">Sold {product.sold_count || 48}</span>
            </div>
          </div>

          {/* Pricing */}
          <div className="flex items-baseline gap-3 pb-3 border-b border-gray-200">
            <span className="text-3xl sm:text-4xl font-black text-[#185824]">
              ৳{unitPrice.toLocaleString('en-US')}
            </span>
            {product.old_price && product.old_price > unitPrice ? (
              <span className="text-lg text-gray-400 line-through">
                ৳{product.old_price.toLocaleString('en-US')}
              </span>
            ) : null}
            {product.old_price && product.old_price > unitPrice ? (
              <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
                সেভ ৳{(product.old_price - unitPrice).toLocaleString('en-US')}
              </span>
            ) : null}
          </div>

          {/* Variant Selector (Gram / Size selection matching Screenshot 2) */}
          {product.variants && product.variants.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Select Option / Weight:
              </label>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const isSelected = selectedVariant === v.value;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v.value)}
                      className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#185824] bg-[#185824] text-white shadow-xs'
                          : 'border-emerald-300 bg-emerald-50/30 text-[#185824] hover:bg-emerald-100/50'
                      }`}
                    >
                      {v.value}
                      {v.price_override ? (
                        <span className="ml-1 opacity-90">(৳{v.price_override})</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stepper + Add to Cart Row */}
          <div className="flex items-center gap-3 pt-1">
            {/* Quantity Stepper */}
            <div className="flex items-center border border-gray-300 rounded-xl bg-white px-2 py-1 shadow-2xs">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:bg-emerald-50 hover:text-[#185824] transition-colors cursor-pointer"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-10 text-center font-bold text-sm text-gray-900">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:bg-emerald-50 hover:text-[#185824] transition-colors cursor-pointer"
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Golden-Yellow Add to Cart Button */}
            <button
              onClick={() => addToCart(product, quantity, selectedVariant)}
              className="flex-1 py-3 px-5 bg-[#E5A016] hover:bg-[#D49010] active:scale-[0.98] text-[#1F2937] text-xs sm:text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Add to Cart</span>
            </button>
          </div>

          {/* Big Deep Green Order Now Button (Acure Style) */}
          <button
            onClick={() => openCheckout(product, quantity, selectedVariant)}
            className="w-full py-3.5 px-6 bg-[#185824] hover:bg-[#12431C] active:scale-[0.99] text-white rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-3 text-left">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="block text-sm sm:text-base font-black tracking-wide">
                  Order Now (এখনই অর্ডার করুন)
                </span>
                <span className="block text-[11px] text-emerald-100 font-sans">
                  ক্যাশ অন ডেলিভারি · পণ্য হাতে পেয়ে মূল্য দিন
                </span>
              </div>
            </div>

            <div className="bg-white/20 px-3.5 py-1.5 rounded-xl font-mono font-black text-xs sm:text-sm text-white flex items-center gap-1 group-hover:bg-[#E5A016] group-hover:text-[#1F2937] transition-colors">
              <span>৳{totalPrice.toLocaleString('en-US')}</span>
              <span>→</span>
            </div>
          </button>

          {/* WhatsApp & Call Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl transition-all flex items-center gap-2 text-left group"
            >
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div className="leading-tight overflow-hidden">
                <span className="block text-xs font-bold truncate group-hover:text-emerald-900">
                  WhatsApp Order
                </span>
                <span className="block text-[10px] text-emerald-600 truncate">
                  Usually replies fast
                </span>
              </div>
            </a>

            <a
              href={`tel:${settings.call_number || '01717823525'}`}
              className="py-2.5 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-xl transition-all flex items-center gap-2 text-left group"
            >
              <div className="w-8 h-8 rounded-full bg-[#E5A016] text-[#1F2937] flex items-center justify-center shrink-0 shadow-xs font-bold">
                <Phone className="w-4 h-4" />
              </div>
              <div className="leading-tight overflow-hidden">
                <span className="block text-xs font-bold truncate group-hover:text-amber-950">
                  Call to Order
                </span>
                <span className="block text-[10px] text-amber-700 truncate font-mono">
                  {settings.call_number || '01717823525'}
                </span>
              </div>
            </a>
          </div>

          {/* Free Delivery Milestone Progress Bar */}
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-gray-800">
              <span>
                {diffToFree > 0
                  ? `Add ৳${diffToFree.toLocaleString('en-US')} more for FREE delivery 🚚`
                  : '🎉 Congratulations! You have unlocked FREE Delivery!'}
              </span>
            </div>

            {/* Visual Bar */}
            <div className="w-full h-2.5 bg-emerald-100 rounded-full overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-[#278838] to-[#185824] rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-bold text-gray-600 pt-0.5">
              <div className="flex items-center gap-1">
                <span>🚚 Free delivery at:</span>
                <span className="font-mono text-gray-900">৳{freeThreshold}</span>
              </div>
              <div className="flex items-center gap-1">
                <Gift className="w-3.5 h-3.5 text-[#E5A016]" />
                <span>Special Gift:</span>
                <span className="font-mono text-gray-900">৳{extraDiscountThreshold}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Product Description Section */}
      {product.description && (
        <div className="mt-10 bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 shadow-2xs">
          <h4 className="font-black text-lg text-gray-900 border-b border-gray-100 pb-3 mb-4 flex items-center gap-2">
            <span>বিবরণ (Product Details)</span>
          </h4>
          <div className="text-sm text-gray-700 leading-relaxed font-sans whitespace-pre-line">
            {product.description}
          </div>
        </div>
      )}

      {/* 4. Related Products in 2-col/4-col Acure Card Grid */}
      {relatedProducts.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-black text-[#185824]">
              Related Products (সম্পর্কিত পণ্য)
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
