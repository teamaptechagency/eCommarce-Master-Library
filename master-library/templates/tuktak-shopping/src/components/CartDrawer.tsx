import React from 'react';
import { X, ShoppingBag, Minus, Plus, Trash2, ArrowRight, Gift } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export const CartDrawer: React.FC = () => {
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    updateCartQuantity,
    removeFromCart,
    cartTotal,
    settings,
    openCheckout,
  } = useStore();

  if (!isCartOpen) return null;

  const freeThreshold = settings.free_delivery_threshold || 999;
  const diffToFree = Math.max(0, freeThreshold - cartTotal);
  const progressPercent = Math.min(100, (cartTotal / freeThreshold) * 100);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={() => setIsCartOpen(false)}
        className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-gray-200 flex items-center justify-between bg-emerald-50/40">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#185824] text-white flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <h2 className="text-base font-black text-gray-900">
                আপনার শপিং ব্যাগ ({cart.length})
              </h2>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-white transition-colors cursor-pointer"
              aria-label="Close cart"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Delivery Bar inside Drawer */}
          <div className="p-3.5 bg-emerald-50/60 border-b border-emerald-100 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
              <span className="flex items-center gap-1">
                <Gift className="w-3.5 h-3.5 text-[#E5A016]" />
                {diffToFree > 0 ? (
                  <>আর ৳{diffToFree} কিনলেই ফ্রি ডেলিভারি!</>
                ) : (
                  <span className="text-emerald-700">ফ্রি ডেলিভারি আনলক হয়েছে! 🚚</span>
                )}
              </span>
              <span className="text-[10px] text-gray-500">টার্গেট: ৳{freeThreshold}</span>
            </div>
            <div className="w-full h-2 bg-emerald-200/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#278838] rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-3xl flex items-center justify-center mx-auto text-[#185824]">
                  🛍️
                </div>
                <h3 className="text-sm font-bold text-gray-800">আপনার ব্যাগটি এখনো খালি</h3>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">
                  পছন্দের পণ্য বা উপাদান সিলেক্ট করে ব্যাগে যোগ করুন
                </p>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="mt-2 px-5 py-2 bg-[#185824] text-white text-xs font-bold rounded-full hover:bg-[#12431C] transition-colors cursor-pointer"
                >
                  শপিং শুরু করুন
                </button>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div
                  key={`${item.product.id}-${item.selectedVariant || idx}`}
                  className="flex gap-3 p-3 bg-white rounded-2xl border border-gray-200 shadow-2xs hover:border-emerald-300 transition-colors"
                >
                  <img
                    src={item.product.image_url}
                    alt={item.product.name}
                    className="w-16 h-16 object-contain rounded-xl border border-gray-100 bg-gray-50 shrink-0 p-1"
                    referrerPolicy="no-referrer"
                  />

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <h4 className="text-xs font-bold text-gray-900 truncate pr-2">
                          {item.product.name}
                        </h4>
                        <button
                          onClick={() => removeFromCart(item.product.id, item.selectedVariant)}
                          className="text-gray-400 hover:text-red-500 p-0.5 cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {item.selectedVariant && (
                        <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-sm inline-block mt-0.5 font-semibold">
                          {item.selectedVariant}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      {/* Quantity Stepper */}
                      <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50 px-1.5 py-0.5 text-xs">
                        <button
                          onClick={() => updateCartQuantity(item.product.id, item.selectedVariant, -1)}
                          className="text-gray-500 hover:text-gray-900 p-0.5 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-bold text-gray-800">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateCartQuantity(item.product.id, item.selectedVariant, 1)}
                          className="text-gray-500 hover:text-gray-900 p-0.5 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Line Item Total */}
                      <span className="font-mono font-black text-sm text-[#185824]">
                        ৳{(item.product.price * item.quantity).toLocaleString('en-US')}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Checkout CTA */}
          {cart.length > 0 && (
            <div className="p-4 sm:p-5 border-t border-gray-200 bg-gray-50/50 space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold text-gray-600">সাবটোটাল</span>
                <span className="text-lg font-black text-gray-900 font-mono">
                  ৳{cartTotal.toLocaleString('en-US')}
                </span>
              </div>

              <button
                onClick={() => {
                  setIsCartOpen(false);
                  openCheckout();
                }}
                className="w-full py-3.5 px-4 bg-[#185824] hover:bg-[#12431C] active:scale-[0.99] text-white text-sm font-black rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <span>অর্ডার কনফার্ম করতে এগিয়ে যান</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-[10px] text-center text-gray-500">
                🔒 ক্যাশ অন ডেলিভারি — পণ্য হাতে পেয়ে টাকা দিন
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
