import { auth } from "@/lib/firebase";

export type ProductVariant = {
  label: string;
  values: string[];
};

export type Product = {
  id: string;
  storeId: string;
  name: string;
  price: number;
  salePrice?: number;
  description: string;
  imageUrl: string;
  imageUrls: string[];
  category: string;
  units: number;
  trending?: boolean;
  variants?: ProductVariant[];
};

export type Review = {
  id: string;
  product_id: string;
  name: string;
  rating: number;
  comment: string;
  date: string;
};

const BASE = `${import.meta.env.BASE_URL}api`;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      headers["Authorization"] = `Bearer ${token}`;
    } catch {}
  }

  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Domain helpers ──────────────────────────────────────────
/** Returns the store slug when the app is accessed via a store subdomain, e.g. myshop.store.advize.in */
export function getSubdomainSlug(): string | null {
  const m = window.location.hostname.match(/^([^.]+)\.store\.advize\.in$/);
  return m?.[1] ?? null;
}

/** Returns the public URL for a store — subdomain format in prod, path format in dev */
export function getStorePublicUrl(slug: string): string {
  if (import.meta.env.PROD) return `https://${slug}.store.advize.in`;
  return `${window.location.origin}/store/${slug}`;
}

// ── Stores ──────────────────────────────────────────────────
export interface Store {
  id: string;
  name: string;
  slug: string;
  whatsapp: string;
  category?: string;
  location?: string;
  logo_url?: string;
  email?: string;
  contact_phone?: string;
  terms_and_conditions?: string;
  razorpay_key_id?: string;
  razorpay_enabled?: boolean;
  razorpay_account_id?: string;
  razorpay_account_status?: string;
  advize_payment_enabled?: boolean;
}

export const getStore = (slug: string) =>
  request<Store>(`/stores/${slug}`);

// ── Combined storefront (store + products + reviews in one request) ───────────
export const getStorefront = (slug: string) =>
  request<{ store: Store; products: ApiProduct[]; reviews: ApiReview[] }>(
    `/storefront/${slug}`
  ).then(p => ({
    store: p.store,
    products: p.products.map(toProduct),
    reviews: p.reviews.map(toReview),
  }));

export const getStoreById = (id: string) =>
  request<Store>(`/stores/id/${id}`);

export const getStoreByOwnerId = (owner_id: string) =>
  request<Store>(`/stores?owner_id=${encodeURIComponent(owner_id)}`);

export const sendOtp = (email: string) =>
  request<{ message: string }>("/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

export const verifyOtp = (email: string, otp: string) =>
  request<{ verified: boolean }>("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, otp }),
  });

export const createStore = (body: Omit<Store, "id">) =>
  request<Store>("/stores", { method: "POST", body: JSON.stringify(body) });

export const updateStore = (id: string, body: Partial<Omit<Store, "id">>) =>
  request<Store>(`/stores/${id}`, { method: "PATCH", body: JSON.stringify(body) });

// ── Products ─────────────────────────────────────────────────
export interface ApiProduct {
  id: string;
  store_id: string;
  name: string;
  price: number;
  sale_price?: number;
  description: string;
  image_url: string;
  image_urls?: string[];
  category: string;
  units: number;
  trending?: boolean;
  variants: { id: string; label: string; values: string[] }[];
}

function toProduct(p: ApiProduct): Product {
  const imageUrls =
    p.image_urls && p.image_urls.length > 0
      ? p.image_urls
      : p.image_url
      ? [p.image_url]
      : [];
  return {
    id: p.id,
    storeId: p.store_id,
    name: p.name,
    price: p.price,
    salePrice: p.sale_price ?? undefined,
    description: p.description ?? "",
    imageUrl: imageUrls[0] ?? "",
    imageUrls,
    category: p.category ?? "",
    units: p.units ?? 0,
    trending: p.trending ?? false,
    variants: (p.variants ?? []).map(v => ({ label: v.label, values: v.values })),
  };
}

export const getProducts = (store_id: string) =>
  request<ApiProduct[]>(`/products?store_id=${store_id}`).then(list =>
    list.map(toProduct)
  );

export const getProduct = (id: string) =>
  request<ApiProduct>(`/products/${id}`).then(toProduct);

/**
 * Combined product-detail endpoint — returns product (with variants),
 * store, and related products in a single round-trip.
 * Reviews are NOT included; they are lazy-loaded by the client when
 * the user opens the reviews section.
 */
export const getProductDetail = (id: string) =>
  request<{
    product: ApiProduct;
    store: Store;
    relatedProducts: ApiProduct[];
  }>(`/product-detail/${id}`).then(r => ({
    product: toProduct(r.product),
    store: r.store,
    relatedProducts: r.relatedProducts.map(toProduct),
  }));

export const createProduct = (body: {
  store_id: string;
  name: string;
  price: number;
  sale_price?: number;
  description?: string;
  image_url?: string;
  image_urls?: string[];
  category?: string;
  units?: number;
  variants?: ProductVariant[];
}) => request<ApiProduct>("/products", { method: "POST", body: JSON.stringify(body) }).then(toProduct);

export const updateProduct = (id: string, body: Partial<{
  name: string;
  price: number;
  sale_price: number | null;
  description: string;
  image_url: string;
  image_urls: string[];
  category: string;
  units: number;
  trending: boolean;
  variants: ProductVariant[];
}>) => request<ApiProduct>(`/products/${id}`, { method: "PATCH", body: JSON.stringify(body) }).then(toProduct);

