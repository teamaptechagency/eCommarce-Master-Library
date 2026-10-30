/**
 * নিরাপদ স্ক্রল হেল্পার।
 * React স্টেট আপডেটের পর DOM রেন্ডার হওয়া পর্যন্ত অপেক্ষা করে।
 */
const CANDIDATE_IDS = [
  'products-section',
  'products',
  'product-section',
  'all-products',
  'product-grid',
];

const findProductsSection = (customId?: string): HTMLElement | null => {
  const ids = customId ? [customId, ...CANDIDATE_IDS] : CANDIDATE_IDS;
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
};

const getHeaderHeight = (): number => {
  const header = document.querySelector('header');
  return header ? header.getBoundingClientRect().height : 0;
};

const computeTop = (el: HTMLElement): number => {
  const top = el.getBoundingClientRect().top + window.scrollY - getHeaderHeight() - 8;
  return Math.max(top, 0);
};

export const scrollToProducts = (customId?: string): void => {
  if (typeof window === 'undefined') return;

  let tries = 0;
  const maxTries = 24; // প্রায় ১.২ সেকেন্ড চেষ্টা করবে

  const run = () => {
    const el = findProductsSection(customId);
    if (!el) {
      tries += 1;
      if (tries < maxTries) {
        setTimeout(run, 50);
      } else {
        console.warn(
          'scrollToProducts: পণ্য সেকশন পাওয়া যায়নি। সেকশন wrapper এ id="products-section" আছে কিনা নিশ্চিত করুন।'
        );
      }
      return;
    }

    // উপাদান পাওয়া গেছে — স্মুথ স্ক্রল করো
    requestAnimationFrame(() => {
      window.scrollTo({ top: computeTop(el), behavior: 'smooth' });

      // বিলম্বিত রেন্ডার বা লেআউট শিফটের জন্য আরেকবার সুনির্দিষ্ট সমন্বয়
      setTimeout(() => {
        const again = findProductsSection(customId);
        if (!again) return;
        const target = computeTop(again);
        if (Math.abs(window.scrollY - target) > 40) {
          window.scrollTo({ top: target, behavior: 'smooth' });
        }
      }, 600);
    });
  };

  // স্টেট আপডেট যেন পেইন্ট হতে পারে তাই ছোট একটা বিলম্ব দিয়ে শুরু
  setTimeout(run, 80);
};
