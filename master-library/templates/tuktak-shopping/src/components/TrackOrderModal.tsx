import React, { useState } from 'react';
import { X, Search, PackageCheck, Copy } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Order, OrderStatus } from '../types';

export const TrackOrderModal: React.FC = () => {
  const { isTrackOrderOpen, closeTrackOrder, trackOrderQuery, orders, showToast } = useStore();

  const [orderQuery, setOrderQuery] = useState(trackOrderQuery || '');
  const [phoneQuery, setPhoneQuery] = useState('');
  const [searchedOrder, setSearchedOrder] = useState<Order | null>(() => {
    if (trackOrderQuery) {
      return (
        orders.find(
          (o) => o.order_number.toLowerCase() === trackOrderQuery.toLowerCase().trim()
        ) || null
      );
    }
    return null;
  });
  const [hasSearched, setHasSearched] = useState(Boolean(trackOrderQuery));

  React.useEffect(() => {
    if (trackOrderQuery) {
      setOrderQuery(trackOrderQuery);
      const match = orders.find(
        (o) => o.order_number.toLowerCase() === trackOrderQuery.toLowerCase().trim()
      );
      setSearchedOrder(match || null);
      setHasSearched(true);
    }
  }, [trackOrderQuery, orders]);

  if (!isTrackOrderOpen) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSearched(true);
    const cleanNum = orderQuery.trim().toUpperCase();
    const cleanPh = phoneQuery.trim().replace(/\D/g, '');

    const found = orders.find((o) => {
      const numMatch = cleanNum ? o.order_number.toUpperCase().includes(cleanNum) : false;
      const phoneMatch = cleanPh ? o.phone.includes(cleanPh) : false;
      return cleanNum && cleanPh ? numMatch && phoneMatch : numMatch || phoneMatch;
    });

    setSearchedOrder(found || null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('কপি করা হয়েছে!');
  };

  const getStepStatus = (currentStatus: OrderStatus, step: OrderStatus) => {
    const sequence: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
    const currentIndex = sequence.indexOf(currentStatus);
    const stepIndex = sequence.indexOf(step);

    if (currentStatus === 'cancelled') return 'cancelled';
    if (currentIndex >= stepIndex) return 'completed';
    return 'upcoming';
  };

  const steps: { key: OrderStatus; label: string; sub: string }[] = [
    { key: 'pending', label: 'অর্ডার গৃহীত', sub: 'Order Placed' },
    { key: 'confirmed', label: 'কনফার্মেশন', sub: 'Verified & Confirmed' },
    { key: 'processing', label: 'প্যাকেজিং', sub: 'Quality Checked' },
    { key: 'shipped', label: 'কুরিয়ারে হস্তান্তর', sub: 'Pathao Courier' },
    { key: 'delivered', label: 'ডেলিভারি সম্পন্ন', sub: 'Delivered' },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-pink-100 overflow-hidden my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-pink-100 bg-[#FFF5F8]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#F8628D] text-white flex items-center justify-center">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-gray-900">
                অর্ডার ট্র্যাকিং (Track Your Order)
              </h3>
              <p className="text-[11px] text-gray-500 font-sans">
                রিয়েলটাইম ডেলিভারি স্ট্যাটাস যাচাই করুন
              </p>
            </div>
          </div>
          <button
            onClick={closeTrackOrder}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Search inputs */}
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">
                  অর্ডার নম্বর (Order Number)
                </label>
                <input
                  type="text"
                  value={orderQuery}
                  onChange={(e) => setOrderQuery(e.target.value)}
                  placeholder="e.g. LH-1001"
                  className="w-full px-3 py-2 bg-pink-50/40 border border-pink-200 rounded-xl text-xs font-mono uppercase focus:outline-hidden focus:ring-2 focus:ring-[#F8628D]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">
                  মোবাইল নম্বর (Phone)
                </label>
                <input
                  type="text"
                  value={phoneQuery}
                  onChange={(e) => setPhoneQuery(e.target.value)}
                  placeholder="01717823525"
                  className="w-full px-3 py-2 bg-pink-50/40 border border-pink-200 rounded-xl text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-[#F8628D]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                <span>টেস্ট করুন:</span>
                {orders.slice(0, 2).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setOrderQuery(o.order_number);
                      setSearchedOrder(o);
                      setHasSearched(true);
                    }}
                    className="px-2 py-0.5 rounded-md bg-pink-100 text-[#F8628D] font-mono font-bold hover:bg-pink-200 cursor-pointer"
                  >
                    {o.order_number}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                className="px-5 py-2 bg-[#1F1F24] hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Search className="w-3.5 h-3.5" />
                <span>ট্র্যাক করুন</span>
              </button>
            </div>
          </form>

          {/* Search Result */}
          {hasSearched && (
            <div>
              {searchedOrder ? (
                <div className="space-y-4 pt-3 border-t border-pink-100">
                  <div className="bg-[#FFF5F8] p-4 rounded-2xl border border-pink-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-black text-gray-900">
                          {searchedOrder.order_number}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F8628D] text-white uppercase">
                          {searchedOrder.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-sans mt-0.5">
                        অর্ডারকারী: <span className="font-bold text-gray-800">{searchedOrder.customer_name}</span> ({searchedOrder.phone})
                      </p>
                    </div>

                    {searchedOrder.courier_tracking_id && (
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-gray-400 block font-medium">পাঠাও কুরিয়ার ট্র্যাকিং:</span>
                        <button
                          onClick={() => copyToClipboard(searchedOrder.courier_tracking_id!)}
                          className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                        >
                          <span>{searchedOrder.courier_tracking_id}</span>
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Step-by-Step Courier Timeline */}
                  <div className="py-2">
                    <h4 className="text-xs font-bold text-gray-700 mb-3">ডেলিভারি অগ্রগতি:</h4>
                    <div className="relative flex flex-col space-y-4 pl-4 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-pink-100">
                      {steps.map((st, idx) => {
                        const status = getStepStatus(searchedOrder.status, st.key);
                        const isDone = status === 'completed';
                        return (
                          <div key={idx} className="relative flex items-start gap-3">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 text-[11px] font-bold ${
                                isDone
                                  ? 'bg-[#F8628D] text-white shadow-xs'
                                  : 'bg-white border-2 border-pink-200 text-gray-300'
                              }`}
                            >
                              {isDone ? '✓' : idx + 1}
                            </div>
                            <div className="flex-1">
                              <span
                                className={`block text-xs font-bold ${
                                  isDone ? 'text-gray-900' : 'text-gray-400'
                                }`}
                              >
                                {st.label}
                              </span>
                              <span className="block text-[10px] text-gray-400 font-sans">
                                {st.sub}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 space-y-2 text-xs">
                    <div className="pt-2 space-y-1">
                      {searchedOrder.items.map((it, i) => (
                        <div key={i} className="flex justify-between items-center text-gray-700">
                          <span>
                            {it.product_name} {it.variant && `(${it.variant})`} × {it.quantity}
                          </span>
                          <span className="font-mono font-bold">৳{it.total}</span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center pt-1 font-bold text-gray-900">
                        <span>সর্বমোট প্রদেয় মূল্য (ক্যাশ অন ডেলিভারি):</span>
                        <span className="font-mono text-[#F8628D] text-sm">
                          ৳{searchedOrder.total.toLocaleString('en-US')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-gray-500 space-y-2">
                  <div className="text-3xl">📦</div>
                  <h4 className="text-xs font-bold text-gray-800">কোনো অর্ডার পাওয়া যায়নি</h4>
                  <p className="text-[11px] text-gray-400">
                    অনুগ্রহ করে সঠিক অর্ডার নম্বর বা মোবাইল নম্বর দিন।
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
