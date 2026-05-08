import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  Package, TrendingUp, ShoppingBag, Plus, Boxes,
  Store, LayoutDashboard, ListOrdered, Star, Loader2,
  QrCode, Moon, Sun, Share2, Copy, Check, LogOut, Flame, Camera,
  Pencil, Phone, MapPin, Tag, Mail, FileText, Download,
  Puzzle, CreditCard, Globe, Truck, Lock, Sparkles, ExternalLink, Bike, Printer, Zap, ChevronDown,
  ShoppingCart, IndianRupee, PackageCheck, Clock, AlertCircle,
  Settings, Bell, Shield, User, ChevronRight, HelpCircle, Trash2,
  Search, X, SlidersHorizontal,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ProductCard } from "@/components/ProductCard";
import { AnalyticsSection } from "@/components/AnalyticsSection";
import { useStore } from "@/hooks/use-store";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetTitle,
} from "@/components/ui/sheet";
import { getProducts, getAnalytics, updateProduct, updateStore, uploadImage, onboardRazorpay, getOrderStats, updateOrderStatus, type AnalyticsSummary, type OrderStats, type Order, type OrderStatus } from "@/lib/api";
import type { Store as StoreType } from "@/lib/api";
import type { Product } from "@/lib/api";

/* ── helpers ────────────────────────────────────────── */
function MiniStat({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string | number; color: string;
}) {
  return (
    <div className="flex-1 bg-card border rounded-2xl px-3 py-3 flex flex-col gap-1 min-w-0">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${color}`}>{icon}</div>
      <p className="text-[11px] text-muted-foreground font-medium leading-tight mt-1">{label}</p>
      <p className="text-base font-bold text-foreground leading-tight truncate">{value}</p>
    </div>
  );
}

/* ── QR Code card (shared) ───────────────────────────── */
function QrCodeCard({ storeUrl, storeName, compact = false }: {
  storeUrl: string;
  storeName: string;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  /* Extract the rendered QR canvas as a PNG File */
  const getQrFile = (): File | null => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return null;
    // Render onto a larger canvas with padding so it looks clean when shared
    const pad = 24;
    const out = document.createElement("canvas");
    out.width = canvas.width + pad * 2;
    out.height = canvas.height + pad * 2;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, pad, pad);
    const dataUrl = out.toDataURL("image/png");
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    const bytes = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) bytes[i] = bstr.charCodeAt(i);
    return new File([bytes], `${storeName.toLowerCase().replace(/\s+/g, "-")}-qr.png`, { type: mime });
  };

  const handleDownload = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const pad = 24;
    const out = document.createElement("canvas");
    out.width = canvas.width + pad * 2;
    out.height = canvas.height + pad * 2;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, pad, pad);
    const a = document.createElement("a");
    a.href = out.toDataURL("image/png");
    a.download = `${storeName.toLowerCase().replace(/\s+/g, "-")}-qr.png`;
    a.click();
  };

  const handleShare = async () => {
    const file = getQrFile();
    const shareData = {
      title: `${storeName} — Shop Online`,
      text: `Scan this QR code or tap the link to visit ${storeName}'s store! 🛍️\n${storeUrl}`,
      url: storeUrl,
      ...(file ? { files: [file] } : {}),
    };

    if (navigator.share) {
      try {
        /* Try sharing with QR image file first */
        if (file && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: shareData.title, text: shareData.text, files: [file] });
        } else {
          await navigator.share({ title: shareData.title, text: shareData.text, url: storeUrl });
        }
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return; // user cancelled — don't fall through
      }
    }

    // Fallback: copy link to clipboard
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      toast({ title: "Link copied!", description: "Share it with your customers." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ variant: "destructive", title: "Couldn't copy link", description: storeUrl });
    }
  };

  const qrSize = compact ? 96 : 200;

  return (
    <div className={`bg-card border rounded-2xl p-4 ${compact ? "" : "sm:p-5"}`} data-testid="qr-code-card">
      <div className="flex items-center gap-2 mb-1">
        <QrCode className="h-4 w-4 text-primary shrink-0" />
        <p className="text-sm font-semibold">Store QR Code</p>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4">
        {compact
          ? "Share the QR code — customers scan it to visit your store."
          : "Share this with customers — they scan it and land straight on your store."}
      </p>

      {compact ? (
        /* Compact layout: QR on left, actions on right */
        <div className="flex items-center gap-4">
          <div ref={qrRef} className="p-2 bg-white rounded-xl border shadow-sm shrink-0">
            <QRCodeCanvas
              value={storeUrl}
              size={qrSize}
              bgColor="#ffffff"
              fgColor="#1a1a1a"
              level="M"
            />
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <p className="text-[10px] text-muted-foreground break-all leading-relaxed">{storeUrl}</p>
            <Button onClick={handleShare} size="sm" className="w-full rounded-full text-xs" data-testid="btn-share-link-qr">
              {copied ? <Check className="h-3 w-3 mr-1.5" /> : <Share2 className="h-3 w-3 mr-1.5" />}
              {copied ? "Copied!" : "Share QR Code"}
            </Button>
            <Button
              onClick={handleDownload}
              size="sm"
              variant="outline"
              className="w-full rounded-full text-xs"
              data-testid="btn-download-qr"
            >
              <Download className="h-3 w-3 mr-1.5" />
              Download PNG
            </Button>
          </div>
        </div>
      ) : (
        /* Full layout: centred */
        <div className="flex flex-col items-center gap-3">
          <div ref={qrRef} className="p-4 bg-white rounded-2xl border shadow-sm">
            <QRCodeCanvas
              value={storeUrl}
              size={qrSize}
              bgColor="#ffffff"
              fgColor="#1a1a1a"
              level="M"
            />
          </div>
          <p className="text-[10px] text-muted-foreground text-center break-all max-w-[240px] leading-relaxed">
            {storeUrl}
          </p>
          <Button onClick={handleShare} className="w-full rounded-full" size="sm" data-testid="btn-share-link-qr-full">
            {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Share2 className="h-3.5 w-3.5 mr-1.5" />}
            {copied ? "Copied!" : "Share QR Code"}
          </Button>
          <Button
            onClick={handleDownload}
            variant="outline"
            className="w-full rounded-full"
            size="sm"
            data-testid="btn-download-qr-full"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Download PNG
          </Button>
        </div>
      )}
    </div>
  );
}

