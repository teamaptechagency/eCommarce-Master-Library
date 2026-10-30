import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchBanners, BANNERS_EVENT, type Banner } from '../lib/banners';

/**
 * হোমপেজ ব্যানার স্লাইডার।
 * অ্যাডমিন ড্যাশবোর্ড থেকে চালু করা ব্যানারগুলো দেখায়।
 * কোনো চালু ব্যানার না থাকলে কিছুই দেখায় না (আগের হিরো সেকশন যেমন আছে তেমনই থাকবে)।
 */
export const BannerSlider: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await fetchBanners(true);
      setBanners(list);
      setIndex(0);
    } catch (err) {
      console.warn('Banners load failed:', err);
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(BANNERS_EVENT, load);
    return () => window.removeEventListener(BANNERS_EVENT, load);
  }, [load]);

  // অটো স্লাইড (৫ সেকেন্ড পরপর)
  useEffect(() => {
    if (banners.length < 2 || paused) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % banners.length), 5000);
    return () => clearInterval(timer);
  }, [banners.length, paused]);

  if (banners.length === 0) return null;

  const go = (next: number) => setIndex((next + banners.length) % banners.length);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setPaused(true);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current !== null) {
      const diff = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(diff) > 50) go(diff < 0 ? index + 1 : index - 1);
    }
    touchStartX.current = null;
    setPaused(false);
  };

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6">
      <div
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-pink-50 shadow-sm"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Slides */}
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {banners.map((b) => {
            return (
              <div key={b.id} className="w-full shrink-0">
                <img
                  src={b.image_url}
                  alt={b.title || 'Tuktak Shopping Banner'}
                  loading="lazy"
                  draggable={false}
                  className="w-full aspect-[16/8] sm:aspect-[16/6] lg:aspect-[16/5] object-cover select-none"
                  referrerPolicy="no-referrer"
                />
              </div>
            );
          })}
        </div>

        {/* Arrows (ট্যাবলেট/ডেস্কটপে) */}
        {banners.length > 1 && (
          <>
            <button
              onClick={() => go(index - 1)}
              className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-white/85 hover:bg-white text-gray-800 shadow-md cursor-pointer transition-colors"
              aria-label="আগের ব্যানার"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => go(index + 1)}
              className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-white/85 hover:bg-white text-gray-800 shadow-md cursor-pointer transition-colors"
              aria-label="পরের ব্যানার"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Dots */}
            <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  onClick={() => go(i)}
                  aria-label={`ব্যানার ${i + 1}`}
                  className={`h-1.5 sm:h-2 rounded-full transition-all cursor-pointer ${
                    i === index ? 'w-5 sm:w-6 bg-[#F8628D]' : 'w-1.5 sm:w-2 bg-white/80 hover:bg-white'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
};
