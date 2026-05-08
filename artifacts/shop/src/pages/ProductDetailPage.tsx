import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import {
  ArrowLeft, MessageCircle,
  AlertCircle, Star, Loader2, MousePointerClick,
  Package, BarChart2, TrendingUp, ZoomIn, ZoomOut, X, RotateCcw,
  ShoppingCart, ShoppingBag, ChevronDown,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getProduct, getReviews, createReview, getProductAnalytics, getStore, getStoreById, getProducts, getSubdomainSlug, getProductDetail } from "@/lib/api";
import type { Product, Review } from "@/lib/api";
import type { ProductAnalytics } from "@/lib/api";
import { pdCache, PD_CACHE_TTL } from "@/lib/product-cache";
import { useCart } from "@/contexts/CartContext";

/* ── shared sub-components ────────────────────────────── */
function StarRating({ value, onChange, size = "md" }: { value: number; onChange?: (v: number) => void; size?: "sm" | "md" }) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || value;
  const px = size === "sm" ? "h-4 w-4" : "h-6 w-6";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button key={star} type="button" onClick={() => onChange?.(star)}
          onMouseEnter={() => onChange && setHovered(star)}
          onMouseLeave={() => onChange && setHovered(0)}
          className={onChange ? "cursor-pointer" : "cursor-default"}
          aria-label={`${star} star`}
        >
          <Star className={`${px} transition-colors ${star <= active ? "fill-amber-400 text-amber-400" : "fill-muted text-muted-foreground/30"}`} />
        </button>
      ))}
    </div>
  );
}

