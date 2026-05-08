import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Product } from "@/lib/api";

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  storeId: string | null;
  storeSlug: string | null;
  addItem: (product: Product, storeId: string, storeSlug: string) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | null>(null);

const STORAGE_KEY = "advize_cart";

function loadSaved(): { storeId: string | null; storeSlug: string | null; items: CartItem[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { storeId: null, storeSlug: null, items: [] };
    return JSON.parse(raw);
  } catch {
    return { storeId: null, storeSlug: null, items: [] };
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const saved = loadSaved();
    setStoreId(saved.storeId);
    setStoreSlug(saved.storeSlug);
    setItems(saved.items);
  }, []);

  const persist = (sid: string | null, slug: string | null, newItems: CartItem[]) => {
    setStoreId(sid);
    setStoreSlug(slug);
    setItems(newItems);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ storeId: sid, storeSlug: slug, items: newItems }));
  };

  const addItem = (product: Product, sid: string, slug: string) => {
    const baseItems = sid !== storeId ? [] : items;
    const existing = baseItems.find(i => i.product.id === product.id);
    const newItems = existing
      ? baseItems.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      : [...baseItems, { product, quantity: 1 }];
    persist(sid, slug, newItems);
  };

  const removeItem = (productId: string) => {
    persist(storeId, storeSlug, items.filter(i => i.product.id !== productId));
  };

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) { removeItem(productId); return; }
    persist(storeId, storeSlug, items.map(i => i.product.id === productId ? { ...i, quantity: qty } : i));
  };

  const clearCart = () => persist(null, null, []);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => {
    const price = (i.product.salePrice != null && i.product.salePrice > 0 && i.product.salePrice < i.product.price)
      ? i.product.salePrice! : i.product.price;
    return s + price * i.quantity;
  }, 0);

  return (
    <CartContext.Provider value={{ items, storeId, storeSlug, addItem, removeItem, updateQty, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
