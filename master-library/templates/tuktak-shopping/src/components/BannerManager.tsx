import React, { useCallback, useEffect, useId, useState } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Upload,
  Loader2,
  Image as ImageIcon,
  X,
  Check,
  Link as LinkIcon,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import {
  fetchBanners,
  addBanner,
  updateBanner,
  deleteBanner,
  reorderBanners,
  uploadBannerImage,
  type Banner,
} from '../lib/banners';

const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error && err.message) return err.message;
  return 'অজানা সমস্যা';
};

interface FormState {
  title: string;
  link: string;
  image_url: string;
  is_active: boolean;
}

const emptyForm: FormState = { title: '', link: '', image_url: '', is_active: true };

export const BannerManager: React.FC = () => {
  const { showToast, isAdmin } = useStore();
  const fileInputId = useId();

  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // null = বন্ধ, 'new' = নতুন, Banner = এডিট
  const [editing, setEditing] = useState<Banner | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [bannerToDelete, setBannerToDelete] = useState<Banner | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      setBanners(await fetchBanners(false));
    } catch (err) {
      console.error('Banner load failed:', err);
      setLoadError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setForm(emptyForm);
    setEditing('new');
  };

  const openEdit = (b: Banner) => {
    setForm({
      title: b.title || '',
      link: b.link || '',
      image_url: b.image_url,
      is_active: b.is_active,
    });
    setEditing(b);
  };

  const closeModal = () => {
    if (uploading || saving) return;
    setEditing(null);
  };

  const handleFile = async (file: File) => {
    try {
      setUploading(true);
      showToast('ব্যানারের ছবি আপলোড হচ্ছে...');
      const url = await uploadBannerImage(file);
      setForm((f) => ({ ...f, image_url: url }));
      showToast('✓ ছবি আপলোড হয়েছে!');
    } catch (err) {
      console.error('Banner image upload failed:', err);
      showToast(`ছবি আপলোড ব্যর্থ: ${getErrorMessage(err)}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('অ্যাক্সেস অস্বীকৃত: শুধুমাত্র অনুমোদিত অ্যাডমিন ব্যানার সংরক্ষণ করতে পারেন।');
      return;
    }
    if (uploading) {
      showToast('ছবি আপলোড শেষ হওয়া পর্যন্ত অপেক্ষা করুন');
      return;
    }
    if (!form.image_url) {
      showToast('আগে ব্যানারের ছবি আপলোড করুন');
      return;
    }
    try {
      setSaving(true);
      if (editing === 'new') {
        await addBanner(form);
        showToast('✓ নতুন ব্যানার যোগ হয়েছে');
      } else if (editing) {
        await updateBanner(editing.id, {
          title: form.title.trim() || null,
          link: form.link.trim() || null,
          image_url: form.image_url,
          is_active: form.is_active,
        });
        showToast('✓ ব্যানার আপডেট হয়েছে');
      }
      setEditing(null);
      await load();
    } catch (err) {
      console.error('Banner save failed:', err);
      showToast(`ব্যানার সেভ ব্যর্থ: ${getErrorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (b: Banner) => {
    if (!isAdmin) {
      showToast('অ্যাক্সেস অস্বীকৃত: ব্যানার স্ট্যাটাস পরিবর্তন করতে অ্যাডমিন অনুমতি প্রয়োজন।');
      return;
    }
    try {
      await updateBanner(b.id, { is_active: !b.is_active });
      showToast(b.is_active ? 'ব্যানার লুকানো হয়েছে' : '✓ ব্যানার চালু হয়েছে');
      await load();
    } catch (err) {
      showToast(`ব্যর্থ: ${getErrorMessage(err)}`);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    if (!isAdmin) {
      showToast('অ্যাক্সেস অস্বীকৃত: ব্যানারের ক্রম পরিবর্তন করতে অ্যাডমিন অনুমতি প্রয়োজন।');
      return;
    }
    const target = index + dir;
    if (target < 0 || target >= banners.length) return;
    const next = [...banners];
    [next[index], next[target]] = [next[target], next[index]];
    setBanners(next); // সাথে সাথে স্ক্রিনে দেখাও
    try {
      await reorderBanners(next);
    } catch (err) {
      showToast(`ক্রম পরিবর্তন ব্যর্থ: ${getErrorMessage(err)}`);
      await load();
    }
  };

  const confirmDelete = async () => {
    if (!bannerToDelete) return;
    if (!isAdmin) {
      showToast('অ্যাক্সেস অস্বীকৃত: ব্যানার মুছতে অ্যাডমিন অনুমতি প্রয়োজন।');
      return;
    }
    try {
      setDeleting(true);
      await deleteBanner(bannerToDelete.id);
      showToast('✓ ব্যানার মুছে ফেলা হয়েছে');
      setBannerToDelete(null);
      await load();
    } catch (err) {
      showToast(`মুছতে ব্যর্থ: ${getErrorMessage(err)}`);
    } finally {
      setDeleting(false);
    }
  };

  const activeCount = banners.filter((b) => b.is_active).length;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-pink-100">
        <div>
          <h3 className="text-sm sm:text-base font-black text-gray-900 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#F8628D]" />
            <span>হোমপেজ ব্যানার</span>
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            মোট {banners.length} টি · চালু {activeCount} টি · ছবির ক্রম এখান থেকেই বদলানো যাবে
          </p>
        </div>
        <button
          onClick={openNew}
          className="px-4 py-2.5 sm:py-2 bg-[#F8628D] hover:bg-[#E74B78] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>নতুন ব্যানার যোগ করুন</span>
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-14 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#F8628D]" />
          <span>ব্যানার লোড হচ্ছে...</span>
        </div>
      ) : loadError ? (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 space-y-2">
          <p className="font-bold">ব্যানার লোড করা যায়নি:</p>
          <p className="font-mono break-words">{loadError}</p>
          <button
            onClick={load}
            className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-bold cursor-pointer"
          >
            আবার চেষ্টা করুন
          </button>
        </div>
      ) : banners.length === 0 ? (
        <div className="py-14 text-center text-gray-400 text-xs bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 px-3">
          <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="font-bold text-gray-600 text-sm">এখনো কোনো ব্যানার নেই</p>
          <p className="mt-0.5">"নতুন ব্যানার যোগ করুন" চেপে প্রথম ব্যানার আপলোড করুন</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {banners.map((b, i) => (
            <div
              key={b.id}
              className="rounded-2xl border border-pink-100 bg-white overflow-hidden shadow-2xs min-w-0"
            >
              <div className="relative bg-pink-50 aspect-[16/6]">
                <img
                  src={b.image_url}
                  alt={b.title || 'Banner'}
                  className={`w-full h-full object-cover ${b.is_active ? '' : 'opacity-40 grayscale'}`}
                  referrerPolicy="no-referrer"
                />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold font-mono">
                  #{i + 1}
                </span>
                {!b.is_active && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                    লুকানো
                  </span>
                )}
              </div>

              <div className="p-3 space-y-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate">{b.title || '(শিরোনাম নেই)'}</p>
                  <p className="text-[11px] text-gray-400 truncate flex items-center gap-1">
                    <LinkIcon className="w-3 h-3 shrink-0" />
                    <span className="truncate">{b.link || 'কোনো লিঙ্ক নেই'}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 cursor-pointer"
                    title="উপরে সরান"
                    aria-label="উপরে সরান"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === banners.length - 1}
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 cursor-pointer"
                    title="নিচে সরান"
                    aria-label="নিচে সরান"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => toggleActive(b)}
                    className={`px-2.5 py-2 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                      b.is_active
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    {b.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{b.is_active ? 'চালু' : 'বন্ধ'}</span>
                  </button>
                  <button
                    onClick={() => openEdit(b)}
                    className="ml-auto px-2.5 py-2 rounded-lg bg-pink-50 hover:bg-pink-100 text-[#F8628D] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>এডিট</span>
                  </button>
                  <button
                    onClick={() => setBannerToDelete(b)}
                    className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 cursor-pointer"
                    title="মুছুন"
                    aria-label="ব্যানার মুছুন"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center sm:p-4">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 w-full sm:max-w-lg space-y-4 max-h-[92vh] sm:max-h-[88vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <div>
                <h4 className="text-sm font-black text-gray-900">
                  {editing === 'new' ? 'নতুন ব্যানার যোগ করুন' : 'ব্যানার এডিট করুন'}
                </h4>
                <p className="text-[11px] text-gray-400">ছবি আপলোড করে সেভ করলেই হোমপেজে দেখাবে</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 text-gray-400 hover:text-gray-700"
                aria-label="বন্ধ করুন"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Image upload */}
              <div className="space-y-1.5">
                <span className="font-bold text-gray-700 block">ব্যানারের ছবি *</span>
                <div className="rounded-2xl border border-pink-200 bg-pink-50/30 p-2.5 space-y-2.5">
                  <div className="relative w-full aspect-[16/6] rounded-xl border border-pink-200 bg-white overflow-hidden flex items-center justify-center">
                    {uploading ? (
                      <Loader2 className="w-7 h-7 text-[#F8628D] animate-spin" />
                    ) : form.image_url ? (
                      <img
                        src={form.image_url}
                        alt="preview"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-pink-300" />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      htmlFor={fileInputId}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                        uploading
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-[#F8628D] hover:bg-[#E74B78] text-white cursor-pointer'
                      }`}
                    >
                      {uploading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {uploading
                          ? 'আপলোড হচ্ছে...'
                          : form.image_url
                          ? 'ছবি পরিবর্তন'
                          : 'কম্পিউটার থেকে ছবি বাছুন'}
                      </span>
                    </label>
                    <input
                      id={fileInputId}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={uploading}
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) handleFile(file);
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 leading-snug">
                    সেরা মাপ: ১৬০০×৬০০ px (চওড়া ছবি) · JPG/PNG/WEBP · সর্বোচ্চ ৫MB।
                  </p>
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">শিরোনাম (ঐচ্ছিক)</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. ঈদ স্পেশাল অফার"
                  className="w-full px-3 py-2.5 border rounded-xl text-base sm:text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">ক্লিক করলে কোথায় যাবে (ঐচ্ছিক লিঙ্ক)</label>
                <input
                  type="text"
                  value={form.link}
                  onChange={(e) => setForm({ ...form, link: e.target.value })}
                  placeholder="https://... অথবা #products-section"
                  className="w-full px-3 py-2.5 border rounded-xl text-base sm:text-xs"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4 accent-[#F8628D]"
                />
                <span>হোমপেজে দেখান (চালু)</span>
              </label>
            </div>

            <div className="sticky bottom-0 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 px-4 sm:px-6 py-3 bg-white border-t border-gray-100 flex gap-2">
              <button
                type="submit"
                disabled={uploading || saving}
                className="flex-1 py-2.5 bg-[#F8628D] hover:bg-[#E74B78] disabled:opacity-60 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>{saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}</span>
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                বাতিল
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirmation popup */}
      {bannerToDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-red-100 text-center space-y-4">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600 mb-2">
              <Trash2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black text-gray-900">ব্যানার মুছে ফেলতে চান?</h3>
            <div className="rounded-xl overflow-hidden border border-gray-100 aspect-[16/6] bg-pink-50">
              <img
                src={bannerToDelete.image_url}
                alt="banner"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <p className="text-xs text-gray-600">
              এই ব্যানারটি স্থায়ীভাবে মুছে ফেলা হবে। এই কাজটি আর ফিরিয়ে আনা যাবে না।
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setBannerToDelete(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-60 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                বাতিল (Cancel)
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md flex items-center justify-center gap-1.5"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>মুছছে...</span>
                  </>
                ) : (
                  <span>হ্যাঁ, মুছে ফেলুন</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
