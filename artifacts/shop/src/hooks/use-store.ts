import { useState, useEffect } from "react";
import { getStore, getStoreByOwnerId, type Store } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const STORE_ID_KEY = "shop_store_id";
const STORE_SLUG_KEY = "shop_store_slug";
const STORE_OBJ_KEY = "shop_store_obj_v1";

export function useStore() {
  const { user, loading: authLoading } = useAuth();
  const [store, setStoreState] = useState<Store | null>(() => {
    // Seed from localStorage cache immediately — no spinner on repeat visits
    try {
      const raw = localStorage.getItem(STORE_OBJ_KEY);
      return raw ? (JSON.parse(raw) as Store) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setStore = (updater: Store | null | ((prev: Store | null) => Store | null)) => {
    setStoreState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (next) {
        try { localStorage.setItem(STORE_OBJ_KEY, JSON.stringify(next)); } catch {}
      }
      return next;
    });
  };

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    async function init() {
      // If we already seeded from cache, don't show a loading spinner —
      // just refresh silently in the background.
      const hasCached = store !== null;
      if (!hasCached) setLoading(true);

      try {
        if (user) {
          try {
            const s = await getStoreByOwnerId(user.uid);
            if (!cancelled) {
              setStoreState(s);
              try {
                localStorage.setItem(STORE_ID_KEY, s.id);
                localStorage.setItem(STORE_SLUG_KEY, s.slug);
                localStorage.setItem(STORE_OBJ_KEY, JSON.stringify(s));
              } catch {}
            }
            return;
          } catch {
            // No store found for this user — fall through to legacy lookup
          }
        } else {
          // Signed out — clear cache
          try {
            localStorage.removeItem(STORE_OBJ_KEY);
            localStorage.removeItem(STORE_ID_KEY);
            localStorage.removeItem(STORE_SLUG_KEY);
          } catch {}
        }

        // Legacy: look up by localStorage slug (for existing stores with null owner_id)
        const savedSlug = localStorage.getItem(STORE_SLUG_KEY);
        if (savedSlug) {
          try {
            const s = await getStore(savedSlug);
            if (!cancelled) {
              setStoreState(s);
              try { localStorage.setItem(STORE_OBJ_KEY, JSON.stringify(s)); } catch {}
            }
          } catch {
            try {
              localStorage.removeItem(STORE_ID_KEY);
              localStorage.removeItem(STORE_SLUG_KEY);
              localStorage.removeItem(STORE_OBJ_KEY);
            } catch {}
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? "Failed to load store");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const refreshStore = async () => {
    if (user) {
      try {
        const s = await getStoreByOwnerId(user.uid);
        setStore(s);
        return;
      } catch {}
    }
    const slug = localStorage.getItem(STORE_SLUG_KEY);
    if (!slug) return;
    try {
      const s = await getStore(slug);
      setStore(s);
    } catch {}
  };

  return { store, loading: loading || authLoading, error, refreshStore, setStore };
}