/* ── panels ─────────────────────────────────────────── */
function HomePanel({ products, analytics, store, orderStats, loading = false }: {
  products: Product[];
  analytics: AnalyticsSummary | null;
  store: StoreType | null;
  orderStats: OrderStats | null;
  loading?: boolean;
}) {
  const inStockCount = products.filter(p => p.units > 0).length;
  const outCount = products.filter(p => p.units === 0).length;
  const totalUnits = products.reduce((s, p) => s + p.units, 0);
  const avgStoreRating = analytics?.avgRating ?? "–";
  const storeUrl = store?.slug
    ? `https://store.advize.in/store/${store.slug}`
    : "";
  const paymentActive = !!(store?.razorpay_account_id || store?.razorpay_key_id);

  return (
    <div className="p-3 sm:p-6 space-y-4 pb-28">
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold">Welcome back!</h1>
          <p className="text-muted-foreground text-xs mt-0.5">Here's your store at a glance.</p>
        </div>
        <Button asChild size="sm" className="rounded-full shadow-sm text-xs" data-testid="btn-add-product">
          <Link href="/add-product"><Plus className="h-3.5 w-3.5 mr-1" />Add Product</Link>
        </Button>
      </div>

      {/* ── Orders Summary (payment stores only) ─────────── */}
      {paymentActive && (
        <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b">
            <ShoppingCart className="h-4 w-4 text-primary" />
            <p className="text-sm font-bold">Orders Summary</p>
            {orderStats && (
              <span className="ml-auto text-[10px] font-semibold text-muted-foreground">
                {orderStats.totalOrders} total
              </span>
            )}
          </div>
          {orderStats ? (
            <div className="grid grid-cols-2 divide-x divide-y">
              <div className="px-4 py-3 flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <IndianRupee className="h-3 w-3" />
                  <span className="text-[10px] font-medium">Revenue</span>
                </div>
                <p className="text-lg font-extrabold text-foreground">
                  ₹{orderStats.totalRevenueRupees.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="px-4 py-3 flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <ShoppingCart className="h-3 w-3" />
                  <span className="text-[10px] font-medium">Total Orders</span>
                </div>
                <p className="text-lg font-extrabold text-foreground">{orderStats.totalOrders}</p>
              </div>
              <div className="px-4 py-3 flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 text-amber-500">
                  <Clock className="h-3 w-3" />
                  <span className="text-[10px] font-medium">Pending</span>
                </div>
                <p className="text-base font-bold text-amber-500">{orderStats.pendingOrders}</p>
              </div>
              <div className="px-4 py-3 flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 text-green-500">
                  <PackageCheck className="h-3 w-3" />
                  <span className="text-[10px] font-medium">Delivered</span>
                </div>
                <p className="text-base font-bold text-green-500">{orderStats.deliveredOrders}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
              <AlertCircle className="h-8 w-8 opacity-20" />
              <p className="text-xs font-medium">No orders yet</p>
              <p className="text-[11px]">Orders will appear here after customers pay.</p>
            </div>
          )}
        </div>
      )}

      {loading && !analytics ? (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[0,1,2,3].map(i => <Skeleton key={i} className="flex-1 h-[72px] rounded-2xl min-w-[70px]" />)}
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <MiniStat icon={<TrendingUp className="h-3.5 w-3.5" />} label="Clicks"
            value={(analytics?.totalClicks ?? 0).toLocaleString()} color="bg-violet-100 text-violet-600" />
          <MiniStat icon={<ShoppingBag className="h-3.5 w-3.5" />} label="Reviews"
            value={analytics?.totalReviews ?? 0} color="bg-sky-100 text-sky-600" />
          <MiniStat icon={<Package className="h-3.5 w-3.5" />} label="Products"
            value={products.length} color="bg-amber-100 text-amber-600" />
          <MiniStat icon={<Boxes className="h-3.5 w-3.5" />} label="Units"
            value={totalUnits} color="bg-primary/10 text-primary" />
        </div>
      )}

      {loading && !analytics ? (
        <Skeleton className="h-14 w-full rounded-2xl" />
      ) : (
      <div className="bg-card border rounded-2xl px-4 py-3 flex items-center gap-4 overflow-x-auto no-scrollbar" data-testid="inventory-summary">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <div>
            <p className="text-[10px] text-muted-foreground font-medium mb-0.5">In Stock</p>
            <p className="text-sm font-bold text-green-600" data-testid="stat-in-stock">{inStockCount} products</p>
          </div>
        </div>
        <div className="w-px h-8 bg-border shrink-0" />
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <div>
            <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Out of Stock</p>
            <p className="text-sm font-bold text-red-500" data-testid="stat-out-of-stock">{outCount} products</p>
          </div>
        </div>
        <div className="w-px h-8 bg-border shrink-0" />
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <div className="flex items-center gap-1 text-amber-500">
            <Star className="h-3 w-3 fill-amber-400" />
            <span className="text-sm font-bold text-foreground">
              {analytics?.avgRating ?? avgStoreRating}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">avg rating</span>
        </div>
      </div>
      )}

      {/* QR code compact card */}
      {storeUrl && (
        <QrCodeCard storeUrl={storeUrl} storeName={store?.name ?? "store"} compact />
      )}

      <AnalyticsSection liveData={analytics} />
    </div>
  );
}

