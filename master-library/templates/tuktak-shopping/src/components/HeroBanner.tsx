import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { scrollToProducts } from '../lib/scroll';
import { fetchBanners, BANNERS_EVENT, type Banner } from '../lib/banners';

const AUTOPLAY_MS = 5000;

export const HeroBanner: React.FC = () => {
  const { setSelectedCategory, closeProductDetail } = useStore() as any;

  const [banners, setBanners] = useState<Banner[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // Admin dashboard er chalu (active) banner gulo load kora
  const load = useCallback(async () => {
    try {
      const list = await fetchBanners(true);
      setBanners(list || []);
      setIndex(0);
    } catch (err) {
      console.warn('Banners load failed:', err);
    }
  }, []);

  useEffect(() => {
    load();
    // Dashboard e banner add/edit/delete korle auto refresh
    window.addEventListener(BANNERS_EVENT, load);
    return () => window.removeEventListener(BANNERS_EVENT, load);
  }, [load]);

  // Auto slide
  useEffect(() => {
    if (banners.length < 2 || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % banners.length), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [banners.length, paused]);

  if (banners.length === 0) return null;

  const go = (n: number) => setIndex((n + banners.length) % banners.length);

  const handleClick = (b: Banner) => {
    const link = (b.link || '').trim();
    if (!link) return;

    if (/^https?:\/\//i.test(link)) {
      window.open(link, '_blank', 'noopener,noreferrer');
    } else if (link.startsWith('#')) {
      if (link === '#products-section') {
        scrollToProducts();
      } else {
        document.getElementById(link.slice(1))?.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (link.startsWith('/')) {
      window.location.href = link;
    } else {
      // category slug hishebe
      setSelectedCategory?.(link);
      closeProductDetail?.();
      scrollToProducts();
    }
  };

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
    <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 pb-3">
      <div
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-emerald-50 shadow-lg border border-emerald-100"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {banners.map((b) => (
            <div key={b.id} className="w-full shrink-0">
              <img
                src={b.image_url}
                alt={b.title || 'Banner'}
                draggable={false}
                onClick={() => handleClick(b)}
                referrerPolicy="no-referrer"
                className={`w-full aspect-[16/8] sm:aspect-[16/6] lg:aspect-[16/5] object-cover select-none ${
                  b.link ? 'cursor-pointer' : ''
                }`}
              />
            </div>
          ))}
        </div>

        {banners.length > 1 && (
          <>
            <button
              onClick={() => go(index - 1)}
              aria-label="Previous Slide"
              className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-white/85 hover:bg-white text-gray-800 shadow-md cursor-pointer transition-colors border border-emerald-100"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
            <button
              onClick={() => go(index + 1)}
              aria-label="Next Slide"
              className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-white/85 hover:bg-white text-gray-800 shadow-md cursor-pointer transition-colors border border-emerald-100"
            >
              <ChevronRight className="w-5 h-5 stroke-[2.5]" />
            </button>

            <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  onClick={() => go(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`h-1.5 sm:h-2 rounded-full transition-all cursor-pointer ${
                    i === index ? 'w-5 sm:w-6 bg-[#185824]' : 'w-1.5 sm:w-2 bg-white/80 hover:bg-white'
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