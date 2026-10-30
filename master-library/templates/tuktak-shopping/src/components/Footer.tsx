import React from 'react';
import { MessageCircle, Phone, Mail, MapPin, Heart, ShieldCheck, Truck, RefreshCw } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export const Footer: React.FC = () => {
  const { settings, openTrackOrder, setSelectedCategory, closeProductDetail } = useStore();

  const waUrl = `https://wa.me/88${settings.whatsapp_number}?text=Hello%20Tuktak Shopping%20BD%2C%20I%20have%20an%20inquiry`;

  return (
    <footer className="bg-white border-t border-emerald-100 text-gray-700 mt-12 relative">
      {/* Upper Features Strip */}
      <div className="bg-[#F8FAF6] border-b border-emerald-100 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-[#185824] flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h5 className="text-xs sm:text-sm font-black text-gray-900">হোম ডেলিভারি</h5>
              <p className="text-[11px] text-gray-500 font-sans">সারা বাংলাদেশে ১-৩ দিনে</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-[#185824] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h5 className="text-xs sm:text-sm font-black text-gray-900">ক্যাশ অন ডেলিভারি</h5>
              <p className="text-[11px] text-gray-500 font-sans">হাতে পেয়ে টাকা পরিশোধ করুন</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-[#185824] flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h5 className="text-xs sm:text-sm font-black text-gray-900">ইজি রিটার্ন</h5>
              <p className="text-[11px] text-gray-500 font-sans">ডেলিভারির সময় চেক করুন</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-[#185824] flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h5 className="text-xs sm:text-sm font-black text-gray-900">সার্বক্ষণিক সাপোর্ট</h5>
              <p className="text-[11px] text-gray-500 font-mono">০১৭১৭৮২৩৫২৫</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Brand Information */}
        <div className="md:col-span-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#185824] flex items-center justify-center shadow-xs">
              <span className="text-2xl">🧸</span>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-xl font-black text-gray-900">Tuktak Shopping</span>
                <span className="text-xl font-black text-[#185824]">BD</span>
              </div>
              <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">
                {settings.tagline_en}
              </span>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-gray-500 leading-relaxed font-sans max-w-sm">
            {settings.tagline_bn} — খাঁটি মসলা, নাটস, ড্রাই ফ্রুটস এবং অর্গানিক খাদ্যপণ্যের বিশ্বস্ত অনলাইন শপ।
          </p>

          <div className="space-y-1.5 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#185824]" />
              <span className="font-mono font-bold">+88 {settings.call_number}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#185824]" />
              <span>contact@littlehugbd.com</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#185824]" />
              <span>House 42, Road 11, Banani, Dhaka, Bangladesh</span>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="md:col-span-2 space-y-3">
          <h4 className="text-xs font-black uppercase text-gray-900 tracking-wider">
            কালেকশন
          </h4>
          <ul className="space-y-2 text-xs font-semibold text-gray-600">
            <li>
              <button
                onClick={() => {
                  setSelectedCategory('baby-gift-box');
                  closeProductDetail();
                }}
                className="hover:text-[#185824] transition-colors cursor-pointer"
              >
                Baby Gift Box
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  setSelectedCategory('travel-luggage');
                  closeProductDetail();
                }}
                className="hover:text-[#185824] transition-colors cursor-pointer"
              >
                Kids Travel Luggage
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  setSelectedCategory('rescue-toy');
                  closeProductDetail();
                }}
                className="hover:text-[#185824] transition-colors cursor-pointer"
              >
                Rescue Toys Collection
              </button>
            </li>
            <li>
              <button
                onClick={() => {
                  setSelectedCategory('combo-offer');
                  closeProductDetail();
                }}
                className="hover:text-[#185824] transition-colors cursor-pointer"
              >
                Combo Gift Hampers
              </button>
            </li>
          </ul>
        </div>

        {/* Customer Care */}
        <div className="md:col-span-2 space-y-3">
          <h4 className="text-xs font-black uppercase text-gray-900 tracking-wider">
            কাস্টমার সার্ভিস
          </h4>
          <ul className="space-y-2 text-xs font-semibold text-gray-600">
            <li>
              <button
                onClick={() => openTrackOrder()}
                className="hover:text-[#185824] transition-colors cursor-pointer"
              >
                Track Your Order
              </button>
            </li>
            <li>
              <a href={waUrl} target="_blank" rel="noopener noreferrer" className="hover:text-[#185824]">
                WhatsApp Support
              </a>
            </li>
            <li>
              <span className="text-gray-400">Cash On Delivery Policy</span>
            </li>
            <li>
              <span className="text-gray-400">Pathao Courier Service</span>
            </li>
          </ul>
        </div>

        {/* Delivery & Payment Badges */}
        <div className="md:col-span-3 space-y-3">
          <h4 className="text-xs font-black uppercase text-gray-900 tracking-wider">
            পেমেন্ট ও কুরিয়ার পার্টনার
          </h4>
          <div className="p-3 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-2">
            <span className="text-xs font-bold text-gray-800 block">
              ক্যাশ অন ডেলিভারি (COD)
            </span>
            <p className="text-[11px] text-gray-500 font-sans">
              পণ্য রিসিভ করার সময় নগদ টাকা দিয়ে গ্রহণ করুন। এছাড়াও রয়েছে বিকাশ, নগদ ও রকেট পেমেন্ট সুবিধা।
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="px-2 py-0.5 bg-white text-gray-800 text-[10px] font-bold rounded-md border border-emerald-100">
                Pathao Express
              </span>
              <span className="px-2 py-0.5 bg-white text-gray-800 text-[10px] font-bold rounded-md border border-emerald-100">
                Steadfast
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Copyright */}
      <div className="border-t border-emerald-100 py-5 bg-[#F8FAF6]/50 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} Tuktak Shopping. All rights reserved.</p>
          <p className="flex items-center gap-1 text-[11px]">
            <span>Crafted with</span>
            <Heart className="w-3.5 h-3.5 text-[#185824] fill-[#185824]" />
            <span>for little smiles in Bangladesh</span>
          </p>
        </div>
      </div>

      {/* Floating Pink/WhatsApp Chat Button at Bottom Right */}
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-40 w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-[#185824] to-[#278838] text-white flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all cursor-pointer group"
        aria-label="Chat on WhatsApp"
        title="Chat with Tuktak Shopping"
      >
        <MessageCircle className="w-7 h-7 fill-white" />
        <span className="absolute right-full mr-3 bg-[#1F1F24] text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          হোয়াটসঅ্যাপে অর্ডার করুন
        </span>
      </a>
    </footer>
  );
};
