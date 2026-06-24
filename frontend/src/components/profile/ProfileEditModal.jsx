import React, { useState } from "react";
import { authAPI, filesAPI } from "@/api/apiClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ProfileEditModal({ open, onClose, user }) {
  const [displayName, setDisplayName] = useState(user?.display_name || user?.full_name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
  const [bannerUrl, setBannerUrl] = useState(user?.banner_url || "");
  const [uploading, setUploading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const queryClient = useQueryClient();

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await filesAPI.upload(file);
      const file_url = res.url;
      if (!file_url) throw new Error("No URL returned from upload");
      setAvatarUrl(file_url);
    } catch (error) {
      toast.error("Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBanner(true);
    try {
      const res = await filesAPI.upload(file);
      const file_url = res.url;
      if (!file_url) throw new Error("No URL returned from upload");
      setBannerUrl(file_url);
    } catch (error) {
      toast.error("Failed to upload banner");
    } finally {
      setUploadingBanner(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: () => authAPI.updateProfile({ 
      display_name: displayName, 
      bio, 
      avatar_url: avatarUrl,
      banner_url: bannerUrl 
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      queryClient.invalidateQueries({ queryKey: ["profileUser"] });
      toast.success("Profile updated!");
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>

        {/* Banner */}
        <div className="relative h-24 rounded-xl overflow-hidden mb-2 bg-slate-100 group">
          {bannerUrl ? (
            <img src={bannerUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          )}
          <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
            {uploadingBanner ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
            <input type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} disabled={uploadingBanner} />
          </label>
        </div>

        {/* Avatar */}
        <div className="flex justify-center -mt-10 relative z-10 mb-2">
          <label className="relative cursor-pointer group">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center ring-4 ring-white shadow-lg">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-2xl">{displayName?.[0]?.toUpperCase() || "U"}</span>
              )}
            </div>
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              {uploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
          </label>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Display Name</label>
            <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="rounded-xl" placeholder="Your display name" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={3}
              maxLength={160}
              placeholder="Tell people a little about yourself..."
              className="w-full text-sm border border-input rounded-xl px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-indigo-300"
            />
            <p className="text-right text-[10px] text-slate-400">{bio.length}/160</p>
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="flex-1 bg-indigo-600 hover:bg-indigo-700 rounded-xl">
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}