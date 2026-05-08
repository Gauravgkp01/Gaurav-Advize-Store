import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useParams, useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { ArrowLeft, ImagePlus, Loader2, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Navbar } from "@/components/Navbar";
import { getProduct, updateProduct, uploadImage } from "@/lib/api";
import type { Product } from "@/lib/api";

const formSchema = z.object({
  name: z.string().min(2, { message: "Product name is required." }),
  price: z.coerce.number().min(1, { message: "MRP must be greater than 0." }),
  salePrice: z.coerce.number().min(0).optional(),
  units: z.coerce.number().int().min(0, { message: "Units cannot be negative." }),
  description: z.string().min(10, { message: "Add a short description." }),
  category: z.string().optional(),
});

const PRESET_SIZES = ["S", "M", "L", "XL"];

type CustomVariant = {
  id: string;
  label: string;
  values: string[];
  inputValue: string;
};

export function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  /* existing images from server */
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);

  /* new files picked by user */
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [customSizeInput, setCustomSizeInput] = useState("");
  const [showCustomSizeInput, setShowCustomSizeInput] = useState(false);
  const customSizeRef = useRef<HTMLInputElement>(null);

  const [colors, setColors] = useState<string[]>([]);
  const [colorInput, setColorInput] = useState("");

  const [customVariants, setCustomVariants] = useState<CustomVariant[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", price: undefined, units: 1, description: "", category: "" },
  });

  useEffect(() => {
    if (!id) return;
    getProduct(id).then(p => {
      setProduct(p);
      setExistingImageUrls(p.imageUrls.length > 0 ? p.imageUrls : p.imageUrl ? [p.imageUrl] : []);
      form.reset({
        name: p.name,
        price: p.price,
        salePrice: p.salePrice ?? undefined,
        units: p.units,
        description: p.description,
        category: p.category,
      });
      /* Pre-fill variants */
      const sizeVariant = p.variants?.find(v => v.label === "Size");
      if (sizeVariant) setSelectedSizes(sizeVariant.values);
      const colourVariant = p.variants?.find(v => v.label === "Colour");
      if (colourVariant) setColors(colourVariant.values);
      const others = (p.variants ?? [])
        .filter(v => v.label !== "Size" && v.label !== "Colour")
        .map(v => ({ id: crypto.randomUUID(), label: v.label, values: v.values, inputValue: "" }));
      setCustomVariants(others);
    }).catch(() => {
      toast({ variant: "destructive", title: "Product not found" });
      setLocation("/dashboard");
    }).finally(() => setLoading(false));
  }, [id]);

  /* ── size helpers ── */
  const toggleSize = (size: string) =>
    setSelectedSizes(prev => prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]);
  const addCustomSize = () => {
    const val = customSizeInput.trim();
    if (val && !selectedSizes.includes(val)) setSelectedSizes(prev => [...prev, val]);
    setCustomSizeInput(""); setShowCustomSizeInput(false);
  };
  const handleCustomSizeKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); addCustomSize(); }
    if (e.key === "Escape") { setShowCustomSizeInput(false); setCustomSizeInput(""); }
  };

  /* ── colour helpers ── */
  const addColor = () => {
    const val = colorInput.trim();
    if (val && !colors.includes(val)) setColors(prev => [...prev, val]);
    setColorInput("");
  };
  const handleColorKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); addColor(); }
  };

  /* ── custom variant helpers ── */
  const addCustomVariant = () =>
    setCustomVariants(prev => [...prev, { id: crypto.randomUUID(), label: "", values: [], inputValue: "" }]);
  const updateVariantLabel = (id: string, label: string) =>
    setCustomVariants(prev => prev.map(v => v.id === id ? { ...v, label } : v));
  const addVariantValue = (id: string) =>
    setCustomVariants(prev => prev.map(v => {
      if (v.id !== id) return v;
      const val = v.inputValue.trim();
      return val && !v.values.includes(val)
        ? { ...v, values: [...v.values, val], inputValue: "" }
        : { ...v, inputValue: "" };
    }));
  const updateVariantInput = (id: string, inputValue: string) =>
    setCustomVariants(prev => prev.map(v => v.id === id ? { ...v, inputValue } : v));
  const removeVariantValue = (id: string, val: string) =>
    setCustomVariants(prev => prev.map(v => v.id === id ? { ...v, values: v.values.filter(x => x !== val) } : v));
  const removeVariant = (id: string) =>
    setCustomVariants(prev => prev.filter(v => v.id !== id));
  const handleVariantValueKey = (e: KeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key === "Enter") { e.preventDefault(); addVariantValue(id); }
  };

  /* ── image helpers ── */
  const handleAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setNewFiles(prev => [...prev, ...files]);
    setNewPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const removeExisting = (idx: number) =>
    setExistingImageUrls(prev => prev.filter((_, i) => i !== idx));
  const removeNew = (idx: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== idx));
    setNewPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const buildVariants = () => {
    const variants = [];
    if (selectedSizes.length > 0) variants.push({ label: "Size", values: selectedSizes });
    if (colors.length > 0) variants.push({ label: "Colour", values: colors });
    for (const cv of customVariants) {
      if (cv.label.trim() && cv.values.length > 0)
        variants.push({ label: cv.label.trim(), values: cv.values });
    }
    return variants;
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!product) return;
    setIsSubmitting(true);
    try {
      let uploadedUrls: string[] = [];
      if (newFiles.length > 0) {
        setUploadingImages(true);
        try {
          uploadedUrls = await Promise.all(newFiles.map(f => uploadImage(f)));
        } catch (err: any) {
          toast({ variant: "destructive", title: "Image upload failed", description: err.message });
          setIsSubmitting(false);
          setUploadingImages(false);
          return;
        }
        setUploadingImages(false);
      }

      const allImageUrls = [...existingImageUrls, ...uploadedUrls];
      await updateProduct(product.id, {
        name: values.name,
        price: values.price,
        description: values.description,
        category: values.category ?? "",
        units: values.units,
        sale_price: values.salePrice && values.salePrice > 0 && values.salePrice < values.price ? values.salePrice : null,
        variants: buildVariants(),
        image_url: allImageUrls[0] ?? "",
        image_urls: allImageUrls,
      });
      toast({ title: "Product updated!", description: `${values.name} has been saved.` });
      setLocation("/dashboard?tab=2");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to update product", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  const allPreviews = [
    ...existingImageUrls.map(url => ({ src: url, isExisting: true, idx: existingImageUrls.indexOf(url) })),
    ...newPreviews.map((src, idx) => ({ src, isExisting: false, idx })),
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-muted/10">
      <Navbar />
      <main className="flex-1 container max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Button
          variant="ghost"
          className="mb-6 pl-0 hover:bg-transparent text-muted-foreground hover:text-foreground"
          onClick={() => setLocation("/dashboard?tab=2")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Listings
        </Button>

        <div className="bg-card p-6 sm:p-8 rounded-3xl border shadow-sm">
          <h1 className="text-2xl font-bold mb-6">Edit Product</h1>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* Multi-image upload */}
              <div className="space-y-2">
                <label className="text-base font-semibold">Product Photos</label>
                <div className="flex flex-wrap gap-2">
                  {allPreviews.map(({ src, isExisting, idx }) => (
                    <div key={`${isExisting ? "ex" : "new"}-${idx}`} className="relative w-24 h-24 rounded-xl overflow-hidden border bg-muted/30 shrink-0">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => isExisting ? removeExisting(idx) : removeNew(idx)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      {isExisting && idx === 0 && (
                        <span className="absolute bottom-1 left-1 text-[8px] bg-primary text-white px-1.5 py-0.5 rounded-full font-semibold">Cover</span>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 h-24 rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors shrink-0"
                  >
                    <ImagePlus className="h-6 w-6" />
                    <span className="text-[10px] font-medium">Add Photo</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleAddImages}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">First photo is the cover image. Tap × to remove.</p>
              </div>

              {/* Product Name */}
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">Product Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Handwoven Cotton Scarf" className="h-12 rounded-xl" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Category */}
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">Category <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Clothes, Food, Crafts..." className="h-12 rounded-xl" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* MRP */}
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">MRP (₹) <span className="text-muted-foreground font-normal text-sm">— Maximum Retail Price</span></FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-muted-foreground">₹</span>
                      <Input type="number" placeholder="0" className="pl-8 h-12 rounded-xl" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Sale Price */}
              <FormField control={form.control} name="salePrice" render={({ field }) => {
                const mrp = form.watch("price");
                const sp = Number(field.value) || 0;
                const hasDiscount = sp > 0 && mrp > 0 && sp < mrp;
                const pct = hasDiscount ? Math.round((mrp - sp) / mrp * 100) : null;
                const savings = hasDiscount ? mrp - sp : null;
                return (
                  <FormItem>
                    <FormLabel className="text-base font-semibold">
                      Sale Price (₹) <span className="text-muted-foreground font-normal text-sm">(optional — leave blank if no discount)</span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-4 top-3 text-muted-foreground">₹</span>
                        <Input type="number" placeholder="Leave blank for no sale" className="pl-8 h-12 rounded-xl" {...field} />
                      </div>
                    </FormControl>
                    {hasDiscount && pct !== null && savings !== null && (
                      <p className="text-sm text-green-600 font-semibold mt-1">
                        {pct}% OFF · Customer saves ₹{savings.toLocaleString("en-IN")}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                );
              }} />

              {/* Units */}
              <FormField control={form.control} name="units" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">Units Available</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} placeholder="e.g. 50" className="h-12 rounded-xl" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Description */}
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Tell your customers about this product..." className="min-h-[120px] rounded-xl resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Variants */}
              <div className="border rounded-2xl p-5 space-y-5 bg-muted/20">
                <div>
                  <p className="text-base font-semibold">Variants <span className="text-sm font-normal text-muted-foreground">(optional)</span></p>
                  <p className="text-sm text-muted-foreground mt-0.5">Add sizes, colours, or any other options.</p>
                </div>

                {/* Size */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Size</p>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_SIZES.map(size => (
                      <button key={size} type="button" onClick={() => toggleSize(size)}
                        className={`h-9 px-4 rounded-full border text-sm font-medium transition-all ${selectedSizes.includes(size) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"}`}>
                        {size}
                      </button>
                    ))}
                    {selectedSizes.filter(s => !PRESET_SIZES.includes(s)).map(size => (
                      <span key={size} className="h-9 px-3 pr-2 rounded-full border bg-primary text-primary-foreground border-primary text-sm font-medium flex items-center gap-1">
                        {size}
                        <button type="button" onClick={() => setSelectedSizes(prev => prev.filter(s => s !== size))} className="hover:opacity-70"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                    {showCustomSizeInput ? (
                      <input ref={customSizeRef} autoFocus value={customSizeInput}
                        onChange={e => setCustomSizeInput(e.target.value)}
                        onKeyDown={handleCustomSizeKey} onBlur={addCustomSize}
                        placeholder="e.g. XXL"
                        className="h-9 w-20 px-3 rounded-full border border-primary text-sm outline-none bg-background" />
                    ) : (
                      <button type="button" onClick={() => setShowCustomSizeInput(true)}
                        className="h-9 w-9 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Colour */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Colour</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    {colors.map(color => (
                      <span key={color} className="h-9 px-3 pr-2 rounded-full border bg-secondary text-secondary-foreground text-sm font-medium flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full border border-border shrink-0" style={{ backgroundColor: color.toLowerCase() }} />
                        {color}
                        <button type="button" onClick={() => setColors(prev => prev.filter(c => c !== color))} className="hover:opacity-70 ml-0.5"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                    <div className="flex items-center gap-1">
                      <input value={colorInput} onChange={e => setColorInput(e.target.value)} onKeyDown={handleColorKey}
                        placeholder="e.g. Red"
                        className="h-9 w-28 px-3 rounded-full border border-border text-sm outline-none bg-background focus:border-primary transition-colors" />
                      <button type="button" onClick={addColor} disabled={!colorInput.trim()}
                        className="h-9 w-9 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-40">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Custom variants */}
                {customVariants.map(variant => (
                  <div key={variant.id} className="space-y-2 pt-3 border-t border-border/50">
                    <div className="flex items-center gap-2">
                      <input value={variant.label} onChange={e => updateVariantLabel(variant.id, e.target.value)}
                        placeholder="Variant name (e.g. Material)"
                        className="flex-1 h-9 px-3 rounded-xl border border-border text-sm font-semibold outline-none bg-background focus:border-primary transition-colors" />
                      <button type="button" onClick={() => removeVariant(variant.id)}
                        className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      {variant.values.map(val => (
                        <span key={val} className="h-8 px-3 pr-2 rounded-full border bg-secondary text-secondary-foreground text-sm flex items-center gap-1">
                          {val}
                          <button type="button" onClick={() => removeVariantValue(variant.id, val)} className="hover:opacity-70"><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                      <div className="flex items-center gap-1">
                        <input value={variant.inputValue} onChange={e => updateVariantInput(variant.id, e.target.value)}
                          onKeyDown={e => handleVariantValueKey(e, variant.id)} placeholder="Add option"
                          className="h-8 w-28 px-3 rounded-full border border-border text-sm outline-none bg-background focus:border-primary transition-colors" />
                        <button type="button" onClick={() => addVariantValue(variant.id)} disabled={!variant.inputValue.trim()}
                          className="h-8 w-8 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-40">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addCustomVariant}
                  className="flex items-center gap-2 text-sm text-primary font-medium hover:underline mt-1">
                  <Plus className="h-4 w-4" />Add another variant
                </button>
              </div>

              {/* Submit */}
              <div className="pt-4 border-t">
                <Button type="submit" className="w-full h-14 rounded-xl text-lg shadow-md" disabled={isSubmitting}>
                  {uploadingImages ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Uploading photos...</>
                  ) : isSubmitting ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving...</>
                  ) : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </main>
    </div>
  );
}