function MyStorePanel({ store, products, onLogoChange, onStoreChange, editTrigger = 0 }: {
  store: StoreType | null;
  products: Product[];
  onLogoChange: (url: string) => void;
  editTrigger?: number;
  onStoreChange: (updated: StoreType) => void;
}) {
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  /* ── edit store state ── */
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editRazorpayKeyId, setEditRazorpayKeyId] = useState("");
  const [editRazorpaySecret, setEditRazorpaySecret] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editTerms, setEditTerms] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  const openEdit = () => {
    setEditName(store?.name ?? "");
    setEditPhone(store?.whatsapp ?? "");
    setEditLocation(store?.location ?? "");
    setEditCategory(store?.category ?? "");
    setEditRazorpayKeyId(store?.razorpay_key_id ?? "");
    setEditRazorpaySecret("");
    setEditEmail(store?.email ?? "");
    setEditContactPhone(store?.contact_phone ?? "");
    setEditTerms(store?.terms_and_conditions ?? "");
    setShowSecret(false);
    setEditing(true);
  };

  useEffect(() => {
    if (editTrigger > 0) openEdit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTrigger]);

  const handleSaveStore = async () => {
    if (!store?.id) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: editName.trim() || store.name,
        whatsapp: editPhone.trim(),
        location: editLocation.trim(),
        category: editCategory.trim(),
        email: editEmail.trim(),
        contact_phone: editContactPhone.trim(),
        terms_and_conditions: editTerms.trim(),
      };
      if (editRazorpayKeyId.trim()) payload.razorpay_key_id = editRazorpayKeyId.trim();
      if (editRazorpaySecret.trim()) payload.razorpay_key_secret = editRazorpaySecret.trim();
      const hasRazorpay = !!(editRazorpayKeyId.trim() || store.razorpay_key_id);
      payload.razorpay_enabled = hasRazorpay;
      const updated = await updateStore(store.id, payload);
      onStoreChange(updated);
      setEditing(false);
      toast({ title: "Store updated!", description: "Your store details have been saved." });
    } catch {
      toast({ variant: "destructive", title: "Failed to update store", description: "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const storeUrl = store?.slug
    ? `https://store.advize.in/store/${store.slug}`
    : "";

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !store?.id) return;
    setLogoUploading(true);
    try {
      const url = await uploadImage(file);
      await updateStore(store.id, { logo_url: url });
      onLogoChange(url);
      toast({ title: "Logo updated!", description: "Your store logo has been saved." });
    } catch {
      toast({ variant: "destructive", title: "Upload failed", description: "Please try again." });
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  return (
    <div className="pb-28">
      {/* ── Store header card ── */}
      <div className="bg-card border-b px-4 pt-5 pb-4">
        <div className="flex items-center gap-4">
          {/* Tappable logo */}
          <button
            onClick={() => logoInputRef.current?.click()}
            disabled={logoUploading}
            className="relative w-16 h-16 shrink-0 group"
            title="Tap to change logo"
          >
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-primary/10 shadow-sm border flex items-center justify-center text-primary">
              {store?.logo_url ? (
                <img src={store.logo_url} alt={store.name} className="w-full h-full object-cover" />
              ) : (
                <Store className="w-8 h-8" />
              )}
            </div>
            <div className={`absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center transition-opacity ${
              logoUploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}>
              {logoUploading
                ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                : <Camera className="w-4 h-4 text-white" />}
            </div>
          </button>
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />

          <div className="flex-1 min-w-0 pr-8">
            <h2 className="text-lg font-bold text-foreground truncate">{store?.name ?? "My Shop"}</h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {store?.category && (
                <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                  {store.category}
                </span>
              )}
              {store?.location && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                  <MapPin className="h-3 w-3" />{store.location}
                </span>
              )}
            </div>
            {store?.whatsapp && (
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <Phone className="h-3 w-3" />{store.whatsapp}
              </p>
            )}
          </div>
        </div>

        {/* Quick action pills */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-0.5 no-scrollbar">
          {storeUrl && (
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted hover:bg-muted-foreground/15 text-xs font-medium text-foreground shrink-0 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View Store
            </a>
          )}
          <button
            onClick={openEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/15 text-xs font-medium text-primary shrink-0 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit Details
          </button>
        </div>
      </div>

      {/* ── Inline edit store form ── */}
      {editing && (
        <div className="mx-2.5 mt-4 bg-card border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-bold">Edit Store Details</p>
            <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground text-xs underline">Cancel</button>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Store className="h-3.5 w-3.5" /> Store Name</label>
            <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="e.g. My Boutique" className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> WhatsApp Number</label>
            <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="e.g. 919876543210" className="h-11 rounded-xl" type="tel" />
            <p className="text-[11px] text-muted-foreground">Include country code, no + or spaces (e.g. 919876543210)</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> Category</label>
            <Input value={editCategory} onChange={e => setEditCategory(e.target.value)} placeholder="e.g. Clothes, Food, Crafts" className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Location</label>
            <Input value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="e.g. Mumbai, Maharashtra" className="h-11 rounded-xl" />
          </div>

          {/* ── Contact & Legal section ── */}
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-purple-500" />
              <p className="text-sm font-semibold">Contact &amp; Legal Info</p>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">
              Shown in your store's footer. Helps customers reach you and builds trust.
            </p>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Business Email</label>
                <Input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="e.g. shop@example.com" className="h-11 rounded-xl" type="email" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Contact Phone</label>
                <Input value={editContactPhone} onChange={e => setEditContactPhone(e.target.value)} placeholder="e.g. 9876543210" className="h-11 rounded-xl" type="tel" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Terms &amp; Conditions</label>
                <textarea
                  value={editTerms}
                  onChange={e => setEditTerms(e.target.value)}
                  placeholder="Enter your store's terms and conditions, return policy, shipping info, etc."
                  rows={5}
                  className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
                />
              </div>
            </div>
          </div>

          {/* ── Razorpay section ── */}
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="h-4 w-4 text-blue-600" />
              <p className="text-sm font-semibold">Payment Gateway</p>
              {store?.razorpay_key_id && (
                <span className="ml-auto text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">
              Enter your Razorpay keys to enable online payments on your product pages.{" "}
              <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
                Get keys from Razorpay →
              </a>
            </p>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Key ID</label>
                <Input
                  value={editRazorpayKeyId}
                  onChange={e => setEditRazorpayKeyId(e.target.value)}
                  placeholder="rzp_live_xxxxxxxxxxxx"
                  className="h-11 rounded-xl font-mono text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Key Secret {store?.razorpay_key_id ? "(leave blank to keep existing)" : ""}
                </label>
                <div className="relative">
                  <Input
                    value={editRazorpaySecret}
                    onChange={e => setEditRazorpaySecret(e.target.value)}
                    type={showSecret ? "text" : "password"}
                    placeholder={store?.razorpay_key_id ? "••••••••••••••••" : "Enter your secret key"}
                    className="h-11 rounded-xl pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecret ? <Lock className="h-4 w-4" /> : <Lock className="h-4 w-4 opacity-40" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">Your secret key is stored securely and never shown to customers.</p>
              </div>
            </div>
          </div>

          <Button onClick={handleSaveStore} disabled={saving} className="w-full h-11 rounded-xl">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}

      <div className="px-2.5 pt-4 space-y-4">
        {/* Full QR code card */}
        {storeUrl && (
          <QrCodeCard storeUrl={storeUrl} storeName={store?.name ?? "store"} />
        )}

        <div>
          <div className="flex items-center justify-between mb-3 px-0.5">
            <p className="text-sm font-bold">All Products</p>
            <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              {products.length} items
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {products.map(product => (
              <ProductCard key={product.id} product={product} showActions={false} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ListingsPanel({ products, onRefresh, onProductsChange, onDeleteProduct, searchQuery = "", loading = false }: {
  products: Product[];
  onRefresh: () => void;
  onProductsChange: (updated: Product) => void;
  onDeleteProduct: (id: string) => void;
  searchQuery?: string;
  loading?: boolean;
}) {
  const { toast } = useToast();
  const [categoryFilter, setCategoryFilter] = useState("All");

  const categories = ["All", ...Array.from(new Set(products.map(p => (p as any).category).filter(Boolean)))];

  const filtered = products.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q);
    const matchesCategory = categoryFilter === "All" || (p as any).category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleToggleTrending = async (product: Product) => {
    const newVal = !product.trending;
    try {
      await updateProduct(product.id, { trending: newVal } as any);
      onProductsChange({ ...product, trending: newVal });
      toast({
        title: newVal ? "Added to Trending 🔥" : "Removed from Trending",
        description: newVal
          ? `"${product.name}" will appear in the Trending section.`
          : `"${product.name}" removed from Trending.`,
      });
    } catch {
      toast({ variant: "destructive", title: "Failed to update", description: "Please try again." });
    }
  };

  return (
    <div className="pb-28">
      {/* Panel header */}
      <div className="px-3 pt-4 pb-3 border-b bg-card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold">My Listings</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {filtered.length === products.length
                ? `${products.length} products`
                : `${filtered.length} of ${products.length} products`}
            </p>
          </div>
          <Button asChild size="sm" className="rounded-full shadow-sm text-xs" data-testid="btn-add-product-listings">
            <Link href="/add-product"><Plus className="h-3.5 w-3.5 mr-1" />Add New</Link>
          </Button>
        </div>

        {/* Category filter pills */}
        {categories.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition-colors ${
                  categoryFilter === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-3">
        {loading && products.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {[0,1,2,3,4,5].map(i => (
              <div key={i} className="rounded-xl border bg-card overflow-hidden">
                <Skeleton className="aspect-square w-full" />
                <div className="p-2.5 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                  <Skeleton className="h-5 w-1/3 rounded mt-1" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No products yet</p>
            <p className="text-sm mt-1">Add your first product to get started!</p>
            <Button asChild className="mt-4 rounded-full" size="sm">
              <Link href="/add-product"><Plus className="h-3.5 w-3.5 mr-1" />Add Product</Link>
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No results found</p>
            <p className="text-sm mt-1">Try a different search or category</p>
          </div>
        ) : (
          <>
            <p className="text-[10px] text-muted-foreground mb-3 flex items-center gap-1">
              Tap <span className="inline-flex items-center gap-0.5 text-orange-500 font-semibold"><Flame className="h-3 w-3" /> flame</span> to pin a product to the Trending section on your store.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
              {filtered.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  showActions={true}
                  onDelete={() => onDeleteProduct(product.id)}
                  onToggleTrending={() => handleToggleTrending(product)}
                  productHref={`/product/${product.id}?from=dashboard`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Plugins Panel ───────────────────────────────────── */
const BIZ_TYPES = [
  { value: "proprietorship",  label: "Proprietorship" },
  { value: "individual",      label: "Individual" },
  { value: "partnership",     label: "Partnership" },
  { value: "private_limited", label: "Private Limited" },
  { value: "public_limited",  label: "Public Limited" },
  { value: "llp",             label: "LLP" },
  { value: "ngo",             label: "NGO / Trust" },
  { value: "other",           label: "Other" },
];

const BIZ_CATEGORIES = [
  { value: "ecommerce",        sub: "fashion_and_lifestyle",    label: "Fashion & Lifestyle" },
  { value: "ecommerce",        sub: "beauty_and_personal_care", label: "Beauty & Personal Care" },
  { value: "ecommerce",        sub: "electronics",              label: "Electronics" },
  { value: "ecommerce",        sub: "home_furnishings",         label: "Home & Furniture" },
  { value: "ecommerce",        sub: "grocery",                  label: "Grocery" },
  { value: "ecommerce",        sub: "books_and_stationery",     label: "Books & Stationery" },
  { value: "ecommerce",        sub: "health_and_wellness",      label: "Health & Wellness" },
  { value: "food",             sub: "online_food_ordering",     label: "Food & Beverages" },
  { value: "education",        sub: "education",                label: "Education" },
  { value: "healthcare",       sub: "pharmacy",                 label: "Healthcare / Pharmacy" },
  { value: "ecommerce",        sub: "general_merchandise",      label: "General / Other" },
];

const ACCOUNT_STATUS_LABEL: Record<string, string> = {
  created:   "Account Created — KYC Pending",
  activated: "Active",
  suspended: "Suspended",
  under_review: "Under Review",
  needs_clarification: "Needs Clarification",
};

function PluginsPanel({ store, onStoreChange }: { store: StoreType | null; onStoreChange: (updated: StoreType) => void }) {
  const { toast } = useToast();
  const hasAccount    = !!(store?.razorpay_account_id);
  const legacyKeys    = !!(store?.razorpay_key_id) && !hasAccount;
  const advizeEnabled = !!(store?.advize_payment_enabled);

  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [showOnboard, setShowOnboard]       = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [savingAdvize, setSavingAdvize]     = useState(false);

  const handleToggleAdvize = async () => {
    if (!store?.id) return;
    setSavingAdvize(true);
    try {
      const updated = await updateStore(store.id, { advize_payment_enabled: !advizeEnabled });
      onStoreChange(updated);
      toast({ title: advizeEnabled ? "Advize Payment disabled" : "Advize Payment enabled!" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err.message ?? "Please try again." });
    } finally {
      setSavingAdvize(false);
    }
  };

  const [bizName,    setBizName]    = useState("");
  const [contactName, setContactName] = useState("");
  const [bizType,    setBizType]    = useState("proprietorship");
  const [email,      setEmail]      = useState("");
  const [phone,      setPhone]      = useState("");
  const [pan,        setPan]        = useState("");
  const [catIndex,   setCatIndex]   = useState(0);
  const [street,     setStreet]     = useState("");
  const [city,       setCity]       = useState("");
  const [bizState,   setBizState]   = useState("");
  const [pincode,    setPincode]    = useState("");

  const openOnboard = () => {
    setBizName(store?.name ?? "");
    setContactName("");
    setBizType("proprietorship");
    setEmail("");
    setPhone("");
    setPan("");
    setCatIndex(0);
    setStreet("");
    setCity("");
    setBizState("");
    setPincode("");
    setShowOnboard(true);
  };

  const handleOnboard = async () => {
    if (!store?.id) return;
    if (!bizName.trim() || !contactName.trim() || !email.trim() ||
        !phone.trim() || !pan.trim() || !city.trim() || !bizState.trim() || !pincode.trim()) {
      toast({ variant: "destructive", title: "Please fill all required fields" });
      return;
    }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(pan.trim())) {
      toast({ variant: "destructive", title: "Invalid PAN", description: "PAN should be like ABCDE1234F" });
      return;
    }
    const cat = BIZ_CATEGORIES[catIndex];
    setSaving(true);
    try {
      const result = await onboardRazorpay({
        store_id:             store.id,
        legal_business_name:  bizName.trim(),
        contact_name:         contactName.trim(),
        business_type:        bizType,
        email:                email.trim(),
        phone:                phone.trim(),
        pan:                  pan.trim().toUpperCase(),
        category:             cat.value,
        subcategory:          cat.sub,
        street1:              street.trim() || city.trim(),
        city:                 city.trim(),
        state:                bizState.trim(),
        postal_code:          pincode.trim(),
      });
      onStoreChange({ ...store, razorpay_account_id: result.account_id, razorpay_account_status: result.status });
      setShowOnboard(false);
      toast({
        title: "Razorpay Account Created! 🎉",
        description: `Account ID: ${result.account_id}. Razorpay will guide you through KYC to activate payments.`,
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Connection Failed", description: err.message ?? "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 pb-28">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="bg-primary/10 p-1.5 rounded-xl">
            <Puzzle className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Plugins</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-10">
          Extend your store with powerful add-ons.
        </p>
      </div>

      {/* Plugin cards */}
      <div className="flex flex-col gap-4">

        {/* ── Payment Gateway (accordion) ── */}
        <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
          {/* Header row – click to expand */}
          <button
            className="w-full p-5 flex gap-4 items-center text-left"
            onClick={() => setShowPaymentOptions(p => !p)}
          >
            <div className={`p-3 rounded-xl flex-shrink-0 ${advizeEnabled || hasAccount ? "bg-green-50 dark:bg-green-950/40" : "bg-primary/10"}`}>
              <CreditCard className={`h-6 w-6 ${advizeEnabled || hasAccount ? "text-green-600 dark:text-green-400" : "text-primary"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <h3 className="text-base font-semibold text-foreground leading-tight">Payment Gateway</h3>
                {advizeEnabled ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">Advize Active</span>
                ) : hasAccount ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">Razorpay Connected</span>
                ) : legacyKeys ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">Razorpay Legacy</span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Not set up</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">Choose how to accept payments in your store</p>
            </div>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 flex-shrink-0 ${showPaymentOptions ? "rotate-180" : ""}`} />
          </button>

          {/* Expanded: both options */}
          {showPaymentOptions && (
            <div className="border-t divide-y">

              {/* Option 1: Advize Payment */}
              <div className="p-5">
                <div className="flex gap-4 items-start">
                  <div className={`p-3 rounded-xl flex-shrink-0 ${advizeEnabled ? "bg-green-50 dark:bg-green-950/40" : "bg-primary/10"}`}>
                    <Zap className={`h-6 w-6 ${advizeEnabled ? "text-green-600 dark:text-green-400" : "text-primary"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-sm font-semibold text-foreground leading-tight">Advize Payment</h3>
                      {advizeEnabled ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">Active</span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">Recommended</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                      Accept UPI, cards &amp; wallets with Advize's built-in payment solution. No setup or API keys needed.
                    </p>
                    <button
                      onClick={handleToggleAdvize}
                      disabled={savingAdvize}
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 ${
                        advizeEnabled
                          ? "bg-muted text-muted-foreground hover:bg-muted/80"
                          : "bg-primary hover:bg-primary/90 text-primary-foreground"
                      }`}
                    >
                      {savingAdvize
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : advizeEnabled
                          ? "Disable"
                          : <><Zap className="h-3.5 w-3.5" /> Enable</>
                      }
                    </button>
                  </div>
                </div>
              </div>

              {/* Option 2: Razorpay */}
              <div>
                <div className="p-5">
                  <div className="flex gap-4 items-start">
                    <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-xl flex-shrink-0">
                      <CreditCard className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-sm font-semibold text-foreground leading-tight">Razorpay</h3>
                        {hasAccount ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">Connected</span>
                        ) : legacyKeys ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">Legacy</span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">Available</span>
                        )}
                      </div>

                      {hasAccount ? (
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {ACCOUNT_STATUS_LABEL[store?.razorpay_account_status ?? ""] ?? "Account created."}
                          </p>
                          <p className="text-[11px] font-mono text-muted-foreground/60 truncate">
                            {store?.razorpay_account_id}
                          </p>
                          <a
                            href="https://dashboard.razorpay.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block text-xs font-semibold text-primary underline underline-offset-2 mt-1"
                          >
                            Complete KYC on Razorpay →
                          </a>
                        </div>
                      ) : legacyKeys ? (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            You're using your own Razorpay API keys. Upgrade to the Partner flow for a seamless, no-API-key experience.
                          </p>
                          {!showOnboard && (
                            <button
                              onClick={openOnboard}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              Upgrade to Partner Flow
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Connect your Razorpay account to accept UPI, cards &amp; wallets with your own keys.
                          </p>
                          {!showOnboard && (
                            <button
                              onClick={openOnboard}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              Connect Razorpay
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Partner onboarding form */}
                {showOnboard && (
                  <div className="border-t bg-muted/30 px-5 py-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Business Details</p>
                      <button
                        onClick={() => setShowOnboard(false)}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        Cancel
                      </button>
                    </div>

                    <p className="text-[11px] text-muted-foreground -mt-2">
                      Razorpay will verify your business and handle KYC — no manual API keys needed.
                    </p>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Legal Business Name *</label>
                      <Input value={bizName} onChange={e => setBizName(e.target.value)}
                        placeholder="e.g. Acme Traders" className="h-10 rounded-xl text-sm bg-background" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Contact Name (Owner / Director) *</label>
                      <Input value={contactName} onChange={e => setContactName(e.target.value)}
                        placeholder="Full name" className="h-10 rounded-xl text-sm bg-background" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Business Type *</label>
                        <select
                          value={bizType}
                          onChange={e => setBizType(e.target.value)}
                          className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {BIZ_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Category *</label>
                        <select
                          value={catIndex}
                          onChange={e => setCatIndex(Number(e.target.value))}
                          className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {BIZ_CATEGORIES.map((c, i) => <option key={i} value={i}>{c.label}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Business Email *</label>
                        <Input value={email} onChange={e => setEmail(e.target.value)}
                          type="email" placeholder="you@business.com"
                          className="h-10 rounded-xl text-sm bg-background" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Phone *</label>
                        <Input value={phone} onChange={e => setPhone(e.target.value)}
                          type="tel" placeholder="9876543210"
                          className="h-10 rounded-xl text-sm bg-background" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">PAN Number *</label>
                      <Input value={pan} onChange={e => setPan(e.target.value.toUpperCase())}
                        placeholder="ABCDE1234F" maxLength={10}
                        className="h-10 rounded-xl font-mono text-sm bg-background tracking-widest"
                        autoCorrect="off" autoCapitalize="characters" />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Street Address</label>
                      <Input value={street} onChange={e => setStreet(e.target.value)}
                        placeholder="Shop / flat / street" className="h-10 rounded-xl text-sm bg-background" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">City *</label>
                        <Input value={city} onChange={e => setCity(e.target.value)}
                          placeholder="Mumbai" className="h-10 rounded-xl text-sm bg-background" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">State *</label>
                        <Input value={bizState} onChange={e => setBizState(e.target.value)}
                          placeholder="Maharashtra" className="h-10 rounded-xl text-sm bg-background" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">PIN Code *</label>
                      <Input value={pincode} onChange={e => setPincode(e.target.value)}
                        placeholder="400001" maxLength={6} inputMode="numeric"
                        className="h-10 rounded-xl text-sm bg-background" />
                    </div>

                    <Button
                      onClick={handleOnboard}
                      disabled={saving}
                      className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white border-transparent"
                    >
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {saving ? "Creating Account..." : "Connect Razorpay"}
                    </Button>

                    <p className="text-[10px] text-muted-foreground text-center">
                      Razorpay will send a KYC link to your email after account creation.
                    </p>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {/* ── Custom Domain ── */}
        <div className="bg-card border rounded-2xl p-5 flex gap-4 items-start shadow-sm opacity-75">
          <div className="bg-violet-50 dark:bg-violet-950/40 p-3 rounded-xl flex-shrink-0">
            <Globe className="h-6 w-6 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-base font-semibold text-foreground leading-tight">Custom Domain</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                Coming Soon
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Use your own branded domain like mystore.com instead of the default Advize link.
            </p>
          </div>
          <div className="flex-shrink-0 mt-0.5">
            <Lock className="h-4 w-4 text-muted-foreground/50" />
          </div>
        </div>

        {/* ── Dropshipping ── */}
        <div className="bg-card border rounded-2xl p-5 flex gap-4 items-start shadow-sm opacity-75">
          <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl flex-shrink-0">
            <Truck className="h-6 w-6 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-base font-semibold text-foreground leading-tight">Import Dropshipping Products</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                Coming Soon
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Source and import products from suppliers — sell without holding any inventory.
            </p>
          </div>
          <div className="flex-shrink-0 mt-0.5">
            <Lock className="h-4 w-4 text-muted-foreground/50" />
          </div>
        </div>

        {/* ── Print on Demand ── */}
        <div className="bg-card border rounded-2xl p-5 flex gap-4 items-start shadow-sm opacity-75">
          <div className="bg-pink-50 dark:bg-pink-950/40 p-3 rounded-xl flex-shrink-0">
            <Printer className="h-6 w-6 text-pink-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-base font-semibold text-foreground leading-tight">Print on Demand Products</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300">
                Coming Soon
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Sell custom-printed t-shirts, mugs, hoodies & more — products are printed and shipped only when an order is placed, so you carry zero inventory.
            </p>
          </div>
          <div className="flex-shrink-0 mt-0.5">
            <Lock className="h-4 w-4 text-muted-foreground/50" />
          </div>
        </div>

        {/* ── Delivery Partners ── */}
        <div className="bg-card border rounded-2xl p-5 flex gap-4 items-start shadow-sm opacity-75">
          <div className="bg-green-50 dark:bg-green-950/40 p-3 rounded-xl flex-shrink-0">
            <Bike className="h-6 w-6 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-base font-semibold text-foreground leading-tight">Delivery Partners</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                Coming Soon
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Connect with Dunzo, Porter, Shiprocket & more to offer fast local and national delivery to your customers.
            </p>
          </div>
          <div className="flex-shrink-0 mt-0.5">
            <Lock className="h-4 w-4 text-muted-foreground/50" />
          </div>
        </div>

        {/* ── Custom Templates ── */}
        <div className="bg-card border rounded-2xl p-5 flex gap-4 items-start shadow-sm opacity-75">
          <div className="bg-teal-50 dark:bg-teal-950/40 p-3 rounded-xl flex-shrink-0">
            <Sparkles className="h-6 w-6 text-teal-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-base font-semibold text-foreground leading-tight">Custom Templates</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300">
                Coming Soon
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Choose from beautiful storefront templates to give your shop a unique look and feel.
            </p>
          </div>
          <div className="flex-shrink-0 mt-0.5">
            <Lock className="h-4 w-4 text-muted-foreground/50" />
          </div>
        </div>

      </div>

    </div>
  );
}

/* ── Settings Panel ──────────────────────────────────── */
function SettingsRow({
  icon, label, description, right, onClick, danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`w-full flex items-center gap-3.5 px-4 py-3.5 transition-colors text-left
        ${onClick ? "hover:bg-muted/60 active:bg-muted cursor-pointer" : "cursor-default"}
        ${danger ? "text-destructive" : ""}`}
    >
      <div className={`shrink-0 ${danger ? "text-destructive" : "text-muted-foreground"}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-tight ${danger ? "text-destructive" : "text-foreground"}`}>
          {label}
        </p>
        {description && (
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{description}</p>
        )}
      </div>
      {right !== undefined ? (
        <div className="shrink-0">{right}</div>
      ) : onClick ? (
        <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
      ) : null}
    </button>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-4 py-2">
        {title}
      </p>
      <div className="bg-card border rounded-2xl overflow-hidden divide-y">
        {children}
      </div>
    </div>
  );
}

function SettingsPanel({
  store,
  onTabChange,
  onEditStore,
}: {
  store: StoreType | null;
  onTabChange: (index: number) => void;
  onEditStore: () => void;
}) {
  const { dark, toggle: toggleDark } = useTheme();
  const { user, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [whatsappNotif, setWhatsappNotif] = useState<boolean>(() => {
    try { return localStorage.getItem("notif_whatsapp") !== "false"; } catch { return true; }
  });
  const [orderEmailNotif, setOrderEmailNotif] = useState<boolean>(() => {
    try { return localStorage.getItem("notif_order_email") === "true"; } catch { return false; }
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleWhatsappNotif = (val: boolean) => {
    setWhatsappNotif(val);
    localStorage.setItem("notif_whatsapp", val ? "true" : "false");
  };
  const handleOrderEmailNotif = (val: boolean) => {
    setOrderEmailNotif(val);
    localStorage.setItem("notif_order_email", val ? "true" : "false");
  };

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  const initials = (user?.displayName ?? user?.email ?? "U")
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 pb-28">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="bg-primary/10 p-1.5 rounded-xl">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-10">
          Manage your account and app preferences.
        </p>
      </div>

      {/* ── Account ── */}
      <div className="bg-card border rounded-2xl p-4 flex items-center gap-4 mb-4">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-lg font-extrabold text-primary">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          {user?.displayName && (
            <p className="text-base font-bold text-foreground truncate">{user.displayName}</p>
          )}
          <p className="text-sm text-muted-foreground truncate">{user?.email ?? "—"}</p>
          {store && (
            <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">
              store.advize.in/store/{store.slug}
            </p>
          )}
        </div>
      </div>

      {/* ── Store ── */}
      <SettingsSection title="Store">
        <SettingsRow
          icon={<Store className="h-4 w-4" />}
          label="Edit Store Profile"
          description="Name, logo, WhatsApp, location & more"
          onClick={onEditStore}
        />
        <SettingsRow
          icon={<ListOrdered className="h-4 w-4" />}
          label="Manage Listings"
          description="Add, edit or remove your products"
          onClick={() => onTabChange(2)}
        />
        <SettingsRow
          icon={<Puzzle className="h-4 w-4" />}
          label="Plugins & Integrations"
          description="Payments, delivery, print on demand"
          onClick={() => onTabChange(3)}
        />
      </SettingsSection>

      {/* ── Appearance ── */}
      <SettingsSection title="Appearance">
        <SettingsRow
          icon={dark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          label={dark ? "Light Mode" : "Dark Mode"}
          description={dark ? "Switch to a bright theme" : "Switch to a dark theme"}
          right={
            <Switch
              checked={dark}
              onCheckedChange={toggleDark}
              onClick={e => e.stopPropagation()}
            />
          }
        />
        <SettingsRow
          icon={<Sparkles className="h-4 w-4" />}
          label="Theme Color"
          description="Custom accent colors — coming soon"
          right={
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              Soon
            </span>
          }
        />
      </SettingsSection>

      {/* ── Notifications ── */}
      <SettingsSection title="Notifications">
        <SettingsRow
          icon={<Bell className="h-4 w-4" />}
          label="WhatsApp Order Alerts"
          description="Get notified when a customer places an order"
          right={
            <Switch
              checked={whatsappNotif}
              onCheckedChange={handleWhatsappNotif}
              onClick={e => e.stopPropagation()}
            />
          }
        />
        <SettingsRow
          icon={<Mail className="h-4 w-4" />}
          label="Email Order Summary"
          description="Daily summary of orders sent to your email"
          right={
            <Switch
              checked={orderEmailNotif}
              onCheckedChange={handleOrderEmailNotif}
              onClick={e => e.stopPropagation()}
            />
          }
        />
      </SettingsSection>

      {/* ── Privacy & Legal ── */}
      <SettingsSection title="Privacy & Legal">
        <SettingsRow
          icon={<Shield className="h-4 w-4" />}
          label="Privacy Policy"
          description="How we handle your data"
          onClick={() => window.open("/terms", "_blank")}
        />
        <SettingsRow
          icon={<FileText className="h-4 w-4" />}
          label="Terms & Conditions"
          description="Platform rules and usage policies"
          onClick={() => window.open("/terms", "_blank")}
        />
      </SettingsSection>

      {/* ── Support ── */}
      <SettingsSection title="Support">
        <SettingsRow
          icon={<HelpCircle className="h-4 w-4" />}
          label="Help & FAQ"
          description="Common questions and how-tos"
          onClick={() => {
            toast({ title: "Help center coming soon!", description: "Reach us on WhatsApp for now." });
          }}
        />
        <SettingsRow
          icon={<Mail className="h-4 w-4" />}
          label="Contact Support"
          description="support@advize.in"
          onClick={() => window.open("mailto:support@advize.in")}
        />
      </SettingsSection>

      {/* ── About ── */}
      <SettingsSection title="About">
        <SettingsRow
          icon={<Store className="h-4 w-4" />}
          label="Advize Store Builder"
          description="Version 1.0.0 · store.advize.in"
          right={null}
        />
      </SettingsSection>

      {/* ── Account actions ── */}
      <SettingsSection title="Account">
        <SettingsRow
          icon={<LogOut className="h-4 w-4" />}
          label="Sign Out"
          description="Sign out of your account"
          onClick={handleSignOut}
        />
        {!showDeleteConfirm ? (
          <SettingsRow
            icon={<Trash2 className="h-4 w-4" />}
            label="Delete Account"
            description="Permanently remove your store and data"
            onClick={() => setShowDeleteConfirm(true)}
            danger
          />
        ) : (
          <div className="px-4 py-4 flex flex-col gap-2">
            <p className="text-sm text-destructive font-semibold">Are you sure?</p>
            <p className="text-xs text-muted-foreground">
              This will permanently delete your store and all products. This cannot be undone.
            </p>
            <div className="flex gap-2 mt-1">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 rounded-full text-xs"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1 rounded-full text-xs bg-destructive hover:bg-destructive/90 text-white border-transparent"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  toast({ title: "Coming soon", description: "Account deletion will be available soon. Contact support@advize.in for immediate requests." });
                }}
              >
                Delete Account
              </Button>
            </div>
          </div>
        )}
      </SettingsSection>
    </div>
  );
}

/* ── Earnings / Payments panel ───────────────────────── */
function EarningsPanel({ store, orderStats, onStatusChange }: {
  store: StoreType | null;
  orderStats: OrderStats | null;
  onStatusChange: (orderId: string, status: OrderStatus) => void;
}) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const advizeEnabled = !!(store?.advize_payment_enabled);
  const allOrders = orderStats?.orders ?? [];
  const advizeOrders = allOrders.filter(o => o.payment_method === "advize");
  const filtered = filter === "all" ? advizeOrders : advizeOrders.filter(o => o.status === filter);

  const totalCollected = advizeOrders
    .filter(o => o.payment_status === "paid")
    .reduce((s, o) => s + (o.amount_paise ?? 0), 0) / 100;

  const FILTER_TABS = [
    { key: "all",       label: "All",       count: advizeOrders.length },
    { key: "pending",   label: "Pending",   count: advizeOrders.filter(o => o.status === "pending").length },
    { key: "confirmed", label: "Confirmed", count: advizeOrders.filter(o => o.status === "confirmed").length },
    { key: "delivered", label: "Delivered", count: advizeOrders.filter(o => o.status === "delivered").length },
  ] as const;

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      await updateOrderStatus(orderId, newStatus as OrderStatus);
      onStatusChange(orderId, newStatus as OrderStatus);
    } catch {
      toast({ variant: "destructive", title: "Failed to update status" });
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (ts: any): string => {
    if (!ts) return "–";
    const d = ts?.toDate ? ts.toDate() : new Date(ts?.seconds ? ts.seconds * 1000 : ts);
    if (isNaN(d.getTime())) return "–";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const STATUS_COLORS: Record<string, string> = {
    pending:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    delivered: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 pb-28">
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold">Earnings</h1>
          <p className="text-muted-foreground text-xs mt-0.5">Orders paid through Advize Payment</p>
        </div>
      </div>

      {!advizeEnabled ? (
        <div className="bg-card border rounded-2xl p-8 flex flex-col items-center text-center gap-3">
          <div className="bg-primary/10 p-4 rounded-2xl">
            <IndianRupee className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="font-bold text-foreground">Advize Payment not enabled</p>
            <p className="text-sm text-muted-foreground mt-1">
              Enable Advize Payment in the Plugins tab to start accepting payments and track your earnings here.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border rounded-2xl p-4 shadow-sm col-span-2">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <IndianRupee className="h-3.5 w-3.5" />
                <span className="text-[10px] font-medium uppercase tracking-wide">Total Collected</span>
              </div>
              <p className="text-3xl font-extrabold text-foreground">₹{totalCollected.toLocaleString("en-IN")}</p>
            </div>
            <div className="bg-card border rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <ShoppingCart className="h-3.5 w-3.5" />
                <span className="text-[10px] font-medium uppercase tracking-wide">Orders</span>
              </div>
              <p className="text-2xl font-extrabold text-foreground">{advizeOrders.length}</p>
            </div>
            <div className="bg-card border rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-1.5 text-amber-500 mb-1">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-[10px] font-medium uppercase tracking-wide">Pending</span>
              </div>
              <p className="text-2xl font-extrabold text-amber-500">
                {advizeOrders.filter(o => o.status === "pending").length}
              </p>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  filter === tab.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {tab.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  filter === tab.key ? "bg-white/20 text-white" : "bg-background text-foreground"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Orders list */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <ShoppingCart className="h-10 w-10 opacity-20" />
              <p className="text-sm font-medium">No orders yet</p>
              <p className="text-xs opacity-60">
                {filter === "all"
                  ? "Orders placed through Advize Payment will appear here."
                  : `No ${filter} orders.`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(order => (
                <div key={order.id} className="bg-card border rounded-2xl p-4 shadow-sm space-y-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-[10px] font-mono text-muted-foreground/60">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{formatDate(order.created_at)}</span>
                      </div>
                      <p className="text-sm font-bold text-foreground">{order.buyer?.name ?? "–"}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.buyer?.phone ? `+91 ${order.buyer.phone}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-extrabold text-foreground">
                        ₹{Math.round((order.amount_paise ?? 0) / 100).toLocaleString("en-IN")}
                      </p>
                      <span className={`text-[10px] font-bold ${
                        order.payment_status === "paid"
                          ? "text-green-600 dark:text-green-400"
                          : order.payment_status === "failed"
                            ? "text-red-500"
                            : "text-amber-500"
                      }`}>
                        {order.payment_status === "paid" ? "Paid" : order.payment_status === "failed" ? "Failed" : "Pending payment"}
                      </span>
                    </div>
                  </div>

                  {/* Items */}
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {order.items?.map(i => `${i.name} ×${i.quantity}`).join(" · ") ?? "–"}
                  </p>

                  {/* Address + status change */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t">
                    <p className="text-[11px] text-muted-foreground truncate flex-1">
                      {order.buyer?.addressLine
                        ? `${order.buyer.addressLine}, ${order.buyer.city} – ${order.buyer.pincode}`
                        : "–"}
                    </p>
                    <select
                      value={order.status}
                      disabled={updatingId === order.id}
                      onChange={e => handleStatusChange(order.id, e.target.value)}
                      className={`text-[11px] font-bold px-2 py-1 rounded-lg border-0 outline-none cursor-pointer shrink-0 transition-colors ${STATUS_COLORS[order.status] ?? ""}`}
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── main layout ─────────────────────────────────────── */
const TABS = [
  { label: "Home",       icon: LayoutDashboard },
  { label: "My Store",   icon: Store           },
  { label: "Listings",   icon: ListOrdered     },
  { label: "Plugins",    icon: Puzzle          },
  { label: "Earnings",   icon: IndianRupee     },
] as const;

export function DashboardPage() {
  const search = useSearch();
  const initialTab = Math.min(parseInt(new URLSearchParams(search).get("tab") ?? "0") || 0, TABS.length - 1);
  const [active, setActive] = useState(initialTab);
  const prevActive = useRef(initialTab);
  const touchStartX = useRef<number | null>(null);
  const panelScrollTops = useRef<number[]>([0, 0, 0, 0, 0]);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null, null]);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const { dark, toggle: toggleDark } = useTheme();
  const { store, loading: storeLoading, setStore } = useStore();
  const { signOut } = useAuth();
  const [, setLocation] = useLocation();

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };
  const [products, setProducts] = useState<Product[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [storeEditTrigger, setStoreEditTrigger] = useState(0);

  const loadData = useCallback(async (storeId: string) => {
    setDataLoading(true);
    try {
      const [prods, anal] = await Promise.all([
        getProducts(storeId),
        getAnalytics(storeId),
      ]);
      setProducts(prods);
      setAnalytics(anal);
    } catch {
      // silent — show empty state
    } finally {
      setDataLoading(false);
    }
    // order stats fetched independently so any failure doesn't break products
    getOrderStats(storeId).then(setOrderStats).catch(() => {});
  }, []);

  const handleOrderStatusChange = useCallback((orderId: string, newStatus: OrderStatus) => {
    setOrderStats(prev => {
      if (!prev) return prev;
      const update = (o: Order) => o.id === orderId ? { ...o, status: newStatus } : o;
      const updatedOrders = prev.orders.map(update);
      return {
        ...prev,
        orders: updatedOrders,
        recentOrders: prev.recentOrders.map(update),
        pendingOrders:   updatedOrders.filter(o => o.status === "pending").length,
        confirmedOrders: updatedOrders.filter(o => o.status === "confirmed").length,
        deliveredOrders: updatedOrders.filter(o => o.status === "delivered").length,
        cancelledOrders: updatedOrders.filter(o => o.status === "cancelled").length,
      };
    });
  }, []);

  useEffect(() => {
    if (store?.id) {
      loadData(store.id);
    }
  }, [store?.id, loadData]);

  // Hide Earnings tab if Advize Payment is disabled
  const advizeEnabled = !!(store?.advize_payment_enabled);
  const visibleTabs = TABS.filter((_, i) => i !== 4 || advizeEnabled);

  useEffect(() => {
    if (!advizeEnabled && active === 4) setActive(0);
  }, [advizeEnabled, active]);

  // Save old tab scroll → restore new tab scroll
  useEffect(() => {
    const prev = prevActive.current;
    if (prev !== active) {
      // save scroll of the panel we're leaving
      const leaving = panelRefs.current[prev];
      if (leaving) panelScrollTops.current[prev] = leaving.scrollTop;
    }
    // restore scroll of the panel we're entering (after paint)
    requestAnimationFrame(() => {
      const entering = panelRefs.current[active];
      if (entering) entering.scrollTop = panelScrollTops.current[active];
    });
    prevActive.current = active;
  }, [active]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) < 50) return;
    if (delta > 0) setActive(p => Math.min(p + 1, visibleTabs.length > 0 ? TABS.indexOf(visibleTabs[visibleTabs.length - 1]) : TABS.length - 1));
    else           setActive(p => Math.max(p - 1, 0));
    touchStartX.current = null;
  };

  const isLoading = storeLoading && !store;

  return (
    <div className="h-[100dvh] flex flex-col bg-muted/10 overflow-hidden">

      {/* ── Settings Sheet ─────────────────────────────────── */}
      <Sheet open={showSettings} onOpenChange={setShowSettings}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 overflow-y-auto">
          <SheetTitle className="sr-only">Settings</SheetTitle>
          <SettingsPanel
            store={store}
            onTabChange={(i) => { setShowSettings(false); setActive(i); }}
            onEditStore={() => { setShowSettings(false); setActive(1); setStoreEditTrigger(t => t + 1); }}
          />
        </SheetContent>
      </Sheet>

      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container max-w-5xl mx-auto flex h-14 items-center justify-between px-4">

          {/* Logo — opens dropdown with Settings / Dark Mode / Sign Out */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl hover:bg-muted/60 px-1 py-1 transition-colors -ml-1 outline-none">
              <div className="bg-primary/10 p-1.5 rounded-xl overflow-hidden w-7 h-7 flex items-center justify-center shrink-0">
                {store?.logo_url
                  ? <img src={store.logo_url} alt={store.name} className="w-full h-full object-cover" />
                  : <Store className="h-4 w-4 text-primary" />}
              </div>
              <span className="text-base font-bold text-foreground">
                {store?.name ?? "My Shop"}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuItem onClick={() => setShowSettings(true)} className="gap-2.5">
                <Settings className="h-4 w-4 text-muted-foreground" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={toggleDark} className="gap-2.5">
                {dark
                  ? <Sun className="h-4 w-4 text-amber-400" />
                  : <Moon className="h-4 w-4 text-muted-foreground" />}
                {dark ? "Light mode" : "Dark mode"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="gap-2.5 text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Search input — tablet + desktop */}
          <div className="hidden sm:flex flex-1 max-w-xs mx-3 lg:max-w-sm relative items-center">
            <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); if (e.target.value) setActive(2); }}
              placeholder="Search products..."
              className="w-full h-9 pl-9 pr-8 rounded-full bg-muted text-sm text-foreground placeholder:text-muted-foreground border-0 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Tablet tab pills (sm → lg) */}
          <div className="hidden sm:flex lg:hidden items-center gap-1 bg-muted rounded-full p-1 shrink-0">
            {visibleTabs.map((tab) => {
              const i = TABS.indexOf(tab);
              return (
                <button
                  key={tab.label}
                  onClick={() => setActive(i)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    active === i
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Mobile: search icon toggle */}
          <button
            className="sm:hidden flex items-center justify-center w-9 h-9 rounded-full hover:bg-muted transition-colors"
            onClick={() => setShowMobileSearch(p => !p)}
            aria-label="Search"
          >
            {showMobileSearch
              ? <X className="h-4 w-4 text-muted-foreground" />
              : <Search className="h-4 w-4 text-muted-foreground" />}
          </button>
        </div>

        {/* Mobile search bar */}
        {showMobileSearch && (
          <div className="sm:hidden px-4 pb-2.5 pt-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                autoFocus
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); if (e.target.value) setActive(2); }}
                placeholder="Search products..."
                className="w-full h-9 pl-9 pr-8 rounded-full bg-muted text-sm text-foreground placeholder:text-muted-foreground border-0 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Mobile dot nav */}
        {!showMobileSearch && (
          <div className="flex sm:hidden justify-center gap-1.5 pb-2">
            {visibleTabs.map((_, idx) => {
              const i = TABS.indexOf(visibleTabs[idx]);
              return (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`rounded-full transition-all duration-300 ${
                    active === i ? "w-5 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-muted-foreground/30"
                  }`}
                />
              );
            })}
          </div>
        )}
      </header>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex">

          {/* ── Desktop sidebar ────────────────────────────────── */}
          <aside className="hidden lg:flex flex-col w-56 border-r bg-background/60 shrink-0">
            <div className="flex-1 py-4 flex flex-col gap-0.5">
              {visibleTabs.map((tab) => {
                const i = TABS.indexOf(tab);
                const Icon = tab.icon;
                const isActive = active === i;
                return (
                  <button
                    key={tab.label}
                    onClick={() => setActive(i)}
                    className={`flex items-center gap-3 mx-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <div className="border-t mx-3 pt-3 pb-4 flex flex-col gap-0.5">
              <button
                onClick={toggleDark}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                {dark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
                {dark ? "Light mode" : "Dark mode"}
              </button>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-destructive hover:bg-muted transition-all"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </aside>

          {/* ── Mobile: swipeable carousel ─────────────────────── */}
          <div
            className="lg:hidden flex-1 overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className="flex h-full transition-transform duration-300 ease-in-out"
              style={{ transform: `translateX(-${active * 100}%)` }}
            >
              <div ref={el => { panelRefs.current[0] = el; }} className="w-full flex-shrink-0 h-full overflow-y-auto">
                <HomePanel products={products} analytics={analytics} store={store} orderStats={orderStats} loading={dataLoading} />
              </div>
              <div ref={el => { panelRefs.current[1] = el; }} className="w-full flex-shrink-0 h-full overflow-y-auto">
                <MyStorePanel
                  store={store}
                  products={products}
                  onLogoChange={(url) => setStore(prev => prev ? { ...prev, logo_url: url } : prev)}
                  onStoreChange={(updated) => setStore(updated)}
                  editTrigger={storeEditTrigger}
                />
              </div>
              <div ref={el => { panelRefs.current[2] = el; }} className="w-full flex-shrink-0 h-full overflow-y-auto">
                <ListingsPanel
                  products={products}
                  onRefresh={() => store?.id && loadData(store.id)}
                  onProductsChange={(updated) =>
                    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p))
                  }
                  onDeleteProduct={(id) =>
                    setProducts(prev => prev.filter(p => p.id !== id))
                  }
                  searchQuery={searchQuery}
                  loading={dataLoading}
                />
              </div>
              <div ref={el => { panelRefs.current[3] = el; }} className="w-full flex-shrink-0 h-full overflow-y-auto">
                <PluginsPanel store={store} onStoreChange={(updated) => setStore(updated)} />
              </div>
              <div ref={el => { panelRefs.current[4] = el; }} className="w-full flex-shrink-0 h-full overflow-y-auto">
                <EarningsPanel store={store} orderStats={orderStats} onStatusChange={handleOrderStatusChange} />
              </div>
            </div>
          </div>

          {/* ── Desktop: active panel (no carousel) ────────────── */}
          <div className="hidden lg:flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {active === 0 && <HomePanel products={products} analytics={analytics} store={store} orderStats={orderStats} loading={dataLoading} />}
              {active === 1 && (
                <MyStorePanel
                  store={store}
                  products={products}
                  onLogoChange={(url) => setStore(prev => prev ? { ...prev, logo_url: url } : prev)}
                  onStoreChange={(updated) => setStore(updated)}
                  editTrigger={storeEditTrigger}
                />
              )}
              {active === 2 && (
                <ListingsPanel
                  products={products}
                  onRefresh={() => store?.id && loadData(store.id)}
                  onProductsChange={(updated) =>
                    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p))
                  }
                  onDeleteProduct={(id) =>
                    setProducts(prev => prev.filter(p => p.id !== id))
                  }
                  searchQuery={searchQuery}
                  loading={dataLoading}
                />
              )}
              {active === 3 && <PluginsPanel store={store} onStoreChange={(updated) => setStore(updated)} />}
              {active === 4 && <EarningsPanel store={store} orderStats={orderStats} onStatusChange={handleOrderStatusChange} />}
            </div>
          </div>

        </div>
      )}

      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t">
        <div className="flex">
          {visibleTabs.map((tab) => {
            const i = TABS.indexOf(tab);
            const Icon = tab.icon;
            const isActive = active === i;
            return (
              <button
                key={tab.label}
                onClick={() => setActive(i)}
                className={`flex-1 flex flex-col items-center gap-1 pt-3 pb-5 transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
                data-testid={`tab-${tab.label.toLowerCase().replace(" ", "-")}`}
              >
                <Icon className={`h-5 w-5 transition-transform ${isActive ? "scale-110" : "scale-100"}`} />
                <span className={`text-[10px] font-semibold ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                  {tab.label}
                </span>
                {isActive && <span className="absolute bottom-0 w-8 h-0.5 bg-primary rounded-full" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