function AvatarInitials({ name }: { name: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["bg-violet-100 text-violet-700", "bg-sky-100 text-sky-700", "bg-amber-100 text-amber-700", "bg-green-100 text-green-700", "bg-rose-100 text-rose-700"];
  const color = colors[initials.charCodeAt(0) % colors.length];
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${color}`}>
      {initials}
    </div>
  );
}

function RelatedProducts({ products }: { products: Product[] }) {
  if (products.length === 0) return null;
  return (
    <div className="bg-card sm:border sm:rounded-3xl px-5 sm:px-10 py-6 shadow-sm">
      <h2 className="text-lg font-bold mb-4">You may also like</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-hide">
        {products.map(p => (
          <Link key={p.id} href={`/product/${p.id}`} className="shrink-0 w-36 snap-start group">
            <div className="rounded-2xl border bg-background overflow-hidden shadow-sm hover:shadow-md transition-all hover:border-primary/30">
              <div className="aspect-square overflow-hidden bg-muted/30 relative">
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                {p.units === 0 && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="text-[9px] font-bold bg-white text-foreground px-2 py-0.5 rounded-full">Out of Stock</span>
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">{p.name}</p>
                <p className="text-sm font-extrabold text-primary mt-1">₹{p.price.toLocaleString("en-IN")}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ReviewsList({ reviews, avgRating, ratingCounts, showForm, setShowForm,
  reviewName, setReviewName, reviewRating, setReviewRating, reviewComment,
  setReviewComment, submitting, handleSubmitReview }: any) {
  return (
    <div className="bg-card sm:border sm:rounded-3xl px-5 sm:px-10 py-8 shadow-sm" data-testid="reviews-section">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Customer Reviews</h2>
        {!showForm && (
          <Button variant="outline" className="rounded-xl" onClick={() => setShowForm(true)} data-testid="btn-write-review">
            Write a Review
          </Button>
        )}
      </div>

      {reviews.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-6 mb-8 pb-8 border-b">
          <div className="flex flex-col items-center justify-center gap-1 shrink-0">
            <span className="text-5xl font-extrabold text-foreground">{avgRating.toFixed(1)}</span>
            <StarRating value={Math.round(avgRating)} />
            <span className="text-sm text-muted-foreground">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex-1 space-y-1.5">
            {ratingCounts.map(({ star, count }: any) => (
              <div key={star} className="flex items-center gap-2 text-sm">
                <span className="w-4 text-right text-muted-foreground">{star}</span>
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-amber-400 transition-all"
                    style={{ width: reviews.length ? `${(count / reviews.length) * 100}%` : "0%" }} />
                </div>
                <span className="w-4 text-muted-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-muted/30 border rounded-2xl p-5 mb-8 space-y-4" data-testid="review-form">
          <h3 className="font-semibold text-base">Share your experience</h3>
          <div className="space-y-1">
            <label className="text-sm font-medium">Your rating</label>
            <StarRating value={reviewRating} onChange={setReviewRating} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Your name</label>
            <Input placeholder="e.g. Priya S." className="h-11 rounded-xl" value={reviewName}
              onChange={e => setReviewName(e.target.value)} data-testid="input-review-name" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Your review</label>
            <Textarea placeholder="What did you like or dislike? How was the quality?"
              className="rounded-xl resize-none min-h-[100px]" value={reviewComment}
              onChange={e => setReviewComment(e.target.value)} data-testid="input-review-comment" />
          </div>
          <div className="flex gap-3">
            <Button className="flex-1 h-11 rounded-xl" onClick={handleSubmitReview} disabled={submitting} data-testid="btn-submit-review">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Post Review
            </Button>
            <Button variant="outline" className="h-11 rounded-xl"
              onClick={() => { setShowForm(false); setReviewRating(0); setReviewName(""); setReviewComment(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {reviews.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No reviews yet</p>
          <p className="text-sm mt-1">Be the first to share your experience!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {reviews.map((review: Review) => (
            <div key={review.id} className="flex gap-4" data-testid={`review-${review.id}`}>
              <AvatarInitials name={review.name} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{review.name}</span>
                  <StarRating value={review.rating} size="sm" />
                  <span className="text-xs text-muted-foreground ml-auto">{review.date}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Owner analytics view ─────────────────────────────── */
function OwnerView({ product, reviews, analytics }: {
  product: Product;
  reviews: Review[];
  analytics: ProductAnalytics | null;
}) {
  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const ratingCounts = [5, 4, 3, 2, 1].map(star => ({
    star, count: reviews.filter(r => r.rating === star).length,
  }));
  const hasClicks = (analytics?.totalClicks ?? 0) > 0;

  const CustomTooltip = ({ active, payload, label }: any) =>
    active && payload?.length ? (
      <div className="bg-card border rounded-xl px-3 py-2 shadow-lg text-xs">
        <p className="font-semibold">{label}</p>
        <p className="text-primary font-bold">{payload[0].value} clicks</p>
      </div>
    ) : null;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container max-w-4xl mx-auto px-4 h-16 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => window.history.back()}
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <p className="font-semibold text-sm leading-tight">{product.name}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Product Analytics</p>
          </div>
        </div>
      </header>

      <main className="flex-1 container max-w-4xl mx-auto px-0 sm:px-6 py-0 sm:py-8 space-y-4 pb-10">

        {/* Product identity card */}
        <div className="bg-card sm:border sm:rounded-3xl overflow-hidden shadow-sm flex flex-row items-center gap-4 p-4 sm:p-6">
          <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-muted shrink-0">
            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="inline-block text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full mb-1">
              {product.category}
            </span>
            <h1 className="text-lg sm:text-2xl font-bold text-foreground leading-tight">{product.name}</h1>
            <p className="text-xl font-extrabold text-primary mt-1">₹{product.price.toLocaleString("en-IN")}</p>
          </div>
        </div>

        {/* 3 stat tiles */}
        <div className="grid grid-cols-3 gap-2 px-2.5 sm:px-0">
          <div className="bg-card border rounded-2xl p-3 flex flex-col gap-1">
            <div className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center">
              <MousePointerClick className="h-3.5 w-3.5 text-sky-600" />
            </div>
            <p className="text-[10px] text-muted-foreground font-medium mt-1">Total Clicks</p>
            <p className="text-base font-extrabold text-foreground">{(analytics?.totalClicks ?? 0).toLocaleString()}</p>
          </div>
          <div className="bg-card border rounded-2xl p-3 flex flex-col gap-1">
            <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center">
              <Star className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <p className="text-[10px] text-muted-foreground font-medium mt-1">Avg Rating</p>
            <p className="text-base font-extrabold text-foreground">
              {reviews.length ? avgRating.toFixed(1) + " ★" : "–"}
            </p>
          </div>
          <div className={`bg-card border rounded-2xl p-3 flex flex-col gap-1 ${product.units === 0 ? "border-red-200 bg-red-50" : ""}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center ${product.units === 0 ? "bg-red-100" : "bg-green-100"}`}>
              <Package className={`h-3.5 w-3.5 ${product.units === 0 ? "text-red-600" : "text-green-600"}`} />
            </div>
            <p className="text-[10px] text-muted-foreground font-medium mt-1">Stock</p>
            <p className={`text-base font-extrabold ${product.units === 0 ? "text-red-600" : "text-foreground"}`}>
              {product.units === 0 ? "Out" : `${product.units} units`}
            </p>
          </div>
        </div>

        {/* Weekly clicks chart */}
        <div className="mx-2.5 sm:mx-0 bg-card border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Clicks This Week</p>
          </div>
          <p className="text-[11px] text-muted-foreground mb-4">How many times buyers clicked this product in the last 7 days</p>

          {!hasClicks ? (
            <div className="flex flex-col items-center justify-center h-[120px] text-muted-foreground/40 gap-2">
              <BarChart2 className="h-7 w-7" />
              <p className="text-xs">No clicks yet — share your store to get started!</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={analytics?.weeklyClicks ?? []} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="prodClickGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="clicks" stroke="#22c55e" strokeWidth={2}
                  fill="url(#prodClickGrad)" dot={{ r: 3, fill: "#22c55e" }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Product description (read-only for owner) */}
        {product.description && (
          <div className="mx-2.5 sm:mx-0 bg-card border rounded-2xl p-4">
            <p className="text-sm font-semibold mb-2">Product Description</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
          </div>
        )}

        {/* Reviews (read-only for owner) */}
        <div className="mx-2.5 sm:mx-0 bg-card border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-semibold">Customer Reviews ({reviews.length})</p>
          </div>

          {reviews.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Star className="h-8 w-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No reviews yet for this product</p>
            </div>
          ) : (
            <>
              {/* Rating breakdown */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6 pb-6 border-b">
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <span className="text-4xl font-extrabold">{avgRating.toFixed(1)}</span>
                  <StarRating value={Math.round(avgRating)} size="sm" />
                  <span className="text-xs text-muted-foreground">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex-1 space-y-1.5">
                  {ratingCounts.map(({ star, count }) => (
                    <div key={star} className="flex items-center gap-2 text-xs">
                      <span className="w-4 text-right text-muted-foreground">{star}</span>
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-amber-400 transition-all"
                          style={{ width: reviews.length ? `${(count / reviews.length) * 100}%` : "0%" }} />
                      </div>
                      <span className="w-4 text-muted-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Individual reviews */}
              <div className="space-y-5">
                {reviews.map(review => (
                  <div key={review.id} className="flex gap-3">
                    <AvatarInitials name={review.name} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{review.name}</span>
                        <StarRating value={review.rating} size="sm" />
                        <span className="text-xs text-muted-foreground ml-auto">{review.date}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="pb-8" />
      </main>
    </div>
  );
}

/* ── Zoomable image lightbox ──────────────────────────── */
function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const lastDist = useRef<number | null>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);

  const clampScale = (s: number) => Math.min(5, Math.max(1, s));

  const reset = () => { setScale(1); setTranslate({ x: 0, y: 0 }); };
  const close = () => { setOpen(false); reset(); };
  const zoomIn  = () => setScale(s => clampScale(s + 0.5));
  const zoomOut = () => setScale(s => {
    const next = clampScale(s - 0.5);
    if (next === 1) setTranslate({ x: 0, y: 0 });
    return next;
  });

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => clampScale(s - e.deltaY * 0.005));
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastDist.current = Math.hypot(dx, dy);
    } else {
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      dragging.current = true;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 2 && lastDist.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      setScale(s => clampScale(s * (dist / lastDist.current!)));
      lastDist.current = dist;
    } else if (e.touches.length === 1 && lastPos.current && dragging.current) {
      const dx = e.touches[0].clientX - lastPos.current.x;
      const dy = e.touches[0].clientY - lastPos.current.y;
      setTranslate(t => ({ x: t.x + dx, y: t.y + dy }));
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const onTouchEnd = () => {
    lastDist.current = null;
    lastPos.current = null;
    dragging.current = false;
  };

  return (
    <>
      {/* Main image – click to open lightbox */}
      <div
        className="relative w-full cursor-zoom-in select-none bg-muted/20"
        onClick={() => setOpen(true)}
      >
        <img
          src={src}
          alt={alt}
          className="w-full object-contain object-top max-h-[70vw] sm:max-h-[460px]"
          draggable={false}
        />
        <div className="absolute bottom-2 right-2 bg-black/40 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-sm flex items-center gap-1 pointer-events-none">
          <ZoomIn className="w-3 h-3" /> Tap to zoom
        </div>
      </div>

      {/* Lightbox */}
      {open && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col touch-none" style={{ userSelect: "none" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0">
            <span className="text-white/60 text-sm truncate max-w-[70%]">{alt}</span>
            <button
              onClick={close}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Zoomable image area */}
          <div
            className="flex-1 overflow-hidden flex items-center justify-center"
            onWheel={onWheel}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <img
              src={src}
              alt={alt}
              draggable={false}
              className="select-none"
              style={{
                maxWidth: "100vw",
                maxHeight: "100%",
                objectFit: "contain",
                transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
                transition: dragging.current ? "none" : "transform 0.15s ease",
              }}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 py-4 shrink-0">
            <button
              onClick={zoomOut}
              disabled={scale <= 1}
              className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <span className="text-white text-sm font-semibold w-14 text-center tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              disabled={scale >= 5}
              className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            {scale > 1 && (
              <button
                onClick={reset}
                className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                title="Reset zoom"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ── Buyer (public) view ──────────────────────────────── */
function BuyerView({ product, reviews, storeWhatsapp, storeSlug, storeId, relatedProducts }: {
  product: Product;
  reviews: Review[];
  storeWhatsapp: string;
  storeSlug: string;
  storeId: string;
  relatedProducts: Product[];
}) {
  const onSubdomain = !!getSubdomainSlug();
  const storePath = onSubdomain ? "/" : `/store/${storeSlug}`;
  const cartPath  = onSubdomain ? "/cart" : `/store/${storeSlug}/cart`;
  // Always show the product/store page in dark mode
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("dark");
    return () => {};
  }, []);

  const { toast } = useToast();
  const { addItem, totalItems } = useCart();
  const [addedToCart, setAddedToCart] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const images = product.imageUrls.length > 0 ? product.imageUrls : [product.imageUrl];
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [reviewName, setReviewName] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localReviews, setLocalReviews] = useState(reviews);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [reviewsFetched, setReviewsFetched] = useState(reviews.length > 0);
  const [reviewsFetching, setReviewsFetching] = useState(false);

  useEffect(() => {
    setLocalReviews(reviews);
    if (reviews.length > 0) setReviewsFetched(true);
  }, [reviews]);

  const handleToggleReviews = async () => {
    const opening = !reviewsOpen;
    setReviewsOpen(opening);
    if (opening && !reviewsFetched) {
      setReviewsFetching(true);
      try {
        const fetched = await getReviews(product.id);
        setLocalReviews(fetched);
        setReviewsFetched(true);
      } catch { /* ignore */ } finally {
        setReviewsFetching(false);
      }
    }
  };

  const avgRating = localReviews.length
    ? localReviews.reduce((s, r) => s + r.rating, 0) / localReviews.length : 0;
  const ratingCounts = [5, 4, 3, 2, 1].map(star => ({
    star, count: localReviews.filter(r => r.rating === star).length,
  }));
  const handleSelectVariant = (label: string, value: string) =>
    setSelectedVariants(prev => ({ ...prev, [label]: prev[label] === value ? "" : value }));

  const effectivePrice = (product.salePrice != null && product.salePrice > 0 && product.salePrice < product.price)
    ? product.salePrice : product.price;

  const handleAddToCart = () => {
    addItem(product, storeId, storeSlug);
    setAddedToCart(true);
    toast({ title: "Added to cart!", description: `${product.name} added. Tap the cart to review your order.` });
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleOrder = () => {
    const variantSummary = product.variants?.filter(v => selectedVariants[v.label])
      .map(v => `${v.label}: ${selectedVariants[v.label]}`).join(", ");
    const variantText = variantSummary ? `\n🎨 Variant: ${variantSummary}` : "";
    const message = `Hello 👋,\n\nI want to order this product:\n\n🛍 Product: ${product.name}${variantText}\n💰 Price: ₹${effectivePrice.toLocaleString("en-IN")}\n\n🔗 Product Link: ${window.location.href}\n\nPlease confirm availability.`;
    const number = storeWhatsapp.replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleSubmitReview = async () => {
    if (!reviewName.trim()) { toast({ variant: "destructive", title: "Please enter your name." }); return; }
    if (reviewRating === 0) { toast({ variant: "destructive", title: "Please select a star rating." }); return; }
    if (!reviewComment.trim()) { toast({ variant: "destructive", title: "Please write a short review." }); return; }
    setSubmitting(true);
    try {
      const newReview = await createReview({ product_id: product.id, name: reviewName.trim(), rating: reviewRating, comment: reviewComment.trim() });
      setLocalReviews(prev => [newReview, ...prev]);
      setReviewName(""); setReviewRating(0); setReviewComment(""); setShowForm(false);
      toast({ title: "Review posted!", description: "Thanks for sharing your feedback." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to post review", description: e.message });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container max-w-4xl mx-auto px-4 h-14 flex items-center relative">
          {/* Back — always goes to the previous page in history */}
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-muted transition-colors shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          {/* Centred title */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="font-semibold text-base">Product Details</span>
          </div>
          {/* Cart icon */}
          {storeSlug && (
            <Link
              href={cartPath}
              className="ml-auto relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-muted transition-colors"
            >
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center leading-none shadow">
                  {totalItems > 9 ? "9+" : totalItems}
                </span>
              )}
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 container max-w-4xl mx-auto px-0 sm:px-6 py-0 sm:py-8 space-y-6">
        <div className="bg-card sm:border sm:rounded-3xl overflow-hidden shadow-sm flex flex-col md:flex-row">
          <div className="w-full md:w-1/2 md:min-h-[500px] bg-muted/10 flex flex-col">
            <ZoomableImage src={images[activeImageIdx] ?? product.imageUrl} alt={product.name} />
            {/* Thumbnail strip — only when multiple images */}
            {images.length > 1 && (
              <div className="flex gap-2 px-3 py-2 overflow-x-auto scrollbar-hide">
                {images.map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIdx(idx)}
                    className={`w-14 h-14 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                      idx === activeImageIdx ? "border-primary shadow-md" : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="w-full md:w-1/2 p-6 sm:p-10 flex flex-col gap-5">
            <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium bg-muted/50 text-muted-foreground w-fit">
              {product.category}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">{product.name}</h1>
              {(() => {
                const hasSale = product.salePrice != null && product.salePrice > 0 && product.salePrice < product.price;
                const displayPrice = hasSale ? product.salePrice! : product.price;
                const savings = hasSale ? product.price - product.salePrice! : 0;
                const discountPct = hasSale ? Math.round((product.price - product.salePrice!) / product.price * 100) : 0;
                return (
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="text-3xl font-extrabold text-primary">
                        ₹{displayPrice.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </span>
                      {hasSale && (
                        <>
                          <span className="text-lg text-muted-foreground line-through">
                            MRP ₹{product.price.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                          </span>
                          <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                            {discountPct}% OFF
                          </span>
                        </>
                      )}
                    </div>
                    {hasSale && (
                      <p className="text-sm font-semibold text-green-600">
                        You save ₹{savings.toLocaleString("en-IN", { maximumFractionDigits: 0 })} on this order
                      </p>
                    )}
                    {!hasSale && (
                      <p className="text-xs text-muted-foreground">MRP ₹{product.price.toLocaleString("en-IN")}</p>
                    )}
                  </div>
                );
              })()}
              {localReviews.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2">
                  <StarRating value={Math.round(avgRating)} size="sm" />
                  <span className="text-sm text-muted-foreground">
                    {avgRating.toFixed(1)} · {localReviews.length} review{localReviews.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">{product.description}</p>

            {product.variants && product.variants.length > 0 && (
              <div className="space-y-4" data-testid="variants-section">
                {product.variants.map(variant => (
                  <div key={variant.label}>
                    <p className="text-sm font-semibold mb-2">
                      {variant.label}
                      {selectedVariants[variant.label] && (
                        <span className="ml-2 font-normal text-muted-foreground">— {selectedVariants[variant.label]}</span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {variant.values.map(value => {
                        const isSelected = selectedVariants[variant.label] === value;
                        return (
                          <button key={value} type="button" onClick={() => handleSelectVariant(variant.label, value)}
                            className={`h-9 px-4 rounded-full border text-sm font-medium transition-all ${isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-background text-foreground border-border hover:border-primary/60 hover:bg-muted/50"}`}>
                            {value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {product.units === 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 rounded-xl px-4 py-3 border border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>This item is currently out of stock. You can still message the seller.</span>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-14 text-base rounded-xl border-2 font-semibold gap-2"
                onClick={handleAddToCart}
                disabled={product.units === 0}
                data-testid="btn-add-to-cart"
              >
                <ShoppingBag className={`h-5 w-5 ${addedToCart ? "fill-primary" : ""}`} />
                {addedToCart ? "Added!" : "Add to Cart"}
              </Button>
              <Button
                className="flex-1 h-14 text-base rounded-xl shadow-lg bg-green-600 hover:bg-green-700 text-white border-transparent gap-2 font-semibold"
                onClick={handleOrder}
                data-testid="btn-order-whatsapp"
              >
                <MessageCircle className="h-5 w-5" />
                WhatsApp
              </Button>
            </div>

            {/* View Cart pill — slides in once items are in the cart */}
            {storeSlug && totalItems > 0 && (
              <Link
                href={cartPath}
                className="flex items-center justify-between gap-3 bg-primary/10 hover:bg-primary/15 border border-primary/30 rounded-2xl px-4 py-2.5 transition-all animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-semibold text-primary">View Cart</span>
                  <span className="bg-primary text-primary-foreground text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none">
                    {totalItems}
                  </span>
                </div>
                <ArrowLeft className="h-3.5 w-3.5 text-primary rotate-180 shrink-0" />
              </Link>
            )}
          </div>
        </div>

        <RelatedProducts products={relatedProducts} />

        {/* ── Lazy reviews collapsible ── */}
        <div className="bg-card sm:border sm:rounded-3xl shadow-sm overflow-hidden">
          {/* Header — always visible, tappable to expand */}
          <button
            onClick={handleToggleReviews}
            className="w-full flex items-center justify-between px-5 sm:px-10 py-5 text-left"
          >
            <div className="flex items-center gap-2.5">
              <Star className={`h-5 w-5 shrink-0 ${reviewsFetched && localReviews.length > 0 ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
              <span className="text-lg font-bold">Customer Reviews</span>
              {reviewsFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-1" />}
              {reviewsFetched && localReviews.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  · {avgRating.toFixed(1)}★ ({localReviews.length})
                </span>
              )}
            </div>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${reviewsOpen ? "rotate-180" : ""}`} />
          </button>

          {reviewsOpen && (
            <div className="px-5 sm:px-10 pb-8 border-t">
              {reviewsFetching ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="pt-6">
                  <ReviewsList reviews={localReviews} avgRating={avgRating} ratingCounts={ratingCounts}
                    showForm={showForm} setShowForm={setShowForm} reviewName={reviewName} setReviewName={setReviewName}
                    reviewRating={reviewRating} setReviewRating={setReviewRating} reviewComment={reviewComment}
                    setReviewComment={setReviewComment} submitting={submitting} handleSubmitReview={handleSubmitReview} />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pb-8" />
      </main>
    </div>
  );
}

/* ── Main page component ──────────────────────────────── */
export function ProductDetailPage() {
  const { id } = useParams();

  // Detect owner mode from query string
  const isOwnerView = new URLSearchParams(window.location.search).get("from") === "dashboard";

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [storeWhatsapp, setStoreWhatsapp] = useState("");
  const [storeSlug, setStoreSlug] = useState("");
  const [storeId, setStoreId] = useState("");
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [productAnalytics, setProductAnalytics] = useState<ProductAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    /** Apply a fully-loaded product-detail payload to component state. */
    function applyPayload(payload: {
      product: Product;
      store: import("@/lib/api").Store | null;
      reviews?: Review[];
      relatedProducts: Product[];
    }) {
      setProduct(payload.product);
      if (payload.reviews !== undefined) setReviews(payload.reviews);
      if (!isOwnerView && payload.store) {
        setStoreWhatsapp(payload.store.whatsapp ?? "");
        setStoreSlug(payload.store.slug ?? "");
        setStoreId(payload.store.id ?? "");
        setRelatedProducts(payload.relatedProducts);
      }
    }

    async function load() {
      // ── Buyer view: check module-level cache first ──────────────────────
      if (!isOwnerView) {
        const hit = pdCache.get(id!);
        if (hit && Date.now() - hit.ts < PD_CACHE_TTL) {
          // Serve immediately from cache (zero network calls)
          applyPayload(hit);
          setLoading(false);
          // Revalidate silently in the background
          getProductDetail(id!).then(fresh => {
            if (cancelled) return;
            pdCache.set(id!, { ...fresh, ts: Date.now() });
            applyPayload(fresh);
          }).catch(() => {/* ignore background errors */});
          return;
        }

        // Cache miss — single round-trip combined endpoint
        setLoading(true);
        try {
          const fresh = await getProductDetail(id!);
          if (cancelled) return;
          pdCache.set(id!, { ...fresh, ts: Date.now() });
          applyPayload(fresh);
        } catch {
          // product not found — leave null
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      // ── Owner view: product + reviews + analytics in parallel ───────────
      setLoading(true);
      try {
        const [loadedProduct, reviews, analytics] = await Promise.all([
          getProduct(id!),
          getReviews(id!),
          getProductAnalytics(id!),
        ]);
        if (cancelled) return;
        setProduct(loadedProduct);
        setReviews(reviews ?? []);
        if (analytics) setProductAnalytics(analytics);
      } catch {
        // product not found — leave null
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id, isOwnerView]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-muted-foreground">
        <p>Product not found.</p>
      </div>
    );
  }

  if (isOwnerView) {
    return <OwnerView product={product} reviews={reviews} analytics={productAnalytics} />;
  }

  return (
    <BuyerView product={product} reviews={reviews} storeWhatsapp={storeWhatsapp} storeSlug={storeSlug} storeId={storeId} relatedProducts={relatedProducts} />
  );
}
