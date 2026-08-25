import React, { useState } from "react";
import { Upload, Loader2, X, Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { uploadImage, uploadVideo } from "@/lib/storage";
import { toast } from "sonner";

const CATEGORIES = ["fashion", "electronics", "home", "beauty", "sports", "food", "art", "books", "handmade", "other"];

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-xs font-semibold text-slate-500 dark:text-ink-400 block">{label}</label>}
      {children}
    </div>
  );
}

function ImageUploadField({ label, value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const handle = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadImage(file, { folder: "stores" });
      if (res.url) onChange(res.url);
    } catch {
      toast.error("Image upload failed");
    } finally {
      setUploading(false);
    }
  };
  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-xl bg-slate-50 dark:bg-ink-800 border border-slate-100 dark:border-ink-700 flex items-center justify-center overflow-hidden shrink-0">
          {value ? <img src={value} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-slate-300" />}
        </div>
        <div className="relative flex-1">
          <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handle} disabled={uploading} />
          <Button type="button" variant="outline" size="sm" className="w-full text-xs h-9 rounded-lg" disabled={uploading}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
            {value ? "Change" : "Upload"}
          </Button>
        </div>
        {value && (
          <button type="button" onClick={() => onChange("")} className="text-slate-400 hover:text-red-500 shrink-0">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </Field>
  );
}

function VideoUploadField({ label, value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const handle = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadVideo(file, { folder: "stores" });
      if (res.url) onChange(res.url);
    } catch {
      toast.error("Video upload failed");
    } finally {
      setUploading(false);
    }
  };
  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-xl bg-slate-50 dark:bg-ink-800 border border-slate-100 dark:border-ink-700 flex items-center justify-center overflow-hidden shrink-0">
          {value ? <VideoIcon className="w-5 h-5 text-slate-400" /> : <VideoIcon className="w-5 h-5 text-slate-300" />}
        </div>
        <div className="relative flex-1">
          <input type="file" accept="video/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handle} disabled={uploading} />
          <Button type="button" variant="outline" size="sm" className="w-full text-xs h-9 rounded-lg" disabled={uploading}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
            {value ? "Change" : "Upload"}
          </Button>
        </div>
        {value && (
          <button type="button" onClick={() => onChange("")} className="text-slate-400 hover:text-red-500 shrink-0">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </Field>
  );
}

