import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Product,
  Category,
  CartItem,
  Order,
  OrderStatus,
  SiteSettings,
  UserProfile,
  DeliveryZone,
  Coupon,
} from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_CATEGORIES,
  INITIAL_DELIVERY_ZONES,
  INITIAL_COUPONS,
  INITIAL_SITE_SETTINGS,
  INITIAL_ORDERS,
} from '../data/mockData';
import { supabase, isSupabaseConfigured, fetchUserRoleFromDatabase } from '../lib/supabase';
import { enrichProductsWithCategories, isProductMatchingCategory } from '../lib/categoryUtils';

interface StoreContextType {
  products: Product[];
  categories: Category[];
  deliveryZones: DeliveryZone[];
  coupons: Coupon[];
  settings: SiteSettings;
  selectedCategory: string | null;
  setSelectedCategory: (slug: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Cart
  cart: CartItem[];
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  addToCart: (product: Product, quantity?: number, variant?: string) => void;
  updateCartQuantity: (productId: string, variant: string | undefined, delta: number) => void;
  removeFromCart: (productId: string, variant?: string) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;

  // Wishlist
  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;

  // Checkout Modal
  isCheckoutOpen: boolean;
  checkoutItem: CartItem | null;
  openCheckout: (product?: Product, quantity?: number, variant?: string) => void;
  closeCheckout: () => void;

  // Product Detail Page / View
  selectedProduct: Product | null;
  openProductDetail: (product: Product) => void;
  closeProductDetail: () => void;

  // Order & Tracking
  orders: Order[];
  isTrackOrderOpen: boolean;
  trackOrderQuery: string;
  openTrackOrder: (orderNumber?: string) => void;
  closeTrackOrder: () => void;
  setTrackOrderQuery: (q: string) => void;
  placeOrder: (orderData: Omit<Order, 'id' | 'order_number' | 'created_at'>) => Promise<Order>;
  updateOrderStatus: (orderId: string, status: OrderStatus, courierId?: string) => void;
  deleteOrder: (orderId: string) => Promise<void>;

  // Auth & Admin
  user: UserProfile | null;
  isAdmin: boolean;
  isRoleVerified: boolean;
  refreshUserRole: () => Promise<void>;
  isAuthOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password?: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  isAdminDashboardOpen: boolean;
  openAdminDashboard: () => void;
  closeAdminDashboard: () => void;

  // Admin Actions
  updateProduct: (product: Product) => void;
  addProduct: (product: Omit<Product, 'id'>) => void;
  deleteProduct: (productId: string) => void;
  addCategory: (category: Omit<Category, 'id'>) => void;
  deleteCategory: (categoryId: string) => Promise<void>;
  updateSettings: (newSettings: Partial<SiteSettings>) => void;

  // Toast / feedback
  toastMessage: string | null;
  showToast: (msg: string) => void;
  clearAllDemoData: () => void;
}

const serverDemoUser = (window as any).__MASTER_LIBRARY_DEMO__?.user as UserProfile | undefined;
const StoreContext = createContext<StoreContextType | undefined>(undefined);

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Products (Automatically purges legacy mock demo items)
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('littlehug_products');
      if (saved) {
        const parsed: Product[] = JSON.parse(saved);
        const cleaned = parsed.filter(
          (p) => !p.id.startsWith('b0000000-') && !p.id.startsWith('p0000000-')
        );
        return cleaned;
      }
    } catch {
      // ignore
    }
    return INITIAL_PRODUCTS;
  });

  // Categories (Automatically purges legacy mock demo categories)
  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const saved = localStorage.getItem('littlehug_categories');
      if (saved) {
        const parsed: Category[] = JSON.parse(saved);
        const cleaned = parsed.filter((c) => !c.id.startsWith('a0000000-'));
        return cleaned;
      }
    } catch {
      // ignore
    }
    return INITIAL_CATEGORIES;
  });

  // Delivery Zones
  const [deliveryZones] = useState<DeliveryZone[]>(INITIAL_DELIVERY_ZONES);

  // Coupons
  const [coupons] = useState<Coupon[]>(INITIAL_COUPONS);

  // Site Settings
  const [settings, setSettings] = useState<SiteSettings>(() => {
    const saved = localStorage.getItem('littlehug_settings');
    return saved ? JSON.parse(saved) : INITIAL_SITE_SETTINGS;
  });

  // Navigation / Search filter
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Cart
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('littlehug_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Wishlist
  const [wishlist, setWishlist] = useState<string[]>(() => {
    const saved = localStorage.getItem('littlehug_wishlist');
    return saved ? JSON.parse(saved) : [];
  });

  // Checkout modal
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutItem, setCheckoutItem] = useState<CartItem | null>(null);

  // Product detail view
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Track order modal
  const [isTrackOrderOpen, setIsTrackOrderOpen] = useState(false);
  const [trackOrderQuery, setTrackOrderQuery] = useState('');

  // Orders (Purges legacy mock demo orders)
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('littlehug_orders');
      if (saved) {
        const parsed: Order[] = JSON.parse(saved);
        const cleaned = parsed.filter(
          (o) => !o.id.startsWith('ord-100') && !o.order_number?.startsWith('LH-100')
        );
        return cleaned;
      }
    } catch {
      // ignore
    }
    return INITIAL_ORDERS;
  });

  // Auth & Admin state
  // Notice: Role is NEVER trusted blindly from localStorage!
  // Any cached user starts with role 'user' until strictly verified against Supabase database.
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (serverDemoUser) return serverDemoUser;
    try {
      const saved = localStorage.getItem('littlehug_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          role: 'user' as const, // Default to user until verified by DB
        };
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [isRoleVerified, setIsRoleVerified] = useState(Boolean(serverDemoUser));
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(Boolean(serverDemoUser && location.pathname.startsWith('/admin')));

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  // Strict Admin Privilege Calculation:
  // Requires: Authenticated user + role 'admin' in database + verified by database check
  const isAdmin = Boolean(user && user.role === 'admin' && isRoleVerified);

  // Sync state to local storage (never cache admin privileges as authority)
  useEffect(() => {
    localStorage.setItem('littlehug_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('littlehug_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('littlehug_categories', JSON.stringify(categories));
    if (categories.length > 0) {
      setProducts((prev) => enrichProductsWithCategories(prev, categories));
    }
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('littlehug_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  useEffect(() => {
    localStorage.setItem('littlehug_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('littlehug_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (user) {
      // Store basic profile for faster UI hydration; role is re-verified from DB
      localStorage.setItem('littlehug_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('littlehug_user');
    }
  }, [user]);

  // Fetch initial data from Supabase if configured so all devices sync
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const client = supabase;

    Promise.all([
      client.from('categories').select('*').order('sort_order', { ascending: true }),
      client.from('products').select('*').order('created_at', { ascending: false }),
    ]).then(([catRes, prodRes]) => {
      let currentCats = categories;
      if (!catRes.error && catRes.data) {
        currentCats = catRes.data;
        setCategories(currentCats);
        localStorage.setItem('littlehug_categories', JSON.stringify(currentCats));
      }
      if (!prodRes.error && prodRes.data) {
        const enriched = enrichProductsWithCategories(prodRes.data, currentCats);
        setProducts(enriched);
        localStorage.setItem('littlehug_products', JSON.stringify(enriched));
      }
    });

    const refreshOrders = () => {
      client
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (!error && data) {
            const formattedOrders = data.map((ord: any) => ({
              ...ord,
              items: ord.order_items || [],
            }));
            setOrders(formattedOrders);
            localStorage.setItem('littlehug_orders', JSON.stringify(formattedOrders));
          }
        });
    };

    refreshOrders();

    // Realtime listener for order changes
    const orderSubscription = client
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        refreshOrders();
      })
      .subscribe();

    return () => {
      client.removeChannel(orderSubscription);
    };
  }, []);

  // Strict Database Role Verification and Session Listener
  const verifySessionUser = useCallback(async (sessionUser: any) => {
    if (!sessionUser) {
      setUser(null);
      setIsRoleVerified(true);
      setIsAdminDashboardOpen(false);
      return;
    }

    const email = sessionUser.email || '';
    const dbRole = await fetchUserRoleFromDatabase(sessionUser.id, email);
    const fullName = sessionUser.user_metadata?.full_name || email.split('@')[0] || 'User';

    setUser({
      id: sessionUser.id,
      email,
      full_name: fullName,
      avatar_url: sessionUser.user_metadata?.avatar_url,
      role: dbRole,
    });
    setIsRoleVerified(true);

    // If role in database is NOT admin, immediately revoke admin dashboard view
    if (dbRole !== 'admin') {
      setIsAdminDashboardOpen(false);
      if (window.location.hash === '#admin') {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);

  // Supabase Auth listener
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsRoleVerified(true);
      return;
    }

    const client = supabase;

    // 1. Initial session load
    client.auth.getSession().then(({ data: { session } }) => {
      verifySessionUser(session?.user);
    });

    // 2. Auth state change listener
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      verifySessionUser(session?.user);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [verifySessionUser]);

  // Realtime subscription to profiles table for the currently logged-in user:
  // When an admin changes the user's role in the Supabase database, this listener
  // detects it immediately and updates access rights in real time!
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !user?.id) return;
    const client = supabase;

    const profileChannel = client
      .channel(`profile-role-sync-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const rawRole = payload.new?.role;
          const normalizedRole: 'admin' | 'user' =
            String(rawRole).toLowerCase().trim() === 'admin' ? 'admin' : 'user';

          setUser((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              role: normalizedRole,
              full_name: payload.new?.full_name || prev.full_name,
            };
          });
          setIsRoleVerified(true);

          if (normalizedRole === 'admin') {
            showToast('✓ আপনার অ্যাকাউন্টটি ডাটাবেজে অ্যাডমিন হিসেবে অনুমোদিত হয়েছে!');
          } else {
            setIsAdminDashboardOpen(false);
            if (window.location.hash === '#admin') {
              window.history.replaceState(null, '', window.location.pathname);
            }
            showToast('আপনার অ্যাডমিন অ্যাক্সেস প্রত্যাহার করা হয়েছে।');
          }
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(profileChannel);
    };
  }, [user?.id, showToast]);

  // Manual or window-focus role refresh from Supabase database
  const refreshUserRole = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !user?.id) return;
    try {
      const dbRole = await fetchUserRoleFromDatabase(user.id, user.email);
      setUser((prev) => (prev ? { ...prev, role: dbRole } : null));
      setIsRoleVerified(true);

      if (dbRole !== 'admin' && isAdminDashboardOpen) {
        setIsAdminDashboardOpen(false);
        if (window.location.hash === '#admin') {
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    } catch (err) {
      console.warn('Failed to refresh user role from database:', err);
    }
  }, [user?.id, user?.email, isAdminDashboardOpen]);

  // Re-verify role whenever window regains focus (e.g. after modifying role in Supabase tab)
  useEffect(() => {
    const handleWindowFocus = () => {
      refreshUserRole();
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [refreshUserRole]);

  // Cart operations
  const addToCart = (product: Product, quantity = 1, variant?: string) => {
    const selectedVar = variant || (product.variants && product.variants.length > 0 ? product.variants[0].value : undefined);
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.product.id === product.id && item.selectedVariant === selectedVar
      );
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        return updated;
      }
      return [...prev, { product, quantity, selectedVariant: selectedVar }];
    });
    showToast(`✓ "${product.name}" কার্টে যোগ করা হয়েছে!`);
  };

  const updateCartQuantity = (productId: string, variant: string | undefined, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId && item.selectedVariant === variant) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string, variant?: string) => {
    setCart((prev) =>
      prev.filter((item) => !(item.product.id === productId && item.selectedVariant === variant))
    );
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Wishlist operations
  const toggleWishlist = (productId: string) => {
    setWishlist((prev) => {
      const exists = prev.includes(productId);
      if (exists) {
        showToast('উইশলিস্ট থেকে সরানো হয়েছে');
        return prev.filter((id) => id !== productId);
      } else {
        showToast('❤️ উইশলিস্টে যুক্ত করা হয়েছে!');
        return [...prev, productId];
      }
    });
  };

  const isInWishlist = (productId: string) => wishlist.includes(productId);

  // Checkout modal
  const openCheckout = (product?: Product, quantity = 1, variant?: string) => {
    if (product) {
      const selectedVar = variant || (product.variants && product.variants.length > 0 ? product.variants[0].value : undefined);
      setCheckoutItem({ product, quantity, selectedVariant: selectedVar });
    } else {
      setCheckoutItem(null); // checkout full cart
    }
    setIsCheckoutOpen(true);
  };

  const closeCheckout = () => {
    setIsCheckoutOpen(false);
    setCheckoutItem(null);
  };

  // Product Detail
  const openProductDetail = (product: Product) => {
    setSelectedProduct(product);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeProductDetail = () => {
    setSelectedProduct(null);
  };

  // Track Order modal
  const openTrackOrder = (orderNumber?: string) => {
    if (orderNumber) {
      setTrackOrderQuery(orderNumber);
    }
    setIsTrackOrderOpen(true);
  };

  const closeTrackOrder = () => {
    setIsTrackOrderOpen(false);
  };

  // Place order (Anyone can place orders)
  const placeOrder = async (
    orderData: Omit<Order, 'id' | 'order_number' | 'created_at'>
  ): Promise<Order> => {
    const nextSeq = 1000 + orders.length + 1;
    const orderNumber = `LH-${nextSeq}`;
    const newOrder: Order = {
      ...orderData,
      id: `ord-${Date.now()}`,
      order_number: orderNumber,
      created_at: new Date().toISOString(),
    };

    // If Supabase is configured, write order to Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: insertedOrder, error: orderErr } = await supabase
          .from('orders')
          .insert({
            order_number: newOrder.order_number,
            user_id: user?.id || null, // Link to authenticated customer if logged in
            customer_name: newOrder.customer_name,
            phone: newOrder.phone,
            address: newOrder.address,
            delivery_zone: newOrder.delivery_zone,
            delivery_charge: newOrder.delivery_charge,
            subtotal: newOrder.subtotal,
            discount: newOrder.discount,
            total: newOrder.total,
            coupon_code: newOrder.coupon_code || null,
            payment_method: 'COD',
            status: 'pending',
          })
          .select()
          .single();

        if (orderErr) {
          console.error('Supabase order insert error:', orderErr);
        } else if (insertedOrder) {
          newOrder.id = insertedOrder.id;
          newOrder.order_number = insertedOrder.order_number;

          const isValidUUID = (val?: string | null) =>
            Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

          // Insert order items
          const itemsToInsert = newOrder.items.map((it) => ({
            order_id: insertedOrder.id,
            product_id: isValidUUID(it.product_id) ? it.product_id : null,
            product_name: it.product_name,
            variant: it.variant || null,
            quantity: it.quantity,
            unit_price: it.unit_price,
            total: it.total,
          }));

          let { error: itemsErr } = await supabase.from('order_items').insert(itemsToInsert);
          if (itemsErr) {
            console.warn('Retrying order_items with product_id null fallback...', itemsErr);
            const fallbackItems = itemsToInsert.map((it) => ({ ...it, product_id: null }));
            await supabase.from('order_items').insert(fallbackItems);
          }
        }
      } catch (err) {
        console.warn('Supabase order insert fallback to local state:', err);
      }
    }

    setOrders((prev) => [newOrder, ...prev]);

    // Update stock & sold count
    setProducts((prev) =>
      prev.map((p) => {
        const orderedItem = newOrder.items.find((it) => it.product_id === p.id);
        if (orderedItem) {
          return {
            ...p,
            stock: Math.max(0, p.stock - orderedItem.quantity),
            sold_count: p.sold_count + orderedItem.quantity,
          };
        }
        return p;
      })
    );

    if (!checkoutItem) {
      clearCart();
    }

    return newOrder;
  };

  // Admin Order Actions (Strictly protected by admin check)
  const updateOrderStatus = async (orderId: string, status: OrderStatus, courierId?: string) => {
    if (!isAdmin) {
      showToast('অ্যাক্সেস অস্বীকৃত: অর্ডার স্ট্যাটাস আপডেট করার জন্য অ্যাডমিন অনুমতি প্রয়োজন।');
      return;
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const updatePayload: any = { status };
        if (courierId !== undefined) {
          updatePayload.courier_tracking_id = courierId;
        }
        const { error } = await supabase.from('orders').update(updatePayload).eq('id', orderId);
        if (error) {
          console.error('Error updating order status in Supabase:', error);
          showToast(`ডাটাবেজ ত্রুটি: ${error.message}`);
          return;
        }
      } catch (err) {
        console.warn('Error updating order status in Supabase:', err);
      }
    }

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          return {
            ...ord,
            status,
            courier_tracking_id: courierId !== undefined ? courierId : ord.courier_tracking_id,
          };
        }
        return ord;
      })
    );
    showToast(`অর্ডার স্ট্যাটাস আপডেট হয়েছে: ${status}`);
  };

  const deleteOrder = async (orderId: string) => {
    if (!isAdmin) {
      showToast('অ্যাক্সেস অস্বীকৃত: অর্ডার মুছে ফেলার জন্য অ্যাডমিন অনুমতি প্রয়োজন।');
      return;
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('order_items').delete().eq('order_id', orderId);
        const { error } = await supabase.from('orders').delete().eq('id', orderId);
        if (error) {
          console.error('Error deleting order from Supabase:', error);
          showToast(`ডাটাবেজ ত্রুটি: ${error.message}`);
          return;
        }
      } catch (err) {
        console.warn('Error deleting order from Supabase:', err);
      }
    }

    setOrders((prev) => prev.filter((ord) => ord.id !== orderId));
    showToast('অর্ডার সফলভাবে মুছে ফেলা হয়েছে');
  };

  // Auth operations
  const openAuthModal = () => setIsAuthOpen(true);
  const closeAuthModal = () => setIsAuthOpen(false);

  const loginWithGoogle = async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
          },
        });
        return;
      } catch (err) {
        console.warn('Google Auth error:', err);
      }
    }
  };

  const loginWithEmail = async (email: string, password?: string) => {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) {
      throw new Error('অনুগ্রহ করে একটি সঠিক ইমেইল এড্রেস লিখুন');
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password || '123456',
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.user) {
        throw new Error('ব্যবহারকারী শনাক্ত করা যায়নি');
      }

      // Strictly verify role from the Supabase database
      const dbRole = await fetchUserRoleFromDatabase(data.user.id, data.user.email);
      const fullName = data.user.user_metadata?.full_name || cleanEmail.split('@')[0] || 'User';

      const newUser: UserProfile = {
        id: data.user.id,
        email: data.user.email || cleanEmail,
        full_name: fullName,
        role: dbRole,
        avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${cleanEmail}`,
      };

      setUser(newUser);
      setIsRoleVerified(true);
      closeAuthModal();

      // If user has 'admin' role in Supabase database, grant admin dashboard access
      if (dbRole === 'admin') {
        setIsAdminDashboardOpen(true);
        showToast('✓ স্বাগতম অ্যাডমিন! সরাসরি অ্যাডমিন ড্যাশবোর্ডে লগইন করা হয়েছে।');
      } else {
        setIsAdminDashboardOpen(false);
        showToast(`স্বাগতম, ${newUser.full_name}!`);
      }
    } else {
      // Local fallback mode
      const dbRole = await fetchUserRoleFromDatabase(`usr-${Date.now()}`, cleanEmail);
      const newUser: UserProfile = {
        id: `usr-${Date.now()}`,
        email: cleanEmail,
        full_name: cleanEmail.split('@')[0],
        role: dbRole,
        avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${cleanEmail}`,
      };
      setUser(newUser);
      setIsRoleVerified(true);
      closeAuthModal();
      showToast(`স্বাগতম, ${newUser.full_name}!`);
    }
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    const cleanEmail = email.toLowerCase().trim();
    const fullName = name?.trim() || cleanEmail.split('@')[0];

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: fullName,
            // Notice: We do NOT pass role here.
            // Supabase trigger handle_new_user() automatically and strictly enforces role = 'user'
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      // All newly registered users are strictly assigned role 'user'
      const newUser: UserProfile = {
        id: data.user?.id || `usr-${Date.now()}`,
        email: cleanEmail,
        full_name: fullName,
        role: 'user', // Default role is strictly 'user'
        avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${cleanEmail}`,
      };

      setUser(newUser);
      setIsRoleVerified(true);
      setIsAdminDashboardOpen(false);
      closeAuthModal();
      showToast('✓ অ্যাকাউন্ট তৈরি সম্পন্ন! আপনি সাধারণ গ্রাহক হিসেবে লগইন আছেন।');
    } else {
      const newUser: UserProfile = {
        id: `usr-${Date.now()}`,
        email: cleanEmail,
        full_name: fullName,
        role: 'user',
        avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${cleanEmail}`,
      };
      setUser(newUser);
      setIsRoleVerified(true);
      setIsAdminDashboardOpen(false);
      closeAuthModal();
      showToast('✓ অ্যাকাউন্ট তৈরি সম্পন্ন হয়েছে!');
    }
  };

  const logout = () => {
    if (!isSupabaseConfigured) fetch('/__master/logout',{method:'POST',headers:{'X-Master-CSRF':(window as any).__MASTER_LIBRARY_DEMO__?.csrf||''}}).then(()=>location.assign('/')); 
    if (isSupabaseConfigured && supabase) {
      supabase.auth.signOut().catch((err) => console.warn('Supabase signOut error:', err));
    }
    setUser(null);
    setIsRoleVerified(false);
    setIsAdminDashboardOpen(false);
    if (window.location.hash === '#admin') {
      window.history.replaceState(null, '', window.location.pathname);
    }
    showToast('লগআউট করা হয়েছে');
  };

  // Admin Dashboard access request
  const openAdminDashboard = () => {
    if (!user) {
      showToast('অনুগ্রহ করে আগে লগইন করুন');
      openAuthModal();
      return;
    }

    if (!isAdmin) {
      showToast('অ্যাক্সেস অস্বীকৃত: আপনার অ্যাকাউন্টে অ্যাডমিন অনুমতি নেই। Supabase ডাটাবেজে role "admin" সেট করা থাকতে হবে।');
      return;
    }

    setIsAdminDashboardOpen(true);
  };

  const closeAdminDashboard = () => {
    setIsAdminDashboardOpen(false);
    if (window.location.hash === '#admin') {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  // Admin inventory updates (All guarded strictly by isAdmin check and Supabase RLS)
  const updateProduct = async (updated: Product) => {
    if (!isAdmin) {
      showToast('অ্যাক্সেস অস্বীকৃত: পণ্য সম্পাদনা করার জন্য অ্যাডমিন অনুমতি প্রয়োজন।');
      return;
    }

    const matchedCategory = categories.find(
      (c) => c.id === updated.category_id || (updated.category_slug && c.slug === updated.category_slug)
    );
    const enrichedUpdated: Product = {
      ...updated,
      category_id: matchedCategory?.id || updated.category_id,
      category_slug: matchedCategory?.slug || updated.category_slug || '',
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const productToUpdate = {
          category_id: enrichedUpdated.category_id,
          name: enrichedUpdated.name,
          name_bn: enrichedUpdated.name_bn,
          slug: enrichedUpdated.slug,
          description: enrichedUpdated.description,
          short_description: enrichedUpdated.short_description || '',
          price: enrichedUpdated.price,
          old_price: enrichedUpdated.old_price,
          discount_percent: enrichedUpdated.discount_percent,
          badge: enrichedUpdated.badge,
          stock: enrichedUpdated.stock,
          image_url: enrichedUpdated.image_url,
          images: enrichedUpdated.images || [],
          is_active: enrichedUpdated.is_active,
          is_featured: enrichedUpdated.is_featured,
          is_flash_sale: enrichedUpdated.is_flash_sale,
          is_hot_deal: enrichedUpdated.is_hot_deal,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('products').update(productToUpdate).eq('id', enrichedUpdated.id);
        if (error) {
          console.error('Error updating product in Supabase:', error);
          showToast(`ডাটাবেজ ত্রুটি: ${error.message}`);
          return;
        }
      } catch (err) {
        console.warn('Error updating product in Supabase:', err);
      }
    }
    setProducts((prev) => prev.map((p) => (p.id === enrichedUpdated.id ? enrichedUpdated : p)));
    showToast('পণ্য সফলভাবে আপডেট করা হয়েছে');
  };

  const addProduct = async (newP: Omit<Product, 'id'>) => {
    if (!isAdmin) {
      showToast('অ্যাক্সেস অস্বীকৃত: নতুন পণ্য যোগ করার জন্য অ্যাডমিন অনুমতি প্রয়োজন।');
      return;
    }

    const matchedCategory = categories.find(
      (c) => c.id === newP.category_id || (newP.category_slug && c.slug === newP.category_slug)
    );

    const created: Product = {
      ...newP,
      id: generateUUID(),
      category_id: matchedCategory?.id || newP.category_id || (categories[0]?.id || ''),
      category_slug: matchedCategory?.slug || newP.category_slug || (categories[0]?.slug || ''),
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const productToInsert = {
          id: created.id,
          category_id: created.category_id,
          name: created.name,
          name_bn: created.name_bn,
          slug: created.slug,
          description: created.description,
          short_description: created.short_description || '',
          price: created.price,
          old_price: created.old_price,
          discount_percent: created.discount_percent,
          badge: created.badge,
          stock: created.stock,
          image_url: created.image_url,
          images: created.images || [],
          is_active: created.is_active,
          is_featured: created.is_featured,
          is_flash_sale: created.is_flash_sale,
          is_hot_deal: created.is_hot_deal,
        };

        const { error } = await supabase.from('products').insert([productToInsert]);
        if (error) {
          console.error('Supabase product insert error details:', error);
          showToast(`ডাটাবেজ ত্রুটি: ${error.message}`);
          return;
        }
      } catch (err) {
        console.warn('Error adding product to Supabase:', err);
      }
    }

    setProducts((prev) => [created, ...prev]);
    showToast('নতুন পণ্য যুক্ত করা হয়েছে!');
  };

  const deleteProduct = async (productId: string) => {
    if (!isAdmin) {
      showToast('অ্যাক্সেস অস্বীকৃত: পণ্য মুছে ফেলার জন্য অ্যাডমিন অনুমতি প্রয়োজন।');
      return;
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('products').delete().eq('id', productId);
        if (error) {
          if (error.code === '42501') {
            showToast('ডাটাবেজ অনুমতি এরর: আপনার অ্যাকাউন্টে ডিলিট করার অনুমতি নেই (Supabase RLS Policy error)');
            return;
          }
          console.warn('Supabase product delete warning:', error);
        }
      } catch (err) {
        console.warn('Error deleting product from Supabase:', err);
      }
    }

    setProducts((prev) => {
      const updated = prev.filter((p) => p.id !== productId);
      localStorage.setItem('littlehug_products', JSON.stringify(updated));
      return updated;
    });
    showToast('পণ্য সফলভাবে মুছে ফেলা হয়েছে');
  };

  // One-click demo data purge (purges any leftover demo products, categories, and mock orders)
  const clearAllDemoData = useCallback(() => {
    setProducts((prev) => {
      const cleaned = prev.filter(
        (p) => !p.id.startsWith('b0000000-') && !p.id.startsWith('p0000000-')
      );
      localStorage.setItem('littlehug_products', JSON.stringify(cleaned));
      return cleaned;
    });
    setCategories((prev) => {
      const cleaned = prev.filter((c) => !c.id.startsWith('a0000000-'));
      localStorage.setItem('littlehug_categories', JSON.stringify(cleaned));
      return cleaned;
    });
    setOrders((prev) => {
      const cleaned = prev.filter(
        (o) => !o.id.startsWith('ord-100') && !o.order_number?.startsWith('LH-100')
      );
      localStorage.setItem('littlehug_orders', JSON.stringify(cleaned));
      return cleaned;
    });
    showToast('সব ডেমো ডাটা (পণ্য, ক্যাটাগরি, অর্ডার) সফলভাবে মুছে ফেলা হয়েছে!');
  }, [showToast]);

  const addCategory = async (newCat: Omit<Category, 'id'>) => {
    if (!isAdmin) {
      showToast('অ্যাক্সেস অস্বীকৃত: ক্যাটাগরি যুক্ত করার জন্য অ্যাডমিন অনুমতি প্রয়োজন।');
      return;
    }

    const created: Category = {
      ...newCat,
      id: generateUUID(),
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('categories').insert([created]);
        if (error) {
          console.error('Supabase category insert error:', error);
          showToast(`ডাটাবেজ ত্রুটি: ${error.message}`);
          return;
        }
      } catch (err) {
        console.warn('Error adding category to Supabase:', err);
      }
    }

    setCategories((prev) => {
      const updated = [...prev, created];
      localStorage.setItem('littlehug_categories', JSON.stringify(updated));
      return updated;
    });
    showToast(`নতুন ক্যাটাগরি "${newCat.name}" যোগ করা হয়েছে!`);
  };

  const deleteCategory = async (categoryId: string) => {
    if (!isAdmin) {
      showToast('অ্যাক্সেস অস্বীকৃত: ক্যাটাগরি মুছে ফেলার জন্য অ্যাডমিন অনুমতি প্রয়োজন।');
      return;
    }

    // If configured in Supabase and not a pure legacy demo category ID, delete from database
    if (isSupabaseConfigured && supabase && !categoryId.startsWith('a0000000-')) {
      try {
        const { error } = await supabase.from('categories').delete().eq('id', categoryId);
        if (error) {
          if (error.code === '42501' || error.message?.includes('violates row-level security')) {
            showToast('অ্যাক্সেস অস্বীকৃত: ক্যাটাগরি মুছে ফেলার জন্য অ্যাডমিন অনুমতি প্রয়োজন।');
            return;
          }
          console.warn('Supabase category delete note:', error);
        }
      } catch (err) {
        console.warn('Error deleting category from Supabase:', err);
      }
    }

    setCategories((prev) => {
      const updated = prev.filter((c) => c.id !== categoryId);
      localStorage.setItem('littlehug_categories', JSON.stringify(updated));
      return updated;
    });
    showToast('ক্যাটাগরি মুছে ফেলা হয়েছে');
  };

  const updateSettings = async (newSettings: Partial<SiteSettings>) => {
    if (!isAdmin) {
      showToast('অ্যাক্সেস অস্বীকৃত: সেটিংস পরিবর্তন করার জন্য অ্যাডমিন অনুমতি প্রয়োজন।');
      return;
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const updates = Object.entries(newSettings).map(([key, value]) => ({
          key,
          value,
          updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from('site_settings').upsert(updates);
        if (error) {
          console.error('Error updating site settings in Supabase:', error);
          showToast(`ডাটাবেজ ত্রুটি: ${error.message}`);
        }
      } catch (err) {
        console.warn('Error updating site settings in Supabase:', err);
      }
    }

    setSettings((prev) => ({ ...prev, ...newSettings }));
    showToast('সেটিংস সংরক্ষণ করা হয়েছে');
  };

  return (
    <StoreContext.Provider
      value={{
        products,
        categories,
        deliveryZones,
        coupons,
        settings,
        selectedCategory,
        setSelectedCategory,
        searchQuery,
        setSearchQuery,
        cart,
        isCartOpen,
        setIsCartOpen,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        cartTotal,
        cartCount,
        wishlist,
        toggleWishlist,
        isInWishlist,
        isCheckoutOpen,
        checkoutItem,
        openCheckout,
        closeCheckout,
        selectedProduct,
        openProductDetail,
        closeProductDetail,
        orders,
        isTrackOrderOpen,
        trackOrderQuery,
        openTrackOrder,
        closeTrackOrder,
        setTrackOrderQuery,
        placeOrder,
        updateOrderStatus,
        deleteOrder,
        user,
        isAdmin,
        isRoleVerified,
        refreshUserRole,
        isAuthOpen,
        openAuthModal,
        closeAuthModal,
        loginWithGoogle,
        loginWithEmail,
        signUpWithEmail,
        logout,
        isAdminDashboardOpen,
        openAdminDashboard,
        closeAdminDashboard,
        updateProduct,
        addProduct,
        deleteProduct,
        addCategory,
        deleteCategory,
        updateSettings,
        toastMessage,
        showToast,
        clearAllDemoData,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
