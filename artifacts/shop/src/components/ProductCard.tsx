import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Copy, Star, Flame, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { deleteProduct } from "@/lib/api";
import type { Product } from "@/lib/api";

interface ProductCardProps {
  product: Product;
  showActions?: boolean;
  onDelete?: () => void;
  onToggleTrending?: () => void;
  productHref?: string;
  reviewSummary?: { avg: number; count: number };
  /** Pass true for the first ~4 cards visible above the fold so they load eagerly */
  priority?: boolean;
}

export function ProductCard({ product, showActions = true, productHref, onDelete, onToggleTrending, reviewSummary, priority = false }: ProductCardProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const inStock = product.units > 0;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleCopyLink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/product/${product.id}`);
    toast({ title: "Link copied!", description: "Product link copied to clipboard." });
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/edit-product/${product.id}`);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(true);
  };

  const handleDeleteConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true);
    try {
      await deleteProduct(product.id);
      toast({ title: "Product deleted", description: `"${product.name}" has been removed.` });
      onDelete?.();
    } catch {
      toast({ variant: "destructive", title: "Failed to delete", description: "Please try again." });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleDeleteCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(false);
  };

  /* ── STOREFRONT (buyer view) – compact Flipkart-style ── */
  if (!showActions) {
    const hasSale = product.salePrice != null && product.salePrice > 0 && product.salePrice < product.price;
    const displayPrice = hasSale ? product.salePrice! : product.price;
    const savings = hasSale ? product.price - product.salePrice! : 0;
    const discountPct = hasSale ? Math.round((product.price - product.salePrice!) / product.price * 100) : 0;
    const hasDiscount = hasSale;

    return (
      <Link href={productHref ?? `/product/${product.id}`} className="group block" data-testid={`card-product-${product.id}`}>
        <div className="bg-card rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col h-full hover:border-primary/20">
          {/* Image */}
          <div className="aspect-square lg:aspect-[4/3] relative overflow-hidden bg-muted/30">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={priority ? "high" : "low"}
            />
            {/* Sale / category badge */}
            {hasDiscount && (
              <div className="absolute top-1.5 left-1.5 bg-red-500 text-white px-2 py-0.5 rounded-full text-[9px] font-bold shadow-sm leading-tight tracking-wide">
                {discountPct}% OFF
              </div>
            )}
            {/* Out-of-stock overlay */}
            {!inStock && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="bg-white text-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                  Out of Stock
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-3 sm:p-4 flex-1 flex flex-col gap-1.5">
            <h3 className="text-sm sm:text-base font-semibold text-foreground line-clamp-2 leading-snug">
              {product.name}
            </h3>

            <div className="mt-auto space-y-0.5">
              {/* Price row */}
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <p className="text-base sm:text-lg font-extrabold text-primary leading-tight">
                  ₹{displayPrice.toLocaleString("en-IN")}
                </p>
                {hasDiscount && (
                  <p className="text-xs text-muted-foreground line-through leading-tight">
                    ₹{product.price.toLocaleString("en-IN")}
                  </p>
                )}
                {hasDiscount && (
                  <span className="text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full leading-tight">
                    {discountPct}% OFF
                  </span>
                )}
              </div>
              {/* Savings row */}
              {hasDiscount && (
                <p className="text-[10px] sm:text-xs font-semibold text-green-600 leading-tight">
                  You save ₹{savings.toLocaleString("en-IN")}
                </p>
              )}
              {/* Rating row */}
              <div className="flex items-center gap-0.5 pt-0.5">
                {reviewSummary && reviewSummary.count > 0 ? (
                  <>
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span className="text-[10px] font-semibold text-foreground leading-none">
                      {reviewSummary.avg.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-muted-foreground leading-none ml-0.5">
                      ({reviewSummary.count})
                    </span>
                  </>
                ) : (
                  <>
                    <Star className="w-3 h-3 text-muted-foreground/30" />
                    <span className="text-[10px] text-muted-foreground leading-none">No reviews</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  /* ── DASHBOARD (seller view) ── */
  return (
    <Link href={productHref ?? `/product/${product.id}`} className="group block" data-testid={`card-product-${product.id}`}>
      <div className="bg-card rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col h-full hover:border-primary/20">
        {/* Image */}
        <div className="aspect-square lg:aspect-[4/3] relative overflow-hidden bg-muted/30">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            decoding="async"
          />
          {/* Stock badge */}
          <div
            className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[9px] sm:text-xs font-semibold shadow-sm ${
              inStock ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
            }`}
            data-testid={`badge-stock-${product.id}`}
          >
            {inStock ? "In Stock" : "Out of Stock"}
          </div>
          {/* Multi-image indicator */}
          {product.imageUrls.length > 1 && (
            <div className="absolute bottom-1.5 left-1.5 bg-black/50 text-white text-[9px] px-1.5 py-0.5 rounded-full backdrop-blur-sm">
              {product.imageUrls.length} photos
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-2 sm:p-3 flex-1 flex flex-col gap-0.5 sm:gap-1">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground line-clamp-2 leading-snug">
            {product.name}
          </h3>
          <p className="text-sm sm:text-base font-extrabold text-primary leading-tight">
            ₹{product.price.toLocaleString("en-IN")}
          </p>
          <p className="text-[10px] sm:text-xs text-muted-foreground" data-testid={`text-units-${product.id}`}>
            {inStock ? `${product.units} unit${product.units !== 1 ? "s" : ""} left` : "No stock"}
          </p>
        </div>

        {/* Actions */}
        {confirmDelete ? (
          <div className="px-2 pb-2 sm:px-3 sm:pb-3 flex items-center gap-1.5 border-t border-border/40 pt-2">
            <span className="text-[10px] text-red-600 font-semibold flex-1 leading-tight">Delete?</span>
            <Button
              size="sm"
              className="rounded-lg h-7 bg-red-500 hover:bg-red-600 text-white text-[10px] px-2.5 shrink-0"
              onClick={handleDeleteConfirm}
              disabled={deleting}
              data-testid={`btn-confirm-delete-${product.id}`}
            >
              Yes
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg h-7 text-[10px] px-2.5 shrink-0"
              onClick={handleDeleteCancel}
              data-testid={`btn-cancel-delete-${product.id}`}
            >
              No
            </Button>
          </div>
        ) : (
          <div className="px-2 pb-2 sm:px-3 sm:pb-3 grid grid-cols-4 gap-1 border-t border-border/40 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg h-7 px-0 bg-background hover:bg-muted w-full"
              onClick={handleCopyLink}
              title="Copy product link"
              data-testid={`btn-copy-${product.id}`}
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg h-7 px-0 bg-background hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all w-full"
              onClick={handleEdit}
              title="Edit product"
              data-testid={`btn-edit-${product.id}`}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            {onToggleTrending ? (
              <Button
                variant={product.trending ? "default" : "outline"}
                size="sm"
                className={`rounded-lg h-7 px-0 transition-all w-full ${
                  product.trending
                    ? "bg-orange-500 hover:bg-orange-600 border-orange-500 text-white"
                    : "bg-background hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600"
                }`}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleTrending(); }}
                data-testid={`btn-trending-${product.id}`}
                title={product.trending ? "Remove from Trending" : "Add to Trending"}
              >
                <Flame className={`h-3 w-3 ${product.trending ? "fill-white" : ""}`} />
              </Button>
            ) : <span />}
            {onDelete ? (
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg h-7 px-0 bg-background hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-all w-full"
                onClick={handleDeleteClick}
                title="Delete product"
                data-testid={`btn-delete-${product.id}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            ) : <span />}
          </div>
        )}
      </div>
    </Link>
  );
}
