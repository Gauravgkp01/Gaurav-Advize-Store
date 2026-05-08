import { useState, useEffect } from "react";
import { useParams, useSearch, Link } from "wouter";
import {
  ArrowLeft, ShoppingCart, Trash2, Plus, Minus,
  MessageCircle, Store, CreditCard, MapPin,
  User, Phone, CheckCircle2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { getStore, createRazorpayOrder, verifyRazorpayPayment, createOrder, createCashfreeOrder, verifyCashfreeOrder } from "@/lib/api";
import type { Store as StoreType } from "@/lib/api";

type Screen = "cart" | "checkout" | "success";

interface BuyerInfo {
  name: string;
  phone: string;
  addressLine: string;
  city: string;
  pincode: string;
}

function itemPrice(item: { product: { price: number; salePrice?: number }; quantity: number }) {
  const p = item.product;
  const unit = (p.salePrice != null && p.salePrice > 0 && p.salePrice < p.price)
    ? p.salePrice : p.price;
  return unit * item.quantity;
}

function unitPrice(p: { price: number; salePrice?: number }) {
  return (p.salePrice != null && p.salePrice > 0 && p.salePrice < p.price)
    ? p.salePrice : p.price;
}

export function CartPage({ forcedSlug }: { forcedSlug?: string } = {}) {
  const params = useParams();
  const search = useSearch();
  const slug = forcedSlug ?? params.slug ?? "";
  const onSubdomain = !!forcedSlug;
  const { items, updateQty, removeItem, clearCart, totalItems, totalPrice } = useCart();
  const { toast } = useToast();
  const [store, setStore] = useState<StoreType | null>(null);
  const [screen, setScreen] = useState<Screen>("cart");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [buyer, setBuyer] = useState<BuyerInfo>({
    name: "", phone: "", addressLine: "", city: "", pincode: "",
  });

  /* Always dark on storefront pages */
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("dark");
    return () => {};
  }, []);

  /* Load store info */
  useEffect(() => {
    if (!slug) return;
    getStore(slug).then(setStore).catch(() => {});
  }, [slug]);

  /* Inject Razorpay script once */
  useEffect(() => {
    if (document.getElementById("rzp-script")) return;
    const s = document.createElement("script");
    s.id = "rzp-script";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  /* Inject Cashfree SDK once */
  useEffect(() => {
    if (document.getElementById("cf-script")) return;
    const s = document.createElement("script");
    s.id = "cf-script";
    s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  /* Handle Cashfree redirect return */
  useEffect(() => {
    const p = new URLSearchParams(search);
    const advizeOid = p.get("advize_oid");
    const advizeStatus = p.get("advize_status");
    if (!advizeOid) return;

    if (advizeStatus === "SUCCESS") {
      const saved = sessionStorage.getItem("advize_buyer");
      if (saved) { try { setBuyer(JSON.parse(saved)); } catch {} }
      verifyCashfreeOrder(advizeOid)
        .then(result => {
          if (result.payment_status === "paid" || result.status === "confirmed") {
            clearCart();
            setScreen("success");
          } else {
            clearCart();
            setScreen("success");
          }
        })
        .catch(() => { clearCart(); setScreen("success"); });
      sessionStorage.removeItem("advize_buyer");
    } else if (advizeStatus === "FAILED" || advizeStatus === "CANCELLED") {
      toast({ variant: "destructive", title: "Payment not completed", description: "Please try again." });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasRazorpay = !!(store?.razorpay_account_id || store?.razorpay_key_id);
  const hasAdvize   = !!(store?.advize_payment_enabled);
  const hasPayment  = hasAdvize || hasRazorpay;

  /* ── WhatsApp order (no payment) ── */
  const handleWhatsAppOrder = (extraInfo?: string) => {
    if (!store?.whatsapp) return;
    const lines = items.map(item =>
      `• ${item.product.name} × ${item.quantity} — ₹${itemPrice(item).toLocaleString("en-IN")}`
    );
    const info = extraInfo ?? "";
    const message = `Hello 👋,\n\nI'd like to order the following:\n\n${lines.join("\n")}\n\n💰 Total: ₹${totalPrice.toLocaleString("en-IN")}${info}\n\nPlease confirm availability and delivery details. Thank you!`;
    const number = store.whatsapp.replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, "_blank");
  };

  /* ── Validate checkout form ── */
  const validateBuyer = () => {
    if (!buyer.name.trim()) { toast({ variant: "destructive", title: "Please enter your name." }); return false; }
    if (!/^\d{10}$/.test(buyer.phone.replace(/\s/g, ""))) {
      toast({ variant: "destructive", title: "Please enter a valid 10-digit phone number." }); return false;
    }
    if (!buyer.addressLine.trim()) { toast({ variant: "destructive", title: "Please enter your address." }); return false; }
    if (!buyer.city.trim()) { toast({ variant: "destructive", title: "Please enter your city." }); return false; }
    if (!/^\d{6}$/.test(buyer.pincode.trim())) {
      toast({ variant: "destructive", title: "Please enter a valid 6-digit pincode." }); return false;
    }
    return true;
  };

  /* ── Cashfree checkout ── */
  const handleCashfreeCheckout = async () => {
    if (!validateBuyer() || !store) return;
    setPaymentLoading(true);
    try {
      sessionStorage.setItem("advize_buyer", JSON.stringify(buyer));
      const result = await createCashfreeOrder({
        store_id: store.id,
        amount_paise: Math.round(totalPrice * 100),
        items: items.map(i => ({
          productId: i.product.id,
          name: i.product.name,
          quantity: i.quantity,
          price: unitPrice(i.product),
        })),
        buyer,
        slug,
      });

      const Cashfree = (window as any).Cashfree;
      if (!Cashfree) {
        toast({ variant: "destructive", title: "Payment not ready", description: "Please refresh and try again." });
        setPaymentLoading(false);
        return;
      }

      const cf = Cashfree({ mode: "production" });
      cf.checkout({ paymentSessionId: result.payment_session_id, redirectTarget: "_self" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Could not initiate payment", description: err.message ?? "Please try again." });
      setPaymentLoading(false);
    }
  };

  /* ── Razorpay checkout ── */
  const handleRazorpayCheckout = async () => {
    if (!validateBuyer() || !store) return;
    setPaymentLoading(true);
    try {
      const orderData = await createRazorpayOrder(
        store.id,
        Math.round(totalPrice * 100),
        `cart_${store.id}_${Date.now()}`
      );

      const Razorpay = (window as any).Razorpay;
      if (!Razorpay) {
        toast({ variant: "destructive", title: "Payment not available", description: "Please refresh and try again." });
        setPaymentLoading(false);
        return;
      }

      const linesSummary = items.map(i => `${i.product.name} ×${i.quantity}`).join(", ");

      const options: any = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: store.name,
        description: linesSummary.slice(0, 80),
        order_id: orderData.order_id,
        prefill: {
          name: buyer.name,
          contact: `+91${buyer.phone.replace(/\D/g, "")}`,
        },
        notes: {
          delivery_address: `${buyer.addressLine}, ${buyer.city} - ${buyer.pincode}`,
          items: linesSummary,
        },
        theme: { color: "#16a34a" },
        handler: async (response: any) => {
          try {
            const result = await verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              store_id: store.id,
            });
            if (result.verified) {
              createOrder({
                store_id: store.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                amount_paise: Math.round(totalPrice * 100),
                items: items.map(i => ({
                  productId: i.product.id,
                  name: i.product.name,
                  quantity: i.quantity,
                  price: unitPrice(i.product),
                })),
                buyer,
              }).catch(() => {}); // fire-and-forget — don't block success screen
              setScreen("success");
              clearCart();
            } else {
              toast({ variant: "destructive", title: "Payment verification failed", description: "Contact the seller." });
            }
          } catch {
            toast({ variant: "destructive", title: "Could not verify payment", description: "Contact the seller with your payment ID." });
          }
          setPaymentLoading(false);
        },
        modal: { ondismiss: () => setPaymentLoading(false) },
      };

      new Razorpay(options).open();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Could not initiate payment", description: err.message ?? "Please try again." });
      setPaymentLoading(false);
    }
  };

  /* ── Shared header ── */
  const Header = ({ title }: { title: string }) => (
    <header className="sticky top-0 z-50 bg-primary text-primary-foreground px-4">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />
      <div className="h-14 flex items-center relative z-10">
        <button
          onClick={() => screen === "checkout" ? setScreen("cart") : window.history.back()}
          className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/10 transition-colors shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base">{title}</span>
            {screen === "cart" && totalItems > 0 && (
              <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full leading-none">
                {totalItems}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );

  /* ── Empty state ── */
  if (items.length === 0 && screen !== "success") {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <Header title="My Cart" />
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="w-24 h-24 rounded-full bg-muted/40 flex items-center justify-center">
            <ShoppingCart className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <div>
            <p className="font-bold text-xl text-foreground">Your cart is empty</p>
            <p className="text-sm text-muted-foreground mt-1.5">Add products from the store to get started</p>
          </div>
          <Button asChild className="rounded-full px-6 mt-1">
            <Link href={onSubdomain ? "/" : `/store/${slug}`}>
              <Store className="h-4 w-4 mr-2" />
              Browse Products
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  /* ── Success screen ── */
  if (screen === "success") {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <Header title="Order Placed" />
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="font-bold text-2xl text-foreground">Payment Successful!</p>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Your order has been placed. The seller will contact you on <span className="font-semibold">{buyer.phone}</span> to confirm delivery.
            </p>
          </div>
          <Button asChild className="rounded-full px-6 mt-1">
            <Link href={onSubdomain ? "/" : `/store/${slug}`}>Continue Shopping</Link>
          </Button>
        </div>
      </div>
    );
  }

  /* ── Checkout form (payment stores only) ── */
  if (screen === "checkout") {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <Header title="Delivery Details" />
        <main className="flex-1 px-4 py-5 max-w-lg mx-auto w-full pb-10 space-y-5">

          {/* Order mini-summary */}
          <div className="bg-card border rounded-2xl p-4 shadow-sm space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Order Summary</p>
            {items.map(item => (
              <div key={item.product.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground truncate mr-2">{item.product.name} <span className="text-muted-foreground">×{item.quantity}</span></span>
                <span className="font-semibold shrink-0">₹{itemPrice(item).toLocaleString("en-IN")}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t pt-2 mt-1">
              <span className="font-bold">Total</span>
              <span className="font-extrabold text-primary text-lg">₹{totalPrice.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* Contact info */}
          <div className="bg-card border rounded-2xl p-4 shadow-sm space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Contact Information</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="buyer-name">Full Name</Label>
              <Input
                id="buyer-name"
                placeholder="Priya Sharma"
                value={buyer.name}
                onChange={e => setBuyer(b => ({ ...b, name: e.target.value }))}
                className="h-11 rounded-xl"
                autoComplete="name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="buyer-phone">Phone Number</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">+91</span>
                <Input
                  id="buyer-phone"
                  placeholder="9876543210"
                  value={buyer.phone}
                  onChange={e => setBuyer(b => ({ ...b, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                  className="h-11 rounded-xl pl-12"
                  inputMode="numeric"
                  autoComplete="tel"
                />
              </div>
            </div>
          </div>

          {/* Delivery address */}
          <div className="bg-card border rounded-2xl p-4 shadow-sm space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Delivery Address</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address-line">Address</Label>
              <Input
                id="address-line"
                placeholder="House/Flat no., Street, Area"
                value={buyer.addressLine}
                onChange={e => setBuyer(b => ({ ...b, addressLine: e.target.value }))}
                className="h-11 rounded-xl"
                autoComplete="street-address"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="Mumbai"
                  value={buyer.city}
                  onChange={e => setBuyer(b => ({ ...b, city: e.target.value }))}
                  className="h-11 rounded-xl"
                  autoComplete="address-level2"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pincode">Pincode</Label>
                <Input
                  id="pincode"
                  placeholder="400001"
                  value={buyer.pincode}
                  onChange={e => setBuyer(b => ({ ...b, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                  className="h-11 rounded-xl"
                  inputMode="numeric"
                  autoComplete="postal-code"
                />
              </div>
            </div>
          </div>

          {/* Pay button */}
          <Button
            className="w-full h-12 rounded-2xl text-base font-bold gap-2 shadow-md"
            onClick={hasAdvize ? handleCashfreeCheckout : handleRazorpayCheckout}
            disabled={paymentLoading}
          >
            {paymentLoading
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : <CreditCard className="h-5 w-5" />
            }
            {paymentLoading ? "Redirecting to payment..." : `Pay ₹${totalPrice.toLocaleString("en-IN")} Securely`}
          </Button>

          <p className="text-center text-[11px] text-muted-foreground">
            {hasAdvize
              ? "Secured by Cashfree · 100% safe & encrypted"
              : "Secured by Razorpay · 100% safe & encrypted"}
          </p>
        </main>
      </div>
    );
  }

  /* ── Cart screen ── */
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Header title="My Cart" />

      <main className="flex-1 px-4 py-4 max-w-lg mx-auto w-full pb-8">

        {/* Cart items */}
        <div className="space-y-3 mb-4">
          {items.map(item => {
            const unit = unitPrice(item.product);
            return (
              <div key={item.product.id} className="bg-card border rounded-2xl p-3 flex gap-3 items-center shadow-sm">
                <img
                  src={item.product.imageUrl}
                  alt={item.product.name}
                  className="w-16 h-16 rounded-xl object-cover shrink-0 bg-muted"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">{item.product.name}</p>
                  <p className="text-sm font-extrabold text-primary mt-0.5">₹{unit.toLocaleString("en-IN")}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      className="w-7 h-7 rounded-full bg-muted hover:bg-primary/10 flex items-center justify-center transition-colors"
                      onClick={() => updateQty(item.product.id, item.quantity - 1)}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-sm font-bold w-5 text-center tabular-nums">{item.quantity}</span>
                    <button
                      className="w-7 h-7 rounded-full bg-muted hover:bg-primary/10 flex items-center justify-center transition-colors"
                      onClick={() => updateQty(item.product.id, item.quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <span className="ml-auto text-xs font-semibold text-muted-foreground">
                      ₹{itemPrice(item).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
                <button
                  className="w-8 h-8 rounded-full hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-500 flex items-center justify-center transition-colors shrink-0 text-muted-foreground"
                  onClick={() => removeItem(item.product.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Order summary */}
        <div className="bg-card border rounded-2xl p-4 shadow-sm space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal ({totalItems} item{totalItems !== 1 ? "s" : ""})</span>
            <span className="font-semibold">₹{totalPrice.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-2">
            <span className="font-bold text-foreground">Total</span>
            <span className="font-extrabold text-primary text-xl">₹{totalPrice.toLocaleString("en-IN")}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-2">
          {hasPayment ? (
            /* Payment-enabled store: primary = Checkout, secondary = WhatsApp */
            <>
              <Button
                className="w-full h-12 rounded-2xl text-base font-bold gap-2 shadow-md"
                onClick={() => setScreen("checkout")}
              >
                <CreditCard className="h-5 w-5" />
                Proceed to Checkout
              </Button>
              <Button
                variant="outline"
                className="w-full h-11 rounded-2xl text-sm font-semibold gap-2 border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10"
                onClick={() => handleWhatsAppOrder()}
                disabled={!store?.whatsapp}
              >
                <MessageCircle className="h-4 w-4" />
                Order via WhatsApp instead
              </Button>
            </>
          ) : (
            /* No payment: WhatsApp only */
            <Button
              className="w-full h-12 rounded-2xl bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold text-base gap-2 shadow-md"
              onClick={() => handleWhatsAppOrder()}
              disabled={!store?.whatsapp}
            >
              <MessageCircle className="h-5 w-5 fill-white" />
              Order via WhatsApp
            </Button>
          )}

          <button
            className="w-full text-xs text-muted-foreground/50 text-center py-1 hover:text-red-400 transition-colors"
            onClick={clearCart}
          >
            Clear cart
          </button>
        </div>
      </main>
    </div>
  );
}
