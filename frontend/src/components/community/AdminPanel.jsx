import React, { useState } from "react";
import { communitiesAPI, communityMembersAPI, postsAPI, filesAPI } from "@/api/apiClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Trash2, Pin, PinOff, Users, UserX, Check, Settings, Image, Type, Globe, Lock, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const COMMUNITY_CATEGORIES = [
  { id: "fashion", label: "Fashion", emoji: "👗" },
  { id: "tech", label: "Tech", emoji: "💻" },
  { id: "fitness", label: "Fitness", emoji: "💪" },
  { id: "food", label: "Food", emoji: "🍕" },
  { id: "art", label: "Art", emoji: "🎨" },
  { id: "music", label: "Music", emoji: "🎵" },
  { id: "gaming", label: "Gaming", emoji: "🎮" },
  { id: "travel", label: "Travel", emoji: "✈️" },
  { id: "diy", label: "DIY", emoji: "🛠️" },
];

export default function AdminPanel({ community, posts, members }) {
  const [rulesText, setRulesText] = useState(community?.rules || "");
  const [description, setDescription] = useState(community?.description || "");
  const [coverImage, setCoverImage] = useState(community?.cover_image || "");
  const [iconUrl, setIconUrl] = useState(community?.icon_url || "");
  const [category, setCategory] = useState(community?.category || "other");
  const [isPublic, setIsPublic] = useState(community?.is_public !== false);
  const [open, setOpen] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const queryClient = useQueryClient();

  const updateCommunityMutation = useMutation({
    mutationFn: (data) => communitiesAPI.update(community.id || community._id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community"] });
      toast.success("Community updated");
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: (postId) => postsAPI.delete(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communityPosts"] });
      toast.success("Post removed");
    },
  });

  const pinPostMutation = useMutation({
    mutationFn: async ({ post, pin }) => {
      const postId = post._id || post.id;
      const communityId = community._id || community.id;
      const currentPinned = community.pinned_post_ids || [];
      await communitiesAPI.update(communityId, {
        pinned_post_ids: pin ? [postId, ...currentPinned.filter(id => id !== postId)] : currentPinned.filter(id => id !== postId)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["community"] });
      toast.success("Post pinning updated!");
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId) => communityMembersAPI.delete(memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communityMembers"] });
      toast.success("Member removed");
    },
  });

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingCover(true);
    try {
      const result = await filesAPI.upload(file, { folder: 'community-covers' });
      setCoverImage(result.url);
      toast.success("Cover image uploaded!");
    } catch (error) {
      toast.error("Failed to upload cover image");
      console.error(error);
    } finally {
      setUploadingCover(false);
    }
  };

  const handleIconUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingIcon(true);
    try {
      const result = await filesAPI.upload(file, { folder: 'community-icons' });
      setIconUrl(result.url);
      toast.success("Icon uploaded!");
    } catch (error) {
      toast.error("Failed to upload icon");
      console.error(error);
    } finally {
      setUploadingIcon(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5">
          <Shield className="w-4 h-4 text-orange-500" /> Moderate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-500" /> Admin Panel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Community Description */}
          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
              <Type className="w-4 h-4" /> Description
            </h4>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe your community..."
              className="h-20 text-sm"
            />
            <Button
              size="sm"
              onClick={() => updateCommunityMutation.mutate({ description })}
              className="mt-2 bg-orange-600 hover:bg-orange-700 rounded-lg"
            >
              <Check className="w-3.5 h-3.5 mr-1" /> Save Description
            </Button>
          </div>

          {/* Cover Image (Banner) */}
          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
              <Image className="w-4 h-4" /> Cover Image (Banner)
            </h4>
            <div className="space-y-2">
              <Label htmlFor="cover-upload" className="cursor-pointer">
                <div className="flex items-center gap-2 p-3 border-2 border-dashed border-slate-300 rounded-lg hover:border-orange-400 transition-colors">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">
                    {uploadingCover ? "Uploading..." : "Click to upload cover image"}
                  </span>
                  {uploadingCover && <Loader2 className="w-4 h-4 animate-spin" />}
                </div>
              </Label>
              <Input
                id="cover-upload"
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                className="hidden"
                disabled={uploadingCover}
              />
              {coverImage && (
                <img src={coverImage} alt="Cover preview" className="w-full h-32 object-cover rounded-lg" />
              )}
              <Button
                size="sm"
                onClick={() => updateCommunityMutation.mutate({ cover_image: coverImage })}
                disabled={!coverImage || updateCommunityMutation.isPending}
                className="bg-orange-600 hover:bg-orange-700 rounded-lg"
              >
                <Check className="w-3.5 h-3.5 mr-1" /> Save Banner
              </Button>
            </div>
          </div>

          {/* Profile Icon */}
          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
              <Image className="w-4 h-4" /> Profile Icon
            </h4>
            <div className="space-y-2">
              <Label htmlFor="icon-upload" className="cursor-pointer">
                <div className="flex items-center gap-2 p-3 border-2 border-dashed border-slate-300 rounded-lg hover:border-orange-400 transition-colors">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">
                    {uploadingIcon ? "Uploading..." : "Click to upload icon"}
                  </span>
                  {uploadingIcon && <Loader2 className="w-4 h-4 animate-spin" />}
                </div>
              </Label>
              <Input
                id="icon-upload"
                type="file"
                accept="image/*"
                onChange={handleIconUpload}
                className="hidden"
                disabled={uploadingIcon}
              />
              {iconUrl && (
                <img src={iconUrl} alt="Icon preview" className="w-16 h-16 rounded-lg object-cover" />
              )}
              <Button
                size="sm"
                onClick={() => updateCommunityMutation.mutate({ icon_url: iconUrl })}
                disabled={!iconUrl || updateCommunityMutation.isPending}
                className="bg-orange-600 hover:bg-orange-700 rounded-lg"
              >
                <Check className="w-3.5 h-3.5 mr-1" /> Save Icon
              </Button>
            </div>
          </div>

          {/* Category */}
          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
              <Settings className="w-4 h-4" /> Category
            </h4>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                {COMMUNITY_CATEGORIES.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.emoji} {c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={() => updateCommunityMutation.mutate({ category })}
              className="mt-2 bg-orange-600 hover:bg-orange-700 rounded-lg"
            >
              <Check className="w-3.5 h-3.5 mr-1" /> Save Category
            </Button>
          </div>

          {/* Visibility */}
          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
              {isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />} Visibility
            </h4>
            <div className="flex items-center gap-2">
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              <span className="text-sm text-slate-600">{isPublic ? "Public" : "Private"}</span>
            </div>
            <Button
              size="sm"
              onClick={() => updateCommunityMutation.mutate({ is_public: isPublic })}
              className="mt-2 bg-orange-600 hover:bg-orange-700 rounded-lg"
            >
              <Check className="w-3.5 h-3.5 mr-1" /> Save Visibility
            </Button>
          </div>

          {/* Community Rules */}
          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
              <Settings className="w-4 h-4" /> Community Rules
            </h4>
            <Textarea
              value={rulesText}
              onChange={e => setRulesText(e.target.value)}
              placeholder="Set rules for your community..."
              className="h-24 text-sm"
            />
            <Button
              size="sm"
              onClick={() => updateCommunityMutation.mutate({ rules: rulesText })}
              className="mt-2 bg-orange-600 hover:bg-orange-700 rounded-lg"
            >
              <Check className="w-3.5 h-3.5 mr-1" /> Save Rules
            </Button>
          </div>

          {/* Pin Posts */}
          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
              <Pin className="w-4 h-4" /> Pin / Remove Posts
            </h4>
            <div className="space-y-2 max-h-44 overflow-y-auto">
              {posts.slice(0, 10).map(post => {
                const postId = post._id || post.id;
                const isPinned = (community?.pinned_post_ids || []).includes(postId);
                return (
                  <div key={postId} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
                    <p className="flex-1 text-xs text-slate-700 line-clamp-1">{post.content}</p>
                    <button
                      onClick={() => pinPostMutation.mutate({ post, pin: !isPinned })}
                      className={`shrink-0 p-1.5 rounded-lg text-xs font-medium transition-colors ${isPinned ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                      title={isPinned ? "Unpin" : "Pin"}
                    >
                      {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => deletePostMutation.mutate(postId)}
                      className="shrink-0 p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition-colors"
                      title="Delete post"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              {posts.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No posts yet</p>}
            </div>
          </div>

          {/* Members */}
          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Members ({members.length})
            </h4>
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {members.map(m => {
                const memberId = m._id || m.id;
                return (
                  <div key={memberId} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                      {m.member_username?.[0]?.toUpperCase()}
                    </div>
                    <p className="flex-1 text-xs text-slate-700 truncate">@{m.member_username}</p>
                    <Badge className="text-[10px] bg-slate-100 text-slate-600 border-0 capitalize">{m.role}</Badge>
                    <button
                      onClick={() => removeMemberMutation.mutate(memberId)}
                      className="shrink-0 p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition-colors"
                      title="Remove member"
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              {members.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No members yet</p>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
