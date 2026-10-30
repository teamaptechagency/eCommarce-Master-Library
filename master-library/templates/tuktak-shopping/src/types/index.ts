export interface Category {
  id: string;
  name: string;
  name_bn: string;
  slug: string;
  image_url: string;
  sub_label: string;
  sort_order: number;
  is_active: boolean;
}

export interface ProductVariant {
  id: string;
  name: string; // e.g. "Size", "Color"
  value: string; // e.g. "18 Inch", "Pink Bunny"
  price_override?: number;
  stock: number;
}

export interface Product {
  id: string;
  category_id: string;
  category_slug?: string;
  name: string;
  name_bn: string;
  slug: string;
  description: string;
  short_description?: string;
  price: number;
  old_price: number;
  discount_percent: number;
  badge?: '50% ছাড়' | 'BEST' | 'NEW' | 'HOT' | 'GIFT' | 'TOY' | string;
  secondary_badge?: string;
  sold_count: number;
  rating: number;
  review_count: number;
  stock: number;
  is_featured: boolean;
  is_flash_sale: boolean;
  is_hot_deal: boolean;
  is_active: boolean;
  image_url: string;
  images: string[];
  variants?: ProductVariant[];
  created_at?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedVariant?: string;
}

export interface DeliveryZone {
  id: string;
  name: string;
  name_bn: string;
  charge: number;
  estimated_days: string;
  is_active: boolean;
  sort_order: number;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  min_order: number;
  is_active: boolean;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export interface OrderItem {
  id?: string;
  product_id: string;
  product_name: string;
  variant?: string;
  quantity: number;
  unit_price: number;
  total: number;
  image_url?: string;
}

export interface Order {
  id: string;
  order_number: string;
  user_id?: string | null;
  customer_name: string;
  phone: string;
  address: string;
  delivery_zone: string;
  delivery_charge: number;
  subtotal: number;
  discount: number;
  total: number;
  coupon_code?: string;
  payment_method: 'COD';
  status: OrderStatus;
  note?: string;
  courier_tracking_id?: string;
  created_at: string;
  items: OrderItem[];
}

export interface Review {
  id: string;
  product_id: string;
  customer_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface SiteSettings {
  whatsapp_number: string;
  call_number: string;
  free_delivery_threshold: number;
  extra_discount_threshold: number;
  extra_discount_percent: number;
  site_name: string;
  tagline_en: string;
  tagline_bn: string;
  flash_sale_end_time: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: 'user' | 'admin';
  avatar_url?: string;
}
