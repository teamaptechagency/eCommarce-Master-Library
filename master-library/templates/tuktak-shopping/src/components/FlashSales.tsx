import React, { useState, useEffect } from 'react';
import { Zap, ArrowRight } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from './ProductCard';

export const FlashSales: React.FC = () => {
  const { products, settings, setSelectedCategory, closeProductDetail } = useStore();

  // Filter flash sale products
  const flashProducts = products.filter((p) => p.is_flash_sale);

  // If there are no flash sale products currently in the catalog, do not show empty block
  if (flashProducts.length === 0) {
    return null;
  }

  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number }>({
    hours: 937,
    minutes: 2,
    seconds: 7,
  });

  useEffect(() => {
    const calculateTime = () => {
      const targetTime = new Date(settings.flash_sale_end_time).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, targetTime - now);

      const totalHours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ hours: totalHours, minutes, seconds });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [settings.flash_sale_end_time]);

  const padNum = (n: number) => String(n).padStart(2, '0');

  return (
    <section id="flash-sales-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
      <div className="bg-white rounded-3xl border border-gray-200 p-4 sm:p-6 shadow-2xs">
        {/* Flash Sales Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100">
          {/* Title & Icon */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#185824] to-[#278838] flex items-center justify-center text-white shadow-xs shrink-0">
              <Zap className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-[#185824] tracking-tight">
                  Flash Sales
                </h2>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Ends soon – Exclusive organic offers!
              </p>
            </div>
          </div>

          {/* Countdown timer */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-600">Ending in</span>
            <div className="flex items-center gap-1 font-mono font-bold text-xs">
              <div className="bg-[#185824] text-white px-2.5 py-1.5 rounded-lg shadow-xs min-w-[36px] text-center">
                {timeLeft.hours}
              </div>
              <span className="text-[#185824] font-bold">:</span>
              <div className="bg-[#185824] text-white px-2 py-1.5 rounded-lg shadow-xs min-w-[30px] text-center">
                {padNum(timeLeft.minutes)}
              </div>
              <span className="text-[#185824] font-bold">:</span>
              <div className="bg-[#185824] text-white px-2 py-1.5 rounded-lg shadow-xs min-w-[30px] text-center">
                {padNum(timeLeft.seconds)}
              </div>
            </div>
          </div>

          {/* View All Deals button */}
          <button
            onClick={() => {
              setSelectedCategory(null);
              closeProductDetail();
            }}
            className="text-xs sm:text-sm font-bold text-[#185824] hover:text-[#12431C] flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <span>View All Offers</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Product Grid / Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 pt-5">
          {flashProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
};
