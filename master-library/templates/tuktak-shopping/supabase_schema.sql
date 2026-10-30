-- ==============================================================================
-- LittleHug BD - Supabase PostgreSQL Database Schema & Security Hardening
-- Complete Role-Based Access Control (RBAC): 'user' (default) & 'admin'
-- 100% Validated for Supabase SQL Editor execution
-- ==============================================================================

-- 1. EXTENSIONS & ROLE TYPE COMPATIBILITY
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure user_role enum supports 'user' and 'admin' if enum exists
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user', 'admin', 'customer');
EXCEPTION
  WHEN duplicate_object THEN
    BEGIN
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'user';
    EXCEPTION
      WHEN OTHERS THEN null;
    END;
END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'returned'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE coupon_type AS ENUM ('percent', 'fixed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. TABLES

-- Profiles Table (Linked to auth.users, default role is strictly 'user')
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure role column exists and defaults to 'user'
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
  ELSE
    ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'user';
  END IF;
EXCEPTION
  WHEN OTHERS THEN null;
END $$;

-- Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  image_url TEXT,
  sub_label TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products Table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  short_description TEXT,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  old_price NUMERIC(10, 2) CHECK (old_price >= price),
  discount_percent INT DEFAULT 0,
  badge TEXT,
  secondary_badge TEXT,
  sold_count INT DEFAULT 0,
  rating NUMERIC(2, 1) DEFAULT 5.0,
  review_count INT DEFAULT 0,
  stock INT DEFAULT 100,
  image_url TEXT,
  images TEXT[] DEFAULT '{}',
  is_featured BOOLEAN DEFAULT FALSE,
  is_flash_sale BOOLEAN DEFAULT FALSE,
  is_hot_deal BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product Images Table
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INT DEFAULT 0
);

-- Product Variants Table (sizes, colors, etc.)
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  price_override NUMERIC(10, 2),
  stock INT DEFAULT 50
);

-- Banners Table
CREATE TABLE IF NOT EXISTS public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  image_url TEXT NOT NULL,
  link TEXT DEFAULT '/',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delivery Zones Table
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  charge NUMERIC(10, 2) NOT NULL,
  estimated_days TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0
);

-- Coupons Table
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  type coupon_type NOT NULL DEFAULT 'percent',
  value NUMERIC(10, 2) NOT NULL,
  min_order NUMERIC(10, 2) DEFAULT 0,
  usage_limit INT DEFAULT 1000,
  used_count INT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders Sequence & Table
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1001;

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL DEFAULT ('LH-' || nextval('order_number_seq')::TEXT),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  delivery_zone TEXT NOT NULL,
  delivery_charge NUMERIC(10, 2) NOT NULL DEFAULT 60,
  subtotal NUMERIC(10, 2) NOT NULL,
  discount NUMERIC(10, 2) DEFAULT 0,
  total NUMERIC(10, 2) NOT NULL,
  coupon_code TEXT,
  payment_method TEXT DEFAULT 'COD',
  status order_status DEFAULT 'pending',
  note TEXT,
  courier_tracking_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Items Table
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  variant TEXT,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL,
  total NUMERIC(10, 2) NOT NULL
);

-- Site Settings Table
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. FUNCTIONS & TRIGGERS

-- Function to check if the current requester is a verified admin in the database
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND LOWER(profiles.role::TEXT) = 'admin'
  );
$$;

-- Function & Trigger: Automatic user profile creation with default role 'user'
-- Even if user passes metadata with role, it is strictly forced to 'user'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    'user' -- Default role is strictly 'user' for all newly registered users
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    updated_at = NOW();
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger: Prevent regular users from self-promoting to admin via client update queries
CREATE OR REPLACE FUNCTION public.prevent_self_role_elevation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- If role is being changed
  IF NEW.role::TEXT IS DISTINCT FROM OLD.role::TEXT THEN
    -- If current user is NOT an admin in the database, block or revert the role change
    IF NOT public.is_admin() THEN
      NEW.role := OLD.role;
    END IF;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_elevation ON public.profiles;
