import { useState, useRef, KeyboardEvent } from "react";
import { useLocation } from "wouter";
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
import { createProduct, uploadImage } from "@/lib/api";

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

export function AddProductPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  /* multiple images */
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
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
    defaultValues: { name: "", price: undefined, salePrice: undefined, units: 1, description: "", category: "" },
  });

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

  const addColor = () => {
    const val = colorInput.trim();
    if (val && !colors.includes(val)) setColors(prev => [...prev, val]);
    setColorInput("");
  };
  const handleColorKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); addColor(); }
  };

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

  const handleAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setSelectedFiles(prev => [...prev, ...files]);
    setPreviewImages(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const removeImage = (idx: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviewImages(prev => prev.filter((_, i) => i !== idx));
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
    const storeId = localStorage.getItem("shop_store_id");
    if (!storeId) {
      toast({ variant: "destructive", title: "Store not set up yet", description: "Please wait and try again." });
      return;
    }
    setIsSubmitting(true);
    try {
      let imageUrls: string[] = [];
      if (selectedFiles.length > 0) {
        setUploadingImages(true);
        try {
          imageUrls = await Promise.all(selectedFiles.map(f => uploadImage(f)));
        } catch (err: any) {
          toast({ variant: "destructive", title: "Image upload failed", description: err.message });
          setIsSubmitting(false);
          setUploadingImages(false);
          return;
        }
        setUploadingImages(false);
      }

      /* Fallback placeholder if no images uploaded */
      if (imageUrls.length === 0) {
        imageUrls = [`https://picsum.photos/seed/${encodeURIComponent(values.name)}/400/400`];
      }

      await createProduct({
        store_id: storeId,
        name: values.name,
        price: values.price,
        description: values.description,
        category: values.category ?? "",
        units: values.units,
        variants: buildVariants(),
        image_url: imageUrls[0],
        image_urls: imageUrls,
        sale_price: values.salePrice && values.salePrice > 0 && values.salePrice < values.price ? values.salePrice : undefined,
      });
      toast({ title: "Product saved!", description: `${values.name} has been added to your store.` });
      setLocation("/dashboard");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to save product", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-muted/10">
      <Navbar />
      <main className="flex-1 container max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent text-muted-foreground hover:text-foreground"
          onClick={() => setLocation("/dashboard")} data-testid="btn-back">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>

        <div className="bg-card p-6 sm:p-8 rounded-3xl border shadow-sm">
          <h1 className="text-2xl font-bold mb-6">Add New Product</h1>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* Multi-image upload */}
              <div className="space-y-2">
                <label className="text-base font-semibold">Product Photos</label>
                <div className="flex flex-wrap gap-2">
                  {previewImages.map((src, idx) => (
                    <div key={idx} className="relative w-24 h-24 rounded-xl overflow-hidden border bg-muted/30 shrink-0">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      {idx === 0 && (
                        <span className="absolute bottom-1 left-1 text-[8px] bg-primary text-white px-1.5 py-0.5 rounded-full font-semibold">Cover</span>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 h-24 rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors shrink-0"
                    data-testid="upload-image-area"
                  >
                    <ImagePlus className="h-6 w-6" />
                    <span className="text-[10px] font-medium">{previewImages.length === 0 ? "Add Photos" : "Add More"}</span>
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
                <p className="text-[11px] text-muted-foreground">First photo is the cover. You can add multiple photos.</p>
              </div>

              {/* Product Name */}
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">Product Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Handwoven Cotton Scarf" className="h-12 rounded-xl" {...field} data-testid="input-product-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Category */}
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">Category <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Clothes, Food, Crafts..." className="h-12 rounded-xl" {...field} data-testid="input-product-category" />
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
                      <Input type="number" placeholder="0" className="pl-8 h-12 rounded-xl" {...field} data-testid="input-product-price" />
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
                        <Input type="number" placeholder="Leave blank for no sale" className="pl-8 h-12 rounded-xl" {...field} data-testid="input-product-sale-price" />
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
                    <Input type="number" min={0} placeholder="e.g. 50" className="h-12 rounded-xl" {...field} data-testid="input-product-units" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Description */}
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Tell your customers about this product..."
                      className="min-h-[120px] rounded-xl resize-none" {...field} data-testid="textarea-product-desc" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Variants */}
              <div className="border rounded-2xl p-5 space-y-5 bg-muted/20" data-testid="variants-section">
                <div>
                  <p className="text-base font-semibold">Variants <span className="text-sm font-normal text-muted-foreground">(optional)</span></p>
                  <p className="text-sm text-muted-foreground mt-0.5">Add sizes, colours, or any other options your product comes in.</p>
                </div>

                {/* Size */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">Size</p>
                  <div className="flex flex-wrap gap-2" data-testid="size-chips">
                    {PRESET_SIZES.map(size => (
                      <button key={size} type="button" onClick={() => toggleSize(size)} data-testid={`chip-size-${size}`}
                        className={`h-9 px-4 rounded-full border text-sm font-medium transition-all ${selectedSizes.includes(size) ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:border-primary/50"}`}>
                        {size}
                      </button>
                    ))}
                    {selectedSizes.filter(s => !PRESET_SIZES.includes(s)).map(size => (
                      <span key={size} className="h-9 px-3 pr-2 rounded-full border bg-primary text-primary-foreground border-primary text-sm font-medium flex items-center gap-1">
                        {size}
                        <button type="button" onClick={() => setSelectedSizes(prev => prev.filter(s => s !== size))} className="hover:opacity-70" data-testid={`remove-size-${size}`}><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                    {showCustomSizeInput ? (
                      <input ref={customSizeRef} autoFocus value={customSizeInput}
                        onChange={e => setCustomSizeInput(e.target.value)}
                        onKeyDown={handleCustomSizeKey} onBlur={addCustomSize}
                        placeholder="e.g. XXL"
                        className="h-9 w-20 px-3 rounded-full border border-primary text-sm outline-none bg-background"
                        data-testid="input-custom-size" />
                    ) : (
                      <button type="button" onClick={() => setShowCustomSizeInput(true)}
                        className="h-9 w-9 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                        data-testid="btn-add-custom-size">
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Colour */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">Colour</p>
                  <div className="flex flex-wrap gap-2 items-center" data-testid="colour-chips">
                    {colors.map(color => (
                      <span key={color} className="h-9 px-3 pr-2 rounded-full border bg-secondary text-secondary-foreground text-sm font-medium flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full border border-border shrink-0" style={{ backgroundColor: color.toLowerCase() }} />
                        {color}
                        <button type="button" onClick={() => setColors(prev => prev.filter(c => c !== color))} className="hover:opacity-70 ml-0.5" data-testid={`remove-colour-${color}`}><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                    <div className="flex items-center gap-1">
                      <input value={colorInput} onChange={e => setColorInput(e.target.value)} onKeyDown={handleColorKey}
                        placeholder="e.g. Red"
                        className="h-9 w-28 px-3 rounded-full border border-border text-sm outline-none bg-background focus:border-primary transition-colors"
                        data-testid="input-colour" />
                      <button type="button" onClick={addColor} disabled={!colorInput.trim()}
                        className="h-9 w-9 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-40"
                        data-testid="btn-add-colour">
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
                        className="flex-1 h-9 px-3 rounded-xl border border-border text-sm font-semibold outline-none bg-background focus:border-primary transition-colors"
                        data-testid={`input-variant-label-${variant.id}`} />
                      <button type="button" onClick={() => removeVariant(variant.id)}
                        className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        data-testid={`btn-remove-variant-${variant.id}`}>
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
                          className="h-8 w-28 px-3 rounded-full border border-border text-sm outline-none bg-background focus:border-primary transition-colors"
                          data-testid={`input-variant-value-${variant.id}`} />
                        <button type="button" onClick={() => addVariantValue(variant.id)} disabled={!variant.inputValue.trim()}
                          className="h-8 w-8 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-40">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                <button type="button" onClick={addCustomVariant}
                  className="flex items-center gap-2 text-sm text-primary font-medium hover:underline mt-1"
                  data-testid="btn-add-variant">
                  <Plus className="h-4 w-4" />Add another variant
                </button>
              </div>

              {/* Submit */}
              <div className="pt-4 border-t">
                <Button type="submit" className="w-full h-14 rounded-xl text-lg shadow-md" disabled={isSubmitting} data-testid="btn-save-product">
                  {uploadingImages ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Uploading photos...</>
                  ) : isSubmitting ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving...</>
                  ) : "Save Product"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </main>
    </div>
  );
}
