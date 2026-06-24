import React, { useRef, useState } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { filesAPI } from "@/api/apiClient";
import { toast } from "sonner";

export default function ChatImageUpload({ onImageReady, onClear, previewUrl }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Only images allowed"); return; }
    setUploading(true);
    try {
      const res = await filesAPI.upload(file);
      const file_url = res.url;
      if (!file_url) throw new Error("No URL returned from upload");
      onImageReady(file_url);
    } catch (error) {
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  if (previewUrl) {
    return (
      <div className="relative w-10 h-10 shrink-0">
        <img src={previewUrl} alt="" className="w-10 h-10 rounded-xl object-cover border border-slate-200" />
        <button
          onClick={onClear}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-slate-700 text-white rounded-full flex items-center justify-center"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 transition-colors"
        title="Send image"
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
      </button>
    </>
  );
}