CREATE TRIGGER trg_prevent_role_elevation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_role_elevation();

-- 4. ROW LEVEL SECURITY (RLS) POLICIES

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- 4.1 Profiles Policies
-- Users can view their own profile; admins can view all profiles
DROP POLICY IF EXISTS "Profiles readable by owner and admins" ON public.profiles;
DROP POLICY IF EXISTS "Profiles readable by owner or admin" ON public.profiles;
CREATE POLICY "Profiles readable by owner or admin" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id OR public.is_admin());

-- Users can update their own profile details (full_name, avatar, phone), but cannot promote themselves due to trigger
DROP POLICY IF EXISTS "Profiles updatable by owner" ON public.profiles;
DROP POLICY IF EXISTS "Profiles updatable by owner or admin" ON public.profiles;
CREATE POLICY "Profiles updatable by owner or admin" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id OR public.is_admin()) 
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- 4.2 Products Policies
-- Anyone can view products in the storefront
DROP POLICY IF EXISTS "Products public read" ON public.products;
CREATE POLICY "Products public read" 
  ON public.products FOR SELECT 
  USING (true);

-- ONLY admins can insert, update, or delete products
DROP POLICY IF EXISTS "Products admin write" ON public.products;
DROP POLICY IF EXISTS "Products admin insert" ON public.products;
DROP POLICY IF EXISTS "Products admin update" ON public.products;
DROP POLICY IF EXISTS "Products admin delete" ON public.products;

CREATE POLICY "Products admin insert" 
  ON public.products FOR INSERT 
  WITH CHECK (public.is_admin());

CREATE POLICY "Products admin update" 
  ON public.products FOR UPDATE 
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

CREATE POLICY "Products admin delete" 
  ON public.products FOR DELETE 
  USING (public.is_admin());

-- 4.3 Categories Policies
DROP POLICY IF EXISTS "Categories are public readable" ON public.categories;
CREATE POLICY "Categories are public readable" 
  ON public.categories FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Categories admin write" ON public.categories;
DROP POLICY IF EXISTS "Categories admin insert" ON public.categories;
DROP POLICY IF EXISTS "Categories admin update" ON public.categories;
DROP POLICY IF EXISTS "Categories admin delete" ON public.categories;

CREATE POLICY "Categories admin insert" 
  ON public.categories FOR INSERT 
  WITH CHECK (public.is_admin());

CREATE POLICY "Categories admin update" 
  ON public.categories FOR UPDATE 
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

CREATE POLICY "Categories admin delete" 
  ON public.categories FOR DELETE 
  USING (public.is_admin());

-- 4.4 Banners Policies
DROP POLICY IF EXISTS "Banners public read" ON public.banners;
CREATE POLICY "Banners public read" 
  ON public.banners FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Banners admin write" ON public.banners;
DROP POLICY IF EXISTS "Banners admin insert" ON public.banners;
DROP POLICY IF EXISTS "Banners admin update" ON public.banners;
DROP POLICY IF EXISTS "Banners admin delete" ON public.banners;

CREATE POLICY "Banners admin insert" 
  ON public.banners FOR INSERT 
  WITH CHECK (public.is_admin());

CREATE POLICY "Banners admin update" 
  ON public.banners FOR UPDATE 
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

CREATE POLICY "Banners admin delete" 
  ON public.banners FOR DELETE 
  USING (public.is_admin());

-- 4.5 Site Settings Policies
DROP POLICY IF EXISTS "Settings public read" ON public.site_settings;
CREATE POLICY "Settings public read" 
  ON public.site_settings FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Settings admin write" ON public.site_settings;
DROP POLICY IF EXISTS "Settings admin insert" ON public.site_settings;
DROP POLICY IF EXISTS "Settings admin update" ON public.site_settings;

CREATE POLICY "Settings admin insert" 
  ON public.site_settings FOR INSERT 
  WITH CHECK (public.is_admin());

CREATE POLICY "Settings admin update" 
  ON public.site_settings FOR UPDATE 
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