function GalleryImagesField({ images = [], onChange }) {
  const [uploading, setUploading] = useState(false);
  const handle = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (images.length >= 20) {
      toast.error("Gallery allows up to 20 images");
      return;
    }
    setUploading(true);
    try {
      const remaining = 20 - images.length;
      const urls = [];
      for (const file of files.slice(0, remaining)) {
        const res = await uploadImage(file, { folder: "stores" });
        if (res.url) urls.push(res.url);
      }
      onChange([...images, ...urls]);
    } catch {
      toast.error("Image upload failed");
    } finally {
      setUploading(false);
    }
  };
  return (
    <Field label={`Images (${images.length}/20)`}>
      <div className="flex flex-wrap gap-2">
        {images.map((url, i) => (
          <div key={`${url}-${i}`} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-100 dark:border-ink-700 group">
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(images.filter((_, idx) => idx !== i))}
              className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {images.length < 20 && (
          <label className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-200 dark:border-ink-700 flex items-center justify-center cursor-pointer hover:border-orange-400 transition-colors text-slate-400">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <input type="file" accept="image/*" multiple className="hidden" onChange={handle} disabled={uploading} />
          </label>
        )}
      </div>
    </Field>
  );
}

function StyleEditor({ style = {}, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-ink-700">
      <Field label="Background color">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={style.background_color || "#ffffff"}
            onChange={(e) => onChange({ background_color: e.target.value })}
            className="w-9 h-9 rounded-lg border border-slate-200 dark:border-ink-700 cursor-pointer bg-transparent p-0.5"
          />
          {style.background_color && (
            <button type="button" onClick={() => onChange({ background_color: undefined })} className="text-xs text-slate-400 hover:text-red-500">
              Clear
            </button>
          )}
        </div>
      </Field>
      <Field label="Width">
        <Select value={style.width || "contained"} onValueChange={(v) => onChange({ width: v })}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="contained">Contained</SelectItem>
            <SelectItem value="full">Full width</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Padding">
        <Select value={style.padding || "md"} onValueChange={(v) => onChange({ padding: v })}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="sm">Small</SelectItem>
            <SelectItem value="md">Medium</SelectItem>
            <SelectItem value="lg">Large</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Text align">
        <Select value={style.text_align || "left"} onValueChange={(v) => onChange({ text_align: v })}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

export default function BlockEditor({ block, onUpdate, storeProducts = [] }) {
  const data = block.data || {};
  const updateData = (patch) => onUpdate({ ...block, data: { ...data, ...patch } });
  const updateStyle = (patch) => onUpdate({ ...block, style: { ...block.style, ...patch } });

  return (
    <div className="space-y-4">
      {block.type === "hero" && (
        <>
          <Field label="Headline"><Input maxLength={120} value={data.headline || ""} onChange={(e) => updateData({ headline: e.target.value })} /></Field>
          <Field label="Subheadline"><Textarea maxLength={300} value={data.subheadline || ""} onChange={(e) => updateData({ subheadline: e.target.value })} /></Field>
          <ImageUploadField label="Background image" value={data.image_url} onChange={(url) => updateData({ image_url: url })} />
          <VideoUploadField label="Background video (optional, overrides image)" value={data.video_url} onChange={(url) => updateData({ video_url: url })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Button text"><Input maxLength={40} value={data.cta_text || ""} onChange={(e) => updateData({ cta_text: e.target.value })} /></Field>
            <Field label="Button link"><Input maxLength={500} value={data.cta_link || ""} onChange={(e) => updateData({ cta_link: e.target.value })} placeholder="https:// (blank = links to your products)" /></Field>
          </div>
          <Field label="Height">
            <Select value={data.height || "tall"} onValueChange={(v) => updateData({ height: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compact</SelectItem>
                <SelectItem value="tall">Tall</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      )}

      {block.type === "rich_text" && (
        <>
          <Field label="Title"><Input maxLength={120} value={data.title || ""} onChange={(e) => updateData({ title: e.target.value })} /></Field>
          <Field label="Body"><Textarea rows={6} maxLength={5000} value={data.body || ""} onChange={(e) => updateData({ body: e.target.value })} /></Field>
        </>
      )}

      {block.type === "image" && (
        <>
          <ImageUploadField label="Image" value={data.image_url} onChange={(url) => updateData({ image_url: url })} />
          <Field label="Caption"><Input maxLength={200} value={data.caption || ""} onChange={(e) => updateData({ caption: e.target.value })} /></Field>
          <Field label="Link (optional)"><Input maxLength={500} value={data.link || ""} onChange={(e) => updateData({ link: e.target.value })} placeholder="https:// (blank = links to your products)" /></Field>
        </>
      )}

      {block.type === "image_text" && (
        <>
          <ImageUploadField label="Image" value={data.image_url} onChange={(url) => updateData({ image_url: url })} />
          <Field label="Title"><Input maxLength={120} value={data.title || ""} onChange={(e) => updateData({ title: e.target.value })} /></Field>
          <Field label="Body"><Textarea rows={4} maxLength={2000} value={data.body || ""} onChange={(e) => updateData({ body: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Button text"><Input maxLength={40} value={data.cta_text || ""} onChange={(e) => updateData({ cta_text: e.target.value })} /></Field>
            <Field label="Button link"><Input maxLength={500} value={data.cta_link || ""} onChange={(e) => updateData({ cta_link: e.target.value })} placeholder="https:// (blank = links to your products)" /></Field>
          </div>
          <Field label="Image position">
            <Select value={data.image_position || "left"} onValueChange={(v) => updateData({ image_position: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      )}

      {block.type === "gallery" && (
        <>
          <Field label="Title"><Input maxLength={120} value={data.title || ""} onChange={(e) => updateData({ title: e.target.value })} /></Field>
          <GalleryImagesField images={data.images || []} onChange={(images) => updateData({ images })} />
        </>
      )}

      {block.type === "product_grid" && (
        <>
          <Field label="Title"><Input maxLength={120} value={data.title || ""} onChange={(e) => updateData({ title: e.target.value })} /></Field>
          <Field label="Which products">
            <Select value={data.mode || "newest"} onValueChange={(v) => updateData({ mode: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="best_selling">Best selling</SelectItem>
                <SelectItem value="category">By category</SelectItem>
                <SelectItem value="curated">Handpicked</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {data.mode === "category" && (
            <Field label="Category">
              <Select value={data.category || ""} onValueChange={(v) => updateData({ category: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select a category" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}
          {data.mode === "curated" && (
            <Field label={`Handpicked products (${(data.product_ids || []).length}/24)`}>
              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-100 dark:border-ink-700 rounded-xl p-2">
                {storeProducts.length === 0 && (
                  <p className="text-xs text-slate-400 px-1 py-2">Add products to your store first.</p>
                )}
                {storeProducts.map((p) => {
                  const pid = String(p.id || p._id);
                  const selected = (data.product_ids || []).includes(pid);
                  return (
                    <label key={pid} className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-ink-800 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          const current = data.product_ids || [];
                          if (e.target.checked) {
                            if (current.length >= 24) { toast.error("Up to 24 handpicked products"); return; }
                            updateData({ product_ids: [...current, pid] });
                          } else {
                            updateData({ product_ids: current.filter((id) => id !== pid) });
                          }
                        }}
                      />
                      <span className="truncate">{p.title}</span>
                    </label>
                  );
                })}
              </div>
            </Field>
          )}
          <Field label="Columns">
            <Select value={data.columns || "4"} onValueChange={(v) => updateData({ columns: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      )}

      {block.type === "video" && (
        <>
          <VideoUploadField label="Video" value={data.video_url} onChange={(url) => updateData({ video_url: url })} />
          <Field label="Caption"><Input maxLength={200} value={data.caption || ""} onChange={(e) => updateData({ caption: e.target.value })} /></Field>
        </>
      )}

      {block.type === "testimonials" && (
        <Field label="Title"><Input maxLength={120} value={data.title || ""} onChange={(e) => updateData({ title: e.target.value })} placeholder="What customers say" /></Field>
      )}

      {block.type === "cta_banner" && (
        <>
          <Field label="Heading"><Input maxLength={120} value={data.heading || ""} onChange={(e) => updateData({ heading: e.target.value })} /></Field>
          <Field label="Body"><Textarea maxLength={300} value={data.body || ""} onChange={(e) => updateData({ body: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Button text"><Input maxLength={40} value={data.button_text || ""} onChange={(e) => updateData({ button_text: e.target.value })} /></Field>
            <Field label="Button link"><Input maxLength={500} value={data.button_link || ""} onChange={(e) => updateData({ button_link: e.target.value })} placeholder="https:// (blank = links to your products)" /></Field>
          </div>
        </>
      )}

      {block.type === "categories" && (
        <Field label="Title"><Input maxLength={120} value={data.title || ""} onChange={(e) => updateData({ title: e.target.value })} placeholder="Shop by category" /></Field>
      )}

      {block.type === "contact" && (
        <>
          <Field label="Title"><Input maxLength={120} value={data.title || ""} onChange={(e) => updateData({ title: e.target.value })} placeholder="Get in touch" /></Field>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Show social links</Label>
            <Switch checked={data.show_social !== false} onCheckedChange={(v) => updateData({ show_social: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Show phone/address</Label>
            <Switch checked={data.show_address !== false} onCheckedChange={(v) => updateData({ show_address: v })} />
          </div>
        </>
      )}

      {block.type === "divider" && (
        <Field label="Height">
          <Select value={data.height || "md"} onValueChange={(v) => updateData({ height: v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sm">Small</SelectItem>
              <SelectItem value="md">Medium</SelectItem>
              <SelectItem value="lg">Large</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      )}

      {block.type !== "hero" && block.type !== "divider" && (
        <StyleEditor style={block.style} onChange={updateStyle} />
      )}
    </div>
  );
}