export const deleteProduct = (id: string) =>
  request<void>(`/products/${id}`, { method: "DELETE" });

// ── Reviews ──────────────────────────────────────────────────
export interface ApiReview {
  id: string;
  product_id: string;
  name: string;
  rating: number;
  comment: string;
  created_at: string;
}

function toReview(r: ApiReview): Review {
  return {
    id: r.id,
    product_id: r.product_id,
    name: r.name,
    rating: r.rating,
    comment: r.comment,
    date: new Date(r.created_at).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  };
}

export const getReviews = (product_id: string) =>
  request<ApiReview[]>(`/reviews?product_id=${product_id}`).then(list =>
    list.map(toReview)
  );

export const getStoreReviews = (store_id: string) =>
  request<ApiReview[]>(`/reviews?store_id=${store_id}`).then(list =>
    list.map(toReview)
  );

export const createReview = (body: {
  product_id: string;
  name: string;
  rating: number;
  comment: string;
}) => request<ApiReview>("/reviews", { method: "POST", body: JSON.stringify(body) }).then(toReview);

// ── Analytics ─────────────────────────────────────────────────
export interface AnalyticsSummary {
  totalClicks: number;
  totalReviews: number;
  avgRating: string | null;
  inStock: number;
  outOfStock: number;
  productClicks: { productId: string; name: string; clicks: number }[];
  mostClicked: { productId: string; name: string; clicks: number } | null;
  leastClicked: { productId: string; name: string; clicks: number } | null;
  categoryBreakdown: { category: string; clicks: number; color: string }[];
  weeklyClicks: { day: string; clicks: number }[];
}

export const getAnalytics = (store_id: string) =>
  request<AnalyticsSummary>(`/analytics/${store_id}`);

export interface ProductAnalytics {
  totalClicks: number;
  weeklyClicks: { day: string; clicks: number }[];
}

export const getProductAnalytics = (product_id: string) =>
  request<ProductAnalytics>(`/analytics/product/${product_id}`);

export const uploadImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Image upload failed");
  }
  const data = await res.json();
  return data.url as string;
};

export const trackClick = (product_id: string, store_id: string) =>
  request<void>("/analytics/click", {
    method: "POST",
    body: JSON.stringify({ product_id, store_id }),
  }).catch(() => {}); // fire-and-forget; never throw

// ── Payments ─────────────────────────────────────────────────
export interface RazorpayOrderResponse {
  order_id: string;
  key_id: string;
  amount: number;
  currency: string;
}

export interface OnboardRazorpayBody {
  store_id: string;
  legal_business_name: string;
  contact_name: string;
  business_type: string;
  email: string;
  phone: string;
  pan: string;
  category: string;
  subcategory: string;
  city: string;
  state: string;
  postal_code: string;
  street1?: string;
}

export const onboardRazorpay = (body: OnboardRazorpayBody) =>
  request<{ account_id: string; status: string }>("/payments/razorpay/onboard", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const createRazorpayOrder = (store_id: string, amount_paise: number, receipt?: string) =>
  request<RazorpayOrderResponse>("/payments/razorpay/create-order", {
    method: "POST",
    body: JSON.stringify({ store_id, amount_paise, receipt }),
  });

export const verifyRazorpayPayment = (payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  store_id: string;
}) =>
  request<{ verified: boolean }>("/payments/razorpay/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  });

// ── Orders ────────────────────────────────────────────────────
export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  variant?: string;
}

export interface OrderBuyer {
  name: string;
  phone: string;
  addressLine: string;
  city: string;
  pincode: string;
}

export type OrderStatus = "pending" | "confirmed" | "delivered" | "cancelled";
export type PaymentMethod = "advize" | "razorpay";
export type PaymentStatus = "pending" | "paid" | "failed";

export interface Order {
  id: string;
  payment_method?: PaymentMethod;
  payment_status?: PaymentStatus;
  cashfree_order_id?: string;
  cashfree_payment_id?: string;
  razorpay_payment_id?: string;
  amount_paise: number;
  items: OrderItem[];
  buyer: OrderBuyer;
  status: OrderStatus;
  created_at: any;
}

export interface OrderStats {
  totalOrders: number;
  totalRevenueRupees: number;
  pendingOrders: number;
  confirmedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  recentOrders: Order[];
  orders: Order[];
}

export const createOrder = (payload: {
  store_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  amount_paise: number;
  items: OrderItem[];
  buyer: OrderBuyer;
}) =>
  request<{ id: string }>("/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const createCashfreeOrder = (payload: {
  store_id: string;
  amount_paise: number;
  items: OrderItem[];
  buyer: OrderBuyer;
  slug: string;
}) =>
  request<{ payment_session_id: string; order_doc_id: string; cf_order_id: string }>(
    "/cashfree/create-order",
    { method: "POST", body: JSON.stringify(payload) }
  );

export const verifyCashfreeOrder = (cf_order_id: string) =>
  request<{ id: string; payment_status: PaymentStatus; status: OrderStatus; amount_paise: number }>(
    `/cashfree/verify/${cf_order_id}`
  );

export const getOrderStats = (store_id: string) =>
  request<OrderStats>(`/orders/store/${store_id}`);

export const updateOrderStatus = (order_id: string, status: OrderStatus) =>
  request<{ ok: boolean; status: string }>(`/orders/${order_id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
