import { useState, useEffect } from "react";

const STORAGE_KEY = "shop-dark-mode";

export function useTheme() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
  });

  useEffect(() => {
    const html = document.documentElement;
    if (dark) html.classList.add("dark");
    else html.classList.remove("dark");
    try { localStorage.setItem(STORAGE_KEY, dark ? "true" : "false"); } catch {}
  }, [dark]);

  return { dark, toggle: () => setDark(d => !d) };
}