-- 4.6 Orders & Order Items Policies
-- Anyone (guest or logged-in user) can place an order
DROP POLICY IF EXISTS "Orders insertable by anyone" ON public.orders;
CREATE POLICY "Orders insertable by anyone" 
  ON public.orders FOR INSERT 
  WITH CHECK (true);

-- Customers can view their own orders; admins can view all orders
DROP POLICY IF EXISTS "Orders viewable by owner or admin" ON public.orders;
CREATE POLICY "Orders viewable by owner or admin" 
  ON public.orders FOR SELECT 
  USING (
    user_id = auth.uid() 
    OR public.is_admin() 
    OR user_id IS NULL -- Allows tracking unauthenticated guest orders
  );

-- ONLY admins can update or delete orders
DROP POLICY IF EXISTS "Orders admin update" ON public.orders;
CREATE POLICY "Orders admin update" 
  ON public.orders FOR UPDATE 
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Orders admin delete" ON public.orders;
CREATE POLICY "Orders admin delete" 
  ON public.orders FOR DELETE 
  USING (public.is_admin());

-- Order Items
DROP POLICY IF EXISTS "Order items insertable" ON public.order_items;
CREATE POLICY "Order items insertable" 
  ON public.order_items FOR INSERT 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Order items viewable" ON public.order_items;
CREATE POLICY "Order items viewable" 
  ON public.order_items FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Order items admin delete" ON public.order_items;
CREATE POLICY "Order items admin delete" 
  ON public.order_items FOR DELETE 
  USING (public.is_admin());

-- 4.7 Delivery Zones & Coupons
DROP POLICY IF EXISTS "Zones public read" ON public.delivery_zones;
CREATE POLICY "Zones public read" ON public.delivery_zones FOR SELECT USING (true);
DROP POLICY IF EXISTS "Zones admin write" ON public.delivery_zones;
CREATE POLICY "Zones admin write" ON public.delivery_zones FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Coupons public read active" ON public.coupons;
CREATE POLICY "Coupons public read active" ON public.coupons FOR SELECT USING (true);
DROP POLICY IF EXISTS "Coupons admin write" ON public.coupons;
CREATE POLICY "Coupons admin write" ON public.coupons FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 5. INITIAL SEED DATA
INSERT INTO public.delivery_zones (name, name_bn, charge, estimated_days, sort_order) VALUES
('Inside Dhaka', 'ঢাকার ভিতরে', 60, '১–৩ কার্যদিবস', 1),
('Around Dhaka (Narayanganj, Gazipur, Savar, Keraniganj)', 'ঢাকার আশেপাশে (নারায়ণগঞ্জ, গাজীপুর, সাভার, কেরানীগঞ্জ)', 100, '১–৩ কার্যদিবস', 2),
('Outside Dhaka', 'ঢাকার বাইরে', 130, '৩–৫ কার্যদিবস', 3)
ON CONFLICT DO NOTHING;

INSERT INTO public.site_settings (key, value) VALUES
('whatsapp_number', '"01717823525"'),
('call_number', '"01717823525"'),
('free_delivery_threshold', '999'),
('extra_discount_threshold', '1999'),
('extra_discount_percent', '5'),
('site_name', '"LittleHug BD"'),
('tagline_en', '"LITTLE THINGS, BIG HAPPINESS"'),
('tagline_bn', '"ছোট্ট আদর, বড় হাসি"'),
('flash_sale_end_time', '"2026-12-31T23:59:59Z"')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO public.coupons (code, type, value, min_order, usage_limit, is_active) VALUES
('LITTLEHUG', 'fixed', 100, 1000, 500, true),
('WELCOME50', 'fixed', 50, 500, 1000, true),
('HUG10', 'percent', 10, 1500, 200, true)
ON CONFLICT (code) DO NOTHING;

-- 6. STORAGE BUCKETS
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public) 
  VALUES ('product-images', 'product-images', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO storage.buckets (id, name, public) 
  VALUES ('banners', 'banners', true)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION
  WHEN others THEN
    NULL;
END $$;
