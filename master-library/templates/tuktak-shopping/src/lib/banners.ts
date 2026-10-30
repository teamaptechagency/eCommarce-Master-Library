import { supabase, isSupabaseConfigured, uploadImageToSupabase } from './supabase';

export interface Banner {
  id: string;
  title: string | null;
  image_url: string;
  link: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface BannerInput {
  title: string;
  link: string;
  image_url: string;
  is_active: boolean;
}

export const BANNERS_EVENT = 'littlehug:banners-updated';
const LS_KEY = 'littlehug_banners';
const MAX_IMAGE_MB = 5;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const notifyChange = () => {
  try {
    window.dispatchEvent(new Event(BANNERS_EVENT));
  } catch {
    // ignore
  }
};

const newId = (): string => {
  try {
    return crypto.randomUUID();
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
};

/* ---------- লোকাল স্টোরেজ ফলব্যাক (Supabase না থাকলে) ---------- */
const readLocal = (): Banner[] => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const writeLocal = (list: Banner[]) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {
    throw new Error('ব্রাউজার স্টোরেজে ব্যানার সংরক্ষণ করা যায়নি');
  }
};

const sortBanners = (list: Banner[]) =>
  [...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

/* ---------- ছবি আপলোড (ব্যানার) ---------- */
export const uploadBannerImage = async (file: File): Promise<string> => {
  const okType = ALLOWED_IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
  if (!okType) throw new Error('শুধু JPG, PNG বা WEBP ছবি আপলোড করা যাবে');
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    throw new Error(`ছবির সাইজ ${MAX_IMAGE_MB}MB এর বেশি হতে পারবে না`);
  }
  return uploadImageToSupabase(file);
};

/* ---------- CRUD ---------- */
export const fetchBanners = async (onlyActive = false): Promise<Banner[]> => {
  if (isSupabaseConfigured && supabase) {
    let query = supabase.from('banners').select('*');
    if (onlyActive) query = query.eq('is_active', true);
    const { data, error } = await query.order('sort_order', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []) as Banner[];
  }
  const list = sortBanners(readLocal());
  return onlyActive ? list.filter((b) => b.is_active) : list;
};

export const addBanner = async (input: BannerInput): Promise<Banner> => {
  const existing = await fetchBanners(false);
  const nextOrder = existing.reduce((max, b) => Math.max(max, b.sort_order ?? 0), 0) + 1;
  const banner: Banner = {
    id: newId(),
    title: input.title.trim() || null,
    image_url: input.image_url,
    link: input.link.trim() || null,
    sort_order: nextOrder,
    is_active: input.is_active,
  };

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('banners').insert(banner).select().single();
    if (error) throw new Error(error.message);
    notifyChange();
    return data as Banner;
  }

  writeLocal([...readLocal(), banner]);
  notifyChange();
  return banner;
};

export const updateBanner = async (id: string, patch: Partial<Omit<Banner, 'id'>>): Promise<void> => {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('banners').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
    notifyChange();
    return;
  }
  writeLocal(readLocal().map((b) => (b.id === id ? { ...b, ...patch } : b)));
  notifyChange();
};

export const deleteBanner = async (id: string): Promise<void> => {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('banners').delete().eq('id', id);
    if (error) throw new Error(error.message);
    notifyChange();
    return;
  }
  writeLocal(readLocal().filter((b) => b.id !== id));
  notifyChange();
};

// ক্রম পরিবর্তন — sort_order 1,2,3... হিসেবে সেট করে
export const reorderBanners = async (ordered: Banner[]): Promise<void> => {
  if (isSupabaseConfigured && supabase) {
    const results = await Promise.all(
      ordered.map((b, i) => supabase!.from('banners').update({ sort_order: i + 1 }).eq('id', b.id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
    notifyChange();
    return;
  }
  const orderMap = new Map(ordered.map((b, i) => [b.id, i + 1]));
  writeLocal(readLocal().map((b) => ({ ...b, sort_order: orderMap.get(b.id) ?? b.sort_order })));
  notifyChange();
};
