import React, { useState } from 'react';
import { X, Check, Gift, Tag, ShieldCheck, Minus, Plus, CheckCircle, Package } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useStore } from '../context/StoreContext';
import { CartItem, Order } from '../types';

export const CheckoutModal: React.FC = () => {
  const {
    isCheckoutOpen,
    closeCheckout,
    checkoutItem,
    cart,
    deliveryZones,
    coupons,
    settings,
    placeOrder,
    openTrackOrder,
    user,
    showToast,
  } = useStore();

  const [singleItem, setSingleItem] = useState<CartItem | null>(checkoutItem);

  React.useEffect(() => {
    setSingleItem(checkoutItem);
  }, [checkoutItem]);

  const [customerName, setCustomerName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState(deliveryZones[0]?.id || 'zone-1');

  const [isCouponOpen, setIsCouponOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  if (!isCheckoutOpen) return null;

  const items: CartItem[] = singleItem ? [singleItem] : cart;

  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const selectedZone = deliveryZones.find((z) => z.id === selectedZoneId) || deliveryZones[0];
  const isFreeDelivery = subtotal >= settings.free_delivery_threshold;
  const deliveryCharge = isFreeDelivery ? 0 : selectedZone.charge;

  let extraDiscount = 0;
  if (subtotal >= settings.extra_discount_threshold) {
    extraDiscount = Math.round((subtotal * settings.extra_discount_percent) / 100);
  }

  const couponDiscount = appliedCoupon ? appliedCoupon.discount : 0;
  const totalDiscount = extraDiscount + couponDiscount;

  const grandTotal = Math.max(0, subtotal + deliveryCharge - totalDiscount);

  const diffToFree = Math.max(0, settings.free_delivery_threshold - subtotal);

  const isNameValid = customerName.trim().length >= 2;
  const cleanPhone = phone.replace(/\D/g, '');
  const isPhoneValid = cleanPhone.length === 11 && cleanPhone.startsWith('01');
  const isAddressValid = address.trim().length >= 6;
  const isFormValid = isNameValid && isPhoneValid && isAddressValid && items.length > 0;

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    const code = couponCode.trim().toUpperCase();
    const found = coupons.find((c) => c.code.toUpperCase() === code && c.is_active);

    if (!found) {
      setCouponError('অবৈধ কুপন কোড (Invalid coupon)');
      return;
    }

    if (subtotal < found.min_order) {
      setCouponError(`এই কুপন ব্যবহারের জন্য ন্যূনতম ৳${found.min_order} এর অর্ডার প্রয়োজন`);
      return;
    }

    let discountAmount = 0;
    if (found.type === 'percent') {
      discountAmount = Math.round((subtotal * found.value) / 100);
    } else {
      discountAmount = found.value;
    }

    setAppliedCoupon({ code: found.code, discount: discountAmount });
    showToast(`✓ কুপন "${found.code}" প্রয়োগ করা হয়েছে!`);
  };

  const handleConfirmOrder = async () => {
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const orderPayload = {
        user_id: user?.id || null,
        customer_name: customerName.trim(),
        phone: cleanPhone,
        address: address.trim(),
        delivery_zone: selectedZone.name_bn,
        delivery_charge: deliveryCharge,
        subtotal,
        discount: totalDiscount,
        total: grandTotal,
        coupon_code: appliedCoupon?.code,
        payment_method: 'COD' as const,
        status: 'pending' as const,
        items: items.map((it) => ({
          product_id: it.product.id,
          product_name: it.product.name,
          variant: it.selectedVariant,
          quantity: it.quantity,
          unit_price: it.product.price,
          total: it.product.price * it.quantity,
          image_url: it.product.image_url,
        })),
      };

      const result = await placeOrder(orderPayload);
      setConfirmedOrder(result);

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore
      }
    } catch (err) {
      console.error(err);
      showToast('অর্ডার সম্পন্ন করতে সমস্যা হয়েছে, আবার চেষ্টা করুন');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-pink-100 overflow-hidden my-4">
        {/* SUCCESS STATE */}
        {confirmedOrder ? (
          <div className="p-6 sm:p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-3xl">
              ✓
            </div>

            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-pink-50 text-[#F8628D] text-xs font-black mb-2">
                অর্ডার সফল হয়েছে!
              </span>
              <h2 className="text-2xl font-black text-gray-900">
                ধন্যবাদ, {confirmedOrder.customer_name}!
              </h2>
              <p className="text-xs text-gray-500 font-sans mt-1">
                আপনার অর্ডারটি নিশ্চিত করা হয়েছে। কোনো অগ্রিম পেমেন্ট লাগবে না।
              </p>
            </div>

            {/* Order Card summary */}
            <div className="bg-[#FFF5F8] rounded-2xl p-4 text-left border border-pink-200 space-y-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-pink-100 font-bold">
                <span className="text-gray-500">অর্ডার নম্বর:</span>
                <span className="font-mono text-sm text-[#F8628D] font-black">
                  {confirmedOrder.order_number}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>মোবাইল:</span>
                <span className="font-mono font-bold text-gray-900">+88 {confirmedOrder.phone}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>ঠিকানা:</span>
                <span className="font-bold text-gray-900 text-right max-w-[240px] truncate">
                  {confirmedOrder.address}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>ডেলিভারি এলাকা:</span>
                <span className="font-bold text-gray-900">{confirmedOrder.delivery_zone}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-pink-100 font-black text-sm text-gray-900">
                <span>সর্বমোট প্রদেয় মূল্য (COD):</span>
                <span className="text-[#F8628D] font-mono text-base">
                  ৳{confirmedOrder.total.toLocaleString('en-US')}
                </span>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>আমাদের প্রতিনিধি শীঘ্রই আপনাকে কল করে ডেলিভারি নিশ্চিত করবেন।</span>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => {
                  closeCheckout();
                  openTrackOrder(confirmedOrder.order_number);
                }}
                className="flex-1 py-3 px-4 bg-[#1F1F24] hover:bg-black text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Package className="w-4 h-4" />
                <span>অর্ডার ট্র্যাক করুন</span>
              </button>
              <button
                onClick={closeCheckout}
                className="py-3 px-5 bg-white border border-pink-200 text-gray-700 hover:bg-pink-50 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                আরো শপিং করুন
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="flex items-start justify-between p-4 sm:p-5 border-b border-pink-100 bg-[#FFF5F8]/50">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-gray-900">
                  অর্ডার করুন
                </h3>
                <p className="text-xs text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>ক্যাশ অন ডেলিভারি — পণ্য হাতে পেয়ে টাকা দিন</span>
                </p>
              </div>
              <button
                onClick={closeCheckout}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-white transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Cart item mini-cards */}
              {items.length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-xs">
                  কোনো পণ্য সিলেক্ট করা হয়নি
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 bg-pink-50/40 rounded-2xl border border-pink-100"
                    >
                      <img
                        src={item.product.image_url}
                        alt={item.product.name}
                        className="w-14 h-14 object-cover rounded-xl border border-pink-100 bg-white"
                        referrerPolicy="no-referrer"
                      />

                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-gray-900 truncate">
                          {item.product.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          {/* Stepper */}
                          <div className="flex items-center border border-pink-200 bg-white rounded-lg px-1.5 py-0.5 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                if (singleItem) {
                                  setSingleItem({
                                    ...singleItem,
                                    quantity: Math.max(1, singleItem.quantity - 1),
                                  });
                                }
                              }}
                              className="text-gray-500 hover:text-[#F8628D] p-0.5"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center font-bold text-gray-800">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (singleItem) {
                                  setSingleItem({
                                    ...singleItem,
                                    quantity: singleItem.quantity + 1,
                                  });
                                }
                              }}
                              className="text-gray-500 hover:text-[#F8628D] p-0.5"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Variant Badge */}
                          {item.selectedVariant && (
                            <span className="text-[11px] text-gray-500 bg-white px-2 py-0.5 rounded-md border border-pink-100">
                              {item.selectedVariant}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-black text-gray-900 font-mono">
                          ৳{(item.product.price * item.quantity).toLocaleString('en-US')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Free Delivery notification box */}
              <div className="p-2.5 rounded-xl border border-dashed border-[#F8628D]/50 bg-pink-50/50 flex items-center justify-between text-xs font-bold text-gray-800">
                <div className="flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-[#F8628D]" />
                  <span>
                    {diffToFree > 0 ? (
                      <>
                        আর <span className="text-[#F8628D] font-mono">৳{diffToFree}</span> কিনলেই{' '}
                        <span className="text-emerald-700">ফ্রি ডেলিভারি</span>
                      </>
                    ) : (
                      <span className="text-emerald-700">অভিনন্দন! আপনি পাচ্ছেন ফ্রি ডেলিভারি 🎉</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Input Fields with Green Validation Ticks */}
              <div className="space-y-3">
                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    আপনার নাম <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Rifat Khan"
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-[#F8628D] focus:border-transparent transition-all pr-10"
                    />
                    {isNameValid && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs">
                        ✓
                      </div>
                    )}
                  </div>
                </div>

                {/* Mobile Number with +88 prefix and BD validation */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    মোবাইল নাম্বার <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-bold text-gray-500 select-none">
                      +88
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="01717823525"
                      maxLength={11}
                      className="w-full pl-12 pr-10 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm font-mono text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-[#F8628D] focus:border-transparent transition-all"
                    />
                    {isPhoneValid && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs">
                        ✓
                      </div>
                    )}
                  </div>
                  {phone.length > 0 && !isPhoneValid && (
                    <p className="text-[10px] text-amber-600 mt-0.5">
                      সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)
                    </p>
                  )}
                </div>

                {/* Full Address */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    সম্পূর্ণ ঠিকানা <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="বাড়ি নং, রোড, থানা, জেলা (e.g. Mirzapur, Tangail)"
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-[#F8628D] focus:border-transparent transition-all pr-10"
                    />
                    {isAddressValid && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs">
                        ✓
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Delivery Zone Radio Cards */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-700">
                  ডেলিভারি এলাকা <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {deliveryZones.map((zone) => {
                    const isSelected = selectedZoneId === zone.id;
                    return (
                      <label
                        key={zone.id}
                        className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-500'
                            : 'border-gray-200 bg-white hover:border-pink-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="delivery_zone"
                            checked={isSelected}
                            onChange={() => setSelectedZoneId(zone.id)}
                            className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                          />
                          <div>
                            <span className="block text-xs font-bold text-gray-900 font-sans">
                              {zone.name_bn}
                            </span>
                            <span className="block text-[10px] text-gray-500">
                              {zone.estimated_days}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-black text-gray-900 font-mono">
                            {isFreeDelivery ? 'FREE' : `৳${zone.charge}`}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Expandable Discount Coupon */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setIsCouponOpen(!isCouponOpen)}
                  className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>ডিসকাউন্ট কোড আছে?</span>
                </button>

                {isCouponOpen && (
                  <form onSubmit={handleApplyCoupon} className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      placeholder="LITTLEHUG or WELCOME50"
                      className="flex-1 px-3 py-2 bg-pink-50/50 border border-pink-200 rounded-xl text-xs font-mono uppercase focus:outline-hidden focus:ring-1 focus:ring-[#F8628D]"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#1F1F24] hover:bg-black text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Apply
                    </button>
                  </form>
                )}

                {couponError && (
                  <p className="text-[11px] text-red-500 mt-1">{couponError}</p>
                )}

                {appliedCoupon && (
                  <div className="flex items-center justify-between text-xs text-emerald-700 bg-emerald-50 p-2 rounded-xl mt-1.5">
                    <span>কুপন কোড &quot;{appliedCoupon.code}&quot; প্রযোজ্য হয়েছে</span>
                    <span className="font-mono font-bold">-৳{appliedCoupon.discount}</span>
                  </div>
                )}
              </div>

              {/* Bill Summary */}
              <div className="space-y-1.5 pt-3 border-t border-gray-200 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>পণ্যের দাম</span>
                  <span className="font-mono font-bold text-gray-800">
                    ৳{subtotal.toLocaleString('en-US')}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>ডেলিভারি চার্জ</span>
                  <span className="font-mono font-bold text-gray-800">
                    {deliveryCharge === 0 ? 'ফ্রি (৳০)' : `৳${deliveryCharge}`}
                  </span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>ডিসকাউন্ট</span>
                    <span className="font-mono">-৳{totalDiscount}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-2 border-t border-gray-200 text-sm font-black text-gray-900">
                  <span>সর্বমোট</span>
                  <span className="font-mono text-base sm:text-lg text-[#F8628D]">
                    ৳{grandTotal.toLocaleString('en-US')}
                  </span>
                </div>
              </div>

              {/* Big Black Confirm Button */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmOrder}
                  disabled={!isFormValid || isSubmitting}
                  className={`w-full py-3.5 px-6 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-md transition-all ${
                    isFormValid && !isSubmitting
                      ? 'bg-[#1F1F24] hover:bg-black text-white cursor-pointer active:scale-[0.99]'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>অর্ডার প্রসেস হচ্ছে...</span>
                    </div>
                  ) : (
                    <span>
                      ✓ অর্ডার কনফার্ম করুন — ৳{grandTotal.toLocaleString('en-US')}
                    </span>
                  )}
                </button>

                {/* Subtext: কোনো অগ্রিম পেমেন্ট লাগবে না */}
                <p className="text-center text-[11px] text-gray-500 flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-gray-400" />
                  <span>কোনো অগ্রিম পেমেন্ট লাগবে না</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
